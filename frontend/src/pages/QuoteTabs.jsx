import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, inr, inr2, downloadFile } from '../api'
import { WindowSvg } from '../WindowSvg'
import WindLoad from './WindLoad'

const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['bn', 'বাংলা'], ['mr', 'मराठी']]
const COLORS = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569']
const fmt = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

function Pie({ rows }) {
  const data = rows.filter(r => r.v > 0), tot = data.reduce((a, r) => a + r.v, 0) || 1; let a0 = -Math.PI / 2
  return <div className="qx-pie"><svg viewBox="-1 -1 2 2" width="190" height="190">{data.map((r, i) => { const a1 = a0 + r.v / tot * Math.PI * 2, big = a1 - a0 > Math.PI ? 1 : 0, d = data.length === 1 ? 'M0 -1A1 1 0 1 1 -0.001 -1Z' : `M0 0L${Math.cos(a0)} ${Math.sin(a0)}A1 1 0 ${big} 1 ${Math.cos(a1)} ${Math.sin(a1)}Z`; a0 = a1; return <path key={r.k} d={d} fill={COLORS[i % COLORS.length]} stroke="#fff" strokeWidth=".02" /> })}</svg>
    <div className="qx-legend">{data.map((r, i) => <div key={r.k}><i style={{ background: COLORS[i % COLORS.length] }} />{r.k}<b>{fmt(r.v)}</b><span>{(r.v / tot * 100).toFixed(1)}%</span></div>)}</div></div>
}

