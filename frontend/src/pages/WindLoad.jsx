import { useEffect, useState } from 'react'
import { api, downloadFile, token } from '../api'
import { saveBlob } from '../api'

const QUICK = [1.5, 1.8, 2.4, 3.4]
const ENV = [['inland', 'Inland / level ground — away from the coast and hills'], ['coastal', 'Coastal — exposed to the sea or shoreline'], ['hills', 'Hills / ridge / escarpment — elevated or sloping terrain'], ['coastal-hills', 'Coastal and hilly — both exposures apply']]
const DEV = [['open', 'Open — sea, fields or clear ground with few obstructions'], ['scattered', 'Scattered — isolated trees and low buildings'], ['suburban', 'Suburban — closely spaced low or medium buildings'], ['dense', 'Dense urban — many closely spaced tall buildings']]
const POS = [['middle', 'Middle — within the main wall area'], ['edge', 'Edge — close to a wall or roof edge'], ['corner', 'Corner — close to two meeting building faces']]
const BLANK = { method: 'specified', pressure_kpa: 1.5, city_id: '', environment: '', development: '', building_height: '', elevation: '', position: '', design_life: '', wall: '' }

export default function WindLoad({ id, q }) {
  const [data, setData] = useState(null), [sel, setSel] = useState(null), [cfg, setCfg] = useState(BLANK), [res, setRes] = useState(null), [busy, setBusy] = useState(false), [err, setErr] = useState('')
  useEffect(() => { api(`/quotations/${id}/wind-load`).then(d => { setData(d); if (d.windows[0]) pick(d.windows[0], d) }) }, [id])
  const pick = (w, d = data) => { setSel(w); setCfg({ ...BLANK, ...(w.config || {}) }); setRes(null); setErr('') }
  if (!data) return <p className="muted">Loading…</p>
  const set = (k, v) => setCfg(c => ({ ...c, [k]: v })), w = sel
  const site = cfg.method === 'site', ready = !site || (cfg.city_id && cfg.environment && cfg.development && +cfg.building_height > 0 && cfg.position && cfg.design_life)
  const calc = async () => { setBusy(true); setErr(''); try { setRes(await api(`/quotations/${id}/wind-load/${w.id}`, { method: 'POST', body: cfg })) } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  const pdf = async () => { setBusy(true); setErr(''); try {
    const r = await fetch(`/api/v1/app/quotations/${id}/wind-load/${w.id}/pdf`, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token() }, body: JSON.stringify(cfg) })
    if (!r.ok) throw new Error('Could not generate the PDF'); await saveBlob(await r.blob(), `${q.number}-${w.design_ref}-wind-load.pdf`); setRes(await api(`/quotations/${id}/wind-load/${w.id}`, { method: 'POST', body: cfg }))
  } catch (e) { setErr(e.message) } finally { setBusy(false) } }
  return <div className="card wl">
    <h3>Wind-load analysis <span className="qx-dev">Under development</span></h3>
    <div className="wl-warn"><b>Under development.</b> Wind-load analysis is still being tested against qualified engineers’ calculations. Have a structural engineer check the results before you give them to a customer or use them for approval.</div>
    <p className="muted">Select a window to generate its individual wind-load PDF.</p>
    <div className="wl-grid">{data.windows.map(x => <button key={x.id} className={'wl-card' + (w && w.id === x.id ? ' on' : '')} onClick={() => pick(x)}><small>{x.design_ref}</small><b>{x.name}</b><span>{x.width_mm} × {x.height_mm} mm</span><em>{w && w.id === x.id ? 'Selected window →' : 'Analyse window →'}</em></button>)}</div>
    {w && <div className="wl-panel">
      <div className="wl-head"><span className="qx-tag">{w.design_ref}</span><b>{w.name}</b><small className="muted">One window · One PDF</small></div>
      <h4>Theoretical wind-load calculation</h4><p className="muted">Theoretical calculation only. Each method reports its own assessed scope and outstanding checks.</p>
      <p className="muted">Generation saves these analysis inputs for this window. Your quotation and production status stay unchanged.</p>
      <div className="wl-sec"><h5>Pressure and calculation policy</h5>
        <div className="lab">Quick pick:</div><div className="wl-quick">{QUICK.map(k => <button key={k} className={'opt inl' + (cfg.method === 'specified' && +cfg.pressure_kpa === k ? ' on' : '')} onClick={() => setCfg(c => ({ ...c, method: 'specified', pressure_kpa: k }))}>{k} kPa</button>)}</div>
        <label>Wind pressure to check (kPa)<input type="number" step="0.1" min="0.1" value={cfg.pressure_kpa} disabled={site} onChange={e => set('pressure_kpa', e.target.value)} /></label>
        <div className="lab">Pressure method</div>
        <label className="wl-radio"><input type="radio" checked={!site} onChange={() => set('method', 'specified')} />Enter a specified test pressure</label>
        <label className="wl-radio"><input type="radio" checked={site} onChange={() => set('method', 'site')} />Calculate from sourced IS 875 site inputs</label>
        <p className="muted">Specified test demand, not the window capacity. By default the same magnitude is checked as positive pressure and negative suction at service load.</p></div>
      <details className="wl-adv" open={site}><summary>Advanced pressure options</summary>
        <label>City / project location<select value={cfg.city_id} onChange={e => set('city_id', e.target.value)}><option value="">Choose a city</option>{data.site_cities.map(c => <option key={c.id} value={c.id}>{c.name} — {c.basic_wind_speed_ms} m/s</option>)}</select></label>
        <label>Environment<select value={cfg.environment} onChange={e => set('environment', e.target.value)}><option value="">Choose the project environment</option>{ENV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Surrounding development<select value={cfg.development} onChange={e => set('development', e.target.value)}><option value="">Choose the surrounding development</option>{DEV.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <div className="wl-2"><label>Building height (m)<input type="number" min="3" value={cfg.building_height} onChange={e => set('building_height', e.target.value)} /></label><label>Selected-window elevation (m)<input type="number" min="0" value={cfg.elevation} onChange={e => set('elevation', e.target.value)} /></label></div>
        <label>Window position on façade<select value={cfg.position} onChange={e => set('position', e.target.value)}><option value="">Choose the window position</option>{POS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select></label>
        <label>Design life<select value={cfg.design_life} onChange={e => set('design_life', e.target.value)}><option value="">Choose the project design life</option>{[5, 25, 50, 100].map(y => <option key={y} value={y}>{y} years</option>)}</select></label>
        <p className="muted">Design life sets the risk / return-period basis when site pressure is calculated. It does not scale a supplied test pressure. These answers record the site and window location. They never change a pressure you entered.</p></details>
      <div className="wl-sec"><label>Wall the window is fixed into<select value={cfg.wall} onChange={e => set('wall', e.target.value)}><option value="">Not asked yet — RCC / concrete is assumed</option>{data.walls.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select></label>
        {cfg.wall === 'other' && <label>Fixing recommended load (kN)<input type="number" step="0.05" value={cfg.fixing_capacity_kn || ''} onChange={e => set('fixing_capacity_kn', e.target.value)} /></label>}
        <p className="muted">Ask the customer which wall the window goes into. The report checks each 8 × 100 mm fixing against the recommended load for that wall.</p></div>
      <div className="wl-sec"><h5>Your quoted window</h5>{w.members.filter((m, i, a) => a.findIndex(z => z.code === m.code && z.role === m.role) === i).map(m => <div className="kv" key={m.role + m.code}><span>{m.code} · {m.role.toLowerCase()}</span><b>{m.name}</b></div>)}<div className="kv"><span>Glass</span><b>{w.glass}</b></div></div>
      {err && <div className="err-banner">{err}</div>}
      {!ready && <p className="muted">Fill every site input to calculate from IS 875.</p>}
      <div className="wl-act"><button className="btn ghost" disabled={busy || !ready} onClick={calc}>Calculate</button><button className="btn" disabled={busy || !ready} onClick={pdf}>{busy ? 'Working…' : 'Generate PDF'}</button></div>
      {res && <div className="wl-res"><h5>Result — {res.pressure_kpa} kPa · <span className={res.overall === 'pass' ? 'ok' : 'bad'}>{res.overall === 'pass' ? 'All checks pass' : 'One or more checks fail'}</span></h5>
        {res.site && <details><summary>How the site pressure was calculated</summary>{res.site.map(s => <div className="kv" key={s[0]}><span>{s[0]}</span><b>{s[1]}</b></div>)}</details>}
        <table><thead><tr><th>Check</th><th>Demand</th><th>Limit</th><th>Result</th></tr></thead><tbody>{res.checks.map(c => <tr key={c.name}><td>{c.name}<br /><small className="muted">{c.basis}</small></td><td>{c.demand}</td><td>{c.limit}</td><td><span className={'wl-pill ' + c.status}>{c.status === 'pass' ? 'Pass' : c.status === 'fail' ? 'Fail' : 'Info'}</span></td></tr>)}</tbody></table></div>}
    </div>}
  </div>
}
