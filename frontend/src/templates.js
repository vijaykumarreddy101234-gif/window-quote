// Window templates (same groups and names as the demo's DESIGNS sheet).
const sl = (n, mesh = 0, extra = {}) => ({ kind: 'sliding', panels: n, mesh, ...extra })
const cs = (cols, extra = {}) => ({ kind: 'grid', cols, ...extra })
const R = (op, h = 1) => ({ h, op })
const C = (rows, w = 1) => ({ w, rows: Array.isArray(rows) ? rows : [rows] })
const one = op => [C(R(op))]
const G = { SW: 'SLIDING WINDOWS', SD: 'SLIDING DOORS', CW: 'CASEMENT WINDOWS', CD: 'CASEMENT DOORS', V: 'VENTILATORS', B: 'BAY WINDOWS' }
const t = (id, group, name, type, w, h, system, d, extra = {}) => ({ id, group, cat: { [G.SW]: 'Sliding', [G.SD]: 'Doors', [G.CW]: 'Casement', [G.CD]: 'Doors', [G.V]: 'Ventilators', [G.B]: 'Special' }[group], name, type, w, h, system, d, ...extra })
export const GROUPS = Object.values(G)
export const CATS = ['All', 'Sliding', 'Casement', 'Fixed', 'Doors', 'Ventilators', 'Combination', 'Special']
export const TEMPLATES = [
  t('s2', G.SW, '2-panel sliding', 'sliding', 1200, 1200, '62 series sliding window', sl(2, 0, { series: '62' })),
  t('s3', G.SW, '3-panel sliding', 'sliding', 1800, 1200, '62 series sliding window', sl(3, 0, { centre: true, series: '62' })),
  t('s3t', G.SW, '3-track 3-panel sliding', 'sliding', 1800, 1200, '95 series sliding window', sl(3, 0, { tracks: 3, series: '95' })),
  t('s4', G.SW, '4-panel sliding', 'sliding', 2800, 1200, '62 series sliding window', sl(4, 0, { series: '62' })),
  t('s2m', G.SW, '2-panel sliding with mesh', 'sliding', 1200, 1200, '80 series sliding window', sl(2, 1, { series: '80' }), { mesh: 'Mesh' }),
  t('s3m', G.SW, '3-panel sliding with mesh', 'sliding', 1800, 1200, '80 series sliding window', sl(3, 1, { centre: true, series: '80' }), { mesh: 'Mesh' }),
  t('s4m', G.SW, '4-panel sliding with mesh', 'sliding', 2800, 1200, '80 series sliding window', sl(4, 2, { series: '80' }), { mesh: 'Mesh' }),
  t('k1', G.SW, 'Fixed top + sliding', 'combination', 1200, 1800, '60 series fixed window + 62 series sliding window', sl(2, 0, {  fixedTop: .3 , series: '62' })),
  t('sd2', G.SD, '2-panel sliding door', 'sliding', 1800, 2100, '62 series sliding door', sl(2, 0, {  door: true , series: '62' })),
  t('sd3', G.SD, '3-panel sliding door', 'sliding', 2400, 2100, '62 series sliding door', sl(3, 0, { centre: true, door: true, series: '62' })),
  t('sd4', G.SD, '4-panel sliding door', 'sliding', 3000, 2100, '62 series sliding door', sl(4, 0, { door: true, series: '62' })),
  t('sdm', G.SD, 'Sliding door with mesh', 'sliding', 2400, 2100, '92 series sliding door with mesh', sl(3, 1, {  door: true , series: '92' }), { mesh: 'SS mesh' }),
  t('f1', G.CW, 'Fixed', 'fixed', 900, 900, '60 series fixed window', cs(one('FIXED'))),
  t('c1l', G.CW, 'Left-open casement', 'casement', 600, 1200, '60 series casement window', cs(one('LH'))),
  t('c1r', G.CW, 'Right-open casement', 'casement', 600, 1200, '60 series casement window', cs(one('RH'))),
  t('c2', G.CW, 'Double open', 'casement', 1200, 1200, '60 series casement window', cs([C(R('LH')), C(R('RH'))])),
  t('c3', G.CW, 'Triple open', 'casement', 1800, 1200, '60 series casement window', cs([C(R('LH')), C(R('LH')), C(R('RH'))])),
  t('c4', G.CW, 'Four open', 'casement', 2400, 1200, '60 series casement window', cs([C(R('LH')), C(R('RH')), C(R('LH')), C(R('RH'))])),
  t('tt', G.CW, 'Tilt & turn', 'casement', 600, 1200, '60 series casement window', cs(one('TT'))),
  t('th', G.CW, 'Top-hung window', 'casement', 600, 1200, '60 series casement window', cs(one('TOP'))),
  t('f2', G.CW, 'Fixed – 2 lite', 'fixed', 1200, 900, '60 series fixed window', cs([C(R('FIXED')), C(R('FIXED'))])),
  t('f3', G.CW, 'Fixed – top & bottom', 'fixed', 900, 1500, '60 series fixed window', cs([C([R('FIXED'), R('FIXED')])])),
  t('k2', G.CW, 'Fixed top + casement', 'combination', 900, 1500, '60 series combination window', cs([C([R('FIXED', .3), R('RH', .7)])])),
  t('k3', G.CW, 'Casement + fixed + casement', 'combination', 2100, 1200, '60 series combination window', cs([C(R('LH')), C(R('FIXED'), 1.2), C(R('RH'))])),
  t('od1', G.CD, 'Single open door', 'casement', 900, 2100, '60 series casement door', cs(one('LH'), { door: true })),
  t('od2', G.CD, 'Double open door', 'casement', 1800, 2100, '60 series casement door', cs([C(R('LH')), C(R('RH'))], { door: true })),
  t('od3', G.CD, 'Door + side light', 'casement', 1800, 2100, '60 series casement door', cs([C(R('LH')), C(R('FIXED'), .5)], { door: true })),
  t('odf', G.CD, 'Door with fixed top', 'casement', 900, 2400, '60 series casement door', cs([C([R('FIXED', .25), R('RH', .75)])], { door: true })),
  t('v1', G.V, 'Top-hung', 'combination', 600, 900, '60 series ventilator', cs(one('TOP'))),
  t('v2', G.V, 'Louvre', 'combination', 600, 900, '60 series ventilator', cs(one('LOUVRE'))),
  t('v3', G.V, 'Exhaust fan', 'combination', 300, 300, '60 series ventilator', cs(one('FAN'))),
  t('v4', G.V, 'Fixed · top-hung', 'combination', 900, 600, '60 series ventilator', cs([C([R('FIXED', .5), R('TOP', .5)])])),
  t('v5', G.V, 'Fixed · louvre', 'combination', 900, 600, '60 series ventilator', cs([C([R('FIXED', .5), R('LOUVRE', .5)])])),
  t('v6', G.V, 'Fan left · fixed · top-hung', 'combination', 900, 600, '60 series ventilator', cs([C(R('FAN'), 1), C(R('FIXED'), 2)], { band: { at: 'bottom', h: .5, op: 'TOP' } })),
  t('v7', G.V, 'Fan right · fixed · top-hung', 'combination', 900, 600, '60 series ventilator', cs([C(R('FIXED'), 2), C(R('FAN'), 1)], { band: { at: 'bottom', h: .5, op: 'TOP' } })),
  t('v8', G.V, 'Fan left · fixed · louvre', 'combination', 900, 600, '60 series ventilator', cs([C(R('FAN'), 1), C(R('FIXED'), 2)], { band: { at: 'bottom', h: .5, op: 'LOUVRE' } })),
  t('v9', G.V, 'Fan right · fixed · louvre', 'combination', 900, 600, '60 series ventilator', cs([C(R('FIXED'), 2), C(R('FAN'), 1)], { band: { at: 'bottom', h: .5, op: 'LOUVRE' } })),
  t('v10', G.V, 'Fan left · fixed below · louvre right', 'combination', 900, 600, '60 series ventilator', cs([C([R('FAN', .5), R('FIXED', .5)], 1), C([R('LOUVRE', 1)], 2)])),
  t('v11', G.V, 'Louvre left · fan right · fixed below', 'combination', 900, 600, '60 series ventilator', cs([C([R('LOUVRE', .6), R('FIXED', .4)]), C([R('FAN', .6), R('FIXED', .4)])])),
  t('b1', G.B, 'L-shaped bay (90°)', 'casement', 1800, 1200, '60 series bay window', cs([C(R('FIXED')), C(R('FIXED'))], { bay: true, bayType: 'corner' })),
]
// "→ ←" / "LH RH" badge shown on the design cards
export const badge = d => d.kind === 'sliding' ? ((d.panels === 3 && (d.centre || d.mesh)) ? '→ ←' : Array.from({ length: d.panels }, (_, i) => (i < d.panels / 2 ? '→' : '←')).join(' ')) : (d.cols || []).flatMap(c => c.rows).map(r => ({ FIXED: '', LH: 'LH', RH: 'RH', TOP: 'TOP', TT: 'T&T' }[r.op] || '')).filter(Boolean).join(' ')
export const WINDOW_COLORS = [['White', '#f8f8f6'], ['Walnut', '#6b4a2e'], ['Mahogany', '#6f2f22'], ['Golden Oak', '#b9823f'], ['Anthracite Gray', '#3f4650'], ['Matte Black', '#1f2224'], ['Pattern Black', '#2b2d30'], ['Grey', '#9aa0a6'], ['Black', '#111827'], ['Golden Oak (laminate)', '#c4903f'], ['Walnut (laminate)', '#5a3d27'], ['Mahogany (laminate)', '#7a3326'], ['Grey (laminate)', '#8a9097']]
export const HW_FINISH = ['Match window color', 'White', 'Black', 'Brown', 'Silver', 'Walnut', 'Mahogany', 'Golden Oak', 'Anthracite Gray', 'Matte Black', 'Pattern Black', 'Grey', 'Golden Oak (laminate)', 'Walnut (laminate)', 'Mahogany (laminate)', 'Grey (laminate)']
export const SHAPES = [['rect', 'Rectangle'], ['arch', 'Arch top'], ['half', 'Half round'], ['multi', 'Multi-faced'], ['corner', 'Corner bay'], ['splay', 'Splayed bay'], ['box', 'Box bay']]

