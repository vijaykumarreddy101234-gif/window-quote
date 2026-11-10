import { getPreset, PDIM } from './sectionPresets'
import { VEC } from './profileVec'
// delta-coded rings -> svg path data (0.1 mm units)
const ring = r => { let x = 0, y = 0; return r.split(' ').map((t, i) => { const [a, b] = t.split(',').map(Number); if (i === 0) { x = a; y = b; return 'M' + x + ',' + y } x += a; y += b; return 'L' + x + ',' + y }).join('') + 'Z' }
const PATHS = {}
const vecPaths = code => { if (PATHS[code]) return PATHS[code]; const v = VEC[code]; if (!v) return null; const rs = s => s ? s.split(';').map(ring).join('') : ''; return PATHS[code] = { body: rs(v[0]) + rs(v[1]), gasket: rs(v[2]) } }
// Draw one profile drawing at its exact preset placement. m = outer (global -> screen) matrix [a,b,c,d,e,f]
function Part({ P, code, part, m }) {
  const d = PDIM[code]; if (!d) return null
  const vp = vecPaths(code); if (!vp && !P) return null
  const [, , rot, fx, fy, px, py] = part, [w, h] = d, r = rot * Math.PI / 180, c = Math.round(Math.cos(r) * 1e6) / 1e6, s = Math.round(Math.sin(r) * 1e6) / 1e6, a = fx ? -1 : 1, e = fy ? -1 : 1
  if (vp) { // exact vector outline (profile coordinates, y up)
    const inner = [c * a, s * a, -s * e, c * e, px, py]
    return <g transform={`matrix(${m.join(' ')})`}><g transform={`matrix(${inner.join(' ')}) scale(.1)`} fill="#fbfbfa" stroke="#3f4a5a" strokeWidth=".8" strokeLinejoin="round">
      <path d={vp.body} fillRule="evenodd" vectorEffect="non-scaling-stroke" />{vp.gasket && <path d={vp.gasket} fillRule="evenodd" vectorEffect="non-scaling-stroke" />}</g></g>
  }
  const inner = [c * a, s * a, s * e, -c * e, px - s * e * h, py + c * e * h]
  return <g transform={`matrix(${m.join(' ')})`}><g transform={`matrix(${inner.join(' ')})`}><image href={P.src} x="0" y="0" width={w} height={h} preserveAspectRatio="none" /></g></g>
}
const BLUE = '#4aa3d8', GREY = '#64748b'
// glass drawn at its real thickness (light-blue pane with a darker edge), like the demo
const Glass = ({ k, x1, y1, x2, y2, t }) => { const vert = Math.abs(x1 - x2) < Math.abs(y1 - y2), th = Math.max(2, t); return vert
  ? <rect key={k} x={x1 - th / 2} y={Math.min(y1, y2)} width={th} height={Math.abs(y2 - y1)} fill="#cfe6fa" stroke="#7ab8e8" strokeWidth=".6" />
  : <rect key={k} x={Math.min(x1, x2)} y={y1 - th / 2} width={Math.abs(x2 - x1)} height={th} fill="#cfe6fa" stroke="#7ab8e8" strokeWidth=".6" /> }
export const hasPreset = (codes, k = 'v') => { const p = codes && getPreset(pc(codes)); return !!(p && p[k] && (k !== 'h' || p[k].parts)) }
export const isCasPreset = codes => { const p = codes && getPreset(pc(codes)); return !!(p && p.cas) }
const pc = codes => ({ frame: codes.frame, sash: codes.sash, bead: codes.bead, il: codes.il, mesh: codes.mesh, mull: codes.mull })

// vertical section B-B: sill at the bottom, mirrored head on top, glazing lines between
export function PresetV({ codes, G, h, sp, mesh }) {
  const pr = getPreset({ ...pc(codes), mesh: mesh ? codes.mesh : null }); if (!pr) return null
  const V = pr.v, F = PDIM[codes.frame], ext = F ? F[1] : 50, H = Math.max(h, ext * sp * 2 + 30)
  const sill = [0, -sp, sp, 0, 0, H], head = [0, sp, sp, 0, 0, 0]
  const L = V.lane || 0, gx = V.glass[0] * sp, gy = V.glass[1]
  const lanes = L ? (V.parts.some(p => p[0].startsWith('mesh_sash')) ? 2 : 1) : 0
  const lines = []
  for (let i = 0; i <= (L ? (mesh ? 1 : 1) : 0); i++) lines.push(<Glass key={i} x1={(gy + i * L) * sp} x2={(gy + i * L) * sp} y1={H - gx} y2={gx} t={V.glass[5] * sp} />)
  if (!L) lines.push(<Glass key="c" x1={gy * sp} x2={gy * sp} y1={H - gx} y2={gx} t={V.glass[5] * sp} />)
  if (mesh && L) { const my = (V.meshIsSash ? V.glass[1] + 2 * L : (V.meshY || 102.37) - 11) * sp; lines.push(<line key="m" x1={my} x2={my} y1={H - 42 * sp} y2={42 * sp} stroke={GREY} strokeWidth=".9" strokeDasharray="2 1.5" />) }
  const vp = V.parts.filter(p => p[0] !== 'mesh_mullion')
  return <g>{lines}{vp.map((p, i) => <Part key={'s' + i} P={G(p[1])} code={p[1]} part={p} m={sill} />)}{vp.map((p, i) => <Part key={'h' + i} P={G(p[1])} code={p[1]} part={p} m={head} />)}</g>
}

