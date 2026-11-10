// Quotation-level calculations shared by the backend and the browser preview:
// costing roll-up (Pricing tab) and material balance (Inventory tab).
const SQFT = 92903.04;
const r2 = x => +(+x || 0).toFixed(2);

// entries: [{ it: {id,mark,name,qty,width,height,...}, e: engine result }]
function costing(entries, p, comm, tot) {
  const S = {};
  const add = (k, v) => { S[k] = (S[k] || 0) + v };
  entries.forEach(({ it, e }) => {
    const q = +it.qty || 1; if (!e || !e.unit) return;
    (e.rows || []).forEach(([n, v]) => {
      const k = /^Profile wastage/.test(n) ? 'pw' : /^Profile cost/.test(n) ? 'pc' : /^Reinforcement wastage/.test(n) ? 'rw' : /^Reinforcement cost/.test(n) ? 'rc' : /^Hardware/.test(n) ? 'hw' : /^Glass wastage/.test(n) ? 'gw' : /^Glass cost/.test(n) ? 'gc' : /^Mesh cost/.test(n) ? 'mc' : 'ex';
      add(k, v * q);
    });
    (e.labour || []).forEach((l, i) => add(['fab', 'inl', 'inm'][i], l[1] * q));
    add('area', (e.area || 0) * q); add('unit', e.unit * q);
  });
  const g = k => S[k] || 0;
  const raw = g('pc') + g('pw') + g('rc') + g('rw') + g('hw') + g('gc') + g('gw') + g('mc') + g('ex');
  const sub = raw + g('fab') + g('inl') + g('inm');
  const win = g('unit'), profit = win - sub;
  const grand = tot.total || 0, pct = v => grand ? r2(v / grand * 100) : 0;
  const H = (key, label, value, extra = {}) => ({ key, label, value: r2(value), pct: pct(value), ...extra });
  const rows = [
    H('pc', 'Profile Cost', g('pc')),
    H('pw', 'Profile Wastage', g('pw'), { rate: p.profile_wastage, rateKey: 'profile_wastage', unit: '%', of: 'of Profile Cost', nopct: true }),
    H('rc', 'RI Cost', g('rc')),
    H('rw', 'RI Wastage', g('rw'), { rate: p.ri_wastage, rateKey: 'ri_wastage', unit: '%', of: 'of RI Cost', nopct: true }),
    H('hw', 'Hardware Cost', g('hw')),
    H('gc', 'Glass Cost', g('gc')),
    H('gw', 'Glass Wastage', g('gw'), { rate: p.glass_wastage ?? 15, rateKey: 'glass_wastage', unit: '%', of: 'of Glass Cost', nopct: true }),
    H('mc', 'Mesh Cost', g('mc')),
    H('mw', 'Mesh Wastage', 0, { rate: 0, unit: '%', of: 'of Mesh Cost', nopct: true, fixed: true }),
    ...(g('ex') ? [H('ex', 'Extra costs', g('ex'))] : []),
    H('raw', 'Total Raw Material Cost', raw, { total: true }),
    H('fab', 'Fabrication Labour', g('fab'), { rate: p.fab_labour, rateKey: 'fab_labour', unit: '₹/ sq ft', nopct: true }),
    H('inl', 'Installation Labour', g('inl'), { rate: p.install_labour, rateKey: 'install_labour', unit: '₹/ sq ft', nopct: true }),
    H('inm', 'Installation Material Cost', g('inm'), { rate: p.install_material, rateKey: 'install_material', unit: '₹/ sq ft', nopct: true }),
    H('sub', 'Sub Total inc. Labour', sub, { total: true }),
    H('profit', 'Profit', profit, { rate: p.profit, rateKey: 'profit', unit: '%', of: 'of Sub Total inc. Labour', nopct: true }),
    H('win', 'Window subtotal', win, { total: true }),
    { key: 'discount', label: 'Discount', value: -r2(tot.discountAmt || 0), pct: 0, rate: comm.discount || 0, rateKey: 'discount', unit: '%', comm: true, nopct: true },
    H('transport', 'Transportation', tot.transport || 0, { rate: comm.transport, rateKey: 'transport', unit: '₹', comm: true }),
    H('loading', 'Loading', tot.loading || 0, { rate: comm.loading, rateKey: 'loading', unit: '₹', comm: true }),
    H('unloading', 'Unloading', tot.unloading || 0, { rate: comm.unloading, rateKey: 'unloading', unit: '₹', comm: true }),
    H('cgst', 'CGST', tot.cgst || 0), H('sgst', 'SGST', tot.sgst || 0),
    H('round', 'Round off', tot.roundOff || 0, { nopct: true }),
  ];
  return { rows, area: r2(g('area')), grand: r2(grand), perSqft: g('area') ? r2(grand / g('area')) : 0, perSqftEx: g('area') ? r2((tot.subtotal - (tot.discountAmt || 0) + (tot.transport || 0) + (tot.loading || 0) + (tot.unloading || 0)) / g('area')) : 0, windows: entries.length };
}

