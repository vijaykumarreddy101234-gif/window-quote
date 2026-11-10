// AutoCAD DXF (R12 ASCII) export / import for window designs. Shared by the browser and the backend.
const LAYERS = [['FRAME', 7], ['SASH', 5], ['GLASS', 4], ['MESH', 8], ['SWING', 1], ['DIM', 3], ['TEXT', 2]]
const f = n => (Math.round(n * 1000) / 1000).toString()
export function buildDxf({ mark = 'W1', name = '', width, height, design, glass = '' }) {
  const W = +width, H = +height, D = design || {}, out = [], T = Math.max(40, Math.min(70, Math.min(W, H) * .045)), Y = y => H - y
  const line = (l, x1, y1, x2, y2) => out.push('0', 'LINE', '8', l, '10', f(x1), '20', f(Y(y1)), '30', '0', '11', f(x2), '21', f(Y(y2)), '31', '0')
  const rect = (l, x, y, w, h) => { line(l, x, y, x + w, y); line(l, x + w, y, x + w, y + h); line(l, x + w, y + h, x, y + h); line(l, x, y + h, x, y) }
  const text = (l, x, y, h, t, rot = 0) => out.push('0', 'TEXT', '8', l, '10', f(x), '20', f(Y(y)), '30', '0', '40', f(h), '1', String(t), '50', String(rot))
  rect('FRAME', 0, 0, W, H); rect('FRAME', T, T, W - 2 * T, H - 2 * T)
  const ix = T, iy = T, iw = W - 2 * T, ih = H - 2 * T, widths = []
  if (D.kind === 'sliding') {
    const n = D.panels || 2, ov = 45, pw = (iw + (n - 1) * ov) / n, mesh = D.mesh || 0
    for (let i = 0; i < n; i++) { const x = ix + i * (pw - ov), isMesh = i >= n - mesh; rect('SASH', x, iy, pw, ih); rect(isMesh ? 'MESH' : 'GLASS', x + 40, iy + 40, pw - 80, ih - 80); const dir = i % 2 ? -1 : 1, cx = x + pw / 2
      if (!isMesh) { line('SWING', cx - dir * pw * .3, iy + ih * .62, cx + dir * pw * .3, iy + ih * .62); line('SWING', cx + dir * pw * .3, iy + ih * .62, cx + dir * pw * .22, iy + ih * .58); line('SWING', cx + dir * pw * .3, iy + ih * .62, cx + dir * pw * .22, iy + ih * .66) }
      text('TEXT', cx - 40, iy + ih * .2, 40, 'S' + (i + 1)); widths.push(pw - (i ? ov : 0)) }
  } else {
    const cols = D.cols || [{ w: 1, rows: [{ h: 1, op: 'FIXED' }] }], tw = cols.reduce((a, c) => a + c.w, 0) || 1; let cx = ix, n = 0
    cols.forEach(c => { const cw = iw * c.w / tw, th = c.rows.reduce((a, r) => a + r.h, 0) || 1; let cy = iy; widths.push(cw)
      c.rows.forEach(r => { const ch = ih * r.h / th, open = !['FIXED', 'LOUVRE', 'FAN'].includes(r.op); n++
        rect('SASH', cx, cy, cw, ch); if (open) { rect('SASH', cx + 12, cy + 12, cw - 24, ch - 24); rect('GLASS', cx + 45, cy + 45, cw - 90, ch - 90) } else rect('GLASS', cx + 12, cy + 12, cw - 24, ch - 24)
        if (r.op === 'LH' || r.op === 'RH') { const hl = r.op === 'LH', x0 = hl ? cx + cw - 45 : cx + 45, x1 = hl ? cx + 45 : cx + cw - 45; line('SWING', x0, cy + 45, x1, cy + ch / 2); line('SWING', x0, cy + ch - 45, x1, cy + ch / 2) }
        else if (r.op === 'TOP') { line('SWING', cx + 45, cy + ch - 45, cx + cw / 2, cy + 45); line('SWING', cx + cw - 45, cy + ch - 45, cx + cw / 2, cy + 45) }
        text('TEXT', cx + cw / 2 - 30, cy + ch / 2, 40, (open ? 'C' : 'F') + n); cy += ch }); cx += cw })
  }
  // dimensions: overall width / height, plus each pane width
  const dimH = (x1, x2, y, v) => { line('DIM', x1, y, x2, y); line('DIM', x1, y - 30, x1, y + 30); line('DIM', x2, y - 30, x2, y + 30); text('DIM', (x1 + x2) / 2 - 60, y + 20, 45, f(Math.round(v))) }
  const dimV = (y1, y2, x, v) => { line('DIM', x, y1, x, y2); line('DIM', x - 30, y1, x + 30, y1); line('DIM', x - 30, y2, x + 30, y2); text('DIM', x - 30, (y1 + y2) / 2, 45, f(Math.round(v)), 90) }
  dimH(0, W, -160, W); dimV(0, H, -160, H)
  if (widths.length > 1) { let x = ix; widths.forEach(w => { dimH(x, x + w, H + 160, w); x += w }) }
  text('TEXT', 0, H + 330, 60, `${mark} ${name} ${W} x ${H} mm ${glass}`.trim())
  const tables = ['0', 'SECTION', '2', 'TABLES', '0', 'TABLE', '2', 'LTYPE', '70', '1', '0', 'LTYPE', '2', 'CONTINUOUS', '70', '0', '3', 'Solid line', '72', '65', '73', '0', '40', '0.0', '0', 'ENDTAB',
    '0', 'TABLE', '2', 'LAYER', '70', String(LAYERS.length), ...LAYERS.flatMap(([n, c]) => ['0', 'LAYER', '2', n, '70', '0', '62', String(c), '6', 'CONTINUOUS']), '0', 'ENDTAB', '0', 'ENDSEC']
  return ['0', 'SECTION', '2', 'HEADER', '9', '$ACADVER', '1', 'AC1009', '9', '$INSUNITS', '70', '4', '0', 'ENDSEC', ...tables, '0', 'SECTION', '2', 'ENTITIES', ...out, '0', 'ENDSEC', '0', 'EOF'].join('\r\n') + '\r\n'
}
// DXF -> design. Reads LINE and LWPOLYLINE entities, finds the outer frame and the vertical / horizontal dividers.
export function parseDxf(text) {
  const L = String(text).split(/\r?\n/), segs = []; let i = 0
  const pairs = []; for (; i + 1 < L.length; i += 2) pairs.push([parseInt(L[i], 10), L[i + 1].trim()])
  for (let k = 0; k < pairs.length; k++) {
    const [c, v] = pairs[k]; if (c !== 0) continue
    if (v === 'LINE') { const e = {}; for (let j = k + 1; j < pairs.length && pairs[j][0] !== 0; j++) e[pairs[j][0]] = parseFloat(pairs[j][1]); if ([10, 20, 11, 21].every(q => !isNaN(e[q]))) segs.push([e[10], e[20], e[11], e[21]]) }
    else if (v === 'LWPOLYLINE') { const pts = []; let closed = false, x = null; for (let j = k + 1; j < pairs.length && pairs[j][0] !== 0; j++) { const [cc, vv] = pairs[j]; if (cc === 70) closed = (parseInt(vv, 10) & 1) === 1; if (cc === 10) x = parseFloat(vv); if (cc === 20 && x !== null) { pts.push([x, parseFloat(vv)]); x = null } }
      for (let j = 0; j < pts.length - 1; j++) segs.push([...pts[j], ...pts[j + 1]]); if (closed && pts.length > 2) segs.push([...pts[pts.length - 1], ...pts[0]]) }
  }
  if (!segs.length) throw new Error('No lines found in this DXF file')
  let sc = 1; const xs = segs.flatMap(s => [s[0], s[2]]), ys = segs.flatMap(s => [s[1], s[3]])
  const span = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)); if (span < 30) sc = 1000; else if (span < 400 && span > 30) sc = 25.4 // metres / inches
  const mnx = Math.min(...xs), mxx = Math.max(...xs), mny = Math.min(...ys), mxy = Math.max(...ys)
  // the outer frame is the biggest closed rectangle; take its bounds so dimension lines drawn outside it are ignored
  const eq = (a, b, t = 1.5) => Math.abs(a - b) <= t, rects = []
  const hs = segs.filter(s => eq(s[1], s[3]) && Math.abs(s[2] - s[0]) > 100), vs = segs.filter(s => eq(s[0], s[2]) && Math.abs(s[3] - s[1]) > 100)
  hs.forEach(a => hs.forEach(b => { if (a !== b && b[1] > a[1] + 100) { const x0 = Math.min(a[0], a[2]), x1 = Math.max(a[0], a[2]); if (eq(x0, Math.min(b[0], b[2])) && eq(x1, Math.max(b[0], b[2]))) if (vs.some(v => eq(v[0], x0) && Math.min(v[1], v[3]) <= a[1] + 2 && Math.max(v[1], v[3]) >= b[1] - 2) && vs.some(v => eq(v[0], x1) && Math.min(v[1], v[3]) <= a[1] + 2 && Math.max(v[1], v[3]) >= b[1] - 2)) rects.push({ x0, x1, y0: a[1], y1: b[1] }) } }))
  rects.sort((p, q) => (q.x1 - q.x0) * (q.y1 - q.y0) - (p.x1 - p.x0) * (p.y1 - p.y0))
  const R = rects[0] || { x0: mnx, x1: mxx, y0: mny, y1: mxy }, W = Math.round((R.x1 - R.x0) * sc), H = Math.round((R.y1 - R.y0) * sc)
  if (W < 200 || H < 200) throw new Error('Could not find the window outline in this DXF file')
  const band = .12 * Math.min(R.x1 - R.x0, R.y1 - R.y0)   // ignore the frame's own inner lines
  const cx = [], cy = []
  vs.forEach(v => { const x = v[0], len = Math.abs(v[3] - v[1]); if (x > R.x0 + band && x < R.x1 - band && len > .55 * (R.y1 - R.y0) && Math.min(v[1], v[3]) >= R.y0 - 2) cx.push(x) })
  hs.forEach(h => { const y = h[1], len = Math.abs(h[2] - h[0]); if (y > R.y0 + band && y < R.y1 - band && len > .55 * (R.x1 - R.x0) && Math.min(h[0], h[2]) >= R.x0 - 2) cy.push(y) })
  const cluster = (arr, gap) => { const s = [...arr].sort((a, b) => a - b), o = []; s.forEach(v => { if (o.length && v - o[o.length - 1].at(-1) < gap) o[o.length - 1].push(v); else o.push([v]) }); return o.map(g => g.reduce((a, b) => a + b, 0) / g.length) }
  const gap = .04 * (R.x1 - R.x0), xsC = cluster(cx, gap), ysC = cluster(cy, .04 * (R.y1 - R.y0))
  const edgesX = [R.x0, ...xsC, R.x1], edgesY = [R.y1, ...ysC.sort((a, b) => b - a), R.y0]   // top -> bottom (DXF y is up)
  const cols = edgesX.slice(0, -1).map((x, k) => ({ w: +((edgesX[k + 1] - x) / (R.x1 - R.x0)).toFixed(4), rows: edgesY.slice(0, -1).map((y, j) => ({ h: +((y - edgesY[j + 1]) / (R.y1 - R.y0)).toFixed(4), op: 'FIXED' })) }))
  return { width: W, height: H, design: { kind: 'grid', cols }, notes: `${cols.length} column(s) × ${cols[0].rows.length} row(s) detected` }
}
