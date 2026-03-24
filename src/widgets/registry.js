import { WIDGET_TYPES } from './model.js'

export const WIDGET_TYPE_OPTIONS = [
  { value: WIDGET_TYPES.switch, label: 'Switch' },
  { value: WIDGET_TYPES.button, label: 'Button' },
  { value: WIDGET_TYPES.display, label: 'Display Card' },
  { value: WIDGET_TYPES.textInput, label: 'Text Input (Command)' },
]

export function getWidgetTypeLabel(type) {
  return WIDGET_TYPE_OPTIONS.find((o) => o.value === type)?.label || type
}
