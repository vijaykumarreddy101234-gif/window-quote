import { useEffect, useState } from 'react'
import { api, token, saveBlob, downloadFile } from '../api'
import { say, askText, askConfirm } from '../dialog'
const BASE = '/api/v1/app'
async function postFile(path, body, name) {
  const res = await fetch(BASE + path, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(body || {}) })
  if (!res.ok) { const e = await res.json().catch(() => ({})); return say(e.error || 'Download failed') }
  const cd = res.headers.get('Content-Disposition') || '', m = /filename="?([^";]+)"?/.exec(cd)
  saveBlob(await res.blob(), m ? m[1] : name)
}
const Barcode = ({ bits, h = 26 }) => { const r = []; let i = 0; while (i < bits.length) { if (bits[i] === '1') { let j = i; while (j < bits.length && bits[j] === '1') j++; r.push(<rect key={i} x={i} y="0" width={j - i} height={h} fill="#000" />); i = j } else i++ } return <svg viewBox={`0 0 ${bits.length} ${h}`} preserveAspectRatio="none" style={{ width: '100%', maxWidth: 190, height: h }}>{r}</svg> }
const Shell = ({ title, onClose, children }) => <div className="modal-bg" onClick={onClose}><div className="modal pp-panel" onClick={e => e.stopPropagation()}><div className="pp-head"><h3>{title}</h3><button className="qt-btn-ghost" onClick={onClose}>×</button></div>{children}</div></div>

export function Labels({ sid, onClose }) {
  const [d, setD] = useState(null), [b, setB] = useState(1), [fmt, setFmt] = useState('a4'), [win, setWin] = useState(''), [plan, setPlan] = useState(''), [plans, setPlans] = useState([])
  useEffect(() => { api(`/production/subs/${sid}/bar-plans`).then(setPlans) }, [sid])
  useEffect(() => { api(`/production/subs/${sid}/labels?batch=${b}${win ? '&win=' + encodeURIComponent(win) : ''}${plan ? '&plan=' + plan : ''}`).then(setD) }, [sid, b, win, plan])
  const F = d && d.formats.find(x => x.key === fmt)
  return <Shell title="Label printing" onClose={onClose}>{d && <>
    <div className="pp-bar"><b>Labels {d.from}–{d.to} of {d.total}</b><span className="ps-hint">Printing this tab prints only this identified batch.</span></div>
    <div className="pp-actions"><button className="qt-btn-primary" onClick={() => postFile(`/production/subs/${sid}/labels.pdf`, { batch: b, format: fmt, plan }, 'labels.pdf')}>Print / save batch PDF</button>
      <button className="qt-btn-ghost" onClick={() => postFile(`/production/subs/${sid}/labels.pdf`, { all: true, format: fmt, plan }, 'labels.pdf')}>Download all stickers (cutting order)</button>
      <button className="qt-btn-ghost" disabled={b <= 1} onClick={() => setB(b - 1)}>Previous batch</button><button className="qt-btn-ghost" disabled={b >= d.batches} onClick={() => setB(b + 1)}>Next batch</button></div>
    <div className="pp-row"><label>Label format<select value={fmt} onChange={e => setFmt(e.target.value)}>{d.formats.map(f => <option key={f.key} value={f.key}>{f.name}</option>)}</select></label>
      <label>Window<select value={win} onChange={e => { setWin(e.target.value); setB(1) }}><option value="">All windows</option>{d.marks.map(m => <option key={m}>{m}</option>)}</select></label></div>
    <div className="pp-card"><b>Label dimensions and alignment</b><div>{F && F.note}</div><div className="ps-hint">Print PDF at actual size / 100%. Disable fit to page. Check the 20 mm calibration line before using adhesive stock.</div><button className="qt-btn-ghost" onClick={() => downloadFile(`/production/subs/${sid}/labels-alignment.pdf?format=${fmt}`, 'alignment.pdf')}>Download alignment PDF</button></div>
    <div className="pp-row"><label>Label plan source<select value={plan} onChange={e => setPlan(e.target.value)}><option value="">No saved allocation (bar mapping unavailable)</option>{plans.map(p => <option key={p.id} value={p.id}>{p.name}</option>)}</select></label></div><div className="ps-hint">Cut ends: 45° mitre · 90° square/mechanical · V-notch · ? pending and blocked from label release.</div>
    <div className="pp-labels">{d.labels.map((l, i) => <div key={i} className="pp-label"><small>{l.wo}</small><b>{l.member}</b><span>{l.customer}</span><span>{l.win}</span><span>{l.name}</span>{l.bar && <span>{l.bar}</span>}<strong>Size - {l.len} mm</strong><Barcode bits={l.bits} /><small>{l.sn}</small></div>)}</div></>}</Shell>
}

