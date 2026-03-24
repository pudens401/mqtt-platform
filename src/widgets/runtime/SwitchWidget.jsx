import { useMemo, useState } from 'react'
import WidgetCard from './WidgetCard.jsx'
import { useMqtt } from '../../mqtt/MqttContext.jsx'
import { useTopic } from '../../mqtt/useTopic.js'
import { parseJsonText, stableStringify } from '../../utils/json.js'

function Toggle({ value, onChange, disabled }) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onChange(!value)}
      className={`relative inline-flex h-6 w-11 items-center rounded-full border transition ${
        disabled ? 'opacity-50' : ''
      } ${value ? 'bg-orange-600' : 'bg-slate-200'} border-blue-900/30`}
    >
      <span
        className={`inline-block h-5 w-5 transform rounded-full bg-white shadow transition ${value ? 'translate-x-5' : 'translate-x-1'}`}
      />
    </button>
  )
}

export default function SwitchWidget({ widget }) {
  const { isConnected, publishJson } = useMqtt()
  const cfg = widget.config || {}

  const { message, error: subError } = useTopic(cfg.feedbackTopic)

  const onParsed = useMemo(() => parseJsonText(cfg.onPayloadText || ''), [cfg.onPayloadText])
  const offParsed = useMemo(() => parseJsonText(cfg.offPayloadText || ''), [cfg.offPayloadText])

  const [lastSent, setLastSent] = useState(null)
  const [publishError, setPublishError] = useState('')

  const derived = useMemo(() => {
    if (!message || message.payloadObj == null) return { state: null, source: 'none' }
    if (message.payloadError) return { state: null, source: 'invalid-json' }

    if (onParsed.ok && stableStringify(message.payloadObj) === stableStringify(onParsed.value)) return { state: true, source: 'feedback' }
    if (offParsed.ok && stableStringify(message.payloadObj) === stableStringify(offParsed.value)) return { state: false, source: 'feedback' }

    return { state: null, source: 'unmatched-feedback' }
  }, [message, onParsed, offParsed])

  const effectiveState = derived.state != null ? derived.state : lastSent

  const canToggle =
    isConnected &&
    !!cfg.publishTopic?.trim() &&
    onParsed.ok &&
    offParsed.ok

  async function setSwitch(next) {
    setPublishError('')

    if (!isConnected) {
      setPublishError('Not connected.')
      return
    }

    if (!cfg.publishTopic?.trim()) {
      setPublishError('Publish topic is missing in this widget config.')
      return
    }

    if (!onParsed.ok || !offParsed.ok) {
      setPublishError('Invalid JSON payload in widget config.')
      return
    }

    const payload = next ? onParsed.value : offParsed.value

    try {
      await publishJson(cfg.publishTopic.trim(), payload)
      setLastSent(next)
    } catch (err) {
      setPublishError(err instanceof Error ? err.message : 'Publish failed')
    }
  }

  const stateLabel =
    effectiveState == null ? 'Unknown' : effectiveState ? 'ON' : 'OFF'

  return (
    <WidgetCard
      title={widget.label}
      subtitle={`Switch · pub: ${cfg.publishTopic || '—'} · fb: ${cfg.feedbackTopic || '—'}`}
      footer={
        subError
          ? `Subscription error: ${subError}`
          : derived.source === 'unmatched-feedback'
            ? 'Feedback received but did not match ON/OFF payloads.'
            : derived.source === 'invalid-json'
              ? 'Feedback is not valid JSON.'
              : null
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-blue-950">{stateLabel}</div>
          <div className="text-xs text-blue-900/60">Uses feedback when available; otherwise last sent.</div>
        </div>
        <Toggle value={!!effectiveState} onChange={setSwitch} disabled={!canToggle} />
      </div>

      {!onParsed.ok || !offParsed.ok ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
          Config JSON error: {!onParsed.ok ? `ON payload: ${onParsed.error}` : ''}{' '}
          {!offParsed.ok ? `OFF payload: ${offParsed.error}` : ''}
        </div>
      ) : null}

      {publishError ? (
        <div className="mt-3 rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">{publishError}</div>
      ) : null}
    </WidgetCard>
  )
}
