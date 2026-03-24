import { useEffect, useMemo, useState } from 'react'
import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { loadJson, saveJson } from '../utils/storage.js'
import { createDefaultWidget, DISPLAY_TYPES, WIDGET_TYPES } from '../widgets/model.js'
import { getWidgetTypeLabel, WIDGET_TYPE_OPTIONS } from '../widgets/registry.js'
import { parseJsonText } from '../utils/json.js'
import { createId } from '../utils/ids.js'

function cloneJson(value) {
  return JSON.parse(JSON.stringify(value))
}

function Card({ title, children, actions }) {
  return (
    <div className="rounded border border-blue-900/30 bg-white p-4">
      {title ? (
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="text-sm font-semibold text-blue-950">{title}</div>
          {actions ? <div className="flex gap-2">{actions}</div> : null}
        </div>
      ) : null}
      {children}
    </div>
  )
}

function Field({ label, hint, children, error }) {
  return (
    <div className="space-y-1">
      <div className="text-sm font-medium text-blue-950">{label}</div>
      {children}
      {error ? <div className="text-xs text-red-600">{error}</div> : null}
      {hint ? <div className="text-xs text-blue-900/60">{hint}</div> : null}
    </div>
  )
}

function TextInput(props) {
  return (
    <input
      {...props}
      className={`w-full rounded border border-blue-900/30 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 ${props.className || ''}`}
    />
  )
}

function TextArea(props) {
  return (
    <textarea
      {...props}
      className={`w-full rounded border border-blue-900/30 bg-white px-3 py-2 font-mono text-xs leading-5 outline-none focus:border-orange-500 ${props.className || ''}`}
      rows={props.rows || 6}
    />
  )
}

function Select(props) {
  return (
    <select
      {...props}
      className={`w-full rounded border border-blue-900/30 bg-white px-3 py-2 text-sm outline-none focus:border-orange-500 ${props.className || ''}`}
    />
  )
}

function Button({ variant = 'primary', ...props }) {
  const base = 'inline-flex items-center justify-center rounded px-3 py-2 text-sm font-medium'
  const styles =
    variant === 'primary'
      ? 'bg-orange-600 text-white hover:bg-orange-500 disabled:bg-orange-200'
      : variant === 'danger'
        ? 'bg-red-600 text-white hover:bg-red-500 disabled:bg-red-200'
        : 'border border-blue-900/30 bg-white text-blue-950 hover:bg-orange-50 disabled:text-blue-900/40'
  return <button {...props} className={`${base} ${styles} ${props.className || ''}`} />
}

function validateWidget(widget) {
  if (!widget?.label?.trim()) return { ok: false, error: 'Label is required.' }

  const cfg = widget.config || {}

  if (widget.type === WIDGET_TYPES.switch) {
    if (!cfg.publishTopic?.trim()) return { ok: false, error: 'Publish topic is required.' }
    if (!cfg.feedbackTopic?.trim()) return { ok: false, error: 'Feedback topic is required.' }

    const onParsed = parseJsonText(cfg.onPayloadText || '')
    if (!onParsed.ok) return { ok: false, error: `ON payload: ${onParsed.error}` }

    const offParsed = parseJsonText(cfg.offPayloadText || '')
    if (!offParsed.ok) return { ok: false, error: `OFF payload: ${offParsed.error}` }

    return { ok: true }
  }

  if (widget.type === WIDGET_TYPES.button) {
    if (!cfg.publishTopic?.trim()) return { ok: false, error: 'Publish topic is required.' }
    const payloadParsed = parseJsonText(cfg.payloadText || '')
    if (!payloadParsed.ok) return { ok: false, error: `Payload: ${payloadParsed.error}` }
    return { ok: true }
  }

  if (widget.type === WIDGET_TYPES.display) {
    if (!cfg.subscribeTopic?.trim()) return { ok: false, error: 'Subscribe topic is required.' }
    if (!cfg.jsonPath?.trim()) return { ok: false, error: 'JSON path is required.' }

    const rules = cfg.formatRulesText?.trim() || '[]'
    const rulesParsed = parseJsonText(rules)
    if (!rulesParsed.ok) return { ok: false, error: `Formatting rules: ${rulesParsed.error}` }
    if (!Array.isArray(rulesParsed.value)) return { ok: false, error: 'Formatting rules must be a JSON array.' }

    return { ok: true }
  }

  if (widget.type === WIDGET_TYPES.textInput) {
    if (!cfg.publishTopic?.trim()) return { ok: false, error: 'Publish topic is required.' }
    if (!cfg.templateText?.trim()) return { ok: false, error: 'JSON template is required.' }
    if (!cfg.templateText.includes('{{input}}')) return { ok: false, error: 'Template must include {{input}}.' }

    // Validate template by substituting a safe sample and parsing the resulting JSON.
    const sample = cfg.inputType === 'number' ? '0' : JSON.stringify('sample')
    const finalText = cfg.templateText.replaceAll('{{input}}', sample)
    const parsed = parseJsonText(finalText)
    if (!parsed.ok) return { ok: false, error: `Template becomes invalid JSON after substitution: ${parsed.error}` }
    return { ok: true }
  }

  return { ok: true }
}

