import { useMemo, useState } from 'react'
import WidgetCard from './WidgetCard.jsx'
import { useMqtt } from '../../mqtt/MqttContext.jsx'
import { buildPayloadFromTemplate } from '../../utils/template.js'

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-blue-900/30 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 ${props.className || ''}`}
    />
  )
}

function Button(props) {
  return (
    <button
      {...props}
      className={`inline-flex items-center justify-center rounded bg-orange-600 px-3 py-2 text-sm font-medium text-white hover:bg-orange-500 disabled:bg-orange-200 ${
        props.className || ''
      }`}
    />
  )
}

export default function TextInputWidget({ widget }) {
  const { isConnected, publishJson } = useMqtt()
  const cfg = widget.config || {}

  const [value, setValue] = useState('')
  const [result, setResult] = useState(null)

  const templateIsOk = useMemo(() => cfg.templateText?.includes('{{input}}'), [cfg.templateText])

  async function onSend() {
    setResult(null)

    if (!isConnected) {
      setResult({ ok: false, message: 'Not connected.' })
      return
    }

    if (!cfg.publishTopic?.trim()) {
      setResult({ ok: false, message: 'Publish topic is missing in this widget config.' })
      return
    }

    const built = buildPayloadFromTemplate(cfg.templateText || '', cfg.inputType || 'text', value)
    if (!built.ok) {
      setResult({ ok: false, message: built.error })
      return
    }

    try {
      await publishJson(cfg.publishTopic.trim(), built.payload)
      setResult({ ok: true, message: 'Published.' })
    } catch (err) {
      setResult({ ok: false, message: err instanceof Error ? err.message : 'Publish failed' })
    }
  }

  return (
    <WidgetCard title={widget.label} subtitle={`Text input · pub: ${cfg.publishTopic || '—'}`}>
      <div className="space-y-3">
        <div className="grid gap-2">
          <TextInput
            type={cfg.inputType === 'number' ? 'number' : 'text'}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder={cfg.inputType === 'number' ? 'Enter a number' : 'Enter text'}
          />
          <Button onClick={onSend} disabled={!isConnected || !templateIsOk}>
            Send
          </Button>
        </div>

        {!templateIsOk ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            Config error: Template must include {'{{input}}'}.
          </div>
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
