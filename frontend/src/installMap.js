// Installation material mapping — default recipes (cloned from the demo, Revision 1)
const G = { P: 'Plastic components', H: 'Hardware', S: 'Screws' }
// key: [name, unit, group, applies]
const CAT = {
  drain: ['Drainage caps', 'Nos', G.P, 'frame'], fast: ['Fastener caps', 'Nos', G.P, 'frame'],
  sp1s: ['Spacers 1 mm - Small', 'Nos', G.P, 'component'], sp3s: ['Spacers 3 mm - Small', 'Nos', G.P, 'component'], sp5s: ['Spacers 5 mm - Small', 'Nos', G.P, 'component'],
  sp1m: ['Spacers 1 mm - Medium', 'Nos', G.P, 'component'], sp3m: ['Spacers 3 mm - Medium', 'Nos', G.P, 'component'], sp5m: ['Spacers 5 mm - Medium', 'Nos', G.P, 'component'],
  bolt: ['Expansion bolt 8 × 100 mm', 'Nos', G.H, 'frame'], seal: ['Sealant 354', 'Nos', G.H, 'frame'], sili: ['Silicone 352', 'Nos', G.H, 'frame'], rod: ['Backer rod', 'Mtr', G.H, 'frame'],
  cwh: ['Casement window handle screw (M5 × 50)', 'Nos', G.S, 'component'], cdh: ['Casement door handle screw (M5 × 65)', 'Nos', G.S, 'component'],
  coup: ['Coupling screw (M4 × 50)', 'Nos', G.S, 'component'],
  wbump: ['Window bump stop - base & rubber', 'Nos', G.P, 'component'], dbump: ['Door bump stop - base & rubber', 'Nos', G.P, 'component'],
  meshlift: ['Window mesh anti-lift block', 'Nos', G.P, 'component'], sashlift: ['Window & door sash anti-lift block', 'Nos', G.P, 'component'],
  outL: ['Outer anti-lift block - L', 'Nos', G.P, 'frame'], outR: ['Outer anti-lift block - R', 'Nos', G.P, 'frame'],
  strike: ['Sliding window striker screw (3.9 × 25 PVC)', 'Nos', G.S, 'component'], bscrew: ['Bump stopper screw (3.9 × 25 REIN)', 'Nos', G.S, 'component'],
  smscrew: ['Sash & mesh anti-lift block screw (3.9 × 25 REIN)', 'Nos', G.S, 'component'], oscrew: ['Outer anti-lift block screw (3.9 × 25 REIN)', 'Nos', G.S, 'frame'],
  sdh: ['Sliding door L handle screw (M5 × 25)', 'Nos', G.S, 'component'], lm: ['Louver male', 'Nos', G.P, 'component'], lf: ['Louver female', 'Nos', G.P, 'component'],
}
const W = (k, n) => [k, 'window', n], A = (k, c) => [k, 'advanced', c], Q = (k, n) => [k, 'sqft', n]
const FAST = A('fast', { window: 4, perim: 0.5 }), BOLT = A('bolt', { window: 4, perim: 0.5 }), COUP = A('coup', { coupler: 1 })
const TAIL = [BOLT, Q('seal', 0.0625), Q('sili', 0.0625), W('rod', 2)]
const SLIDE = (drain, dbump) => [drain, FAST, dbump, Q('sp1m', 0.6), Q('sp3m', 0.6), Q('sp5m', 0.6)]
const RECIPES = {
  'Casement window': [W('drain', 2), FAST, Q('sp1s', 0.5), Q('sp3s', 0.5), Q('sp5s', 0.5), ...TAIL, W('cwh', 2), COUP],
  'Casement door': [W('drain', 2), FAST, Q('sp1s', 0.5), Q('sp3s', 0.5), Q('sp5s', 0.5), ...TAIL, W('cdh', 2), COUP],
  'Sliding window': [...SLIDE(A('drain', { window: 2, sash: 1 }), W('wbump', 1)), A('meshlift', { mesh: 2 }), A('sashlift', { sash: 2 }), W('outL', 1), W('outR', 1), ...TAIL, A('strike', { sash: 2 }), W('bscrew', 1), A('smscrew', { sash: 4, mesh: 2 }), W('oscrew', 4), COUP],
  'Sliding door': [...SLIDE(W('drain', 4), W('dbump', 2)), A('sashlift', { sash: 2, mesh: 2 }), W('outL', 1), W('outR', 1), ...TAIL, W('sdh', 2), W('bscrew', 2), A('smscrew', { sash: 4, mesh: 4 }), W('oscrew', 4), COUP],
  'Sliding + coupled fixed': [...SLIDE(W('drain', 4), W('wbump', 1)), A('meshlift', { mesh: 2 }), A('sashlift', { sash: 2 }), W('outL', 1), W('outR', 1), ...TAIL, A('strike', { sash: 2 }), W('bscrew', 1), A('smscrew', { sash: 4, mesh: 2 }), W('oscrew', 4), COUP, Q('sp1s', 0.6), Q('sp3s', 0.6), Q('sp5s', 0.6)],
  'Fixed window': [W('drain', 2), FAST, Q('sp1s', 0.5), Q('sp3s', 0.5), Q('sp5s', 0.5), ...TAIL, COUP],
  'Ventilator': [W('drain', 1), FAST, Q('sp1s', 0.6), Q('sp3s', 0.6), Q('sp5s', 0.6), W('lm', 12), W('lf', 12), ...TAIL, COUP],
}
export const TYPES = Object.keys(RECIPES)
export const COEF = [['window', 'per window'], ['sqft', 'per sq ft'], ['perim', 'per ft of perimeter'], ['sash', 'per sash'], ['mesh', 'per mesh screen'], ['coupler', 'per ft of coupler']]
let n = 0
export function defaults() {
  const out = {}
  for (const t of TYPES) out[t] = RECIPES[t].map(([k, basis, v]) => {
    const [name, unit, group, applies] = CAT[k]; const c = {}
    if (basis === 'window') c.window = v; else if (basis === 'sqft') c.sqft = v; else Object.assign(c, v)
    return { id: 'i' + (++n), name, unit, group, applies, basis, ...c }
  })
  return out
}
export const blank = () => ({ id: 'n' + Date.now() + (++n), name: '', unit: 'Nos', group: '', applies: 'component', basis: 'window', window: 1 })
const AUTO = { 'Sliding window': [2, 1], 'Sliding door': [2, 1], 'Sliding + coupled fixed': [2, 1] }
// example context for one window
export function ctx(type, w, h, x = {}) {
  const [s, m] = AUTO[type] || [1, 0]
  const area = w * h, perim = 2 * (w + h)
  return { frame: 1, comp: 1, area, perim, sash: +x.sash || s, mesh: +x.mesh || m, coupler: +x.coupler || 0 }
}
const L = (it, c) => {
  const area = it.applies === 'frame' ? 'frame area share (sq ft)' : 'component area (sq ft)', cnt = it.applies === 'frame' ? 'frame count' : 'component count'
  const parts = []
  const push = (v, l) => { if (v !== '' && v != null && +v) parts.push(`${+v} × ${l}`) }
  if (it.basis === 'window') push(it.window, cnt); else if (it.basis === 'sqft') push(it.sqft, area); else if (it.basis === 'perimeter_ft') push(it.perim, 'outside perimeter (ft)')
  else { push(it.window, cnt); push(it.sqft, area); push(it.perim, 'outside perimeter (ft)'); push(it.sash, 'sash count'); push(it.mesh, 'mesh screen count'); push(it.coupler, 'coupler length (ft)') }
  return parts.join(' + ') || '0'
}
export const formula = it => `Quantity (${it.unit || 'Nos'}) = ROUNDUP(${L(it)}, 0)`
export function qty(it, c) {
  const cnt = it.applies === 'frame' ? c.frame : c.comp
  const a = it.applies === 'frame' ? c.area : c.area
  let v = 0
  const f = k => +it[k] || 0
  if (it.basis === 'window') v = f('window') * cnt
  else if (it.basis === 'sqft') v = f('sqft') * a
  else if (it.basis === 'perimeter_ft') v = f('perim') * c.perim
  else v = f('window') * cnt + f('sqft') * a + f('perim') * c.perim + f('sash') * c.sash + f('mesh') * c.mesh + f('coupler') * c.coupler
  return Math.ceil(v - 1e-9)
}