function WidgetEditor({ draft, setDraft }) {
  if (!draft) return null
  const cfg = draft.config || {}

  return (
    <div className="space-y-4">
      <Field label="Widget label">
        <TextInput value={draft.label || ''} onChange={(e) => setDraft({ ...draft, label: e.target.value })} />
      </Field>

      {draft.type === WIDGET_TYPES.switch ? (
        <>
          <Field label="Publish topic">
            <TextInput
              value={cfg.publishTopic || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, publishTopic: e.target.value } })}
            />
          </Field>
          <Field label="Feedback topic">
            <TextInput
              value={cfg.feedbackTopic || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, feedbackTopic: e.target.value } })}
            />
          </Field>
          <Field label="JSON payload (ON)" hint="Must be valid JSON.">
            <TextArea
              value={cfg.onPayloadText || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, onPayloadText: e.target.value } })}
            />
          </Field>
          <Field label="JSON payload (OFF)" hint="Must be valid JSON.">
            <TextArea
              value={cfg.offPayloadText || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, offPayloadText: e.target.value } })}
            />
          </Field>
        </>
      ) : null}

      {draft.type === WIDGET_TYPES.button ? (
        <>
          <Field label="Publish topic">
            <TextInput
              value={cfg.publishTopic || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, publishTopic: e.target.value } })}
            />
          </Field>
          <Field label="JSON payload" hint="Must be valid JSON.">
            <TextArea
              value={cfg.payloadText || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, payloadText: e.target.value } })}
            />
          </Field>
        </>
      ) : null}

      {draft.type === WIDGET_TYPES.display ? (
        <>
          <Field label="Subscribe topic">
            <TextInput
              value={cfg.subscribeTopic || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, subscribeTopic: e.target.value } })}
            />
          </Field>
          <Field label="JSON path" hint="Example: data.temp or status.power">
            <TextInput
              value={cfg.jsonPath || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, jsonPath: e.target.value } })}
            />
          </Field>
          <Field label="Display type">
            <Select
              value={cfg.displayType || 'raw'}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, displayType: e.target.value } })}
            >
              {DISPLAY_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </Select>
          </Field>
          <Field
            label="Conditional formatting rules (JSON array)"
            hint='Example: [{"op":">","value":30,"color":"red"}]  (colors: gray, green, yellow, red)'
          >
            <TextArea
              value={cfg.formatRulesText || '[]'}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, formatRulesText: e.target.value } })}
              rows={5}
            />
          </Field>
        </>
      ) : null}

      {draft.type === WIDGET_TYPES.textInput ? (
        <>
          <Field label="Publish topic">
            <TextInput
              value={cfg.publishTopic || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, publishTopic: e.target.value } })}
            />
          </Field>
          <Field label="Input type">
            <Select
              value={cfg.inputType || 'text'}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, inputType: e.target.value } })}
            >
              <option value="text">text</option>
              <option value="number">number</option>
            </Select>
          </Field>
          <Field label="JSON template" hint="Must include {{input}} and become valid JSON after substitution.">
            <TextArea
              value={cfg.templateText || ''}
              onChange={(e) => setDraft({ ...draft, config: { ...cfg, templateText: e.target.value } })}
              rows={7}
            />
          </Field>
        </>
      ) : null}
    </div>
  )
}

