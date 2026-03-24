import { parseJsonText } from './json.js'

export function buildPayloadFromTemplate(templateText, inputType, inputText) {
  if (!templateText || typeof templateText !== 'string') return { ok: false, error: 'Template is required.' }
  if (!templateText.includes('{{input}}')) return { ok: false, error: 'Template must include {{input}}.' }

  let replacement
  if (inputType === 'number') {
    const n = Number(inputText)
    if (!Number.isFinite(n)) return { ok: false, error: 'Input must be a number.' }
    replacement = String(n)
  } else {
    replacement = JSON.stringify(String(inputText))
  }

  const finalText = templateText.replaceAll('{{input}}', replacement)
  const parsed = parseJsonText(finalText)
  if (!parsed.ok) return { ok: false, error: `Resulting JSON is invalid: ${parsed.error}` }

  return { ok: true, payload: parsed.value, jsonText: finalText }
}
