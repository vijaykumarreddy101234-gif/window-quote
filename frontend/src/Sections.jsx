// Procedural profile cross-sections (vertical head/sill + horizontal plan) generated from the design + series.
const S = '#2f3b4a', SW = 0.9
// series -> [track depth mm, track height mm, lanes]
const TRACK = { 53: [53, 44, 2], 62: [62, 50, 2], 80: [80, 50, 3], 92: [92, 52, 3], 95: [95, 52, 3], 112: [112, 60, 3] }
export function trackSpec(series, lanesHint) {
  const key = Object.keys(TRACK).map(Number).sort((a, b) => Math.abs(a - series) - Math.abs(b - series))[0] || 62
  const [d, h, l] = TRACK[key] || TRACK[62]; return { depth: d, ht: h, lanes: lanesHint || l }
}
const R = ({ x, y, w, h, f = '#fff', k }) => <rect key={k} x={x} y={y} width={Math.max(0, w)} height={Math.max(0, h)} fill={f} stroke={S} strokeWidth={SW} />
// hollow box with chambers: n chambers along its long side
function Box({ x, y, w, h, n = 2, t = 1.6, horiz = true }) {
  const els = [<R key="o" x={x} y={y} w={w} h={h} />]
  const inW = w - 2 * t, inH = h - 2 * t
  for (let i = 0; i < n; i++) {
    const cw = horiz ? (inW - (n - 1) * t) / n : inW, ch = horiz ? inH : (inH - (n - 1) * t) / n
    els.push(<R key={'c' + i} x={x + t + (horiz ? i * (cw + t) : 0)} y={y + t + (horiz ? 0 : i * (ch + t))} w={cw} h={ch} f="#f3f6f9" />)
  }
  return <g>{els}</g>
}
// Track in "head" orientation: bar at top (y=0), walls + lane rails going down. flipY mirrors to a sill.
function Track({ x, y, sp, spec, flipY }) {
  const D = spec.depth * sp, H = spec.ht * sp, bar = 11 * sp, wall = 3.4 * sp, rail = 2.8 * sp, rh = H * .62, lw = D / spec.lanes
  const g = []
  g.push(<Box key="bar" x={0} y={0} w={D} h={bar} n={Math.max(2, spec.lanes + 1)} t={1.1 * sp} />)
  g.push(<R key="wl" x={0} y={bar} w={wall} h={H - bar} />, <R key="wr" x={D - wall} y={bar} w={wall} h={H - bar} />)
  for (let i = 1; i < spec.lanes; i++) g.push(<R key={'r' + i} x={i * lw - rail / 2} y={bar} w={rail} h={rh - bar} />)
  return <g transform={flipY ? `translate(${x},${y + H}) scale(1,-1)` : `translate(${x},${y})`}>{g}</g>
}
// Sash cross-section (in head orientation: box hanging down from track bar, glazing leg along glass). dir 1 = sash sits at head, -1 sill
function SashV({ x, w, y, sp, flipY, mesh }) {
  const bw = Math.max(5, w), bh = (mesh ? 28 : 38) * sp, leg = (mesh ? 12 : 22) * sp, lt = 5.5 * sp
  const g = [<Box key="b" x={0} y={0} w={bw} h={bh} n={2} t={1.3 * sp} horiz />, <R key="l" x={bw / 2 - lt / 2} y={bh} w={lt} h={leg} />, <R key="bd" x={bw / 2 + lt / 2} y={bh + leg * .35} w={lt * .9} h={leg * .6} f="#e9eef3" />]
  return <g transform={flipY ? `translate(${x},${y}) scale(1,-1)` : `translate(${x},${y})`}>{g}</g>
}