// ---------------------------------------------------------------- Pricing
function RateCell({ r, locked, onSave }) {
  const [v, setV] = useState(null); const shown = v ?? String(r.rate)
  if (locked || r.fixed) return <span className="qx-rate ro">{r.unit === '₹' ? '₹' : ''}{r.rate}{r.unit === '%' ? '%' : ''}</span>
  return <span className="qx-rate"><input value={shown} inputMode="decimal" onChange={e => setV(e.target.value)} onBlur={() => { if (v != null && +v !== +r.rate && v !== '') onSave(r, +v); setV(null) }} onKeyDown={e => { if (e.key === 'Escape') { setV(null); e.target.blur() } else if (e.key === 'Enter') e.target.blur() }} />{r.unit === '%' ? '%' : ''}</span>
}
export function PricingTab({ id, q, locked, reload }) {
  const [d, setD] = useState(null); const [sub, setSub] = useState('costing'); const [view, setView] = useState('table'); const [open, setOpen] = useState({}); const [proj, setProj] = useState(true); const [msg, setMsg] = useState('')
  const load = () => api(`/quotations/${id}/costing`).then(setD)
  useEffect(() => { load() }, [id, q.pricing.total])
  if (!d) return <div className="card muted">Loading costing…</div>
  const c = d.costing, comm = d.comm
  const save = async patch => { try { await api(`/quotations/${id}/commercial`, { method: 'PUT', body: patch }); await load(); reload() } catch (e) { setMsg(e.message || 'Could not save') } }
  const saveRate = (r, val) => r.comm ? save({ [r.rateKey]: val }) : save({ rates: { [r.rateKey]: val } })
  const sync = () => save({ reset_rates: true })
  const wa = async pdf => { const s = await api(`/quotations/${id}/share`); window.open(s.whatsapp, '_blank') }
  const payments = [['', 'Not selected'], ['100% advance', '100% advance'], ['50-40-10', '50-40-10'], ['50-50', '50-50'], ['custom', 'Custom']]
  return <div className="qx-pricing">
    <div className="qx-subtabs">{[['costing', 'Costing'], ['compare', 'Production cost comparison'], ['profit', 'Profit on dispatched windows']].map(([k, l]) => <button key={k} className={sub === k ? 'on' : ''} onClick={() => setSub(k)}>{l}</button>)}</div>
    {msg && <div className="qx-msg" onClick={() => setMsg('')}>{msg}</div>}
    {sub === 'costing' && <>
      <div className="qx-card">
        <button className="qx-proj" onClick={() => setProj(!proj)}><b>Project costing</b><span>{q.windows} windows · {q.number}</span><i>{proj ? '⌃' : '⌄'}</i></button>
        {proj && <div className="qx-rates"><label>White profile rate<span>₹<input disabled={locked} defaultValue={d.rates.white_rate} key={'w' + d.rates.white_rate} onBlur={e => +e.target.value !== d.rates.white_rate && save({ rates: { white_rate: +e.target.value } })} />/ kg</span></label>
          <label>Reinforcement price<span>₹<input disabled={locked} defaultValue={d.rates.gi_rate} key={'g' + d.rates.gi_rate} onBlur={e => +e.target.value !== d.rates.gi_rate && save({ rates: { gi_rate: +e.target.value } })} />/ kg</span></label></div>}
        <div className="qx-seg"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button><button className={view === 'pie' ? 'on' : ''} onClick={() => setView('pie')}>Pie chart</button></div>
        {view === 'table' ? <table className="qx-table"><tbody>
          <tr className="qx-area"><td>Total area</td><td>{c.area.toFixed(2)} sq ft</td></tr>
          {c.rows.map(r => <tr key={r.key} className={r.total ? 'tot' : ''}>
            <td>{r.label}{!r.total && r.rate == null && !r.nopct && r.pct ? <small> ({r.pct}%)</small> : null}{r.rate != null && <> <RateCell r={r} locked={locked} onSave={saveRate} /> <small>{r.unit === '%' ? r.of : r.unit}</small></>}{r.total && r.pct ? <small> ({r.pct}%)</small> : null}</td>
            <td>{r.key === 'discount' ? '-' : ''}{inr2(Math.abs(r.value))}</td></tr>)}
          <tr className="grand"><td>Grand Total</td><td>{inr2(c.grand)}</td></tr><tr><td>Price per sq ft</td><td>{inr2(c.perSqft)}</td></tr></tbody></table>
          : <Pie rows={c.rows.filter(r => !r.total && !['discount', 'round', 'cgst', 'sgst'].includes(r.key)).map(r => ({ k: r.label, v: r.value }))} />}
        <p className="qx-note">Grand total ÷ total area, including quantity, quotation charges and taxes.</p>
        <p className="qx-note">Rates in a row are this quotation's own: click one to change it. It saves when you click away and every window is re-priced. Escape keeps the old value.</p>
        <p className="qx-note">Wastage and profit show their rate on the cost they are added to; labour and installation material show ₹ per sq ft. Other brackets show each amount as a share of the grand total; discounts subtract from it. Subtotals overlap.</p>
        {locked && <p className="qx-note">Rates are locked because this quotation is no longer a draft. Set it back to Draft to change them.</p>}
      </div>
      <div className="qx-card qx-opts">
        {[['show_discount', 'Show discount to customer'], ['show_gst', 'Show GST to customer'], ['hide_sqft', 'Hide per sq ft prices']].map(([k, l]) => <label key={k} className="qx-check"><input type="checkbox" disabled={locked} checked={!!comm[k]} onChange={e => save({ [k]: e.target.checked })} />{l}</label>)}
        <div className="qx-lab">Payment terms</div>
        <div className="qx-pay">{payments.map(([v, l]) => <label key={l} className={(comm.payment || '') === v ? 'on' : ''}><input type="radio" disabled={locked} name="pay" checked={(comm.payment || '') === v} onChange={() => save({ payment: v })} />{l}</label>)}</div>
        {comm.payment === 'custom' && <textarea className="note" rows={2} disabled={locked} defaultValue={comm.custom_payment} placeholder="Custom payment terms" onBlur={e => save({ custom_payment: e.target.value })} style={{ width: '100%', marginTop: 6 }} />}
        <div className="qx-lab">Notes</div>
        <textarea className="note" rows={3} disabled={locked} defaultValue={comm.notes} placeholder="Notes shown on the quotation" onBlur={e => e.target.value !== comm.notes && save({ notes: e.target.value })} style={{ width: '100%' }} />
        <div className="qx-actions"><button className="btn green" onClick={() => wa(false)}>📱 Send on WhatsApp</button><button className="btn ghost" onClick={() => wa(true)}>Send PDF on WhatsApp</button><button className="btn ghost" disabled={locked} onClick={sync}>Sync latest rates</button></div>
      </div>
      {d.items.map(it => { const e = it.engine, o = open[it.id]; return <div className="qx-card qx-win" key={it.id}>
        <div className="qx-win-h"><span className="qx-thumb"><WindowSvg item={it} mini /></span><div><b>{it.mark} — {it.name}</b><small>{it.width} × {it.height} mm · {it.area.toFixed(2)} sq ft • Glass {(String(it.glass).match(/\d+(\.\d+)?/) || [''])[0]}mm • Qty: {it.qty}</small></div>
          <div className="qx-win-p"><b>{inr2(it.each * it.qty)}</b><small>{inr2(it.each)}/unit</small><small>{inr2(it.perSqft)} / sq ft</small></div></div>
        <button className="qx-bom" onClick={() => setOpen({ ...open, [it.id]: !o })}>{o ? '▾' : '▸'} Bill of materials & cost heads</button>
        {o && e && <div className="qx-bom-b">
          {e.cuts.length > 0 && <table className="qx-table sm"><thead><tr><th>Profile</th><th>Cut lengths (mm)</th><th>kg</th></tr></thead><tbody>{e.cuts.map((c, i) => <tr key={i}><td>{c.code} · {c.name}</td><td>{(c.lens || []).join(' + ')}</td><td>{(+c.kg || 0).toFixed(2)}</td></tr>)}</tbody></table>}
          {e.hardware.length > 0 && <table className="qx-table sm"><thead><tr><th>Hardware</th><th>Qty</th><th>Rate</th></tr></thead><tbody>{e.hardware.map((h, i) => <tr key={i}><td>{h.name}</td><td>{h.qty}</td><td>{inr2(h.rate)}</td></tr>)}</tbody></table>}
          <div className="qx-seg"><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button><button className={view === 'pie' ? 'on' : ''} onClick={() => setView('pie')}>Pie chart</button></div>
          {view === 'table' ? <table className="qx-table sm"><tbody>{[...e.rows, ['Total material cost', e.materialTotal], ...e.labour, ['Total cost', e.totalCost], [e.profitLabel, e.profit], ['Unit subtotal (excl. tax)', e.unit]].map(([k, v], i) => <tr key={i}><td>{k}</td><td>{inr2(v)}</td></tr>)}</tbody></table>
            : <Pie rows={[...e.rows, ...e.labour, ['Profit', e.profit]].map(([k, v]) => ({ k, v }))} />}</div>}
      </div> })}
    </>}
    {sub === 'compare' && <CompareTab d={d} id={id} />}
    {sub === 'profit' && <ProfitTab d={d} id={id} />}
  </div>
}
function useTrack(id) { const [t, setT] = useState(null); useEffect(() => { api(`/quotations/${id}/tracking`).then(setT) }, [id]); return t }
function CompareTab({ d, id }) {
  const rows = d.items.map(it => { const e = it.engine || {}; return { ...it, material: (e.materialTotal || 0) * it.qty, labour: (e.labour || []).reduce((a, l) => a + l[1], 0) * it.qty, profit: (e.profit || 0) * it.qty, price: it.each * it.qty } })
  return <div className="qx-card"><h3>Production cost comparison</h3><p className="qx-note">Quoted cost per window against the selling price. Actual production costs are compared once windows are produced.</p>
    <table className="qx-table"><thead><tr><th>Window</th><th>Material</th><th>Labour</th><th>Profit</th><th>Selling price</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.mark} — {r.name}</td><td>{inr2(r.material)}</td><td>{inr2(r.labour)}</td><td>{inr2(r.profit)}</td><td>{inr2(r.price)}</td></tr>)}
      <tr className="tot"><td>Total</td><td>{inr2(rows.reduce((a, r) => a + r.material, 0))}</td><td>{inr2(rows.reduce((a, r) => a + r.labour, 0))}</td><td>{inr2(rows.reduce((a, r) => a + r.profit, 0))}</td><td>{inr2(rows.reduce((a, r) => a + r.price, 0))}</td></tr></tbody></table></div>
}
function ProfitTab({ d, id }) {
  const t = useTrack(id); if (!t) return <div className="card muted">Loading…</div>
  const by = Object.fromEntries(t.rows.map(r => [r.mark, r]))
  const rows = d.items.map(it => { const e = it.engine || {}, n = (by[it.mark] || {}).dispatched || 0; return { ...it, n, profit: (e.profit || 0) * n } })
  return <div className="qx-card"><h3>Profit on dispatched windows</h3>{!t.workOrder ? <p className="qx-note">No work order yet. Profit is recognised as windows are dispatched from production.</p> : null}
    <table className="qx-table"><thead><tr><th>Window</th><th>Dispatched</th><th>Profit earned</th></tr></thead><tbody>{rows.map(r => <tr key={r.id}><td>{r.mark} — {r.name}</td><td>{r.n} / {r.qty}</td><td>{inr2(r.profit)}</td></tr>)}<tr className="tot"><td>Total</td><td>{rows.reduce((a, r) => a + r.n, 0)}</td><td>{inr2(rows.reduce((a, r) => a + r.profit, 0))}</td></tr></tbody></table></div>
}

