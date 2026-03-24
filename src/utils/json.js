function sortDeep(value) {
  if (Array.isArray(value)) return value.map(sortDeep)
  if (value && typeof value === 'object') {
    const out = {}
    for (const key of Object.keys(value).sort()) {
      out[key] = sortDeep(value[key])
    }
    return out
  }
  return value
}

export function stableStringify(value) {
  return JSON.stringify(sortDeep(value))
}

export function parseJsonText(text) {
  try {
    const value = JSON.parse(text)
    return { ok: true, value }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid JSON' }
  }
}

export function formatJson(value) {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return ''
  }
}
