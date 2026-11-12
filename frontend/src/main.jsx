import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
createRoot(document.getElementById('root')).render(<StrictMode><BrowserRouter><App /></BrowserRouter></StrictMode>)

// report browser errors to the server automatically (rate-limited) so bugs are detected without user reports
let _sent = 0
const report = message => { if (_sent++ > 20) return; try { fetch('/api/v1/app/client-error', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + (localStorage.getItem('fw_token') || '') }, body: JSON.stringify({ message: String(message), url: location.pathname }), keepalive: true }).catch(() => {}) } catch (e) {} }
window.addEventListener('error', e => report(e.message))
window.addEventListener('unhandledrejection', e => report('Unhandled: ' + (e.reason && e.reason.message || e.reason)))