const BAR = 5800; // profile bar length, mm
// meta(name) -> { code, brand, unit, stock } for a hardware name (or null)
function materials(entries, meta, extra = [], brand = 'S CRAFT') {
  const groups = {}, put = (grp, key, row) => { const G = groups[grp] = groups[grp] || {}; const o = G[key] = G[key] || { ...row, required: 0 }; o.required += row.required };
  const prof = {};
  entries.forEach(({ it, e }) => {
    const q = +it.qty || 1; if (!e) return;
    (e.hardware || []).forEach(h => { const m = meta(h.name) || {}; put(m.brand || 'Generic Hardware', h.name, { label: h.name, id: m.id, code: m.code || '', unit: m.unit || 'pc', stock: m.stock || 0, required: (+h.qty || 0) * q }) });
    (e.cuts || []).forEach(c => { const P = prof[c.code] = prof[c.code] || { name: c.name, white: 0, gi: 0 }; const lens = c.lens || []; P.white += lens.reduce((a, b) => a + b, 0) * q; if (!/Bead|Inter/i.test(c.role || '')) P.gi += lens.reduce((a, b) => a + Math.max(0, b - 100), 0) * q });
    (e.panes || []).forEach(pn => { if (pn.mesh || !pn.w) return; put('Glass', pn.glass || it.glass, { label: pn.glass || it.glass, code: '', unit: 'sq ft', stock: 0, required: pn.w * pn.h / SQFT * q }) });
    if (e.includeMesh && it.mesh && it.mesh !== 'No mesh') { const a = (e.panes || []).filter(pn => pn.mesh).reduce((s, pn) => s + (pn.w || 0) * (pn.h || 0) / SQFT, 0); if (a) put('Mesh', it.mesh, { label: it.mesh, code: '', unit: 'sq ft', stock: 0, required: a * q }) }
  });
  Object.entries(prof).forEach(([code, P]) => {
    const w = Math.ceil(P.white / BAR - 1e-9), gi = Math.ceil(P.gi / BAR - 1e-9);
    if (w) put(brand, code + 'W', { label: `${code} · ${P.name} · White · v31`, code, unit: 'bar', stock: 0, required: w });
    if (gi) put(brand, code + 'G', { label: `${code} · ${P.name} · White · GI 1.2 mm · v31`, code, unit: 'bar', stock: 0, required: gi });
  });
  (extra || []).forEach(x => { if (x && x.name) put('Installation materials', 'x' + x.name, { label: x.name, code: '', unit: x.unit || 'pc', stock: 0, required: +x.qty || 0 }) });
  const order = ['Generic Hardware', 'Accessories and Installation Material', brand, 'Glass', 'Mesh', 'Installation materials'];
  const out = Object.keys(groups).sort((a, b) => (order.indexOf(a) + 99) % 99 - (order.indexOf(b) + 99) % 99).map(name => ({ name, items: Object.values(groups[name]).map(r => { const required = r.unit === 'sq ft' || r.unit === 'm' ? r2(r.required) : Math.ceil(r.required - 1e-9); return { label: r.label, id: r.id, code: r.code, unit: r.unit, required, stock: r.stock || 0, balance: r2(Math.max(0, required - (r.stock || 0))) } }) }));
  const all = out.flatMap(g => g.items);
  return { groups: out, totals: { required: all.length, inStock: all.filter(i => i.stock >= i.required && i.required > 0).length, toProcure: all.filter(i => i.balance > 0).length } };
}



