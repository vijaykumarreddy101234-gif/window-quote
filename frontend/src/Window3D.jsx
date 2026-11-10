// 3D & whole-window sections viewer (three.js), driven by the same design JSON as the 2D drawing.
import { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { getDesign } from './WindowSvg'
import { WINDOW_COLORS } from './templates'

const PROFILE_COL = Object.fromEntries(WINDOW_COLORS)
function meshTexture(w = 800, h = 800) {
  // fine woven fly-mesh: small square weave repeated across the shutter (one cell ~ 10 mm)
  const c = document.createElement('canvas'); c.width = c.height = 16; const g = c.getContext('2d')
  g.fillStyle = 'rgba(205,214,224,.28)'; g.fillRect(0, 0, 16, 16); g.strokeStyle = 'rgba(55,70,90,.85)'; g.lineWidth = 1.6
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 16); g.moveTo(0, 0); g.lineTo(16, 0); g.stroke()
  const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(Math.max(1, w / 12), Math.max(1, h / 12)); t.anisotropy = 4; return t
}

function buildUnit(D, W, H, mats, fz, depth) {
  const g = new THREE.Group(); const box = (x, y, z, w, h, d, m, layer) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); b.position.set(x, y, z); b.userData.layer = layer; g.add(b); return b }
  const F = 55, hx = W / 2, hy = H / 2, MT = (D.profiles && D.profiles.mesh === 'RSM-62MM') || D.meshCode === 'RSM-62MM' ? 46 : 36
  const frame = (w, h, cx, cy, t, d, z, layer = 'frame') => { box(cx, cy + h / 2 - t / 2, z, w, t, d, mats.prof, layer); box(cx, cy - h / 2 + t / 2, z, w, t, d, mats.prof, layer); box(cx - w / 2 + t / 2, cy, z, t, h - 2 * t, d, mats.prof, layer); box(cx + w / 2 - t / 2, cy, z, t, h - 2 * t, d, mats.prof, layer) }
  const glass = (w, h, cx, cy, z, mesh) => { const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, mesh ? 2 : 5), mesh ? mats.mesh(w, h) : mats.glass); b.position.set(cx, cy, z); b.userData.layer = mesh ? 'mesh' : 'glass'; g.add(b) }
  frame(W, H, 0, 0, F, depth, 0)
  if (D.kind === 'sliding') {
    const n = D.panels || 2, mesh = D.mesh || 0, iw = W - 2 * F, ih = H - 2 * F - 12, door = !!D.door
    if (n === 3 && (D.centre || mesh)) {
      const ws = [iw / 4, iw / 2, iw / 4]; let x = -iw / 2
      ws.forEach((w, i) => { const cx = x + w / 2; x += w; const isM = !!mesh && i !== 1
        frame(w + 20, ih, cx, 6, 45, 35, isM ? depth * .28 : -depth * .05, 'sash'); glass(w - 70, ih - 70, cx, 6, isM ? depth * .28 : -depth * .05, false)
        if (isM) { frame(w + 10, ih, cx, 6, MT, 20, depth * .4, 'sash'); glass(w - 2 * MT - 10, ih - 2 * MT - 10, cx, 6, depth * .4, true) } })
    } else {
      const pw = iw / n
      for (let i = 0; i < n; i++) { const cx = -iw / 2 + pw * (i + .5), z = (i % 2 ? 1 : -1) * depth * .17, w = pw + 36
        frame(w, ih, cx, 6, 50, 36, z, 'sash'); glass(w - 100, ih - 100, cx, 6, z, false) }
      if (mesh) { const cx = iw / 2 - pw / 2; frame(pw, ih, cx, 6, MT, 20, depth * .4, 'sash'); glass(pw - 2 * MT, ih - 2 * MT, cx, 6, depth * .4, true) }
    }
    box(0, -hy + F + 6, 0, iw, 12, depth * .8, mats.prof, 'frame'); if (D.fixedTop) { /* fixed light rendered via mullion */ box(0, hy - F - ih * .25, 0, iw, 50, depth * .5, mats.prof, 'frame') }
  } else {
    const cols = D.cols || [], tw = cols.reduce((a, c) => a + c.w, 0) || 1, iw = W - 2 * F, ih = H - 2 * F; let x = -iw / 2
    cols.forEach((c, ci) => { const cw = iw * c.w / tw, th = c.rows.reduce((a, r) => a + r.h, 0) || 1; let y = hy - F
      c.rows.forEach((r, ri) => { const ch = ih * r.h / th, cx = x + cw / 2, cy = y - ch / 2, open = !['FIXED', 'LOUVRE', 'FAN'].includes(r.op)
        if (open) { const t = D.door ? 84 : 60; frame(cw - 8, ch - 8, cx, cy, t, depth * .7, depth * .1, 'sash'); glass(cw - 8 - 2 * t + 20, ch - 8 - 2 * t + 20, cx, cy, depth * .1, false)
          const hl = (r.op === 'LH'); box(cx + (hl ? 1 : -1) * (cw / 2 - t / 2 - 6), cy, depth * .1 + depth * .4, 14, 100, 20, mats.metal, 'hardware') }
        else if (r.op === 'LOUVRE') { for (let s = cy - ch / 2 + 20; s < cy + ch / 2 - 20; s += 34) { const sl = box(cx, s, 0, cw - 40, 24, 14, mats.glassOpaque, 'louvre'); sl.rotation.x = -0.5 } }
        else if (r.op === 'FAN') { const cyl = new THREE.Mesh(new THREE.CylinderGeometry(Math.min(cw, ch) * .38, Math.min(cw, ch) * .38, 30, 32), mats.metal); cyl.rotation.x = Math.PI / 2; cyl.position.set(cx, cy, 0); cyl.userData.layer = 'hardware'; g.add(cyl) }
        else glass(cw - 40, ch - 40, cx, cy, 0, false)
        if (ri) box(cx, y, 0, cw, 55, depth * .8, mats.prof, 'frame'); y -= ch })
      if (ci) box(x, 0, 0, 55, ih, depth * .8, mats.prof, 'frame'); x += cw })
  }
  return g
}

