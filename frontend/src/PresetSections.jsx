import { getPreset, PDIM } from './sectionPresets'
// Draw one profile drawing at its exact preset placement. m = outer (global -> screen) matrix [a,b,c,d,e,f]
function Part({ P, code, part, m }) {
  const d = PDIM[code]; if (!P || !d) return null
  const [, , rot, fx, fy, px, py] = part, [w, h] = d, r = rot * Math.PI / 180, c = Math.round(Math.cos(r) * 1e6) / 1e6, s = Math.round(Math.sin(r) * 1e6) / 1e6, a = fx ? -1 : 1, e = fy ? -1 : 1
  const inner = [c * a, s * a, s * e, -c * e, px - s * e * h, py + c * e * h]
  return <g transform={`matrix(${m.join(' ')})`}><g transform={`matrix(${inner.join(' ')})`}><image href={P.src} x="0" y="0" width={w} height={h} preserveAspectRatio="none" /></g></g>
}
const BLUE = '#4aa3d8', GREY = '#64748b'
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
  for (let i = 0; i <= (L ? (mesh ? 1 : 1) : 0); i++) lines.push(<line key={i} x1={(gy + i * L) * sp} x2={(gy + i * L) * sp} y1={H - gx} y2={gx} stroke={BLUE} strokeWidth={Math.max(1, V.glass[5] * sp * .45)} />)
  if (!L) lines.push(<line key="c" x1={gy * sp} x2={gy * sp} y1={H - gx} y2={gx} stroke={BLUE} strokeWidth={Math.max(1, V.glass[5] * sp * .45)} />)
  if (mesh && L) { const my = ((V.meshY || 102.37) - 11) * sp; lines.push(<line key="m" x1={my} x2={my} y1={H - 42 * sp} y2={42 * sp} stroke={GREY} strokeWidth=".9" strokeDasharray="2 1.5" />) }
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
  panes.forEach((q, i) => { const y = q.mesh ? ((V.meshY || 102.37) - 11) * sp : (Hh.glass[1] - lane + (q.lane || 0) * lane) * sp
    out.push(<line key={'g' + i} x1={q.x0 + 4 * sp} x2={q.x1 - 4 * sp} y1={y} y2={y} stroke={q.mesh ? GREY : BLUE} strokeWidth={q.mesh ? .9 : Math.max(1, Hh.glass[5] * sp * .45)} strokeDasharray={q.mesh ? '2 1.5' : undefined} />) })
  const sparts = V.parts.filter(p => !/^mullion/.test(p[0]))
  sparts.forEach((p, i) => { out.push(<Part key={'l' + i} P={G(p[1])} code={p[1]} part={p} m={left} />, <Part key={'r' + i} P={G(p[1])} code={p[1]} part={p} m={right} />) })
  for (let i = 0; i < panes.length - 1; i++) { if (panes[i].mesh || panes[i + 1].mesh) continue; const mx = panes[i].x1; const m = [sp, 0, 0, sp, mx - cx * sp, 0]
    joint.forEach((p, j) => out.push(<Part key={'j' + i + '_' + j} P={G(p[1])} code={p[1]} part={p} m={m} />)) }
  return <g>{out}</g>
}
