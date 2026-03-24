import { useEffect, useMemo, useState } from 'react'
import WidgetCard from './WidgetCard.jsx'
import { useTopic } from '../../mqtt/useTopic.js'
import { getByPath } from '../../utils/path.js'
import { parseJsonText } from '../../utils/json.js'
import { formatRelativeTime, formatTimestamp } from '../../utils/time.js'

const COLOR_STYLES = {
  gray: 'bg-orange-50 text-blue-950 border-blue-900/20',
  green: 'bg-green-50 text-green-700 border-green-200',
  yellow: 'bg-yellow-50 text-yellow-700 border-yellow-200',
  red: 'bg-red-50 text-red-700 border-red-200',
}

const BAR_COLORS = {
  gray: 'bg-slate-400',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
}

function applyRules(value, rules) {
  if (!Array.isArray(rules)) return null

  for (const r of rules) {
    if (!r || typeof r !== 'object') continue
    const op = r.op
    const ruleValue = r.value
    const color = r.color
    if (!op || !color || !(color in COLOR_STYLES)) continue

    if (op === '==') {
      // eslint-disable-next-line eqeqeq
      if (value == ruleValue) return color
    } else if (op === '>' || op === '<') {
      const a = Number(value)
      const b = Number(ruleValue)
      if (!Number.isFinite(a) || !Number.isFinite(b)) continue
      if (op === '>' && a > b) return color
      if (op === '<' && a < b) return color
    }
  }

  return null
}

function toDisplayString(value) {
  if (value == null) return '—'
  if (typeof value === 'string') return value
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return value ? 'true' : 'false'
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

function Badge({ color = 'gray', children }) {
  return <span className={`inline-flex items-center rounded border px-2 py-0.5 text-xs ${COLOR_STYLES[color]}`}>{children}</span>
}

export default function DisplayCardWidget({ widget }) {
  const cfg = widget.config || {}
  const { message, error: subError } = useTopic(cfg.subscribeTopic)

  const rulesParsed = useMemo(() => parseJsonText(cfg.formatRulesText || '[]'), [cfg.formatRulesText])
  const rules = rulesParsed.ok && Array.isArray(rulesParsed.value) ? rulesParsed.value : []

  const [now, setNow] = useState(Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])

  const payloadObj = message?.payloadObj
  const payloadError = message?.payloadError

  const extracted = useMemo(() => {
    if (!payloadObj) return { ok: false, error: 'No data yet' }
    const res = getByPath(payloadObj, cfg.jsonPath)
    if (!res.ok) return { ok: false, error: res.error || 'Path not found' }
    return { ok: true, value: res.value }
  }, [payloadObj, cfg.jsonPath])

  const color = extracted.ok ? applyRules(extracted.value, rules) : null

  const displayType = cfg.displayType || 'raw'

  let body = null
  if (payloadError) {
    body = <div className="text-xs text-red-700">Message is not valid JSON: {payloadError}</div>
  } else if (!extracted.ok) {
    body = <div className="text-sm text-blue-900/70">—</div>
  } else {
    const v = extracted.value

    if (displayType === 'number') {
      body = <div className="text-2xl font-semibold text-blue-950">{Number.isFinite(Number(v)) ? Number(v) : '—'}</div>
    } else if (displayType === 'boolean') {
      body = <div className="text-2xl font-semibold text-blue-950">{v ? 'true' : 'false'}</div>
    } else if (displayType === 'status') {
      body = <Badge color={color || 'gray'}>{toDisplayString(v)}</Badge>
    } else if (displayType === 'onoff') {
      const on = !!v
      body = <Badge color={on ? 'green' : 'gray'}>{on ? 'ON' : 'OFF'}</Badge>
    } else if (displayType === 'dot') {
      const c = color || (v ? 'green' : 'gray')
      body = (
        <div className="flex items-center gap-2">
          <span className={`h-3 w-3 rounded-full border ${COLOR_STYLES[c]}`} />
          <div className="text-sm text-blue-950">{toDisplayString(v)}</div>
        </div>
      )
    } else if (displayType === 'progress') {
      const n = Number(v)
      const pct = Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : 0
      const barClass = color ? BAR_COLORS[color] : 'bg-orange-600'
      body = (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-xs text-blue-900/70">
            <span>{pct}%</span>
            <span>{toDisplayString(v)}</span>
          </div>
          <div className="h-2 w-full rounded bg-slate-100">
            <div className={`h-2 rounded ${barClass}`} style={{ width: `${pct}%` }} />
          </div>
        </div>
      )
    } else if (displayType === 'timestamp') {
      const ts = formatTimestamp(v)
      body = <div className="text-sm text-blue-950">{ts || '—'}</div>
    } else if (displayType === 'lastUpdated') {
      const t = message?.receivedAt
      body = <div className="text-sm text-blue-950">{t ? formatRelativeTime(t, now) : '—'}</div>
    } else if (displayType === 'chart') {
      body = (
        <div className="rounded border border-blue-900/20 bg-orange-50 p-3">
          <div className="text-xs font-medium text-blue-950">Chart</div>
          <div className="mt-2 text-sm text-blue-950">Latest: {toDisplayString(v)}</div>
          <div className="mt-2 h-12 rounded bg-white" />
        </div>
      )
    } else {
      body = <div className="text-sm text-blue-950">{toDisplayString(v)}</div>
    }
  }

  const footer = (() => {
    if (subError) return `Subscription error: ${subError}`
    if (message?.receivedAt) return `Last message: ${new Date(message.receivedAt).toLocaleTimeString()}`
    return null
  })()

  return (
    <WidgetCard title={widget.label} subtitle={`Display · sub: ${cfg.subscribeTopic || '—'} · path: ${cfg.jsonPath || '—'}`} footer={footer}>
      <div className="space-y-2">
        {!cfg.subscribeTopic?.trim() || !cfg.jsonPath?.trim() ? (
          <div className="rounded border border-red-200 bg-red-50 p-2 text-xs text-red-700">
            Config error: subscribe topic and JSON path are required.
          </div>
        ) : null}
        {body}
        {!payloadError && !extracted.ok && payloadObj ? (
          <div className="text-xs text-blue-900/60">{extracted.error || 'Path not found'}</div>
        ) : null}
        {!rulesParsed.ok ? (
          <div className="text-xs text-red-700">Formatting rules JSON error: {rulesParsed.error}</div>
        ) : null}
      </div>
    </WidgetCard>
  )
}
