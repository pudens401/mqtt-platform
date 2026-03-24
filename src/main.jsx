import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { MqttProvider } from './mqtt/MqttContext.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <MqttProvider>
        <App />
      </MqttProvider>
    </BrowserRouter>
  </StrictMode>,
)
