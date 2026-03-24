import { Navigate, NavLink, Route, Routes } from 'react-router-dom'
import ConnectionPage from './pages/ConnectionPage.jsx'
import BuilderPage from './pages/BuilderPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'
import { useMqtt } from './mqtt/MqttContext.jsx'

function StatusPill() {
  const { status } = useMqtt()
  const map = {
    connected: 'bg-green-50 text-green-700 border-green-200',
    connecting: 'bg-yellow-50 text-yellow-700 border-yellow-200',
    disconnected: 'bg-white text-blue-950 border-blue-900/30',
    error: 'bg-red-50 text-red-700 border-red-200',
  }
  const label = status === 'connecting' ? 'Connecting' : status[0].toUpperCase() + status.slice(1)
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${map[status] || map.disconnected}`}>
      {label}
    </span>
  )
}

function App() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-blue-900/30 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="text-sm font-semibold text-blue-950">MQTT Dash</div>
            <StatusPill />
          </div>
          <nav className="flex items-center gap-2 text-sm">
            <NavLink
              to="/connect"
              className={({ isActive }) =>
                `rounded px-2 py-1 ${isActive ? 'bg-orange-50 text-blue-950' : 'text-blue-900/70 hover:text-orange-700'}`
              }
            >
              Connection
            </NavLink>
            <NavLink
              to="/builder"
              className={({ isActive }) =>
                `rounded px-2 py-1 ${isActive ? 'bg-orange-50 text-blue-950' : 'text-blue-900/70 hover:text-orange-700'}`
              }
            >
              Builder
            </NavLink>
            <NavLink
              to="/dashboard"
              className={({ isActive }) =>
                `rounded px-2 py-1 ${isActive ? 'bg-orange-50 text-blue-950' : 'text-blue-900/70 hover:text-orange-700'}`
              }
            >
              Dashboard
            </NavLink>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Routes>
          <Route path="/" element={<Navigate to="/connect" replace />} />
          <Route path="/connect" element={<ConnectionPage />} />
          <Route path="/builder" element={<BuilderPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="*" element={<Navigate to="/connect" replace />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
