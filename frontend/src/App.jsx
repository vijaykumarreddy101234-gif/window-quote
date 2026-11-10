import { useEffect, useState } from 'react'
import { Routes, Route, Navigate, NavLink, useNavigate, useLocation } from 'react-router-dom'
import { api, token } from './api'
import { Icon } from './Icons'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import Quotations from './pages/Quotations'
import QuotationDetail from './pages/QuotationDetail'
import Production from './pages/Production'
import { WorkOrderDetail, SubDetail } from './pages/WorkOrder'
import { ProdLayout } from './pages/ProdLayout'
import Invoices, { NewInvoice } from './pages/Invoices'
import Inventory from './pages/Inventory'
import Settings from './pages/Settings'
import Designer from './pages/Designer'
import NewWindow from './pages/NewWindow'
import { DialogHost } from './dialog'
import Account from './pages/Account'
import GettingStarted from './pages/GettingStarted'
import { PurchaseOrders, Suppliers, IssueReceipt, OrderRequirements } from './pages/InventoryMisc'

function AvatarMenu({ me, initials }) {
  const [o, setO] = useState(false); const nav = useNavigate()
  useEffect(() => { if (!o) return; const f = e => { if (!e.target.closest('.hright, .mbar')) setO(false) }; document.addEventListener('click', f); return () => document.removeEventListener('click', f) }, [o])
  const go = to => { setO(false); nav(to) }
  return <span style={{ position: 'relative', display: 'inline-flex' }}><button className="avatar" title={me ? me.name : ''} aria-haspopup="menu" aria-expanded={o} onClick={() => setO(!o)}>{initials}</button>
    {o && <div className="user-menu" role="menu"><div className="um-card"><span className="acc-av">{initials}</span><div><b>{me ? me.name : ''}</b><span className="m">{me ? me.email : ''}</span><br /><em>{me ? (me.role || 'owner').toUpperCase() : ''}</em></div></div>
      <button className="um-i" role="menuitem" onClick={() => go('/getting-started')}>▤ Getting started</button><button className="um-i" role="menuitem" onClick={() => go('/account')}>◇ My account</button><button className="um-i" role="menuitem" onClick={() => go('/account?section=password')}>🔒 Change password</button><hr />
      <button className="um-i um-out" role="menuitem" onClick={() => { localStorage.removeItem('fw_token'); nav('/login') }}>⇥ Sign Out</button></div>}</span>
}
function Layout({ children }) {
  const [me, setMe] = useState(null)
  const nav = useNavigate()
  useEffect(() => { api('/auth/me').then(setMe).catch(() => {}) }, [])
  const loc = useLocation(); const [menu, setMenu] = useState(false); const [chat, setChat] = useState(false)
  const NAV = [['/dashboard', 'Dashboard'], ['/quotations', 'Quotations'], ['/production', 'Production'], ['/invoices', 'Invoices'], ['/inventory', 'Inventory'], ['/settings', 'Settings']]
  const cur = (NAV.find(n => loc.pathname.startsWith(n[0])) || NAV[1])[1]
  const designer = /\/design\//.test(loc.pathname)
  const [hideSetup, setHideSetup] = useState(() => !!localStorage.getItem('fw_hide_setup'))
  const initials = me ? me.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase() : ''
  return (
    <div className="shell">
      <header className="mbar">
        <button className="icon-btn" onClick={() => nav('/dashboard')} aria-label="Home">⌂</button>
        <button className="mtitle" onClick={() => setMenu(!menu)}><img className="logo" src="/brand/raviraja-mark.png" alt="" />{cur} ▾</button>
        <div className="spacer" /><button className="icon-btn round" title="Language" onClick={() => nav('/account')}>🌐</button>
        <AvatarMenu me={me} initials={initials} />
        {menu && <div className="mmenu" onClick={() => setMenu(false)}>{NAV.map(n => <NavLink key={n[0]} to={n[0]}>{n[1]}</NavLink>)}</div>}
      </header>
      <header className="topbar app-header">
        <NavLink to="/dashboard" className="brand-link"><img className="app-brand-logo" src="/brand/raviraja-logo.png" alt="Raviraja Industries" /></NavLink>
        <nav className="topnav">
          {[['/dashboard', 'Dashboard', 'dashboard'], ['/quotations', 'Quotations', 'quotations'], ['/production', 'Production', 'production'], ['/invoices', 'Invoices', 'invoices'], ['/settings', 'Settings', 'settings']].map(([to, l, ic]) => <NavLink key={to} to={to} className="app-nav-link"><Icon n={ic} />{l}</NavLink>)}
        </nav>
        <div className="hright">
          <NavLink to="/getting-started" className="gs-pill"><span className="gs-ring" />Setup 7 of 10</NavLink>
          <button className="icon-btn round" title="Language" onClick={() => nav('/account')}><Icon n="globe" size={17} /></button>
          <AvatarMenu me={me} initials={initials} />
        </div>
      </header>
      {!hideSetup && loc.pathname !== '/dashboard' && <div className="setup-banner"><NavLink to="/getting-started"><span className="gs-ring" /><b>Setup 7 of 10</b> · Next: Set up your company profile</NavLink><button onClick={() => { localStorage.setItem('fw_hide_setup', '1'); setHideSetup(true) }}>Hide</button></div>}
      <main className="page">
        {children}
      </main>
      <button className="fab" aria-label="Help chat" onClick={() => setChat(!chat)}>💬</button>
      {chat && <div className="chatbox"><b>FenstraWorks help</b><p className="muted" style={{ fontSize: 13 }}>Ask about quotations, designs, pricing or production. Our team replies by email within one working day.</p><textarea placeholder="Type your question…" rows="3" /><button className="btn sm" onClick={() => setChat(false)}>Send</button></div>}
    </div>
  )
}
const Guard = ({ children }) => token() ? <Layout>{children}</Layout> : <Navigate to="/login" replace />

