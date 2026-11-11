// Label printing, bar optimisation (cutting plan) and saved bar plans for sub work orders
const crypto = require('crypto'), ExcelJS = require('exceljs');
module.exports = function (api, db, { quoteEntries, docs, uid, now, send, MIME }) {
  const PDF = docs.PDFDocument, collect = docs.collect, MM = 72 / 25.4;
  db.exec(`CREATE TABLE IF NOT EXISTS bar_settings (swo_id TEXT PRIMARY KEY, cfg TEXT, revision INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS bar_plans (id TEXT PRIMARY KEY, swo_id TEXT, name TEXT, cfg TEXT, plan TEXT, fingerprint TEXT, created_at TEXT);`);
  const DEF = { kerf: 10, trim: 0, reuse: 350, bar: 5800, offcuts: [] };
  const sub = sid => { const sw = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(sid); if (!sw) return null; const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(sw.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id) || {}; return { sw, w, q, c } };
  const cfgOf = sid => { const r = db.prepare('SELECT * FROM bar_settings WHERE swo_id=?').get(sid); return { cfg: { ...DEF, ...(r ? JSON.parse(r.cfg) : {}) }, revision: r ? r.revision : 1 } };
  // every physical cut of the sub work order, one row per piece
  function pieces(S) {
    const ents = db.prepare('SELECT e.*, i.mark, i.width, i.height FROM swo_items e JOIN quotation_items i ON i.id=e.item_id WHERE e.swo_id=? ORDER BY i.position, e.created_at').all(S.sw.id), qe = quoteEntries(S.q.id), out = [];
    ents.forEach(en => { const x = qe.find(k => k.it.id === en.item_id); if (!x) return; const win = `${en.mark}${en.location ? '/' + en.location : ''} (${en.width} x ${en.height} mm)`;
      (x.e.cuts || []).forEach(c => (c.lens || []).forEach((len, i) => { const four = (c.lens || []).length % 4 === 0 && /Frame|Sash|Bead|Outer/i.test(c.role || ''), k = i % 4, pos = four ? `${['Top', 'Bottom', 'Left', 'Right'][k]} ${String(c.role || '').toLowerCase()} · ${k < 2 ? 'Width' : 'Height'}` : (c.role || 'Member'); out.push({ wo: S.sw.number, code: c.code, name: c.name, role: c.role || '', member: `${c.code} / ${pos}`, customer: S.c.name || '', win, mark: en.mark, len: Math.round(len), ref: `${en.id.slice(0, 4)}-${c.code}-${i + 1}` }) })) });
    return out;
  }
  const barMap = (sid, pid) => { const m = {}; if (!pid) return m; const r = db.prepare('SELECT plan FROM bar_plans WHERE id=? AND swo_id=?').get(pid, sid); if (r) JSON.parse(r.plan).bars.forEach((b, i) => b.cuts.forEach(c => { m[c.ref] = `Bar ${i + 1} · ${b.source === 'Measured offcut' ? 'offcut' : b.len + ' mm'}` })); return m };
  const withBar = (list, m) => list.map(p => ({ ...p, bar: m[p.ref] || '' }));
  // ---------- labels ----------
  const FORMATS = { a4: { name: 'A4 · 80 × 45 mm · 12 labels', w: 80, h: 45, page: [210, 297], cols: 2, rows: 6, note: '80 × 45 mm · 12 labels per A4 sheet' }, thermal1: { name: 'Thermal · one across', w: 55, h: 27.94, page: [55, 27.94], cols: 1, rows: 1, note: '55 × 27.94 mm · 1 label per page' }, thermal2: { name: 'Thermal · two across', w: 55, h: 27.94, page: [110, 27.94], cols: 2, rows: 1, note: '110 × 27.94 mm · 2 labels per page' } };
  const BATCH = 24;
  api.get('/production/subs/:sid/labels', (req, res) => {
    const S = sub(req.params.sid); if (!S) return res.status(404).end(); const all = pieces(S), batch = Math.max(1, +req.query.batch || 1), scope = req.query.scope || 'all', win = req.query.win || '';
    let list = withBar(all, barMap(req.params.sid, req.query.plan)); if (win) list = list.filter(p => p.mark === win);
    const total = list.length, from = (batch - 1) * BATCH; res.json({ total, batch, batches: Math.max(1, Math.ceil(total / BATCH)), from: total ? from + 1 : 0, to: Math.min(total, from + BATCH), labels: list.slice(from, from + BATCH), marks: [...new Set(all.map(p => p.mark))], formats: Object.entries(FORMATS).map(([k, v]) => ({ key: k, name: v.name, note: v.note })), scope });
  });
  function labelPdf(S, list, fmtKey) {
    const F = FORMATS[fmtKey] || FORMATS.a4, d = new PDF({ size: [F.page[0] * MM, F.page[1] * MM], margin: 0, autoFirstPage: false }), done = collect(d), per = F.cols * F.rows;
    const mx = F.page[0] === 210 ? (210 - F.cols * F.w) / 2 : 0, my = F.page[1] === 297 ? (297 - F.rows * F.h) / 2 : 0;
    list.forEach((p, i) => { if (i % per === 0) d.addPage(); const k = i % per, cx = mx + (k % F.cols) * F.w, cy = my + Math.floor(k / F.cols) * F.h, x = cx * MM, y = cy * MM, w = F.w * MM, h = F.h * MM, big = F.h > 30;
      d.save().lineWidth(.4).strokeColor('#999').rect(x + 1, y + 1, w - 2, h - 2).stroke().restore();
      d.font('Helvetica-Bold').fontSize(big ? 8 : 5.5).fillColor('#000').text(p.wo, x + 6, y + 5, { width: w - 12, lineBreak: false });
      d.font('Helvetica-Bold').fontSize(big ? 10 : 7).text(p.member, x + 6, y + (big ? 17 : 12), { width: w - 12, lineBreak: false });
      d.font('Helvetica').fontSize(big ? 8 : 5.5).text(p.customer, x + 6, y + (big ? 31 : 20), { width: w - 12, lineBreak: false }).text(p.win, x + 6, y + (big ? 42 : 26), { width: w - 12, lineBreak: false }).text(p.name + (p.bar ? '  ·  ' + p.bar : ''), x + 6, y + (big ? 53 : 32), { width: w - 12, lineBreak: false });
      d.font('Helvetica-Bold').fontSize(big ? 13 : 8).text(`Size - ${p.len} mm`, x + 6, y + h - (big ? 28 : 15), { width: w - 12, lineBreak: false }) });
    if (!list.length) { d.addPage(); d.fontSize(10).text('No labels', 20, 20) }
    d.end(); return done;
  }
  api.post('/production/subs/:sid/labels.pdf', async (req, res) => {
    const S = sub(req.params.sid); if (!S) return res.status(404).end(); const { batch, format, all: every, plan: pl } = req.body || {}, all = withBar(pieces(S), barMap(req.params.sid, pl));
    const list = every ? all : all.slice(((+batch || 1) - 1) * BATCH, (+batch || 1) * BATCH);
    try { send(res, await labelPdf(S, list, format), 'application/pdf', `${S.sw.number}-labels${every ? '-all' : '-batch-' + (+batch || 1)}.pdf`) } catch (e) { res.status(500).json({ error: e.message }) }
  });
  api.get('/production/subs/:sid/labels-alignment.pdf', async (req, res) => {
    const F = FORMATS[req.query.format] || FORMATS.a4, d = new PDF({ size: [F.page[0] * MM, F.page[1] * MM], margin: 0 }), done = collect(d);
    const mx = F.page[0] === 210 ? (210 - F.cols * F.w) / 2 : 0, my = F.page[1] === 297 ? (297 - F.rows * F.h) / 2 : 0;
    for (let r = 0; r < F.rows; r++) for (let c = 0; c < F.cols; c++) d.save().lineWidth(.5).strokeColor('#000').rect((mx + c * F.w) * MM, (my + r * F.h) * MM, F.w * MM, F.h * MM).stroke().restore();
    const y = (F.page[1] - 4) * MM; d.lineWidth(1).moveTo(5 * MM, y).lineTo(25 * MM, y).stroke(); d.font('Helvetica').fontSize(6).fillColor('#000').text('20 mm calibration line - print at 100%', 27 * MM, y - 3, { lineBreak: false });
    d.fontSize(6).text(`${F.name} · ${F.note}`, 5 * MM, 3 * MM, { lineBreak: false }); d.end(); send(res, await done, 'application/pdf', 'label-alignment.pdf');
  });
  // ---------- bar optimisation ----------
  function plan(S, cfg) {
    const P = pieces(S), by = {}; P.forEach(p => { const k = p.code + '|' + p.name; (by[k] = by[k] || { code: p.code, name: p.name, cuts: [] }).cuts.push(p) });
    const bars = [], unplaced = []; let placed = 0, stock = 0, used = 0, irrec = 0, reuse = 0;
    Object.values(by).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true })).forEach(g => {
      const offs = (cfg.offcuts || []).filter(o => o.code === g.code).flatMap(o => Array(Math.max(1, +o.qty || 1)).fill(+o.len || +o.length)).filter(x => x > 0), open = [];
      offs.forEach((L, i) => open.push({ code: g.code, name: g.name, src: 'Measured offcut', len: L, rem: L - cfg.trim, cuts: [], n: i + 1 }));
      let nb = 0; g.cuts.sort((a, b) => b.len - a.len).forEach(c => { let b = open.filter(x => x.rem >= c.len).sort((x, y) => x.rem - y.rem)[0];
        if (!b) { if (c.len + cfg.trim > cfg.bar) { unplaced.push(c); return } b = { code: g.code, name: g.name, src: 'Assumed full bar', len: cfg.bar, rem: cfg.bar - cfg.trim, cuts: [], n: ++nb }; open.push(b) }
        b.cuts.push({ len: c.len, ref: c.ref, win: c.mark }); b.rem -= c.len + cfg.kerf; placed++ });
      open.filter(b => b.cuts.length).forEach(b => { const rem = Math.max(0, Math.round(b.rem)), cutSum = b.cuts.reduce((a, c) => a + c.len, 0); stock += b.len; used += cutSum; if (rem >= cfg.reuse) reuse += rem; else irrec += rem + b.cuts.length * cfg.kerf; bars.push({ code: g.code, name: g.name, source: b.src, len: b.len, cuts: b.cuts, remainder: rem, n: b.n }) }) });
    const fp = crypto.createHash('sha256').update(JSON.stringify(P.map(p => [p.code, p.len, p.ref]))).digest('hex');
    return { summary: { bars: bars.length, placed, unplaced: unplaced.length, irrecoverable: stock ? +(irrec / stock * 100).toFixed(2) : 0, utilization: stock ? +(used / stock * 100).toFixed(2) : 0, reusable: stock ? +(reuse / stock * 100).toFixed(2) : 0 }, bars, unplaced, fingerprint: fp, cuts: P.length };
  }
  api.get('/production/subs/:sid/bar-settings', (req, res) => { if (!sub(req.params.sid)) return res.status(404).end(); const c = cfgOf(req.params.sid); res.json({ ...c.cfg, revision: c.revision }) });
  api.put('/production/subs/:sid/bar-settings', (req, res) => {
    if (!sub(req.params.sid)) return res.status(404).end(); const b = req.body || {}, old = cfgOf(req.params.sid), n = k => Math.max(0, +b[k] || 0), cfg = { kerf: n('kerf'), trim: n('trim'), reuse: n('reuse'), bar: +b.bar > 0 ? +b.bar : 5800, offcuts: Array.isArray(b.offcuts) ? b.offcuts.map(o => ({ code: String(o.code || ''), len: +o.len || 0, qty: +o.qty || 1 })).filter(o => o.code && o.len) : old.cfg.offcuts };
    const rev = old.revision + 1; db.prepare('INSERT INTO bar_settings (swo_id,cfg,revision) VALUES (?,?,?) ON CONFLICT(swo_id) DO UPDATE SET cfg=excluded.cfg, revision=excluded.revision').run(req.params.sid, JSON.stringify(cfg), rev); res.json({ ...cfg, revision: rev });
  });
  const planOf = req => { const S = sub(req.params.sid); if (!S) return null; const c = cfgOf(req.params.sid), cfg = { ...c.cfg, ...(req.body && req.body.cfg || {}) }; return { S, cfg, revision: c.revision, p: plan(S, cfg) } };
  api.post('/production/subs/:sid/cutting-plan', (req, res) => { const r = planOf(req); if (!r) return res.status(404).end(); res.json({ ...r.p, cfg: r.cfg, revision: r.revision, status: 'provisional' }) });
  const planRows = p => p.bars.map((b, i) => [i + 1, `${b.code} · ${b.name}`, b.source, b.len + ' mm', b.cuts.length, b.cuts.map(c => c.len).join(' + '), b.remainder + ' mm']);
  const PH = ['Bar', 'Profile', 'Source', 'Length', 'Cuts', 'Cut lengths (mm)', 'Remainder'];
  api.post('/production/subs/:sid/cutting-plan.pdf', async (req, res) => { const r = planOf(req); if (!r) return res.status(404).end(); try { send(res, await docs.table('pdf', 'Cutting plan', PH, planRows(r.p), r.S.sw.number), 'application/pdf', `${r.S.sw.number}-cutting-plan.pdf`) } catch (e) { res.status(500).json({ error: e.message }) } });
  api.post('/production/subs/:sid/cutting-plan.xlsx', async (req, res) => { const r = planOf(req); if (!r) return res.status(404).end(); try { const wb = new ExcelJS.Workbook(), s = r.p.summary, w1 = wb.addWorksheet('Summary'); [['Cutting plan', r.S.sw.number], ['Bars', s.bars], ['Placed cuts', s.placed], ['Unplaced', s.unplaced], ['Irrecoverable %', s.irrecoverable], ['Utilization %', s.utilization], ['Reusable %', s.reusable], ['Kerf mm', r.cfg.kerf], ['End trim mm', r.cfg.trim], ['Fingerprint', r.p.fingerprint]].forEach(x => w1.addRow(x)); w1.getColumn(1).width = 22; w1.getColumn(2).width = 40; const w2 = wb.addWorksheet('Bars'); w2.addRow(PH).font = { bold: true }; planRows(r.p).forEach(x => w2.addRow(x)); w2.columns.forEach(c => c.width = 22); send(res, Buffer.from(await wb.xlsx.writeBuffer()), MIME.xlsx, `${r.S.sw.number}-cutting-plan.xlsx`) } catch (e) { res.status(500).json({ error: e.message }) } });
  // ---------- saved bar plans ----------
  api.get('/production/subs/:sid/bar-plans', (req, res) => res.json(db.prepare('SELECT id,name,cfg,fingerprint,created_at,plan FROM bar_plans WHERE swo_id=? ORDER BY created_at DESC').all(req.params.sid).map(r => { const p = JSON.parse(r.plan); return { id: r.id, name: r.name, created_at: r.created_at, fingerprint: r.fingerprint, cfg: JSON.parse(r.cfg), summary: p.summary } })));
  api.post('/production/subs/:sid/bar-plans', (req, res) => { const r = planOf(req); if (!r) return res.status(404).end(); const id = uid(), name = (req.body && req.body.name) || `Plan ${new Date().toISOString().slice(0, 16).replace('T', ' ')}`; db.prepare('INSERT INTO bar_plans VALUES (?,?,?,?,?,?,?)').run(id, r.S.sw.id, name, JSON.stringify(r.cfg), JSON.stringify(r.p), r.p.fingerprint, now()); res.json({ id, name }) });
  api.get('/production/subs/:sid/bar-plans/:pid', (req, res) => { const r = db.prepare('SELECT * FROM bar_plans WHERE id=? AND swo_id=?').get(req.params.pid, req.params.sid); if (!r) return res.status(404).end(); const S = sub(req.params.sid), cur = plan(S, JSON.parse(r.cfg)).fingerprint; res.json({ id: r.id, name: r.name, created_at: r.created_at, cfg: JSON.parse(r.cfg), ...JSON.parse(r.plan), stale: cur !== r.fingerprint }) });
  api.delete('/production/subs/:sid/bar-plans/:pid', (req, res) => { db.prepare('DELETE FROM bar_plans WHERE id=? AND swo_id=?').run(req.params.pid, req.params.sid); res.json({ ok: true }) });
  api.get('/production/subs/:sid/bar-plans/:pid/:fmt', async (req, res) => { const r = db.prepare('SELECT * FROM bar_plans WHERE id=? AND swo_id=?').get(req.params.pid, req.params.sid); if (!r) return res.status(404).end(); const S = sub(req.params.sid), p = JSON.parse(r.plan); try { if (req.params.fmt === 'xlsx') { const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('Bars'); ws.addRow(PH).font = { bold: true }; planRows(p).forEach(x => ws.addRow(x)); ws.columns.forEach(c => c.width = 22); return send(res, Buffer.from(await wb.xlsx.writeBuffer()), MIME.xlsx, `${S.sw.number}-saved-plan.xlsx`) } send(res, await docs.table('pdf', 'Saved cutting plan - ' + r.name, PH, planRows(p), S.sw.number), 'application/pdf', `${S.sw.number}-saved-plan.pdf`) } catch (e) { res.status(500).json({ error: e.message }) } });
};
