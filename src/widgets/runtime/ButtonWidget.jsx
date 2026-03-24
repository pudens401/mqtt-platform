import { useMemo, useState } from 'react'
import WidgetCard from './WidgetCard.jsx'
import { useMqtt } from '../../mqtt/MqttContext.jsx'
import { parseJsonText } from '../../utils/json.js'

function Button({ ...props }) {
  return (
    <button
      {...props}
      className={`inline-flex w-full items-center justify-center rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:bg-orange-200 ${
        props.className || ''
      }`}
    />
  )
}

export default function ButtonWidget({ widget }) {
  const { isConnected, publishJson } = useMqtt()
  const cfg = widget.config || {}

  const payloadParsed = useMemo(() => parseJsonText(cfg.payloadText || ''), [cfg.payloadText])
  const [result, setResult] = useState(null)

  async function onClick() {
    setResult(null)

    if (!isConnected) {
      setResult({ ok: false, message: 'Not connected.' })
      return
    }

    if (!cfg.publishTopic?.trim()) {
      setResult({ ok: false, message: 'Publish topic is missing in this widget config.' })
      return
    }

    if (!payloadParsed.ok) {
      setResult({ ok: false, message: `Invalid JSON payload: ${payloadParsed.error}` })
      return
    }

    try {
      await publishJson(cfg.publishTopic.trim(), payloadParsed.value)
      setResult({ ok: true, message: 'Published.' })
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Publish failed' })
    }
  }

  return (
    <WidgetCard title={widget.label} subtitle={`Button · pub: ${cfg.publishTopic || '—'}`}>
      <div className="space-y-3">
        <Button onClick={onClick} disabled={!isConnected}>
          Send
        </Button>

        {!payloadParsed.ok ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">Payload JSON error: {payloadParsed.error}</div>
        ) : null}

        {result ? (
          <div
            className={`rounded border p-2 text-xs ${
              result.ok ? 'border-green-200 bg-green-50 text-green-700' : 'border-red-200 bg-red-50 text-red-700'
            }`}
          >
            {result.message}
          </div>
        ) : null}
      </div>
    </WidgetCard>
  )
}
