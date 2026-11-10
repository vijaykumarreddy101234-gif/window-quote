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
export const hasPreset = (codes, k = 'v') => { const p = codes && getPreset(pc(codes)); return !!(p && p[k]) }
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
  return <g>{lines}{V.parts.map((p, i) => <Part key={'s' + i} P={G(p[1])} code={p[1]} part={p} m={sill} />)}{V.parts.map((p, i) => <Part key={'h' + i} P={G(p[1])} code={p[1]} part={p} m={head} />)}</g>
}

// horizontal section A-A: left jamb, meeting stiles between sliding leaves, right jamb (mirrored)
export function PresetH({ codes, G, w, sp, panes = [], mesh }) {
  const pr = getPreset({ ...pc(codes), mesh: mesh ? codes.mesh : null }); if (!pr) return null
  const V = pr.v, Hh = pr.h, lane = V.lane || 0
  const left = [sp, 0, 0, sp, 0, 0], right = [-sp, 0, 0, sp, w, 0], out = []
  const joint = Hh.parts.filter(p => /^(sash|bead|interlock)/.test(p[0]))
  let x0 = 1e9, x1 = -1e9
  joint.forEach(p => { const d = PDIM[p[1]]; if (!d) return; const [, , rot, fx, , px] = p, ww = rot ? d[1] : d[0]; const a = fx ? px - ww : px, b = fx ? px : px + ww; x0 = Math.min(x0, a); x1 = Math.max(x1, b) })
  const cx = (x0 + x1) / 2, ps = panes.filter(q => !q.mesh)
  const nl = Math.max(1, ...panes.map(q => q.lane + 1))
  panes.forEach((q, i) => { const y = q.mesh ? (V.meshIsSash ? V.glass[1] + 2 * lane : (V.meshY || 102.37) - 11) * sp : (Hh.glass[1] - lane + (q.lane || 0) * lane) * sp
    out.push(q.mesh ? <line key={'g' + i} x1={q.x0 + 4 * sp} x2={q.x1 - 4 * sp} y1={y} y2={y} stroke={GREY} strokeWidth=".9" strokeDasharray="2 1.5" /> : <Glass key={'g' + i} x1={q.x0 + 4 * sp} x2={q.x1 - 4 * sp} y1={y} y2={y} t={Hh.glass[5] * sp} />) })
  // each jamb shows only the leaf (and bead) of the pane that runs into it, plus the mesh sash when that pane is mesh
  const ids = (q, nm) => nm === 'frame' ? 1 : nm.startsWith('mesh_') ? (q && q.mesh) : (q && !q.mesh && (nm.endsWith('@' + ((q.lane || 0) + 1))) && /^(sash|bead)/.test(nm))
  const firstP = panes[0], lastP = panes[panes.length - 1]
  const nearest = (arr) => arr.find(q => !q.mesh)
  const side = (q, near, m, tag) => V.parts.forEach((p, i) => { if (/^mullion/.test(p[0])) return; if (p[0] === 'frame' || ids(q, p[0]) || (q && q.mesh && near && /^(sash|bead)/.test(p[0]) && p[0].endsWith('@' + ((near.lane || 0) + 1)))) out.push(<Part key={tag + i} P={G(p[1])} code={p[1]} part={p} m={m} />) })
  side(firstP, nearest(panes), left, 'l'); side(lastP, nearest([...panes].reverse()), right, 'r')
  for (let i = 0; i < panes.length - 1; i++) { if (panes[i].mesh || panes[i + 1].mesh) continue; const mx = panes[i].x1; const m = [sp, 0, 0, sp, mx - cx * sp, 0]
    joint.forEach((p, j) => out.push(<Part key={'j' + i + '_' + j} P={G(p[1])} code={p[1]} part={p} m={m} />)) }
  const mps = V.parts.filter(p => p[0].startsWith('mesh_')), mp = mps[0]
  if (mp) panes.forEach((q, i) => { if (q.mesh && i > 0 && !panes[i - 1].mesh) mps.forEach((pp, j) => out.push(<Part key={'me' + i + '_' + j} P={G(pp[1])} code={pp[1]} part={pp} m={[sp, 0, 0, sp, q.x0 - mp[5] * sp, 0]} />)) })
  return <g>{out}</g>
}
