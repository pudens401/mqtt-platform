export function getByPath(obj, path) {
  if (path == null || String(path).trim() === '') return { ok: true, value: obj }
  if (obj == null || typeof obj !== 'object') return { ok: false, error: 'Not an object' }

  const parts = String(path)
    .split('.')
    .map((p) => p.trim())
    .filter(Boolean)

  let cur = obj
  for (const part of parts) {
    if (cur == null || (typeof cur !== 'object' && !Array.isArray(cur))) {
      return { ok: false, error: 'Path not found' }
    }
    if (!(part in cur)) return { ok: false, error: 'Path not found' }
    cur = cur[part]
  }
  return { ok: true, value: cur }
}
