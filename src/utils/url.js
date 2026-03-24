export function tryParseUrl(urlText) {
  try {
    return { ok: true, url: new URL(urlText) }
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Invalid URL' }
  }
}

export function withPort(urlText, portNumber) {
  const parsed = tryParseUrl(urlText)
  if (!parsed.ok) return parsed

  const u = parsed.url
  if (portNumber != null && String(portNumber).trim() !== '') {
    u.port = String(portNumber)
  }
  return { ok: true, urlText: u.toString(), url: u }
}

export function getPortFromUrl(urlText) {
  const parsed = tryParseUrl(urlText)
  if (!parsed.ok) return null
  const port = parsed.url.port
  if (!port) return null
  const n = Number(port)
  return Number.isFinite(n) ? n : null
}
