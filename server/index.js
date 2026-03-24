import express from 'express'
import cors from 'cors'
import mqtt from 'mqtt'
import path from 'path'
import { fileURLToPath } from 'url'
import process from 'node:process'
import { randomUUID } from 'node:crypto'

const app = express()
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// Render (and many other hosts) provide the port via PORT.
const HTTP_PORT = Number(process.env.PORT || process.env.MQTT_DASH_BRIDGE_PORT || 5174)
const HTTP_HOST = process.env.MQTT_DASH_BRIDGE_HOST || '0.0.0.0'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const DIST_DIR = path.resolve(__dirname, '..', 'dist')

const SESSION_COOKIE = 'mqtt_dash_sid'
const SESSION_TTL_MS = 60 * 60 * 1000 // 1 hour
const SESSIONS = new Map()

function parseCookies(req) {
  const header = req.headers?.cookie
  if (!header) return {}
  const out = {}
  for (const part of header.split(';')) {
    const [k, ...rest] = part.trim().split('=')
    if (!k) continue
    out[k] = decodeURIComponent(rest.join('=') || '')
  }
  return out
}

function randomId() {
  try {
    return randomUUID()
  } catch {
    // ignore
  }
  return `sid_${Date.now()}_${Math.random().toString(16).slice(2)}`
}

function isHttps(req) {
  const xfProto = req.headers?.['x-forwarded-proto']
  if (typeof xfProto === 'string') return xfProto.split(',')[0].trim() === 'https'
  return !!req.secure
}

function setSessionCookie(res, sessionId, { secure } = {}) {
  const parts = [`${SESSION_COOKIE}=${encodeURIComponent(sessionId)}`, 'Path=/', 'HttpOnly', 'SameSite=Lax']
  if (secure) parts.push('Secure')
  res.setHeader('Set-Cookie', parts.join('; '))
}

function getSession(req, res) {
  const cookies = parseCookies(req)
  let sid = cookies[SESSION_COOKIE]
  if (!sid) {
    sid = randomId()
    setSessionCookie(res, sid, { secure: isHttps(req) })
  }

  let session = SESSIONS.get(sid)
  if (!session) {
    session = {
      id: sid,
      client: null,
      status: 'disconnected',
      errorMessage: '',
      subRefCounts: new Map(),
      sseClients: new Set(),
      lastSeenAt: Date.now(),
    }
    SESSIONS.set(sid, session)
  } else {
    session.lastSeenAt = Date.now()
  }
  return session
}

