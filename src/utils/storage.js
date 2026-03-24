export function loadJson(key, fallbackValue) {
  try {
    const raw = localStorage.getItem(key)
    if (raw == null) return fallbackValue
    return JSON.parse(raw)
  } catch {
    return fallbackValue
  }
}

export function saveJson(key, value) {
  localStorage.setItem(key, JSON.stringify(value))
}