// horizontal section A-A: left jamb, meeting stiles between sliding leaves, right jamb (mirrored).
// Every leaf carries glass (lane = leaf index parity); a mesh shutter runs in the mesh track over the leaves marked mesh.
export function PresetH({ codes, G, w, sp, panes = [], mesh }) {
  const pr = getPreset({ ...pc(codes), mesh: mesh ? codes.mesh : null }); if (!pr || !pr.h || !pr.h.parts) return null
  const V = pr.v, Hh = pr.h, lane = V.lane || 0
  const left = [sp, 0, 0, sp, 0, 0], right = [-sp, 0, 0, sp, w, 0], out = []
  const joint = Hh.parts.filter(p => /^(sash|bead|interlock)/.test(p[0]))
  let x0 = 1e9, x1 = -1e9
  joint.forEach(p => { const d = PDIM[p[1]]; if (!d) return; const [, , rot, fx, , px] = p, ww = rot ? d[1] : d[0]; const a = fx ? px - ww : px, b = fx ? px : px + ww; x0 = Math.min(x0, a); x1 = Math.max(x1, b) })
  const cx = (x0 + x1) / 2
  const laneOf = (q, i) => q.mesh ? i % 2 : (q.lane || 0)
  const meshDepth = (V.meshIsSash ? V.glass[1] + 2 * lane : (V.meshY || 102.37) - 11) * sp
  // glass in every leaf + mesh net over mesh leaves
  panes.forEach((q, i) => { const y = (Hh.glass[1] - lane + laneOf(q, i) * lane) * sp
    out.push(<Glass key={'g' + i} x1={q.x0 + 4 * sp} x2={q.x1 - 4 * sp} y1={y} y2={y} t={Hh.glass[5] * sp} />)
    if (q.mesh) out.push(<line key={'mn' + i} x1={q.x0 + 4 * sp} x2={q.x1 - 4 * sp} y1={meshDepth} y2={meshDepth} stroke={GREY} strokeWidth=".9" strokeDasharray="2 1.5" />) })
  // jambs: frame + the leaf (and bead) of the lane that runs into that jamb + mesh shutter parts when that leaf is meshed
  const side = (q, i, m, tag) => { if (!q) return; const ln = laneOf(q, i) + 1
    V.parts.forEach((p, k) => { const nm = p[0]; const want = nm === 'frame' || (/^(sash|bead)@/.test(nm) && nm.endsWith('@' + ln)) || (nm.startsWith('mesh_sash') && q.mesh)
      if (want) out.push(<Part key={tag + k} P={G(p[1])} code={p[1]} part={p} m={m} />) }) }
  side(panes[0], 0, left, 'l'); side(panes[panes.length - 1], panes.length - 1, right, 'r')
  // meeting stiles
  for (let i = 0; i < panes.length - 1; i++) { const mx = panes[i].x1, m = [sp, 0, 0, sp, mx - cx * sp, 0]
    joint.forEach((p, j) => out.push(<Part key={'j' + i + '_' + j} P={G(p[1])} code={p[1]} part={p} m={m} />)) }
  // mesh shutter stile where a mesh leaf starts/ends against a plain leaf
  const mps = V.parts.filter(p => p[0].startsWith('mesh_sash')), mp = mps[0], mm = V.parts.find(p => p[0] === 'mesh_mullion')
  if (mp) panes.forEach((q, i) => { if (!q.mesh) return
    if (i > 0 && !panes[i - 1].mesh) mps.forEach((pp, j) => out.push(<Part key={'me' + i + '_' + j} P={G(pp[1])} code={pp[1]} part={pp} m={[sp, 0, 0, sp, q.x0 - mp[5] * sp, 0]} />))
    if (i < panes.length - 1 && panes[i + 1].mesh) { const bx = q.x1; mps.forEach((pp, j) => out.push(<Part key={'mm' + i + '_' + j} P={G(pp[1])} code={pp[1]} part={pp} m={[-sp, 0, 0, sp, bx + (mp[5] - (mm ? 13.5 : 0)) * sp, 0]} />, <Part key={'mm2' + i + '_' + j} P={G(pp[1])} code={pp[1]} part={pp} m={[sp, 0, 0, sp, bx - (mp[5] - (mm ? 13.5 : 0)) * sp, 0]} />)); if (mm) out.push(<Part key={'mul' + i} P={G(mm[1])} code={mm[1]} part={mm} m={[sp, 0, 0, sp, bx - (mm[5] - 13.5) * sp, 0]} />) }
    if (i < panes.length - 1 && !panes[i + 1].mesh) mps.forEach((pp, j) => out.push(<Part key={'mf' + i + '_' + j} P={G(pp[1])} code={pp[1]} part={pp} m={[-sp, 0, 0, sp, q.x1 + mp[5] * sp, 0]} />)) })
  return <g>{out}</g>
}

