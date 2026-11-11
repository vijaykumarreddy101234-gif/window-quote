// Quantities + cost engine driven by a design JSON. Rules calibrated against the demo
// (casement D1: exact; 4-panel sliding w3: cut list exact; others estimated).
const FRAME_FACE = 40, SASH_FACE = 58, OVERLAP = 8, WELD = 3;
const SQM = 92903.04;

const TRACKS = { 'RST-62T': 2, 'RST-53ET': 2, 'RST-92T': 2.5, 'RST-80ET': 2.5, 'RST-112T': 3, 'RST-95ET': 3 };
const FRAMES = Object.keys(TRACKS), SASHES = ['RSS-59SS', 'RSS-67MS', 'RSS-84BS'], BEADS = ['RSB-24.5SB', 'RSB-11.5DGB', 'RSB-17.5EB'];
const RI_K = { 'RSS-59SS': 1, 'RSS-67MS': 1.2, 'RSS-84BS': 1.41, 'RSS-60ES': 1.3018, 'RSS-75ES': 1.63 };
const BEAD_DEDUCT = { 'RSS-59SS': 92, 'RSS-67MS': 108, 'RSS-84BS': 142, 'RSS-60ES': 94, 'RSS-75ES': 124 };
const SERIES = {
  '62': { frame: 'RST-62T', sash: 'RSS-59SS', doorSash: 'RSS-84BS', bead: 'RSB-24.5SB', il: 'RSI-44IL', sashDeduct: 78 },
  '92': { frame: 'RST-92T', sash: 'RSS-59SS', doorSash: 'RSS-84BS', bead: 'RSB-24.5SB', il: 'RSI-44IL', meshSash: 'RSM-53M', sashDeduct: 78 },
  '112': { frame: 'RST-112T', sash: 'RSS-59SS', doorSash: 'RSS-84BS', bead: 'RSB-24.5SB', il: 'RSI-44IL', meshSash: 'RSS-59SS', sashDeduct: 78 },
  '53': { frame: 'RST-53ET', sash: 'RSS-60ES', bead: 'RSB-17.5EB', il: 'RSI-38EIL', meshSash: 'RSM-53M', sashDeduct: 68 },
  '80': { frame: 'RST-80ET', sash: 'RSS-60ES', bead: 'RSB-17.5EB', il: 'RSI-38EIL', meshSash: 'RSM-53M', sashDeduct: 68 },
  '95': { frame: 'RST-95ET', sash: 'RSS-60ES', bead: 'RSB-17.5EB', il: 'RSI-38EIL', meshSash: 'RSS-60ES', sashDeduct: 68 } };
