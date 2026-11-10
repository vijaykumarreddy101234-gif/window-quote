import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../api'
import { ProdLayout } from './ProdLayout'
const STAGES = ['cutting', 'machining', 'assembly', 'glazing', 'qc']
const cap = s => s[0].toUpperCase() + s.slice(1)
export const SP = { draft: ['#f1f5f9', '#64748b', 'Draft'], confirmed: ['#eff6ff', '#1d4ed8', 'Confirmed'], in_production: ['#fef3c7', '#92400e', 'In production'], production_complete: ['#ecfdf5', '#047857', 'Production complete'], dispatched: ['#ecfdf5', '#059669', 'Dispatched'] }
export const Pill = ({ s }) => { const [bg, c, l] = SP[s] || SP.draft; return <span className="pd-pill" style={{ background: bg, color: c }}>{l}</span> }
const dt = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
export const Bar = ({ done, inp, total }) => <div className="pd-bar"><i style={{ width: (total ? done / total * 100 : 0) + '%', background: '#16a34a' }} /><i style={{ width: (total ? inp / total * 100 : 0) + '%', background: '#2563eb' }} /></div>

export default function Production() {
  const [sp] = useSearchParams(); const view = sp.get('view')
  return <ProdLayout>{view === 'customers' ? <Customers /> : view === 'reports' ? <Reports /> : <List />}</ProdLayout>
}
function List() {
  const nav = useNavigate(); const [rows, setRows] = useState([]); const [f, setF] = useState('all'); const [open, setOpen] = useState({})
  useEffect(() => { api('/production').then(setRows) }, [])
  const view = f === 'all' ? rows : rows.filter(r => r.status === f)
  const stage = s => rows.filter(r => r.stage === s).reduce((a, r) => a + r.in_process, 0)
  const FL = [['all', 'All'], ['draft', 'Draft'], ['confirmed', 'Confirmed'], ['in_production', 'In production'], ['production_complete', 'Production complete'], ['dispatched', 'Dispatched']]
  return <>
    <div className="qt-list-header"><h1 className="qt-page-title">Production</h1><p className="qt-page-subtitle">{rows.length} work orders · from approved quote to dispatch</p></div>
    <div className="pd-stats"><div className="pd-stat"><b style={{ color: '#b45309' }}>{rows.reduce((a, r) => a + r.balance, 0)}</b><span>Balance (not entered)</span></div>
      {STAGES.map(s => <div className="pd-stat" key={s}><b>{stage(s)}</b><span>{cap(s) === 'Qc' ? 'QC' : cap(s)}</span></div>)}<div className="pd-stat ok"><b style={{ color: '#059669' }}>{rows.reduce((a, r) => a + r.done, 0)}</b><span>Completed</span></div></div>
    <div className="qt-nav-pills" role="group">{FL.map(([k, l]) => <button key={k} className={'qt-nav-pill' + (f === k ? ' active' : '')} onClick={() => setF(k)}>{l}<span className="qt-pill-count">{k === 'all' ? rows.length : rows.filter(r => r.status === k).length}</span></button>)}</div>
    <div className="pd-cards">{view.map(r => <div key={r.id} className="pd-card" onClick={() => nav('/production/' + r.id)}><div className="pd-card-top"><b>{r.project}</b><Pill s={r.status} /></div><div className="pd-card-wo"><span className="pd-chev">›</span><b className="pd-link">{r.number}</b><span className="pd-sub">· {r.customer}</span></div><Bar done={r.done} inp={r.in_process} total={r.total} /><div className="pd-card-foot"><span><b>{r.done}</b> of {r.total} done · {r.in_process} in process · {r.balance} balance</span><span className="pd-stage">{cap(r.stage)}</span></div></div>)}{!view.length && <div className="ps-empty">No work orders.</div>}</div>
    <div className="qt-table-wrap pd-wrap"><table className="qt-table"><thead><tr><th>Work order</th><th>Customer &amp; project</th><th>Progress</th><th>Main stage</th><th>Status</th><th>Created</th></tr></thead><tbody>
      {view.map(r => <tr key={r.id} className="qt-table-row" title="Click to open work order" onClick={() => nav('/production/' + r.id)}>
        <td><div className="pd-wo"><button className="pd-chev" aria-label="Expand" onClick={e => { e.stopPropagation(); setOpen({ ...open, [r.id]: !open[r.id] }) }}>{open[r.id] ? '⌄' : '›'}</button><b className="pd-link">{r.number}</b></div><div className="pd-sub">from {r.quotation_number}</div>{r.subs > 0 && <span className="pd-tag">{r.subs} sub work order{r.subs > 1 ? 's' : ''}</span>}</td>
        <td><b>{r.customer}</b><div className="pd-sub">{r.project}</div></td>
        <td><div className="pd-prog"><Bar done={r.done} inp={r.in_process} total={r.total} /><div className="pd-sub"><b style={{ color: '#111' }}>{r.done}</b> of {r.total} done · {r.in_process} in process · {r.balance} balance</div></div></td>
        <td><span className="pd-stage">{cap(r.stage)}</span></td><td><Pill s={r.status} /></td><td className="pd-date">{dt(r.created_at)}</td></tr>)}
      {!view.length && <tr><td colSpan="6" className="ps-empty">No work orders.</td></tr>}</tbody></table></div></>
}
function Customers() {
  const nav = useNavigate(); const [rows, setRows] = useState([])
  useEffect(() => { api('/customers').then(setRows) }, [])
  return <><div className="qt-list-header"><h1 className="qt-page-title">Customers</h1><p className="qt-page-subtitle">{rows.length} customers · Select one to view work orders</p></div>
    <div className="qt-table-wrap pd-wrap"><table className="qt-table"><thead><tr><th>Customer</th><th>Contact</th><th>Email</th></tr></thead><tbody>
      {rows.map(c => <tr key={c.id} className="qt-table-row" onClick={() => nav('/production?view=reports&customer=' + c.id)}><td><b>{c.name}</b></td><td>{c.contact || c.name}{c.phone ? ' · ' + c.phone : ''}</td><td>{c.email || '—'}</td></tr>)}</tbody></table></div></>
}
function Reports() {
  const [d, setD] = useState({ rows: [], work_orders: [] }); const [g, setG] = useState('Daily'); const [wo, setWo] = useState(''); const [range, setRange] = useState('All time')
  useEffect(() => { api('/production/report').then(setD) }, [])
  const rows = d.rows.filter(r => !wo || r.wo === wo)
  const T = (k) => rows.reduce((a, r) => a + r[k], 0)
  const Tile = ({ t, v, s, x }) => <div className="pd-stat wide"><span>{t}</span><b>{v}</b><span>{s}</span>{x && <span>{x}</span>}</div>
  return <><div className="qt-list-header"><h1 className="qt-page-title">Production reports</h1><p className="qt-page-subtitle">All customers · Production, dispatch and material usage</p></div>
    <div className="pd-filters"><label>From <input type="date" /></label><label>To <input type="date" /></label>
      <label>Group by <select value={g} onChange={e => setG(e.target.value)}><option>Daily</option><option>Monthly</option></select></label>
      <label>Work order <select value={wo} onChange={e => setWo(e.target.value)}><option value="">All work orders</option>{d.work_orders.map(w => <option key={w}>{w}</option>)}</select></label>
      <div className="qt-nav-pills">{['This month', 'All time'].map(x => <button key={x} className={'qt-nav-pill' + (range === x ? ' active' : '')} onClick={() => setRange(x)}>{x}</button>)}</div></div>
    <div className="pd-tiles"><Tile t="Production" v={T('sqft') + ' sq ft'} s={T('units') + ' units completed'} /><Tile t="Dispatches" v={T('d_sqft') + ' sq ft'} s={T('d_units') + ' units dispatched'} /><Tile t="Metal consumed" v="0 m" s="Aluminium + reinforcement" /><Tile t="uPVC consumed" v="0 m" s="Separate from metal" /></div>
    <section className="qt-info-card"><div className="ps-card-head"><div><div className="ps-card-title">{g} production &amp; dispatch</div><div className="ps-card-sub">Production is counted once at first successful post-fabrication QC. Dispatches use dispatch-note dates. All dates are IST.</div></div></div>
      <div className="qt-card-body" style={{ overflowX: 'auto' }}><table className="ps-table"><thead><tr><th>Date</th><th>Produced units</th><th>Produced sq ft</th><th>Dispatched units</th><th>Dispatched sq ft</th><th>Metal used (m)</th><th>uPVC used (m)</th></tr></thead><tbody><tr><td colSpan="7" className="ps-empty">No recorded activity in this period.</td></tr></tbody></table></div></section>
    <section className="qt-info-card"><div className="ps-card-head"><div><div className="ps-card-title">Material consumption</div><div className="ps-card-sub">Confirmed stock consumption dated in the period: bar length minus reusable returns, including cutting loss and scrap. Reserved stock is excluded.</div></div></div>
      <div className="qt-card-body"><div className="ps-empty">No confirmed material consumption recorded for these filters.</div><div className="pd-tiles">{['Aluminium', 'GI / steel reinforcement', 'uPVC', 'Unidentified profiles'].map(x => <div className="pd-stat" key={x}><span>{x}</span><b>0 m</b></div>)}</div></div></section>
    <section className="qt-info-card"><div className="ps-card-head"><div className="ps-card-title">By work order</div></div><div className="qt-card-body" style={{ overflowX: 'auto' }}><table className="ps-table"><thead><tr><th>Work order</th><th>Produced units</th><th>Produced sq ft</th><th>Dispatched units</th><th>Dispatched sq ft</th><th>Metal used (m)</th><th>uPVC used (m)</th></tr></thead>
      <tbody>{rows.map(r => <tr key={r.wo}><td><b>{r.wo}</b></td><td>{r.units}</td><td>{r.sqft}</td><td>{r.d_units}</td><td>{r.d_sqft}</td><td>0</td><td>0</td></tr>)}{!rows.length && <tr><td colSpan="7" className="ps-empty">No work orders have recorded activity in this period.</td></tr>}</tbody></table></div></section></>
}
