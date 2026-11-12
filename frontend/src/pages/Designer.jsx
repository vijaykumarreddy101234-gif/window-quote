import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, inr2 } from '../api'
import { WindowSvg, getDesign } from '../WindowSvg'
import { Window3D } from '../Window3D'
import { DesignThumb } from '../DesignThumb'
import { profileImg } from '../profileImg'
import { buildDxf, parseDxf } from '../dxf.mjs'
import { saveBlob } from '../api'
import { say } from '../dialog'
import { defaults as instDefaults, qty as instQty, formula as instFormula } from '../installMap'
import { DesignAssist } from '../DesignAssist'
import { TEMPLATES, GALLERY, GROUPS, badge, WINDOW_COLORS, HW_FINISH, SHAPES } from '../templates'

const LEFT = ['designs', 'divide', 'shapes', 'colors'], RIGHT = ['inspect', 'hardware', 'glazing', 'pricing']
const TABS = ['designs', 'divide', 'shapes', 'colors', 'inspect', 'hardware', 'glazing', 'pricing']
const Ic = ({ k }) => {
  const p = { width: 64, height: 40, viewBox: '0 0 64 40', fill: 'none', stroke: '#111827', strokeWidth: 3, strokeLinejoin: 'round' }
  if (k === 'mullion') return <svg {...p}><rect x="12" y="4" width="40" height="32" rx="3" /><path d="M32 4v32" /></svg>
  if (k === 'transom') return <svg {...p}><rect x="12" y="4" width="40" height="32" rx="3" /><path d="M12 20h40" /></svg>
  if (k === 'couplerh') return <svg {...p}><rect x="10" y="4" width="20" height="32" rx="3" /><rect x="34" y="4" width="20" height="32" rx="3" /></svg>
  if (k === 'couplerv') return <svg {...p}><rect x="12" y="3" width="40" height="15" rx="3" /><rect x="12" y="22" width="40" height="15" rx="3" /></svg>
  if (k === 'mirror') return <svg {...p}><path d="M32 4v32M24 12 10 20l14 8zM40 12l14 8-14 8z" /></svg>
  if (k === 'georgian') return <svg {...p}><rect x="12" y="4" width="40" height="32" rx="3" /><path d="M25 4v32M38 4v32M12 14h40M12 26h40" /></svg>
  return null
}
const Sheet = ({ title, onClose, children }) => <div className="sheet"><div className="sheet-h"><b>{title}</b><button className="x" onClick={onClose} aria-label="Close">✕</button></div><div className="sheet-b">{children}</div></div>
const Radios = ({ label, opts, val, on, star }) => <div className="hwgrp"><div className="lab">{label}{star ? ' *' : ''}</div>{opts.map(o => <button key={o} className={'opt' + ((val ?? opts[0]) === o ? ' on' : '')} onClick={() => on(o)}>{o}</button>)}</div>

const ShapeIcon = ({ v, on }) => { const c = on ? '#2563eb' : '#111827', P = { rect: 'M6 6H34V30H6Z', arch: 'M6 30V16Q6 4 20 4Q34 4 34 16V30Z', half: 'M6 30V20A14 14 0 0 1 34 20V30Z', multi: 'M6 30V14L20 4L34 14V30Z', corner: 'M4 28L20 6L36 28', splay: 'M4 28L12 8H28L36 28', box: 'M8 28V8H32V28' }[v] || 'M6 6H34V30H6Z'
  return <svg width="40" height="34" viewBox="0 0 40 34" fill={v === 'rect' && on ? '#dbeafe' : 'none'} stroke={c} strokeWidth="2.2" strokeLinejoin="round" style={{ display: 'block', margin: '0 auto 4px' }}><path d={P} /></svg> }
