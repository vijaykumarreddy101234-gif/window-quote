// Bay window drawing in the demo's style: assembled perspective view + face elevations + plan.
import { WINDOW_COLORS } from './templates'
import { ProfileShape } from './PresetSections'
const PROF = Object.fromEntries(WINDOW_COLORS)
const ST = '#3f4a5a'
const tag = (x, y, t, w = 22, k) => <g key={k}><rect x={x - w / 2} y={y} width={w} height="11" fill="#fff" stroke="#334155" strokeWidth=".6" /><text x={x} y={y + 8} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#111">{t}</text></g>
const circ = (x, y, n, k) => <g key={k}><circle cx={x} cy={y} r="8" fill="#fff" stroke="#334155" strokeWidth=".8" /><text x={x} y={y + 3.2} fontSize="9" textAnchor="middle">{n}</text></g>

export function bayAngle(D) { return D.bayInterior ? (180 - D.bayInterior) / 2 : D.bayType === 'box' ? 70 : D.bayType === 'splay' ? 22.5 : 45 }
export function BayDrawing({ item, design: D, side = 'inside', selected, onSelect, mini = false }) {
  const W = item.width, H = item.height, cols = D.cols || [], n = cols.length, tw = cols.reduce((a, c) => a + c.w, 0) || 1
  const L = cols.map(c => W * c.w / tw), fill = PROF[D.colour?.Window] || '#fbfbfa'
  const th = bayAngle(D) * Math.PI / 180
  const ang = Array.from({ length: n }, (_, i) => n === 2 ? (i ? -th : th) : i === 0 ? th : i === n - 1 ? -th : 0)
  // plan points (x right, z away)
  const pts = [[0, 0]]; L.forEach((l, i) => { const p = pts[i]; pts.push([p[0] + l * Math.cos(ang[i]), p[1] + l * Math.sin(ang[i])]) })
  const xm = (pts[0][0] + pts[n][0]) / 2, Zv = 7600, f = z => 1 / (1 + z / Zv)
  const eye = H * 1.83, raw = (x, z, y) => [(x - xm) * f(z), -(y - eye) * f(z)]
  const xs = pts.map(p => raw(p[0], p[1], 0)[0]), ext = Math.max(...xs) - Math.min(...xs), s = Math.min(320 / ext, 270 / H)
  const ox = 200, oy = 70 - Math.min(...pts.map(p => raw(p[0], p[1], H)[1])) * s
  const P = (x, z, y) => { const r = raw(x, z, y); return [ox + r[0] * s, oy + r[1] * s] }
  const faceP = (i, u, v) => { const a = pts[i], b = pts[i + 1], t = u / L[i]; return P(a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, v) }
  const poly = a => a.map(p => p.join(',')).join(' ')
  const frameW = i => Math.round(L[i] - 62), fi = 60, fb = 30, bd = 84.5
  const els = []
  L.forEach((l, i) => {
    const quad = m => [faceP(i, m, H - m), faceP(i, l - m, H - m), faceP(i, l - m, m), faceP(i, m, m)]
    const out = quad(0), bev = quad(fb), inn = quad(fi), bead = quad(bd)
    const cxm = (inn[0][0] + inn[1][0] + inn[2][0] + inn[3][0]) / 4, mid = (a, b) => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], top = mid(inn[0], inn[1]), ctr = [cxm, (inn[0][1] + inn[2][1]) / 2]
    const hl = [faceP(i, l * .55, H - bd), faceP(i, l * .75, H - bd), faceP(i, l * .25, bd), faceP(i, l * .08, bd)]
    const an = Math.atan2(faceP(i, l, H)[1] - faceP(i, 0, H)[1], faceP(i, l, H)[0] - faceP(i, 0, H)[0]) * 180 / Math.PI
    els.push(<g key={i} style={onSelect ? { cursor: 'pointer' } : {}} onClick={() => onSelect && onSelect(i)}>
      <polygon points={poly(out)} fill={fill} stroke={ST} strokeWidth="1.1" /><polygon points={poly(bev)} fill={fill} stroke={ST} strokeWidth=".45" /><polygon points={poly(inn)} fill={fill} stroke={ST} strokeWidth=".7" />
      <polygon points={poly(bead)} fill="url(#bgl)" stroke="#8fb9d6" strokeWidth=".7" /><polygon points={poly(hl)} fill="#fff" fillOpacity=".4" />
      <line x1={inn[0][0]} y1={inn[0][1]} x2={bead[0][0]} y2={bead[0][1]} stroke={ST} strokeWidth=".4" /><line x1={inn[1][0]} y1={inn[1][1]} x2={bead[1][0]} y2={bead[1][1]} stroke={ST} strokeWidth=".4" /><line x1={inn[2][0]} y1={inn[2][1]} x2={bead[2][0]} y2={bead[2][1]} stroke={ST} strokeWidth=".4" /><line x1={inn[3][0]} y1={inn[3][1]} x2={bead[3][0]} y2={bead[3][1]} stroke={ST} strokeWidth=".4" />
      {!mini && tag(top[0], top[1] + 4, 'F' + (i + 1), 22, 't')}{!mini && <text x={ctr[0]} y={ctr[1] - 40} fontSize="8" textAnchor="middle" fill="#334155">{String.fromCharCode(65 + i)}</text>}
      {!mini && circ(ctr[0], ctr[1] + 2, i + 1, 'c')}{!mini && <text transform={`translate(${ctr[0]},${ctr[1] + 26}) rotate(${an})`} fontSize="6.5" textAnchor="middle" fill="#64748b">{frameW(i) - 80} × {Math.round(H - 80)}</text>}
      {selected === i && <polygon points={poly(out)} fill="none" stroke="#2563eb" strokeWidth="2" strokeDasharray="4 2" />}</g>)
  })
  if (mini) { const all = L.flatMap((l, i) => [faceP(i, 0, H), faceP(i, l, H), faceP(i, l, 0), faceP(i, 0, 0)]), x0 = Math.min(...all.map(p => p[0])) - 6, x1 = Math.max(...all.map(p => p[0])) + 6, y0 = Math.min(...all.map(p => p[1])) - 6, y1 = Math.max(...all.map(p => p[1])) + 6
    return <svg viewBox={`${x0} ${y0} ${x1 - x0} ${y1 - y0}`} width="100%" height="100%"><defs><linearGradient id="bgl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3f1fa" /><stop offset="1" stopColor="#d5e9f6" /></linearGradient></defs>{els}</svg> }
  // top dims parallel to each face
  const dimsTop = L.map((l, i) => { const a = faceP(i, 0, H), b = faceP(i, l, H), dx = b[0] - a[0], dy = b[1] - a[1], an = Math.atan2(dy, dx) * 180 / Math.PI, m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 - 20]
    return <g key={'d' + i}><line x1={a[0]} y1={a[1] - 14} x2={b[0]} y2={b[1] - 14} stroke="#334155" strokeWidth=".7" markerStart="url(#bdm)" markerEnd="url(#bdm)" /><g transform={`translate(${m[0]},${m[1] + 6}) rotate(${an})`}><rect x="-22" y="-6" width="44" height="12" fill="#fff" stroke="#334155" strokeWidth=".5" /><text y="3" fontSize="8" fontWeight="700" textAnchor="middle">{String.fromCharCode(65 + i)} · {Math.round(l)}</text></g></g> })
  const lx = Math.min(...pts.map((p, i) => P(p[0], p[1], 0)[0])) - 26, tl = P(pts[0][0], pts[0][1], H), bl = P(pts[0][0], pts[0][1], 0)
  const joint = pts.slice(1, -1).map((p, i) => { const a = 180 - Math.abs(ang[i] - ang[i + 1]) * 180 / Math.PI, b = P(p[0], p[1], 0); return <text key={'j' + i} x={b[0]} y={b[1] + 18} fontSize="8.5" fontWeight="700" textAnchor="middle" fill="#334155">{Math.round(a)}°</text> })
  // plan view
  const ps = Math.min(170 / ext, 120 / Math.max(...pts.map(p => p[1]), 1)), pox = 520, poy = 330
  const pp = pts.map(p => [pox + (p[0] - xm) * ps, poy - p[1] * ps]), flip = side === 'outside'
  // face elevations
  const es = Math.min(110 / Math.max(...L), 130 / H), gap = 16
  let ex = 440
  const elev = L.map((l, i) => { const w = l * es, h = H * es, x = ex; ex += w + gap; const f1 = fi * es * 1.3
    const r = (m, k, st, fl) => <rect key={k} x={x + m * es} y={62 + m * es} width={w - 2 * m * es} height={h - 2 * m * es} fill={fl} stroke={st[0]} strokeWidth={st[1]} />
    return <g key={'e' + i}>{r(0, 'o', [ST, 1], fill)}{r(fb, 'b', [ST, .4], fill)}{r(fi, 'i', [ST, .6], fill)}{r(bd, 'g', ['#8fb9d6', .6], 'url(#bgl)')}
      {tag(x + w / 2, 62 + bd * es + 2, 'F' + (i + 1), 14)}<text x={x + w / 2} y={62 + h * .35} fontSize="5.5" textAnchor="middle" fill="#334155">{String.fromCharCode(65 + i)}</text>{circ(x + w / 2, 62 + h * .5, i + 1, 'c')}<text x={x + w / 2} y={62 + h * .5 + 16} fontSize="4.5" textAnchor="middle" fill="#64748b">{frameW(i) - 80} × {Math.round(H - 80)}</text>
      <text x={x + w / 2} y={62 + h + 14} fontSize="7" fontWeight="700" textAnchor="middle">FACE {String.fromCharCode(65 + i)}</text><text x={x + w / 2} y={62 + h + 25} fontSize="6.5" textAnchor="middle" fill="#64748b">Frame {frameW(i)} mm</text></g> })
  return <svg viewBox="0 0 700 430" width="100%" style={{ maxWidth: 820, display: 'block', margin: '0 auto' }}>
    <defs><linearGradient id="bgl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#e3f1fa" /><stop offset="1" stopColor="#d5e9f6" /></linearGradient>
      <marker id="bdm" markerWidth="6" markerHeight="6" refX="3" refY="3" orient="auto-start-reverse" markerUnits="userSpaceOnUse"><path d="M0,0 L0,6 L6,3 z" fill="#334155" /></marker></defs>
    <text x="8" y="12" fontSize="8" fontWeight="800" fill="#334155" letterSpacing=".5">ASSEMBLED BAY · {flip ? 'OUTSIDE' : 'INSIDE'}</text>
    {els}{dimsTop}{joint}
    <g stroke="#334155"><line x1={lx} y1={tl[1]} x2={lx} y2={bl[1]} strokeWidth=".7" markerStart="url(#bdm)" markerEnd="url(#bdm)" /></g><g><rect x={lx - 15} y={(tl[1] + bl[1]) / 2 - 6} width="30" height="12" fill="#fff" stroke="#334155" strokeWidth=".5" /><text x={lx} y={(tl[1] + bl[1]) / 2 + 3} fontSize="8.5" fontWeight="700" textAnchor="middle">{H}</text></g>
    <text x="440" y="48" fontSize="8" fontWeight="800" fill="#334155" letterSpacing=".5">FACE ELEVATIONS</text>{elev}
    <text x={pox} y={poy - Math.max(...pp.map(p => poy - p[1])) - 26 + (poy - Math.min(...pp.map(p => p[1])))} fontSize="7" fontWeight="700" textAnchor="middle" fill="#334155" opacity="0">.</text>
    <g><text x={pox} y={Math.min(...pp.map(p => p[1])) - 14} fontSize="7" fontWeight="700" textAnchor="middle" fill="#334155">{flip ? 'IN' : 'OUT'}</text>
      {L.map((l, i) => { const a = pp[i], c = pp[i + 1], dx = c[0] - a[0], dy = c[1] - a[1], ln = Math.hypot(dx, dy) || 1, nx = -dy / ln, ny = dx / ln, d = 60 * ps, g = 30 * ps
        const band = [[a[0], a[1]], [c[0], c[1]], [c[0] + nx * d, c[1] + ny * d], [a[0] + nx * d, a[1] + ny * d]]
        return <g key={'pb' + i}><polygon points={poly(band)} fill={fill} stroke={ST} strokeWidth=".7" /><line x1={a[0] + nx * g} y1={a[1] + ny * g} x2={c[0] + nx * g} y2={c[1] + ny * g} stroke="#8fb9d6" strokeWidth="1.1" /><line x1={a[0] + nx * (d + 9)} y1={a[1] + ny * (d + 9)} x2={c[0] + nx * (d + 9)} y2={c[1] + ny * (d + 9)} stroke="#94a3b8" strokeWidth=".7" strokeDasharray="3 2" /></g> })}
      {pp.map((p, i) => { const prev = i > 0 ? pp[i - 1] : null, next = i < n ? pp[i + 1] : null, deg = (a, c) => Math.atan2(c[1] - a[1], c[0] - a[0]) * 180 / Math.PI, k = 60 * ps / 60
        return <g key={'pj' + i}>
          {next && <ProfileShape code="RSC-60OF" scale={k} transform={`translate(${p[0]},${p[1]}) rotate(${deg(p, next)}) rotate(90) translate(${-60 * k},${-60 * k})`} />}
          {prev && <ProfileShape code="RSC-60OF" scale={k} transform={`translate(${p[0]},${p[1]}) rotate(${deg(p, prev)}) rotate(-90) translate(${-60 * k},${0})`} />}
          {prev && next && <g transform={`translate(${p[0]},${p[1]}) rotate(${(deg(p, prev) + deg(p, next)) / 2})`}><rect x={-34 * k} y={-10 * k} width={68 * k} height={68 * k} fill={fill} stroke={ST} strokeWidth=".7" /><rect x={-24 * k} y={0} width={48 * k} height={48 * k} fill="none" stroke={ST} strokeWidth=".4" /></g>}
        </g> })}
      {L.map((l, i) => { const a = pp[i], b = pp[i + 1], an = Math.atan2(b[1] - a[1], b[0] - a[0]) * 180 / Math.PI; return <text key={i} transform={`translate(${(a[0] + b[0]) / 2},${(a[1] + b[1]) / 2 + 22}) rotate(${an})`} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#334155">{String.fromCharCode(65 + i)} · {Math.round(l)}</text> })}
      {pts.slice(1, -1).map((p, i) => <text key={'a' + i} x={pp[i + 1][0]} y={pp[i + 1][1] + 20} fontSize="7.5" fontWeight="700" textAnchor="middle" fill="#334155">{Math.round(180 - Math.abs(ang[i] - ang[i + 1]) * 180 / Math.PI)}°</text>)}
      <text x={pox} y={Math.max(...pp.map(p => p[1])) + 38} fontSize="7" fontWeight="700" textAnchor="middle" fill="#334155">{flip ? 'OUT' : 'IN'}</text></g>
  </svg>
}