// ---------------------------------------------------------------------------
// Report data for the printable documents (Quotation, Elevation, Costing, Material requirement).
// Same structure as the demo's PDFs. Pure: used by the backend and the in-browser preview.
const KERF = 10, REUSE = 350;
const GI_KGM = { 'RSC-60OF': .887, 'RSC-74TM': .811, 'RSC-78WO': .658, 'RSC-42VF': .6, 'RSC-72OF': 1, 'RSC-104OD': 1.1 };   // GI kg/m on host profiles (casement, from the demo's costing)
const NOGI = /Bead|Interlock|Coupler/i;
function cutBars(pieces, bar) {
  const P = pieces.filter(x => x > 0).sort((a, b) => b - a), bars = [];
  P.forEach(l => { let b = bars.find(r => r.rem >= l); if (!b) { b = { rem: bar }; bars.push(b) } b.rem -= l + KERF; if (b.rem < 0) b.rem = 0 });
  const scrap = bars.reduce((a, b) => a + (b.rem < REUSE ? b.rem : 0), 0), loss = P.length * KERF + scrap;
  return { bars: bars.length, waste: bars.length ? loss / (bars.length * bar) * 100 : 0 };
}
const cls = n => /^Profile wastage/.test(n) ? 'pw' : /^Profile cost/.test(n) ? 'pc' : /^Reinforcement wastage/.test(n) ? 'rw' : /^Reinforcement cost/.test(n) ? 'rc' : /^Hardware/.test(n) ? 'hw' : /^Glass wastage/.test(n) ? 'gw' : /^Glass cost/.test(n) ? 'gc' : /^Mesh cost/.test(n) ? 'mc' : 'ex';
const uniq = a => [...new Set(a)];
const sortCode = (a, b) => a < b ? -1 : a > b ? 1 : 0;