export default function Designer() {
  const { id, itemId } = useParams(); const nav = useNavigate()
  const [d, setD] = useState(null); const [mode, setMode] = useState(new URLSearchParams(location.search).get('mode')||'2d'); const [side, setSide] = useState('inside'); const [src, setSrc] = useState('live')
  const [zoom, setZoom] = useState(1); const [pan, setPan] = useState([0, 0]); const [hand, setHand] = useState(false); const [view, setView] = useState('table')
  const [qs, setQs] = useState(''); const [dsn, setDsn] = useState(null); const [size, setSize] = useState([0, 0]); const [qty, setQty] = useState(1)
  const [bayEd, setBayEd] = useState(null); const [hwBrands, setHwBrands] = useState([]); const [tool, setTool] = useState(null); const [sel, setSel] = useState(null); const [hist, setHist] = useState([]); const [fut, setFut] = useState([]); const [note, setNote] = useState(''); const [noteOpen, setNoteOpen] = useState(false)
  const [profs, setProfs] = useState({}); const [live, setLive] = useState(null); const [glasses, setGlasses] = useState([]); const [glassName, setGlassName] = useState(''); const [msg, setMsg] = useState(''); const [adv, setAdv] = useState(false); const [shape, setShape] = useState('rect'); const [custom, setCustom] = useState({ name: '', color: '#888888' }); const [help, setHelp] = useState(false); const [dv, setDv] = useState(null)
  const load = () => api(`/quotations/${id}/items/${itemId}/engine`).then(r => { setD(r); setDsn(getDesign(r.item)); setSize([r.item.width, r.item.height]); setQty(r.item.qty); setGlassName(r.item.glass) })
  useEffect(() => { load(); api(`/quotations/${id}`).then(q => setQs(q.status)); api('/glass').then(g => setGlasses(Array.isArray(g) ? g : [])).catch(() => {}); api('/inventory/hardware').then(h => setHwBrands([...new Set((Array.isArray(h) ? h : (h.rows || [])).map(x => x.brand).filter(Boolean))])).catch(() => {}); api('/profiles').then(p => setProfs(Object.fromEntries((Array.isArray(p) ? p : []).map(x => [x.code, x.description])))).catch(() => {}) }, [id, itemId])
  useEffect(() => {
    if (!d || !dsn || qs !== 'draft') return
    const h = setTimeout(() => { api(`/quotations/${id}/items/${itemId}/preview`, { method: 'POST', body: { design: dsn, width: size[0], height: size[1], glass: glassName, qty } }).then(r => setLive(r.engine)).catch(() => {}) }, 250)
    return () => clearTimeout(h)
  }, [dsn, size, glassName, qty, qs, d])
  if (!d || !dsn) return <div className="card" style={{ padding: 24 }}>Loading design… <button className="btn ghost sm" onClick={() => nav(`/quotations/${id}`)}>Back to quotation</button></div>
  const edit = qs === 'draft'
  const it0 = d.item, e = (live && (hist.length || size[0] !== it0.width || size[1] !== it0.height || glassName !== it0.glass || live.error)) ? live : d.engine
  const it = { ...it0, width: size[0], height: size[1], design: dsn }
  const push = nd => { setHist(h => [...h, dsn]); setFut([]); setDsn(nd) }
  const undo = () => { if (!hist.length) return; setFut(f => [dsn, ...f]); setDsn(hist[hist.length - 1]); setHist(h => h.slice(0, -1)) }
  const redo = () => { if (!fut.length) return; setHist(h => [...h, dsn]); setDsn(fut[0]); setFut(f => f.slice(1)) }
  const typeOf = x => x.kind === 'sliding' ? (x.fixedTop ? 'combination' : 'sliding') : (x.cols.length > 1 || x.cols.some(c => c.rows.length > 1) ? (x.cols.every(c => c.rows.every(r => r.op === 'FIXED')) ? 'fixed' : 'combination') : x.cols[0].rows[0].op === 'FIXED' ? 'fixed' : 'casement')
  const save = async () => {
    setMsg('Saving…')
    try {
      const r = await api(`/quotations/${id}/items/${itemId}/design`, { method: 'PUT', body: { design: dsn, width: size[0], height: size[1], qty, type: typeOf(dsn), mesh: dsn.mesh ? (dsn.meshType || 'SS mesh') : 'No mesh', glass: glassName } })
      if (!r || r.error) throw new Error((r && r.error) || 'Save failed')
      setD(r); setHist([]); setFut([]); setMsg('Saved'); setTimeout(() => setMsg(''), 1800)
    } catch (err) { setMsg(''); say('Could not save the design: ' + (err.message || err) + '. Please try again.') }
  }
  const grid = dsn.kind === 'grid', cells = grid ? dsn.cols.flatMap(c => c.rows) : []
  const setOp = op => { if (sel == null || !grid) return; let i = 0; push({ ...dsn, cols: dsn.cols.map(c => ({ ...c, rows: c.rows.map(r => (i++ === sel ? { ...r, op } : r)) })) }) }
  const addCol = (coupler) => push(grid ? { ...dsn, cols: [...dsn.cols, { w: 1, rows: [{ h: 1, op: 'FIXED' }] }] } : { ...dsn, panels: Math.min(4, (dsn.panels || 2) + 1) })
  const addRow = () => { if (!grid) return; let ci = 0, i = 0; dsn.cols.forEach((c, k) => c.rows.forEach(() => { if (i++ === (sel ?? 0)) ci = k })); push({ ...dsn, cols: dsn.cols.map((c, k) => k === ci ? { ...c, rows: [...c.rows, { h: 1, op: 'FIXED' }] } : c) }) }
  const mirror = () => { if (!grid) return push({ ...dsn, meshSide: dsn.meshSide === 'left' ? 'right' : 'left' }); const f = o => o === 'LH' ? 'RH' : o === 'RH' ? 'LH' : o; push({ ...dsn, cols: [...dsn.cols].reverse().map(c => ({ ...c, rows: c.rows.map(r => ({ ...r, op: f(r.op) })) })) }) }
  const locate = idx => { let i = 0; for (let ci = 0; ci < dsn.cols.length; ci++) for (let ri = 0; ri < dsn.cols[ci].rows.length; ri++) { if (i++ === idx) return [ci, ri] } return [0, 0] }
  const clampF = f => Math.min(0.8, Math.max(0.2, f))
  const onCell = (idx, fx, fy) => {
    if (!dv || !edit) return
    const axis = dv === 'mullion' ? 'V' : 'H', ratio = clampF(axis === 'V' ? (side === 'outside' ? 1 - fx : fx) : fy)
    // partition inside a sliding sash: one mullion (V) or transom (H) welded into the sash, glass split in two (as the demo's sash partitions)
    if (!grid) { const cur = (dsn.sashSplit || {})[idx]; const ss = { ...(dsn.sashSplit || {}) }; if (cur && cur.axis === axis) delete ss[idx]; else ss[idx] = { axis, ratio: Math.round(ratio * 100) / 100 }; push({ ...dsn, sashSplit: ss }); setDv(null); setSel(null); return }
    const [ci, ri] = locate(idx), c = dsn.cols[ci]
    const row = c.rows[ri], opening = row.op !== 'FIXED' && row.op !== 'LOUVRE' && row.op !== 'FAN'
    if (opening) { // partition inside a casement / top-hung / door sash
      const cur = row.split, split = cur && cur.axis === axis ? undefined : { axis, ratio: Math.round(ratio * 100) / 100 }
      push({ ...dsn, cols: dsn.cols.map((cc, k) => k === ci ? { ...cc, rows: cc.rows.map((r, j) => j === ri ? { ...r, split } : r) } : cc) }); setDv(null); setSel(null); return
    }
    if (dv === 'mullion') {
      const f = clampF(side === 'outside' ? 1 - fx : fx), keep = c.rows.map(r => ({ ...r })), left = c.rows.map(r => ({ ...r, op: 'FIXED' }))
      push({ ...dsn, cols: [...dsn.cols.slice(0, ci), { w: c.w * f, rows: left }, { w: c.w * (1 - f), rows: keep }, ...dsn.cols.slice(ci + 1)] })
    } else {
      const f = clampF(fy), r = c.rows[ri]
      push({ ...dsn, cols: dsn.cols.map((cc, k) => k === ci ? { ...cc, rows: [...cc.rows.slice(0, ri), { h: r.h * f, op: 'FIXED' }, { h: r.h * (1 - f), op: r.op }, ...cc.rows.slice(ri + 1)] } : cc) })
    }
    setDv(null); setSel(null)
  }
  const rescale = (arr, i, mm, total) => { const cur = arr.map(x => x * total / arr.reduce((a, b) => a + b, 0)); const rest = total - mm, others = cur.reduce((a, b, k) => a + (k === i ? 0 : b), 0); if (rest <= 0 || others <= 0) return arr; return cur.map((x, k) => k === i ? mm : x * rest / others) }
  const onDim = (key, mm) => {
    if (!edit) return
    if (key === 'W') return setSize([mm, size[1]])
    if (key === 'H') return setSize([size[0], mm])
    if (!grid) return
    if (key.startsWith('cw')) { const i = +key.slice(2); if (dsn.cols.length < 2) return; const w = rescale(dsn.cols.map(c => c.w), i, mm, size[0]); return push({ ...dsn, cols: dsn.cols.map((c, k) => ({ ...c, w: w[k] })) }) }
    const i = key === 'rest' ? dsn.cols[0].rows.length - 1 : +key.slice(1), n0 = dsn.cols[0].rows.length
    if (n0 < 2) return
    const h = rescale(dsn.cols[0].rows.map(r => r.h), i, mm, size[1]); push({ ...dsn, cols: dsn.cols.map(c => c.rows.length === n0 ? { ...c, rows: c.rows.map((r, k) => ({ ...r, h: h[k] })) } : c) })
  }
  const exportDxf = async () => { const dx = buildDxf({ mark: it.mark, name: it.name, width: size[0], height: size[1], design: dsn, glass: glassName }); await saveBlob(new Blob([dx], { type: 'application/dxf' }), (it.mark || 'window') + '.dxf') }
  const importDxf = ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; const rd = new FileReader(); rd.onload = () => { try { const r = parseDxf(rd.result); push(r.design); setSize([r.width, r.height]); say(`DXF imported: ${r.width} × ${r.height} mm, ${r.notes}. Pick each pane's opening in INSPECT, then Save.`) } catch (e) { say(e.message) } }; rd.readAsText(f) }
  const hw = (pane, key, val) => push({ ...dsn, hw: { ...(dsn.hw || {}), [pane]: { ...((dsn.hw || {})[pane] || {}), [key]: val } } })
  const issues = []
  if (glassName && glasses.length && !glasses.some(g => g.name === glassName)) issues.push(`glass ${glassName.split(' ')[0]} mm has no tenant rate; priced at the default glass rate (Settings → Pricing → Glass)`)
  const engErr = e && e.error
  const panes = dsn.kind === 'sliding' ? Array.from({ length: dsn.panels || 2 }, (_, i) => `S${i + 1}`) : cells.map((c, i) => `C${i + 1}`)
  const door = !!dsn.door
  const allFixed = dsn.kind === 'grid' && cells.length > 0 && cells.every(c => c.op === 'FIXED')
  const sub = e ? `${e.area} sq ft window · ${e.kg} kg profile${e.kg ? ` (${Math.round(e.area * 0.092903 / e.kg * 1000)} m²/t)` : ''} · ${e.glassArea} sq ft glass · Qty ${qty}` : `${it.area} sq ft window · Qty ${qty}`
  const dirty = hist.length > 0 || size[0] !== it0.width || size[1] !== it0.height || glassName !== it0.glass
  const price = e && e.error ? null : !hist.length && size[0] === it0.width && size[1] === it0.height && it0.each ? it0.each : (e ? e.unit : it.each)
  const close = () => setTool(null)
  const pick = t => { setTool(tool === t ? null : t); if (t !== 'divide') setDv(null) }

  return (
    <div className="dz">
      <div className="dz-head card">
        <div className="d-row">
          <button className="icon-btn" onClick={() => nav(`/quotations/${id}`)} aria-label="Back">‹</button>
          <span className="d-sep" />
          <button className="d-tab" onClick={() => nav(`/quotations/${id}`)}>Quote</button>
          <button className="d-tab on">Design</button>
          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{ textAlign: 'right' }}><div className="d-price">{price == null ? 'Pricing unavailable' : <>{inr2(price)}{qs === 'draft' && <small className="prov"> provisional</small>}</>}</div>{engErr ? <div className="muted hide-m" style={{ fontSize: 12 }}>This drawing cannot be laid out yet: {e.error}</div> : <div className="muted hide-m" style={{ fontSize: 12 }}>{dirty ? 'Live draft · Save to update the quotation' : sub}</div>}</div>
            {edit && <button className="btn green hide-m" onClick={save}>✓ Save</button>}
            <span className="d-sep" /><button className="icon-btn round" onClick={() => setHelp(!help)} aria-label="Help">?</button>
          </div>
        </div>
        {help && <div className="muted" style={{ fontSize: 13, padding: '0 4px 8px' }}>{sub}. Tap a pane to select it, then change its opening in INSPECT. DESIGNS picks a template, DIVIDE adds panes, SHAPES and COLORS finish the look.</div>}
        <div className="d-row d-sub">
          <b>{it.mark}</b><span className="muted"> · Qty</span>
          {edit ? <input className="qtyin" type="number" min="1" value={qty} onChange={ev => setQty(Math.max(1, +ev.target.value || 1))} /> : <b>{qty}</b>}
          {edit && <button className="btn green show-m" onClick={save}>✓ Save</button>}
          {msg && <span className="badge-ok">{msg}</span>}
          {engErr ? <span className="badge-warn">○ Schematic</span> : <span className="badge-ok">● Engine geometry</span>}
          {edit && <><label className="qty">W <input type="number" value={size[0]} onChange={ev => setSize([+ev.target.value || 0, size[1]])} /></label><label className="qty">H <input type="number" value={size[1]} onChange={ev => setSize([size[0], +ev.target.value || 0])} /></label><span className="muted" style={{ fontSize: 12 }}>mm</span></>}
          <div className="seg"><button className={src === 'live' ? 'on' : ''} onClick={() => setSrc('live')}>Live draft</button><button className={src === 'saved' ? 'on' : ''} onClick={() => setSrc('saved')}>Saved quotation</button></div>
        </div>
      </div>

      <div className="dz-float"><div className="mbases hide-m">Measurement bases: ordered overall frame · ordered pane partitions · daylight · glass cut{edit && mode === '2d' && <> · <b style={{ color: '#2563eb' }}>Drag the blue handles to move mullions</b></>}</div><div className="d-tools card">
        <button className="icon-btn" disabled={!hist.length} onClick={undo} aria-label="Undo">↶</button><button className="icon-btn" disabled={!fut.length} onClick={redo} aria-label="Redo">↷</button>
        <button className={'pill-btn' + (mode === '2d' ? ' solid' : '')} onClick={() => setMode('2d')}>▯ 2D</button>
        <button className={'pill-btn' + (mode === '3d' ? ' solid' : '')} onClick={() => setMode('3d')}>◈ 3D</button>
        <div className="seg"><button className={side === 'inside' ? 'on' : ''} onClick={() => setSide('inside')}>Inside</button><button className={side === 'outside' ? 'on' : ''} onClick={() => setSide('outside')}>Outside</button></div>
        <button className={'icon-btn' + (hand ? ' on' : '')} title="Hand tool: drag to move the canvas" onClick={() => setHand(!hand)}>✋</button>
        <button className="icon-btn" title="Centre the design" onClick={() => setPan([0, 0])}>⌖</button>
        <button className="icon-btn" title="Fit to screen" onClick={() => { setZoom(1); setPan([0, 0]) }}>⛶</button>
        <button className="pill-btn" title="Download this window as an AutoCAD DXF drawing" onClick={exportDxf}>⤓ DXF</button>
        {edit && <label className="pill-btn" title="Import an AutoCAD DXF: outline and dividers become the design" style={{ cursor: 'pointer' }}>⤒ DXF<input type="file" accept=".dxf" style={{ display: 'none' }} onChange={importDxf} /></label>}
      </div></div>

      {(issues.length > 0 || engErr) && <div className="advisory" onClick={() => setAdv(!adv)}>{adv ? '▾' : '▸'} {issues.length + (engErr ? 1 : 0)} design advisory — review before production{adv && <div className="advbody">{engErr && <div>• This drawing cannot be laid out yet: {e.error}</div>}{issues.map(x => <div key={x}>• {x}</div>)}</div>}</div>}

      <div className={'dz-canvas' + (tool && LEFT.includes(tool) ? ' hl' : '') + (tool && RIGHT.includes(tool) ? ' hr' : '')} style={{ cursor: hand ? 'grab' : 'default' }} onMouseMove={ev => { if (hand && ev.buttons === 1) setPan(p => [p[0] + ev.movementX, p[1] + ev.movementY]) }}>
        {mode === '3d' ? <div className="card v3card"><Window3D item={it} design={dsn} engine={e} /></div> :
        <div className="stage" style={{ transform: `translate(${pan[0]}px,${pan[1]}px) scale(${zoom})`, transition: 'transform .05s' }}>
          <WindowSvg item={it} engine={e} mode={mode} side={side} dims design={dsn} selected={sel} onSelect={i => { setSel(i); if (!dv) setTool('inspect') }} onCell={dv ? onCell : undefined} onDim={edit ? onDim : undefined} onGeom={edit && !dv ? (fn => setDsn(d => fn(d))) : undefined} onGeomStart={() => { setHist(h => [...h, dsn]); setFut([]) }} />
        </div>}
      </div>

      <div className="vtabs l">{LEFT.map(t => <button key={t} className={tool === t ? 'on' : ''} onClick={() => pick(t)}>{t.toUpperCase()}</button>)}</div>
      <div className="vtabs r">{RIGHT.map(t => <button key={t} className={tool === t ? 'on' : ''} onClick={() => pick(t)}>{t.toUpperCase()}</button>)}</div>
      {tool && <div className={'sheet-wrap ' + (LEFT.includes(tool) ? 'sl' : 'sr')}>
        {tool === 'designs' && <Sheet title="DESIGNS" onClose={close}>{GROUPS.map(g => <div key={g}><div className="sec">{g}</div><div className="cards">{GALLERY.filter(t => t.group === g).map(t => <button key={t.id} className="dcard" disabled={!edit} onClick={() => { push(t.d); setSize([t.w, t.h]); setSel(null) }}>
            {badge(t.d) && <span className="bdg">{badge(t.d)}</span>}<div className="th"><DesignThumb t={t} /></div><b>{t.name}</b></button>)}</div></div>)}</Sheet>}
        {tool === 'divide' && <Sheet title="DIVIDE & JOIN" onClose={close}><div className="cards">
          {[['mullion', 'Mullion', () => setDv(dv === 'mullion' ? null : 'mullion')], ['transom', 'Transom', () => setDv(dv === 'transom' ? null : 'transom')], ['couplerh', 'Coupler ↔', () => addCol()], ['couplerv', 'Coupler ↕', addRow], ['mirror', 'Mirror design', mirror], ['georgian', 'Georgian bars', () => push({ ...dsn, georgian: !dsn.georgian })]].map(([k, l, f]) =>
            <button key={k} className={'dcard sq' + ((k === 'georgian' && dsn.georgian) || dv === k ? ' on' : '')} disabled={!edit} onClick={f}><Ic k={k} /><b>{l}</b></button>)}</div>{dv && <div className="muted" style={{ marginTop: 8, fontSize: 13 }}>Click the pane on the drawing where the {dv} should go. On a sash it becomes a partition inside that sash (click again with the same tool to remove it); on a fixed pane it splits the frame.</div>}
          {dsn.kind === 'sliding' && <div style={{ marginTop: 10 }}><div className="sec">SLIDING PANELS</div>
            <Radios label="Panels" opts={['2', '3', '4']} val={String(dsn.panels)} on={v => push({ ...dsn, panels: +v, widths: undefined, dirs: undefined, mesh: Math.min(dsn.mesh || 0, +v - 1) })} />
            <Radios label="Mesh shutters" opts={['0', '1', '2']} val={String(dsn.mesh || 0)} on={v => { const m = Math.min(+v, dsn.panels - 1), ok = ['80', '92', '95', '112'].includes(dsn.series || (e && e.series)); push({ ...dsn, mesh: m, ...(m && !ok ? { series: dsn.panels === 2 ? '92' : '80', profiles: {}, tracks: undefined } : {}) }) }} />
            <div className="muted" style={{ fontSize: 12, margin: '-2px 0 6px' }}>Mesh shutters: 80 series (53 mesh), 92 series (53 mesh or 62 mullion mesh), 95 series (sash 60x35 or 75x35), 112 series (sash 59, 67 or 84).</div>
            <Radios label="Tracks" opts={['2', '3']} val={String(dsn.tracks || 2)} on={v => push({ ...dsn, tracks: +v })} /></div>}
          {grid && edit && cells.length > 1 && <button className="opt" style={{ marginTop: 10 }} onClick={() => push({ ...dsn, cols: dsn.cols.length > 1 ? dsn.cols.slice(0, -1) : dsn.cols.map(c => ({ ...c, rows: c.rows.slice(0, 1) })) })}>－ Remove last divider</button>}
        </Sheet>}
        {tool === 'shapes' && <Sheet title="SHAPES & BAYS" onClose={close}>
          <p className="muted" style={{ marginTop: 0 }}>Choose a shape, adjust its preview, then apply. Dimensions use your selected units.</p>
          {dsn.bay && dsn.kind === 'grid' && dsn.cols.length === 2 && (() => {
            const W0 = size[0], wts = dsn.cols.map(c => c.w), tot0 = wts[0] + wts[1], A0 = Math.round(W0 * wts[0] / tot0), B0 = W0 - A0, ang0 = dsn.bayInterior || (dsn.bayType === 'splay' ? 135 : dsn.bayType === 'box' ? 110 : 90)
            const E = bayEd || { a: A0, b: B0, ang: ang0, link: false }, setE = o => setBayEd({ ...E, ...o }), a = +E.a || 0, b = +E.b || 0, ang = Math.min(175, Math.max(30, +E.ang || 90)), rad = ang * Math.PI / 180
            const span = Math.sqrt(a * a + b * b - 2 * a * b * Math.cos(rad)), depth = span ? a * b * Math.sin(rad) / span : 0
            const tx = (t) => 110 + t * 0, pa = [110 - Math.sin(rad / 2) * 70, 90 - Math.cos(rad / 2) * 0 + 0]
            const h = 80, ax = 110 - (a / (a + b)) * 80 * Math.sin(rad / 2) * 1.2, bx = 110 + (b / (a + b)) * 80 * Math.sin(rad / 2) * 1.2, ay = 30 + (1 - Math.cos(rad / 2)) * 40, by = ay
            return <div className="bayed"><div className="sec">Change shape or bay</div>
              <div className="lab" style={{ marginTop: 8 }}>TOP VIEW · OUT ↑</div>
              <svg width="220" height="110" viewBox="0 0 220 110" style={{ display: 'block', margin: '4px auto' }}><path d={`M${ax},${ay + 40} L110,${20} L${bx},${by + 40}`} fill="none" stroke="#2563eb" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" /><text x="52" y="70" fontSize="11" fill="#111827">A · {a}</text><text x="140" y="70" fontSize="11" fill="#111827">B · {b}</text><text x="100" y="104" fontSize="11" fill="#6b7280">{Math.round(ang)}°</text></svg>
              <label className="chk" style={{ display: 'flex', gap: 8, margin: '6px 0', textTransform: 'none', letterSpacing: 0 }}><input type="checkbox" checked={!!E.link} onChange={ev => setE({ link: ev.target.checked, b: ev.target.checked ? a : E.b })} /> Link side widths and angles</label>
              <div className="lab">FACE A WIDTH (mm)</div><input className="note" type="number" disabled={!edit} value={E.a} onChange={ev => setE({ a: ev.target.value, ...(E.link ? { b: ev.target.value } : {}) })} />
              <div className="lab">FACE B WIDTH (mm)</div><input className="note" type="number" disabled={!edit || E.link} value={E.b} onChange={ev => setE({ b: ev.target.value })} />
              <div className="lab">JOINT 1 ANGLE (°)</div><input className="note" type="number" min="30" max="175" disabled={!edit} value={E.ang} onChange={ev => setE({ ang: ev.target.value })} />
              <p className="muted" style={{ fontSize: 12.5 }}>Interior angles: 135° makes a 45° turn. 90° uses the system's 90° bay pole; another angle uses a pole made for it, else the round pole with adapters.</p>
              <p className="muted" style={{ fontSize: 12.5 }}>Face lengths include the outside corner; the pole and adapters are deducted from each face before calculating frame cuts.</p>
              <div className="kv"><span>Total face lengths</span><b>{a + b} mm</b></div><div className="kv"><span>Plan span</span><b>{span.toFixed(1)} mm</b></div><div className="kv"><span>Projection depth</span><b>{depth.toFixed(1)} mm</b></div>
              <div style={{ display: 'flex', gap: 8, marginTop: 10 }}><button className="btn" disabled={!edit || a < 300 || b < 300} onClick={() => { setSize([Math.round(a + b), size[1]]); push({ ...dsn, cols: [{ ...dsn.cols[0], w: a }, { ...dsn.cols[1], w: b }], bayInterior: Math.round(ang), bayType: Math.round(ang) === 90 ? 'corner' : ang >= 120 ? 'splay' : 'box' }); setBayEd(null); close() }}>Apply bay changes</button><button className="btn ghost" onClick={() => { setBayEd(null); close() }}>Cancel</button></div></div> })()}
          <div className="sec">Choose shape or bay</div>
          <div className="cards">{SHAPES.map(([v, l]) => <button key={v} className={'dcard sq' + (shape === v ? ' on' : '')} onClick={() => setShape(v)}><ShapeIcon v={v} on={shape === v} /><b>{l}</b></button>)}</div>
          <p className="muted" style={{ fontSize: 12.5 }}>Fixed arch heads: profile and bead arc length + 30% bending wastage; GI at net arc length. Straight sections and mullions use normal joint allowances. Apply uses the quotation system’s 60 mm casement outer; select Engine pricing for quantities. Multi-faced frames remain manual quotes. Bays retain separate framed units.</p>
          <button className="btn" disabled={!edit} onClick={() => { push({ ...dsn, shape: ['rect', 'arch', 'half'].includes(shape) ? shape : 'rect', bay: ['corner', 'splay', 'box'].includes(shape), bayType: ['corner', 'splay', 'box'].includes(shape) ? shape : undefined }); close() }}>Apply</button>
        </Sheet>}
        {tool === 'colors' && <Sheet title="COLORS" onClose={close}>
          <div className="sec">WINDOW COLOR</div><p className="muted" style={{ marginTop: 0, fontSize: 13 }}>Applied to the frame and sashes of every unit.</p>
          <div className="swatches">{[...WINDOW_COLORS, ...(dsn.customColors || [])].map(([n, c]) => <button key={n} className={'sw' + ((dsn.colour?.Window || 'White') === n ? ' on' : '')} disabled={!edit} onClick={() => push({ ...dsn, colour: { ...(dsn.colour || {}), Window: n } })}><i style={{ background: c }} />{n}</button>)}</div>
          <div className="addcol"><input placeholder="Custom color name" value={custom.name} onChange={ev => setCustom({ ...custom, name: ev.target.value })} /><input type="color" aria-label="Custom color swatch" value={custom.color} onChange={ev => setCustom({ ...custom, color: ev.target.value })} /><button className="btn ghost sm" disabled={!edit || !custom.name} onClick={() => { push({ ...dsn, customColors: [...(dsn.customColors || []), [custom.name, custom.color]], colour: { ...(dsn.colour || {}), Window: custom.name } }); setCustom({ name: '', color: '#888888' }) }}>Add color</button></div>
          <p className="muted" style={{ fontSize: 12.5 }}>Custom colors are saved with this design. Swatches are approximate.</p>
          <div className="sec">HARDWARE FINISH</div>
          <select className="sel" disabled={!edit} value={dsn.hwFinish || HW_FINISH[0]} onChange={ev => push({ ...dsn, hwFinish: ev.target.value })}>{HW_FINISH.map(f => <option key={f}>{f}</option>)}</select>
          <p className="muted" style={{ fontSize: 12.5 }}>Handles, touch locks and 2D/3D hinges. Friction hinges are excluded. Available catalogue finishes are used. Review Hardware for the actual items; explicit product choices stay selected.</p>
        </Sheet>}
        {tool === 'inspect' && <Sheet title="Inspect this window" onClose={close}>
          <button className="opt" onClick={() => setNoteOpen(!noteOpen)}>＋ Add note</button>
          {noteOpen && <input className="note" placeholder="Type a note for this window" value={note} onChange={ev => setNote(ev.target.value)} />}
          <DesignAssist dsn={dsn} size={size} engine={e} glassName={glassName} />
          {dsn.kind === 'sliding' ? (() => {
            const n = dsn.panels || 2, W0 = size[0], ctr = n === 3 && !!(dsn.centre || dsn.mesh), leaf = sel != null && sel < n && !(ctr && sel === 1) ? sel : null, nm = i => ctr ? ['S1', 'F1', 'S2'][i] : (dsn.mesh && i >= n - dsn.mesh ? 'M' + (i + 1 - (n - dsn.mesh)) : 'S' + (i + 1))
            const eq = ctr ? [Math.round(W0 / 4), Math.round(W0 / 2), W0 - Math.round(W0 / 4) - Math.round(W0 / 2)] : Array.from({ length: n }, (_, i) => i < n - 1 ? Math.round(W0 / n) : W0 - Math.round(W0 / n) * (n - 1))
            const uneq = Array.isArray(dsn.widths) && dsn.widths.length === n
            const ws = uneq ? dsn.widths : eq, tot = ws.reduce((a, b) => a + (+b || 0), 0)
            const cur = leaf != null ? (dsn.dirs && dsn.dirs[leaf]) || (leaf % 2 ? 'L' : 'R') : null
            const setDir = v => push({ ...dsn, dirs: Array.from({ length: n }, (_, i) => i === leaf ? v : (dsn.dirs && dsn.dirs[i]) || (i % 2 ? 'L' : 'R')) })
            return <div className="ins-head">
              <div className="ins-title"><b>{leaf != null ? 'SLIDING SASH' : 'SLIDING WINDOW'}</b>{leaf != null && <span className="ins-badge">{nm(leaf)}</span>}</div>
              {leaf != null && <>
                <div className="lab">OPENING</div><div className="lab sub">SLIDES</div>
                <div className="seg3">{[['L', '← Left'], ['R', 'Right →'], ['B', 'Both ways']].map(([v, l]) => <button key={v} disabled={!edit} className={cur === v ? 'on' : ''} onClick={() => setDir(v)}>{l}</button>)}</div>
                <div className="lab">SASH SIZES</div>
                <div className="seg3 two"><button disabled={!edit} className={!uneq ? 'on' : ''} onClick={() => push({ ...dsn, widths: undefined })}>Equal</button><button disabled={!edit} className={uneq ? 'on' : ''} onClick={() => push({ ...dsn, widths: eq })}>Unequal</button></div>
                {uneq && <div className="wgrid">{ws.map((v, i) => <label key={i}><span>{nm(i)} WIDTH (MM)</span><input type="number" disabled={!edit} value={v} onChange={ev => push({ ...dsn, widths: ws.map((x, k) => k === i ? +ev.target.value || 0 : x) })} /></label>)}</div>}
                <div className="muted" style={{ fontSize: 12 }}>Panels: {ws.join(' · ')} mm{uneq && Math.abs(tot - W0) > 1 && <b style={{ color: '#b91c1c' }}> — total {tot} ≠ window width {W0}; equal sizes are used until they match</b>}</div></>}
            </div>
          })() : <div className="ins-head"><div className="ins-title"><b>{door ? 'CASEMENT DOOR' : 'WINDOW'}{edit && grid && sel != null ? '' : ''}</b>{grid && sel != null && <span className="ins-badge">C{sel + 1}</span>}</div>
            {edit && grid && <div style={{ margin: '8px 0' }}><div className="lab">{sel == null ? 'Tap a pane on the drawing to change it' : `Pane C${sel + 1}: ${cells[sel]?.op}`}</div>
              {sel != null && [['FIXED', 'Fixed'], ['LH', 'Left hung'], ['RH', 'Right hung'], ['TOP', 'Top hung'], ['TT', 'Tilt & turn'], ['LOUVRE', 'Louvre'], ['FAN', 'Exhaust fan']].map(([v, l]) => <button key={v} className={'opt inl' + (cells[sel]?.op === v ? ' on' : '')} onClick={() => setOp(v)}>{l}</button>)}</div>}</div>}
          {(engErr || issues.length > 0) && <div><div className="sec">ISSUES</div>
            {engErr && <><div className="issue"><b>Drawing issues</b><div>This drawing cannot be laid out yet: {e.error}</div></div><div className="issue" style={{ marginTop: 6 }}><b>Price blockers</b><div>The last save could not be priced: design {it.mark} cannot be priced: {e.error}. Fix it and save again.</div></div></>}
            {issues.length > 0 && <div className="issue"><b>Drawing issues</b>{issues.map(x => <div key={x}>{x}</div>)}</div>}</div>}
          {dsn.kind === 'sliding' && <details className="ins-series"><summary>Window series · {(dsn.series || (e && e.series) || 'auto')}</summary><div className="hwgrp">{['53', '62', '80', '92', '95', '112'].map(sr => <button key={sr} disabled={!edit} className={'opt inl' + ((dsn.series || (e && e.series) || '') === sr ? ' on' : '')} onClick={() => push({ ...dsn, series: sr, profiles: {}, mesh: ['80', '92', '95', '112'].includes(sr) ? dsn.mesh : 0 })}>{sr}</button>)}
            <div className="muted" style={{ fontSize: 12 }}>Changing the series swaps the frame, sash, bead and interlock profiles to that system's defaults.</div></div></details>}
          {e && !engErr && <InspectCards e={e} dsn={dsn} push={push} edit={edit} profs={profs} sel={sel} />}
          {(!e || (e.cuts && !e.cuts.length && !engErr)) && <div className="muted">Cut list appears once the design is saved.</div>}
        </Sheet>}
        {tool === 'hardware' && <Sheet title="HARDWARE" onClose={close}>

          {allFixed && <div className="muted" style={{ fontSize: 12.5, margin: '8px 0' }}>No opening sashes: fixed panes take no sash hardware.</div>}
          {!allFixed && <><div className="lab">HANDLE HEIGHT</div><input className="note" disabled={!edit} placeholder="mm from floor" value={dsn.handleHeight || ''} onChange={ev => push({ ...dsn, handleHeight: ev.target.value })} />
          <div className="muted" style={{ fontSize: 12.5, margin: '4px 0 10px' }}>Blank = centre of the sash. A typed height is from the floor.</div>
          <div className="paneChips">{panes.map((p, i) => <button key={p} className={'opt inl' + ((sel ?? 0) === i ? ' on' : '')} onClick={() => setSel(i)}>PANE {i + 1} · {p}</button>)}</div><div className="sec">HARDWARE</div></>}
          <div className="hwgrp"><div className="lab">HARDWARE BRAND</div><select className="sel" aria-label="Hardware brand" disabled={!edit} value={(dsn.hw || {}).brand?.v || 'Quotation brand (Generic Hardware)'} onChange={ev => hw('brand', 'v', ev.target.value)}>{['Quotation brand (Generic Hardware)', 'Generic hardware', ...hwBrands.filter(b => b !== 'Generic hardware')].map(b => <option key={b}>{b}</option>)}</select></div>
          {allFixed ? null : dsn.kind === 'sliding' ? <>
            <div className="muted" style={{ fontSize: 12.5 }}>Sliding · {dsn.panels || 2} sashes ({panes.join(', ')})</div>
            {(dsn.panels || 2) === 3 && <div className="muted" style={{ fontSize: 12.5, margin: '4px 0' }}>S2: Middle sash — held by the interlocks; no lock or handle of its own.</div>}
            <Radios label="APPLY TO" opts={[`All ${dsn.panels || 2} sliding sashes`, ...panes.map(p => p + ' only')]} val={(dsn.hw || {}).applyTo?.v} on={v => hw('applyTo', 'v', v)} />
            <Radios star label="ROLLER" opts={['Auto — SINGLE WHEEL WITH GROOVE', 'DOUBLE WHEEL ADJUSTABLE WITH GROOVE', 'DOUBLE WHEEL WITH GROOVE', 'DOUBLE WHEEL WITHOUT GROOVE', 'FLY MESH ROLLER', 'SINGLE WHEEL WITH GROOVE', 'SINGLE WHEEL WITHOUT GROOVE']} val={(dsn.hw || {}).roller?.v} on={v => hw('roller', 'v', v)} />
            <Radios star label="TOUCH LOCK" opts={['Auto — TOUCH LOCK', 'TOUCH LOCK']} val={(dsn.hw || {}).lock?.v} on={v => hw('lock', 'v', v)} />
            <Radios label="ALUMINIUM TRACK" opts={['Not included', 'Included']} val={(dsn.hw || {}).altrack?.v} on={v => hw('altrack', 'v', v)} />
            {(dsn.hw || {}).altrack?.v === 'Included' && <><div className="lab">ALUMINIUM TRACK ITEM</div><select className="sel" disabled={!edit} value={(dsn.hw || {}).altrackItem?.v || ''} onChange={ev => hw('altrackItem', 'v', ev.target.value)}><option value="">Choose an item</option><option>ALUMINIUM TRACK</option></select></>}
            {!!dsn.mesh && <Radios label="Mesh type" opts={['Default mesh rate', 'Aluminium mesh — ₹22.00 / sq ft', 'Fibre mesh — ₹12.00 / sq ft', 'SS mesh — ₹30.00 / sq ft']} val={{ 'Aluminium mesh': 'Aluminium mesh — ₹22.00 / sq ft', 'Fibre mesh': 'Fibre mesh — ₹12.00 / sq ft', 'SS mesh': 'SS mesh — ₹30.00 / sq ft' }[dsn.meshType || 'SS mesh']} on={v => v === 'Default mesh rate' ? push({ ...dsn, meshType: undefined }) : push({ ...dsn, meshType: v.split(' — ')[0] })} />}</>
          : door ? <>
            <div className="muted" style={{ fontSize: 12.5 }}>Casement door · 1 sash ({panes[0]})</div>
            <Radios star label="3D / 2D HINGE" opts={['Auto — 3D HINGES', '2D HINGES', '3D HINGES', 'BUTT HINGES']} val={(dsn.hw || {}).hinge?.v} on={v => hw('hinge', 'v', v)} />
            <Radios label="Hinge count" opts={['3', '4']} val={(dsn.hw || {}).hcount?.v} on={v => hw('hcount', 'v', v)} />
            <Radios star label="HANDLE" opts={['Auto — CASEMENT DOUBLE SIDE DOOR HANDLE', 'CASEMENT DOUBLE SIDE DOOR HANDLE', 'CASEMENT DOUBLE SIDE DOOR HANDLE WITH KEY', 'DOOR LOCKING SET', 'DOOR LOCKING SET · WHITE [UPVC-HW-LCKSET]', 'DOUBLE SIDE DOOR HANDLE WITH KEY', 'DOUBLE SIDE DOOR HANDLE WITHOUT KEY', 'DOUBLE SIDE ESPAG HANDLE WITH KEY', 'DOUBLE SIDE ESPAG HANDLE WITHOUT KEY', 'MORTIES DOOR LOCK SET']} val={(dsn.hw || {}).handle?.v} on={v => hw('handle', 'v', v)} />
            <Radios star label="ESPAG" opts={['Auto — CASEMENT DOOR ESPAG WITH CYLINDER 1800', 'CASEMENT DOOR ESPAG WITH CYLINDER 1600', 'CASEMENT DOOR ESPAG WITH CYLINDER 1800']} val={(dsn.hw || {}).espag?.v} on={v => hw('espag', 'v', v)} />
            <Radios label="SHOOT BOLT" opts={['None', 'SHOOT BOLT']} val={(dsn.hw || {}).bolt?.v} on={v => hw('bolt', 'v', v)} /></>
          : <>
            <div className="muted" style={{ fontSize: 12.5 }}>Casement window · {panes.length} sash{panes.length === 1 ? '' : 'es'} ({panes.join(', ')})</div>
            {panes.length > 1 && <Radios label="APPLY TO" opts={[`All ${panes.length} casement window sashes`, ...panes.map(p => p + ' only')]} val={(dsn.hw || {}).applyTo?.v} on={v => hw('applyTo', 'v', v)} />}
            <Radios star label="HINGE TYPE" opts={['Friction hinge', '2D hinge']} val={(dsn.hw || {}).hingeType?.v || 'Friction hinge'} on={v => hw('hingeType', 'v', v)} />
            {(dsn.hw || {}).hingeType?.v === '2D hinge'
              ? <Radios star label="2D HINGE" opts={['Auto — 2D HINGES', '2D HINGES', 'BUTT HINGES']} val={(dsn.hw || {}).hinge?.v} on={v => hw('hinge', 'v', v)} />
              : <Radios star label="FRICTION HINGE" opts={['Auto — FRICTION STAY 10"', 'FRICTION STAY 10"', 'FRICTION STAY 12"', 'FRICTION STAY 14"', 'FRICTION STAY 16"', 'FRICTION STAY 18"', 'FRICTION STAY 20"', 'FRICTION STAY 22"', 'FRICTION STAY 24"', 'FRICTION STAY 8"']} val={(dsn.hw || {}).stay?.v} on={v => hw('stay', 'v', v)} />}
            <Radios star label="HANDLE" opts={['Auto — CASEMENT WINDOW HANDLE', 'CASEMENT WINDOW HANDLE', 'COCKSPUR HANDLE', 'ESPAG HANDLE WITH KEY', 'ESPAG HANDLE WITHOUT KEY', 'FLY MESH HANDLE']} val={(dsn.hw || {}).handle?.v} on={v => hw('handle', 'v', v)} />
            <Radios star label="ESPAG" opts={['Auto — CASEMENT 15MM BS ESPAG 800', ...[15, 20, 22, 30].flatMap(b => [400, 600, 800].map(l => `CASEMENT ${b}MM BS ESPAG ${l}`))]} val={(dsn.hw || {}).espag?.v} on={v => hw('espag', 'v', v)} />
            <Radios label="CYLINDER" opts={['None', 'CYLINDER']} val={(dsn.hw || {}).cylinder?.v} on={v => hw('cylinder', 'v', v)} />
            <Radios label="STRIKER" opts={['Auto — CMT ESPAG STRIKER', 'None']} val={(dsn.hw || {}).striker?.v} on={v => hw('striker', 'v', v)} /></>}
          <div className="sec">Gaskets</div>
          <div className="hwgrp"><div className="lab">AUTOMATIC GASKET</div><select className="sel" aria-label="Automatic gasket" disabled={!edit} value={(dsn.hw || {}).gasket?.v || 'No gasket'} onChange={ev => hw('gasket', 'v', ev.target.value)}>{['No gasket', 'CASEMENT MULLION GASKET · BLACK', 'GLAZING GASKET INNER · ASH BLACK', 'GLAZING GASKET OUTER · ASH BLACK', 'K TYPE GASKET · ASH BLACK', 'O TYPE GASKET · ASH BLACK', 'SHUTTER BEATING GASKET · ASH BLACK', 'STAR TYPE GASKET · ASH BLACK'].map(o => <option key={o}>{o}</option>)}</select></div>
          {!!dsn.mesh && <Radios label="MESH GASKET" opts={['Auto — O TYPE GASKET · ASH BLACK', ...['CASEMENT MULLION GASKET · BLACK', 'GLAZING GASKET INNER · ASH BLACK', 'GLAZING GASKET OUTER · ASH BLACK', 'K TYPE GASKET · ASH BLACK', 'O TYPE GASKET · ASH BLACK', 'SHUTTER BEATING GASKET · ASH BLACK', 'STAR TYPE GASKET · ASH BLACK'].filter(g => !g.startsWith('O TYPE'))]} val={(dsn.hw || {}).meshGasket?.v} on={v => hw('meshGasket', 'v', v)} />}
          <div className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>These profiles come with their gasket fitted, so none is added.</div>
          {e && (e.gaskets || []).map(g => <div key={g.code + g.name} className="muted" style={{ fontSize: 13 }}>{g.name} · Mesh net · {g.m} m · {inr2(g.m * g.rate)}</div>)}
          <InstallList dsn={dsn} size={size} door={door} cells={cells} />
          {e && e.hardware.length > 0 && <table style={{ marginTop: 10 }}><thead><tr><th>Item</th><th>Qty</th><th>Rate</th></tr></thead><tbody>{e.hardware.map(h => <tr key={h.name}><td>{h.name}</td><td>{h.qty}</td><td>{inr2(h.rate)}</td></tr>)}</tbody></table>}
        </Sheet>}
        {tool === 'glazing' && <Sheet title="GLAZING" onClose={close}>
          <div className="sec">WINDOW GLASS</div>
          <select className="sel" disabled={!edit} value={glassName} onChange={ev => setGlassName(ev.target.value)}>{[...new Set([glassName, ...glasses.map(g => g.name)])].filter(Boolean).map(g => <option key={g}>{g}</option>)}</select>
          {e && e.cuts.find(c => c.role === 'Bead') && <div className="muted" style={{ margin: '8px 0' }}>Bead: {e.cuts.find(c => c.role === 'Bead').name}</div>}
          {(() => { const per = dsn.perPane ?? Object.values(dsn.paneGlass || {}).some(Boolean); return <>
            <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'center', margin: '10px 0' }}><input type="checkbox" disabled={!edit} checked={!!per} onChange={ev => push({ ...dsn, perPane: ev.target.checked, ...(ev.target.checked ? {} : { paneGlass: {} }) })} /> Different glass for each sash</label>
            {panes.map((p, i) => <div key={p} className="hwgrp"><div className="lab">PANE {i + 1} · {p}</div>
              <select className="sel" aria-label={`Glass for pane ${i + 1}`} disabled={!edit} value={(dsn.paneGlass || {})[i] || ''} onChange={ev => push({ ...dsn, perPane: true, paneGlass: { ...(dsn.paneGlass || {}), [i]: ev.target.value } })}>
                <option value="">Inherit window glass ({(glassName.match(/\d+/) || ['5'])[0]} mm)</option>{glasses.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}</select>
              <label className="chk" style={{ display: 'flex', gap: 8, alignItems: 'center', marginTop: 6 }}><input type="checkbox" disabled={!edit} checked={!!(dsn.paneFan || {})[i]} onChange={ev => push({ ...dsn, paneFan: { ...(dsn.paneFan || {}), [i]: ev.target.checked } })} /> <span className="lab" style={{ margin: 0 }}>EXHAUST FAN CUT-OUT</span></label></div>)}</> })()}
          {e && e.panes && <table style={{ marginTop: 10 }}><thead><tr><th>Pane</th><th>Glass size</th><th>Area</th></tr></thead><tbody>{e.panes.map(p => <tr key={p.name}><td>{p.name}</td><td>{p.mesh ? 'Mesh' : `${Math.round(p.w)} × ${Math.round(p.h)} mm`}</td><td>{p.mesh ? '—' : ((p.w * p.h) / 92903.04).toFixed(2) + ' sq ft'}</td></tr>)}</tbody></table>}
        </Sheet>}
        {tool === 'pricing' && e && <Sheet title="PRICING" onClose={close}>
          <div className="seg" style={{ marginBottom: 8 }}><button className={view === 'table' ? 'on' : ''} onClick={() => setView('table')}>Table</button><button className={view === 'pie' ? 'on' : ''} onClick={() => setView('pie')}>Pie chart</button></div>
          <div className="seg" style={{ marginBottom: 6 }}><button className={dsn.pricing !== 'manual' ? 'on' : ''} disabled={!edit} onClick={() => push({ ...dsn, pricing: 'engine' })}>Engine</button><button className={dsn.pricing === 'manual' ? 'on' : ''} disabled={!edit} title="Set your own selling price per sq ft" onClick={() => push({ ...dsn, pricing: 'manual', manualRate: dsn.manualRate || Math.round(e.unit / e.area) })}>Manual ₹/sq ft</button></div>
          {dsn.pricing === 'manual' && <div style={{ display: 'flex', alignItems: 'center', gap: 8, margin: '6px 0' }}><span className="lab" style={{ margin: 0 }}>₹ / sq ft (excl. tax)</span><input className="note" style={{ width: 110 }} type="number" min="0" disabled={!edit} value={dsn.manualRate || ''} onChange={ev => push({ ...dsn, manualRate: +ev.target.value || 0 })} /></div>}
          <div className="muted" style={{ fontSize: 13, margin: '6px 0' }}>Saved calculation · per window · {e.area.toFixed(3)} sq ft</div>
          {view === 'pie' ? <Pie rows={[...e.rows, ...e.labour, [e.profitLabel, e.profit]]} /> :
          <table className="cost"><thead><tr><th>Cost / charge</th><th style={{ textAlign: 'right' }}>Per window</th></tr></thead><tbody>
            {e.rows.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{inr2(r[1])}</td></tr>)}
            <tr className="tot"><td>Total material cost</td><td>{inr2(e.materialTotal)}</td></tr>
            {e.labour.map(r => <tr key={r[0]}><td>{r[0]}</td><td>{inr2(r[1])}</td></tr>)}
            <tr className="tot"><td>Total cost</td><td>{inr2(e.totalCost)}</td></tr>
            <tr><td>{e.profitLabel}</td><td>{inr2(e.profit)}</td></tr>
            <tr className="tot"><td>Basic selling price</td><td>{inr2(e.unit)}</td></tr>
            <tr><td>Unit subtotal (excl. tax)</td><td>{inr2(e.unit)}</td></tr>
            <tr><td>{e.taxLabel}</td><td>{inr2(e.tax)}</td></tr>
            <tr className="tot"><td>Unit total (incl. tax)</td><td>{inr2(e.unitInc)}</td></tr>
            <tr><td>Price per sq ft (incl. tax)</td><td>{inr2(e.perSqftInc)}</td></tr></tbody></table>}
          {edit && <div style={{ margin: '10px 0' }}><button className="opt" onClick={() => push({ ...dsn, extras: [...(dsn.extras || []), { name: '', amount: 0 }] })}>＋ Add extra cost</button>
            {(dsn.extras || []).map((x, i) => <div key={i} style={{ display: 'flex', gap: 6, marginTop: 6 }}><input className="note" placeholder="Name" value={x.name} onChange={ev => push({ ...dsn, extras: dsn.extras.map((y, k) => k === i ? { ...y, name: ev.target.value } : y) })} /><input className="note" style={{ width: 90 }} type="number" placeholder="₹" value={x.amount || ''} onChange={ev => push({ ...dsn, extras: dsn.extras.map((y, k) => k === i ? { ...y, amount: +ev.target.value } : y) })} /><button className="icon-btn" onClick={() => push({ ...dsn, extras: dsn.extras.filter((_, k) => k !== i) })}>✕</button></div>)}</div>}
          <p className="muted" style={{ fontSize: 12 }}>{qty} units total: {inr2(e.unitInc * qty)}. Per-window amounts rounded for display. Profile cost includes beads and profile gaskets. Profit % applies to material and labour cost. Transport, loading and unloading are separate quotation charges.</p>
        </Sheet>}
      </div>}

      <div className="bottombar">{TABS.map(t => <button key={t} className={tool === t ? 'on' : ''} onClick={() => pick(t)}>{t.toUpperCase()}</button>)}</div>
    </div>)
}