function sseSend(session, event, data) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`
  for (const res of session.sseClients) {
    try {
      res.write(payload)
    } catch {
      // ignore
    }
  }
}

function setStatus(session, nextStatus, nextErrorMessage = '') {
  session.status = nextStatus
  session.errorMessage = nextErrorMessage || ''
  sseSend(session, 'status', { status: session.status, errorMessage: session.errorMessage })
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

function resubscribeAll(session) {
  if (!session.client) return
  const topics = Array.from(session.subRefCounts.entries())
    .filter(([, count]) => count > 0)
    .map(([topic]) => topic)

  for (const topic of topics) {
    try {
      session.client.subscribe(topic, (err) => {
        if (err) sseSend(session, 'topicError', { topic, error: err.message || 'Subscription failed' })
        else sseSend(session, 'topicOk', { topic })
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription failed'
      sseSend(session, 'topicError', { topic, error: msg })
    }
  }
}

function disconnectMqtt(session) {
  if (session.client) {
    try {
      session.client.removeAllListeners()
      session.client.end(true)
    } catch {
      // ignore
    }
  }
  session.client = null
  setStatus(session, 'disconnected', '')
}

function connectMqtt(session, { host, port, username, password, clientId }) {
  if (!host || typeof host !== 'string') throw new Error('Broker host is required')

  const portNum = Number(port)
  if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) throw new Error('Port must be a valid number')

  const url = `mqtt://${host}:${portNum}`

  disconnectMqtt(session)
  setStatus(session, 'connecting', '')

  session.client = mqtt.connect(url, {
    clientId: clientId || undefined,
    username: username || undefined,
    password: password || undefined,
    reconnectPeriod: 2000,
    connectTimeout: 10_000,
    clean: true,
  })

  session.client.on('connect', () => {
    setStatus(session, 'connected', '')
    resubscribeAll(session)
  })

  session.client.on('reconnect', () => {
    if (session.status !== 'connected') setStatus(session, 'connecting', '')
  })

  session.client.on('close', () => {
    if (session.status !== 'error') setStatus(session, 'disconnected', '')
  })

  session.client.on('offline', () => {
    if (session.status !== 'error') setStatus(session, 'disconnected', '')
  })

  session.client.on('error', (err) => {
    setStatus(session, 'error', err?.message || 'MQTT error')
  })

  session.client.on('message', (topic, payload) => {
    const rawText = safeToString(payload)
    let payloadObj = null
    let payloadError = ''
    try {
      payloadObj = JSON.parse(rawText)
    } catch (err) {
      payloadError = err instanceof Error ? err.message : 'Invalid JSON payload'
    }

    sseSend(session, 'message', {
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
  const session = getSession(req, res)
  res.json({ status: session.status, errorMessage: session.errorMessage })
})

app.get('/api/events', (req, res) => {
  const session = getSession(req, res)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection', 'keep-alive')
  res.flushHeaders?.()

  session.sseClients.add(res)

  // initial status
  res.write(`event: status\ndata: ${JSON.stringify({ status: session.status, errorMessage: session.errorMessage })}\n\n`)

  const pingId = setInterval(() => {
    try {
      res.write(`event: ping\ndata: ${JSON.stringify({ t: Date.now() })}\n\n`)
    } catch {
      // ignore
    }
  }, 25_000)

  req.on('close', () => {
    clearInterval(pingId)
    session.sseClients.delete(res)
    session.lastSeenAt = Date.now()
  })
})

app.post('/api/connect', (req, res) => {
  const session = getSession(req, res)
  try {
    const result = connectMqtt(session, req.body || {})
    res.json({ ok: true, ...result })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Failed to connect'
    setStatus(session, 'error', msg)
    res.status(400).json({ ok: false, error: msg })
  }
})

app.post('/api/disconnect', (req, res) => {
  const session = getSession(req, res)
  disconnectMqtt(session)
  res.json({ ok: true })
})

app.post('/api/subscribe', (req, res) => {
  const session = getSession(req, res)
  const { topic } = req.body || {}
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  const prev = session.subRefCounts.get(topic) || 0
  session.subRefCounts.set(topic, prev + 1)

  if (session.client && prev === 0) {
    try {
      session.client.subscribe(topic, (err) => {
        if (err) {
          sseSend(session, 'topicError', { topic, error: err.message || 'Subscription failed' })
        } else {
          sseSend(session, 'topicOk', { topic })
        }
      })
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Subscription failed'
      sseSend(session, 'topicError', { topic, error: msg })
    }
  }

  res.json({ ok: true })
})

app.post('/api/unsubscribe', (req, res) => {
  const session = getSession(req, res)
  const { topic } = req.body || {}
  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  const prev = session.subRefCounts.get(topic) || 0
  const next = Math.max(0, prev - 1)

  if (next === 0) session.subRefCounts.delete(topic)
  else session.subRefCounts.set(topic, next)

  if (session.client && prev === 1) {
    try {
      session.client.unsubscribe(topic)
    } catch {
      // ignore
    }
  }

  res.json({ ok: true })
})

app.post('/api/publish', (req, res) => {
  const session = getSession(req, res)
  const { topic, payload } = req.body || {}

  if (!topic || typeof topic !== 'string') {
    res.status(400).json({ ok: false, error: 'Topic is required' })
    return
  }

  if (!session.client) {
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

  session.client.publish(topic, message, {}, (err) => {
    if (err) {
      res.status(500).json({ ok: false, error: err.message || 'Publish failed' })
    } else {
      res.json({ ok: true })
    }
  })
})

// Cleanup stale sessions to avoid leaking MQTT connections.
setInterval(() => {
  const now = Date.now()
  for (const [sid, session] of SESSIONS.entries()) {
    const isStale = now - (session.lastSeenAt || 0) > SESSION_TTL_MS
    const hasListeners = session.sseClients && session.sseClients.size > 0
    if (isStale || (!hasListeners && session.status !== 'disconnected')) {
      try {
        disconnectMqtt(session)
      } catch {
        // ignore
      }
    }

    if (isStale && (!session.client || session.status === 'disconnected') && !hasListeners) {
      SESSIONS.delete(sid)
    }
  }
}, 60_000).unref?.()

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
