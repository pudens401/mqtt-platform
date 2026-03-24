import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { loadJson, saveJson } from '../utils/storage.js'
import { createId } from '../utils/ids.js'
import { useMqtt } from '../mqtt/MqttContext.jsx'

function Field({ label, children, hint }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-blue-950">{label}</div>
      {children}
      {hint ? <div className="text-xs text-blue-900/60">{hint}</div> : null}
    </div>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-blue-900/30 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 ${props.className || ''}`}
    />
  )
}

function Button({ variant = 'primary', ...props }) {
  const base = 'inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium'
  const styles =
    variant === 'primary'
      ? 'bg-orange-600 text-white hover:bg-orange-500 disabled:bg-orange-200'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-200'
        : 'border border-blue-900/30 bg-white text-blue-950 hover:bg-orange-50 disabled:text-blue-900/40'
  return <button {...props} className={`${base} ${styles} ${props.className || ''}`} />
}

export default function ConnectionPage() {
  const { status, errorMessage, connect, disconnect, isConnected } = useMqtt()

  const saved = useMemo(() => loadJson(STORAGE_KEYS.mqttConfig, null), [])

  const migrated = useMemo(() => {
    // Backwards-compat: earlier versions stored a ws URL.
    if (saved?.host) return saved
    if (saved?.url && typeof saved.url === 'string') {
      try {
        const u = new URL(saved.url)
        return {
          host: u.hostname || 'localhost',
          port: u.port ? Number(u.port) : 1883,
          clientId: saved?.clientId,
          username: saved?.username,
          password: saved?.password,
        }
      } catch {
        return saved
      }
    }
    return saved
  }, [saved])

  const [host, setHost] = useState(migrated?.host || 'localhost')
  const [port, setPort] = useState(migrated?.port ?? 1883)
  const [clientId, setClientId] = useState(migrated?.clientId || `mqtt_dash_${createId()}`)
  const [username, setUsername] = useState(migrated?.username || '')
  const [password, setPassword] = useState(migrated?.password || '')

  const [localError, setLocalError] = useState('')
  const [info, setInfo] = useState('')

  useEffect(() => {
    // Persist changes lightly so refresh keeps inputs.
    saveJson(STORAGE_KEYS.mqttConfig, {
      host: host.trim(),
      port,
      clientId: clientId.trim(),
      username: username.trim(),
      password,
    })
  }, [host, port, clientId, username, password])

  async function onConnect() {
    setLocalError('')
    setInfo('')

    if (!host.trim()) {
      setLocalError('Broker host is required (example: localhost or 192.168.1.50).')
      return
    }

    const portNum = Number(port)
    if (!Number.isFinite(portNum) || portNum <= 0 || portNum > 65535) {
      setLocalError('Port must be a valid number (1-65535).')
      return
    }

    const cfg = {
      host: host.trim(),
      port: portNum,
      clientId: clientId.trim(),
      username: username.trim(),
      password,
    }

    saveJson(STORAGE_KEYS.mqttConfig, cfg)

    const result = await connect(cfg)
    if (!result.ok) {
      setLocalError(result.error || 'Failed to connect')
    } else {
      setInfo('Connection attempt started. This UI talks to a local bridge which connects to your broker via TCP.')
    }
  }

  function onDisconnect() {
    setLocalError('')
    setInfo('')
    disconnect()
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-blue-900/30 bg-white p-4">
        <div className="mb-1 text-lg font-semibold text-blue-950">MQTT Connection</div>
        <div className="text-sm text-blue-900/70">
          Connect to an MQTT broker over TCP (port 1883 by default) using a local bridge.
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <div className="rounded border border-blue-900/30 bg-white p-4">
          <div className="space-y-4">
            <Field label="Broker host" hint="Example: localhost, 192.168.1.50, broker.example.com">
              <TextInput value={host} onChange={(e) => setHost(e.target.value)} placeholder="localhost" />
            </Field>

            <Field label="Port" hint="Default is 1883 (MQTT TCP).">
              <TextInput
                type="number"
                value={port}
                onChange={(e) => setPort(e.target.value === '' ? '' : Number(e.target.value))}
                min={1}
                max={65535}
              />
            </Field>

            <Field label="Client ID">
              <TextInput value={clientId} onChange={(e) => setClientId(e.target.value)} />
            </Field>

            <Field label="Username (optional)">
              <TextInput value={username} onChange={(e) => setUsername(e.target.value)} autoComplete="username" />
            </Field>

            <Field label="Password (optional)">
              <TextInput
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                type="password"
              />
            </Field>

            <div className="flex flex-wrap gap-2">
              <Button onClick={onConnect} disabled={status === 'connecting' || isConnected}>
                Connect
              </Button>
              <Button variant="danger" onClick={onDisconnect} disabled={!isConnected && status !== 'connecting'}>
                Disconnect
              </Button>
            </div>

            {localError ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{localError}</div> : null}
            {errorMessage ? <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{errorMessage}</div> : null}
            {info ? <div className="rounded border border-blue-900/20 bg-orange-50 p-3 text-sm text-blue-950">{info}</div> : null}
          </div>
        </div>

        <div className="rounded border border-blue-900/30 bg-white p-4">
          <div className="mb-2 text-sm font-semibold text-blue-950">Status</div>
          <div className="space-y-2 text-sm text-blue-950">
            <div>
              <span className="font-medium">Connection:</span> {status}
            </div>
            <div className="text-xs text-blue-900/60">
              Tip: Run the bridge with <span className="font-mono">npm run dev:server</span> (or <span className="font-mono">npm run dev:full</span>).
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