export function BarOpt({ sid, onClose, onSaved }) {
  const [c, setC] = useState(null), [p, setP] = useState(null), [busy, setBusy] = useState(false), [plans, setPlans] = useState([]), [src, setSrc] = useState('')
  const load = () => { api(`/production/subs/${sid}/bar-settings`).then(setC); api(`/production/subs/${sid}/bar-plans`).then(setPlans) }
  const pick = async v => { setSrc(v); if (!v) return setP(null); const r = await api(`/production/subs/${sid}/bar-plans/${v}`); setP(r); setC(x => ({ ...x, ...r.cfg })) }
  const preview = async cfg => { setBusy(true); try { setP(await api(`/production/subs/${sid}/cutting-plan`, { method: 'POST', body: { cfg } })) } finally { setBusy(false) } }
  useEffect(() => { load() }, [sid])
  if (!c) return <Shell title="Bar optimization" onClose={onClose} />
  const set = (k, v) => setC({ ...c, [k]: v }), cfg = { kerf: +c.kerf, trim: +c.trim, reuse: +c.reuse, bar: +c.bar, offcuts: c.offcuts }
  const save = async () => { const r = await api(`/production/subs/${sid}/bar-settings`, { method: 'PUT', body: cfg }); setC(r) }
  const addOff = async () => { const code = await askText('Profile code of the offcut'); if (!code) return; const len = await askText('Offcut length (mm)'); if (!len) return; set('offcuts', [...c.offcuts, { code, len: +len, qty: 1 }]) }
  const S = p && p.summary
  return <Shell title="Bar optimization" onClose={onClose}>
    <div className="pp-card"><b>Cutting plan</b><div className="ps-hint">Assumed full bars plus optional measured offcuts. This is a planning estimate, not an inventory reservation, CNC file or optimality claim.</div><div className="ps-hint">Settings revision {c.revision}</div></div>
    <div className="pp-row"><label>Plan source<select value={src} onChange={e => pick(e.target.value)}><option value="">Provisional (recompute)</option>{plans.map(x => <option key={x.id} value={x.id}>Saved · {x.name}</option>)}</select></label><label>Bar length (mm)<input type="number" value={c.bar} onChange={e => set('bar', e.target.value)} /></label><label>Kerf (mm)<input type="number" value={c.kerf} onChange={e => set('kerf', e.target.value)} /></label><label>End trim (mm)<input type="number" value={c.trim} onChange={e => set('trim', e.target.value)} /></label><label>Reusable threshold (mm)<input type="number" value={c.reuse} onChange={e => set('reuse', e.target.value)} /></label></div>
    <div className="pp-actions"><button className="qt-btn-ghost" onClick={save}>Save settings</button><button className="qt-btn-ghost" onClick={addOff}>+ Measured offcut</button></div>
    <div className="pp-bar"><b>Measured offcuts ({c.offcuts.length})</b></div>{c.offcuts.map((o, i) => <div key={i} className="pp-off">{o.code} · {o.len} mm × {o.qty} <button className="qt-btn-ghost" onClick={() => set('offcuts', c.offcuts.filter((_, j) => j !== i))}>Remove</button></div>)}
    <div className="pp-actions"><button className="qt-btn-primary" disabled={busy} onClick={() => { setSrc(''); preview(cfg) }}>{busy ? 'Calculating…' : 'Preview plan'}</button><button className="qt-btn-ghost" onClick={() => postFile(`/production/subs/${sid}/cutting-plan.pdf`, { cfg }, 'plan.pdf')}>Download PDF</button><button className="qt-btn-ghost" onClick={() => postFile(`/production/subs/${sid}/cutting-plan.xlsx`, { cfg }, 'plan.xlsx')}>Download Excel</button>
      {p && <button className="qt-btn-ghost" onClick={async () => { const name = await askText('Name for this saved plan', `Plan ${new Date().toLocaleDateString()}`); if (!name) return; await api(`/production/subs/${sid}/bar-plans`, { method: 'POST', body: { name, cfg } }); onSaved && onSaved(); say('Plan saved — see Saved bar plans.') }}>Save plan</button>}</div>
    {p && <><div className="ps-hint">provisional · No saved allocation · Source fingerprint: {p.fingerprint}</div><div className="ps-hint">Provisional plan: assumed full bars and supplied measured references; no inventory reservation. Recompute may change; compare the source fingerprint.</div>
      <div className="sf-tiles"><div><b>{S.bars}</b><span>Bars</span></div><div><b>{S.placed}</b><span>Placed cuts</span></div><div><b>{S.unplaced}</b><span>Unplaced groups</span></div><div><b>{S.irrecoverable}%</b><span>Irrecoverable</span></div><div><b>{S.utilization}%</b><span>Utilization</span></div><div><b>{S.reusable}%</b><span>Reusable</span></div></div>
      <PlanTable bars={p.bars} /></>}</Shell>
}
const Mitre = () => <div className="pp-mitre" />
const PlanTable = ({ bars }) => <div className="pp-scroll pp-bars">{bars.map((b, i) => { const tot = b.len, used = b.cuts.reduce((a, c) => a + c.len, 0) + b.cuts.length * 0; return <div key={i} className="pp-bar-row">
  <div className="pp-bar-h"><b>Bar {i + 1}</b><span>{b.code} · {b.name} · {b.source === 'Measured offcut' ? `Offcut ${b.len} mm` : `New bar ${b.len} mm`}</span><span>Rest {b.rest || 0} mm · Waste {b.waste} mm</span></div>
  <div className="pp-bar-track">{b.cuts.map((c, k) => <div key={k} className="pp-piece" style={{ width: `${c.len / tot * 100}%` }}><Mitre w={100} len={c.len} /><b>{c.len}</b><i className="a l">45°</i><i className="a r">45°</i></div>)}{b.remainder > 0 && <div className={'pp-rest' + (b.rest ? ' keep' : '')} style={{ width: `${b.remainder / tot * 100}%` }}>{b.rest ? `Rest ${b.rest}` : ''}</div>}</div>
  <div className="pp-bar-cap">{b.cuts.map((c, k) => <div key={k} style={{ width: `${c.len / tot * 100}%` }}><b>{k + 1}) {c.win}</b>{c.dim && <em>{c.dim}</em>}<span>{c.pos}</span>{c.loc && <span>{c.loc}</span>}</div>)}</div></div> })}</div>
