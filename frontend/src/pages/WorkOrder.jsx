import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, downloadFile } from '../api'
import { WindowSvg } from '../WindowSvg'
import { ProdLayout } from './ProdLayout'
import { Pill, Bar } from './Production'
import { askText, askConfirm, say } from '../dialog'
import { Labels, BarOpt, SavedPlans } from './ProdPro'
const cap = s => s[0].toUpperCase() + s.slice(1)
const SL = { cutting: 'Cutting', machining: 'Machining', assembly: 'Assembly', glazing: 'Glazing', qc: 'QC', packed: 'Packed', dispatched: 'Dispatched' }
const DOCS = [['QC checklist', 'Simple window register: location, outer frame, sash and glass sizes, with matching specifications grouped together.'], ['Window supply schedule', 'Windows by block, flat or similar type: window numbers, codes, types, outer frame sizes and specifications.'], ['Window area report', 'Window quantities and area in SFT per flat, floor and block, with location filters and window-wise details.'], ['Complete production document', 'One sheet per window — drawing, cuts, reinforcement, glass and hardware — then the summary lists, for the whole work order.']]
const SUBDOCS = [['Glass cutting list', 'Every pane by glass specification, largest first, with area totals; mesh nets and boards listed apart.'], ['Profile cutting list', "Every window's profile pieces (code · location, length, W/H position, cut ends), then the cuts grouped by profile, longest first, with quantities and metres."], ['Reinforcement cutting list', 'Galvanised steel bars by host profile and thickness, with lengths, quantities and metres.'], ['Hardware list', 'Hardware and accessories required for each window, with item names, quantities and units.'], ['Complete production document', 'One sheet per window — drawing, cuts, reinforcement, glass and hardware — then the summary lists.'], ['QC checklist', 'Simple window register: location, outer frame, sash and glass sizes, with matching specifications grouped together.'], ['Installation list', 'Where each window goes, the materials to carry and a site checklist to tick per window.'], ['Window supply schedule', 'Windows by block, flat or similar type: window numbers, codes, types, outer frame sizes and specifications.'], ['Window area report', 'Window quantities and area in SFT per flat, floor and block, with location filters and window-wise details.'], ['Label printing', 'Identified profile labels in batches: A4 sheets or thermal rolls, with an alignment test page.', 'open'], ['Bar optimization', 'Cutting plan on full bars and measured offcuts, with kerf, end trim and reusable threshold.', 'open'], ['Saved bar plans', 'Cutting plans saved for this sub work order, with PDF and Excel downloads.', 'open']]
const Thumb = ({ d }) => <div className="wo-thumb"><WindowSvg item={d} mini /></div>
const dl = (path, q) => downloadFile(`${path}?${q}`, 'document')

