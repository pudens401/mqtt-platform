import { createId } from '../utils/ids.js'

export const WIDGET_TYPES = {
  switch: 'switch',
  button: 'button',
  display: 'display',
  textInput: 'textInput',
}

export const DISPLAY_TYPES = [
  { value: 'raw', label: 'Raw text' },
  { value: 'number', label: 'Number' },
  { value: 'boolean', label: 'Boolean' },
  { value: 'status', label: 'Status badge' },
  { value: 'onoff', label: 'On/Off indicator' },
  { value: 'dot', label: 'Colored dot' },
  { value: 'progress', label: 'Progress bar' },
  { value: 'timestamp', label: 'Timestamp' },
  { value: 'lastUpdated', label: 'Last updated time' },
  { value: 'chart', label: 'Chart placeholder' },
]

export function createDefaultWidget(type) {
  const id = createId()
  const base = {
    id,
    type,
    label: '',
    createdAt: Date.now(),
    config: {},
  }

  if (type === WIDGET_TYPES.switch) {
    return {
      ...base,
      label: 'Switch',
      config: {
        publishTopic: '',
        feedbackTopic: '',
        onPayloadText: '{\n  "state": "on"\n}',
        offPayloadText: '{\n  "state": "off"\n}',
      },
    }
  }

  if (type === WIDGET_TYPES.button) {
    return {
      ...base,
      label: 'Button',
      config: {
        publishTopic: '',
        payloadText: '{\n  "command": "do"\n}',
      },
    }
  }

  if (type === WIDGET_TYPES.display) {
    return {
      ...base,
      label: 'Display',
      config: {
        subscribeTopic: '',
        jsonPath: 'data.value',
        displayType: 'raw',
        formatRulesText: '[]',
      },
    }
  }

  if (type === WIDGET_TYPES.textInput) {
    return {
      ...base,
      label: 'Text Input',
      config: {
        publishTopic: '',
        inputType: 'text',
        templateText: '{\n  "command": "set_value",\n  "value": "{{input}}"\n}',
      },
    }
  }

  return base
}