const PlanTableOld = ({ bars }) => <div className="pp-scroll"><table className="ps-table"><thead><tr><th>Bar</th><th>Source</th><th>Identity</th><th>Length</th><th>Cuts</th><th>Remainder</th></tr></thead><tbody>{bars.map((b, i) => <tr key={i}><td>{i + 1}</td><td>{b.source}</td><td>{b.code} · {b.name}</td><td>{b.len} mm</td><td title={b.cuts.map(c => c.len).join(' + ')}>{b.cuts.length}: {b.cuts.map(c => c.len).join(' + ')}</td><td>{b.remainder} mm</td></tr>)}</tbody></table></div>

export function SavedPlans({ sid, onClose }) {
  const [l, setL] = useState(null), [v, setV] = useState(null)
  const load = () => api(`/production/subs/${sid}/bar-plans`).then(setL)
  useEffect(() => { load() }, [sid])
  const del = async id => { if (await askConfirm('Delete this saved plan?', 'Delete')) { await api(`/production/subs/${sid}/bar-plans/${id}`, { method: 'DELETE' }); setV(null); load() } }
  return <Shell title="Saved bar plans" onClose={onClose}>
    {l && !l.length && <div className="ps-hint">No saved plans yet. Open Bar optimization, preview a plan and choose Save plan.</div>}
    {l && l.length > 0 && <table className="ps-table"><thead><tr><th>Name</th><th>Saved</th><th>Bars</th><th>Utilization</th><th></th></tr></thead><tbody>{l.map(r => <tr key={r.id}><td><b>{r.name}</b></td><td>{new Date(r.created_at).toLocaleString()}</td><td>{r.summary.bars}</td><td>{r.summary.utilization}%</td>
      <td><div className="ps-mode"><button onClick={async () => setV(await api(`/production/subs/${sid}/bar-plans/${r.id}`))}>View</button><button onClick={() => downloadFile(`/production/subs/${sid}/bar-plans/${r.id}/pdf`, 'plan.pdf')}>PDF</button><button onClick={() => downloadFile(`/production/subs/${sid}/bar-plans/${r.id}/xlsx`, 'plan.xlsx')}>Excel</button><button onClick={() => del(r.id)}>Delete</button></div></td></tr>)}</tbody></table>}
    {v && <><div className="pp-bar"><b>{v.name}</b>{v.stale && <span className="wo-note">Work order cuts changed since this plan was saved — recompute in Bar optimization.</span>}</div><PlanTable bars={v.bars} /></>}</Shell>
}