export function Window3D({ item, design, engine }) {
  const ref = useRef(), st = useRef({})
  const [az, setAz] = useState(32), [el, setEl] = useState(12), [expl, setExpl] = useState(0), [transp, setTransp] = useState(false), [showGlass, setShowGlass] = useState(true), [cutH, setCutH] = useState(false), [cutV, setCutV] = useState(false), [model, setModel] = useState('whole'), [zoom, setZoom] = useState(1)
  const D = design || getDesign(item), W = item.width, H = item.height
  const depth = engine && engine.options ? (engine.options[0].selected && /112|95/.test(engine.options[0].selected) ? 124 : /80|92/.test(engine.options[0].selected) ? 102.4 : 82) : 82
  // scene setup
  useEffect(() => {
    const el0 = ref.current; const w = el0.clientWidth || 600, h = 330
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true }); renderer.setSize(w, h); renderer.localClippingEnabled = true; el0.appendChild(renderer.domElement)
    const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, w / h, 10, 60000)
    scene.add(new THREE.HemisphereLight(0xffffff, 0xd8cfc6, 1.9)); const dl = new THREE.DirectionalLight(0xffffff, 1.0); dl.position.set(-1200, 1600, 2200); scene.add(dl)
    st.current = { renderer, scene, cam }
    return () => { renderer.dispose(); el0.removeChild(renderer.domElement) }
  }, [])
  // geometry
  useEffect(() => {
    const { scene } = st.current; if (!scene) return
    if (st.current.grp) { scene.remove(st.current.grp); st.current.grp.traverse(o => { o.geometry && o.geometry.dispose() }) }
    const pc = PROFILE_COL[D.colour?.Window || 'White'] || '#f8f8f6'
    const mk = (extra) => ({ transparent: transp, opacity: transp ? .3 : 1, ...extra })
    const mats = { prof: new THREE.MeshStandardMaterial(mk({ color: pc, roughness: .55 })), metal: new THREE.MeshStandardMaterial({ color: '#c9d0d8', metalness: .3, roughness: .45 }),
      glass: new THREE.MeshPhysicalMaterial({ color: '#bfe3f5', transparent: true, opacity: .38, roughness: .05 }), glassOpaque: new THREE.MeshStandardMaterial({ color: '#e8edf2' }),
      mesh: (w, h) => new THREE.MeshBasicMaterial({ map: meshTexture(w, h), transparent: true, side: THREE.DoubleSide }) }
    const grp = new THREE.Group(); const bay = D.bay && D.kind === 'grid' && D.cols.length > 1
    if (bay) {
      const types = D.bayType || 'corner', cs = D.cols; const total = cs.reduce((a, c) => a + c.w, 0)
      const unit = (cols, w) => buildUnit({ ...D, bay: false, cols }, w, H, mats, 0, depth)
      if (types === 'corner' || !types) { const wL = W * (cs[0].w + (cs.length > 2 ? cs[1].w : 0)) / total, wR = W - wL
        const a = unit(cs.slice(0, Math.ceil(cs.length / 2)), wL); a.position.set(-wR / 2, 0, 0); const b = unit(cs.slice(Math.ceil(cs.length / 2)), wR); b.rotation.y = -Math.PI / 2; b.position.set(wL / 2, 0, wR / 2); grp.add(a, b) }
      else { const ang = types === 'splay' ? Math.PI / 4 : Math.PI / 2, wc = W / 2, ws = W / 4; const c = unit(cs.slice(1, 2), wc); const l = unit(cs.slice(0, 1), ws), r = unit(cs.slice(2), ws)
        l.rotation.y = ang; l.position.set(-wc / 2 - ws / 2 * Math.cos(ang), 0, ws / 2 * Math.sin(ang)); r.rotation.y = -ang; r.position.set(wc / 2 + ws / 2 * Math.cos(ang), 0, ws / 2 * Math.sin(ang)); grp.add(c, l, r) }
    } else grp.add(buildUnit(engine && engine.meshCode ? { ...D, meshCode: engine.meshCode } : D, W, H, mats, 0, depth))
    scene.add(grp); st.current.grp = grp; st.current.mats = mats
  }, [JSON.stringify(D), W, H, transp, depth, engine && engine.meshCode])
  // view params
  useEffect(() => {
    const { renderer, scene, cam, grp } = st.current; if (!grp) return
    const R = 1.3 * Math.max(1.87 * H, 1.06 * W) / zoom, a = az * Math.PI / 180, e = el * Math.PI / 180
    cam.position.set(R * Math.sin(a) * Math.cos(e), R * Math.sin(e), R * Math.cos(a) * Math.cos(e)); cam.lookAt(0, 0, 0)
    const planes = []; if (cutH) planes.push(new THREE.Plane(new THREE.Vector3(0, -1, 0), 0)); if (cutV) planes.push(new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0))
    grp.traverse(o => { if (!o.isMesh) return; const L = o.userData.layer
      o.visible = (L !== 'glass' && L !== 'mesh' || showGlass) && (model === 'whole' || (model === 'frame' && L === 'frame') || (model === 'sashes' && (L === 'sash' || L === 'glass' || L === 'mesh' || L === 'hardware')))
      const m = o.material; m.clippingPlanes = planes; m.clipShadows = true; m.side = THREE.DoubleSide
      const base = o.userData.base ?? (o.userData.base = o.position.z); const k = L === 'sash' || L === 'glass' || L === 'mesh' || L === 'hardware' ? 1 : L === 'louvre' ? .5 : 0; o.position.z = base + k * expl * 3.5 })
    renderer.render(scene, cam)
  }, [az, el, expl, showGlass, cutH, cutV, model, zoom, transp, JSON.stringify(D), W, H, depth])
  const drag = useRef(null)
  return <div className="v3d">
    <h4 style={{ margin: '4px 0' }}>3D & whole-window sections</h4>
    <div className="muted" style={{ fontSize: 13 }}>{W} × {H} × {depth} mm · pack v31</div>
    <div className="v3row"><span className="muted">Inspect model</span><select className="sel" style={{ width: 'auto' }} value={model} onChange={ev => setModel(ev.target.value)}><option value="whole">Whole window · nominal depth</option><option value="frame">Outer frame only</option><option value="sashes">Sashes, glass and hardware</option></select>
      <button className="icon-btn" onClick={() => setZoom(z => Math.min(3, z * 1.2))} title="Zoom in">🔍</button><button className="icon-btn" onClick={() => setZoom(z => Math.max(.4, z / 1.2))} title="Zoom out">🔎</button></div>
    <div className="v3wrap">
      <div className="v3stage" onPointerDown={ev => { drag.current = [ev.clientX, ev.clientY] }} onPointerUp={() => { drag.current = null }} onPointerLeave={() => { drag.current = null }}
        onPointerMove={ev => { if (!drag.current) return; const dx = ev.clientX - drag.current[0], dy = ev.clientY - drag.current[1]; drag.current = [ev.clientX, ev.clientY]; setAz(a => Math.max(-85, Math.min(85, a + dx * .4))); setEl(e => Math.max(-40, Math.min(60, e + dy * .4))) }}>
        <div ref={ref} />
        <input className="az" type="range" min="-85" max="85" value={az} onChange={ev => setAz(+ev.target.value)} aria-label="Rotate horizontally" />
        <input className="elv" type="range" min="-40" max="60" value={el} onChange={ev => setEl(+ev.target.value)} aria-label="Rotate vertically" />
      </div>
      <div className="v3side"><div className="muted" style={{ fontSize: 12, fontWeight: 700 }}>Vertical B–B at {Math.round(W / 2)}.0 mm</div><SectionSvg H={H} depth={depth} /><div className="muted" style={{ fontSize: 11 }}>Traced installed sections; chambers remain voids. depth → / Y ↓</div></div>
    </div>
    <div className="v3row"><span>Exploded view</span><input type="range" min="0" max="100" value={expl} onChange={ev => setExpl(+ev.target.value)} style={{ flex: 1 }} />
      <label><input type="checkbox" checked={transp} onChange={ev => setTransp(ev.target.checked)} /> Transparent profiles</label><label><input type="checkbox" checked={showGlass} onChange={ev => setShowGlass(ev.target.checked)} /> Show glass</label></div>
    <div className="v3row"><b>Cut away 3D</b><label><input type="checkbox" checked={cutH} onChange={ev => setCutH(ev.target.checked)} /> Horizontal A–A</label><label><input type="checkbox" checked={cutV} onChange={ev => setCutV(ev.target.checked)} /> Vertical B–B</label></div>
    <div style={{ borderTop: '2px solid #dc2626', margin: '8px 0' }} />
    <b>Horizontal A–A at {Math.round(H / 2)}.0 mm</b><div className="muted" style={{ fontSize: 12 }}>Traced installed sections; chambers remain voids. X → / depth ↓</div>
    <PlanSvg W={W} depth={depth} D={D} />
  </div>
}
function SectionSvg({ H, depth }) {
  const d = depth / 2.2
  return <svg viewBox="0 0 80 240" width="100%" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>{[10, 190].map(y => <g key={y} stroke="#334155" strokeWidth="1" fill="#fff"><rect x={40 - d / 2} y={y} width={d} height="40" rx="2" /><rect x={40 - d / 2 + 4} y={y + 5} width={d / 3} height="12" fill="#e8eef5" /><rect x={40 - d / 2 + d / 2} y={y + 22} width={d / 3} height="12" fill="#e8eef5" /></g>)}<line x1="40" y1="50" x2="40" y2="190" stroke="#2563eb" strokeWidth="2" /></svg>
}
function PlanSvg({ W, depth, D }) {
  const n = D.kind === 'sliding' ? D.panels || 2 : (D.cols || []).length || 1
  return <svg viewBox="0 0 300 60" width="100%" style={{ background: '#fff', border: '1px solid #e5e7eb' }}>
    {[10, 266].map(x => <g key={x} stroke="#334155" fill="#fff"><rect x={x} y="8" width="24" height="30" rx="2" /><rect x={x + 4} y="12" width="8" height="10" fill="#e8eef5" /></g>)}
    {Array.from({ length: n }).map((_, i) => { const w = 232 / n; return <rect key={i} x={34 + i * w + 2} y={i % 2 ? 24 : 12} width={w - 4} height="8" fill="#f6f8fa" stroke="#334155" strokeWidth=".8" /> })}
    <line x1="34" x2="266" y1="46" y2="46" stroke="#2563eb" strokeWidth="2" /></svg>
}
