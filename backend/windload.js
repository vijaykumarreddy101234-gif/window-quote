// Theoretical wind-load assessment for one window (IS 875 Part 3 style site pressure + plate / beam / fixing checks).
// Indicative only: every assumption is printed on the report, and a structural engineer must verify it.
const CITIES = 'Agra:47,Ahmedabad:39,Ajmer:47,Almora:39,Amritsar:50,Asansol:47,Aurangabad:39,Bahraich:50,Bareilly:50,Barauni:47,Bengaluru:33,Bhatinda:47,Bhilai:44,Bhopal:47,Bhubaneshwar:50,Bhuj:50,Bikaner:47,Bokaro:39,Chandigarh:50,Chennai:50,Coimbatore:39,Cuttack:50,Darbhanga:47,Darjeeling:47,Dehra Dun:39,Delhi:50,Durgapur:47,Gangtok:47,Gaya:39,Gorakhpur:47,Guwahati:50,Hyderabad:44,Imphal:44,Jabalpur:39,Jaipur:47,Jamshedpur:47,Jhansi:47,Jodhpur:47,Kanpur:47,Kohima:44,Kolkata:50,Kozhikode:39,Kurnool:39,Lakshadweep:39,Lucknow:50,Ludhiana:50,Madurai:39,Mandi:39,Mangaluru:39,Moradabad:50,Mumbai:44,Mysuru:33,Nagpur:44,Nainital:47,Nasik:39,Nellore:50,Panaji:39,Patiala:50,Patna:47,Puducherry:50,Port Blair:44,Pune:39,Raipur:44,Rajkot:39,Ranchi:39,Roorkee:50,Rourkela:39,Simla:39,Srinagar:39,Surat:44,Thiruvananthapuram:39,Tiruchirrappalli:47,Udaipur:47,Vadodara:39,Varanasi:47,Vijaywada:50,Visakhapatnam:50'
  .split(',').map(x => { const [n, v] = x.split(':'); return { id: n.toLowerCase().replace(/\s+/g, '-'), name: n, basic_wind_speed_ms: +v, source: 'IS 875 (Part 3):2015 Amendment 2:2020, Annex A' } });
const WALLS = { rcc: ['RCC / concrete', 1.5], clay: ['Solid clay brick', 0.6], flyash: ['Fly-ash brick', 0.5], hollow: ['Hollow concrete block', 0.3], aac: ['AAC block', 0.25], other: ['Other (maker values)', 0] };
const DEV = { open: 1, scattered: 2, suburban: 3, dense: 4 }, K1 = { 5: 0.82, 25: 0.94, 50: 1.0, 100: 1.07 };
const K2_10 = { 1: 1.05, 2: 1.0, 3: 0.91, 4: 0.80 }, K2_ALPHA = { 1: 0.105, 2: 0.15, 3: 0.2, 4: 0.28 };
const lerp = (tab, r) => { const k = tab.map(t => t[0]); if (r <= k[0]) return tab[0][1]; for (let i = 1; i < tab.length; i++) if (r <= tab[i][0]) { const [x0, y0] = tab[i - 1], [x1, y1] = tab[i]; return y0 + (y1 - y0) * (r - x0) / (x1 - x0) } return tab[tab.length - 1][1] };
const BETA = [[1, .2874], [1.2, .3762], [1.4, .453], [1.6, .5172], [1.8, .5688], [2, .6102], [3, .7134], [5, .75]];
const ALPHA = [[1, .0443], [1.2, .0616], [1.4, .077], [1.6, .0906], [1.8, .1017], [2, .1106], [3, .1336], [5, .1422]];