// ---------------------------------------------------------------- Inventory
export function InventoryTab({ id, q }) {
  const nav = useNavigate(); const [m, setM] = useState(null); const [rec, setRec] = useState(null); const [val, setVal] = useState(''); const [inst, setInst] = useState(null); const [msg, setMsg] = useState('')
  const load = () => api(`/quotations/${id}/materials`).then(r => { setM(r); setInst(r.install || []) })
  useEffect(() => { load() }, [id, q.pricing.total])
  if (!m) return <div className="card muted">Loading material balance…</div>
  const T = m.totals
  const po = async () => { const sup = await api('/suppliers').catch(() => []); const r = await api('/purchase-orders', { method: 'POST', body: { supplier_id: (sup[0] || {}).id || null, total: 0 } }); setMsg('Purchase order ' + r.number + ' created (draft). Open Inventory → Purchase orders to add the items.') }
  const saveStock = async it => { await api(`/inventory/hardware/${it.id}`, { method: 'PUT', body: { stock: +val || 0 } }); setRec(null); setVal(''); load() }
  const saveInst = async () => { await api(`/quotations/${id}/install-materials`, { method: 'PUT', body: { items: inst } }); setMsg('Installation list saved.'); load() }
  return <div className="qx-inv">
    <div className="qx-inv-h"><div><h3>Material balance</h3><p className="qx-note">Everything required for this job, the stock you have, and what to procure.</p></div>
      <div className="qx-actions"><button className="btn" onClick={po}>Create purchase order</button><button className="btn ghost" onClick={() => downloadFile(`/quotations/${id}/doc/materials?format=pdf`, 'materials.pdf')}>Export PDF</button><button className="btn ghost" onClick={() => downloadFile(`/quotations/${id}/doc/materials?format=xlsx`, 'materials.xlsx')}>Export Excel</button></div></div>
    {msg && <div className="qx-msg ok" onClick={() => setMsg('')}>{msg}</div>}
    <div className="qx-tiles"><div><span>Required items</span><b>{T.required}</b><small>Across all materials</small></div><div><span>In stock</span><b>{T.inStock}</b><small>Items with stock covering this job</small></div><div><span>To procure</span><b>{T.toProcure}</b><small>Items with a purchase balance</small></div></div>
    {T.toProcure > 0 && <div className="qx-warn">Some material is short. Production can still start; the shortage shows as negative stock in Inventory.</div>}
    <div className="qx-card"><table className="qx-table qx-inv-t"><thead><tr><th>Material</th><th>Unit</th><th>Required</th><th>Present stock</th><th>Balance to procure</th><th /></tr></thead><tbody>
      {m.groups.map(g => [<tr className="qx-grp" key={g.name}><td colSpan="6"><b>{g.name}</b> <span>{g.items.length} items</span></td></tr>, ...g.items.map((it, i) => <tr key={g.name + i}><td>{it.label}{it.code && <small className="qx-code">{it.code}</small>}</td><td>{it.unit}</td><td>{it.required}</td><td>{it.stock}</td><td>{it.balance}</td>
        <td>{it.id ? (rec === it.id ? <span className="qx-rec"><input autoFocus type="number" value={val} onChange={e => setVal(e.target.value)} placeholder="Stock" /><button className="btn" onClick={() => saveStock(it)}>Save</button><button className="btn ghost" onClick={() => setRec(null)}>×</button></span> : <button className="btn ghost sm" onClick={() => { setRec(it.id); setVal(it.stock) }}>Record stock</button>) : null}</td></tr>)])}
    </tbody></table></div>
    <div className="qx-card"><h4>Installation materials</h4><p className="qx-note">Link each supply to inventory. Saved quantities are blocked when the order is confirmed and consumed at production completion; quotation price is unchanged.</p>
      {(inst || []).length === 0 && <p className="qx-note">Not configured — add sealant, anchors, packers or other site materials when known.</p>}
      {(inst || []).map((x, i) => <div className="qx-inst" key={i}><input placeholder="Material" value={x.name} onChange={e => setInst(inst.map((y, j) => j === i ? { ...y, name: e.target.value } : y))} /><input type="number" placeholder="Qty" value={x.qty} onChange={e => setInst(inst.map((y, j) => j === i ? { ...y, qty: e.target.value } : y))} /><select value={x.unit || 'pc'} onChange={e => setInst(inst.map((y, j) => j === i ? { ...y, unit: e.target.value } : y))}>{['pc', 'm', 'kg', 'can', 'box'].map(u => <option key={u}>{u}</option>)}</select><button className="btn ghost sm" onClick={() => setInst(inst.filter((_, j) => j !== i))}>Remove</button></div>)}
      <div className="qx-actions"><button className="btn ghost" onClick={() => setInst([...(inst || []), { name: '', qty: 1, unit: 'pc' }])}>Add material</button><button className="btn" onClick={saveInst}>Save installation list</button></div></div>
  </div>
}

