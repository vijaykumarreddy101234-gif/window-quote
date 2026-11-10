// Compact card thumbnail used in the DESIGNS sheet: dark frame, pale glass, blue opening marks (as in the reference app).
const FRAME = '#1f2d3d', GLASS = '#d9ecf9', EDGE = '#6f9cc0', BLUE = '#2563eb', LINE = '#4f8fd6'
const Arrow = ({ x1, x2, y }) => { const d = x2 > x1 ? 1 : -1; return <g stroke={BLUE} fill={BLUE} strokeWidth="1.3"><line x1={x1} x2={x2} y1={y} y2={y} /><polygon points={`${x2},${y - 2.6} ${x2},${y + 2.6} ${x2 + d * 4.5},${y}`} /></g> }
function Cell({ x, y, w, h, op, door }) {
  const t = 1.6
  const gx = x + t, gy = y + t, gw = w - 2 * t, gh = h - 2 * t, cx = gx + gw / 2, cy = gy + gh / 2
  return <g>
    <rect x={x} y={y} width={w} height={h} fill={FRAME} />
    <rect x={gx} y={gy} width={gw} height={gh} fill={GLASS} stroke={EDGE} strokeWidth=".5" />
    {op === 'LH' && <path d={`M${gx} ${gy}L${gx + gw} ${cy}L${gx} ${gy + gh}`} fill="none" stroke={LINE} strokeWidth=".9" />}
    {op === 'RH' && <path d={`M${gx + gw} ${gy}L${gx} ${cy}L${gx + gw} ${gy + gh}`} fill="none" stroke={LINE} strokeWidth=".9" />}
    {op === 'TOP' && <path d={`M${gx} ${gy}L${cx} ${gy + gh}L${gx + gw} ${gy}`} fill="none" stroke={LINE} strokeWidth=".9" />}
    {op === 'TT' && <g fill="none" stroke={LINE} strokeWidth=".9"><path d={`M${gx} ${gy}L${gx + gw} ${cy}L${gx} ${gy + gh}`} /><path d={`M${gx} ${gy + gh}L${cx} ${gy}L${gx + gw} ${gy + gh}`} /></g>}
    {op === 'LOUVRE' && <g stroke="#9cbbd6" strokeWidth=".7">{Array.from({ length: Math.max(3, Math.floor(gh / 3.2)) }, (_, i) => <line key={i} x1={gx} x2={gx + gw} y1={gy + (i + .5) * gh / Math.max(3, Math.floor(gh / 3.2))} y2={gy + (i + .5) * gh / Math.max(3, Math.floor(gh / 3.2))} />)}</g>}
    {op === 'FAN' && <g fill="none" stroke="#64748b" strokeWidth=".8"><circle cx={cx} cy={cy} r={Math.min(gw, gh) * .38} /><path d={`M${cx} ${cy}m-${Math.min(gw, gh) * .3} 0h${Math.min(gw, gh) * .6}M${cx} ${cy}m0 -${Math.min(gw, gh) * .3}v${Math.min(gw, gh) * .6}`} /></g>}
  </g>
}
export function DesignThumb({ t }) {
  const d = t.d, AW = 150, AH = 62
  const sc = Math.min(AW / t.w, AH / t.h), W = Math.max(14, t.w * sc), H = Math.max(14, t.h * sc), x0 = (160 - W) / 2, y0 = (70 - H) / 2 + 1
  let body = null
  if (d.kind === 'sliding') {
    const n = d.panels || 2, ctr = n === 3 && (d.centre || d.mesh), fr = 2.2
    const ws = ctr ? [.25, .5, .25] : Array(n).fill(1 / n), iw = W - 2 * fr, ih = H - 2 * fr
    let cx = x0 + fr
    body = <g><rect x={x0} y={y0} width={W} height={H} fill={FRAME} />{ws.map((r, i) => { const w = iw * r, x = cx; cx += w; const mid = ctr && i === 1; const dir = ctr ? (i === 0 ? 1 : i === 2 ? -1 : 0) : (i % 2 ? -1 : 1)
      return <g key={i}><rect x={x + .6} y={y0 + fr} width={w - 1.2} height={ih} fill={GLASS} stroke={EDGE} strokeWidth=".5" />
        {!mid && dir !== 0 && <Arrow x1={x + w / 2 - dir * w * .28} x2={x + w / 2 + dir * w * .28} y={y0 + H / 2} />}</g> })}</g>
  } else if (d.bay) {
    body = <g><path d={`M${x0} ${y0 + 6}L${x0 + W * .42} ${y0}L${x0 + W * .42} ${y0 + H - 6}L${x0} ${y0 + H}Z`} fill={FRAME} /><path d={`M${x0 + W * .42} ${y0}L${x0 + W} ${y0 + 6}L${x0 + W} ${y0 + H}L${x0 + W * .42} ${y0 + H - 6}Z`} fill={FRAME} />
      <path d={`M${x0 + 2} ${y0 + 8}L${x0 + W * .42 - 2} ${y0 + 3}L${x0 + W * .42 - 2} ${y0 + H - 8}L${x0 + 2} ${y0 + H - 3}Z`} fill={GLASS} /><path d={`M${x0 + W * .42 + 2} ${y0 + 3}L${x0 + W - 2} ${y0 + 8}L${x0 + W - 2} ${y0 + H - 3}L${x0 + W * .42 + 2} ${y0 + H - 8}Z`} fill={GLASS} /></g>
  } else {
    const cols = d.cols || [], tw = cols.reduce((a, c) => a + c.w, 0) || 1
    let cx = x0
    body = <g>{cols.map((c, ci) => { const w = W * c.w / tw, x = cx; cx += w; const th = c.rows.reduce((a, r) => a + r.h, 0) || 1; let cy = y0
      return <g key={ci}>{c.rows.map((r, ri) => { const h = H * r.h / th, y = cy; cy += h; return <Cell key={ri} x={x} y={y} w={w} h={h} op={r.op} door={d.door} /> })}</g> })}</g>
  }
  return <svg viewBox="0 0 160 70" width="100%" height="64" role="img" aria-label={t.name}>{body}</svg>
}
