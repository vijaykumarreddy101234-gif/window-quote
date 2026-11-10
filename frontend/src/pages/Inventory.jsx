import { useEffect, useMemo, useState } from 'react'
import { api, inr2 } from '../api'
import { InvNav } from './InventoryMisc'
import { askText, askForm } from '../dialog'
const CATS = [['hardware', 'Hardware'], ['accessories', 'Accessories and Installation'], ['profiles', 'Profiles'], ['reinforcement', 'Reinforcement'], ['installation', 'Consumables']]
export default function Inventory() {
  const [rows, setRows] = useState([]); const [cat, setCat] = useState('hardware'); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [deleted, setDeleted] = useState(false)
  const load = () => api('/inventory/hardware?deleted=' + (deleted ? 1 : 0)).then(setRows)
  useEffect(() => { load() }, [deleted])
  const types = useMemo(() => [...new Set(rows.filter(r => cat === 'hardware' ? r.brand === 'Generic Hardware' : r.brand !== 'Generic Hardware').map(r => `${r.hardware_type}|${r.window_type}`))].sort(), [rows, cat])
  const catRows = rows.filter(r => cat === 'hardware' ? r.brand === 'Generic Hardware' : cat === 'accessories' ? r.brand !== 'Generic Hardware' : false)
  const view = catRows.filter(r => (!type || `${r.hardware_type}|${r.window_type}` === type) && (!q || (r.name + r.code).toLowerCase().includes(q.toLowerCase())))
  const setRate = async r => { const v = await askText('Your rate', r.your_rate); if (v !== null && !isNaN(+v)) { await api('/inventory/hardware/' + r.id, { method: 'PUT', body: { your_rate: +v } }); load() } }
  const setStock = async (r, v) => { await api('/inventory/hardware/' + r.id, { method: 'PUT', body: { stock: +v } }); load() }
  const del = async r => { await api('/inventory/hardware/' + r.id, { method: 'DELETE' }); load() }
  const add = async () => { const f = await askForm('Add product', [{ k: 'name', label: 'Product name', required: true }, { k: 'rate', label: 'Rate (₹)', value: '0', type: 'number' }]); if (!f) return; const name = f.name, rate = +f.rate || 0; await api('/inventory/hardware', { method: 'POST', body: { name, default_rate: rate, your_rate: rate } }); load() }
  return (<>
    <InvNav /><h1>Inventory</h1><div className="muted">Branded profiles, reinforcement, hardware, accessories and consumables.</div>
    <div className="stats"><div className="stat"><b>{rows.filter(r => r.stock > 0).length}</b><span>Items in stock</span></div><div className="stat"><b>0</b><span>Short for confirmed orders</span></div></div>
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <input style={{ maxWidth: 260 }} type="search" placeholder="Search product, brand or type" value={q} onChange={e => setQ(e.target.value)} />
      <select style={{ width: 'auto' }} value={cat} onChange={e => setCat(e.target.value)}>{CATS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
      <select style={{ width: 'auto' }}><option>All brands</option><option>Generic Hardware</option></select>
      <select style={{ width: 'auto' }} value={type} onChange={e => setType(e.target.value)}><option value="">All hardware types</option>{types.map(t => { const [h, w] = t.split('|'); return <option key={t} value={t}>{h} · {w}</option> })}</select>
      <label style={{ display: 'flex', gap: 6, alignItems: 'center', margin: 0, textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" style={{ width: 'auto' }} checked={deleted} onChange={e => setDeleted(e.target.checked)} />Show deleted</label>
      <button className="btn" onClick={add}>Add hardware / accessory</button>
    </div>
    {!['hardware', 'accessories'].includes(cat) ? <div className="card muted" style={{ marginTop: 16 }}>No stock recorded in this category yet.</div> : <>
      <div style={{ margin: '16px 0 8px' }}><b>{cat === 'hardware' ? 'Hardware' : 'Accessories and Installation'}</b> <span className="muted">· {view.length} items · Catalogue and prices shared with Settings</span> <button className="btn ghost sm" style={{ float: 'right' }} onClick={load}>Sync all rates with server</button></div>
      <table><thead><tr><th>Product</th><th>Brand</th><th>Window type</th><th>Hardware type</th><th>Unit</th><th>Default rate</th><th>Your rate</th><th>Stock</th><th>Actions</th></tr></thead>
        <tbody>{view.map(r => <tr key={r.id}><td>{r.name} {r.code && <span className="muted">[{r.code}]</span>}</td><td>{r.brand}</td><td>{r.window_type}</td><td>{r.hardware_type}</td><td>{r.unit}</td><td>{inr2(r.default_rate)}</td>
          <td>{inr2(r.your_rate)} <a style={{ cursor: 'pointer' }} onClick={() => setRate(r)}>✎</a></td>
          <td><input style={{ width: 70, padding: 4 }} type="number" defaultValue={r.stock} onBlur={e => +e.target.value !== r.stock && setStock(r, e.target.value)} /> pc</td>
          <td>{!deleted && <button className="btn ghost sm" onClick={() => del(r)}>Delete</button>}</td></tr>)}</tbody></table></>}
  </>)
}