function SectionsPreview({ title, data }) {
  return <><h3>{title} <small>Preview — the download carries the letterhead, drawings and signature boxes.</small></h3>
    <div className="qx-tiles6">{data.tiles.map(([k, v]) => <div key={k}><small>{k.toUpperCase()}</small><b>{v}</b></div>)}</div>
    <p className="muted" style={{ color: '#9a3412' }}>{data.note}</p>
    {data.sections.map(sc => <div key={sc.title} className="qx-sec"><h4>{sc.title}</h4>{sc.desc && <p className="muted">{sc.desc}</p>}
      <div className="qx-scroll"><table className="qx-table"><thead><tr>{sc.cols.map((c, i) => <th key={i} style={{ textAlign: c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left' }}>{c.h}</th>)}</tr></thead>
        <tbody>{sc.rows.map((r, ri) => <tr key={ri} className={r.t === 'strong' ? 'tot' : r.t === 'group' ? 'qx-grp' : ''}>{r.c.map((v, i) => <td key={i} style={{ textAlign: sc.cols[i] && sc.cols[i].a === 'r' ? 'right' : sc.cols[i] && sc.cols[i].a === 'c' ? 'center' : 'left', fontWeight: r.t === 'strong' || r.t === 'group' ? 700 : 400 }}>{v}</td>)}</tr>)}</tbody></table></div></div>)}</>
}
// ---------------------------------------------------------------- Documents
export function DocumentsTab({ id, q, lang, setLang }) {
  const [view, setView] = useState('quotation'); const [cost, setCost] = useState(null); const [mat, setMat] = useState(null); const [trk, setTrk] = useState(null)
  const p = q.pricing, area = p.area || 0, win = p.subtotal - (p.discountAmt || 0) + p.transport + p.loading + p.unloading
  useEffect(() => { if (view === 'costing' && !cost) api(`/quotations/${id}/doc/costing?format=json`).then(setCost); if (view === 'materials' && !mat) api(`/quotations/${id}/doc/materials?format=json`).then(setMat); if (view === 'tracking' && !trk) api(`/quotations/${id}/tracking`).then(setTrk) }, [view])
  const dl = (kind, f) => downloadFile(`/quotations/${id}/doc/${kind}?format=${f}`, `${q.number}-${kind}.${f}`)
  const Card = ({ k, tag, title, children, noView }) => <div className={'qx-doc' + (view === k ? ' on' : '')}><span className="qx-tag">{tag}</span><h4>{title}</h4>{k === 'quotation' ? <div className="qx-showing">{view === k ? '✓ Showing below' : <button onClick={() => setView(k)}>View</button>}</div> : <button className="qx-view" onClick={() => setView(k)}>{view === k ? '⌄ Viewing' : '› View'}</button>}{children}</div>
  return <div className="qx-docs">
    <h3 className="qx-dh">Quotation documents <small>Production documents are prepared in the work order once the quotation is confirmed.</small></h3>
    <div className="qx-doc-grid">
      <Card k="quotation" tag="CUSTOMER" title="Quotation"><label className="qx-lang">Quotation language<select value={lang} onChange={e => setLang(e.target.value)}>{LANGS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="qx-dlb"><button onClick={() => downloadFile(`/quotations/${id}/download?format=pdf&lang=${lang}`, `${q.number}.pdf`)}>⤓ PDF</button><button onClick={() => downloadFile(`/quotations/${id}/download?format=docx&lang=${lang}`, `${q.number}.docx`)}>⤓ Word</button><button onClick={() => downloadFile(`/quotations/${id}/download?format=xlsx&lang=${lang}`, `${q.number}.xlsx`)}>⤓ Excel</button></div></Card>
      <Card k="elevation" tag="CUSTOMER / SITE" title="Elevation Diagram Report"><div className="qx-dlb"><button onClick={() => dl('elevation', 'pdf')}>⤓ PDF</button></div></Card>
      <Card k="shopdrawing" tag="CUSTOMER / BUILDER" title="Shop drawing"><div className="qx-dlb"><button onClick={() => dl('shopdrawing', 'pdf')}>⤓ PDF</button><button onClick={() => dl('shopdrawing', 'dxf')}>⤓ DXF</button></div></Card>
      <Card k="costing" tag="OWNER ONLY" title="Costing sheet"><div className="qx-dlb"><button onClick={() => dl('costing', 'pdf')}>⤓ PDF</button><button onClick={() => dl('costing', 'xlsx')}>⤓ Excel</button></div></Card>
      <Card k="materials" tag="PURCHASE" title="Material requirement"><div className="qx-dlb"><button onClick={() => dl('materials', 'pdf')}>⤓ PDF</button><button onClick={() => dl('materials', 'xlsx')}>⤓ Excel</button></div></Card>
      <Card k="windload" tag="CUSTOMER / CONSULTANT" title="Wind-load analysis"><span className="qx-dev">Under development</span></Card>
      <Card k="tracking" tag="OWNER ONLY" title="Project Tracking"><div className="qx-dlb"><button onClick={() => dl('tracking', 'pdf')}>⤓ PDF</button></div></Card>
    </div>
    <div className="qx-card qx-prev">
      {view === 'quotation' && <>
        <h3>Quotation <small>Preview — the download carries the letterhead, drawings and signature boxes.</small></h3>
        <div className="qx-tiles6">{[['CUSTOMER', q.customer && q.customer.name], ['NUMBER', q.number], ['WINDOWS', `${p.designs} designs · ${p.windows} units`], ['TOTAL AREA', area.toFixed(2) + ' sq ft'], ['AVERAGE RATE (EXCL. GST)', 'INR ' + fmt(area ? win / area : 0) + ' / sq ft'], ['AVERAGE RATE (INCL. GST)', 'INR ' + fmt(area ? p.total / area : 0) + ' / sq ft']].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        <p className="qx-note">Commercial saved quotation only. Not a production release.</p>
        <h4>Totals</h4><table className="qx-table"><thead><tr><th>Field</th><th>Amount</th></tr></thead><tbody>{[['Total windows', p.windows], ['Total area (sq ft)', area.toFixed(2)], ['Item subtotal', 'INR ' + fmt(p.subtotal + p.transport + p.loading + p.unloading)], ['Discount (' + (p.discount || 0) + '%)', '-INR ' + fmt(p.discountAmt || 0)], ['CGST', 'INR ' + fmt(p.cgst)], ['SGST', 'INR ' + fmt(p.sgst)], ['Round off', 'INR ' + fmt(p.roundOff)], ['Grand total', 'INR ' + fmt(p.total)], ['Price per sq ft (before GST)', 'INR ' + fmt(area ? win / area : 0)], ['Price per sq ft (after GST)', 'INR ' + fmt(area ? p.total / area : 0)]].map(([k, v]) => <tr key={k}><td>{k}</td><td>{v}</td></tr>)}</tbody></table>
        <h4>Window sheets</h4><div className="qx-sheets">{p.items.map(it => <div key={it.id}><span className="qx-thumb"><WindowSvg item={it} mini /></span><b>{it.mark} {it.name}</b><small>{it.system} · {it.width} × {it.height} mm · Qty {it.qty}</small></div>)}</div></>}
      {view === 'shopdrawing' && <><h3>Shop drawing <small>The same sheets as the PDF download. Click a window on the cover to open its sheet.</small></h3><div className="qx-elev">{p.items.map(it => <div key={it.id}><div className="qx-elev-d"><WindowSvg item={it} mini dims /></div><b>{it.mark} — {it.name}</b><small>{it.width} × {it.height} mm · Qty {it.qty}</small></div>)}</div></>}
      {view === 'windload' && <WindLoad id={id} q={q} />}
      {view === 'elevation' && <><h3>Elevation Diagram Report</h3><div className="qx-elev">{p.items.map(it => <div key={it.id}><div className="qx-elev-d"><WindowSvg item={it} mini /></div><b>{it.mark} — {it.name}</b><small>{it.width} × {it.height} mm · Qty {it.qty}</small></div>)}</div></>}
      {view === 'costing' && (!cost ? <p className="muted">Loading…</p> : <SectionsPreview title="Costing sheet" data={cost} />)}
      {view === 'materials' && (!mat ? <p className="muted">Loading…</p> : <SectionsPreview title="Material requirement" data={mat} />)}
      {view === 'tracking' && (!trk ? <p className="muted">Loading…</p> : <TrackingView trk={trk} q={q} onPdf={() => dl('tracking', 'pdf')} />)}
    </div>
  </div>
}

const n3 = v => v == null ? '—' : (+v).toLocaleString('en-IN', { maximumFractionDigits: 3 })
function TrackingView({ trk, q, onPdf }) {
  const T = trk.tiles, P = trk.profit, rupee = v => '₹' + (+v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  const when = (() => { const d = new Date(trk.updated || Date.now()); return d.toLocaleString('en-GB', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true }).replace(',', ',') })()
  return <div className="qx-track">
    <div className="qx-track-h"><div><h3>Project Tracking</h3><b>{q.number}</b><p className="muted">Updated: {when}</p></div><button className="qx-view" onClick={onPdf}>Print / save Project Tracking report PDF</button></div>
    <div className="qx-tiles6">{[['Quoted', T.quoted], ['In process', T.inProcess], ['Completed', T.completed], ['Supplied / dispatched', T.dispatched], ['Balance to allocate', T.balance], ['Still to supply (quoted windows)', T.still]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
    <h4>Quoted, in process, completed and balance</h4>
    <div className="qx-scroll"><table className="qx-table"><thead><tr><th>Ref</th><th>Window</th><th>Quoted</th><th>In process</th><th>Completed</th><th>Balance to allocate</th><th>Dispatched</th><th>Still to supply</th></tr></thead><tbody>{trk.rows.map(r => <tr key={r.mark}><td>{r.mark}</td><td>{r.name}</td><td>{r.quoted}</td><td>{r.inProcess}</td><td>{r.completed}</td><td>{r.balance}</td><td>{r.dispatched}</td><td>{r.still}</td></tr>)}<tr className="tot"><td colSpan="2">TOTAL</td>{['quoted', 'inProcess', 'completed', 'balance', 'dispatched', 'still'].map(k => <td key={k}>{trk.total[k] || 0}</td>)}</tr></tbody></table></div>
    <p className="qx-note2">In process includes windows entered in draft batches. Completed includes dispatched windows. Balance is quoted quantity not yet entered in any work order.</p>
    <p className="qx-note2">Balance means quoted windows still to allocate to a work order. Still to supply means quoted windows not yet dispatched. Completed includes supplied windows; extra windows do not reduce another window’s balance.</p>
    <h4>Windows outside quotation or above quoted quantity</h4>
    <div className="qx-scroll"><table className="qx-table"><thead><tr><th>Window</th><th>Quotation coverage</th><th>Quoted</th><th>Entered</th><th>Supplied</th><th>Above quotation</th></tr></thead><tbody>{trk.outside.length ? trk.outside.map((r, i) => <tr key={i}><td>{r.name}</td><td>{r.coverage}</td><td>{r.quoted}</td><td>{r.entered}</td><td>{r.supplied}</td><td>{r.above}</td></tr>) : <tr><td colSpan="6" className="muted">No windows outside the quotation or above quoted quantity.</td></tr>}</tbody></table></div>
    <h4>Projected and actual costs by head</h4>
    <p className="qx-note2">Actual manufacturing cost uses saved material requirements and current rates frozen when each work order starts production. It does not reconcile supplier invoices or cash expenditure. Variance compares the same started quantity; a positive amount means increased cost.</p>
    <div className="qx-scroll"><table className="qx-table"><thead><tr><th>Cost head</th><th>Projected full quotation</th><th>Projected started quantity</th><th>Actual started quantity</th><th>Started variance</th><th>Projected supplied quantity</th><th>Actual supplied quantity</th></tr></thead><tbody>{trk.costRows.map(r => <tr key={r.label} className={r.strong ? 'tot' : ''}><td>{r.label}</td><td>{rupee(r.full)}</td><td>{rupee(r.started)}</td><td>{rupee(r.actualStarted)}</td><td>{rupee(r.variance)}</td><td>{rupee(r.supplied)}</td><td>{rupee(r.actualSupplied)}</td></tr>)}</tbody></table></div>
    <h4>Window manufacturing profit</h4>
    <p className="qx-note2">Profit is realized as work orders are dispatched, using pro-rata quoted selling values for those windows. Margin is profit as a percentage of net revenue. GST and separately quoted project charges are excluded.</p>
    <div className="qx-scroll"><table className="qx-table"><thead><tr><th>Measure</th><th>Projected full quotation</th><th>Projected supplied quantity</th><th>Actual supplied quantity</th></tr></thead><tbody>
      <tr><td>Net window revenue</td><td>{rupee(P.rev)}</td><td>{rupee(P.revSupplied)}</td><td>{rupee(P.revSupplied)}</td></tr><tr><td>Manufacturing cost</td><td>{rupee(P.cost)}</td><td>{rupee(P.costSupplied)}</td><td>{rupee(P.costSupplied)}</td></tr><tr><td>Profit</td><td>{rupee(P.profit)}</td><td>{rupee(P.profitSupplied)}</td><td>{rupee(P.profitSupplied)}</td></tr>
      <tr><td>Profit margin (%)</td><td>{P.margin == null ? 'Unavailable' : P.margin.toFixed(1)}</td><td>{P.marginSupplied == null ? 'Unavailable' : P.marginSupplied.toFixed(1)}</td><td>{P.marginSupplied == null ? 'Unavailable' : P.marginSupplied.toFixed(1)}</td></tr></tbody></table></div>
    <h4>Materials and supplies</h4>
    <p className="qx-note2">Supply progress follows associated work-order completion and dispatch. Stock issued is shown separately and does not prove customer delivery. Missing historical supply quantities remain unavailable.</p>
    <div className="qx-scroll"><table className="qx-table"><thead><tr><th>Material / supply</th><th>Quotation coverage</th><th>Unit</th><th>Quoted</th><th>Allocated</th><th>In process</th><th>Completed</th><th>Supplied</th><th>Balance to allocate</th><th>Above quotation</th><th>Stock issued</th><th>Still to supply</th></tr></thead><tbody>{trk.materials.map((m, i) => <tr key={i}><td>{m.label}</td><td>Quoted</td><td>{m.unit}</td><td>{n3(m.quoted)}</td><td>{n3(m.allocated)}</td><td>{n3(m.inProcess)}</td><td>{n3(m.completed)}</td><td>{n3(m.supplied)}</td><td>{n3(m.balance)}</td><td>{n3(m.above)}</td><td>Unavailable</td><td>{n3(m.still)}</td></tr>)}</tbody></table></div>
  </div>
}