// Vertical section (B–B). w,h = drawing box in svg units; returns <g> drawn inside [0,w]x[0,h]
export function VSection({ series, lanesHint, h, sp, mesh, casement, sashes = 1 }) {
  if (casement) return <CaseV h={h} sp={sp} />
  const spec = trackSpec(series, lanesHint), D = spec.depth * sp, H = spec.ht * sp, lw = D / spec.lanes
  const lane0 = lw * .5, bar = 11 * sp
  const sashW = Math.max(6, lw - 2.2 * sp)
  const headSashY = bar + 2 * sp, sashH = 38 * sp + 22 * sp
  const glassX = lw * .5
  return <g>
    <Track x={0} y={0} sp={sp} spec={spec} />
    <Track x={0} y={h - H} sp={sp} spec={spec} flipY />
    <SashV x={glassX - sashW / 2} y={headSashY} w={sashW} sp={sp} />
    <SashV x={glassX - sashW / 2} y={h - headSashY} w={sashW} sp={sp} flipY />
    <line x1={glassX} x2={glassX} y1={headSashY + sashH} y2={h - headSashY - sashH} stroke="#4aa3d8" strokeWidth="2.2" />
    {mesh && spec.lanes > 2 ? (() => { const mx = lw * 2.5, mw = Math.max(5, lw - 3 * sp); return <g>
      <SashV x={mx - mw / 2} y={headSashY} w={mw} sp={sp} mesh /><SashV x={mx - mw / 2} y={h - headSashY} w={mw} sp={sp} flipY mesh />
      <line x1={mx} x2={mx} y1={headSashY + 40 * sp} y2={h - headSashY - 40 * sp} stroke="#64748b" strokeWidth="1.2" strokeDasharray="2 1.5" /></g> })() : null}
  </g>
}
function CaseV({ h, sp }) {
  const D = 60 * sp, H = 60 * sp, t = 1.5 * sp
  const frame = y0 => <g><Box x={0} y={y0} w={D} h={H} n={3} t={t} horiz /></g>
  return <g>{frame(0)}{frame(h - H)}
    <R x={D * .12} y={H - 2 * sp} w={D * .5} h={26 * sp} f="#fff" /><R x={D * .12} y={h - H - 24 * sp} w={D * .5} h={26 * sp} f="#fff" />
    <line x1={D * .37} x2={D * .37} y1={H + 24 * sp} y2={h - H - 22 * sp} stroke="#4aa3d8" strokeWidth="2.2" /></g>
}
// Horizontal section (A–A). w = window width in px; panes [{x0,x1,lane,mesh}] in px (relative to 0..w)
export function HSection({ series, lanesHint, w, sp, panes = [], casement, cols = [] }) {
  const spec = trackSpec(series, casement ? 2 : lanesHint), D = (casement ? 60 : spec.depth) * sp, Hj = (casement ? 60 : spec.ht) * sp
  const lw = D / (casement ? 1 : spec.lanes), bar = 11 * sp, wall = 3.4 * sp, rail = 2.8 * sp
  const jamb = flip => { const x0 = flip ? w - Hj : 0, g = []
    g.push(<Box key="bar" x={flip ? w - bar : 0} y={0} w={bar} h={D} n={casement ? 3 : spec.lanes + 1} t={1.1 * sp} horiz={false} />)
    g.push(<R key="wt" x={flip ? w - Hj : bar} y={0} w={Hj - bar} h={wall} />, <R key="wb" x={flip ? w - Hj : bar} y={D - wall} w={Hj - bar} h={wall} />)
    if (!casement) for (let i = 1; i < spec.lanes; i++) g.push(<R key={'r' + i} x={flip ? w - Hj * .62 : bar} y={i * lw - rail / 2} w={Hj * .62 - bar} h={rail} />)
    return <g key={flip ? 'jr' : 'jl'}>{g}</g> }
  const stile = (x, lane, mesh, key) => { const sw = (mesh ? 24 : 40) * sp, y = lane * lw + 1.2 * sp, hh = lw - 2.4 * sp; return <Box key={key} x={x - sw / 2} y={y} w={sw} h={hh} n={2} t={1.1 * sp} horiz /> }
  const out = [jamb(false), jamb(true)]
  if (casement) {
    const xs = [Hj * .55, ...cols.map(c => c.x1), ]
    out.push(<line key="gl" x1={Hj} x2={w - Hj} y1={D / 2} y2={D / 2} stroke="#4aa3d8" strokeWidth="2.2" />)
    cols.slice(0, -1).forEach((c, i) => out.push(<Box key={'cp' + i} x={c.x1 - 12 * sp} y={D * .12} w={24 * sp} h={D * .76} n={3} t={1.2 * sp} horiz />))
    cols.forEach((c, i) => { if (c.open) out.push(stile(c.x0 + 0, 0, false, 'sl' + i), stile(c.x1, 0, false, 'sr' + i)) })
    return <g>{out}</g>
  }
  panes.forEach((p, i) => {
    const y = p.lane * lw + lw / 2
    out.push(<line key={'g' + i} x1={p.x0 + 20 * sp} x2={p.x1 - 20 * sp} y1={y} y2={y} stroke={p.mesh ? '#64748b' : '#4aa3d8'} strokeWidth={p.mesh ? 1.2 : 2.2} strokeDasharray={p.mesh ? '2 1.5' : undefined} />)
    out.push(stile(p.x0, p.lane, p.mesh, 'a' + i), stile(p.x1, p.lane, p.mesh, 'b' + i))
  })
  return <g>{out}</g>
}