// meta: { hw(name) -> {code, unit, stock}|null, glass(name) -> rate per m2 | null }
function report(entries, p, comm, tot, meta) {
  const ents = entries.filter(x => x.e && x.e.unit);
  const stockLen = BAR, white = p.white_rate, giRate = p.gi_rate || 100;
  const marks = [];
  const items = ents.map(({ it, e }) => {
    const q = +it.qty || 1, S = {}; (e.rows || []).forEach(([n, v]) => { const k = cls(n); S[k] = (S[k] || 0) + v * q });
    const lab = (e.labour || []).map(l => l[1] * q), g = k => S[k] || 0;
    const area = (+it.width || 0) * (+it.height || 0) / SQFT * q;
    const o = { mark: it.mark, name: it.name, w: it.width, h: it.height, qty: q, area, pw: g('pw'), rw: g('rw'), gw: g('gw'), mesh: g('mc'), fab: lab[0] || 0, inl: lab[1] || 0, profile: g('pc'), reinf: g('rc'), hw: g('hw'), glassMesh: g('gc') + g('mc'), waste: g('pw') + g('rw') + g('gw'), labour: (lab[0] || 0) + (lab[1] || 0), other: (lab[2] || 0) + g('ex'), net: e.unit * q };
    o.cost = o.profile + o.reinf + o.hw + o.glassMesh + o.waste + o.labour + o.other; o.perSqft = area ? o.cost / area : 0; o.margin = o.net ? (o.net - o.cost) / o.net * 100 : 0; return o;
  });
  const sum = k => items.reduce((a, x) => a + x[k], 0), area = sum('area');
  // ---- cost summary (whole quotation)
  const pcs = items.reduce((a, x) => a + x.profile, 0);
  const T = {}; ents.forEach(({ e, it }) => { const q = +it.qty || 1; (e.rows || []).forEach(([n, v]) => { const k = cls(n); T[k] = (T[k] || 0) + v * q }); (e.labour || []).forEach((l, i) => { const k = ['fab', 'inl', 'inm'][i]; T[k] = (T[k] || 0) + l[1] * q }) });
  const g = k => T[k] || 0, raw = g('pc') + g('pw') + g('rc') + g('rw') + g('hw') + g('gc') + g('gw') + g('mc') + g('ex'), sub = raw + g('fab') + g('inl') + g('inm');
  const basic = ents.reduce((a, { e, it }) => a + e.unit * (+it.qty || 1), 0), profit = basic - sub, disc = tot.discountAmt || 0, ch = (tot.transport || 0) + (tot.loading || 0) + (tot.unloading || 0), project = basic - disc + ch;
  const wastage = g('pw') + g('rw') + g('gw');
  const pct = v => basic ? v / basic * 100 : 0, ps = v => area ? v / area : 0, rr = (label, basis, v, o = {}) => ({ label, basis, value: v, perSqft: ps(v), pct: pct(v), ...o });
  const summary = [
    rr('Profile Cost', 'Sum of profile, bead & gasket lines', g('pc')), rr('Profile Wastage', `${p.profile_wastage}% of Profile Cost`, g('pw')), rr('RI Cost', 'Sum of reinforcement lines', g('rc')), rr('RI Wastage', `${p.ri_wastage}% of RI Cost`, g('rw')),
    rr('Hardware Cost', 'Sum of hardware lines', g('hw')), rr('Glass Cost', 'Sum of glass lines', g('gc')), rr('Glass Wastage', `${p.glass_wastage ?? 15}% of Glass Cost`, g('gw')), rr('Mesh Cost', 'Sum of mesh lines', g('mc')), rr('Mesh Wastage', '0% of Mesh Cost', 0),
    ...(g('ex') ? [rr('Extra costs', 'Cut-outs and manual extras', g('ex'))] : []),
    rr('Total Raw Material Cost', 'Material + wastage', raw, { strong: 1 }), rr('Fabrication Labour', `INR ${(+p.fab_labour).toFixed(2)} / sq ft`, g('fab')), rr('Installation Labour', `INR ${(+p.install_labour).toFixed(2)} / sq ft`, g('inl')), rr('Installation Material Cost', `INR ${(+p.install_material).toFixed(2)} / sq ft`, g('inm')),
    rr('Sub Total inc. Labour', 'Raw material + labour', sub, { strong: 1 }), rr('Profit', `${p.profit}% of Sub Total inc. Labour`, profit), rr('Basic Value', 'Sub total + profit', basic, { strong: 1 }),
    rr('Discount', `${comm.discount || 0}% of Basic Value`, disc), rr('Transportation', 'Lump sum on the quotation', tot.transport || 0), rr('Loading & Unloading', 'Lump sum on the quotation', (tot.loading || 0) + (tot.unloading || 0)),
    rr('Total Project Cost', 'Basic − discount + charges', project, { strong: 1 }), rr('CGST', '9% of Total Project Cost', tot.cgst || 0), rr('SGST', '9% of Total Project Cost', tot.sgst || 0),
    ...(tot.roundOff ? [rr('Round off', 'Rounding to the nearest rupee', tot.roundOff)] : []), rr('Grand Total', 'Project cost + GST, rounded', tot.total || 0, { strong: 1 })];
  // ---- profile / reinforcement / hardware / glass lines
  const P = {}, RI = {}, H = {}, GL = {}, GP = [], GAS = {};
  ents.forEach(({ it, e }) => {
    const q = +it.qty || 1, mk = it.mark, cuts = e.cuts || [];
    cuts.forEach(c => { const o = P[c.code] = P[c.code] || { code: c.code, name: c.name, m: 0, kg: 0, w: [], pieces: [], gi: [], role: c.role }; const lens = c.lens || []; o.m += lens.reduce((a, b) => a + b, 0) / 1000 * q; o.kg += c.kg * q; o.w.push(mk); lens.forEach(l => { for (let i = 0; i < q; i++) o.pieces.push(l) });
      if (!NOGI.test(c.role || '')) { const ri = e.riInfo || {}, kgm = /Frame/.test(c.role) && ri.Frame ? ri.Frame.kgm : /Sash/.test(c.role) && ri.Sash ? ri.Sash.kgm : (GI_KGM[c.code] || (c.metres ? c.kg / c.metres * .6 : .6)), thk = (/Frame/.test(c.role) ? (ri.Frame || {}).thk : (ri.Sash || {}).thk) || 1.2;
        const r = RI[c.code] = RI[c.code] || { code: c.code, host: c.name, thk, m: 0, kg: 0, w: [], pieces: [] }; lens.forEach(l => { const gi = Math.max(0, l - 100); r.m += gi / 1000 * q; r.kg += gi / 1000 * kgm * q; for (let i = 0; i < q; i++) r.pieces.push(gi) }); r.w.push(mk) } });
    (e.gaskets || []).forEach(x => { const o = GAS[x.code] = GAS[x.code] || { code: x.code, name: x.name, m: 0, rate: x.rate, w: [] }; o.m += x.m * q; o.w.push(mk) });
    (e.hardware || []).forEach(h => { const m = (meta.hw && meta.hw(h.name)) || {}, o = H[h.name] = H[h.name] || { name: h.name, code: m.code || '', unit: m.unit || (/TRACK/i.test(h.name) ? 'm' : 'pc'), qty: 0, rate: h.rate, w: [] }; o.qty += (+h.qty || 0) * q; o.w.push(mk) });
    (e.panes || []).forEach(pn => { const nm = pn.glass || it.glass, rate = (meta.glass && meta.glass(nm)) || 0, o = GL[nm] = GL[nm] || { name: nm, kind: 'Glass', rate, m2: 0, w: [], pieces: 0 }; o.m2 += pn.w * pn.h / 1e6 * q; o.pieces += q; if (!o.w.includes(mk)) o.w.push(mk); GP.push({ spec: nm, w: Math.round(pn.w), h: Math.round(pn.h), qty: q, mark: mk }) });
    if (e.mesh) { const o = GL['mesh net'] = GL['mesh net'] || { name: 'mesh net', kind: 'Mesh', rate: e.mesh.rate * 10.7639, m2: 0, w: [], pieces: 0 }; o.m2 += e.mesh.n * e.mesh.w * e.mesh.h / 1e6 * q; o.pieces += e.mesh.n * q; o.w.push(mk); GP.push({ spec: 'mesh net', w: e.mesh.w, h: e.mesh.h, qty: e.mesh.n * q, mark: mk }) }
  });
  const kgmOf = code => { const o = P[code]; return o && o.m ? o.kg / o.m : 0 };
  const profileLines = Object.values(P).sort((a, b) => sortCode(a.code, b.code)).map(o => ({ code: o.code, name: o.name, m: o.m, kg: o.kg, rate: white, amount: o.kg * white, w: uniq(o.w) }));
  const gasLines = Object.values(GAS).map(o => ({ code: o.code, name: `${o.name} [${o.code}]`, m: o.m, kg: null, rate: o.rate, unit: 'm', amount: o.m * o.rate, w: uniq(o.w) }));
  const pSum = profileLines.reduce((a, x) => a + x.amount, 0) + gasLines.reduce((a, x) => a + x.amount, 0);
  if (Math.abs(pSum - g('pc')) > .05 && profileLines.length) { const k = (g('pc') - gasLines.reduce((a, x) => a + x.amount, 0)) / (profileLines.reduce((a, x) => a + x.amount, 0) || 1); profileLines.forEach(x => { x.amount *= k; x.kg *= k }) }
  const pAll = [...profileLines, ...gasLines].sort((a, b) => { const A = a.unit ? 'RSB~' : a.code, B = b.unit ? 'RSB~' : b.code; return sortCode(A, B) });
  const riLines = Object.values(RI).sort((a, b) => sortCode(a.code, b.code)).map(o => ({ code: o.code, name: `GI ${o.thk} mm in ${o.code}`, m: o.m, kg: o.kg, rate: giRate, amount: o.kg * giRate, w: uniq(o.w), thk: o.thk }));
  { const t = riLines.reduce((a, x) => a + x.amount, 0); if (t > 0 && Math.abs(t - g('rc')) > .05) { const k = g('rc') / t; riLines.forEach(x => { x.amount *= k; x.kg *= k }) } }
  const hwLines = Object.values(H).map(o => ({ name: o.code ? `${o.name} [${o.code}]` : o.name, qty: o.qty, unit: o.unit, rate: o.rate, amount: o.qty * o.rate, w: uniq(o.w) }));
  { const t = hwLines.reduce((a, x) => a + x.amount, 0); if (g('hw') - t > .5) hwLines.push({ name: 'Other hardware and accessories', qty: 1, unit: 'lot', rate: g('hw') - t, amount: g('hw') - t, w: [] }) }
  const glassLines = Object.values(GL).sort((a, b) => (a.kind === 'Mesh') - (b.kind === 'Mesh') || sortCode(a.name, b.name)).map(o => ({ name: (o.kind === 'Mesh' ? 'Mesh net' : 'Glass ' + o.name), m2: o.m2, sqft: o.m2 * 10.7639, rate: o.rate, amount: o.m2 * o.rate, w: uniq(o.w) }));
  { const gm = glassLines.reduce((a, x) => a + x.amount, 0), want = g('gc') + g('mc'); if (gm > 0 && Math.abs(gm - want) > .05) { const k = want / gm; glassLines.forEach(x => { x.amount *= k; x.rate *= k }) } }
  // ---- materials
  const bars = Object.values(P).sort((a, b) => sortCode(a.code, b.code)).map(o => { const r = cutBars(o.pieces, stockLen), kgm = kgmOf(o.code); return { code: o.code, name: o.name, pieces: o.pieces.length, m: o.pieces.reduce((a, b) => a + b, 0) / 1000, len: stockLen, bars: r.bars, billing: r.bars * stockLen / 1000, kg: r.bars * stockLen / 1000 * kgm, waste: r.waste } });
  const riBars = Object.values(RI).sort((a, b) => sortCode(a.code, b.code)).map(o => { const r = cutBars(o.pieces, stockLen), kgm = o.m ? (riLines.find(x => x.code === o.code) || {}).kg / o.m : 0; return { host: o.code, thk: o.thk, pieces: o.pieces.length, m: o.pieces.reduce((a, b) => a + b, 0) / 1000, len: stockLen, bars: r.bars, billing: r.bars * stockLen / 1000, kg: r.bars * stockLen / 1000 * kgm, waste: r.waste } });
  const gKinds = {}; GP.forEach(x => { const k = gKinds[x.spec] = gKinds[x.spec] || { spec: x.spec, kind: x.spec === 'mesh net' ? 'Mesh' : 'Glass', pieces: 0, sqft: 0, sizes: {} }; k.pieces += x.qty; k.sqft += x.w * x.h / SQFT * x.qty; const kk = x.w + 'x' + x.h, z = k.sizes[kk] = k.sizes[kk] || { w: x.w, h: x.h, qty: 0, win: [] }; z.qty += x.qty; if (!z.win.includes(x.mark)) z.win.push(x.mark) });
  const glassReq = Object.values(gKinds);
  const glassArea = glassReq.filter(k => k.kind === 'Glass').reduce((a, k) => a + k.sqft, 0);
  const notes = []; Object.values(GL).forEach(o => { if (o.kind === 'Glass' && !o.rate) notes.push(`glass ${o.name} has no tenant rate; priced at the default glass rate (Settings [U+2192] Pricing [U+2192] Glass)`) });
  return { items, area, count: items.length, units: items.reduce((a, x) => a + x.qty, 0), tiles: { cost: sub, net: basic, contribution: profit, margin: basic ? profit / basic * 100 : 0, wastage, wastePct: sub ? wastage / sub * 100 : 0 }, summary,
    profileLines: pAll, riLines, hwLines, glassLines, grand: tot.total || 0, gross: tot.total, net: project,
    mat: { bars, riBars, glassReq, hw: hwLines.filter(h => h.w.length).map(h => ({ name: h.name, qty: h.qty, unit: h.unit, w: h.w })), profileBars: bars.reduce((a, x) => a + x.bars, 0), giBars: riBars.reduce((a, x) => a + x.bars, 0), glassArea, stock: stockLen }, notes };
}

