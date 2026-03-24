import express from 'express'
import cors from 'cors'
import mqtt from 'mqtt'
import path from 'path'
import { fileURLToPath } from 'url'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Render (and many other hosts) provide the port via PORT.
const HTTP_PORT = Number(process.env.PORT || process.env.MQTT_DASH_BRIDGE_PORT || 5174)
const HTTP_HOST = process.env.MQTT_DASH_BRIDGE_HOST || '0.0.0.0'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

let client = null
let status = 'disconnected' // disconnected | connecting | connected | error
let errorMessage = ''

const subRefCounts = new Map() // topic -> count

/** @type {Set<import('express').Response>} */
const sseClients = new Set()

function sseSend(event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of sseClients) {
    try {
      res.write(payload)
    } catch {
      // ignore
    }
  }
}

function setStatus(nextStatus, nextErrorMessage = '') {
  status = nextStatus
  errorMessage = nextErrorMessage || ''
  sseSend('status', { status, errorMessage })
}

function safeToString(payload) {
  try {
    if (payload == null) return ''
    if (typeof payload === 'string') return payload
    if (payload instanceof Uint8Array) return new TextDecoder().decode(payload)
    return String(payload)
  } catch {
    return ''
  }
}

function resubscribeAll() {
  if (!client) return
  const topics = Array.from(subRefCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([topic]) => topic)

  for (const topic of topics) {
    try {
      client.subscribe(topic, (err) => {
        if (err) sseSend('topicError', { topic, error: err.message || 'Subscription failed' })
        else sseSend('topicOk', { topic })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription failed'
      sseSend('topicError', { topic, error: msg })
    }
  }
}

function disconnectMqtt() {
  if (client) {
    try {
      client.removeAllListeners()
      client.end(true)
    } catch {
      // ignore
    }
  }
  client = null
  setStatus('disconnected', '')
}

function connectMqtt({ host, port, username, password, clientId }) {
  if (!host || typeof host !== 'string') throw new Error('Broker host is required')

  const portNum = Number(port)
  if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) throw new Error('Port must be a valid number')

  const url = `mqtt://${host}:${portNum}`

  disconnectMqtt()
  setStatus('connecting', '')

  client = mqtt.connect(url, {
    clientId: clientId || undefined,
    username: username || undefined,
    password: password || undefined,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    clean: true,
  })

  client.on('connect', () => {
    setStatus('connected', '')
    resubscribeAll()
  })

  client.on('reconnect', () => {
    if (status !== 'connected') setStatus('connecting', '')
  })

  client.on('close', () => {
    if (status !== 'error') setStatus('disconnected', '')
  })

  client.on('offline', () => {
    if (status !== 'error') setStatus('disconnected', '')
  })

  client.on('error', (err) => {
    setStatus('error', err?.message || 'MQTT error')
  })

  client.on('message', (topic, payload) => {
    const rawText = safeToString(payload)
    let payloadObj = null
    let payloadError = ''
    try {
      payloadObj = JSON.parse(rawText)
    } catch (err) {
      payloadError = err instanceof Error ? err.message : 'Invalid JSON payload'
    }

    sseSend('message', {
      topic,
      rawText,
      payloadObj,
      payloadError,
      receivedAt: Date.now(),
    })
  })

  return { url }
}

app.get('/api/status', (req, res) => {
  res.json({ status, errorMessage })
})

app.get('/api/events', (req, res) => {
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  sseClients.add(res)

  // initial status
  res.write(`event: status\ndata: ${JSON.stringify({ status, errorMessage })}\n\n`)

  const pingId = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`)
    } catch {
      // ignore
    }
  }, 25_000)

  req.on('close', () => {
    clearInterval(pingId)
    sseClients.delete(res)
  })
})

app.post('/api/connect', (req, res) => {
  try {
    const result = connectMqtt(req.body || {})
    res.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to connect'
    setStatus('error', msg)
    res.status(400).json({ ok: false, error: msg })
  }
})

app.post('/api/disconnect', (req, res) => {
  disconnectMqtt()
  res.json({ ok: true })
})

app.post('/api/subscribe', (req, res) => {
  const { topic } = req.body || {}
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  const prev = subRefCounts.get(topic) || 0
  subRefCounts.set(topic, prev + 1)

  if (client && prev === 0) {
    try {
      client.subscribe(topic, (err) => {
        if (err) {
          sseSend('topicError', { topic, error: err.message || 'Subscription failed' })
        } else {
          sseSend('topicOk', { topic })
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription failed'
      sseSend('topicError', { topic, error: msg })
    }
  }

  res.json({ ok: true })
})

app.post('/api/unsubscribe', (req, res) => {
  const { topic } = req.body || {}
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  const prev = subRefCounts.get(topic) || 0
  const next = Math.max(0, prev - 1)

  if (next === 0) subRefCounts.delete(topic)
  else subRefCounts.set(topic, next)

  if (client && prev === 1) {
    try {
      client.unsubscribe(topic)
    } catch {
      // ignore
    }
  }

  res.json({ ok: true })
})

app.post('/api/publish', (req, res) => {
  const { topic, payload } = req.body || {}

  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  if (!client) {
    res.status(400).json({ ok: false, error: 'Not connected' })
    return
  }

  let message
  try {
    message = JSON.stringify(payload)
  } catch {
    res.status(400).json({ ok: false, error: 'Payload must be JSON-serializable' })
    return
  }

  client.publish(topic, message, {}, (err) => {
    if (err) {
      res.status(500).json({ ok: false, error: err.message || 'Publish failed' })
    } else {
      res.json({ ok: true })
    }
  })
})

// Serve the Vite build (single origin for / + /api + SSE)
app.use(express.static(DIST_DIR))
// Express v5 (path-to-regexp v6) does not accept `*` as a path string.
// Use a regex catch-all instead, and avoid intercepting API routes.
app.get(/^(?!\/api).*/, (req, res) => {
  res.sendFile(path.join(DIST_DIR, 'index.html'))
})

app.listen(HTTP_PORT, HTTP_HOST, () => {
  // eslint-disable-next-line no-console
  console.log(`MQTT Dash bridge listening on http://${HTTP_HOST}:${HTTP_PORT}`)
})