// Gallery order/visibility exactly as the reference app (33 designs; bay sits after "Fixed").
const HIDE = new Set(['k1', 'sdm', 'f2', 'f3', 'k2', 'k3', 'odf'])
export const GALLERY = (() => { const l = TEMPLATES.filter(x => !HIDE.has(x.id) && x.id !== 'b1'); const i = l.findIndex(x => x.id === 'f1'); l.splice(i + 1, 0, TEMPLATES.find(x => x.id === 'b1')); return l })()
export const CAT_ICONS = { 'All Designs': 'M4 4h7v7H4z M13 4h7v7h-7z M13 13h7v7h-7z M4 13h7v7H4z', 'SLIDING WINDOWS': 'M3 5h18v14H3z M12 5v14 M7 12h3 M8.5 10l2 2-2 2 M17 12h-3 M15.5 10l-2 2 2 2', 'SLIDING DOORS': 'M5 3h14v18H5z M2 21h20 M12 3v18 M7 12h3 M8.5 10l2 2-2 2 M17 12h-3 M15.5 10l-2 2 2 2', 'CASEMENT WINDOWS': 'M3 5h18v14H3z M3 5l18 7-18 7', 'CASEMENT DOORS': 'M6 3h12v18H6z M2 21h20 M6 3l12 9-12 9', VENTILATORS: 'M6 6h12v12H6z M6 10h12 M6 14h12', 'BAY WINDOWS': 'M2 7l5 10h10l5-10' }