export default function BuilderPage() {
  const [widgets, setWidgets] = useState(() => loadJson(STORAGE_KEYS.widgets, []))
  const [selectedId, setSelectedId] = useState(() => (widgets[0]?.id ? widgets[0].id : null))
  const [draft, setDraft] = useState(() => {
    const w = widgets.find((x) => x.id === selectedId) || widgets[0]
    return w ? cloneJson(w) : null
  })

  const [editorError, setEditorError] = useState('')
  const [draggingId, setDraggingId] = useState(null)

  const exportText = useMemo(() => JSON.stringify(widgets, null, 2), [widgets])
  const [importText, setImportText] = useState('')
  const [importError, setImportError] = useState('')

  useEffect(() => {
    saveJson(STORAGE_KEYS.widgets, widgets)
  }, [widgets])

  useEffect(() => {
    if (widgets.length === 0) {
      setSelectedId(null)
      setDraft(null)
      return
    }

    if (selectedId && widgets.some((w) => w.id === selectedId)) {
      const w = widgets.find((x) => x.id === selectedId)
      setDraft(cloneJson(w))
      return
    }

    const first = widgets[0]
    setSelectedId(first.id)
    setDraft(cloneJson(first))
  }, [selectedId, widgets])

  function onAdd(type) {
    const w = createDefaultWidget(type)
    setWidgets((prev) => [w, ...prev])
    setSelectedId(w.id)
    setEditorError('')
  }

  function onDelete(id) {
    setWidgets((prev) => prev.filter((w) => w.id !== id))
    setEditorError('')
  }

  function onDuplicate(id) {
    const w = widgets.find((x) => x.id === id)
    if (!w) return
    const copy = { ...cloneJson(w), id: createId(), createdAt: Date.now(), label: `${w.label} (copy)` }
    setWidgets((prev) => [copy, ...prev])
    setSelectedId(copy.id)
    setEditorError('')
  }

  function onSave() {
    setEditorError('')
    if (!draft) return

    const result = validateWidget(draft)
    if (!result.ok) {
      setEditorError(result.error)
      return
    }

    setWidgets((prev) => prev.map((w) => (w.id === draft.id ? draft : w)))
  }

  function moveWidget(activeId, overId) {
    if (!activeId || !overId || activeId === overId) return

    setWidgets((prev) => {
      const from = prev.findIndex((w) => w.id === activeId)
      const to = prev.findIndex((w) => w.id === overId)
      if (from < 0 || to < 0) return prev

      const next = [...prev]
      const [item] = next.splice(from, 1)
      next.splice(to, 0, item)
      return next
    })
  }

  function onImport() {
    setImportError('')
    const parsed = parseJsonText(importText)
    if (!parsed.ok) {
      setImportError(parsed.error)
      return
    }
    if (!Array.isArray(parsed.value)) {
      setImportError('Import must be a JSON array of widgets.')
      return
    }

    const arr = parsed.value
    for (const w of arr) {
      if (!w || typeof w !== 'object') {
        setImportError('Every widget must be an object.')
        return
      }
      if (!w.id || !w.type || !w.label) {
        setImportError('Each widget must have id, type, and label.')
        return
      }
    }

    setWidgets(arr)
    setSelectedId(arr[0]?.id || null)
    setImportText('')
  }

  return (
    <div className="space-y-4">
      <div className="rounded border border-blue-900/30 bg-white p-4">
        <div className="mb-1 text-lg font-semibold text-blue-950">Builder</div>
        <div className="text-sm text-blue-900/70">Create widgets, configure MQTT topics/payloads, reorder, and save locally.</div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card
          title="Widgets"
          actions={
            <div className="flex flex-wrap gap-2">
              {WIDGET_TYPE_OPTIONS.map((o) => (
                <Button key={o.value} variant="secondary" onClick={() => onAdd(o.value)}>
                  Add {o.label}
                </Button>
              ))}
            </div>
          }
        >
          {widgets.length === 0 ? (
            <div className="text-sm text-blue-900/70">No widgets yet. Add one above.</div>
          ) : (
            <div className="space-y-2">
              {widgets.map((w) => {
                const isSelected = w.id === selectedId
                return (
                  <div
                    key={w.id}
                    className={`flex items-center justify-between gap-2 rounded border p-3 ${
                      isSelected ? 'border-orange-500 bg-orange-50' : 'border-blue-900/20 bg-white'
                    }`}
                    draggable
                    onDragStart={() => setDraggingId(w.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      moveWidget(draggingId, w.id)
                      setDraggingId(null)
                    }}
                  >
                    <button className="flex flex-1 items-start gap-2 text-left" onClick={() => setSelectedId(w.id)}>
                      <div className="select-none text-blue-900/40">⋮⋮</div>
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-blue-950">{w.label}</div>
                        <div className="text-xs text-blue-900/60">{getWidgetTypeLabel(w.type)}</div>
                      </div>
                    </button>
                    <div className="flex gap-2">
                      <Button variant="secondary" onClick={() => onDuplicate(w.id)}>
                        Duplicate
                      </Button>
                      <Button variant="danger" onClick={() => onDelete(w.id)}>
                        Delete
                      </Button>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          <div className="mt-3 text-xs text-blue-900/60">Drag-and-drop items to reorder. Configuration auto-saves to localStorage.</div>
        </Card>

        <Card
          title={draft ? `Edit: ${draft.label}` : 'Edit widget'}
          actions={
            <div className="flex gap-2">
              <Button onClick={onSave} disabled={!draft}>
                Save
              </Button>
            </div>
          }
        >
          {!draft ? (
            <div className="text-sm text-blue-900/70">Select a widget to edit.</div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-blue-900/60">Type: {getWidgetTypeLabel(draft.type)}</div>
              <WidgetEditor draft={draft} setDraft={setDraft} />
              {editorError ? (
                <div className="rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">{editorError}</div>
              ) : null}
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card title="Export dashboard JSON">
          <TextArea value={exportText} readOnly rows={10} />
        </Card>
        <Card title="Import dashboard JSON" actions={<Button variant="primary" onClick={onImport}>Import</Button>}>
          <Field label="Paste JSON array of widgets" error={importError}>
            <TextArea value={importText} onChange={(e) => setImportText(e.target.value)} rows={10} />
          </Field>
        </Card>
      </div>

      <Card title="Preview">
        {widgets.length === 0 ? (
          <div className="text-sm text-blue-900/70">Nothing to preview yet.</div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2">
            {widgets.map((w) => (
              <div key={w.id} className="rounded border border-blue-900/20 bg-white p-3">
                <div className="text-sm font-medium text-blue-950">{w.label}</div>
                <div className="text-xs text-blue-900/60">{getWidgetTypeLabel(w.type)}</div>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
