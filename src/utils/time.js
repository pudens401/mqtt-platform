export function formatTimestamp(value) {
  if (value == null) return null

  let date = null
  if (typeof value === 'number') {
    const ms = value > 1e12 ? value : value > 1e9 ? value * 1000 : value
    date = new Date(ms)
  } else if (typeof value === 'string') {
    const d = new Date(value)
    if (!Number.isNaN(d.getTime())) date = d
  }

  if (!date || Number.isNaN(date.getTime())) return null
  return date.toLocaleString()
}

export function formatRelativeTime(fromMs, nowMs) {
  const delta = Math.max(0, nowMs - fromMs)
  if (delta < 1000) return 'just now'
  const seconds = Math.floor(delta / 1000)
  if (seconds < 60) return `${seconds}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}