export default function App() {
  return (<>
    <ScrollTop /><DialogHost />
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Guard><Dashboard /></Guard>} />
      <Route path="/quotations" element={<Guard><Quotations /></Guard>} />
      <Route path="/quotations/:id" element={<Guard><QuotationDetail /></Guard>} />
      <Route path="/quotations/:id/new-window" element={<Guard><NewWindow /></Guard>} />
      <Route path="/quotations/:id/design/:itemId" element={<Guard><Designer /></Guard>} />
      <Route path="/production" element={<Guard><Production /></Guard>} />
      <Route path="/production/sub/:sid" element={<Guard><SubDetail /></Guard>} />
      <Route path="/production/:id" element={<Guard><WorkOrderDetail /></Guard>} />
      <Route path="/invoices/new" element={<Guard><NewInvoice /></Guard>} />
      <Route path="/invoices" element={<Guard><Invoices /></Guard>} />
      <Route path="/inventory" element={<Guard><ProdLayout><Inventory /></ProdLayout></Guard>} />
      <Route path="/inventory/purchase-orders" element={<Guard><ProdLayout><PurchaseOrders /></ProdLayout></Guard>} />
      <Route path="/inventory/suppliers" element={<Guard><ProdLayout><Suppliers /></ProdLayout></Guard>} />
      <Route path="/inventory/issue-receipt" element={<Guard><ProdLayout><IssueReceipt /></ProdLayout></Guard>} />
      <Route path="/inventory/orders" element={<Guard><ProdLayout><OrderRequirements /></ProdLayout></Guard>} />
      <Route path="/account" element={<Guard><Account /></Guard>} />
      <Route path="/getting-started" element={<Guard><GettingStarted /></Guard>} />
      <Route path="/settings/:tab" element={<Guard><Settings /></Guard>} />
      <Route path="/settings" element={<Guard><Settings /></Guard>} />
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  </>  )
}

function ScrollTop() { const { pathname } = useLocation(); useEffect(() => { window.scrollTo(0, 0); document.documentElement.scrollTop = 0; document.body.scrollTop = 0 }, [pathname]); return null }
