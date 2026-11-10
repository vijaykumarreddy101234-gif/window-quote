import { useState } from 'react'
import { BayDrawing } from './Bay'
import { VSection, HSection, VSectionImg, HSectionImg, trackSpec } from './Sections'
import { useProfiles, profMm } from './profileClean'
// Design-driven elevation drawing (sliding n-panel, grid of casement/fixed/louvre/fan cells, arch, door, bay).
export function getDesign(item) {
  let d = item.design
  if (typeof d === 'string') { try { d = JSON.parse(d) } catch { d = null } }
  if (d && d.kind) return d
  const n = /(\d)[- ]?panel/i.exec(item.name || '')
  const mesh = item.mesh && item.mesh !== 'No mesh' ? 1 : 0
  if (item.type === 'sliding') return { kind: 'sliding', panels: n ? +n[1] : 2, mesh, door: /door/i.test(item.name + item.system) }
  if (item.type === 'combination' && /slid/i.test((item.system || '') + item.name)) return { kind: 'sliding', panels: 2, mesh: 0, fixedTop: .3 }
  if (item.type === 'combination') return /louvre/i.test(item.name) ? { kind: 'grid', cols: [{ w: 1, rows: [{ h: .6, op: 'LOUVRE' }, { h: .4, op: 'FIXED' }] }, { w: 1, rows: [{ h: .6, op: 'FAN' }, { h: .4, op: 'FIXED' }] }] } : { kind: 'grid', cols: [{ w: 1, rows: [{ h: .3, op: 'FIXED' }, { h: .7, op: 'RH' }] }] }
  if (item.type === 'fixed') return { kind: 'grid', cols: [{ w: 1, rows: [{ h: 1, op: 'FIXED' }] }] }
  return { kind: 'grid', door: /door/i.test((item.system || '') + ' ' + (item.name || '')), cols: [{ w: 1, rows: [{ h: 1, op: /fixed/i.test(item.name) ? 'FIXED' : 'RH' }] }] }
}
const STROKE = '#3f4a5a'
function Mitre({ x, y, w, h, t, fill = '#fbfbfa' }) {
  const P = pts => <polygon points={pts} fill={fill} stroke={STROKE} strokeWidth=".8" />
  return <g>{P(`${x},${y} ${x + w},${y} ${x + w - t},${y + t} ${x + t},${y + t}`)}{P(`${x + w},${y} ${x + w},${y + h} ${x + w - t},${y + h - t} ${x + w - t},${y + t}`)}
    {P(`${x},${y + h} ${x + w},${y + h} ${x + w - t},${y + h - t} ${x + t},${y + h - t}`)}{P(`${x},${y} ${x + t},${y + t} ${x + t},${y + h - t} ${x},${y + h}`)}</g>
}
function Glass({ x, y, w, h, mesh, tint }) {
  if (mesh) return <g><rect x={x} y={y} width={w} height={h} fill="url(#mesh)" stroke="#94a3b8" strokeWidth=".6" /></g>
  return <g><rect x={x} y={y} width={w} height={h} fill={tint || 'url(#gl)'} stroke="#8fb9d6" strokeWidth=".6" /><polygon points={`${x + w * .62},${y} ${x + w * .8},${y} ${x + w * .2},${y + h} ${x + w * .05},${y + h}`} fill="#fff" fillOpacity=".35" /></g>
}
const TINT = { Frosted: '#eef2f5', 'Tinted bronze': '#cdb79c', 'Tinted grey': '#aeb7bf', 'Reflective blue': '#8db6d9' }
import { WINDOW_COLORS } from './templates'
const PROF = Object.fromEntries(WINDOW_COLORS.filter(c => c[0] !== 'White'))


const circ = (x, y, n, key) => <g key={key}><circle cx={x} cy={y} r="8" fill="#fff" stroke="#334155" strokeWidth=".8" /><text x={x} y={y + 3.2} fontSize="9" textAnchor="middle" fill="#111">{n}</text></g>
const tag = (x, y, t, key, w = 22) => <g key={key}><rect x={x - w / 2} y={y} width={w} height="11" fill="#fff" stroke="#334155" strokeWidth=".6" /><text x={x} y={y + 8} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#111">{t}</text></g>
const Handle = ({ x, y, h = 18 }) => <rect x={x - 2.5} y={y - h / 2} width="5" height={h} rx="2.5" fill="#fff" stroke="#475569" strokeWidth=".9" />