function compute(d, ctx) {
  const { prof, glassRate, p } = ctx;          // prof(code) -> {description, weight}; p = pricing settings
  const W = d.W, H = d.H, w = ctx.cfg.welding ?? WELD;
  const cuts = [], hw = [], notes = [];
  const add = (role, code, lens, extra = {}) => { const pr = prof(code); if (!pr) return; const m = lens.reduce((a, b) => a + b, 0) / 1000; cuts.push({ role, code, name: pr.description, lens, kg: m * pr.weight, metres: m, ...extra }); };
  let glassPanes = [];   // {name,w,h}
  let meshInfo = null; const gaskets = []; let gasketM = 0, riM = 0, hardware = 0, meshArea = 0;

  let options = null, error = null, seriesOut = null, meshCodeOut = null, riInfo = null, riKgDirect = null;
  if (d.kind === 'sliding') {
    const n = d.panels || 2, mesh = d.mesh || 0, isDoor = !!d.door;
    const ser = String(d.series || (d.tracks === 3 ? '112' : mesh && n === 2 ? '92' : mesh ? '80' : n === 3 ? '92' : '62'));
    const S = SERIES[ser] || SERIES['62'], sel = d.profiles || {}; seriesOut = ser;
    const ctr = n === 3 && !!(d.centre || mesh);   // fixed centre light (F1) with a sliding sash each side
    const leaves = ctr ? 2 : n;
    const need = mesh ? Math.min(3, (d.tracks || Math.max(2, Math.ceil(leaves / 2))) + 0.5) : (d.tracks || Math.max(2, Math.ceil(leaves / 2)));
    const frameCode = sel.frame || S.frame;
    const sashCode = sel.sash || (isDoor && S.doorSash ? S.doorSash : S.sash);
    const beadCode = sel.bead || S.bead;
    // Mesh rule: only the 80, 92, 95 and 112 series take a mesh shutter. 80 -> 53 mesh; 92 -> 53 or 62 mullion mesh; 95 -> sash 60x35 or 75x35; 112 -> sash 59, 67 or 84.
    const MESH_CH = { 'RST-80ET': ['RSM-53M'], 'RST-92T': ['RSM-53M', 'RSM-62MM'], 'RST-95ET': ['RSS-60ES', 'RSS-75ES'], 'RST-112T': ['RSS-59SS', 'RSS-67MS', 'RSS-84BS'] }, meshChoices = MESH_CH[frameCode] || [];
    const meshCode = meshChoices.includes(sel.mesh) ? sel.mesh : (meshChoices[0] || null);
    meshCodeOut = meshCode;
    const cls = need <= 2 ? 2 : need <= 2.5 ? 2.5 : 3;
    options = [
      { role: 'Frame', label: 'OUTER FRAME', selected: frameCode, choices: FRAMES.filter(f => TRACKS[f] === cls) },
      { role: 'Sash', label: 'SASH', selected: sashCode, choices: S.sash === 'RSS-60ES' ? ['RSS-60ES', 'RSS-75ES'] : SASHES },
      { role: 'Bead', label: 'BEAD', selected: beadCode, choices: BEADS }];
    if (meshChoices.length) options.push({ role: 'Mesh', label: 'MESH SASH', selected: meshCode, choices: meshChoices });
    if (mesh && !meshChoices.length) {
      error = `mesh shutters are only available on the 80, 92, 95 and 112 series; ${frameCode} does not take a mesh`;
      return { cuts: [], kg: 0, area: +((W * H) / SQM).toFixed(2), glassArea: 0, panes: [], rows: [], materialTotal: 0, labour: [], totalCost: 0, unit: null, tax: 0, unitInc: 0, perSqftInc: 0, hardware: [], notes, options, error, includeMesh: true, series: seriesOut, meshCode: null };
    }
    if (!options[0].choices.includes(frameCode)) options[0].choices.unshift(frameCode);
    if ((TRACKS[frameCode] || 2) < need) {
      error = `frame ${frameCode} has ${TRACKS[frameCode]} tracks; ${n} sliding leaves${mesh ? ' + mesh' : ''} need ${need}`;
      return { cuts: [], kg: 0, area: +((W * H) / SQM).toFixed(2), glassArea: 0, panes: [], rows: [], materialTotal: 0, labour: [], totalCost: 0, unit: null, tax: 0, unitInc: 0, perSqftInc: 0, hardware: [], notes, options, error, includeMesh: !!mesh, series: seriesOut };
    }
    add('Frame', frameCode, [W + 2 * w, W + 2 * w, H + 2 * w, H + 2 * w]);
    const sashH = H - S.sashDeduct, pw = W / n, bd = BEAD_DEDUCT[sashCode] || 92;
    let widths, meshW = 0, meshN = 0;
    if (ctr && mesh) { widths = [W / 4 - 1, W / 2 + 66, W / 4 - 1]; meshN = 2; meshW = W / 4 - 1; }
    else if (ctr) {
      const dw = Array.isArray(d.widths) && d.widths.length === 3 && Math.abs(d.widths.reduce((a, b) => a + (+b || 0), 0) - W) < 2 ? d.widths.map(Number) : [W / 4, W / 2, W / 4];
      widths = [dw[0] - 6, dw[1] + 65, dw[2] - 6];
    }
    else {
      // unequal sash sizes: d.widths = visible leaf widths (sum = W); equal otherwise
      const dw = Array.isArray(d.widths) && d.widths.length === n && Math.abs(d.widths.reduce((a, b) => a + (+b || 0), 0) - W) < 2 ? d.widths.map(Number) : Array(n).fill(pw);
      const adj = (d.tracks === 3 && n === 3 && !mesh) ? [21, 21, 21] : n === 2 ? (mesh ? [-1, -1] : [-6, -6]) : n === 3 ? [-6, 35, -6] : Array.from({ length: n }, (_, i) => (i === 0 || i === n - 1) ? -6 : 35);
      widths = dw.map((x, i) => x + adj[i]);
      meshN = mesh; meshW = dw[n - 1] - 1;
    }
    const sashLens = [], beadLens = [], leafInfo = [];
    widths.forEach((sw, i) => {
      sw = Math.round(sw); sashLens.push(sw, sw, sashH, sashH);
      const gd = beadCode === 'RSB-17.5EB' ? 2 : 0; // 17.5 bead: glass sits 2 mm inside the bead, as demo
      const bw = sw - bd, bh = sashH - bd; beadLens.push(bw, bw, bh, bh);
      const gw = bw - gd, gh = bh - gd; glassPanes.push({ name: (ctr && i === 1) ? 'F1' : (ctr && i === 2 ? 'S2' : 'S' + (i + 1)), w: gw, h: gh }); glassPanes[glassPanes.length - 1].sl = sw * 2 + sashH * 2; glassPanes[glassPanes.length - 1].gi = Math.max(0, sashH - 100) * 2;
    });
    add('Sash', sashCode, sashLens, { grouped: true });
    add('Bead', beadCode, beadLens, { grouped: true });
    add('Interlock', S.il, Array(d.tracks === 3 && n === 3 && !mesh && !ctr ? 4 : ctr || (mesh === 1 && n > 2) ? n + 1 : n).fill(sashH - 6));
    if (n >= 4) add('Coupler', 'RSA-22SA', [sashH - 6]);
    if (meshN) add('Mesh Sash', meshCode, [...Array(meshN * 2).fill(Math.round(meshW)), ...Array(meshN * 2).fill(sashH)], { grouped: true });
    // reinforcement: frame top/bottom + sash uprights + coupler (calibrated on the demo's 62/80/door samples)
    const dd = x => Math.max(0, x - 100);
    const frameH = 2 * dd(W + 2 * w), sashV = sashLens.filter(x => x === sashH).reduce((a, x) => a + dd(x), 0), cpl = n >= 4 ? dd(sashH - 6) : 0;
    // reinforcement (GI) per demo: every cut piece less 100 mm x kg/m of the profile (scales with thickness) x GI rate per kg
    const thk = d.riThk || {}, tf = (+thk.frame || 1.2) / 1.2, ts = (+thk.sash || 1.2) / 1.2, Kri = RI_K[sashCode] || 1;
    const pieceM = lens => lens.reduce((a, x) => a + Math.max(0, x - 100), 0) / 1000;
    const frameKgm = ((prof(frameCode) || {}).weight || 0) * 0.5375 * tf, sashKgm = ((prof(sashCode) || {}).weight || 0) * 0.6529 * ts;
    const frameRiM = pieceM([W + 2 * w, W + 2 * w, H + 2 * w, H + 2 * w]), sashRiM = pieceM(sashLens) + (n >= 4 ? Math.max(0, sashH - 6 - 100) / 1000 : 0);
    riKgDirect = frameRiM * frameKgm + sashRiM * sashKgm; riM = riKgDirect / 0.7768;
    const thkMm = +((d.glassName || '5 mm').match(/\d+(\.\d+)?/) || [5])[0], sashWt = (prof(sashCode) || {}).weight || 0;
    const beadWt = (prof(beadCode) || {}).weight || 0, ilWt = (prof(S.il) || {}).weight || 0;
    glassPanes.forEach(g => { if (g.sl == null) return; g.dayW = Math.round(g.w - 32); g.dayH = Math.round(g.h - 32); g.glassKg = +(g.w * g.h / 1e6 * thkMm * 2.5).toFixed(2); g.profKg = +(g.sl / 1000 * sashWt + 2 * (g.w + g.h) / 1000 * beadWt + (sashH - 6) / 1000 * ilWt).toFixed(2); g.giKg = +(g.sl / 1000 * sashKgm).toFixed(2); g.weight = Math.round(g.glassKg + g.profKg + g.giKg) });
    riInfo = { Frame: { kg: frameRiM * frameKgm, thk: +thk.frame || 1.2, kgm: frameKgm }, Sash: { kg: sashRiM * sashKgm, thk: +thk.sash || 1.2, kgm: sashKgm } };
    const leavesN = leaves, rollers = leavesN * 2;
    if (isDoor) {
      hardware = rollers * 82.5 + 750 + 1036.82 * (n / 2);
      hw.push({ name: 'DOUBLE WHEEL ADJUSTABLE WITH GROOVE · WHITE', qty: rollers, rate: 82.5 }, { name: 'DOUBLE SIDE D HANDLE · WHITE', qty: 1, rate: 750 }, { name: 'SLD ESPAG, KEEPS AND STRIKERS', qty: 1, rate: +(1036.82 * (n / 2)).toFixed(2) });
    } else {
      hardware = rollers * 7.7 + 80 + 49 + meshN * 60.71;
      hw.push({ name: 'SINGLE WHEEL WITH GROOVE · WHITE', qty: rollers, rate: 7.7 }, { name: 'SLD TOUCH LOCK LEFT · WHITE', qty: 1, rate: 40 }, { name: 'SLD TOUCH LOCK RIGHT · WHITE', qty: 1, rate: 40 }, { name: 'SLD TOUCH LOCK STRIKERS AND KEEPS', qty: 1, rate: 49 });
      if (meshN) hw.push({ name: 'FLY MESH ROLLER · WHITE', qty: meshN * 2, rate: 5 }, { name: 'FLY MESH HANDLE · WHITE', qty: meshN, rate: 45 }, { name: 'FLY MESH SCREWS AND WOOL PILE', qty: meshN, rate: 5.71 });
    }
    meshArea = meshN ? meshN * (meshW - 89) * (sashH - 84) / SQM : 0;
    if (meshN) meshInfo = { n: meshN, w: Math.round(meshW - 89), h: Math.round(sashH - 84) };
    if (meshN) gaskets.push({ code: 'UPVC-HW-OG', name: 'O TYPE GASKET · ASH BLACK', m: meshN * 2 * ((meshW - 89) + (sashH - 84)) / 1000, rate: 8 });
  } else {
    // casement / vent / door / fixed: grid of cells
    const cols = d.cols && d.cols.length ? d.cols : [{ w: 1, rows: [{ h: 1, op: 'FIXED' }] }];
    const door = d.door;
    const frameCode = door ? 'RSC-72OF' : (cols.every(c => c.rows.every(r => r.op === 'FIXED')) ? 'RSC-42VF' : 'RSC-60OF');
    add('Frame', frameCode, [W + 2 * w, W + 2 * w, H + 2 * w, H + 2 * w]);
    const totalW = cols.reduce((a, c) => a + c.w, 0);
    let sashLens = [], beadLens = [], mullP = [], idx = 0, tm = 0;
    const band = d.band && d.band.op ? d.band : null, Hmain = band ? H * (1 - band.h) : H
    const doCols = (cols, H, totalW) => cols.forEach((c, ci) => {
      const cw = (W - 2 * FRAME_FACE) * c.w / totalW + 2 * FRAME_FACE - (ci > 0 ? 0 : 0);
      const th = c.rows.reduce((a, r) => a + r.h, 0);
      if (ci > 0) mullP.push(H - FRAME_FACE + (band ? 0 : 0));
      c.rows.forEach((r, ri) => {
        const ch = (H - 2 * FRAME_FACE) * r.h / th + 2 * FRAME_FACE;
        if (ri > 0) tm += cw - 2 * FRAME_FACE;
        idx++;
        const opening = r.op !== 'FIXED' && r.op !== 'LOUVRE' && r.op !== 'FAN';
        if (opening && door) {
          const sw = cw - 82, sh = ch - 82, gw = sw - 174, gh = sh - 174;
          sashLens.push(sw, sw, sh, sh); beadLens.push(gw, gw, gh, gh); glassPanes.push({ name: 'C' + idx, w: gw, h: gh });
          riM += ((sw + sh) * 2 - 400) / 1000;
          hardware += 190 + 3 * 243.54 + 1002; hw.push({ name: 'CASEMENT DOUBLE SIDE DOOR HANDLE · WHITE', qty: 1, rate: 190 }, { name: '3D HINGES · WHITE', qty: 3, rate: 243.54 }, { name: 'CASEMENT DOOR ESPAG WITH CYLINDER 1800 · WHITE', qty: 1, rate: 1002 });
        } else if (opening) {
          const sw = cw - 2 * FRAME_FACE + 2 * OVERLAP, sh = ch - 2 * FRAME_FACE + 2 * OVERLAP;
          sashLens.push(sw + 2 * w, sw + 2 * w, sh + 2 * w, sh + 2 * w);
          // daylight as the demo measures it: 90 mm off at a jamb (frame + sash + bead), 67 mm off at a mullion (sash hung 28 mm over the mullion)
          const colW = W * c.w / totalW, gw = Math.round(colW - (ci === 0 ? 90 : 67) - (ci === cols.length - 1 ? 90 : 67)), gh = sh - 2 * SASH_FACE;
          beadLens.push(gw - 4, gw - 4, gh - 4, gh - 4); glassPanes.push({ name: 'C' + idx, w: gw, h: gh });
          riM += ((sw + sh) * 2 - 400) / 1000;
          if (r.op === 'LH' || r.op === 'RH') { hardware += 50 + 2 * 137.5 + 8.8; if (sh >= 800) { hardware += 210; hw.push({ name: 'CASEMENT 15MM BS ESPAG 800 · WHITE', qty: 1, rate: 210 }) } hw.push({ name: 'CASEMENT WINDOW HANDLE · WHITE', qty: 1, rate: 50 }, { name: 'FRICTION STAY 10" · WHITE', qty: 2, rate: 137.5 }, { name: 'CMT ESPAG STRIKER · WHITE', qty: 1, rate: 8.8 }); }
          else if (r.op === 'TOP') { hardware += 2 * 137.5; hw.push({ name: 'FRICTION STAY 10" · WHITE', qty: 2, rate: 137.5 }); }
          else if (r.op === 'TT') { hardware += 1250; hw.push({ name: 'TILT & TURN SET', qty: 1, rate: 1250 }); }
          else if (door) { hardware += 1390 + 3 * 243.54; hw.push({ name: 'CMT DOOR LOCKING SET · WHITE', qty: 1, rate: 1390 }, { name: '3D HINGES · WHITE', qty: 3, rate: 243.54 }); }
        } else {
          const gw = cw - 2 * FRAME_FACE + 20, gh = ch - 2 * FRAME_FACE + 20;
          if (r.op === 'FIXED') { beadLens.push(gw - 4, gw - 4, gh - 4, gh - 4); glassPanes.push({ name: 'C' + idx, w: gw, h: gh }); }
          else if (r.op === 'LOUVRE') { const bl = Math.max(3, Math.round(gh / 60)); hardware += bl * 15; hw.push({ name: `${bl} BLADE MOVABLE LOUVER · WHITE`, qty: 1, rate: bl * 15 }); }
          else if (r.op === 'FAN') { hardware += 350; hw.push({ name: 'EXHAUST FAN', qty: 1, rate: 350 }); }
        }
      });
    })
    doCols(cols, Hmain, totalW)
    if (band) { tm += W - 2 * FRAME_FACE; doCols([{ w: 1, rows: [{ h: 1, op: band.op }] }], H * band.h, 1) }
    if (sashLens.length) add('Sash', door ? 'RSC-104OD' : 'RSC-78WO', groupLens(sashLens), { grouped: true });
    if (mullP.length) add('Mullion', 'RSC-74TM', mullP);
    if (tm) add('Transom', 'RSC-74TM', [tm]);
    if (beadLens.length) add('Bead', door || sashLens.length ? 'RSB-35CB' : 'RSB-24.5SB', groupLens(beadLens), { grouped: true });
    if (d.shape && d.shape !== 'rect') { const f = cuts.find(c => c.role === 'Frame'); if (f) { f.kg *= 1.3; f.metres *= 1.3; notes.push('Arc: profile and bead arc length + 30% bending wastage'); } }
    riM = Math.max(0, riM + (cuts.filter(c => c.role === 'Frame').reduce((a, c) => a + c.metres - 0.1 * c.lens.length, 0)));
  }
  if (d.georgian) { const gl = glassPanes.reduce((a, g) => a + (g.w + g.h) / 1000, 0); add('Georgian bar', 'RSA-25GB', [Math.round(gl * 1000)]); }
  // ---- hardware choices (Hardware tab) and finish: replace default items by the chosen catalogue items ----
  { const m = {}; hw.forEach(h => { const k = h.name + '|' + h.rate; if (m[k]) m[k].qty += h.qty; else m[k] = { ...h } }); hw.length = 0; Object.values(m).forEach(h => hw.push(h)) }
  if (ctx.hwFind) {
    const sel = d.hw || {}, win = d.colour && d.colour.Window, fin = (d.hwFinish && d.hwFinish !== 'Match window color') ? d.hwFinish.toUpperCase() : (win && win !== 'White' ? win.toUpperCase() : 'WHITE');
    const clean = v => String(v).replace(/\s*·.*$/, '').replace(/\s*\[.*\]$/, '').trim(), pick = k => { const v = sel[k] && sel[k].v; return v && !/^Auto/.test(v) ? v : null };
    const swap = (re, v, qty, all) => {
      const f = ctx.hwFind(clean(v), fin); if (!f) return; let done = false
      for (let i = hw.length - 1; i >= 0; i--) if (re.test(hw[i].name)) { const q = qty || hw[i].qty; if (!done) { hardware += f.rate * q - hw[i].rate * hw[i].qty; hw[i] = { name: f.name, qty: q, rate: f.rate }; done = true } else if (all) { hardware -= hw[i].rate * hw[i].qty; hw.splice(i, 1) } }
      if (!done && qty) { hardware += f.rate * qty; hw.push({ name: f.name, qty, rate: f.rate }) }
    }
    const door = !!d.door
    if (d.kind === 'sliding') { if (pick('roller')) swap(/WHEEL/, pick('roller')); if (pick('lock') && !/^TOUCH LOCK$/i.test(pick('lock'))) swap(/TOUCH LOCK (LEFT|RIGHT)/, pick('lock'), 1, true); if (sel.altrack && sel.altrack.v === 'Included') { const f = ctx.hwFind('ALUMINIUM TRACK', fin); if (f) { const m = +(W / 1000).toFixed(2); hardware += f.rate * m; hw.push({ name: f.name, qty: m, rate: f.rate }) } }; if (pick('handle') && door) swap(/D HANDLE|C HANDLE/, pick('handle'), 1) }
    else if (door) { const hc = sel.hcount && sel.hcount.v ? +sel.hcount.v : null; if (pick('hinge')) swap(/HINGES/, pick('hinge'), hc); else if (hc) { const h = hw.find(x => /HINGES/.test(x.name)); if (h) { hardware += (hc - h.qty) * h.rate; h.qty = hc } }
      if (pick('handle')) swap(/DOOR HANDLE|LOCKING SET/, pick('handle')); if (pick('espag')) swap(/ESPAG/, pick('espag')); if (sel.bolt && sel.bolt.v === 'SHOOT BOLT') swap(/SHOOT BOLT/, 'SHOOT BOLT', 1) }
    else { const nOpen = Math.max(1, hw.filter(x => /WINDOW HANDLE/.test(x.name)).reduce((a, x) => a + x.qty, 0))
      if (sel.hingeType && sel.hingeType.v === '2D hinge') swap(/FRICTION STAY/, pick('hinge') || '2D HINGES'); else if (pick('stay')) swap(/FRICTION STAY/, pick('stay'))
      if (pick('handle')) { const h = pick('handle'); if (/COCKSPUR/.test(h)) { swap(/WINDOW HANDLE/, 'COCKSPUR HANDLE LEFT'); const w = ctx.hwFind('COCKSPUR HANDLE WEDGE', fin); if (w) { hardware += w.rate * nOpen; hw.push({ name: w.name, qty: nOpen, rate: w.rate }) } } else swap(/WINDOW HANDLE/, h) }
      if (pick('espag')) { if (hw.some(x => /BS ESPAG/.test(x.name))) swap(/BS ESPAG/, pick('espag')); else { const f = ctx.hwFind(clean(pick('espag')), fin); if (f) { hardware += f.rate * nOpen; hw.push({ name: f.name, qty: nOpen, rate: f.rate }) } } }
      if (sel.cylinder && sel.cylinder.v === 'CYLINDER') { const c = ctx.hwFind('CYLINDER', fin); if (c) { hardware += c.rate * nOpen; hw.push({ name: c.name, qty: nOpen, rate: c.rate }) } }
      if (sel.striker && sel.striker.v === 'None') { for (let i = hw.length - 1; i >= 0; i--) if (/STRIKER/.test(hw[i].name)) { hardware -= hw[i].rate * hw[i].qty; hw.splice(i, 1) } } }
    if (fin !== 'WHITE') hw.forEach(h => { if (/ · WHITE$/.test(h.name)) { const f = ctx.hwFind(clean(h.name), fin); if (f && / · /.test(f.name) && !/WHITE$/.test(f.name)) { hardware += (f.rate - h.rate) * h.qty; h.name = f.name; h.rate = f.rate } } })
  }
  { const m = {}; hw.forEach(h => { const k = h.name + '|' + h.rate; if (m[k]) m[k].qty += h.qty; else m[k] = { ...h } }); hw.length = 0; Object.values(m).forEach(h => hw.push(h)) }
  const kg = cuts.reduce((a, c) => a + c.kg, 0);
  const area = (W * H) / SQM, glassArea = glassPanes.reduce((a, g) => a + g.w * g.h / SQM, 0);
  const profileCost = kg * p.white_rate + gasketM * 39.2 * 0.9988 + gaskets.reduce((a, g) => a + g.m * g.rate, 0);
  const riRate = riKgDirect != null ? (p.gi_rate || 100) : p.ri_rate, riCost = riKgDirect != null ? riKgDirect * riRate : riM * 0.7768 * p.ri_rate;
  const rate = glassRate(d.glassName || '5 mm clear glass');
  const perPane = d.perPane ?? Object.values(d.paneGlass || {}).some(Boolean);
  const paneName = g => (perPane && d.paneGlass && d.paneGlass[parseInt(g.name.slice(1)) - 1]) || d.glassName || '5 mm clear glass';
  glassPanes.forEach(g => { g.glass = paneName(g) });
  const glassCost = glassPanes.reduce((a, g) => a + g.w * g.h / 1e6 * glassRate(g.glass), 0);
  const meshRate = (d.meshRate || { 'SS mesh': 60, 'Aluminium mesh': 22, 'Fibre mesh': 12 }[d.meshType] || 120 / 10.7639), meshCost = meshArea * meshRate;
  const gw = d.kind === 'sliding' ? (p.glass_wastage ?? 15) : 12;
  const rows = [['Profile cost', profileCost], [`Profile wastage ${p.profile_wastage}%`, profileCost * p.profile_wastage / 100], ['Reinforcement cost', riCost], [`Reinforcement wastage ${p.ri_wastage}%`, riCost * p.ri_wastage / 100], ['Hardware cost', hardware], ['Glass cost', glassCost], [`Glass wastage ${gw}%`, glassCost * gw / 100]];
  if (meshCost) rows.push(['Mesh cost', meshCost]);
  const fans = Object.values(d.paneFan || {}).filter(Boolean).length; if (fans) rows.push([`Exhaust fan cut-out × ${fans}`, fans * (p.fan_cutout ?? 200)]);
  (d.extras || []).forEach(x => { if (+x.amount) rows.push([x.name || 'Extra cost', +x.amount]) });
  const material = rows.reduce((a, r) => a + r[1], 0);
  const labour = [[`Fabrication cost ₹${p.fab_labour.toFixed(2)}/sq ft`, p.fab_labour * area], [`Installation labour ₹${p.install_labour.toFixed(2)}/sq ft`, p.install_labour * area], [`Installation Material Cost ₹${p.install_material.toFixed(2)}/sq ft`, p.install_material * area]];
  const cost = material + labour.reduce((a, r) => a + r[1], 0);
  const manual = d.pricing === 'manual' && +d.manualRate > 0;       // Manual ₹/sq ft: selling price = area × rate (excl. tax)
  const unit = manual ? area * +d.manualRate : cost * (1 + p.profit / 100), profit = unit - cost, tax = unit * 0.18;
  const r2 = x => +x.toFixed(2);
  return { riInfo: riInfo && Object.fromEntries(Object.entries(riInfo).map(([k, v]) => [k, { thk: v.thk, kgm: r2(v.kgm), kg: r2(v.kg), rate: p.gi_rate || 100, cost: r2(v.kg * (p.gi_rate || 100)) }])), cuts: cuts.map(c => ({ ...c, kg: r2(c.kg), metres: r2(c.metres), cost: r2(c.kg * p.white_rate), lens: c.lens })), kg: r2(kg), area: r2(area), glassArea: r2(glassArea), panes: glassPanes,
    rows: rows.map(r => [r[0], r2(r[1])]), materialTotal: r2(material), labour: labour.map(r => [r[0], r2(r[1])]), totalCost: r2(cost), profitLabel: manual ? `Manual rate ₹${(+d.manualRate).toFixed(2)}/sq ft (margin ${cost ? (profit / cost * 100).toFixed(1) : 0}%)` : `Profit margin ${p.profit}%`, manual, profit: r2(profit), unit: r2(unit),
    taxLabel: 'Taxes 18% CGST + SGST', tax: r2(tax), unitInc: r2(unit + tax), perSqftInc: r2((unit + tax) / area), hardware: hw, mesh: meshInfo && { ...meshInfo, rate: meshRate }, gaskets: gaskets.map(g => ({ ...g, m: r2(g.m) })), notes, options, error, includeMesh: !!d.mesh, series: seriesOut, meshCode: d.mesh ? meshCodeOut : null };
}
// collapse repeated lengths for the Inspect list, keep order of first appearance
function groupLens(l) { return l.slice(); }
module.exports = { compute };
