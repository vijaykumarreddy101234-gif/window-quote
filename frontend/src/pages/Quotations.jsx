import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api, inr, token, downloadFile } from '../api'
import { Icon } from '../Icons'
import { askConfirm, askForm } from '../dialog'
const FILTERS = ['all', 'draft', 'sent', 'confirmed', 'dispatched', 'rejected']
const GLASS = ['10 mm clear glass','10 mm clear toughened glass','12 mm clear glass','20 mm DGU 5-10-5 clear glass','4 mm clear glass','4 mm pinhead glass','4.5 mm pinhead glass','5 mm clear glass','5 mm clear toughened glass','5 mm frosted glass','5 mm frosted toughened glass','5 mm grey tinted glass','5 mm grey tinted toughened glass','6 mm clear glass','6 mm frosted glass','6 mm grey tinted glass','6 mm MDF board','6 mm toughened glass','8 mm clear glass','8 mm clear toughened glass','8 mm grey tinted glass','UPVC panel board']

export default function Quotations() {
  const nav = useNavigate()
  const [rows, setRows] = useState([]); const [f, setF] = useState('all'); const [q, setQ] = useState('')
  const [show, setShow] = useState(false); const [tab, setTab] = useState('all')
  const [sp] = useSearchParams()
  const load = () => api('/quotations' + (q ? `?q=${encodeURIComponent(q)}` : '')).then(setRows)
  useEffect(() => { load() }, [q])
  useEffect(() => { if (sp.get('status') === 'draft') setF('draft') }, [])
  const count = s => s === 'all' ? rows.length : rows.filter(r => r.status === s).length
  const view = f === 'all' ? rows : rows.filter(r => r.status === f)
  const sum = s => rows.filter(r => r.status === s).reduce((a, r) => a + r.total, 0)
  async function setStatus(id, status) { await api(`/quotations/${id}/status`, { method: 'POST', body: { status } }); load() }
  async function del(id) { if (await askConfirm('Delete this quotation?', 'Delete')) { await api(`/quotations/${id}`, { method: 'DELETE' }); load() } }
  async function version(id) { await api(`/quotations/${id}/version`, { method: 'POST' }); load() }
  const next = r => r.status === 'draft' ? 'Send to customer' : r.status === 'sent' ? 'Confirm' : r.workOrder ? r.workOrder.number : ''
  const Glyph = ({ g }) => { const w = 30, h = 24, n = Math.max(1, Math.min(4, g.n)); return <svg width={w} height={h} viewBox="0 0 30 24" fill="none" stroke="#64748b" strokeWidth="1.3"><rect x="3" y="4" width="24" height="16" rx="1.5" />{g.k === 'sliding' ? Array.from({ length: n - 1 }, (_, i) => <path key={i} d={`M${3 + 24 * (i + 1) / n} 4V20`} />) : g.door ? <path d="M15 4v16" /> : Array.from({ length: n - 1 }, (_, i) => <path key={i} d={`M${3 + 24 * (i + 1) / n} 4V20`} />)}</svg> }
  const nextCell = r => r.status === 'draft' ? <a className="qt-next qt-next-go" onClick={ev => { ev.stopPropagation(); setStatus(r.id, 'sent') }}>Send to customer</a> : r.status === 'sent' ? <a className="qt-next qt-next-go" onClick={ev => { ev.stopPropagation(); setStatus(r.id, 'confirmed') }}>Confirm</a> : r.workOrder ? <Link className="qt-next qt-next-done" to={`/production/${r.workOrder.id}`} onClick={ev => ev.stopPropagation()}>{r.workOrder.number}</Link> : null
  const SP = { draft: ['#f1f5f9', '#64748b'], sent: ['#eff6ff', '#1d4ed8'], confirmed: ['#f0fdf4', '#059669'], dispatched: ['#faf5ff', '#7c3aed'], rejected: ['#fef2f2', '#dc2626'] }
  return (<div className="module-workspace">
    <aside className="module-sidebar" aria-label="Quotations navigation"><div className="module-sidebar-heading">QUOTATIONS</div><nav>{[['all', 'All quotations', 'file'], ['customers', 'Customers', 'users'], ['reports', 'Reports', 'chart']].map(([k, l, ic]) => <button key={k} type="button" title={l} aria-label={l} className={'module-sidebar-link' + (tab === k ? ' active' : '')} onClick={() => setTab(k)}><Icon n={ic} size={18} /><span className="module-sidebar-label">{l}</span></button>)}</nav></aside>
    <div className="module-content">
    {tab === 'all' && <div className="qt-list-head"><div><div className="qt-title-row"><h1 className="qt-page-title">Quotations</h1></div><p className="qt-page-subtitle">{rows.length} quotes · Design, price and send</p></div>
      <div className="qt-money" aria-label="Value by status"><div><strong>{inr(sum('draft'))}</strong><span>Draft · not sent yet</span></div><div className="accent"><strong>{inr(sum('sent'))}</strong><span>Sent · waiting for customer</span></div><div className="success"><strong>{inr(sum('confirmed'))}</strong><span>Confirmed</span></div></div>
      <button className="qt-btn-primary qt-new-quote" onClick={() => setShow(true)}><Icon n="plus" size={16} sw={2.2} />New Quote</button></div>}
    {tab === 'customers' && <Customers />}{tab === 'reports' && <Reports />}
    {tab === 'all' && <>
    <div className="qt-list-toolbar"><div className="qt-nav-pills" role="group">{FILTERS.map(s => <button key={s} type="button" className={'qt-nav-pill' + (f === s ? ' active' : '')} onClick={() => setF(s)}>{s[0].toUpperCase() + s.slice(1)}<span className="qt-pill-count">{count(s)}</span></button>)}</div>
      <div className="module-actions"><input id="qt-search" className="qt-search" type="search" placeholder="Search quotations…" value={q} onChange={e => setQ(e.target.value)} /></div></div>
    <div className="qcards">{[['NEEDS YOU', view.filter(r => r.status === 'draft' || r.status === 'sent')], ['EARLIER', view.filter(r => r.status !== 'draft' && r.status !== 'sent')]].filter(g => g[1].length).map(([t, rows]) => <div key={t}><div className="sec">{t}</div>
      {rows.map(r => <div key={r.id} className="card qcard" onClick={() => nav(`/quotations/${r.id}`)}>
        <div className="qthumb">{(r.glyphs || [])[0] ? <Glyph g={r.glyphs[0]} /> : '▭'}</div>
        <div style={{ flex: 1, minWidth: 0 }}><b style={{ fontSize: 17 }}>{r.project}</b><div><span className="link">{r.number}</span> <span className="muted">· {r.customer && r.customer.name}</span></div>
          <div onClick={ev => ev.stopPropagation()}>{r.status === 'draft' ? <a className="link" onClick={() => setStatus(r.id, 'sent')}>Send to customer</a> : r.status === 'sent' ? <a className="link" onClick={() => setStatus(r.id, 'confirmed')}>Confirm</a> : r.workOrder ? <Link className="link" to={`/production/${r.workOrder.id}`} style={{ color: 'var(--ok)', fontWeight: 700 }}>{r.workOrder.number}</Link> : ''}</div></div>
        <div style={{ textAlign: 'right' }}><b className="muted" style={{ fontSize: 17 }}>{inr(r.total)}</b><div><span className={'pill ' + r.status}>{r.status[0].toUpperCase() + r.status.slice(1)}</span></div></div></div>)}</div>)}</div>
    <div className="qt-table-wrap"><table className="qt-table qt-quote-table"><thead><tr><th>Project</th><th>Customer</th><th>Windows</th><th className="qt-value-cell">Amount</th><th>Status</th><th>Next step</th><th>Updated</th><th><span className="sr-only">Actions</span></th></tr></thead>
      <tbody>{view.map(r => { const sp = SP[r.status] || SP.draft; return (
        <tr key={r.id} className="qt-table-row" title="Click to open quotation" onClick={() => nav(`/quotations/${r.id}`)}>
          <td className="qt-project-cell"><div className="qt-project-name">{r.project}</div><div className="qt-quote-line"><Link className="qt-quote-num" to={`/quotations/${r.id}`} onClick={ev => ev.stopPropagation()}>{r.number}</Link></div></td>
          <td><div className="qt-customer-name">{r.customer && r.customer.name}</div></td>
          <td><span className="qt-glyphs">{(r.glyphs || []).map((g, i) => <Glyph key={i} g={g} />)}<span className="qt-window-count">{r.windows} windows</span></span></td>
          <td className="qt-value-cell qt-amt">{inr(r.total)}</td>
          <td><span className="qt-status-pill" style={{ background: sp[0], color: sp[1] }}>{r.status[0].toUpperCase() + r.status.slice(1)}</span></td>
          <td>{nextCell(r)}</td>
          <td className="qt-date-cell">{new Date(r.updated_at).toDateString() === new Date().toDateString() ? 'Today' : new Date(r.updated_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
          <td className="qt-actions-cell" onClick={ev => ev.stopPropagation()}><div className="qt-row-action-cell">
            {r.status === 'draft' && <button type="button" className="qt-icon-btn qt-icon-confirm" title="Confirm quotation and create the work order" onClick={() => setStatus(r.id, 'confirmed')}><Icon n="check" size={16} sw={2.2} /></button>}
            <a className="qt-icon-btn" title="Download PDF" href="#pdf" onClick={e => { e.preventDefault(); downloadFile(`/quotations/${r.id}/pdf`, r.number + '.pdf') }}><Icon n="pdf" size={16} /></a>
            <button type="button" className="qt-icon-btn" disabled={r.status === 'confirmed'} title={r.status === 'confirmed' ? 'A confirmed quotation takes no new versions' : 'Create version: a new draft copy the customer can change'} onClick={() => version(r.id)}><Icon n="copy" size={16} /></button>
            <button type="button" className="qt-icon-btn qt-del" disabled={r.status !== 'draft'} title="Delete" onClick={() => del(r.id)}><Icon n="trash" size={16} /></button></div></td>
        </tr>) })}</tbody></table></div></>}
    </div>
    {show && <NewQuote onClose={() => setShow(false)} />}
  </div>)
}

function NewQuote({ onClose }) {
  const nav = useNavigate()
  const [customers, setCustomers] = useState([]); const [form, setForm] = useState({ customer_id: '', project: '', site_address: '', default_glass: '', default_mesh: '' })
  const [adding, setAdding] = useState(false); const [nc, setNc] = useState({ name: '', phone: '' })
  const load = () => api('/customers').then(setCustomers)
  useEffect(() => { load() }, [])
  const set = k => e => setForm({ ...form, [k]: e.target.value })
  async function addCustomer() { const c = await api('/customers', { method: 'POST', body: { ...nc, contact: nc.name } }); await load(); setForm({ ...form, customer_id: c.id }); setAdding(false) }
  async function create() { const q = await api('/quotations', { method: 'POST', body: form }); nav(`/quotations/${q.id}`) }
  return (
    <div className="modal-bg" onClick={onClose}><div className="modal" onClick={e => e.stopPropagation()}>
      <div style={{ display: 'flex' }}><h3 style={{ margin: 0, flex: 1 }}>Create quotation</h3><a onClick={onClose} style={{ cursor: 'pointer' }}>×</a></div>
      <label>Customer</label>
      <select value={form.customer_id} onChange={set('customer_id')}><option value="">Select a saved customer</option>{customers.map(c => <option key={c.id} value={c.id}>{c.name} — {c.contact} — {c.phone}</option>)}</select>
      {adding ? <div style={{ marginTop: 8 }}><input placeholder="Customer name" value={nc.name} onChange={e => setNc({ ...nc, name: e.target.value })} /><input style={{ marginTop: 6 }} placeholder="Phone" value={nc.phone} onChange={e => setNc({ ...nc, phone: e.target.value })} /><button className="btn sm" style={{ marginTop: 6 }} onClick={addCustomer}>Save customer</button></div>
        : <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setAdding(true)}>Add customer</button>}
      <label>Project name</label><input value={form.project} onChange={set('project')} />
      <label>Site address</label><textarea rows="3" value={form.site_address} onChange={set('site_address')} />
      <label>Default named glass</label><select value={form.default_glass} onChange={set('default_glass')}><option value="">Legacy / choose per window</option>{GLASS.map(g => <option key={g}>{g}</option>)}</select>
      <label>Default mesh type</label><select value={form.default_mesh} onChange={set('default_mesh')}><option value="">Default mesh rate</option><option>Aluminium mesh</option><option>Fibre mesh</option><option>SS mesh</option></select>
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" disabled={!form.customer_id} onClick={create}>Create quotation</button></div>
    </div></div>)
}

function Customers() {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [open, setOpen] = useState(null)
  const load = () => api('/customers').then(setRows); useEffect(() => { load() }, [])
  const add = async () => { const f = await askForm('Add customer', [{ k: 'name', label: 'Customer name', required: true }, { k: 'contact', label: 'Contact person' }, { k: 'phone', label: 'Phone', type: 'tel' }, { k: 'email', label: 'Email', type: 'email' }, { k: 'address', label: 'Address' }]); if (!f) return; await api('/customers', { method: 'POST', body: { ...f, contact: f.contact || f.name } }); load() }
  const exp = () => { const e = x => '"' + String(x ?? '').replace(/"/g, '""') + '"'; const csv = ['Customer,Contact,Phone,Email', ...rows.map(c => [c.name, c.contact, c.phone, c.email].map(e).join(','))].join('\n'); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['\ufeff' + csv], { type: 'text/csv' })); a.download = 'customers.csv'; a.click() }
  const show = async c => setOpen(await api('/customers/' + c.id))
  const v = rows.filter(c => (c.name + c.contact + c.phone + c.email).toLowerCase().includes(q.toLowerCase()))
  return <div className="card"><div style={{ display: 'flex', alignItems: 'center' }}><div><h3 style={{ margin: 0 }}>Customers</h3><div className="muted" style={{ fontSize: 13 }}>{rows.length} customers · Select one to view quotations</div></div><div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}><button className="btn ghost" onClick={exp}>Export Excel</button><button className="btn" onClick={add}>+ Add customer</button></div></div>
    <input style={{ margin: '12px 0' }} placeholder="Search customer, contact, phone or email" value={q} onChange={e => setQ(e.target.value)} />
    {v.map(c => <div key={c.id} className="row" style={{ cursor: 'pointer' }} onClick={() => show(c)}><div style={{ flex: 1 }}><b>{c.name}</b><div className="muted" style={{ fontSize: 13 }}>{c.contact} · {c.phone}</div></div><span className="muted">—</span></div>)}
    {open && <div style={{ marginTop: 14 }}><b>{open.name} — quotations</b>{open.quotations.map(x => <div key={x.id} className="row"><Link className="link" to={`/quotations/${x.id}`}>{x.number}</Link><span>{x.project}</span><span style={{ marginLeft: 'auto' }}>{inr(x.total)}</span></div>)}</div>}</div>
}
function Reports() {
  const [r, setR] = useState(null); const [f, setF] = useState({ from: '', to: '', customer: '' }); const [cs, setCs] = useState([])
  const load = () => api('/reports/quotations?' + new URLSearchParams(Object.entries(f).filter(([, v]) => v))).then(setR)
  useEffect(() => { load() }, [f]); useEffect(() => { api('/customers').then(setCs) }, [])
  const ym = new Date().toISOString().slice(0, 7)
  if (!r) return null
  return <div className="card"><h3 style={{ marginTop: 0 }}>Quotation reports</h3><div className="muted" style={{ fontSize: 13 }}>{f.customer ? (cs.find(c => c.id === f.customer) || {}).name : 'All customers'} · Monthly quotation performance</div>
    <div style={{ display: 'flex', gap: 10, margin: '12px 0', flexWrap: 'wrap', alignItems: 'end' }}>
      <div><label>From</label><input type="date" value={f.from} onChange={e => setF({ ...f, from: e.target.value })} /></div><div><label>To</label><input type="date" value={f.to} onChange={e => setF({ ...f, to: e.target.value })} /></div>
      <button className="btn ghost" onClick={() => setF({ ...f, from: ym + '-01', to: '' })}>This month</button><button className="btn ghost" onClick={() => setF({ from: '', to: '', customer: '' })}>All time</button>
      <select style={{ width: 'auto' }} value={f.customer} onChange={e => setF({ ...f, customer: e.target.value })}><option value="">Choose customer</option>{cs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
    <div className="stats"><div className="stat"><b>{r.generated}</b><span>Quotes generated</span></div><div className="stat"><b>{r.approved}</b><span>Approved quotes</span></div><div className="stat"><b>{(+r.conversion).toFixed(2).replace(/\.00$/, '')}%</b><span>Conversion rate</span><em style={{ fontStyle: 'normal', fontSize: 11, opacity: .7 }}>Approved ÷ generated</em></div><div className="stat"><b>{r.production}</b><span>Sent to production</span></div></div>
    <b>Monthly quotations</b><div className="muted" style={{ fontSize: 12 }}>Grouped by quotation creation month. Conversion uses the current approved status of those quotations.</div>
    <table style={{ marginTop: 8 }}><thead><tr><th>Month</th><th>Generated</th><th>Approved</th><th>Conversion rate</th><th>Sent to production</th></tr></thead><tbody>{r.months.map(m => <tr key={m.month}><td>{m.month}</td><td>{m.generated}</td><td>{m.approved}</td><td>{m.generated ? (m.approved / m.generated * 100).toFixed(2).replace(/\.00$/, '') : 0}%</td><td>{m.production}</td></tr>)}</tbody></table></div>
}