// horizontal section of a casement window: jambs, fixed beads and T-mullions between columns, glass per column
export function PresetHCas({ codes, G, w, sp, cols = [], glassMm = 5 }) {
  const pr = getPreset(pc(codes)); if (!pr || !pr.h || !pr.cas) return null
  const Hh = pr.h, out = [], P = (part, m, key) => <Part key={key} P={G(part[1])} code={part[1]} part={part} m={m} />
  const left = [sp, 0, 0, sp, 0, 0], right = [-sp, 0, 0, sp, w, 0]
  const at = (x, flip) => flip ? [-sp, 0, 0, sp, x, 0] : [sp, 0, 0, sp, x, 0]
  const glassT = Math.max(2, glassMm * sp)
  // jambs
  out.push(P(Hh.frame, left, 'fl'), P(Hh.frame, right, 'fr'))
  const edge = (col, m, tag) => { if (!col) return; if (col.open) out.push(P(Hh.sash, m, tag + 's'), P(Hh.bead, m, tag + 'b')); else out.push(P(Hh.fixedBead, m, tag + 'fb')) }
  edge(cols[0], left, 'l'); edge(cols[cols.length - 1], right, 'r')
  // mullions between columns. A leaf hung on the mullion overlaps it by the same 28.1 mm it overlaps the frame
  // (measured on the demo: sash edge 28.4 mm inside the mullion edge, mullion centred on the column boundary).
  const OV = 28.1, mw = Hh.mullW, sashW = (PDIM[Hh.sash[1]] || [78])[0], beadOff = Hh.bead[5] - Hh.sash[5], gOff = Hh.glassSash[0] - Hh.sash[5]
  for (let i = 0; i < cols.length - 1; i++) {
    const b = cols[i].x1, mx = b - mw * sp / 2
    if (Hh.mullion) out.push(P(Hh.mullion, [sp, 0, 0, sp, mx, 0], 'm' + i))
    // right of the mullion (column i+1): sash starts at mullion edge − overlap; left of it (column i): mirrored, sash ends at mullion left edge + overlap
    const rm = [sp, 0, 0, sp, mx + (mw - OV) * sp, 0], lm = [-sp, 0, 0, sp, mx + OV * sp, 0]
    const hang = (col, m, tag) => { if (col.open) out.push(P(['sash', Hh.sash[1], 0, 0, 1, 0, Hh.sash[6]], m, tag + 's'), P(['bead', Hh.bead[1], 90, 0, 1, beadOff, Hh.bead[6]], m, tag + 'b')); else out.push(P(['bead@fixed', Hh.fixedBead[1], 90, Hh.fixedBead[3], 1, mw - 26.04 - (mw - OV), Hh.fixedBead[6]], m, tag + 'fb')) }
    hang(cols[i], lm, 'ml' + i); hang(cols[i + 1], rm, 'mr' + i)
  }
  // glass per column: between the two beads of an opening leaf, or in the fixed glazing rebate
  cols.forEach((c, i) => { const g = c.open ? Hh.glassSash : Hh.glassFixed
    const insL = i === 0 ? g[0] : (c.open ? mw / 2 - OV + gOff : mw / 2 + 10), insR = i === cols.length - 1 ? g[0] : (c.open ? mw / 2 - OV + gOff : mw / 2 + 10)
    out.unshift(<Glass key={'g' + i} x1={c.x0 + insL * sp} x2={c.x1 - insR * sp} y1={g[1] * sp} y2={g[1] * sp} t={glassT} />) })
  return <g>{out}</g>
}
