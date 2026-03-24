import { useMemo } from 'react'
import { STORAGE_KEYS } from '../constants/storageKeys.js'
import { loadJson } from '../utils/storage.js'
import { useMqtt } from '../mqtt/MqttContext.jsx'
import { WIDGET_TYPES } from '../widgets/model.js'
import SwitchWidget from '../widgets/runtime/SwitchWidget.jsx'
import ButtonWidget from '../widgets/runtime/ButtonWidget.jsx'
import DisplayCardWidget from '../widgets/runtime/DisplayCardWidget.jsx'
import TextInputWidget from '../widgets/runtime/TextInputWidget.jsx'

export default function DashboardPage() {
  const { isConnected, status, errorMessage } = useMqtt()

  const widgets = useMemo(() => loadJson(STORAGE_KEYS.widgets, []), [])

  return (
    <div className="space-y-4">
      <div className="rounded border border-blue-900/30 bg-white p-4">
        <div className="mb-1 text-lg font-semibold text-blue-950">Dashboard</div>
        <div className="text-sm text-blue-900/70">Live widgets. Loads from localStorage and survives refresh.</div>
      </div>

      {!isConnected ? (
        <div className="rounded border border-yellow-200 bg-yellow-50 p-3 text-sm text-yellow-800">
          MQTT status is <span className="font-medium">{status}</span>. Widgets will render, but publish/subscribe needs an active connection.
          {errorMessage ? <div className="mt-1 text-xs">Last error: {errorMessage}</div> : null}
        </div>
      ) : null}

      {widgets.length === 0 ? (
        <div className="rounded border border-blue-900/30 bg-white p-4 text-sm text-blue-900/70">No widgets yet. Go to Builder to add some.</div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {widgets.map((w) => {
            if (w.type === WIDGET_TYPES.switch) return <SwitchWidget key={w.id} widget={w} />
            if (w.type === WIDGET_TYPES.button) return <ButtonWidget key={w.id} widget={w} />
            if (w.type === WIDGET_TYPES.display) return <DisplayCardWidget key={w.id} widget={w} />
            if (w.type === WIDGET_TYPES.textInput) return <TextInputWidget key={w.id} widget={w} />
            return null
          })}
        </div>
      )}
    </div>
  )
}