export function archRise(D, W, H) {
  if (D.shape === 'arch') return Math.min(Math.round(W / 4), Math.round(H * .45))
  if (D.shape === 'half') return Math.min(Math.round(W / 2), Math.round(H * .7))
  return 0
}

export function WindowSvg({ item, engine, mode = '2d', side = 'inside', dims = false, mini = false, design, selected, onSelect, onCell, onDim, onGeom, onGeomStart }) {
  const [ed, setEd] = useState(null)
  const cuts0 = (engine && engine.cuts) || [], codeOf = r => (cuts0.find(c => c.role === r) || {}).code
  const codes = { frame: codeOf('Frame'), sash: codeOf('Sash'), bead: codeOf('Bead'), il: codeOf('Interlock'), mesh: codeOf('Mesh Sash'), mull: codeOf('Mullion') }
  const G = useProfiles(Object.values(codes))
  const D = design || getDesign(item), W = item.width, H = item.height
  if (D.bay && !mini && D.kind === 'grid' && (D.cols || []).length > 1) return <BayDrawing item={item} design={D} side={side} selected={selected} onSelect={onSelect} />
  const k = mini ? Math.min(150 / W, 150 / H) : Math.min(500 / W, 360 / H), w = W * k, h = H * k
  const frame = Math.max(6, 46 * k), sash = Math.max(5, 40 * k)
  const L = dims ? 128 : 6, T = dims ? 46 : 6, Rm = dims ? 76 : 6, B = dims ? 120 : 6
  const ox = L, oy = T, vw = w + L + Rm, vh = h + T + B
  const flip = side === 'outside'
  const fillP = PROF[D.colour?.Window] || '#fbfbfa', tint = TINT[D.colour?.Glass]
  const rise = archRise(D, W, H), rk = rise * k, tbar = rise ? Math.max(5, 40 * k) : 0
  const gsz = (nm, x, y) => { const p = engine && engine.panes && engine.panes.find(q => q.name === nm); return p && !p.mesh ? <text key={'gs' + nm} x={x} y={y} fontSize="5.5" textAnchor="middle" fill="#64748b">{Math.round(p.w)} × {Math.round(p.h)}</text> : null }
  // draggable mullions / transoms: fn(svgX, svgY) -> (design) => design
  const drag = fn => ev => {
    if (!onGeom) return; ev.stopPropagation(); ev.preventDefault(); const svg = ev.currentTarget.ownerSVGElement; let first = true
    const mv = e2 => { const pt = svg.createSVGPoint(); pt.x = e2.clientX; pt.y = e2.clientY; const q = pt.matrixTransform(svg.getScreenCTM().inverse()); if (first) { first = false; onGeomStart && onGeomStart() } onGeom(fn(q.x, q.y)) }
    const up = () => { window.removeEventListener('pointermove', mv); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up) }
    window.addEventListener('pointermove', mv); window.addEventListener('pointerup', up); window.addEventListener('pointercancel', up)
  }
  const grip = (key, x, y, len, vertical, fn) => onGeom && !mini ? <g key={key} className="geom-grip" style={{ cursor: vertical ? 'ew-resize' : 'ns-resize', touchAction: 'none' }} onPointerDown={drag(fn)}>
    <rect x={vertical ? x - 9 : x} y={vertical ? y : y - 9} width={vertical ? 18 : len} height={vertical ? len : 18} fill="transparent" />
    <rect x={vertical ? x - 3.5 : x + len / 2 - 14} y={vertical ? y + len / 2 - 14 : y - 3.5} width={vertical ? 7 : 28} height={vertical ? 28 : 7} rx="3.5" fill="#2563eb" stroke="#fff" strokeWidth="1" /></g> : null
  const clampSplit = (norm, i, b) => { const cum = norm.slice(0, i).reduce((a, c) => a + c, 0), p = norm[i] + norm[i + 1], mn = Math.min(.1, p / 3); return [Math.min(p - mn, Math.max(mn, b - cum)), p] }
  const body = [], grips = [], dimsV = [], dimsH = [], secPanes = [], colInfo = []
  const series = +(engine && engine.series) || +((/(\d+)\s*series/i.exec((item.system || '') + ' ' + (item.name || '')) || [])[1]) || 62
  const meshOn = (D.mesh || 0) > 0 || !!(item.mesh && item.mesh !== 'No mesh'), lanes = D.kind === 'sliding' ? (meshOn ? 3 : (D.panels || 2) > 2 || series >= 80 ? 3 : 2) : undefined
  const sp = Math.min(.8, 58 / trackSpec(series, lanes).depth), sp2 = Math.min(1.1, 62 / Math.max(profMm(codes.frame, 62), profMm(codes.sash, 60)))
  let num = 0
  const sel = (i) => onSelect ? { style: { cursor: onCell ? 'crosshair' : 'pointer' }, onClick: (ev) => { onSelect(i); if (onCell) { const r = ev.currentTarget.getBoundingClientRect(); onCell(i, (ev.clientX - r.left) / r.width, (ev.clientY - r.top) / r.height) } } } : {}
  const gb = (x, y, ww, hh) => D.georgian ? <g stroke="#94a3b8" strokeWidth="1.2">{[1, 2].map(j => <line key={'v' + j} x1={x + ww * j / 3} x2={x + ww * j / 3} y1={y} y2={y + hh} />)}{[1, 2].map(j => <line key={'h' + j} y1={y + hh * j / 3} y2={y + hh * j / 3} x1={x} x2={x + ww} />)}</g> : null

  // ---- arch / half-round top light (fixed, numbered 1) ----
  if (rise) {
    const cx = ox + w / 2, y0 = oy + rk, R = (w * w / 4 + rk * rk) / (2 * rk), yc = oy + R
    const arcP = (r, yb) => { const hw = Math.sqrt(Math.max(1, r * r - (yc - yb) * (yc - yb))); return `M${cx - hw},${yb} A${r},${r} 0 ${rk > w / 2 ? 1 : 0} 1 ${cx + hw},${yb} Z` }
    body.push(<g key="arch">
      <path d={arcP(R, y0)} fill={fillP} stroke={STROKE} strokeWidth="1.3" />
      <path d={arcP(R - frame * .5, y0)} fill="none" stroke={STROKE} strokeWidth=".7" />
      <path d={arcP(R - frame, y0 - 1)} fill={tint || 'url(#gl)'} stroke="#8fb9d6" strokeWidth=".7" />
      <path d={arcP(R - frame * 1.5, y0 - 1)} fill="none" stroke="#fff" strokeOpacity=".5" strokeWidth="1" />
      {dims && <>{tag(cx, y0 - rk * .55, 'F1', 'f1')}{tag(cx - 30, y0 - rk * .55 - 2, 'A', 'a', 12)}{circ(cx, y0 - rk * .55 + 24, ++num, 'n1')}</>}
    </g>)
  } else num = 0
  const y0 = oy + rk
  const rg = { x: ox + frame, y: y0 + (rise ? tbar : frame), w: w - 2 * frame, h: h - rk - (rise ? tbar : frame) - frame }
  if (rise) { rg.x = ox + frame * .8; rg.w = w - 1.6 * frame }
  const numOff = num

  // ---- main region ----
  if (rise) body.push(<rect key="tb" x={ox} y={y0 - 1} width={w} height={tbar + 1} fill={fillP} stroke={STROKE} strokeWidth=".9" />)
  body.push(<Mitre key="fr" x={ox} y={y0} w={w} h={h - rk} t={frame} fill={fillP} />)
  const colsW = []
  if (D.kind === 'sliding') {
    const n = D.panels || 2, mesh = D.mesh || 0, top = D.fixedTop ? rg.h * D.fixedTop : 0
    let iy = rg.y, ih = rg.h
    if (top) { body.push(<Glass key="ft" x={rg.x} y={rg.y} w={rg.w} h={top} tint={tint} />, <rect key="mu" x={rg.x} y={rg.y + top} width={rg.w} height={frame * .8} fill={fillP} stroke={STROKE} strokeWidth=".8" />); if (dims) body.push(tag(rg.x + rg.w / 2, rg.y + top / 2 - 6, 'F1', 'ftl'), circ(rg.x + rg.w / 2, rg.y + top / 2 + 16, ++num, 'ftn')); iy = rg.y + top + frame * .8; ih = rg.h - top - frame * .8 }
    const strip = ih > 60 ? Math.min(10, ih * .04) : 0
    const sh = ih - strip, ov = sash * .45, pw0 = (rg.w + (n - 1) * ov) / n
    const centre = n === 3 && !!(D.centre || mesh > 0)
    const dwRaw = Array.isArray(D.widths) && D.widths.length === n && D.widths.reduce((a, b) => a + (+b || 0), 0) > 0 ? D.widths.map(Number) : (centre ? [.25, .5, .25] : null)
    const dwOk = !!dwRaw, dwSum = dwOk ? dwRaw.reduce((a, b) => a + b, 0) : 1
    const dirOf = (i, dflt) => { const v = D.dirs && D.dirs[i]; return v === 'L' ? -1 : v === 'R' ? 1 : v === 'B' ? 0 : dflt }
    const leaves = Array.from({ length: n }, (_, i) => { const dflt = centre ? (i === 0 ? 1 : i === 2 ? -1 : 1) : (i % 2 ? -1 : 1), m = centre ? (mesh > 0 && i !== 1) : i >= n - mesh
      if (dwOk) { const c0 = dwRaw.slice(0, i).reduce((a, b) => a + b, 0), x0 = rg.x + rg.w * c0 / dwSum - (i > 0 ? ov / 2 : 0), x1 = rg.x + rg.w * (c0 + dwRaw[i]) / dwSum + (i < n - 1 ? ov / 2 : 0); return { x: x0, w: x1 - x0, m, d: dirOf(i, dflt) } }
      return { x: rg.x + i * (pw0 - ov), w: pw0, m, d: dirOf(i, dflt) } })
    body.push(<Glass key="bg" x={rg.x} y={iy} w={rg.w} h={ih} tint={tint} />)
    leaves.forEach((lf, i) => {
      const { x, w: pw, m: isMesh } = lf, cx = x + pw / 2, nn = ++num
      secPanes.push({ x0: x - ox + (i > 0 ? ov / 2 : 0), x1: x - ox + pw - (i < n - 1 ? ov / 2 : 0), lane: isMesh ? Math.min(2, lanes - 1) : i % 2, mesh: isMesh })
      const m62 = isMesh && (engine && engine.meshCode === 'RSM-62MM' || (D.profiles && D.profiles.mesh === 'RSM-62MM')), mt = isMesh ? sash * (m62 ? .85 : .7) : sash
      body.push(<g key={i} {...sel(i)}>
        <Mitre x={x} y={iy} w={pw} h={sh} t={mt} fill={fillP} /><Glass x={x + mt} y={iy + mt} w={pw - 2 * mt} h={sh - 2 * mt} mesh={isMesh} tint={tint} />
        {!isMesh && <g>{gb(x + sash, iy + sash, pw - 2 * sash, sh - 2 * sash)}</g>}
        {selected === i && <rect x={x} y={iy} width={pw} height={sh} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 2" />}
        {dims && <>{tag(cx, iy + sh * .18, centre ? ['S1', 'F1', 'S2'][i] : 'S' + (i + 1), 's' + i)}{isMesh && <text x={cx} y={iy + sh * .18 + 24} fontSize="7" textAnchor="middle" fill="#475569" fontWeight="700">{{ 'RSM-62MM': 'MESH 62', 'RSS-60ES': 'MESH 60x35', 'RSS-75ES': 'MESH 75x35', 'RSS-59SS': 'MESH 59', 'RSS-67MS': 'MESH 67', 'RSS-84BS': 'MESH 84' }[(engine && engine.meshCode) || (D.profiles && D.profiles.mesh)] || 'MESH 53'}</text>}{circ(cx, iy + sh / 2, nn, 'n' + i)}{gsz(centre ? ['S1', 'F1', 'S2'][i] : 'S' + (i + 1), cx, iy + sh / 2 + 18)}</>}
        {centre && i === 1 && <text x={cx} y={iy + sh * .62} fontSize="12" textAnchor="middle" fill="#64748b">+</text>}
        {(!isMesh || centre) && !(centre && i === 1) && (() => { const both = lf.d === 0, dir = (both ? 1 : lf.d) * (flip ? -1 : 1), ay = iy + sh * .62, a0 = cx - dir * pw * .3, a1 = cx + dir * pw * .3; return <g stroke="#1d4ed8" fill="#1d4ed8" strokeWidth="1.3"><line x1={a0} x2={a1} y1={ay} y2={ay} /><polygon points={`${a1},${ay - 3.5} ${a1},${ay + 3.5} ${a1 + dir * 7},${ay}`} />{both && <polygon points={`${a0},${ay - 3.5} ${a0},${ay + 3.5} ${a0 - dir * 7},${ay}`} />}</g> })()}
        {(i === 0 || i === n - 1) && (!isMesh || centre) && <Handle x={i === 0 ? x + sash * .5 : x + pw - sash * .5} y={iy + sh / 2} />}
      </g>)
      colsW.push(dwOk ? W * dwRaw[i] / dwSum : W / n)
    })
    if (onGeom && dwOk) { const norm = dwRaw.map(v => v / dwSum); for (let i = 0; i < n - 1; i++) { const bx = rg.x + rg.w * norm.slice(0, i + 1).reduce((a, c) => a + c, 0); grips.push(grip('sg' + i, bx, iy, sh, true, sx => { const [nl, pp] = clampSplit(norm, i, (sx - rg.x) / rg.w), nl2 = Math.round(nl * 1000) / 1000; return d => ({ ...d, widths: norm.map((v, k) => k === i ? nl2 : k === i + 1 ? +(pp - nl2).toFixed(3) : +v.toFixed(3)) }) })) } }
    if (onGeom && top) grips.push(grip('sgt', rg.x, rg.y + top, rg.w, false, (sx, sy) => d => ({ ...d, fixedTop: Math.round(Math.min(.6, Math.max(.1, (sy - rg.y) / rg.h)) * 100) / 100 })))
    if (strip) body.push(<rect key="tr" x={rg.x} y={iy + sh} width={rg.w} height={strip} fill="#e5e9ef" stroke={STROKE} strokeWidth=".8" />)
    if (top) dimsV.push([rg.y - frame, rg.y + top, Math.round(H * D.fixedTop), 'a'])
  } else {
    const cols = D.cols || [], tw = cols.reduce((a, c) => a + c.w, 0) || 1
    let cx = rg.x, idx = 0
    cols.forEach((c, ci) => {
      const cw = rg.w * c.w / tw, th = c.rows.reduce((a, r) => a + r.h, 0) || 1
      let cy = rg.y; colsW.push(W * c.w / tw)
      c.rows.forEach((r, ri) => {
        const ch = rg.h * r.h / th, x = cx + (ci ? frame * .3 : 0), y = cy + (ri ? frame * .3 : 0), ww = cw - (ci ? frame * .3 : 0), hh = ch - (ri ? frame * .3 : 0); idx++
        const open = r.op !== 'FIXED' && r.op !== 'LOUVRE' && r.op !== 'FAN', cur = idx, nn = ++num
        const g = []
        if (open) {
          const t = D.door ? sash * 1.5 : sash
          g.push(<Mitre key="m" x={x} y={y} w={ww} h={hh} t={t} fill={fillP} />, <Glass key="g" x={x + t} y={y + t} w={ww - 2 * t} h={hh - 2 * t} tint={tint} />)
          const gx = x + t, gy = y + t, gw = ww - 2 * t, gh = hh - 2 * t
          g.push(<g key="gb">{gb(gx, gy, gw, gh)}</g>)
          const hingeLeft = (r.op === 'LH') !== flip
          if (r.op === 'TOP') g.push(<polyline key="sw" points={`${gx},${gy + gh} ${gx + gw / 2},${gy} ${gx + gw},${gy + gh}`} stroke="#475569" strokeWidth=".9" strokeDasharray="4 3" fill="none" />)
          else if (r.op === 'TT') g.push(<g key="sw" stroke="#475569" strokeWidth=".9" strokeDasharray="4 3" fill="none"><polyline points={`${gx},${gy + gh} ${gx + gw / 2},${gy} ${gx + gw},${gy + gh}`} /><polyline points={`${gx + gw},${gy} ${gx},${gy + gh / 2} ${gx + gw},${gy + gh}`} /></g>)
          else g.push(<polyline key="sw" points={`${hingeLeft ? gx + gw : gx},${gy} ${hingeLeft ? gx : gx + gw},${gy + gh / 2} ${hingeLeft ? gx + gw : gx},${gy + gh}`} stroke="#475569" strokeWidth=".9" strokeDasharray="4 3" fill="none" />)
          if (r.op !== 'TOP') g.push(<Handle key="h" x={hingeLeft ? x + ww - t * .5 : x + t * .5} y={y + hh / 2} />)
          else g.push(<rect key="h" x={x + ww / 2 - 9} y={y + hh - t * .75} width="18" height="5" rx="2.5" fill="#fff" stroke="#475569" strokeWidth=".9" />)
          if (dims) g.push(tag(gx + gw / 2, gy + 2, 'C' + cur, 'lab'), circ(gx + gw / 2, gy + gh / 2, nn, 'n'), gsz('C' + cur, gx + gw / 2, gy + gh / 2 + 18))
        } else if (r.op === 'LOUVRE') {
          g.push(<rect key="r" x={x} y={y} width={ww} height={hh} fill={fillP} stroke={STROKE} strokeWidth=".8" />)
          for (let s = y + 4; s < y + hh - 6; s += 8) g.push(<rect key={'s' + s} x={x + 3} y={s} width={ww - 6} height="5" fill="#eef1f4" stroke="#64748b" strokeWidth=".5" />)
          if (dims) g.push(circ(x + ww / 2, y + hh / 2, nn, 'n'))
        } else if (r.op === 'FAN') {
          g.push(<rect key="r" x={x} y={y} width={ww} height={hh} fill={fillP} stroke={STROKE} strokeWidth=".8" />, <circle key="c" cx={x + ww / 2} cy={y + hh / 2} r={Math.min(ww, hh) * .38} fill="#fff" stroke="#475569" strokeWidth=".9" />)
          for (let a = 0; a < 4; a++) g.push(<ellipse key={'b' + a} cx={x + ww / 2} cy={y + hh / 2 - Math.min(ww, hh) * .17} rx={Math.min(ww, hh) * .08} ry={Math.min(ww, hh) * .17} fill="#cbd5e1" stroke="#64748b" strokeWidth=".5" transform={`rotate(${a * 90} ${x + ww / 2} ${y + hh / 2})`} />)
          if (dims) g.push(circ(x + ww / 2, y + hh / 2, nn, 'n'))
        } else {
          g.push(<Glass key="g" x={x + (ww > 40 ? 0 : 0)} y={y} w={ww} h={hh} tint={tint} />, <g key="gb">{gb(x, y, ww, hh)}</g>)
          if (dims) g.push(tag(x + ww / 2, y + 4, 'F' + cur, 'lab'), circ(x + ww / 2, y + hh / 2, nn, 'n'), gsz('C' + cur, x + ww / 2, y + hh / 2 + 18))
        }
        body.push(<g key={ci + '-' + ri} {...sel(cur - 1)}>{g}{selected === cur - 1 && <rect x={x} y={y} width={ww} height={hh} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 2" />}</g>)
        if (ri && onGeom) { const rn = c.rows.map(q => q.h / th), cc = ci; grips.push(grip('tg' + ci + '-' + ri, cx, cy, cw, false, (sx, sy) => { const [nt, pp] = clampSplit(rn, ri - 1, (sy - rg.y) / rg.h), n2 = Math.round(nt * 1000) / 1000; return d => ({ ...d, cols: d.cols.map((q, k) => k === cc ? { ...q, rows: q.rows.map((r2, j) => ({ ...r2, h: j === ri - 1 ? n2 : j === ri ? +(pp - n2).toFixed(3) : +rn[j].toFixed(3) })) } : q) }) })) }
        if (ri) body.push(<rect key={'tm' + ci + ri} x={cx} y={cy - frame * .3} width={cw} height={frame * .6} fill={fillP} stroke={STROKE} strokeWidth=".8" />)
        if (ci === 0 && c.rows.length > 1 && ri < c.rows.length - 1) dimsV.push([ri === 0 ? rg.y - frame : dimsV[dimsV.length - 1][1], cy + ch, Math.round(H * r.h / th * (1 - rk / h)), 'r' + ri])
        cy += ch
      })
      if (ci && onGeom) { const cn = cols.map(q => q.w / tw), cc = ci; grips.push(grip('mg' + ci, cx, rg.y, rg.h, true, sx => { const [nl, pp] = clampSplit(cn, cc - 1, (sx - rg.x) / rg.w), n2 = Math.round(nl * 1000) / 1000; return d => ({ ...d, cols: d.cols.map((q, k) => ({ ...q, w: k === cc - 1 ? n2 : k === cc ? +(pp - n2).toFixed(3) : +cn[k].toFixed(3) })) }) })) }
      colInfo.push({ x0: cx - ox, x1: cx - ox + cw, open: c.rows.some(r => r.op !== 'FIXED' && r.op !== 'LOUVRE' && r.op !== 'FAN') })
      if (ci) body.push(<rect key={'mu' + ci} x={cx - frame * .3} y={rg.y} width={frame * .6} height={rg.h} fill={fillP} stroke={STROKE} strokeWidth=".8" />)
      cx += cw
    })
  }

  // ---- dimensions ----
  const editable = key => onDim && /^(W|H|cw\d+|r\d+|rest)$/.test(key)
  const open = (key, x, y, label) => editable(key) && setEd({ key, x, y, val: String(label) })
  const tickH = (x1, x2, y, label, key) => <g key={key} stroke="#334155" fill="#334155" style={editable(key) ? { cursor: 'text' } : undefined} onClick={() => open(key, (x1 + x2) / 2, y, label)}><line x1={x1} y1={y} x2={x2} y2={y} strokeWidth=".8" markerStart="url(#dm)" markerEnd="url(#dm)" /><rect x={(x1 + x2) / 2 - 15} y={y - 6.5} width="30" height="13" fill="#fff" stroke="#334155" strokeWidth=".6" /><text x={(x1 + x2) / 2} y={y + 3.5} fontSize="8.5" fontWeight="700" textAnchor="middle" stroke="none" fill="#111">{label}</text></g>
  const tickV = (y1, y2, x, label, key) => <g key={key} stroke="#334155" fill="#334155" style={editable(key) ? { cursor: 'text' } : undefined} onClick={() => open(key, x, (y1 + y2) / 2, label)}><line x1={x} y1={y1} x2={x} y2={y2} strokeWidth=".8" markerStart="url(#dm)" markerEnd="url(#dm)" /><rect x={x - 15} y={(y1 + y2) / 2 - 6.5} width="30" height="13" fill="#fff" stroke="#334155" strokeWidth=".6" /><text x={x} y={(y1 + y2) / 2 + 3.5} fontSize="8.5" fontWeight="700" textAnchor="middle" stroke="none" fill="#111">{label}</text></g>
  const dimEls = []
  if (dims) {
    dimEls.push(tickH(ox, ox + w, oy - 24, W, 'W'), tickV(oy, oy + h, ox - 26, H, 'H'))
    const sw = []; let xx = ox
    if (colsW.length > 1) { colsW.forEach((cw, i) => { const x2 = xx + cw * k; sw.push(<g key={'c' + i}>{tickH(xx, x2, oy + h + 22, Math.round(cw), 'cw' + i)}<line x1={x2} x2={x2} y1={oy + h + 14} y2={oy + h + 30} stroke="#334155" strokeWidth=".8" /></g>); xx = x2 }); dimEls.push(...sw) }
    if (rise) { dimEls.push(tickV(oy, y0, ox + w + 26, rise, 'rise'), tickV(y0, oy + h, ox + w + 26, H - rise, 'base')) }
    else if (dimsV.length) { dimsV.forEach(([a, b, v, kk]) => dimEls.push(tickV(a, b, ox + w + 26, v, kk))); const last = dimsV[dimsV.length - 1][1]; dimEls.push(tickV(last, oy + h - frame * .2, ox + w + 26, Math.round(H - dimsV.reduce((s, d) => s + d[2], 0)), 'rest')) }
  }
  const iso = mode === '3d'
  const psz = mini ? {} : { maxWidth: '100%', height: 'auto', maxHeight: 'calc(100vh - 300px)' }
  return (
    <svg viewBox={`0 0 ${vw + (iso ? 30 : 0)} ${vh + (iso ? 20 : 0)}`} width={mini ? '100%' : Math.max(vw * 1.25, 560)} height={mini ? '100%' : undefined} style={{ display: 'block', margin: '0 auto', ...psz }}>
      <defs><linearGradient id="gl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3f1fa" /><stop offset="1" stopColor="#d5e9f6" /></linearGradient>
        <pattern id="mesh" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="5" height="5" fill="#eaf1f7" /><path d="M0 0H5M0 0V5" stroke="#7b8da1" strokeWidth=".5" /></pattern>
        <marker id="dm" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L0,6 L6,3 z" fill="#334155" /></marker></defs>
      {iso && <g opacity=".35"><polygon points={`${ox + w},${oy} ${ox + w + 22},${oy - 14} ${ox + w + 22},${oy + h - 14} ${ox + w},${oy + h}`} fill="#94a3b8" /><polygon points={`${ox},${oy} ${ox + 22},${oy - 14} ${ox + w + 22},${oy - 14} ${ox + w},${oy}`} fill="#b6c0cc" /></g>}
      {body}
      {grips}
      {dimEls}
      {dims && !D.bay && <g transform={`translate(${ox - 104},${oy})`}>{G(codes.frame) ? <VSectionImg codes={codes} G={G} h={h} sp={sp2} lanes={lanes} mesh={meshOn} casement={D.kind !== 'sliding'} /> : <VSection series={series} lanesHint={lanes} h={h} sp={sp} mesh={meshOn} casement={D.kind !== 'sliding'} />}
        <text transform="rotate(-90)" x={-h / 2 + 8} y="-4" fontSize="7.5" fontWeight="700" fill="#334155" textAnchor="middle">{flip ? 'IN' : 'OUT'}</text><text transform="rotate(-90)" x={-h / 2 - 22} y="-4" fontSize="7.5" fontWeight="700" fill="#334155" textAnchor="middle">{flip ? 'OUT' : 'IN'}</text></g>}
      {dims && !D.bay && <g transform={`translate(${ox},${oy + h + 48})`}>{G(codes.frame) ? <HSectionImg codes={codes} G={G} w={w} sp={sp2} lanes={lanes} panes={secPanes} cols={colInfo} casement={D.kind !== 'sliding'} /> : <HSection series={series} lanesHint={lanes} w={w} sp={sp} panes={secPanes} cols={colInfo} casement={D.kind !== 'sliding'} />}
        <text x={w + 8} y="8" fontSize="7.5" fontWeight="700" fill="#334155">{flip ? 'IN' : 'OUT'}</text><text x={w + 8} y="36" fontSize="7.5" fontWeight="700" fill="#334155">{flip ? 'OUT' : 'IN'}</text></g>}
      {ed && <foreignObject x={ed.x - 34} y={ed.y - 13} width="92" height="26"><div xmlns="http://www.w3.org/1999/xhtml" style={{ display: 'flex', alignItems: 'center', gap: 3, background: '#fff', border: '1.5px solid #2563eb', borderRadius: 6, padding: '1px 4px', height: 24, boxSizing: 'border-box' }}>
        <input autoFocus type="number" min="1" value={ed.val} onChange={ev => setEd({ ...ed, val: ev.target.value })} onFocus={ev => ev.target.select()}
          onKeyDown={ev => { if (ev.key === 'Enter') { const v = Math.round(+ed.val); if (v > 0) onDim(ed.key, v); setEd(null) } else if (ev.key === 'Escape') setEd(null) }} onBlur={() => setEd(null)}
          style={{ width: 52, border: 0, outline: 0, fontSize: 11, fontWeight: 700, background: 'transparent' }} /><span style={{ fontSize: 9, color: '#64748b' }}>mm</span></div></foreignObject>}
    </svg>)
}
