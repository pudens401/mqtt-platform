import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'

const MqttContext = createContext(null)

async function apiJson(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  })

  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    const msg = data?.error || `Request failed: ${res.status}`
    throw new Error(msg)
  }
  return data
}

export function MqttProvider({ children }) {
  const subRefCounts = useRef(new Map())
  const eventSourceRef = useRef(null)

  const [status, setStatus] = useState('disconnected')
  const [errorMessage, setErrorMessage] = useState('')
  const [messagesByTopic, setMessagesByTopic] = useState({})
  const [topicErrors, setTopicErrors] = useState({})

  const disconnect = useCallback(() => {
    setTopicErrors({})
    setErrorMessage('')
    apiJson('/api/disconnect', { method: 'POST' }).catch(() => {})
    setStatus('disconnected')
  }, [])

  const connect = useCallback(
    async (config) => {
      const { host, port, username, password, clientId } = config || {}
      if (!host || typeof host !== 'string') {
        setStatus('error')
        setErrorMessage('Broker host is required')
        return { ok: false, error: 'Broker host is required' }
      }

      setStatus('connecting')
      setErrorMessage('')

      try {
        await apiJson('/api/connect', {
          method: 'POST',
          body: {
            host,
            port,
            username,
            password,
            clientId,
          },
        })

        // Ensure any existing subscriptions are registered server-side.
        const topics = Array.from(subRefCounts.current.entries())
          .filter(([, count]) => count > 0)
          .map(([topic]) => topic)

        for (const topic of topics) {
          await apiJson('/api/subscribe', { method: 'POST', body: { topic } })
        }

        return { ok: true }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Failed to connect'
        setStatus('error')
        setErrorMessage(msg)
        return { ok: false, error: msg }
      }
    },
    [disconnect],
  )

  const publishJson = useCallback(async (topic, payloadObj) => {
    if (!topic || typeof topic !== 'string') throw new Error('Topic is required')

    await apiJson('/api/publish', {
      method: 'POST',
      body: { topic, payload: payloadObj },
    })
  }, [])

  const subscribe = useCallback((topic) => {
    if (!topic || typeof topic !== 'string') return

    const map = subRefCounts.current
    const prevCount = map.get(topic) || 0
    const nextCount = prevCount + 1
    map.set(topic, nextCount)

    if (prevCount > 0) return

    apiJson('/api/subscribe', { method: 'POST', body: { topic } }).catch((err) => {
      setTopicErrors((prev) => ({ ...prev, [topic]: err instanceof Error ? err.message : 'Subscription failed' }))
    })
  }, [])

  const unsubscribe = useCallback((topic) => {
    if (!topic || typeof topic !== 'string') return

    const map = subRefCounts.current
    const prevCount = map.get(topic) || 0
    const nextCount = Math.max(0, prevCount - 1)

    if (nextCount === 0) map.delete(topic)
    else map.set(topic, nextCount)

    if (prevCount <= 1) {
      apiJson('/api/unsubscribe', { method: 'POST', body: { topic } }).catch(() => {})
    }
  }, [])

  useEffect(() => {
    // Initialize status from bridge.
    apiJson('/api/status')
      .then((data) => {
        if (data?.status) setStatus(data.status)
        if (data?.errorMessage) setErrorMessage(data.errorMessage)
      })
      .catch((err) => {
        setStatus('error')
        setErrorMessage(err instanceof Error ? err.message : 'Bridge server not reachable')
      })
  }, [])

  useEffect(() => {
    // SSE: live status + messages.
    const es = new EventSource('/api/events')
    eventSourceRef.current = es

    es.addEventListener('status', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data?.status) setStatus(data.status)
        setErrorMessage(data?.errorMessage || '')
      } catch {
        // ignore
      }
    })

    es.addEventListener('topicError', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data?.topic) {
          setTopicErrors((prev) => ({ ...prev, [data.topic]: data.error || 'Subscription failed' }))
        }
      } catch {
        // ignore
      }
    })

    es.addEventListener('topicOk', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data?.topic) {
          setTopicErrors((prev) => {
            const next = { ...prev }
            delete next[data.topic]
            return next
          })
        }
      } catch {
        // ignore
      }
    })

    es.addEventListener('message', (e) => {
      try {
        const data = JSON.parse(e.data)
        if (!data?.topic) return

        setMessagesByTopic((prev) => ({
          ...prev,
          [data.topic]: data,
        }))
      } catch {
        // ignore
      }
    })

    es.onerror = () => {
      setStatus('error')
      setErrorMessage('Bridge server not reachable (is server/index.js running?)')
    }

    return () => {
      try {
        es.close()
      } catch {
        // ignore
      }
      eventSourceRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      disconnect()
    }
  }, [disconnect])

  const value = useMemo(
    () => ({
      status,
      errorMessage,
      messagesByTopic,
      topicErrors,
      connect,
      disconnect,
      publishJson,
      subscribe,
      unsubscribe,
      isConnected: status === 'connected',
    }),
    [status, errorMessage, messagesByTopic, topicErrors, connect, disconnect, publishJson, subscribe, unsubscribe],
  )

  return <MqttContext.Provider value={value}>{children}</MqttContext.Provider>
}

export function useMqtt() {
  const ctx = useContext(MqttContext)
  if (!ctx) throw new Error('useMqtt must be used within MqttProvider')
  return ctx
}