function sitePressure(c) {
  const city = CITIES.find(x => x.id === c.city_id), vb = city ? city.basic_wind_speed_ms : +c.basic_wind_speed || 44;
  const tc = DEV[c.development] || 2, H = Math.max(3, +c.building_height || 10), z = Math.max(+c.elevation || H, 3);
  const k1 = K1[+c.design_life] || 1, k2 = Math.min(1.2, K2_10[tc] * Math.pow(Math.max(z, 10) / 10, K2_ALPHA[tc]) || 1);
  const k3 = /hill/.test(c.environment || '') ? 1.1 : 1, k4 = 1, vz = vb * k1 * k2 * k3 * k4, pz = 0.6 * vz * vz / 1000;
  const cpe = { middle: 1.0, edge: 1.5, corner: 2.0 }[c.position] || 1.0, cpi = 0.5, kd = 0.9, ka = 0.9, kc = 0.9;
  const p = Math.max(pz * Math.max(kd * ka * kc, 0.8) * (cpe + cpi) * 0.5, 0.3);
  return { p, steps: [['Basic wind speed Vb', vb + ' m/s' + (city ? ' · ' + city.name : '')], ['Risk factor k1 (' + (c.design_life || 50) + ' yr)', k1], ['Terrain / height factor k2 (category ' + tc + ', z = ' + z + ' m)', k2.toFixed(3)], ['Topography factor k3', k3], ['Design wind speed Vz', vz.toFixed(1) + ' m/s'], ['Wind pressure pz = 0.6 Vz²', pz.toFixed(3) + ' kPa'], ['Cpe (' + (c.position || 'middle') + ') / Cpi', cpe + ' / ±' + cpi], ['Kd × Ka × Kc', (kd * ka * kc).toFixed(3)], ['Design pressure on window', p.toFixed(2) + ' kPa']] };
}
function assess(it, e, cfg) {
  const method = cfg.method === 'site' ? 'site' : 'specified', sp = method === 'site' ? sitePressure(cfg) : null;
  const p = method === 'site' ? sp.p : Math.max(0.1, +cfg.pressure_kpa || 1.5), pMPa = p / 1000;
  const W = +it.width, H = +it.height, glassName = String(it.glass || ''), t = parseFloat((glassName.match(/(\d+(\.\d+)?)\s*mm/) || [])[1]) || 5, tough = /toughened|tempered/i.test(glassName);
  const checks = [], panes = (e && e.panes || []).filter(x => !x.mesh && x.w && x.h);
  const worst = panes.length ? panes.reduce((a, x) => (x.w * x.h > a.w * a.h ? x : a)) : { name: 'Pane', w: W - 120, h: H - 120 };
  const a = Math.max(worst.w, worst.h), b = Math.min(worst.w, worst.h), r = a / b, E = 70000;
  const sigma = lerp(BETA, r) * pMPa * b * b / (t * t), allow = tough ? 40 : 15, defl = lerp(ALPHA, r) * pMPa * Math.pow(b, 4) / (E * t * t * t), dlim = b / 60;
  checks.push({ name: `Glass strength — ${worst.name} ${Math.round(worst.w)} × ${Math.round(worst.h)} mm, ${t} mm ${tough ? 'toughened' : 'annealed'}`, demand: sigma.toFixed(1) + ' MPa', limit: allow + ' MPa', ratio: sigma / allow, basis: 'Simply supported rectangular plate, σ = β·p·b²/t²' });
  checks.push({ name: 'Glass deflection', demand: defl.toFixed(1) + ' mm', limit: dlim.toFixed(1) + ' mm (b/60)', ratio: defl / dlim, basis: 'δ = α·p·b⁴/(E·t³), small-deflection theory' });
  const frames = (e && e.cuts || []).filter(c => c.role === 'Frame'), code = frames[0] ? frames[0].code : 'frame', series = parseInt(String(it.system).match(/\d+/)) || 60;
  const Ipvc = series >= 80 ? 353000 : 353577, Ist = series >= 80 ? 8669 : 8669, Eeq = 2800 * Ipvc + 200000 * Ist, spanL = Math.min(W, H), trib = Math.min(Math.max(W, H) / 2, 600), w = p / 1000 * trib;
  const bd = 5 * w * Math.pow(spanL, 4) / (384 * Eeq), bl = spanL / 175;
  checks.push({ name: `Frame member ${code} — jamb span ${Math.round(spanL)} mm, tributary ${Math.round(trib)} mm`, demand: bd.toFixed(1) + ' mm', limit: bl.toFixed(1) + ' mm (L/175)', ratio: bd / bl, basis: 'UDL on simply supported beam; PVC + GI composite EI (steel 1.2 mm GI assumed)' });
  const n = Math.max(4, 2 * Math.ceil((W + H) / 600)), load = p * W * H / 1e6 / n, wall = WALLS[cfg.wall] || WALLS.rcc, cap = cfg.wall === 'other' ? (+cfg.fixing_capacity_kn || 0) : wall[1];
  checks.push({ name: `Fixings — ${n} × 8 × 100 mm at ≤ 600 mm centres into ${cfg.wall ? wall[0] : 'RCC / concrete (assumed)'}`, demand: load.toFixed(2) + ' kN each', limit: cap ? cap + ' kN' : 'not supplied', ratio: cap ? load / cap : null, basis: 'Total load shared equally; indicative recommended loads' });
  checks.forEach(c => { c.status = c.ratio == null ? 'info' : c.ratio <= 1 ? 'pass' : 'fail' });
  return { method, pressure_kpa: +p.toFixed(2), site: sp && sp.steps, checks, overall: checks.every(c => c.status !== 'fail') ? 'pass' : 'fail', window: { mark: it.mark, name: it.name, width: W, height: H, glass: glassName, system: it.system, frame: code } };
}
module.exports = function (api, db, { quoteEntries, docs, uid, now }) {
  db.exec('CREATE TABLE IF NOT EXISTS wind_cfg (item_id TEXT PRIMARY KEY, json TEXT, updated_at TEXT)');
  const cfgOf = id => { try { return JSON.parse(db.prepare('SELECT json FROM wind_cfg WHERE item_id=?').get(id).json) } catch (e) { return null } };
  api.get('/quotations/:id/wind-load', (req, res) => {
    const ents = quoteEntries(req.params.id);
    res.json({ site_cities: CITIES, walls: Object.entries(WALLS).map(([k, v]) => ({ id: k, name: v[0] })), windows: ents.map(({ it, e }) => ({ id: it.id, design_ref: it.mark, name: it.name, width_mm: it.width, height_mm: it.height, glass: it.glass, system: it.system, members: ((e && e.cuts) || []).filter(c => ['Frame', 'Sash', 'Interlock'].includes(c.role)).map(c => ({ role: c.role, code: c.code, name: c.name })), config: cfgOf(it.id) })) });
  });
  const run = (req, res, save) => {
    const ent = quoteEntries(req.params.id).find(x => x.it.id === req.params.itemId); if (!ent) return res.status(404).json({ error: 'Window not found' });
    const cfg = { ...(cfgOf(ent.it.id) || {}), ...(req.body || {}), ...(req.query || {}) }; if (save && req.body) db.prepare('INSERT INTO wind_cfg (item_id,json,updated_at) VALUES (?,?,?) ON CONFLICT(item_id) DO UPDATE SET json=excluded.json, updated_at=excluded.updated_at').run(ent.it.id, JSON.stringify(req.body), now());
    return { ent, cfg, A: assess(ent.it, ent.e, cfg) };
  };
  api.post('/quotations/:id/wind-load/:itemId', (req, res) => { const r = run(req, res, true); if (r) res.json(r.A) });
  api.post('/quotations/:id/wind-load/:itemId/pdf', async (req, res) => {
    const r = run(req, res, true); if (!r) return; const q = db.prepare('SELECT number FROM quotations WHERE id=?').get(req.params.id) || {};
    const doc = new docs.PDFDocument({ size: 'A4', margin: 40 }), chunks = []; doc.on('data', c => chunks.push(c));
    const A = r.A, M = 40, Wd = 515; doc.font('Helvetica-Bold').fontSize(16).text('Theoretical wind-load calculation', M, 40); doc.font('Helvetica').fontSize(10).fillColor('#6b7280').text(`${q.number || ''} · Window ${A.window.mark} — ${A.window.name}`);
    doc.moveDown(.6); doc.rect(M, doc.y, Wd, 44).fill('#fef3c7'); doc.fillColor('#92400e').font('Helvetica-Bold').fontSize(9).text('Under development. ', M + 8, doc.y - 38, { continued: true }).font('Helvetica').text('Theoretical calculation only, tested against qualified engineers’ calculations. Have a structural engineer check the results before use for approval.', { width: Wd - 16 }); doc.y += 20; doc.fillColor('#111827');
    const h2 = t => { doc.moveDown(.8); doc.font('Helvetica-Bold').fontSize(12).fillColor('#111827').text(t, M); doc.moveDown(.3) }, row = (a, b) => { const y = doc.y; doc.font('Helvetica').fontSize(9.5).fillColor('#374151').text(a, M, y, { width: 300 }); doc.font('Helvetica-Bold').fillColor('#111827').text(String(b), M + 310, y, { width: 205 }); doc.moveDown(.25) };
    h2('Window'); row('Size', `${A.window.width} × ${A.window.height} mm`); row('System', A.window.system); row('Frame profile', A.window.frame); row('Glass', A.window.glass);
    h2('Design pressure'); row('Method', A.method === 'site' ? 'Calculated from IS 875 (Part 3) site inputs' : 'Specified test pressure (±, service load)'); (A.site || []).forEach(s => row(s[0], s[1])); row('Pressure checked', A.pressure_kpa + ' kPa');
    h2('Checks'); A.checks.forEach(c => { doc.font('Helvetica-Bold').fontSize(9.5).fillColor('#111827').text(c.name, M, doc.y, { width: 420 }); const y = doc.y; row('Demand / limit', `${c.demand}  /  ${c.limit}`); row('Result', c.status === 'pass' ? 'PASS' : c.status === 'fail' ? 'FAIL' : 'Information'); doc.font('Helvetica-Oblique').fontSize(8.5).fillColor('#6b7280').text(c.basis, M); doc.moveDown(.5) });
    h2('Overall'); doc.font('Helvetica-Bold').fontSize(14).fillColor(A.overall === 'pass' ? '#15803d' : '#b91c1c').text(A.overall === 'pass' ? 'All checks pass (theoretical)' : 'One or more checks fail');
    doc.moveDown(1).font('Helvetica').fontSize(8).fillColor('#6b7280').text('Assumptions: glass simply supported on four edges; E(glass) 70 GPa; annealed allowable 15 MPa, toughened 40 MPa; PVC E 2800 MPa; galvanised reinforcement E 200 GPa; fixing capacities are indicative values for 8 × 100 mm expansion bolts. Not a substitute for an engineer’s design.', M, doc.y, { width: Wd });
    doc.end(); await new Promise(rs => doc.on('end', rs)); const buf = Buffer.concat(chunks);
    res.setHeader('Content-Type', 'application/pdf'); res.setHeader('Content-Disposition', `attachment; filename="${(q.number || 'QT')}-${A.window.mark}-wind-load.pdf"`); res.end(buf);
  });
};