function Head({ back, chip, status, title, sub, tabs, tab, setTab, right }) {
  const nav = useNavigate()
  return <div className="wo-head"><button className="qt-back-btn wo-back" onClick={() => nav(back ? back[1] : '/production')}>← {back ? back[0] : 'Production'}</button><span className="wo-chip">{chip}</span>{status}<b className="wo-title">{title}</b>
    {sub}<div className="qt-nav-pills wo-tabs">{tabs.map(t => <button key={t} className={'qt-nav-pill' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}>{t}</button>)}</div><span style={{ flex: 1 }} />{right}</div>
}
function Actions({ id, kind, wo, sid, onNotes, extra }) {
  const LIST = sid ? SUBDOCS : DOCS, base = i => sid ? `/production/subs/${sid}/docs/${i + 1}` : `/production/${wo}/docs/${i + 1}`
  const [o, setO] = useState(false); const [m, setM] = useState(false)
  return <div className="wo-actions"><button className="qt-btn-ghost" onClick={onNotes}>Add notes</button>
    <div className="document-download" style={{ position: 'relative' }}><button className="qt-btn-ghost document-download__trigger" onClick={() => setO(!o)}>⬇ Download <span>⌄</span></button>
      {o && <div className="document-download__menu" onClick={() => setO(false)}>{LIST.map(([t, , op], i) => op ? null : <div key={t}><div className="dd-title">{t}</div><div className="dd-row">{['pdf', 'xlsx', 'docx'].map(f => <button key={f} onClick={() => dl(base(i), 'format=' + f)}>{f === 'xlsx' ? 'Excel' : f === 'docx' ? 'Word' : 'PDF'}</button>)}</div></div>)}</div>}</div>
    {extra}<div style={{ position: 'relative' }}><button className="qt-btn-ghost" aria-label="More" onClick={() => setM(!m)}>⋯</button>{m && <div className="document-download__menu" onClick={() => setM(false)}><button className="dd-item" onClick={() => window.print()}>Print</button></div>}</div></div>
}
function Docs({ wo, sid }) {
  const [g, setG] = useState('All windows'), [pp, setPp] = useState(''), LIST = sid ? SUBDOCS : DOCS, base = i => sid ? `/production/subs/${sid}/docs/${i + 1}` : `/production/${wo}/docs/${i + 1}`
  return <section className="qt-info-card"><div className="ps-card-head"><div><div className="ps-card-title">Production documents</div><div className="ps-card-sub">Generate production documents</div></div></div>
    <div className="qt-card-body ps-form"><div className="ps-chips"><span className="ps-hint">Group QC / supply schedule by</span>{['All windows', 'Block', 'Flat (within block)', 'Similar windows'].map(x => <button key={x} className={'ps-chip sm' + (g === x ? ' on' : '')} onClick={() => setG(x)}>{x}</button>)}</div>
      {!sid && <div className="ps-hint">QC, supply and area reports include windows from every sub work order.</div>}
      <table className="ps-table"><thead><tr><th>No.</th><th>Title</th><th>Description</th><th>Download</th></tr></thead><tbody>{LIST.map(([t, d, op], i) => <tr key={t}><td>{i + 1}</td><td><b>{t}</b></td><td>{d}</td>
        <td>{op ? <button className="qt-btn-ghost" onClick={() => setPp(t)}>Open</button> : <div className="ps-mode">{[['pdf', 'PDF'], ['xlsx', 'Excel'], ['docx', 'Word']].map(([f, l]) => <button key={f} onClick={() => dl(base(i), `format=${f}&group=${encodeURIComponent(g)}`)}>{l}</button>)}</div>}</td></tr>)}</tbody></table>
      {pp === 'Label printing' && <Labels sid={sid} onClose={() => setPp('')} />}{pp === 'Bar optimization' && <BarOpt sid={sid} onClose={() => setPp('')} onSaved={() => {}} />}{pp === 'Saved bar plans' && <SavedPlans sid={sid} onClose={() => setPp('')} />}</div></section>
}
const CHECKS = ['Weld seams cleaned', 'Overall size within ±1 mm', 'Sash operates freely', 'Hardware fitted and locks', 'Glass and gasket seated', 'No scratches or marks']
function ShopFloor({ sid, s, locked }) {
  const [t, setT] = useState('Stock'); const [st, setSt] = useState(null); const [qc, setQc] = useState([]); const [item, setItem] = useState('all'); const [stage, setStage] = useState('post-fabrication'); const [ck, setCk] = useState([]); const [msg, setMsg] = useState('')
  const load = () => { api(`/production/subs/${sid}/stock`).then(setSt); api(`/production/subs/${sid}/qc`).then(setQc) }
  useEffect(() => { load() }, [sid])
  const rec = async row => { const v = await askText('Stock on hand: ' + row.name, row.present); if (v == null || !row.id) return; await api('/inventory/hardware/' + row.id, { method: 'PUT', body: { stock: +v } }); load() }
  const record = async () => { setMsg(''); try { const r = await api(`/production/subs/${sid}/qc`, { method: 'POST', body: { entry: item, stage, checks: ck } }); setMsg(r.passed ? `QC passed for ${r.recorded} window(s).` : `QC recorded for ${r.recorded} window(s) — tick every check to pass.`); setCk([]); load() } catch (e) { setMsg(e.message) } }
  const groups = st ? [...new Set(st.rows.map(r => r.group))] : []
  const pdf = () => dl(`/production/subs/${sid}/docs/4`, 'format=pdf'), xls = () => dl(`/production/subs/${sid}/docs/4`, 'format=xlsx')
  return <section className="qt-info-card sf-card"><div className="qt-nav-pills sf-tabs">{['Stock', 'QC', 'Dispatch'].map(x => <button key={x} className={'qt-nav-pill' + (t === x ? ' active' : '')} onClick={() => setT(x)}>{x}</button>)}</div>
    {t === 'Stock' && st && <div className="qt-card-body"><div className="sf-head"><div><h3>Material balance</h3><div className="ps-hint">Everything required for this job, the stock you have, and what to procure.</div></div><div className="sf-exp"><button className="qt-btn-ghost" onClick={pdf}>Export PDF</button><button className="qt-btn-ghost" onClick={xls}>Export Excel</button></div></div>
      <div className="sf-tiles"><div><b>{st.required}</b><span>Required items</span><i>Across all materials</i></div><div><b>{st.supplied}</b><span>Supplied items</span><i>Stock recorded for production</i></div><div><b>{st.toProcure}</b><span>To procure</span><i>Items with a purchase balance</i></div></div>
      {st.complete && <div className="wo-note">Production completed; the blocked material is consumed.</div>}
      <table className="ps-table"><thead><tr><th>MATERIAL</th><th>UNIT</th><th className="r">REQUIRED</th><th className="r">PRESENT STOCK</th><th className="r">BALANCE TO PROCURE</th><th /></tr></thead><tbody>
        {groups.map(g => [<tr key={g} className="sf-grp"><td colSpan="6"><b>{g}</b> <span className="muted">{st.rows.filter(r => r.group === g).length} items</span></td></tr>, ...st.rows.filter(r => r.group === g).map(r => <tr key={r.name}><td><b>{r.name}</b><div className="pd-sub">{r.code || '—'}</div></td><td>{r.unit}</td><td className="r">{r.required}</td><td className="r">{r.present}</td><td className="r">{r.balance}</td><td>{!locked && <button className="qt-btn-ghost" onClick={() => rec(r)}>Record stock</button>}</td></tr>)])}
        {!st.rows.length && <tr><td colSpan="6" className="ps-empty">Add windows to this sub work order to see its material balance.</td></tr>}</tbody></table></div>}
    {t === 'QC' && <div className="qt-card-body ps-form"><label className="ps-field"><span>Item</span><select value={item} onChange={e => setItem(e.target.value)}><option value="all">All windows ({s.entries.length})</option>{s.entries.map(e => <option key={e.id} value={e.id}>{e.mark} · {e.location || '—'} — {e.name} ({e.stage})</option>)}</select></label>
      <div className="ps-field"><span>Stage</span><div className="ps-chips">{['post-fabrication', 'pre-dispatch', 'post-installation'].map(x => <button key={x} className={'ps-chip sm' + (stage === x ? ' on' : '')} onClick={() => setStage(x)}>{x}</button>)}</div></div>
      <div className="sf-checks"><label><input type="checkbox" checked={ck.length === CHECKS.length} onChange={e => setCk(e.target.checked ? [...CHECKS] : [])} /> <b>Tick all</b></label>{CHECKS.map(c => <label key={c}><input type="checkbox" checked={ck.includes(c)} onChange={e => setCk(e.target.checked ? [...ck, c] : ck.filter(x => x !== c))} /> {c}</label>)}</div>
      <div><button className="qt-btn-primary" onClick={record} disabled={!s.entries.length}>Record QC</button> {msg && <span className="muted" style={{ marginLeft: 10 }}>{msg}</span>}</div>
      <div className="ps-hint">Packed needs a passing post-fabrication QC; dispatched happens from the work order status or its invoice.</div>
      {qc.length ? <table className="ps-table"><thead><tr><th>Window</th><th>Stage</th><th>Result</th><th>Recorded</th></tr></thead><tbody>{qc.map(r => <tr key={r.id}><td>{r.label}</td><td>{r.stage}</td><td>{r.passed ? 'Passed' : 'Incomplete'}</td><td>{new Date(r.created_at).toLocaleString('en-GB')}</td></tr>)}</tbody></table> : <div className="ps-empty">No QC records yet.</div>}</div>}
    {t === 'Dispatch' && <div className="qt-card-body"><div className="ps-hint">The dispatch note is made when the order reaches Production complete. The vehicle and driver are added when it is dispatched or invoiced.</div><div className="ps-empty">No dispatch notes yet.</div></div>}
  </section>
}
function QuoteTab({ designs }) {
  const [sel, setSel] = useState(null)
  return <><div className="wo-note">Designs ({designs.length}) · {designs.reduce((a, d) => a + d.quoted, 0)} windows quoted · click a design for its specification</div>
    <div className="wo-designs">{designs.map(d => <div key={d.id} className="wo-design" onClick={() => setSel(sel === d.id ? null : d.id)}><Thumb d={d} /><div><b>{d.mark}</b> <span>{d.name}</span><div className="pd-sub">{d.width} × {d.height} mm · {d.sqft} sq ft</div><div className="pd-sub">{d.glass} · {d.thickness}</div><div className="pd-sub">{d.type} · {d.system} · × {d.quoted}</div>
      {sel === d.id && <div className="wo-spec"><b>Specification</b><div>Series: {d.system}</div><div>Glass: {d.glass} ({d.thickness})</div><div>Mesh: {d.mesh}</div><div>Type: {d.type}</div></div>}</div></div>)}</div></>
}
export function WorkOrderDetail() {
  const { id } = useParams(); const nav = useNavigate(); const [w, setW] = useState(null); const [tab, setTab] = useState('Sub work orders'); const [err, setErr] = useState('')
  const load = () => api('/production/' + id).then(setW); useEffect(() => { load() }, [id])
  if (!w) return <ProdLayout kind="wo"><div className="ps-empty">Loading…</div></ProdLayout>
  const addSub = async () => { const r = await api(`/production/${id}/subs`, { method: 'POST', body: {} }); nav('/production/sub/' + r.id) }
  const del = async s => { if (await askConfirm('Delete ' + s.number + '?', 'Delete')) { try { await api('/production/subs/' + s.id, { method: 'DELETE' }); load() } catch (e) { setErr(e.message) } } }
  const notes = async () => { const n = await askText('Add notes to this work order'); if (n) { api('/production/subs/' + w.subs[0]?.id, { method: 'PUT', body: { notes: n } }).then(load) } }
  const T = k => w.designs.reduce((a, d) => a + d[k], 0)
  return <ProdLayout kind="wo"><div className="wo-page">
    <Head chip={w.number} status={<Pill s={w.status} />} title={`${w.customer} — ${w.project}`} tabs={['Sub work orders', 'Quotation', 'Documents']} tab={tab} setTab={setTab} right={<Actions id={id} wo={id} onNotes={notes} />} />
    <div className="wo-banner">This order is split into {w.subs.length} sub work order{w.subs.length === 1 ? '' : 's'}. Windows, confirmation, production, stock, QC and dispatch happen inside each sub work order.</div>
    <div className="wo-summary"><span><b style={{ fontSize: 22 }}>{w.done + w.in_process}</b> of {w.total} windows entered</span><Bar done={w.done} inp={w.in_process} total={w.total} /><span><i className="dot g" /> <b>{w.done}</b> completed</span><span><i className="dot b" /> <b>{w.in_process}</b> in process</span><span><i className="dot y" /> <b style={{ color: '#b45309' }}>{w.balance}</b> balance</span></div>
    {tab === 'Sub work orders' && <><div className="wo-sec"><h2>Sub work orders</h2><button className="qt-btn-primary" onClick={addSub}>+ New sub work order</button></div>
      {err && <div style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}
      <div className="qt-table-wrap pd-wrap"><table className="qt-table"><thead><tr><th>Sub work order</th><th>Notes</th><th className="r">Windows</th><th className="r">In process</th><th className="r">Completed</th><th className="r">Dispatched</th><th>Status</th><th /></tr></thead><tbody>
        {w.subs.map(s => <tr key={s.id}><td><button className="wo-subbtn" onClick={() => nav('/production/sub/' + s.id)}>{s.number}</button></td><td>{s.notes}</td><td className="r">{s.windows}</td><td className="r">{s.in_process}</td><td className="r">{s.completed}</td><td className="r">{s.dispatched}</td><td><Pill s={s.status} /></td><td>{s.status === 'draft' && <button className="qt-btn-ghost" onClick={() => del(s)}>Delete</button>}</td></tr>)}</tbody></table></div>
      <div className="wo-sec"><h3>Quoted, in process, completed and balance</h3></div>
      <div className="qt-table-wrap pd-wrap"><table className="qt-table"><thead><tr><th>Ref</th><th>Window</th><th className="r">Quoted</th><th className="r">In process</th><th className="r">Completed</th><th className="r">Balance</th><th className="r">Dispatched</th></tr></thead><tbody>
        {w.designs.map(d => <tr key={d.id}><td><b>{d.mark}</b></td><td>{d.name}</td><td className="r">{d.quoted}</td><td className="r">{d.in_process}</td><td className="r">{d.completed}</td><td className="r">{d.balance}</td><td className="r">{d.dispatched}</td></tr>)}
        <tr className="wo-total"><td /><td>TOTAL</td><td className="r">{T('quoted')}</td><td className="r">{T('in_process')}</td><td className="r">{T('completed')}</td><td className="r">{T('balance')}</td><td className="r">{T('dispatched')}</td></tr></tbody></table></div>
      <p className="ps-hint">In process includes windows entered in draft batches. Completed includes dispatched windows. Balance is quoted quantity not yet entered in any work order.</p>
      <p className="ps-hint">Open a sub work order for its cutting lists, stock and recorded QC. Combined QC and customer supply schedules are available in this order's Documents tab.</p></>}
    {tab === 'Quotation' && <QuoteTab designs={w.designs} />}{tab === 'Documents' && <Docs wo={id} />}
  </div></ProdLayout>
}
export function SubDetail() {
  const { sid } = useParams(); const nav = useNavigate(); const [s, setS] = useState(null); const [tab, setTab] = useState('Windows'); const [add, setAdd] = useState(null)
  const load = () => api('/production/subs/' + sid).then(setS); useEffect(() => { load() }, [sid])
  if (!s) return <ProdLayout kind="wo"><div className="ps-empty">Loading…</div></ProdLayout>
  const confirm_ = async () => { await api(`/production/subs/${sid}/confirm`, { method: 'POST' }); load() }
  const doAdd = async () => { try { await api(`/production/subs/${sid}/entries`, { method: 'POST', body: add }); setAdd(null); load() } catch (e) { say(e.message) } }
  const move = async (e, stage) => { await api('/production/entries/' + e.id, { method: 'PUT', body: { stage } }); load() }
  const rm = async e => { await api('/production/entries/' + e.id, { method: 'DELETE' }); load() }
  const counts = Object.fromEntries(s.stages.map(k => [k, s.entries.filter(e => e.stage === k).length]))
  const draft = s.status === 'draft', locked = s.status === 'dispatched'
  const notes = async () => { const n = await askText('Add notes', s.notes || ''); if (n != null) api('/production/subs/' + sid, { method: 'PUT', body: { notes: n } }).then(load) }
  return <ProdLayout kind="wo"><div className="wo-page">
    <Head back={['Production', '/production']} chip={s.number} status={<Pill s={s.status} />} title={`${s.customer} — ${s.project}`} sub={<button className="wo-parent" onClick={() => nav('/production/' + s.wo.id)}>Sub work order of {s.wo.number} ↑</button>}
      tabs={['Windows', 'Quotation', 'Shop floor', 'Documents']} tab={tab} setTab={setTab} right={<Actions wo={s.wo.id} sid={sid} onNotes={notes} extra={draft ? <button className="qt-btn-primary" onClick={confirm_}>✓ Confirm work order</button> : locked ? <><span className="wo-disp">✓ Dispatched</span><button className="qt-btn-primary" onClick={() => nav('/invoices/new?wo=' + s.wo.id)}>Convert to invoice</button></> : null} />} />
    <div className="wo-summary"><span><b style={{ fontSize: 22 }}>{s.wo.done + s.wo.in_process}</b> of {s.wo.total} windows entered</span><Bar done={s.wo.done} inp={s.wo.in_process} total={s.wo.total} /><span><i className="dot g" /> <b>{s.wo.done}</b> completed</span><span><i className="dot b" /> <b>{s.wo.in_process}</b> in process</span><span><i className="dot y" /> <b style={{ color: '#b45309' }}>{s.wo.balance}</b> balance</span><span className="pd-tag">{s.entries.length} in this order</span></div>
    {s.notes && <div className="wo-note">Notes: {s.notes}</div>}
    {tab === 'Windows' && <>
      <div className="wo-stagechips">{s.stages.map(k => <span key={k} className="wo-sc"><b>{SL[k]}</b> {counts[k]}</span>)}</div>
      <div className="wo-designs wide">{s.designs.map(d => <div key={d.id} className="wo-design col"><div className="wo-dhead"><Thumb d={d} /><div><b>{d.mark}</b> {d.name}<div className="pd-sub">{d.width} × {d.height} mm · {d.completed + d.in_process} of {d.quoted} entered</div></div></div>
        <div className="wo-qstats"><div><span>QUOTED</span><b>{d.quoted}</b></div><div><span>IN PROCESS</span><b>{d.in_process}</b></div><div><span>COMPLETED</span><b>{d.completed}</b></div><div><span>BALANCE</span><b>{d.balance}</b></div></div>
        {!locked && <div className="wo-dactions"><button className="qt-btn-ghost" disabled={!d.balance} onClick={() => setAdd({ item_id: d.id, qty: 1, location: '', name: `${d.mark} ${d.name}`, max: d.balance })}>+ Add</button><button className="qt-btn-ghost" disabled={!d.balance} onClick={() => setAdd({ item_id: d.id, qty: d.balance, location: '', name: `${d.mark} ${d.name}`, max: d.balance, bulk: true })}>Import from file</button></div>}</div>)}
        <div className="wo-design col add" onClick={() => nav(`/quotations/${s.quotation.id}/new-window`)}><span className="qt-add-icon">+</span><b>Add New Design</b><span className="pd-sub">Add a design that is not in the quotation.</span></div></div>
      <div className="wo-sec"><h3>Windows for production ({s.entries.length})</h3></div>
      <div className="wo-list">{s.entries.map(e => { const d = s.designs.find(x => x.id === e.item_id); return <div className="wo-entry" key={e.id}>{d && <Thumb d={d} />}<div style={{ flex: 1 }}><b>{e.mark} · {e.width} × {e.height} mm</b><div className="pd-sub">{e.name}</div></div>
        <select value={e.stage} disabled={locked} onChange={ev => move(e, ev.target.value)}>{s.stages.map(k => <option key={k} value={k}>{SL[k]}</option>)}</select><span className="pd-sub">📍 {e.location || '—'}</span>
        {draft && <button className="ps-pen" aria-label="Remove" onClick={() => rm(e)}>🗑</button>}</div> })}{!s.entries.length && <div className="ps-empty">No windows entered yet. Use “+ Add” on a design above.</div>}</div>
      <div className="wo-note warn">⚠ Add new design that is not in the quotation.</div></>}
    {tab === 'Quotation' && <QuoteTab designs={s.designs} />}
    {tab === 'Shop floor' && <ShopFloor sid={sid} s={s} locked={locked} />}
    {tab === 'Documents' && <Docs wo={s.wo.id} sid={sid} />}
    {add && <div className="modal-bg" onClick={() => setAdd(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380 }}><h3 style={{ marginTop: 0 }}>{add.bulk ? 'Import windows' : 'Add windows'}</h3><div className="pd-sub" style={{ marginBottom: 10 }}>{add.name} · {add.max} left to enter</div>
      <label className="ps-field"><span>Quantity</span><input type="number" min="1" max={add.max} value={add.qty} onChange={e => setAdd({ ...add, qty: e.target.value })} /></label><label className="ps-field" style={{ marginTop: 10 }}><span>Location (block / flat)</span><input value={add.location} onChange={e => setAdd({ ...add, location: e.target.value })} placeholder="e.g. 101/6" /></label>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="qt-btn-primary" onClick={doAdd}>Add</button><button className="qt-btn-ghost" onClick={() => setAdd(null)}>Cancel</button></div></div></div>}
  </div></ProdLayout>
}
