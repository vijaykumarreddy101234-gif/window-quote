import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api, inr } from '../api'
import { Icon } from '../Icons'

const PILL = { draft: ['#f1f5f9', '#64748b', 'Draft'], sent: ['#eff6ff', '#1d4ed8', 'Sent'], confirmed: ['#f0fdf4', '#059669', 'Confirmed'], approved: ['#f0fdf4', '#059669', 'Confirmed'] }
const Stat = ({ v, l, tone = 'neutral' }) => <div className={'dash-stat tone-' + tone}><strong>{v}</strong><span>{l}</span></div>
const Count = ({ l, v, tone = 'neutral' }) => <span className={'dash-count tone-' + tone}><span className="dash-count-label">{l}</span> <b>{v}</b></span>
export default function Dashboard() {
  const [d, setD] = useState(null)
  useEffect(() => { api('/dashboard').then(setD) }, [])
  if (!d) return <div className="dash-page"><div className="dash-head"><h1 className="qt-page-title">Dashboard</h1><p className="qt-page-subtitle">What needs your attention today</p></div><p className="muted">Loading…</p></div>
  const n = d.needsYou, q = d.quotations, p = d.production, i = d.inventory
  const needs = [['clock', 'amber', n.followUp, 'quotations to follow up', '/quotations'], ['send', 'blue', n.draftToSend, 'draft quotations to send', '/quotations'], ['production', 'green', n.readyForWorkOrder, 'ready for a work order', '/quotations?status=approved'], ['box', 'red', n.belowMinStock, 'items below minimum stock', '/inventory/purchase-orders']]
  return (
    <div className="dash-page">
      <div className="dash-head"><div><h1 className="qt-page-title">Dashboard</h1><p className="qt-page-subtitle">What needs your attention today</p></div></div>
      <section className="dash-needs" aria-label="Needs you"><h2 className="dash-needs-title">Needs you</h2>
        <div className="dash-needs-row">{needs.map(([ic, tone, c, t, to]) => <Link key={t} to={to} className="dash-need"><span className={'dash-need-icon tone-' + tone}><Icon n={ic} size={20} /></span><span className="dash-need-text"><strong>{c}</strong><span>{t}</span></span><span className="dash-need-go">›</span></Link>)}</div></section>
      <div className="dash-grid">
        <section className="dash-section"><header><h2>Quotations</h2><Link to="/quotations" className="dash-open">Open Quotations</Link></header>
          <div className="dash-stats"><Stat v={inr(q.openValue)} l="Open value (draft + sent)" /><Stat v={inr(q.confirmedValue || 0)} l="Confirmed value" tone="green" /></div>
          <div className="dash-counts"><Count l="Draft" v={q.draft} /><Count l="Sent" v={q.sent} /><Count l="Confirmed" v={q.confirmed} tone="green" /><Count l="Created this month" v={q.createdThisMonth || 0} /></div>
          <ul className="dash-list">{(q.recent || []).map(r => { const pl = PILL[r.status] || PILL.draft; return <li key={r.id}><Link to={'/quotations/' + r.id}><strong className="dash-num">{r.number}</strong><span>{r.customer}</span><em className="dash-pill" style={{ background: pl[0], color: pl[1] }}>{pl[2]}</em><small>{inr(r.total)}</small></Link></li> })}</ul></section>
        <section className="dash-section"><header><h2>Production</h2><Link to="/production" className="dash-open">Open Production</Link></header>
          <div className="dash-stats"><Stat v={p.windowsOnOrder} l="Windows on order" /><Stat v={p.inProduction || 0} l="In production" tone="amber" /><Stat v={p.waiting || 0} l="Waiting to start" /></div>
          <div className="dash-counts"><Count l="Ready to create" v={p.readyToCreate} /><Count l="Production complete" v={p.complete} /><Count l="Suspended" v={p.suspended} /></div>
          <ul className="dash-list">{(p.recent || []).map(r => <li key={r.id}><Link to={'/production/' + r.id}><strong className="dash-num">{r.number}</strong><span>{r.customer}</span><span className="qt-status-pill" style={{ background: '#eff6ff', color: '#1d4ed8' }}>Open</span></Link></li>)}</ul></section>
        <section className="dash-section"><header><h2>Inventory</h2><Link to="/inventory" className="dash-open">Open Inventory</Link></header>
          <div className="dash-stats"><Stat v={i.itemsInStock} l="Items in stock" /><Stat v={i.barsAvailable || 0} l="Bars available" /><Stat v={i.belowMin || 0} l="Below minimum" /></div>
          <div className="dash-counts"><Count l="Open purchase orders" v={i.openPOs} /><Count l="Overdue purchase orders" v={i.overduePOs} /></div></section>
      </div>
    </div>)
}