// Quotation PDF view: every window with its spec and price, charges spread across windows like the demo.
function quoteView(q, cust, entries, tot, comm, s, meta) {
  const ents = entries.filter(x => x.it), base = ents.reduce((a, { it }) => a + (+it.each || 0) * (+it.qty || 1), 0) || 1;
  const charges = (tot.transport || 0) + (tot.loading || 0) + (tot.unloading || 0), unit = it => (+it.each || 0) + charges * (+it.each || 0) / base;
  let area = 0;
  const items = ents.map(({ it, e }) => { const qn = +it.qty || 1, ar = (+it.width || 0) * (+it.height || 0) / SQFT; area += ar * qn; const cuts = (e && e.cuts) || [], fr = cuts.find(c => c.role === 'Frame'), sh = cuts.find(c => c.role === 'Sash'), ri = (e && e.riInfo) || {}, gi = (t) => `GI ${t || 1.2} mm`;
    const u = unit(it); return { mark: it.mark, name: it.name, w: it.width, h: it.height, qty: qn, area: ar, unit: u, total: u * qn, perSqft: ar ? u / ar : 0, product: it.system || '', glass: it.glass || '', finish: it.finish || 'White', frame: fr ? `${fr.code} · ${fr.name} · ${gi((ri.Frame || {}).thk)}` : '', sash: sh ? `${sh.code} · ${sh.name} · ${gi((ri.Sash || {}).thk)}` : '', mesh: it.mesh, type: it.type, d: it.d } });
  const sub = tot.subtotal + charges;
  return { items, area, count: items.length, units: items.reduce((a, x) => a + x.qty, 0), subtotal: sub, discountPct: tot.discount || 0, discount: tot.discountAmt || 0, cgst: tot.cgst || 0, sgst: tot.sgst || 0, round: tot.roundOff || 0, grand: tot.total || 0, rateEx: area ? (sub - (tot.discountAmt || 0)) / area : 0, rateInc: area ? tot.total / area : 0 };
}


