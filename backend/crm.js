// CRM: leads pipeline, customers view, settings, dashboard and sales reports.
const DEFAULTS = {
  pipeline: { stages: [
    { id: 'new', label: 'New Lead', color: '#3b82f6', icon: '✨', probability: 10 },
    { id: 'followup', label: 'Follow-up', color: '#f59e0b', icon: '📞', probability: 25 },
    { id: 'quoted', label: 'Quoted', color: '#8b5cf6', icon: '📄', probability: 50 },
    { id: 'won', label: 'Won', color: '#10b981', icon: '🏆', probability: 100 },
    { id: 'lost', label: 'Lost', color: '#ef4444', icon: '✖', probability: 0 }],
    won_reasons: ['Price competitive', 'Good relationship', 'Best quality', 'Fast delivery', 'Referral trust'],
    lost_reasons: ['Price too high', 'Lost to competitor', 'Project cancelled', 'No response', 'Budget constraint'] },
  lead_defaults: { default_stage: 'new', lead_number_format: 'LEAD-{YEAR}-{SEQ}', required_fields: ['customer_name', 'customer_phone'],
    lead_sources: ['Referral', 'Site Visit', 'WhatsApp', 'Website', 'Cold Call', 'Exhibition', 'Social Media', 'Builder Network'] },
  follow_ups: { reminder_days: 3, stale_lead_days: 14, auto_close_lost_days: 90 },
  team: { enable_assignment: false, territories: ['North Zone', 'South Zone', 'East Zone', 'West Zone', 'Project Sales', 'Retail Walk-in'] },
  notifications: { new_lead_alert: false, stage_change_alert: false, notification_email: '' },
  targets: { monthly_revenue_target: 0, monthly_lead_target: 0 },
  lead_capture: { assignment: 'default', default_assignee_id: null }
};
module.exports = function (api, db, { uid, now, quoteTotals }) {
  db.exec(`CREATE TABLE IF NOT EXISTS crm_leads (id TEXT PRIMARY KEY, number TEXT, title TEXT, customer_id TEXT, customer_name TEXT, phone TEXT, email TEXT,
    stage TEXT, value REAL DEFAULT 0, close_date TEXT, source TEXT, territory TEXT, notes TEXT, won_reason TEXT, lost_reason TEXT, quotation_id TEXT,
    created_at TEXT, updated_at TEXT, closed_at TEXT)`);
  const getSettings = () => { const r = db.prepare("SELECT value FROM settings WHERE key='crm'").get(); let s = {}; try { s = JSON.parse(r ? r.value : '{}') } catch (e) {}
    const o = {}; for (const k of Object.keys(DEFAULTS)) o[k] = { ...DEFAULTS[k], ...(s[k] || {}) }; return o };
  const ok = data => ({ success: true, data });
  api.get('/crm/settings', (req, res) => res.json(ok(getSettings())));
  api.put('/crm/settings', (req, res) => { const cur = getSettings(), b = req.body || {}; for (const k of Object.keys(DEFAULTS)) if (b[k]) cur[k] = { ...cur[k], ...b[k] };
    db.prepare("INSERT INTO settings (key,value) VALUES ('crm',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(JSON.stringify(cur)); res.json(ok(cur)) });
  const nextNumber = S => { const y = new Date().getFullYear(), n = db.prepare('SELECT COUNT(*) c FROM crm_leads').get().c + 1;
    return (S.lead_defaults.lead_number_format || 'LEAD-{YEAR}-{SEQ}').replace('{YEAR}', y).replace('{SEQ}', String(n).padStart(3, '0')) };
  api.get('/crm/leads', (req, res) => { const { stage, q } = req.query; let rows = db.prepare('SELECT * FROM crm_leads ORDER BY created_at DESC').all();
    if (stage && stage !== 'all') rows = rows.filter(r => r.stage === stage);
    if (q) { const s = String(q).toLowerCase(); rows = rows.filter(r => [r.title, r.customer_name, r.phone, r.email, r.number].some(v => String(v || '').toLowerCase().includes(s))) }
    res.json(ok(rows)) });
  api.post('/crm/leads', (req, res) => { const S = getSettings(), b = req.body || {};
    const missing = (S.lead_defaults.required_fields || []).filter(f => { const k = { customer_name: 'customer_name', customer_phone: 'phone', email: 'email', project_value: 'value', close_date: 'close_date' }[f] || f; const v = b[k] ?? (f === 'customer_phone' ? b.customer_phone : undefined); return !v && !(f === 'customer_phone' && b.customer_phone) });
    if (!b.title) return res.status(400).json({ success: false, error: 'Lead title is required' });
    if (missing.length) return res.status(400).json({ success: false, error: 'Required: ' + missing.join(', ') });
    const id = uid(), t = now(), stage = b.stage || S.lead_defaults.default_stage || 'new';
    let cid = b.customer_id || null; if (!cid && b.customer_name) { const c = db.prepare('SELECT id FROM customers WHERE lower(name)=lower(?)').get(b.customer_name); cid = c ? c.id : null }
    db.prepare('INSERT INTO crm_leads (id,number,title,customer_id,customer_name,phone,email,stage,value,close_date,source,territory,notes,quotation_id,created_at,updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)')
      .run(id, nextNumber(S), b.title, cid, b.customer_name || '', b.phone || b.customer_phone || '', b.email || '', stage, +b.value || 0, b.close_date || '', b.source || '', b.territory || '', b.notes || '', b.quotation_id || null, t, t);
    res.json(ok(db.prepare('SELECT * FROM crm_leads WHERE id=?').get(id))) });
  const patch = (req, res) => { const l = db.prepare('SELECT * FROM crm_leads WHERE id=?').get(req.params.id); if (!l) return res.status(404).json({ success: false, error: 'Not found' });
    const b = req.body || {}, f = ['title', 'customer_name', 'phone', 'email', 'stage', 'value', 'close_date', 'source', 'territory', 'notes', 'won_reason', 'lost_reason', 'quotation_id'], n = { ...l };
    f.forEach(k => { if (b[k] !== undefined) n[k] = k === 'value' ? (+b[k] || 0) : b[k] }); n.updated_at = now();
    if (n.stage !== l.stage) n.closed_at = ['won', 'lost'].includes(n.stage) ? now() : null;
    db.prepare('UPDATE crm_leads SET title=@title,customer_name=@customer_name,phone=@phone,email=@email,stage=@stage,value=@value,close_date=@close_date,source=@source,territory=@territory,notes=@notes,won_reason=@won_reason,lost_reason=@lost_reason,quotation_id=@quotation_id,updated_at=@updated_at,closed_at=@closed_at WHERE id=@id').run(n);
    res.json(ok(n)) };
  api.put('/crm/leads/:id', patch); api.patch('/crm/leads/:id', patch);
  api.delete('/crm/leads/:id', (req, res) => { db.prepare('DELETE FROM crm_leads WHERE id=?').run(req.params.id); res.json(ok(true)) });
  const sums = rows => { const by = s => rows.filter(r => r.stage === s), val = a => a.reduce((x, r) => x + (r.value || 0), 0); return { by, val } };
  api.get('/crm/dashboard', (req, res) => { const rows = db.prepare('SELECT * FROM crm_leads').all(), { by, val } = sums(rows), month = new Date().toISOString().slice(0, 7);
    const won = by('won'), lost = by('lost'), wonM = won.filter(r => (r.closed_at || '').startsWith(month)), open = rows.filter(r => !['won', 'lost'].includes(r.stage));
    const custs = db.prepare('SELECT COUNT(*) c FROM customers').get().c;
    res.json(ok({ total_leads: rows.length, won_count: won.length, lost_count: lost.length, pipeline_value: val(open), won_value: val(wonM), new_count: by('new').length, followup_count: by('followup').length, quoted_count: by('quoted').length,
      unique_customers: custs, win_rate: won.length + lost.length ? Math.round(100 * won.length / (won.length + lost.length)) : 0, stage_counts: Object.fromEntries(getSettings().pipeline.stages.map(s => [s.id, by(s.id).length])),
      stage_values: Object.fromEntries(getSettings().pipeline.stages.map(s => [s.id, val(by(s.id))])) })) });
  api.get('/crm/customers', (req, res) => { const cs = db.prepare('SELECT * FROM customers').all(), ls = db.prepare('SELECT * FROM crm_leads').all(), qs = db.prepare('SELECT customer_id, MAX(updated_at) u FROM quotations GROUP BY customer_id').all();
    const rows = cs.map(c => { const mine = ls.filter(l => l.customer_id === c.id || (l.customer_name && l.customer_name.toLowerCase() === String(c.name).toLowerCase()));
      const st = mine.length ? (mine.some(l => l.stage === 'won') ? 'Won' : mine.some(l => !['won', 'lost'].includes(l.stage)) ? 'Active' : 'Lost') : 'No leads yet';
      const last = [c.created_at, ...mine.map(l => l.updated_at), (qs.find(q => q.customer_id === c.id) || {}).u].filter(Boolean).sort().pop() || null;
      return { id: c.id, name: c.name, phone: c.phone || '', email: c.email || '', leads: mine.length, total_value: mine.reduce((a, l) => a + (l.value || 0), 0), status: st, last_activity: last } });
    res.json(ok(rows)) });
  api.get('/crm/reports', (req, res) => { const S = getSettings(), { from, to, source, report } = req.query; const f = from || '0000', t = (to || '9999') + 'T99';
    let rows = db.prepare('SELECT * FROM crm_leads').all(); const dateOf = r => report === 'closures' ? (r.closed_at || '') : (r.created_at || '');
    rows = rows.filter(r => dateOf(r) >= f && dateOf(r) <= t && (!source || source === 'all' || r.source === source) && (report !== 'closures' || r.closed_at));
    const { by, val } = sums(rows), stages = S.pipeline.stages, won = by('won'), lost = by('lost'), open = rows.filter(r => !['won', 'lost'].includes(r.stage));
    const days = won.filter(r => r.closed_at).map(r => (new Date(r.closed_at) - new Date(r.created_at)) / 864e5);
    const prob = id => (stages.find(s => s.id === id) || {}).probability || 0, wt = a => a.reduce((x, r) => x + (r.value || 0) * prob(r.stage) / 100, 0);
    const team = { name: 'TEAM TOTAL', leads: rows.length, quoted: by('quoted').length, won: won.length, lost: lost.length, win_rate: won.length + lost.length ? Math.round(100 * won.length / (won.length + lost.length)) : null,
      pipeline: val(open), weighted: wt(open), won_value: val(won), avg_days: days.length ? Math.round(days.reduce((a, b) => a + b, 0) / days.length) : null };
    const reasons = {}; lost.forEach(r => { const k = r.lost_reason || 'Not recorded'; reasons[k] = (reasons[k] || 0) + 1 });
    const forecast = stages.filter(s => !['won', 'lost'].includes(s.id)).map(s => ({ stage: s.label, probability: s.probability, leads: by(s.id).length, value: val(by(s.id)), weighted: val(by(s.id)) * s.probability / 100 }));
    const qs = db.prepare('SELECT q.id,q.status,q.created_at FROM quotations q').all().filter(q => q.created_at >= f && q.created_at <= t);
    const wo = new Set(db.prepare('SELECT quotation_id FROM work_orders').all().map(w => w.quotation_id));
    const sent = qs.filter(q => q.status !== 'draft'), appr = qs.filter(q => ['confirmed', 'approved', 'work_order', 'accepted'].includes(q.status) || wo.has(q.id)), conv = qs.filter(q => wo.has(q.id));
    res.json(ok({ team, salespeople: [], reasons: Object.entries(reasons).map(([reason, count]) => ({ reason, count })), forecast,
      forecast_total: { leads: open.length, value: val(open), weighted: wt(open) },
      funnel: { created: qs.length, sent: sent.length, viewed: 0, accepted: 0, approved: appr.length, converted: conv.length } })) });
  api.get('/crm/export', async (req, res) => { const ExcelJS = require('exceljs'), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet('CRM'), kind = req.query.kind === 'customers' ? 'customers' : 'leads';
    const get = (path) => new Promise(r => { const out = { json: d => r(d.data) }; (api.stack.find(l => l.route && l.route.path === path && l.route.methods.get).route.stack[0].handle)(req, out) });
    const rows = await get('/crm/' + kind);
    if (kind === 'leads') { ws.columns = ['Lead #', 'Title', 'Customer', 'Phone', 'Stage', 'Value', 'Source', 'Created'].map(h => ({ header: h, width: 18 })); rows.forEach(r => ws.addRow([r.number, r.title, r.customer_name, r.phone, r.stage, r.value, r.source, (r.created_at || '').slice(0, 10)])) }
    else { ws.columns = ['Customer', 'Phone', 'Email', 'Leads', 'Total value', 'Status', 'Last activity'].map(h => ({ header: h, width: 18 })); rows.forEach(r => ws.addRow([r.name, r.phone, r.email, r.leads, r.total_value, r.status, (r.last_activity || '').slice(0, 10)])) }
    ws.getRow(1).font = { bold: true }; const buf = await wb.xlsx.writeBuffer();
    res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="crm-${kind}.xlsx"` }).send(Buffer.from(buf)) });
};
