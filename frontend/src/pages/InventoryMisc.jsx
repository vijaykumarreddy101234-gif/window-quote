import { useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { api, inr2 } from '../api'
import { askForm, say } from '../dialog'
const NAV = [['/production', 'Work orders'], ['/inventory', 'Stock'], ['/inventory/purchase-orders', 'Purchase orders'], ['/inventory/suppliers', 'Suppliers'], ['/inventory/issue-receipt', 'Issue / Receipt'], ['/inventory/orders', 'Order requirements'], ['/quotations', 'Customers'], ['/quotations', 'Reports']]
export function InvNav() { return null }
export function PurchaseOrders() {
  const [rows, setRows] = useState([]); const [f, setF] = useState('all'); const [sup, setSup] = useState([]); const [min, setMin] = useState(false)
  const load = () => api('/purchase-orders').then(setRows); useEffect(() => { load(); api('/suppliers').then(setSup) }, [])
  const S = [['all', 'All'], ['draft', 'Draft'], ['issued', 'PO issued'], ['partial', 'Partial received'], ['received', 'Material received'], ['cancelled', 'Cancelled']]
  const add = async () => { if (!sup.length) return say('Add a supplier first.'); await api('/purchase-orders', { method: 'POST', body: { supplier_id: sup[0].id } }); load() }
  const view = f === 'all' ? rows : rows.filter(r => r.status === f)
  return <><InvNav /><div className="qt-list-header"><h1 className="qt-page-title">Purchase orders</h1><p className="qt-page-subtitle">Purchase orders and minimum stock</p></div>
    <div className="side"><button className={'tab' + (!min ? ' on' : '')} onClick={() => setMin(false)}>Purchase orders</button><button className={'tab' + (min ? ' on' : '')} onClick={() => setMin(true)}>Minimum stock</button></div>
    {min ? <div className="card"><b>Nothing is below minimum.</b><p className="muted">Minimum full bars per profile. Stock you have handled appears here. Set a minimum of 0 to stop tracking an item.</p><p className="muted">No stock recorded yet. Receive a purchase order or record measured intake first.</p></div> : <>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}><div className="filters">{S.map(([k, l]) => <button key={k} className={'filter' + (f === k ? ' on' : '')} onClick={() => setF(k)}>{l}</button>)}</div>
        <select style={{ width: 'auto', marginLeft: 'auto' }}><option>All suppliers</option>{sup.map(s => <option key={s.id}>{s.name}</option>)}</select><button className="btn" onClick={add}>+ New purchase order</button></div>
      {view.length ? <table><thead><tr><th>PO</th><th>Supplier</th><th>Status</th><th>Total</th></tr></thead><tbody>{view.map(r => <tr key={r.id}><td>{r.number}</td><td>{(sup.find(s => s.id === r.supplier_id) || {}).name}</td><td><span className="pill">{r.status}</span></td><td>{inr2(r.total)}</td></tr>)}</tbody></table>
        : <div className="card muted">No purchase orders. Create one here or from a work order.</div>}</>}</>
}
export function Suppliers() {
  const [rows, setRows] = useState([]); const load = () => api('/suppliers').then(setRows); useEffect(() => { load() }, [])
  const add = async () => { const f = await askForm('Add supplier', [{ k: 'name', label: 'Supplier name', required: true }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' }, { k: 'address', label: 'Address' }]); if (f) { await api('/suppliers', { method: 'POST', body: f }); load() } }
  return <><InvNav /><div className="qt-list-header" style={{ display: 'flex', alignItems: 'flex-start' }}><div style={{ flex: 1 }}><h1 className="qt-page-title">Suppliers</h1><p className="qt-page-subtitle">Supplier details and how many orders are open with each</p></div><button className="qt-btn-primary" style={{ width: 'auto' }} onClick={add}>Add supplier</button></div>
    {rows.length ? <table><thead><tr><th>Name</th><th>Phone</th><th>Email</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.name}</td><td>{r.phone}</td><td>{r.email}</td></tr>)}</tbody></table> : <div className="card muted">No suppliers yet. Add the vendors you order profiles, GI, glass and hardware from.</div>}</>
}
export function IssueReceipt() {
  const [t, setT] = useState('issues'); return <><InvNav /><div className="qt-list-header"><h1 className="qt-page-title">Issue / Receipt</h1><p className="qt-page-subtitle">What went to each work order and what came in from suppliers.</p></div>
    <div className="side"><button className={'tab' + (t === 'issues' ? ' on' : '')} onClick={() => setT('issues')}>Issues</button><button className={'tab' + (t === 'receipts' ? ' on' : '')} onClick={() => setT('receipts')}>Receipts</button></div>
    <div className="card muted">{t === 'issues' ? 'Nothing has been issued yet. Material is issued when a work order is confirmed and when its production completes.' : 'Nothing has been received yet.'}</div></>
}
export function OrderRequirements() {
  const [o, setO] = useState([]); const [sel, setSel] = useState(''); useEffect(() => { api('/inventory/orders').then(setO) }, [])
  return <><InvNav /><div className="qt-list-header"><h1 className="qt-page-title">Order requirements</h1><p className="qt-page-subtitle">Check confirmed customer orders, purchase shortages, receive materials and start production.</p></div>
    <label>Customer order</label><select value={sel} onChange={e => setSel(e.target.value)}><option value="">Select a confirmed order</option>{o.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select>
    {sel && <div className="card muted" style={{ marginTop: 14 }}>No material shortages for this order.</div>}</>
}
