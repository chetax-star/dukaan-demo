
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminApp from './AdminApp.jsx'

document.title = window.location.pathname.startsWith('/admin')
  ? 'Dukaan Demo | Admin Panel'
  : 'Sharma Ji Ka Dhaba | Restaurant'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {window.location.pathname.startsWith('/admin') ? <AdminApp /> : <App />}
  </StrictMode>,
)