// Project Tracking: quoted vs entered / completed / dispatched per window, projected cost heads, profit, material supply.
// counts: { [mark]: { entered, completed, dispatched } }
function tracking(D, counts, wo) {
  const items = D.items, cnt = m => counts[m] || { entered: 0, completed: 0, dispatched: 0 };
  const rows = items.map(x => { const c = cnt(x.mark), inproc = Math.max(0, c.entered - c.completed); return { mark: x.mark, name: x.name, quoted: x.qty, inProcess: inproc, completed: c.completed, balance: Math.max(0, x.qty - c.entered), dispatched: c.dispatched, still: Math.max(0, x.qty - c.dispatched) } });
  const tot = rows.reduce((a, r) => { Object.keys(r).forEach(k => { if (typeof r[k] === 'number') a[k] = (a[k] || 0) + r[k] }); return a }, {});
  const frac = (x, k) => x.qty ? Math.min(1, (k === 'started' ? cnt(x.mark).entered : cnt(x.mark).dispatched) / x.qty) : 0;
  const heads = [['Profile Cost', x => x.profile], ['Profile Wastage', x => x.pw || 0], ['RI Cost', x => x.reinf], ['RI Wastage', x => x.rw || 0], ['Hardware Cost', x => x.hw], ['Glass Cost', x => x.glassMesh - (x.mesh || 0)], ['Glass Wastage', x => x.gw || 0], ['Mesh Cost', x => x.mesh || 0], ['Mesh Wastage', () => 0], ['Fabrication Labour', x => x.fab || 0], ['Installation Labour', x => x.inl || 0], ['Installation Material Cost', x => x.other]];
  const costRows = heads.map(([label, f]) => { const full = items.reduce((a, x) => a + f(x), 0), st = items.reduce((a, x) => a + f(x) * frac(x, 'started'), 0), su = items.reduce((a, x) => a + f(x) * frac(x, 'supplied'), 0); return { label, full, started: st, actualStarted: st, variance: 0, supplied: su, actualSupplied: su } });
  costRows.push({ label: 'Total manufacturing cost', strong: 1, full: costRows.reduce((a, r) => a + r.full, 0), started: costRows.reduce((a, r) => a + r.started, 0), actualStarted: costRows.reduce((a, r) => a + r.actualStarted, 0), variance: 0, supplied: costRows.reduce((a, r) => a + r.supplied, 0), actualSupplied: costRows.reduce((a, r) => a + r.actualSupplied, 0) });
  const rev = items.reduce((a, x) => a + x.net, 0), revS = items.reduce((a, x) => a + x.net * frac(x, 'supplied'), 0), mc = costRows[costRows.length - 1];
  const profit = { rev, revSupplied: revS, cost: mc.full, costSupplied: mc.supplied, profit: rev - mc.full, profitSupplied: revS - mc.supplied, margin: rev ? (rev - mc.full) / rev * 100 : null, marginSupplied: revS ? (revS - mc.supplied) / revS * 100 : null };
  const totQ = items.reduce((a, x) => a + x.qty, 0) || 1, started = items.reduce((a, x) => a + cnt(x.mark).entered, 0) / totQ, done = items.reduce((a, x) => a + cnt(x.mark).completed, 0) / totQ, disp = items.reduce((a, x) => a + cnt(x.mark).dispatched, 0) / totQ, inp = Math.max(0, started - done);
  const mats = [];
  D.profileLines.forEach(l => mats.push({ label: l.unit === 'm' ? `${l.name}` : `${l.name} (${l.code}) · White`, unit: 'm', quoted: l.m }));
  D.riLines.forEach(l => mats.push({ label: `${l.name} (${l.code}) · White · ${l.thk} mm GI`, unit: 'm', quoted: l.m }));
  D.hwLines.forEach(l => mats.push({ label: `Generic Hardware · ${l.name}`, unit: l.unit, quoted: l.qty }));
  D.glassLines.forEach(l => mats.push({ label: l.name, unit: 'm2', quoted: l.m2 }));
  const materials = mats.map(m => { const q = +m.quoted.toFixed(3); return { ...m, quoted: q, allocated: +(q * started).toFixed(3), inProcess: +(q * inp).toFixed(3), completed: +(q * done).toFixed(3), supplied: +(q * disp).toFixed(3), balance: +(q * (1 - started)).toFixed(3), above: 0, still: +(q * (1 - disp)).toFixed(3) } });
  return { workOrder: wo || null, tiles: { quoted: tot.quoted || 0, inProcess: tot.inProcess || 0, completed: tot.completed || 0, dispatched: tot.dispatched || 0, balance: tot.balance || 0, still: tot.still || 0 }, rows, total: tot, outside: [], costRows, profit, materials };
}
module.exports = { costing, materials, report, quoteView, cutBars, tracking, r2 };