function InstallList({ dsn, size, door, cells }) {
  const [map, setMap] = useState(null); useEffect(() => { api('/settings/install_map').then(r => setMap(r && r.types ? r.types : instDefaults())).catch(() => setMap(instDefaults())) }, [])
  const type = dsn.kind === 'sliding' ? (door ? 'Sliding door' : 'Sliding window') : door ? 'Casement door' : (cells.length && cells.every(c => c.op === 'FIXED') ? 'Fixed window' : 'Casement window')
  const ft = 304.8, w = size[0] / ft, h = size[1] / ft, area = w * h, perim = 2 * (w + h), panes = dsn.kind === 'sliding' ? (dsn.panels || 2) : 1
  const items = (map && map[type]) || [], c = { frame: 1, comp: 1, area, perim, sash: panes, mesh: dsn.mesh ? 1 : 0, coupler: 0 }
  return <details className="instl"><summary>Installation material · {type}</summary>
    <div className="muted" style={{ fontSize: 12.5, margin: '6px 0' }}>{w.toFixed(2)} × {h.toFixed(2)} ft · {area.toFixed(2)} sq ft · perimeter {perim.toFixed(2)} ft</div>
    {items.length === 0 ? <div className="muted">Loading…</div> : <table><thead><tr><th>Item</th><th>Qty</th><th>Calculation</th></tr></thead><tbody>{items.map(it => <tr key={it.id || it.name}><td>{it.name}<br /><small className="muted">{it.group}</small></td><td>{instQty(it, c)} {it.unit}</td><td style={{ fontSize: 11.5 }} className="muted">{instFormula(it)}</td></tr>)}</tbody></table>}
    <div className="muted" style={{ fontSize: 12 }}>Recipes come from Settings → Installation mapping.</div></details>
}
const fmtLens = lens => Object.entries(lens.reduce((m, x) => { m[Math.round(x)] = (m[Math.round(x)] || 0) + 1; return m }, {})).map(([l, n]) => `${n} × ${l} mm`).join(' · ')
function InspectCards({ e, dsn, push, edit, profs, sel }) {
  const [open, setOpen] = useState('Frame')
  const frames = e.cuts.filter(c => c.role === 'Frame')
  if (dsn.bay && frames.length > 1) {
    const bead = e.cuts.find(c => c.role === 'Bead'), cp = e.cuts.filter(c => c.role === 'Coupler'), per = bead ? Math.floor(bead.lens.length / frames.length) : 0
    const rows = []
    frames.forEach((f, i) => { rows.push(['F' + (i + 1), 'Frame', f]); if (bead) rows.push(['F' + (i + 1), 'Bead', { ...bead, lens: bead.lens.slice(i * per, (i + 1) * per) }]) })
    cp.forEach(c => rows.push(['', 'Coupler', c]))
    return <div className="ins-cards">{rows.map(([f, r, c], i) => { const k = f + r + i, isOpen = open === k
      return <div key={k} className={'ins-card' + (isOpen ? ' open' : '')}><button className="ins-card-h" onClick={() => setOpen(isOpen ? null : k)}><span className="r">{f && <em style={{ fontStyle: 'normal', color: '#2563eb', marginRight: 8 }}>{f}</em>}{r}</span><b>{c.name}</b><span className="s">{c.code} · {fmtLens(c.lens)}</span></button>
        {isOpen && <div className="ins-card-b"><img className="prof-img" alt={c.code} src={profileImg(c.code)} onError={ev => { ev.currentTarget.style.display = 'none' }} />
          <div className="kv"><span>Cut length</span><b>{Math.round(c.lens[0])} mm</b></div><div className="kv"><span>End cuts</span><b>{r === 'Coupler' ? '90° / 90°' : '45° / 45°'}</b></div><div className="kv"><span>Finish</span><b>{(dsn.colour && dsn.colour.Window) || 'White'}</b></div></div>}</div> })}</div>
  }
  const roles = []
  e.cuts.forEach(c => { if (!roles.includes(c.role)) roles.push(c.role) })
  ;(e.options || []).forEach(o => { if (!roles.includes(o.role)) roles.push(o.role) })
  const order = ['Frame', 'Sash', 'Mesh Sash', 'Mesh', 'Bead', 'Interlock']; roles.sort((a, b) => (order.indexOf(a) < 0 ? 99 : order.indexOf(a)) - (order.indexOf(b) < 0 ? 99 : order.indexOf(b)))
  const isMeshRole = r => r === 'Mesh Sash' || r === 'Mesh'
  const pane = (e.panes || []).find(p => dsn.kind === 'sliding' && sel != null && p.name === 'S' + (sel + 1)) || (e.panes || []).find(p => p.sl != null)
  return <div className="ins-cards">{roles.filter(r => r !== 'Mesh' || !e.cuts.some(c => c.role === 'Mesh Sash')).map(role => {
    const cut = e.cuts.find(c => c.role === role), op = (e.options || []).find(o => o.role === (role === 'Mesh Sash' ? 'Mesh' : role)), key = role, isOpen = open === key
    const ri = e.riInfo && e.riInfo[role]
    const len0 = cut && cut.lens[0]
    return <div key={key} className={'ins-card' + (isOpen ? ' open' : '')}>
      <button className="ins-card-h" onClick={() => setOpen(isOpen ? null : key)}><span className="r">{isMeshRole(role) ? 'Mesh sash' : role}</span><b>{cut ? cut.name : (op ? 'Not included' : '')}</b>
        <span className="s">{cut ? `${cut.code} · ${fmtLens(cut.lens)}` : (op ? op.selected : '')}</span></button>
      {isOpen && <div className="ins-card-b">
        {role === 'Mesh Sash' || (role === 'Mesh' && !cut) ? <label className="chk"><input type="checkbox" checked={!!dsn.mesh} disabled={!edit} onChange={ev => push({ ...dsn, mesh: ev.target.checked ? 1 : 0 })} /> INCLUDE MESH</label> : null}
        {op && <><div className="lab">USE PROFILE</div><select className="sel" disabled={!edit} value={op.selected} onChange={ev => push({ ...dsn, profiles: { ...(dsn.profiles || {}), [op.role.toLowerCase()]: ev.target.value } })}>{op.choices.map(c => <option key={c} value={c}>{(profs[c] || c)} ({c})</option>)}</select>
          {op.role === 'Mesh' && <div className="muted" style={{ fontSize: 12 }}>{{ 'RSM-53M': '80 series: 53 mesh', 'RSS-60ES': '95 series: sash 60x35 or 75x35', 'RSS-59SS': '112 series: sash 59, 67 or 84' }[op.choices[0]] || '92 series: 53 mesh or 62 mullion mesh'}</div>}</>}
        {cut && <>
          <img className="prof-img" alt={cut.code} src={profileImg(cut.code)} onError={ev => { ev.currentTarget.style.display = 'none' }} />
          <div className="kv"><span>Cut length</span><b>{len0 != null ? Math.round(len0) + ' mm' : '—'}</b></div>
          <div className="kv"><span>End cuts</span><b>{/^Sash (Mullion|Transom)/.test(role) ? 'V / V (welded into the sash)' : /Interlock|Coupler|Georgian/.test(role) ? '90° / 90°' : '45° / 45°'}</b></div>
          <div className="kv"><span>Finish</span><b>{(dsn.colour && dsn.colour.Window) || 'White'}</b></div></>}
        {ri && cut && <>
          <div className="lab" style={{ marginTop: 8 }}>{role} reinforcement thickness (mm)</div>
          <input className="note" type="number" step="0.1" min="0.5" disabled={!edit} value={(dsn.riThk && dsn.riThk[role.toLowerCase()]) || 1.2} onChange={ev => push({ ...dsn, riThk: { ...(dsn.riThk || {}), [role.toLowerCase()]: +ev.target.value || 1.2 } })} />
          <div className="muted" style={{ fontSize: 12 }}>Reinforcement: {ri.kgm.toFixed(4)} kg/m · priced per kg</div>
          <div className="lab" style={{ marginTop: 6 }}>Reinforcement drawing</div><svg width="40" height="26" viewBox="0 0 40 26" fill="none" stroke="#111827" strokeWidth="1.6"><path d="M3 24V3h34v21" /></svg>
          <div style={{ fontSize: 13 }}>Grouped reinforcement: {ri.kg.toFixed(3)} kg × {inr2(ri.rate)}/kg = <b>{inr2(ri.cost)}</b></div></>}
        {pane && (role === 'Sash' || role === 'Bead') && <div style={{ fontSize: 12.5, margin: '8px 0', lineHeight: 1.6 }}>
          <div>Daylight {pane.dayW} × {pane.dayH} mm</div><div>Glass cut {Math.round(pane.w)} × {Math.round(pane.h)} mm</div>
          <div>Sash weight {pane.weight} kg <span className="muted">glass {pane.glassKg} kg · profile {pane.profKg} kg · GI {pane.giKg} kg</span></div></div>}
        {cut && <details className="calc"><summary>Calculation details</summary><table><tbody><tr><td>Weight</td><td>{cut.kg} kg</td></tr>{cut.lens.length > 0 && <tr><td>Cuts</td><td>{fmtLens(cut.lens)}</td></tr>}<tr><td>Rate</td><td>{cut.kg ? inr2(cut.cost / cut.kg) : '—'} / kg</td></tr></tbody></table></details>}
        {cut && <div className="ins-total"><span>Total length {cut.metres.toFixed(2)} m</span><b>{inr2(cut.cost)}</b></div>}
      </div>}
    </div>
  })}</div>
}
const PIE = ['#2563eb', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#db2777', '#65a30d', '#ea580c', '#475569', '#0d9488', '#a16207']
function Pie({ rows }) {
  const r = rows.filter(x => x[1] > 0), tot = r.reduce((a, x) => a + x[1], 0); let a0 = -Math.PI / 2
  return <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}><svg width="180" height="180" viewBox="-1 -1 2 2">{r.map((x, i) => { const a1 = a0 + 2 * Math.PI * x[1] / tot, big = a1 - a0 > Math.PI ? 1 : 0, p = `M0 0 L${Math.cos(a0)} ${Math.sin(a0)} A1 1 0 ${big} 1 ${Math.cos(a1)} ${Math.sin(a1)}Z`; a0 = a1; return <path key={x[0]} d={p} fill={PIE[i % PIE.length]} /> })}</svg>
    <div style={{ fontSize: 12.5 }}>{r.map((x, i) => <div key={x[0]}><i style={{ display: 'inline-block', width: 10, height: 10, background: PIE[i % PIE.length], marginRight: 6, borderRadius: 2 }} />{x[0]} · {Math.round(100 * x[1] / tot)}%</div>)}</div></div>
}
