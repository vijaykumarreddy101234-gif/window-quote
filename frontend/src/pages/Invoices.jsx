import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr2, token, downloadFile } from '../api'
import { ProdLayout } from './ProdLayout'
import { askConfirm } from '../dialog'
const dt = s => s ? new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
export default function Invoices() {
  const nav = useNavigate(); const [rows, setRows] = useState([]); const [f, setF] = useState('all'); const [q, setQ] = useState('')
  const load = () => api('/invoices').then(setRows); useEffect(() => { load() }, [])
  const month = rows.filter(r => (r.invoice_date || r.created_at || '').slice(0, 7) === new Date().toISOString().slice(0, 7) && r.status === 'issued')
  const view = rows.filter(r => (f === 'all' || r.status === f) && (!q || (r.number + (r.customer || '') + (r.reference || '')).toLowerCase().includes(q.toLowerCase())))
  const cnt = s => s === 'all' ? rows.length : rows.filter(r => r.status === s).length
  const cancel = async r => { if (await askConfirm(`Cancel ${r.number}?`, 'Cancel invoice')) { await api(`/invoices/${r.id}/cancel`, { method: 'POST' }); load() } }
  return <ProdLayout kind="invoices"><div className="qt-list-head"><div><h1 className="qt-page-title">Invoices</h1><p className="qt-page-subtitle">Issue customer invoices, track their due dates and download branded documents.</p></div>
    <div className="qt-money"><div><strong>{inr2(month.reduce((a, r) => a + r.taxable, 0))}</strong><span>Invoiced this month · {month.length}</span></div><div><strong>{inr2(month.reduce((a, r) => a + r.gst, 0))}</strong><span>GST this month</span></div></div></div>
    <div className="qt-list-toolbar"><div className="qt-nav-pills">{[['all', 'All'], ['issued', 'Issued'], ['cancelled', 'Cancelled']].map(([k, l]) => <button key={k} className={'qt-nav-pill' + (f === k ? ' active' : '')} onClick={() => setF(k)}>{l}<span className="qt-pill-count">{cnt(k)}</span></button>)}</div>
      <div className="module-actions"><input className="qt-search" type="search" placeholder="Search number, party or reference" value={q} onChange={e => setQ(e.target.value)} /><button className="qt-btn-ghost" onClick={() => downloadFile('/invoices/export', 'invoice-register.csv')}>Export register</button><button className="qt-btn-primary" onClick={() => nav('/invoices/new')}>New invoice</button></div></div>
    <div className="qt-table-wrap pd-wrap"><table className="qt-table"><thead><tr><th>Invoice</th><th>Customer</th><th>Due date</th><th className="r">Taxable</th><th className="r">GST</th><th className="r">Total</th><th>Status</th><th>PDF</th></tr></thead><tbody>
      {view.map(r => <tr key={r.id} className="qt-table-row"><td><b className="pd-link">{r.number}</b><div className="pd-sub">{dt(r.invoice_date || r.created_at)}</div></td><td>{r.customer}{r.reference && <div className="pd-sub">{r.reference}</div>}</td><td>{dt(r.due_date)}</td><td className="r">{inr2(r.taxable)}</td><td className="r">{inr2(r.gst)}</td><td className="r"><b>{inr2(r.total)}</b></td>
        <td><span className="pd-pill" style={r.status === 'issued' ? { background: '#ecfdf5', color: '#059669' } : { background: '#fef2f2', color: '#dc2626' }}>{r.status[0].toUpperCase() + r.status.slice(1)}</span></td>
        <td><button className="qt-btn-ghost" onClick={() => downloadFile(`/invoices/${r.id}/pdf`, r.number + '.pdf')}>PDF</button>{r.status === 'issued' && <button className="qt-btn-ghost" style={{ marginLeft: 6 }} onClick={() => cancel(r)}>Cancel</button>}</td></tr>)}
      {!view.length && <tr><td colSpan="8" className="ps-empty">No invoices match. Create a document to begin.</td></tr>}</tbody></table></div></ProdLayout>
}
const UNITS = ['Nos', 'SFT', 'SQM', 'RFT', 'Mtr', 'Kg', 'Set', 'Window', 'Lot']
const blank = () => ({ code: '', desc: '', hsn: '', unit: 'Nos', qty: 1, price: '' })
const STATES = ['Andhra Pradesh', 'Telangana', 'Karnataka', 'Tamil Nadu', 'Kerala', 'Maharashtra', 'Gujarat', 'Delhi', 'Uttar Pradesh', 'West Bengal', 'Rajasthan', 'Madhya Pradesh', 'Odisha', 'Bihar', 'Punjab', 'Haryana']
export function NewInvoice() {
  const nav = useNavigate(); const today = new Date().toISOString().slice(0, 10)
  const [custs, setCusts] = useState([]); const [co, setCo] = useState({}); const [regs, setRegs] = useState([]); const [elig, setElig] = useState([]); const [panel, setPanel] = useState(false); const [pickId, setPickId] = useState(''); const [err, setErr] = useState('')
  const [link, setLink] = useState(null); const [billAs, setBillAs] = useState('window'); const [edit, setEdit] = useState(null)
  const [f, setF] = useState({ seller: '', customer_id: '', customer_gst: 'unregistered', invoice_date: today, due_date: today, reference: '', vehicle: '', driver: '', driver_phone: '', gst_rate: 18 })
  const [items, setItems] = useState([blank()])
  const loadCusts = () => api('/customers').then(setCusts)
  useEffect(() => { loadCusts(); api('/settings/company').then(c => { setCo(c); setRegs(c.gst_regs || []) }); api('/invoices/eligible').then(setElig) }, [])
  const set = (k, v) => setF(o => ({ ...o, [k]: v })); const upd = (i, p) => setItems(items.map((x, k) => k === i ? { ...x, ...p } : x))
  const taxable = items.reduce((a, x) => a + (+x.qty || 0) * (+x.price || 0), 0), gst = taxable * f.gst_rate / 100, exact = taxable + gst, grand = Math.round(exact), roundOff = grand - exact
  const cu = custs.find(c => c.id === f.customer_id); const inter = f.customer_gst === 'registered' && cu && cu.state && co.state && String(cu.state) !== String(co.state)
  const m = n => inr2(n)
  const build = (l, mode) => {
    const w = l.windows
    if (mode === 'window') return w.map(x => ({ code: x.code, desc: `${x.name} · ${x.width} × ${x.height} mm · ${x.sft} SFT each`, hsn: l.hsn, unit: 'Nos', qty: 1, price: x.price }))
    if (mode === 'type') { const g = {}; w.forEach(x => { const k = x.code; g[k] = g[k] || { code: x.code, desc: `${x.name} · ${x.width} × ${x.height} mm`, hsn: l.hsn, unit: 'Nos', qty: 0, price: x.price }; g[k].qty++ }); return Object.values(g) }
    const sft = +w.reduce((a, x) => a + x.sft, 0).toFixed(3), val = w.reduce((a, x) => a + x.price, 0)
    return [{ code: '', desc: `uPVC windows · ${w.length} windows`, hsn: l.hsn, unit: 'SFT', qty: sft, price: sft ? +(val / sft).toFixed(2) : 0 }]
  }
  const useWo = async () => { if (!pickId) return; const l = await api('/invoices/from-sub/' + pickId); setLink(l); setBillAs('window'); setItems(build(l, 'window')); setF(o => ({ ...o, customer_id: l.customer_id, reference: l.sub.number })); setPanel(false); setErr('') }
  const changeBill = mode => { setBillAs(mode); if (link) setItems(build(link, mode)) }
  const unlink = () => { setLink(null); setItems([blank()]); set('reference', '') }
  const saveCust = async () => { await api('/customers/' + edit.id, { method: 'PUT', body: { address: edit.address, state: edit.state, gstin: edit.gstin } }); setEdit(null); await loadCusts(); if (link) { const l = await api('/invoices/from-sub/' + link.sub.id); setLink({ ...link, missing: l.missing }) } }
  const create = async () => { setErr(''); if (!f.customer_id) return setErr('Select a customer.')
    if (link && link.missing.length) return setErr(`${link.customer} is missing: ${link.missing.join(', ')}. The invoice needs these.`)
    if (link && (!f.vehicle || !f.driver || !f.driver_phone)) return setErr('Vehicle number, driver name and driver phone are required for an invoice raised from a work order.')
    const its = items.filter(x => x.desc && x.price !== '' && +x.price >= 0); if (!its.length) return setErr('Add at least one item with a description and unit price.')
    await api('/invoices', { method: 'POST', body: { ...f, items: its, sub_id: link ? link.sub.id : undefined } }); nav('/invoices') }
  const I = (p) => <input {...p} />
  const req = link ? ' *' : ''
  return <ProdLayout kind="invoices"><div className="qt-list-head"><div><h1 className="qt-page-title">New invoice</h1><p className="qt-page-subtitle">Choose the seller and customer, add the items, and check the GST and total before creating the invoice.</p></div><button className="qt-btn-ghost" onClick={() => nav('/invoices')}>Back to invoices</button></div>
    {link && <div className="inv-banner">Raising this invoice moves work order {link.sub.number} to Dispatched. Quotation {link.quotation.number} value before GST {m(link.quotation.value)}; billed so far {m(link.billed)}. <button className="pd-link-btn" onClick={unlink}>Unlink</button></div>}
    <section className="qt-info-card inv-form"><div className="ps-card-title" style={{ marginBottom: 14 }}>Invoice details</div>
      <div className="inv-grid">
        <label className="ps-field"><span>Sold by (our GST registration)</span><select aria-label="Sold by (our GST registration)" value={f.seller} onChange={e => set('seller', e.target.value)}><option value="">{co.name || 'Your company'} · {co.registered && co.gstin ? co.gstin : 'No GSTIN'}</option>{regs.map((r, i) => <option key={i} value={r.gstin}>{r.label || r.state} · {r.gstin}</option>)}</select></label>
        <label className="ps-field"><span>Customer name *</span>{link ? <select aria-label="Customer name *" value={f.customer_id} disabled><option value={f.customer_id}>From the quotation: {link.customer}</option></select> : <select aria-label="Customer name *" value={f.customer_id} onChange={e => set('customer_id', e.target.value)}><option value="">Select customer</option>{custs.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>}</label>
        <label className="ps-field"><span>Customer GST</span><select aria-label="Customer GST" value={f.customer_gst} onChange={e => set('customer_gst', e.target.value)}><option value="registered">Registered (has GSTIN)</option><option value="unregistered">Unregistered (no GSTIN)</option></select></label>
        {link && link.missing.length > 0 && <div className="inv-warn" style={{ gridColumn: '1 / -1' }}>{link.customer} is missing: {link.missing.join(', ')}. The invoice needs these. <button className="pd-link-btn" onClick={() => setEdit({ ...(custs.find(c => c.id === f.customer_id) || {}) })}>Complete customer details</button></div>}
        <label className="ps-field"><span>Invoice date *</span>{I({ type: 'date', value: f.invoice_date, onChange: e => set('invoice_date', e.target.value) })}</label>
        <label className="ps-field"><span>Due date *</span>{I({ type: 'date', value: f.due_date, onChange: e => set('due_date', e.target.value) })}</label>
        <label className="ps-field"><span>Customer reference</span>{I({ value: f.reference, onChange: e => set('reference', e.target.value) })}</label>
        <label className="ps-field"><span>Vehicle number{req}</span>{I({ value: f.vehicle, onChange: e => set('vehicle', e.target.value) })}</label>
        <label className="ps-field"><span>Driver name{req}</span>{I({ value: f.driver, onChange: e => set('driver', e.target.value) })}</label>
        <label className="ps-field"><span>Driver phone{req}</span>{I({ type: 'tel', value: f.driver_phone, onChange: e => set('driver_phone', e.target.value) })}</label></div>
      <div className="ps-card-head" style={{ padding: '22px 0 10px' }}><div className="ps-card-title">Items</div><span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        {link && <label className="inv-bill"><span>Bill the windows as</span><select aria-label="Bill the windows as" value={billAs} onChange={e => changeBill(e.target.value)}><option value="window">One line per window</option><option value="type">One line per window type</option><option value="sft">One line, total area in SFT</option></select></label>}
        <button className="qt-btn-ghost" onClick={() => setItems([...items, blank()])}>Add item</button><button className="qt-btn-ghost" onClick={() => setPanel(!panel)}>Add windows from a work order</button></span></div>
      {panel && <div className="inv-wopanel"><label className="ps-field" style={{ maxWidth: 320 }}><span>Work order</span><select aria-label="Work order" value={pickId} onChange={e => setPickId(e.target.value)}><option value="">Select work order</option>{elig.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></label>
        <div className="inv-wofoot"><span className="ps-hint">The invoice is linked to this work order and starts again from its details. Only work orders at Production complete or Dispatched are listed.</span><button className="qt-btn-primary" disabled={!pickId} onClick={useWo}>Use this work order</button></div></div>}
      <div style={{ overflowX: 'auto' }}><table className="ps-table inv-items"><thead><tr><th>Sl. no.</th><th>Item code</th><th>Item description *</th><th>HSN / SAC</th><th>Unit</th><th>SFT / No. *</th><th>Unit price (₹) *</th><th>Value (₹)</th><th /></tr></thead><tbody>
        {items.map((x, i) => <tr key={i}><td><input aria-label={`Serial number ${i + 1}`} value={i + 1} readOnly style={{ width: 50 }} /></td><td><input aria-label={`Item code ${i + 1}`} value={x.code} onChange={e => upd(i, { code: e.target.value })} /></td><td><textarea aria-label={`Item description ${i + 1}`} rows="2" value={x.desc} onChange={e => upd(i, { desc: e.target.value })} /></td>
          <td><input aria-label={`HSN SAC ${i + 1}`} value={x.hsn} onChange={e => upd(i, { hsn: e.target.value })} /></td><td><select aria-label={`Unit ${i + 1}`} value={x.unit} onChange={e => upd(i, { unit: e.target.value })}>{UNITS.map(u => <option key={u}>{u}</option>)}</select></td>
          <td><input aria-label={`Quantity ${i + 1}`} inputMode="decimal" value={x.qty} onChange={e => upd(i, { qty: e.target.value })} style={{ width: 80 }} /></td><td><input aria-label={`Unit price ${i + 1}`} inputMode="decimal" value={x.price} onChange={e => upd(i, { price: e.target.value })} /></td>
          <td><b>{m((+x.qty || 0) * (+x.price || 0))}</b></td><td><button className="qt-btn-ghost" onClick={() => setItems(items.length > 1 ? items.filter((_, k) => k !== i) : [blank()])}>Remove</button></td></tr>)}</tbody></table></div>
      <div className="inv-totals"><label className="ps-field" style={{ maxWidth: 140 }}><span>GST rate</span><select aria-label="GST rate" value={f.gst_rate} onChange={e => set('gst_rate', +e.target.value)}>{[0, 5, 12, 18, 28].map(r => <option key={r} value={r}>{r}%</option>)}</select></label>
        <div className="inv-sum"><div><span>Taxable value</span><span>{m(taxable)}</span></div>{inter ? <div><span>IGST {f.gst_rate}%</span><span>{m(gst)}</span></div> : <><div><span>CGST {f.gst_rate / 2}%</span><span>{m(gst / 2)}</span></div><div><span>SGST {f.gst_rate / 2}%</span><span>{m(gst / 2)}</span></div></>}{Math.abs(roundOff) > 0.0001 && <div><span>Round off</span><span>{m(roundOff)}</span></div>}<div className="tot"><span>Total</span><span>{m(grand)}</span></div></div></div>
      <p className="ps-hint">GST is split into CGST and SGST within one state and charged as IGST between states, using the seller's and customer's GST state. Your accountant must confirm the HSN / SAC and the rate.</p>
      {err && <div style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
      <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}><button className="qt-btn-ghost" onClick={() => nav('/invoices')}>Cancel</button><button className="qt-btn-primary" onClick={create}>Create invoice</button></div></section>
    {edit && <div className="modal-bg" onClick={() => setEdit(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}><h3 style={{ marginTop: 0 }}>Customer details — {edit.name}</h3>
      <label className="ps-field"><span>Billing address</span><textarea rows="3" value={edit.address || ''} onChange={e => setEdit({ ...edit, address: e.target.value })} /></label>
      <label className="ps-field" style={{ marginTop: 10 }}><span>State</span><select value={edit.state || ''} onChange={e => setEdit({ ...edit, state: e.target.value })}><option value="">Select state</option>{STATES.map(s => <option key={s}>{s}</option>)}</select></label>
      <label className="ps-field" style={{ marginTop: 10 }}><span>GSTIN (optional)</span><input value={edit.gstin || ''} onChange={e => setEdit({ ...edit, gstin: e.target.value })} /></label>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="qt-btn-primary" onClick={saveCust}>Save</button><button className="qt-btn-ghost" onClick={() => setEdit(null)}>Cancel</button></div></div></div>}
  </ProdLayout>
}
