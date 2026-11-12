const express = require('express');
const cors = require('cors');
const crypto = require('crypto');
const Database = require('better-sqlite3');
const PDFDocument = require('pdfkit');
const path = require('path');

let DBFILE = process.env.DB_FILE || path.join(__dirname, 'fenestra.db');
if (process.env.VERCEL) { // serverless: writable disk is /tmp only; start from the bundled demo data
  const fs0 = require('fs'); DBFILE = process.env.DB_FILE || '/tmp/fenestra.db';
  if (!fs0.existsSync(DBFILE) && fs0.existsSync(path.join(__dirname, 'seed.db'))) fs0.copyFileSync(path.join(__dirname, 'seed.db'), DBFILE);
}
// Persistent database: when TURSO_DATABASE_URL + TURSO_AUTH_TOKEN are set (Vercel), use a Turso embedded replica
// (reads are local, writes go to the shared primary), so data survives cold starts and is shared by every instance.
const rawDb = new Database(DBFILE); rawDb.pragma('journal_mode = WAL');
// SaaS: every company (tenant) has its own private database file. `db` below always points at the current request's
// company (via AsyncLocalStorage) and falls back to the main/demo database outside a request.
const { AsyncLocalStorage } = require('async_hooks'); const als = new AsyncLocalStorage();
const db = new Proxy({}, { get(_, k) { const t = als.getStore() || rawDb; const v = t[k]; return typeof v === 'function' ? v.bind(t) : v } });
const REMOTE = !!(process.env.TURSO_DATABASE_URL && process.env.TURSO_AUTH_TOKEN);

db.exec(`
CREATE TABLE IF NOT EXISTS users (id TEXT PRIMARY KEY, name TEXT, email TEXT UNIQUE, password TEXT, role TEXT);
CREATE TABLE IF NOT EXISTS tokens (token TEXT PRIMARY KEY, user_id TEXT);
CREATE TABLE IF NOT EXISTS customers (id TEXT PRIMARY KEY, name TEXT, contact TEXT, phone TEXT, email TEXT, address TEXT);
CREATE TABLE IF NOT EXISTS quotations (
  id TEXT PRIMARY KEY, number TEXT, version INTEGER DEFAULT 1, customer_id TEXT, project TEXT, site_address TEXT,
  default_glass TEXT, default_mesh TEXT, status TEXT DEFAULT 'draft', payment_terms TEXT,
  created_at TEXT, updated_at TEXT);
CREATE TABLE IF NOT EXISTS quotation_items (
  id TEXT PRIMARY KEY, quotation_id TEXT, mark TEXT, name TEXT, system TEXT, width INTEGER, height INTEGER,
  type TEXT, qty INTEGER, glass TEXT, thickness TEXT, mesh TEXT, position INTEGER, rate REAL);
CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY, number TEXT, quotation_id TEXT, status TEXT DEFAULT 'confirmed', stage TEXT DEFAULT 'cutting',
  total INTEGER, done INTEGER DEFAULT 0, in_process INTEGER DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY, number TEXT, customer_id TEXT, amount REAL, gst REAL, status TEXT DEFAULT 'issued',
  due_date TEXT, created_at TEXT);
CREATE TABLE IF NOT EXISTS hardware (
  id TEXT PRIMARY KEY, name TEXT, code TEXT, brand TEXT, window_type TEXT, hardware_type TEXT, unit TEXT,
  default_rate REAL, your_rate REAL, stock REAL DEFAULT 0, deleted INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, brand TEXT, code TEXT, description TEXT, weight REAL, rate_override REAL);
CREATE TABLE IF NOT EXISTS glass (id TEXT PRIMARY KEY, name TEXT, thickness TEXT, rate REAL, status TEXT DEFAULT 'Active', rev INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS suppliers (id TEXT PRIMARY KEY, name TEXT, phone TEXT, email TEXT, address TEXT);
CREATE TABLE IF NOT EXISTS purchase_orders (id TEXT PRIMARY KEY, number TEXT, supplier_id TEXT, status TEXT DEFAULT 'draft', total REAL DEFAULT 0, created_at TEXT);
CREATE TABLE IF NOT EXISTS tickets (id TEXT PRIMARY KEY, subject TEXT, body TEXT, quotation_id TEXT, status TEXT DEFAULT 'open', created_at TEXT);
`);

const uid = () => crypto.randomUUID();
const now = () => new Date().toISOString();

// ---- seed ----
if (!db.prepare('SELECT 1 FROM users LIMIT 1').get()) {
  db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(uid(), 'Vijay Kumar Reddy', 'vijaykumarreddy101234@gmail.com', 'fenestra123', 'owner');
  const setS = db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)');
  setS.run('intro', '');
  setS.run('terms', '1. Specification: Manufacturing follows the profile system, glass, and hardware specified in this document.');
  setS.run('validity_days', '30');
  setS.run('followup_days', '5');
  setS.run('payment_terms', JSON.stringify([
    { name: '100% advance', terms: '100% advance payment to be done along with the purchase order or order confirmation.' },
    { name: '50-40-10', terms: '50% advance payment to be done along with the purchase order or order confirmation, 40% after delivery and remaining 10% to be done after installation.' },
    { name: '50-50', terms: '50% advance payment to be done along with the purchase order or order confirmation, 50% payment to be done before dispatch.' },
  ]));
  setS.run('length_unit', 'mm');
  setS.run('area_unit', 'sqft');
  const c1 = uid(), c2 = uid();
  db.prepare('INSERT INTO customers VALUES (?,?,?,?,?,?)').run(c1, '123', '123', '8985587272', '', '');
  db.prepare('INSERT INTO customers VALUES (?,?,?,?,?,?)').run(c2, 'raviraja', 'raviraja', '8985587989', '', '');
  const q1 = uid();
  db.prepare('INSERT INTO quotations (id,number,customer_id,project,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(q1, 'QT-2026-001', c2, 'sai', 'confirmed', '2026-10-22T10:00:00Z', '2026-10-22T10:00:00Z');
  const addI = db.prepare('INSERT INTO quotation_items VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
  [['w1', '2-panel sliding', '60 series fixed window + 62 series sliding window', 1200, 1800, 'combination', 1, '5 mm frosted toughened glass', '5 mm', 'No mesh', 529.11],
   ['D1', 'Fixed', '60 series casement window', 600, 1200, 'casement', 5, '5 mm clear glass', '5 mm', 'No mesh', null],
   ['W2', '2-panel sliding with mesh', '92 series sliding window with mesh', 1200, 1200, 'sliding', 10, '5 mm frosted toughened glass', '5 mm', 'SS mesh', 582.60],
   ['V1', 'Louvre left · fan right · fixed below', '60 series ventilator', 900, 600, 'combination', 20, '5 mm frosted toughened glass', '5 mm', 'No mesh', 528.19]]
    .forEach((r, i) => addI.run(uid(), q1, ...r.slice(0, 10), i, r[10]));
  const q2 = uid();
  db.prepare('INSERT INTO quotations (id,number,customer_id,project,status,created_at,updated_at) VALUES (?,?,?,?,?,?,?)')
    .run(q2, 'QT-2026-002', c1, '123', 'draft', now(), now());
  const sq = (w, h) => (w * h) / 92903.04;
  [['w1', '3-track 3-panel sliding with mesh', '112 series sliding window with mesh', 1800, 1200, 'sliding', 1, '5 mm clear glass', '5 mm', 'SS mesh', 10760],
   ['d1', 'Single open door', '60 series casement door', 900, 2100, 'casement', 1, '4 mm clear glass', '4 mm', 'No mesh', 11216],
   ['w3', '4-panel sliding', '62 series sliding window', 2800, 1200, 'sliding', 1, '5 mm clear glass', '5 mm', 'No mesh', 13719.37],
   ['w4', '3-panel sliding with mesh', '80 series sliding window with mesh', 1800, 1200, 'combination', 1, '5 mm clear glass', '5 mm', 'SS mesh', 10531],
   ['w2', '2-panel sliding door', '62 series sliding door', 1800, 2100, 'sliding', 1, '5 mm clear glass', '5 mm', 'No mesh', 16963]]
    .forEach((r, i) => addI.run(uid(), q2, ...r.slice(0, 10), i, +(r[10] / sq(r[4], r[3])).toFixed(2)));
  db.prepare('INSERT INTO work_orders (id,number,quotation_id,status,stage,total,done,in_process,created_at) VALUES (?,?,?,?,?,?,?,?,?)')
    .run(uid(), 'WO-2026-001', q1, 'in_production', 'cutting', 36, 13, 1, now());
}

if (!db.prepare('SELECT 1 FROM hardware LIMIT 1').get()) {
  const ins = db.prepare('INSERT INTO hardware (id,name,code,brand,window_type,hardware_type,unit,default_rate,your_rate,stock) VALUES (?,?,?,?,?,?,?,?,?,0)');
  const lines = require('fs').readFileSync(path.join(__dirname, 'hardware-seed.txt'), 'utf8').split('\n').filter(Boolean);
  db.transaction(() => lines.forEach(l => {
    const [full, wt, ht, rate] = l.split('|');
    const m = full.match(/\[([^\]]+)\]/);
    const name = full.replace(/\s*\[[^\]]+\]/, '').trim();
    ins.run(uid(), name, m ? m[1] : '', 'Generic Hardware', wt, ht, 'pc', +rate, +rate);
  }))();
}

if (db.prepare('SELECT 1 FROM profiles LIMIT 1').get() && !db.prepare("SELECT 1 FROM profiles WHERE code='RSS-75ES'").get()) db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,NULL)').run(uid(), 'S CRAFT uPVC Profiles v31', 'RSS-75ES', 'Sash - 75X35', 0.976);
if (!db.prepare('SELECT 1 FROM profiles LIMIT 1').get()) {
  const fs = require('fs');
  db.transaction(() => {
    fs.readFileSync(path.join(__dirname, 'profiles-seed.txt'), 'utf8').split('\n').filter(Boolean).forEach(l => {
      const [code, d, w] = l.split('|'); db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,NULL)').run(uid(), 'S CRAFT uPVC Profiles v31', code, d, +w);
    });
    fs.readFileSync(path.join(__dirname, 'glass-seed.txt'), 'utf8').split('\n').filter(Boolean).forEach(l => {
      const [n, t, r] = l.split('|'); db.prepare('INSERT INTO glass (id,name,thickness,rate) VALUES (?,?,?,?)').run(uid(), n, t, +r);
    });
    fs.readFileSync(path.join(__dirname, 'accessories-seed.txt'), 'utf8').split('\n').filter(Boolean).forEach(l => {
      const [full, ht, unit, rate] = l.split('|'); const m = full.match(/\[([^\]]+)\]/);
      const generic = !m && /mesh|reinforcement/i.test(full);
      db.prepare('INSERT INTO hardware (id,name,code,brand,window_type,hardware_type,unit,default_rate,your_rate,stock) VALUES (?,?,?,?,?,?,?,?,?,0)')
        .run(uid(), full.replace(/\s*\[[^\]]+\]/, '').trim(), m ? m[1] : '', generic ? 'Generic' : 'Accessories and Installation Material', 'All window types', ht, unit, +rate, +rate);
    });
    const S = db.prepare('INSERT OR IGNORE INTO settings VALUES (?,?)');
    S.run('company', JSON.stringify({ name: '', gstin: '', registered: true, state: '', phone: '', email: '', address: '', bank: { account_name: '', account_number: '', ifsc: '', bank_name: '', branch: '' } }));
    S.run('pricing', JSON.stringify({ profit: 20, discount: 0, install_material: 30, transport: 1000, fab_labour: 45, install_labour: 50, loading_unloading: 1000, profile_wastage: 8, ri_wastage: 8, glass_wastage: 15, mesh_wastage: 0, gi_rate: 100, gst: 18, show_gst: true, show_discount: true, white_rate: 165, ri_rate: 98 }));
    S.run('config', JSON.stringify({ welding: 3, sliding_lap: 8, casement_overlap: 8, glass_clearance: 4, building_loss: 0, ri_deduction: 100, coupler_gap: 2, louvre_pitch: '', louvre_clearance: '' }));
    S.run('tax', JSON.stringify({ hsn_upvc: '3925', hsn_alu: '7610', hsn_glass: '7007', sac_install: '995468', sac_transport: '996511', sac_loading: '996719', ledger_sales: 'Sales – GST', ledger_cgst: 'Output CGST', ledger_sgst: 'Output SGST', ledger_igst: 'Output IGST', ledger_round: 'Round Off', prefix: 'INV' }));
  })();
}


// ---- engine: cut list + cost breakdown (calibrated on the demo's casement window) ----
function cfg() { return JSON.parse(db.prepare("SELECT value FROM settings WHERE key='config'").get().value); }
function prc() { return JSON.parse(db.prepare("SELECT value FROM settings WHERE key='pricing'").get().value); }
db.exec('CREATE TABLE IF NOT EXISTS quote_comm (qid TEXT PRIMARY KEY, json TEXT)');
const COMM_DEF = { discount: 0, transport: 1000, loading: 500, unloading: 500, show_discount: 0, show_gst: 1, hide_sqft: 0, payment: '', custom_payment: '', notes: '', rates: {}, install: [] };
function getComm(qid) { try { return { ...COMM_DEF, ...JSON.parse(db.prepare('SELECT json FROM quote_comm WHERE qid=?').get(qid).json) }; } catch (e) { return { ...COMM_DEF, rates: {}, install: [] }; } }
function setComm(qid, c) { db.prepare('INSERT INTO quote_comm (qid,json) VALUES (?,?) ON CONFLICT(qid) DO UPDATE SET json=excluded.json').run(qid, JSON.stringify(c)); }
function prcQ(qid) { return { ...prc(), ...((qid && getComm(qid).rates) || {}) }; }
const prof = code => db.prepare('SELECT * FROM profiles WHERE code=?').get(code);
function hwFind(v, fin) {
  const rows = db.prepare("SELECT name, default_rate, your_rate FROM hardware WHERE deleted=0 AND (name LIKE ? OR name LIKE ?)").all(`${v} · %`, `${v}%`);
  if (!rows.length) return null;
  const r = rows.find(x => x.name.includes('· ' + fin)) || rows.find(x => x.name.includes('· WHITE')) || rows[0];
  return { name: r.name.replace(/\s*\[.*\]$/, ''), rate: +(r.your_rate || r.default_rate || 0) };
}
function glassRate(name) { const g = db.prepare('SELECT rate FROM glass WHERE name=?').get(name); return g && g.rate ? g.rate : 580; }
function engine(it) {
  const c = cfg(), p = prc(), W = it.width, H = it.height, w = c.welding || 3;
  const isFixed = it.type === 'fixed';
  const FRAME_FACE = 40, SASH_FACE = 58, OVERLAP = c.casement_overlap || 8;
  const frameCode = isFixed ? 'RSC-42VF' : 'RSC-60OF';
  const cuts = [];
  const add = (role, code, lens) => { const pr = prof(code); const m = lens.reduce((a, b) => a + b, 0) / 1000; cuts.push({ role, code, name: pr.description, lens, kgm: pr.weight, kg: +(m * pr.weight).toFixed(3), metres: m }); };
  add('Frame', frameCode, [W + 2 * w, W + 2 * w, H + 2 * w, H + 2 * w].map((x, i) => x));
  let glassW, glassH, sashW, sashH;
  if (isFixed) { glassW = W - 2 * FRAME_FACE + 20; glassH = H - 2 * FRAME_FACE + 20; add('Bead', 'RSB-24.5SB', [glassW - 4, glassW - 4, glassH - 4, glassH - 4]); }
  else { sashW = W - 2 * FRAME_FACE + 2 * OVERLAP; sashH = H - 2 * FRAME_FACE + 2 * OVERLAP;
    add('Sash', 'RSC-78WO', [sashW + 2 * w, sashW + 2 * w, sashH + 2 * w, sashH + 2 * w]);
    glassW = sashW - 2 * SASH_FACE; glassH = sashH - 2 * SASH_FACE;
    add('Bead', 'RSB-35CB', [glassW - 4, glassW - 4, glassH - 4, glassH - 4]); }
  const kg = cuts.reduce((a, x) => a + x.kg, 0);
  const sashM = cuts.filter(x => x.role !== 'Frame').reduce((a, x) => a + x.metres, 0);
  const area = (W * H) / 92903.04, glassArea = (glassW * glassH) / 92903.04;
  const profileCost = kg * p.white_rate + (isFixed ? 0 : sashM * 0.0 + (cuts.find(x => x.role === 'Sash').metres) * 39.2);
  const riM = cuts.filter(x => x.role !== 'Bead').reduce((a, x) => a + x.metres - 0.1 * x.lens.length, 0);
  const riCost = riM * 0.7768 * p.ri_rate;
  const hardware = isFixed ? 0 : 50 + 2 * 137.5 + 8.8;
  const glassCost = (glassW * glassH / 1e6) * glassRate(it.glass);
  const rows = [
    ['Profile cost', profileCost], [`Profile wastage ${p.profile_wastage}%`, profileCost * p.profile_wastage / 100],
    ['Reinforcement cost', riCost], [`Reinforcement wastage ${p.ri_wastage}%`, riCost * p.ri_wastage / 100],
    ['Hardware cost', hardware], ['Glass cost', glassCost], ['Glass wastage 12%', glassCost * 0.12]];
  const material = rows.reduce((a, r) => a + r[1], 0);
  const labour = [[`Fabrication cost ₹${p.fab_labour.toFixed(2)}/sq ft`, p.fab_labour * area], [`Installation labour ₹${p.install_labour.toFixed(2)}/sq ft`, p.install_labour * area], [`Installation Material Cost ₹${p.install_material.toFixed(2)}/sq ft`, p.install_material * area]];
  const cost = material + labour.reduce((a, r) => a + r[1], 0);
  const profit = cost * p.profit / 100, unit = cost + profit, tax = unit * 0.18;
  const hw = isFixed ? [] : [{ name: 'CASEMENT WINDOW HANDLE · WHITE', qty: 1, rate: 50 }, { name: 'FRICTION STAY 10" · WHITE', qty: 2, rate: 137.5 }, { name: 'CMT ESPAG STRIKER · WHITE', qty: 1, rate: 8.8 }];
  return { cuts, kg: +kg.toFixed(2), area: +area.toFixed(2), glassArea: +glassArea.toFixed(2), glass: { w: glassW, h: glassH }, sash: isFixed ? null : { w: sashW, h: sashH },
    rows: rows.map(r => [r[0], +r[1].toFixed(2)]), materialTotal: +material.toFixed(2), labour: labour.map(r => [r[0], +r[1].toFixed(2)]), totalCost: +cost.toFixed(2),
    profitLabel: `Profit margin ${p.profit}%`, profit: +profit.toFixed(2), unit: +unit.toFixed(2), taxLabel: 'Taxes 18% CGST + SGST', tax: +tax.toFixed(2), unitInc: +(unit + tax).toFixed(2), perSqftInc: +((unit + tax) / area).toFixed(2), hardware: hw };
}

try { db.exec('ALTER TABLE quotation_items ADD COLUMN design TEXT'); } catch (e) {}
const { compute } = require('./engine');
function designOf(it) {
  const txt = (it.system || '') + ' ' + (it.name || '');
  const ser = (/(\d+)\s*series/i.exec(it.system || '') || [])[1];
  const mesh = it.mesh && it.mesh !== 'No mesh' ? 1 : 0;
  let d = null;
  if (it.design) { try { d = JSON.parse(it.design); } catch (e) {} }
  if (!d || !d.kind) {
    const n = /(\d)[- ]?panel/i.exec(it.name || '');
    if (it.type === 'sliding' || (it.type === 'combination' && /slid/i.test(txt))) d = { kind: 'sliding', panels: n ? +n[1] : 2, mesh, door: /door/i.test(txt), tracks: /3-track/i.test(txt) ? 3 : undefined };
    else if (it.type === 'combination') d = { kind: 'sliding', panels: n ? +n[1] : 3, mesh, series: ser };
  }
  if (!d) return null;
  if (d.kind === 'sliding' && !d.series && ser && SERIES_OK.includes(ser)) d.series = ser;
  return { ...d, W: it.width, H: it.height, glassName: it.glass };
}
const SERIES_OK = ['53', '62', '80', '92', '95', '112'];
function fullEngine(it) { try { return fullEngine0(it) } catch (e) { console.error('engine', it && it.mark, e.message); return null } }
function fullEngine0(it) {
  if (!it.design && it.type === 'casement' && /door/i.test((it.system || '') + ' ' + (it.name || ''))) return compute({ kind: 'grid', door: true, cols: [{ w: 1, rows: [{ h: 1, op: 'RH' }] }], W: it.width, H: it.height, glassName: it.glass }, { prof, glassRate, hwFind, p: prcQ(it.quotation_id), cfg: cfg() });
  if (!it.design && (it.type === 'casement' || it.type === 'fixed')) return engine(it);
  const d = designOf(it); if (!d) return null;
  return compute(d, { prof, glassRate, hwFind, p: prcQ(it.quotation_id), cfg: cfg() });
}

// ---- pricing (approximation of per-sq-ft rates seen in the demo) ----
const SQFT_RATE = { casement: 591.91, sliding: 522.6, combination: 529, fixed: 520 };
const MESH_EXTRA = { 'No mesh': 0, 'SS mesh': 60, 'Aluminium mesh': 40, 'Fibre mesh': 30 };
const sqft = (w, h) => (w * h) / 92903.04;
function itemPrice(it) {
  const area = sqft(it.width, it.height);
  { const e = fullEngine(it); if (e && e.unit) { const each = e.unit; return { area: +area.toFixed(2), rate: +(each / area).toFixed(2), each: +each.toFixed(2), total: +(each * it.qty).toFixed(2), error: e.error || null }; } }
  const rate = it.rate || ((SQFT_RATE[it.type] || 550) + (MESH_EXTRA[it.mesh] || 0) - (it.mesh && it.mesh !== 'No mesh' && it.type === 'sliding' ? 0 : 0));
  const each = area * rate;
  return { area: +area.toFixed(2), rate: +rate.toFixed(2), each: +each.toFixed(2), total: +(each * it.qty).toFixed(2) };
}
// charges as seen on the demo's Pricing tab
const CHARGES = { transport: 1000, loading: 500, unloading: 500, gstRate: 0.09 };
function quoteTotals(qid) {
  const items = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY position').all(qid);
  const priced = items.map(i => ({ ...i, ...itemPrice(i) }));
  const comm = getComm(qid);
  const subtotal = +priced.reduce((s, i) => s + i.total, 0).toFixed(2);
  const discountAmt = +(subtotal * (+comm.discount || 0) / 100).toFixed(2);
  const transport = subtotal ? +comm.transport || 0 : 0, loading = subtotal ? +comm.loading || 0 : 0, unloading = subtotal ? +comm.unloading || 0 : 0;
  const charges = transport + loading + unloading;
  const cgst = +((subtotal - discountAmt + charges) * CHARGES.gstRate).toFixed(2);
  const sgst = cgst;
  const raw = subtotal - discountAmt + charges + cgst + sgst;
  const total = Math.round(raw);
  return {
    items: priced, subtotal, discount: +comm.discount || 0, discountAmt, transport, loading, unloading, cgst, sgst, roundOff: +(total - raw).toFixed(2), total,
    area: +priced.reduce((s, i) => s + i.area * i.qty, 0).toFixed(2),
    designs: priced.length, windows: priced.reduce((s, i) => s + i.qty, 0),
  };
}
function nextNumber(table, prefix) {
  const year = new Date().getFullYear();
  const n = db.prepare(`SELECT COUNT(*) c FROM ${table}`).get().c + 1;
  return `${prefix}-${year}-${String(n).padStart(3, '0')}`;
}

// ---- app ----
const app = express();
app.use(cors());
app.use((req, res, next) => /^\/api\/v1\/app\/(brands\/catalogue|profiles\/import|profiles\/[^/]+\/image|inventory\/hardware-import|glass\/import)/.test(req.path) ? next() : express.json()(req, res, next));
const api = express.Router();

// Stateless signed tokens: on serverless the DB resets between instances, so a token stored in
// the tokens table vanishes and the user is bounced back to login. A v1 token carries the user id
// and expiry, signed with HMAC, and is verified without any DB row. base64 never contains '.', so
// splitting on '.' is safe.
rawDb.exec("CREATE TABLE IF NOT EXISTS accounts (tenant TEXT PRIMARY KEY, email TEXT UNIQUE, company TEXT, plan TEXT DEFAULT 'trial', created_at TEXT)");
const fs1 = require('fs'), TMP = process.env.VERCEL ? '/tmp' : require('os').tmpdir(), TDIR = path.join(TMP, 'fw-tenants'); fs1.mkdirSync(TDIR, { recursive: true });
const tenants = new Map(), KEEP = new Set(['hardware', 'profiles', 'glass', 'settings', 'accounts']);
const mkPersist = (d, ns) => REMOTE ? require('./persist')(d, { url: process.env.TURSO_DATABASE_URL, token: process.env.TURSO_AUTH_TOKEN, tmp: TMP, ns }) : null;
tenants.set('main', { db: rawDb, mw: mkPersist(rawDb, '') });
function getTenant(id) {
  if (tenants.has(id)) return tenants.get(id);
  if (!/^t[a-f0-9]{12}$/.test(id)) return null;
  const f = path.join(TDIR, id + '.db');
  if (!fs1.existsSync(f)) { // new company: copy the schema and rate catalogue, drop every other company's business data
    const tmpf = f + '.new'; try { fs1.unlinkSync(tmpf) } catch (e) {} rawDb.exec(`VACUUM INTO '${tmpf}'`);
    const t = new Database(tmpf); t.pragma('journal_mode = DELETE');
    for (const { name } of t.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all()) {
      if (name === 'accounts') t.exec('DROP TABLE accounts'); else if (!KEEP.has(name)) t.exec(`DELETE FROM "${name}"`);
    }
    t.close(); fs1.renameSync(tmpf, f);
  }
  const d = new Database(f); d.pragma('journal_mode = WAL');
  const T = { db: d, mw: mkPersist(d, id) }; tenants.set(id, T); return T;
}
const AUTH_SECRET = process.env.AUTH_SECRET || 'fenstraworks-auth';
const tsig = s => crypto.createHmac('sha256', AUTH_SECRET).update(s).digest('hex').slice(0, 32);
const mkToken = (userId, t) => { const p = Buffer.from(JSON.stringify({ u: userId, t: t || undefined, x: Date.now() + 30 * 864e5 })).toString('base64'); return 'v1.' + p + '.' + tsig(p) };
const tokenUser = t => {
  if (!t) return null;
  if (t.startsWith('v1.')) {
    const [, p, s] = t.split('.');
    if (!p || s !== tsig(p)) return null;
    try { const d = JSON.parse(Buffer.from(p, 'base64').toString()); return d.x > Date.now() ? d.u : null } catch (e) { return null }
  }
  const row = db.prepare('SELECT user_id FROM tokens WHERE token=?').get(t); // older DB tokens still work on the desktop server
  return row && row.user_id;
};

const pwHash = p => { const salt = crypto.randomBytes(8).toString('hex'); return 'h$' + salt + '$' + crypto.scryptSync(String(p), salt, 24).toString('hex') };
const pwOk = (u, p) => { if (!u || p == null) return false; const w = u.password || ''; if (!w.startsWith('h$')) return w === p; const [, salt, h] = w.split('$'); return crypto.scryptSync(String(p), salt, 24).toString('hex') === h };
// every request runs inside its own company's database; the company id travels inside the signed login token
api.use((req, res, next) => {
  let tid = 'main'; const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  if (t && t.startsWith('v1.')) { const [, p, s] = t.split('.'); if (p && s === tsig(p)) { try { tid = JSON.parse(Buffer.from(p, 'base64').toString()).t || 'main' } catch (e) {} } }
  else if (req.path === '/auth/login' && req.body && req.body.email) { const a = rawDb.prepare('SELECT tenant FROM accounts WHERE email=?').get(String(req.body.email).trim().toLowerCase()); if (a) tid = a.tenant }
  const T = getTenant(tid); if (!T) return res.status(401).json({ error: 'Unauthorized' });
  req.tenant = tid; als.run(T.db, () => T.mw ? T.mw(req, res, next) : next());
});
// Automatic error detection: server 5xx and browser JS errors are recorded so problems are found without anyone reporting them
rawDb.exec("CREATE TABLE IF NOT EXISTS error_log (id INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT, kind TEXT, tenant TEXT, where_ TEXT, message TEXT)");
const logErr = (kind, tenant, where_, message) => { try { rawDb.prepare('INSERT INTO error_log (at,kind,tenant,where_,message) VALUES (?,?,?,?,?)').run(new Date().toISOString(), kind, tenant || '', String(where_ || '').slice(0, 200), String(message || '').slice(0, 800)); rawDb.exec('DELETE FROM error_log WHERE id < (SELECT MAX(id) FROM error_log) - 500') } catch (e) {} };
api.use((req, res, next) => { res.on('finish', () => { if (res.statusCode >= 500) logErr('server', req.tenant, req.method + ' ' + req.path, 'HTTP ' + res.statusCode) }); next() });
api.post('/client-error', (req, res) => { const b = req.body || {}; logErr('browser', req.tenant, b.url, b.message); res.json({ ok: true }) });
api.post('/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE lower(email)=lower(?)').get(String(email || '').trim());
  if (!u || !pwOk(u, password)) return res.status(401).json({ error: 'Invalid email or password' });
  res.json({ token: mkToken(u.id, req.tenant === 'main' ? '' : req.tenant), user: { id: u.id, name: u.name, email: u.email, role: u.role } });
});
// Self-service signup: creates a new company with its own private data
api.post('/auth/signup', async (req, res) => {
  try {
    const { company, name, email, password } = req.body || {}, em = String(email || '').trim().toLowerCase();
    if (!String(company || '').trim() || !String(name || '').trim()) return res.status(400).json({ error: 'Enter your company and your name' });
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (String(password || '').length < 8) return res.status(400).json({ error: 'Use at least 8 characters for the password' });
    if (rawDb.prepare('SELECT 1 FROM accounts WHERE email=?').get(em) || rawDb.prepare('SELECT 1 FROM users WHERE lower(email)=?').get(em)) return res.status(409).json({ error: 'This email already has an account. Please log in.' });
    const tid = 't' + crypto.randomBytes(6).toString('hex'), T = getTenant(tid), uid0 = crypto.randomUUID();
    T.db.prepare('INSERT INTO users (id,name,email,password,role) VALUES (?,?,?,?,?)').run(uid0, String(name).trim(), em, pwHash(password), 'admin');
    const co = (() => { try { return JSON.parse(T.db.prepare("SELECT value FROM settings WHERE key='company'").get().value) } catch (e) { return {} } })();
    T.db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run('company', JSON.stringify({ ...co, name: String(company).trim(), email: em }));
    rawDb.prepare('INSERT INTO accounts (tenant,email,company,plan,created_at) VALUES (?,?,?,?,?)').run(tid, em, String(company).trim(), 'trial', new Date().toISOString());
    if (T.mw) await T.mw.pushNow();
    res.json({ token: mkToken(uid0, tid), user: { id: uid0, name: String(name).trim(), email: em, role: 'admin' } });
  } catch (e) { console.error('signup failed', e); res.status(500).json({ error: 'Could not create the account, please retry.' }) }
});
api.use((req, res, next) => {
  const t = (req.headers.authorization || '').replace('Bearer ', '') || req.query.token;
  const userId = tokenUser(t);
  const user = userId && db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(userId);
  if (!user) return res.status(401).json({ error: 'Unauthorized' });
  req.user = user;
  next();
});
api.get('/auth/me', (req, res) => { const a = req.tenant === 'main' ? null : rawDb.prepare('SELECT company, plan, created_at FROM accounts WHERE tenant=?').get(req.tenant); res.json({ ...req.user, tenant: req.tenant, company: a ? a.company : undefined, plan: a ? a.plan : 'owner' }) });

api.get('/admin/errors', (req, res) => { if (req.tenant !== 'main') return res.status(403).json({ error: 'Forbidden' }); res.json(rawDb.prepare('SELECT * FROM error_log ORDER BY id DESC LIMIT 100').all()) });
api.get('/dashboard', (req, res) => {
  const qs = db.prepare('SELECT q.*, c.name AS customer FROM quotations q LEFT JOIN customers c ON c.id=q.customer_id ORDER BY q.created_at DESC').all();
  const withTotal = qs.map(q => ({ ...q, total: quoteTotals(q.id).total }));
  const by = s => withTotal.filter(q => q.status === s);
  const wos = db.prepare('SELECT w.*, c.name AS customer FROM work_orders w LEFT JOIN quotations q ON q.id=w.quotation_id LEFT JOIN customers c ON c.id=q.customer_id ORDER BY w.created_at DESC').all();
  const month = new Date().toISOString().slice(0, 7);
  const onOrder = wos.filter(w => w.status !== 'dispatched').reduce((s, w) => s + (w.total || 0) - (w.done || 0), 0);
  const inProd = wos.reduce((s, w) => s + (w.in_process || 0), 0);
  res.json({
    needsYou: { followUp: 0, draftToSend: by('draft').length, readyForWorkOrder: 0, belowMinStock: 0 },
    quotations: {
      openValue: [...by('draft'), ...by('sent')].reduce((s, q) => s + q.total, 0),
      confirmedValue: by('confirmed').reduce((s, q) => s + q.total, 0),
      draft: by('draft').length, sent: by('sent').length, confirmed: by('confirmed').length,
      createdThisMonth: qs.filter(q => (q.created_at || '').slice(0, 7) === month).length,
      recent: withTotal.slice(0, 5).map(q => ({ id: q.id, number: q.number, customer: q.customer || q.project, status: q.status, total: q.total })),
    },
    production: {
      windowsOnOrder: onOrder, inProduction: inProd, waiting: Math.max(0, onOrder - inProd), readyToCreate: 0,
      complete: wos.filter(w => w.status === 'production_complete').length, suspended: 0,
      recent: wos.slice(0, 5).map(w => ({ id: w.id, number: w.number, customer: w.customer, status: w.status })),
    },
    inventory: {
      itemsInStock: db.prepare('SELECT COUNT(*) c FROM hardware WHERE stock > 0').get().c, barsAvailable: 0, belowMin: 0, openPOs: 0, overduePOs: 0,
    },
  });
});

// customers
api.get('/customers', (req, res) => res.json(db.prepare('SELECT * FROM customers ORDER BY name').all()));
['state', 'gstin'].forEach(c => { try { db.exec(`ALTER TABLE customers ADD COLUMN ${c} TEXT DEFAULT ''`) } catch (e) {} });
api.post('/customers', (req, res) => {
  const c = { id: uid(), name: '', contact: '', phone: '', email: '', address: '', state: '', gstin: '', ...req.body };
  db.prepare('INSERT INTO customers (id,name,contact,phone,email,address,state,gstin) VALUES (@id,@name,@contact,@phone,@email,@address,@state,@gstin)').run(c);
  res.json(c);
});
api.put('/customers/:id', (req, res) => {
  const cur = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id); if (!cur) return res.status(404).json({ error: 'Not found' });
  const n = { ...cur, ...req.body, id: cur.id };
  db.prepare('UPDATE customers SET name=@name, contact=@contact, phone=@phone, email=@email, address=@address, state=@state, gstin=@gstin WHERE id=@id').run(n); res.json(n);
});

// quotations
const shape = q => {
  const t = quoteTotals(q.id);
  const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
  const wo = db.prepare('SELECT id,number FROM work_orders WHERE quotation_id=?').get(q.id);
  const glyphs = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY position LIMIT 3').all(q.id).map(it => { let d = null; try { d = designOf(it) } catch (e) {} d = d || {}; return { k: d.kind || (it.type === 'sliding' ? 'sliding' : 'grid'), n: d.panels || (d.cols || []).length || 1, door: !!d.door || /door/i.test(it.name || '') } });
  return { ...q, customer: cust, workOrder: wo || null, total: t.total, designs: t.designs, windows: t.windows, glyphs };
};
api.get('/quotations', (req, res) => {
  let rows = db.prepare('SELECT * FROM quotations ORDER BY updated_at DESC').all().map(shape);
  if (req.query.status) rows = rows.filter(r => r.status === req.query.status);
  if (req.query.q) {
    const s = req.query.q.toLowerCase();
    rows = rows.filter(r => [r.number, r.project, r.customer && r.customer.name].join(' ').toLowerCase().includes(s));
  }
  res.json(rows);
});
api.post('/quotations', (req, res) => {
  const { customer_id, project, site_address, default_glass, default_mesh } = req.body;
  const q = { id: uid(), number: nextNumber('quotations', 'QT'), customer_id, project: project || '', site_address: site_address || '',
    default_glass: default_glass || '', default_mesh: default_mesh || '', created_at: now(), updated_at: now() };
  db.prepare(`INSERT INTO quotations (id,number,customer_id,project,site_address,default_glass,default_mesh,created_at,updated_at)
    VALUES (@id,@number,@customer_id,@project,@site_address,@default_glass,@default_mesh,@created_at,@updated_at)`).run(q);
  res.json(shape(db.prepare('SELECT * FROM quotations WHERE id=?').get(q.id)));
});
api.get('/quotations/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Quotation not found.' });
  res.json({ ...shape(q), defaults: getComm(q.id).defaults || {}, pricing: quoteTotals(q.id) });
});
api.put('/quotations/:id', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).json({ error: 'Not found' });
  const b = req.body || {}, n = { project: 'project' in b ? String(b.project || '') : q.project, site_address: 'site_address' in b ? String(b.site_address || '') : q.site_address, default_glass: 'default_glass' in b ? String(b.default_glass || '') : q.default_glass, default_mesh: 'default_mesh' in b ? String(b.default_mesh || '') : q.default_mesh };
  db.prepare('UPDATE quotations SET project=?, site_address=?, default_glass=?, default_mesh=?, updated_at=? WHERE id=?').run(n.project, n.site_address, n.default_glass, n.default_mesh, now(), q.id);
  if (b.defaults) { const c = getComm(q.id); c.defaults = { ...(c.defaults || {}), ...b.defaults }; setComm(q.id, c); }
  res.json({ ok: true });
});
api.delete('/quotations/:id', (req, res) => {
  db.prepare('DELETE FROM quotation_items WHERE quotation_id=?').run(req.params.id);
  db.prepare('DELETE FROM quotations WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
api.post('/quotations/:id/status', (req, res) => {
  const { status } = req.body;
  db.prepare('UPDATE quotations SET status=?, updated_at=? WHERE id=?').run(status, now(), req.params.id);
  if (status === 'confirmed' && !db.prepare('SELECT 1 FROM work_orders WHERE quotation_id=?').get(req.params.id)) {
    const t = quoteTotals(req.params.id);
    db.prepare('INSERT INTO work_orders (id,number,quotation_id,status,stage,total,created_at) VALUES (?,?,?,?,?,?,?)')
      .run(uid(), nextNumber('work_orders', 'WO'), req.params.id, 'confirmed', 'cutting', t.windows, now());
    const nw = db.prepare('SELECT * FROM work_orders WHERE quotation_id=?').get(req.params.id);
    db.prepare("INSERT INTO sub_work_orders VALUES (?,?,?,?,?,?)").run(uid(), nw.id, nw.number + '-S1', '', 'draft', now());
  }
  res.json({ ok: true });
});
api.post('/quotations/:id/version', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  const nid = uid();
  db.prepare(`INSERT INTO quotations (id,number,version,customer_id,project,site_address,default_glass,default_mesh,status,created_at,updated_at)
    VALUES (?,?,?,?,?,?,?,?,'draft',?,?)`).run(nid, nextNumber('quotations', 'QT'), q.version + 1, q.customer_id, q.project, q.site_address, q.default_glass, q.default_mesh, now(), now());
  db.prepare('SELECT * FROM quotation_items WHERE quotation_id=?').all(q.id).forEach((i, n) =>
    db.prepare('INSERT INTO quotation_items (id,quotation_id,mark,name,system,width,height,type,qty,glass,thickness,mesh,position,rate,design) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(uid(), nid, i.mark, i.name, i.system, i.width, i.height, i.type, i.qty, i.glass, i.thickness, i.mesh, n, i.rate, i.design));
  res.json({ id: nid });
});
api.post('/quotations/:id/items', (req, res) => {
  const b = req.body;
  const pos = db.prepare('SELECT COUNT(*) c FROM quotation_items WHERE quotation_id=?').get(req.params.id).c;
  const id = uid();
  db.prepare('INSERT INTO quotation_items (id,quotation_id,mark,name,system,width,height,type,qty,glass,thickness,mesh,position,rate) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(id, req.params.id, b.mark || `W${pos + 1}`, b.name || 'Window', b.system || '', b.width, b.height, b.type || 'casement', b.qty || 1, b.glass || '5 mm clear glass', b.thickness || '5 mm', b.mesh || 'No mesh', pos, null);
  db.prepare('UPDATE quotations SET updated_at=? WHERE id=?').run(now(), req.params.id);
  res.json({ id });
});
api.put('/quotations/:id/items/:itemId', (req, res) => {
  const b = req.body;
  const cur = db.prepare('SELECT * FROM quotation_items WHERE id=?').get(req.params.itemId); if (!cur) return res.status(404).json({ error: 'Not found' });
  const pick = (k, dflt) => (b[k] === undefined || b[k] === null || b[k] === '') && dflt !== '' ? cur[k] : (b[k] ?? dflt);
  db.prepare('UPDATE quotation_items SET mark=?,name=?,system=?,width=?,height=?,type=?,qty=?,glass=?,mesh=?,location=?,notes=? WHERE id=?')
    .run(pick('mark'), pick('name'), b.system ?? cur.system, +b.width || cur.width, +b.height || cur.height, pick('type'), Math.max(1, Math.min(9999, +b.qty || cur.qty)), pick('glass'), pick('mesh'), b.location ?? cur.location ?? '', b.notes ?? cur.notes ?? '', req.params.itemId);
  db.prepare('UPDATE quotations SET updated_at=? WHERE id=?').run(now(), req.params.id);
  res.json({ ok: true });
});
api.put('/quotations/:id/items/:itemId/design', (req, res) => {
  const it = db.prepare('SELECT * FROM quotation_items WHERE id=? AND quotation_id=?').get(req.params.itemId, req.params.id);
  if (!it) return res.status(404).json({ error: 'Not found' });
  const { design, width, height, qty, name, type, mesh, glass } = req.body;
  db.prepare('UPDATE quotation_items SET design=?, width=?, height=?, qty=?, name=?, type=?, mesh=?, glass=?, rate=NULL WHERE id=?').run(JSON.stringify(design || {}), width ?? it.width, height ?? it.height, qty ?? it.qty, name ?? it.name, type ?? it.type, mesh ?? it.mesh, glass ?? it.glass, it.id);
  const n = db.prepare('SELECT * FROM quotation_items WHERE id=?').get(it.id);
  res.json({ item: { ...n, ...itemPrice(n) }, engine: fullEngine(n) });
});
api.post('/quotations/:id/items/:itemId/preview', (req, res) => {
  const it = db.prepare('SELECT * FROM quotation_items WHERE id=? AND quotation_id=?').get(req.params.itemId, req.params.id);
  if (!it) return res.status(404).json({ error: 'Not found' });
  const b = req.body, n = { ...it, design: JSON.stringify(b.design || {}), width: b.width ?? it.width, height: b.height ?? it.height, glass: b.glass ?? it.glass, qty: b.qty ?? it.qty };
  res.json({ item: { ...n, ...itemPrice({ ...n, rate: null }) }, engine: fullEngine(n) });
});
api.get('/quotations/:id/items/:itemId/dxf', async (req, res) => {
  const it = db.prepare('SELECT * FROM quotation_items WHERE id=? AND quotation_id=?').get(req.params.itemId, req.params.id);
  if (!it) return res.status(404).json({ error: 'Not found' });
  let design = it.design; try { if (typeof design === 'string') design = JSON.parse(design); } catch (e) { design = null; }
  if (!design || !design.kind) design = { kind: 'sliding', panels: 2 };
  const { buildDxf } = await import('./dxf.mjs');
  const dxf = buildDxf({ mark: it.mark, name: it.name, width: it.width, height: it.height, design, glass: it.glass });
  res.set({ 'Content-Type': 'application/dxf', 'Content-Disposition': `attachment; filename="${String(it.mark || 'window').replace(/[^\w.-]/g, '_')}.dxf"` }).send(dxf);
});
api.get('/quotations/:id/items/:itemId/engine', (req, res) => {
  const it = db.prepare('SELECT * FROM quotation_items WHERE id=?').get(req.params.itemId);
  if (!it) return res.status(404).json({ error: 'Not found' });
  const e = fullEngine(it);
  res.json({ item: { ...it, ...itemPrice(it) }, engine: e });
});
const nextMark = (items, src) => { const pre = String(src.mark || 'W').replace(/\d+$/, '') || 'W', re = new RegExp('^' + pre.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(\\d+)$', 'i'); return pre + (Math.max(0, ...items.map(x => { const m = re.exec(x.mark || ''); return m ? +m[1] : 0 })) + 1) };
api.post('/quotations/:id/items/:itemId/copy', (req, res) => {
  const i = db.prepare('SELECT * FROM quotation_items WHERE id=?').get(req.params.itemId);
  const pos = db.prepare('SELECT COUNT(*) c FROM quotation_items WHERE quotation_id=?').get(req.params.id).c;
  const nid = uid();
  db.prepare('INSERT INTO quotation_items (id,quotation_id,mark,name,system,width,height,type,qty,glass,thickness,mesh,position,rate,design,location,notes) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(nid, i.quotation_id, nextMark(db.prepare('SELECT mark FROM quotation_items WHERE quotation_id=?').all(i.quotation_id), i), i.name, i.system, i.width, i.height, i.type, i.qty, i.glass, i.thickness, i.mesh, pos, i.rate, i.design, i.location || '', i.notes || '');
  db.prepare('UPDATE quotations SET updated_at=? WHERE id=?').run(now(), req.params.id);
  res.json({ ok: true, id: nid });
});
api.delete('/quotations/:id/items/:itemId', (req, res) => {
  db.prepare('DELETE FROM quotation_items WHERE id=?').run(req.params.itemId);
  res.json({ ok: true });
});
try { db.exec('ALTER TABLE quotation_items ADD COLUMN location TEXT') } catch (e) {} try { db.exec('ALTER TABLE quotation_items ADD COLUMN notes TEXT') } catch (e) {}
const docs = require('./docs');
const MIME = { pdf: 'application/pdf', xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const send = (res, buf, type, name) => { res.setHeader('Content-Type', type); res.setHeader('Content-Disposition', `attachment; filename="${name}"`); res.end(buf); };
const glassMeta = name => { const g = db.prepare('SELECT rate FROM glass WHERE name=?').get(name); return g && g.rate ? g.rate : null; };
const docCtx = (q, cust) => { const sv = k => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); if (!r) return ''; try { return JSON.parse(r.value) } catch (e) { return r.value } };
  const comm = getComm(q.id), pays = sv('payment_terms'), days = +sv('validity_days') || 30, iso = (q.created_at || '').slice(0, 10), pay = comm.payment === 'custom' ? comm.custom_payment : ((Array.isArray(pays) ? pays : []).find(x => x.name === comm.payment) || {}).terms;
  return { id: q.id, number: q.number, status: q.status, project: q.project, site: q.site_address, date: docs.quoteDate(q.created_at), validDays: days, validUntil: docs.addDays(iso, days), printed: docs.quoteDate(new Date().toISOString()), customer: { name: cust.name, address: cust.address, phone: cust.phone, email: cust.email }, company: sv('company') || {}, intro: sv('intro'), terms: sv('terms'), warranty: sv('warranty'), exclusions: sv('exclusions'), payment: pay || '' }; };
const sendDoc = async (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).end();
  const cust = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id) || {};
  const lang = String(req.query.lang || 'en'), fmt = String(req.query.format || 'pdf');
  const terms = (db.prepare("SELECT value FROM settings WHERE key='terms'").get() || {}).value || '';
  const m = docs.model(q, cust, quoteTotals(q.id), terms, lang);
  const sv = k => { const r = db.prepare('SELECT value FROM settings WHERE key=?').get(k); if (!r) return ''; try { return JSON.parse(r.value) } catch (e) { return r.value } };
  const tot = quoteTotals(q.id);
  m.extra = { company: sv('company') || {}, intro: sv('intro'), warranty: sv('warranty'), exclusions: sv('exclusions'), validity: sv('validity_days'), payment: sv('payment_terms'), date: (q.created_at || '').slice(0, 10), site: q.site_address || '',
    cust: { name: cust.name, address: cust.address, phone: cust.phone, email: cust.email },
    items: db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY position').all(q.id).map(it => { let d = {}; try { d = designOf(it) || {} } catch (e) {} return { type: it.type, d: { kind: d.kind, panels: d.panels, centre: d.centre, mesh: d.mesh, door: d.door, bay: d.bay, cols: d.cols }, w: it.width, h: it.height } }) };
  try { if (fmt === 'xlsx') send(res, await docs.xlsx(m), MIME.xlsx, m.number + '.xlsx'); else if (fmt === 'docx') send(res, await docs.docx(m), MIME.docx, m.number + '.docx'); else { const ents = quoteEntries(q.id), V = qcalc.quoteView(q, cust, ents, tot, getComm(q.id), {}, {}); send(res, await docs.quotationPdf(docCtx(q, cust), V, lang), MIME.pdf, m.number + '.pdf'); } }
  catch (e) { if (!res.headersSent) res.status(500).json({ error: e.message }); }
};
api.get('/quotations/:id/pdf', sendDoc);
api.get('/quotations/:id/download', sendDoc);
// ---- quotation tabs: Pricing (costing), Inventory (material balance), Documents ----
const qcalc = require('./qcalc');
const hwMeta = name => { const n = String(name || '').replace(/\s*\[.*\]$/, ''); const r = db.prepare('SELECT id, code, brand, unit, stock FROM hardware WHERE deleted=0 AND (name=? OR name LIKE ?) LIMIT 1').get(n, n + '%'); return r ? { id: r.id, code: r.code, brand: r.brand === 'Generic' ? 'Generic Hardware' : r.brand, unit: r.unit || 'pc', stock: r.stock || 0 } : null; };
function quoteEntries(qid) { return db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY position').all(qid).map(it => { let e = null; try { e = fullEngine(it); } catch (err) {} return { it: { ...it, ...itemPrice(it), d: dSketch(it), finish: dSketch(it).finish }, e }; }); }
const dSketch = it => { let d = {}; try { d = designOf(it) || {}; } catch (e) {} return { kind: d.kind, panels: d.panels, centre: d.centre, mesh: d.mesh, door: d.door, bay: d.bay, cols: d.cols, widths: d.widths, series: d.series, finish: (d.colour && d.colour.Window) || 'White' }; };
api.get('/quotations/:id/costing', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).json({ error: 'Not found' });
  const tot = quoteTotals(q.id), comm = getComm(q.id), p = prcQ(q.id), ents = quoteEntries(q.id), base = prc();
  res.json({ comm, rates: { white_rate: p.white_rate, gi_rate: p.gi_rate || 100, defaults: { white_rate: base.white_rate, gi_rate: base.gi_rate || 100 } }, costing: qcalc.costing(ents, p, comm, tot), totals: { subtotal: tot.subtotal, total: tot.total, cgst: tot.cgst, sgst: tot.sgst },
    items: ents.map(({ it, e }) => ({ id: it.id, mark: it.mark, name: it.name, system: it.system, type: it.type, mesh: it.mesh, design: (() => { try { return designOf(it); } catch (err) { return null; } })(), width: it.width, height: it.height, qty: it.qty, glass: it.glass, area: it.area, each: it.each, perSqft: it.area ? +(it.each / it.area).toFixed(2) : 0, engine: e && { rows: e.rows, labour: e.labour, materialTotal: e.materialTotal, totalCost: e.totalCost, profit: e.profit, profitLabel: e.profitLabel, unit: e.unit, cuts: (e.cuts || []).map(c => ({ role: c.role, code: c.code, name: c.name, lens: c.lens, kg: c.kg })), hardware: e.hardware } })) });
});
api.put('/quotations/:id/commercial', (req, res) => {
  const q = db.prepare('SELECT id,status FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.status !== 'draft') return res.status(409).json({ error: 'Rates are locked because this quotation is no longer a draft.' });
  const c = getComm(q.id), b = req.body || {}, num = v => Math.max(0, +v || 0);
  ['discount', 'transport', 'loading', 'unloading'].forEach(k => { if (k in b) c[k] = num(b[k]); });
  ['show_discount', 'show_gst', 'hide_sqft'].forEach(k => { if (k in b) c[k] = b[k] ? 1 : 0; });
  ['payment', 'custom_payment', 'notes'].forEach(k => { if (k in b) c[k] = String(b[k] || ''); });
  if (b.rates) { c.rates = { ...c.rates }; ['white_rate', 'gi_rate', 'profile_wastage', 'ri_wastage', 'glass_wastage', 'fab_labour', 'install_labour', 'install_material', 'profit'].forEach(k => { if (k in b.rates) { if (b.rates[k] === null || b.rates[k] === '') delete c.rates[k]; else c.rates[k] = num(b.rates[k]); } }); }
  if (b.reset_rates) c.rates = {};
  setComm(q.id, c); db.prepare('UPDATE quotations SET updated_at=? WHERE id=?').run(now(), q.id); res.json({ ok: true, comm: c });
});
api.get('/quotations/:id/materials', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).json({ error: 'Not found' });
  const comm = getComm(q.id); res.json({ ...qcalc.materials(quoteEntries(q.id), hwMeta, comm.install), install: comm.install });
});
api.put('/quotations/:id/install-materials', (req, res) => { const c = getComm(req.params.id); c.install = (req.body.items || []).filter(x => x && x.name).map(x => ({ name: String(x.name), qty: +x.qty || 0, unit: x.unit || 'pc' })); setComm(req.params.id, c); res.json({ ok: true }); });
const trackData = q => {
  const wo = db.prepare('SELECT * FROM work_orders WHERE quotation_id=?').get(q.id), D = qcalc.report(quoteEntries(q.id), prcQ(q.id), getComm(q.id), quoteTotals(q.id), { hw: hwMeta, glass: glassMeta });
  const items = db.prepare('SELECT id, mark FROM quotation_items WHERE quotation_id=?').all(q.id), markOf = Object.fromEntries(items.map(i => [i.id, i.mark]));
  const ents = wo ? db.prepare('SELECT e.item_id, e.stage FROM swo_items e JOIN sub_work_orders s ON s.id=e.swo_id WHERE s.wo_id=?').all(wo.id) : [], done = st => st === 'packed' || st === 'dispatched', counts = {};
  ents.forEach(e => { const m = markOf[e.item_id]; if (!m) return; const c = counts[m] = counts[m] || { entered: 0, completed: 0, dispatched: 0 }; c.entered++; if (done(e.stage)) c.completed++; if (e.stage === 'dispatched') c.dispatched++; });
  return { number: q.number, updated: now(), ...qcalc.tracking(D, counts, wo ? { id: wo.id, number: wo.number } : null) };
};
api.get('/quotations/:id/tracking', (req, res) => { const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).json({ error: 'Not found' }); res.json(trackData(q)); });
api.get('/quotations/:id/doc/:kind', async (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id); if (!q) return res.status(404).end();
  const fmt = ['xlsx', 'docx'].includes(req.query.format) ? req.query.format : 'pdf'; let kind = req.params.kind; const cust0 = 0, cust = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id) || {};
  try {
    const c = docCtx(q, cust), ents = quoteEntries(q.id), tot = quoteTotals(q.id), D = qcalc.report(ents, prcQ(q.id), getComm(q.id), tot, { hw: hwMeta, glass: glassMeta });
    if (kind === 'elevation' || (kind === 'shopdrawing' && req.query.format !== 'dxf')) { const items = ents.map(({ it }) => ({ mark: it.mark, name: it.name, w: it.width, h: it.height, qty: it.qty, glass: it.glass, hasMesh: it.mesh && it.mesh !== 'No mesh', finish: it.finish, location: it.location, d: it.d }));
      return send(res, await docs.elevationPdf(c, items, D.notes), MIME.pdf, q.number + '-elevation.pdf'); }
    if (kind === 'shopdrawing' && req.query.format === 'dxf') { const { buildDxf } = await import('./dxf.mjs'); let oy = 0, head = null, tail = null, body = [];
      for (const { it } of ents) { const d = it.d && it.d.kind ? it.d : { kind: 'sliding', panels: 2 };
        const L = buildDxf({ mark: it.mark, name: it.name, width: it.width, height: it.height, design: d, glass: it.glass }).split('\n'), a = L.findIndex((x, i) => x.trim() === 'ENTITIES' && L[i - 1] && L[i - 1].trim() === '2'), b = L.lastIndexOf('ENDSEC') >= 0 ? L.lastIndexOf('ENDSEC') : L.length;
        if (a < 0) continue; if (!head) { head = L.slice(0, a + 1); tail = L.slice(b - 1) }
        const seg = L.slice(a + 1, b - 1); for (let i = 0; i + 1 < seg.length; i += 2) if (['20', '21'].includes(seg[i].trim())) seg[i + 1] = String(+seg[i + 1] + oy); body.push(...seg); oy -= (+it.height + 800) }
      return send(res, Buffer.from([...(head || []), ...body, ...(tail || [])].join('\n')), 'application/dxf', `${q.number}-shop-drawing.dxf`); }
    if (kind === 'shopdrawing') kind = 'elevation';
    if (kind === 'tracking') return send(res, await docs.reportDoc('tracking', 'pdf', c, trackData(q)), MIME.pdf, `${q.number}-tracking.pdf`);
    if ((kind === 'costing' || kind === 'materials') && req.query.format === 'json') return res.json(docs.previewData(kind, c, D));
    if (kind === 'costing' || kind === 'materials') return send(res, await docs.reportDoc(kind, fmt, c, D), MIME[fmt], `${q.number}-${kind}.${fmt}`);
    res.status(404).json({ error: 'Unknown document' });
  } catch (e) { res.status(500).json({ error: e.message }); }
});


require('./crm')(api, db, { uid, now, quoteTotals });
require('./windload')(api, db, { quoteEntries, docs, uid, now });

// production — work orders, sub work orders, shop-floor entries
db.exec(`CREATE TABLE IF NOT EXISTS sub_work_orders (id TEXT PRIMARY KEY, wo_id TEXT, number TEXT, notes TEXT DEFAULT '', status TEXT DEFAULT 'draft', created_at TEXT);
CREATE TABLE IF NOT EXISTS swo_items (id TEXT PRIMARY KEY, swo_id TEXT, item_id TEXT, location TEXT DEFAULT '', stage TEXT DEFAULT 'cutting', created_at TEXT);`);
try { db.exec('ALTER TABLE swo_items ADD COLUMN qc INTEGER DEFAULT 0') } catch (e) {}
const STAGES = ['cutting', 'machining', 'assembly', 'glazing', 'qc', 'packed', 'dispatched'];
const isDone = st => st === 'packed' || st === 'dispatched';
function woSeed() {
  const wo = db.prepare("SELECT * FROM work_orders WHERE number='WO-2026-001'").get();
  if (!wo || db.prepare('SELECT 1 FROM sub_work_orders WHERE wo_id=?').get(wo.id)) return;
  const its = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=?').all(wo.quotation_id);
  const by = m => its.find(i => i.mark.toLowerCase() === m);
  const s1 = uid(), s2 = uid(), add = db.prepare('INSERT INTO swo_items (id,swo_id,item_id,location,stage,created_at) VALUES (?,?,?,?,?,?)');
  db.prepare('INSERT INTO sub_work_orders VALUES (?,?,?,?,?,?)').run(s1, wo.id, wo.number + '-S1', '', 'confirmed', now());
  db.prepare('INSERT INTO sub_work_orders VALUES (?,?,?,?,?,?)').run(s2, wo.id, wo.number + '-S2', '', 'draft', now());
  [['d1', 4], ['w2', 5], ['v1', 4]].forEach(([m, n]) => { const it = by(m); if (it) for (let i = 0; i < n; i++) add.run(uid(), s1, it.id, '', 'dispatched', now()); });
  const d1 = by('d1'); if (d1) add.run(uid(), s2, d1.id, '101/6', 'cutting', now());
}
woSeed();
function recalc(woId) {
  const ents = db.prepare('SELECT e.* FROM swo_items e JOIN sub_work_orders s ON s.id=e.swo_id WHERE s.wo_id=?').all(woId);
  const done = ents.filter(e => isDone(e.stage)).length, inp = ents.length - done;
  const open = ents.filter(e => !isDone(e.stage)).map(e => STAGES.indexOf(e.stage));
  const stage = open.length ? STAGES[Math.min(...open)] : (ents.length ? 'completed' : 'cutting');
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
  let status = w.status;
  if (status !== 'draft' && ents.length) status = done === w.total ? (ents.every(e => e.stage === 'dispatched') ? 'dispatched' : 'production_complete') : 'in_production';
  db.prepare('UPDATE work_orders SET done=?, in_process=?, stage=?, status=? WHERE id=?').run(done, inp, stage, status, woId);
}
function subStatus(s) {
  if (s.status === 'draft') return 'draft';
  const e = db.prepare('SELECT stage FROM swo_items WHERE swo_id=?').all(s.id);
  if (!e.length) return 'confirmed';
  if (e.every(x => x.stage === 'dispatched')) return 'dispatched';
  if (e.every(x => isDone(x.stage))) return 'production_complete';
  return 'in_production';
}
function designRows(woId, swoId) {
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(woId);
  const its = db.prepare('SELECT * FROM quotation_items WHERE quotation_id=? ORDER BY position').all(w.quotation_id);
  const ents = db.prepare('SELECT e.*, s.status AS sstatus FROM swo_items e JOIN sub_work_orders s ON s.id=e.swo_id WHERE s.wo_id=?').all(woId);
  return its.map(i => {
    const mine = ents.filter(e => e.item_id === i.id), done = mine.filter(e => isDone(e.stage)).length;
    const row = { id: i.id, mark: i.mark, name: i.name, system: i.system, type: i.type, width: i.width, height: i.height, glass: i.glass, thickness: i.thickness, mesh: i.mesh, design: i.design, quoted: i.qty, in_process: mine.length - done, completed: done, balance: Math.max(0, i.qty - mine.length), dispatched: mine.filter(e => e.stage === 'dispatched').length, sqft: +(i.width * i.height / 92903.04).toFixed(2) };
    if (swoId) row.entered_here = mine.filter(e => e.swo_id === swoId).length;
    return row;
  });
}
api.get('/production', (req, res) => {
  const rows = db.prepare('SELECT * FROM work_orders ORDER BY created_at DESC').all().map(w => {
    const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id);
    const c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
    return { ...w, quotation_number: q.number, project: q.project, customer: c && c.name, customer_id: q.customer_id, subs: db.prepare('SELECT COUNT(*) n FROM sub_work_orders WHERE wo_id=?').get(w.id).n, balance: Math.max(0, w.total - w.done - w.in_process) };
  });
  res.json(rows);
});
api.get('/production/report', (req, res) => {
  const ents = db.prepare('SELECT e.*, i.width, i.height, s.wo_id, w.number AS wo FROM swo_items e JOIN quotation_items i ON i.id=e.item_id JOIN sub_work_orders s ON s.id=e.swo_id JOIN work_orders w ON w.id=s.wo_id').all();
  const sq = e => e.width * e.height / 92903.04, by = {};
  ents.forEach(e => { const r = by[e.wo] = by[e.wo] || { wo: e.wo, units: 0, sqft: 0, d_units: 0, d_sqft: 0 }; if (!e.qc) return; if (isDone(e.stage)) { r.units++; r.sqft += sq(e) } if (e.stage === 'dispatched') { r.d_units++; r.d_sqft += sq(e) } });
  res.json({ rows: Object.values(by).map(r => ({ ...r, sqft: +r.sqft.toFixed(2), d_sqft: +r.d_sqft.toFixed(2) })), work_orders: db.prepare('SELECT number FROM work_orders').all().map(x => x.number) });
});

// sub work order production documents (9 lists, like the demo)
const SUB_DOCS = ['Glass cutting list', 'Profile cutting list', 'Reinforcement cutting list', 'Hardware list', 'Complete production document', 'QC checklist', 'Installation list', 'Window supply schedule', 'Window area report'];

db.exec(`CREATE TABLE IF NOT EXISTS qc_records (id TEXT PRIMARY KEY, swo_id TEXT, entry_id TEXT, label TEXT, stage TEXT, checks TEXT, passed INTEGER, created_at TEXT)`);
api.get('/production/subs/:sid/qc', (req, res) => res.json(db.prepare('SELECT * FROM qc_records WHERE swo_id=? ORDER BY created_at DESC').all(req.params.sid).map(r => ({ ...r, checks: JSON.parse(r.checks || '[]') }))));
api.post('/production/subs/:sid/qc', (req, res) => {
  const { entry, stage, checks } = req.body || {}, sid = req.params.sid, all = db.prepare('SELECT e.*, i.mark FROM swo_items e JOIN quotation_items i ON i.id=e.item_id WHERE e.swo_id=?').all(sid);
  const targets = entry && entry !== 'all' ? all.filter(e => e.id === entry) : all; if (!targets.length) return res.status(400).json({ error: 'Choose a window' });
  const list = Array.isArray(checks) ? checks : [], passed = list.length >= 6 ? 1 : 0, ins = db.prepare('INSERT INTO qc_records VALUES (?,?,?,?,?,?,?,?)');
  db.transaction(() => targets.forEach(e => { ins.run(uid(), sid, e.id, e.mark + (e.location ? ' · ' + e.location : ''), stage || 'post-fabrication', JSON.stringify(list), passed, now()); if (passed && (stage || 'post-fabrication') === 'post-fabrication') db.prepare('UPDATE swo_items SET qc=1 WHERE id=?').run(e.id) }))();
  res.json({ ok: true, recorded: targets.length, passed: !!passed });
});
api.get('/production/subs/:sid/stock', (req, res) => {
  const sw = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); if (!sw) return res.status(404).end();
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(sw.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id);
  const cnt = {}; db.prepare('SELECT item_id FROM swo_items WHERE swo_id=?').all(sw.id).forEach(e => { cnt[e.item_id] = (cnt[e.item_id] || 0) + 1 });
  const qe = quoteEntries(q.id).filter(x => cnt[x.it.id]).map(x => ({ ...x, it: { ...x.it, qty: cnt[x.it.id] } }));
  const D = qcalc.report(qe, prcQ(q.id), getComm(q.id), quoteTotals(q.id), { hw: hwMeta, glass: glassMeta });
  const rows = D.hwLines.filter(h => h.w.length).map(h => { const m = hwMeta(h.name.replace(/\s*\[.*\]$/, '')) || {}; const present = +m.stock || 0; return { id: m.id || null, name: h.name.replace(/\s*\[.*\]$/, ''), code: m.code || '', unit: h.unit || 'pc', required: +h.qty.toFixed(3), present, balance: Math.max(0, +(h.qty - present).toFixed(3)), group: /SCREW|CAP|PACKER|GASKET|SEAL|FASTNER|SILICON/i.test(h.name) ? 'Accessories and Installation Material' : (m.brand || 'Generic Hardware') } });
  res.json({ rows, required: rows.length, supplied: rows.filter(r => r.present >= r.required).length, toProcure: rows.filter(r => r.balance > 0).length, complete: sw.status === 'dispatched' || ['production_complete'].includes(sw.status) });
});
const GROUPS = { 'Block': e => (String(e.location || '').split('/')[0].trim() || '-'), 'Flat (within block)': e => (String(e.location || '').trim() || '-'), 'Similar windows': e => `${e.type || 'Window'} · ${e.width} x ${e.height}` };
// QC / supply / area registers, optionally grouped (Block, Flat, Similar windows) like the demo's "Group by" switch
function regRows(kind, ents, g, withSub) {
  const key = GROUPS[g], sq = e => +(e.width * e.height / 92903.04).toFixed(2), loc = e => e.location || '-';
  const sorted = key ? [...ents].sort((a, b) => key(a).localeCompare(key(b), undefined, { numeric: true })) : ents, out = []; let last = null, n = 0;
  const width = { qc: withSub ? 8 : 7, supply: 6, area: 5 }[kind];
  const head = k => out.push([`▸ ${g}: ${k}`, ...Array(width - 1).fill('')]);
  if (kind === 'area') { const by = {}; sorted.forEach(e => { const k = key ? key(e) : ''; const r = (by[k] = by[k] || {})[e.mark] = (by[k] || {})[e.mark] || [e.mark, e.name, 0, sq(e), 0]; r[2]++; r[4] = +(r[4] + sq(e)).toFixed(2) });
    Object.keys(by).forEach(k => { if (key) head(k); Object.values(by[k]).forEach(r => out.push(r)); if (key) out.push(['Subtotal', '', Object.values(by[k]).reduce((a, r) => a + r[2], 0), '', +Object.values(by[k]).reduce((a, r) => a + r[4], 0).toFixed(2)]) }); return out }
  sorted.forEach(e => { const k = key ? key(e) : null; if (key && k !== last) { head(k); last = k } n++;
    if (kind === 'qc') out.push(withSub ? [n, e.mark + ' ' + e.name, loc(e), `${e.width} x ${e.height}`, `${e.glass} ${e.thickness}`, e.stage, (e.sub || '').slice(-2), e.qc ? 'Passed' : '[  ]'] : [n, e.mark + ' ' + e.name, loc(e), `${e.width} x ${e.height}`, `${e.glass} ${e.thickness}`, e.stage, e.qc ? 'Passed' : '☐']);
    else out.push([n, e.mark, e.type, `${e.width} x ${e.height}`, `${e.system} / ${e.glass}`, loc(e)]) });
  return out;
}
const prodTables = (ents, q, g) => {
  const cnt = {}; ents.forEach(e => { cnt[e.item_id] = (cnt[e.item_id] || 0) + 1 });
  const qe = quoteEntries(q.id).filter(x => cnt[x.it.id]).map(x => ({ ...x, it: { ...x.it, qty: cnt[x.it.id] } }));
  const D = qcalc.report(qe, prcQ(q.id), getComm(q.id), quoteTotals(q.id), { hw: hwMeta, glass: glassMeta }), M = D.mat, f2 = v => (+v || 0).toFixed(2);
  const sq = e => +(e.width * e.height / 92903.04).toFixed(2), loc = e => e.location || '-';
  const T = [
    ['Glass cutting list', ['Glass', 'Size (mm)', 'Qty', 'Area (sq ft)', 'Windows'], M.glassReq.flatMap(k => Object.values(k.sizes).sort((a, b) => b.w * b.h - a.w * a.h).map(z => [k.spec, `${z.w} x ${z.h}`, z.qty, f2(z.w * z.h / 92903.04 * z.qty), [...new Set(z.win || [])].join(', ')])).concat(M.glassReq.map(k => [k.spec + ' — total', '', k.pieces, f2(k.sqft), '']))],
    ['Profile cutting list', ['Code', 'Profile', 'Pieces', 'Length (m)', 'Bars', 'Windows'], M.bars.map(b => [b.code, b.name, b.pieces, f2(b.m), b.bars, ((D.profileLines.find(x => x.code === b.code) || {}).w || []).join(', ')])],
    ['Reinforcement cutting list', ['Host profile', 'Thickness (mm)', 'Pieces', 'Length (m)', 'Bars'], M.riBars.map(b => [b.host, b.thk, b.pieces, f2(b.m), b.bars])],
    ['Hardware list', ['Item', 'Qty', 'Unit', 'Windows'], D.hwLines.filter(h => h.w.length).map(h => [h.name, h.qty, h.unit, h.w.join(', ')])],
    ['Complete production document', ['Window', 'Description', 'Size (mm)', 'Qty', 'Area (sq ft)', 'Glass', 'System'], D.items.map(i => { const it = ents.find(e => e.mark === i.mark) || {}; return [i.mark, i.name, `${i.w} x ${i.h}`, i.qty, f2(i.area), it.glass || '', it.system || ''] })],
    ['QC checklist', ['No.', 'Window', 'Location', 'Frame size (mm)', 'Glass', 'Stage', 'QC'], ents.map((e, k) => [k + 1, e.mark + ' ' + e.name, loc(e), `${e.width} x ${e.height}`, `${e.glass} ${e.thickness}`, e.stage, e.qc ? 'Passed' : '☐'])],
    ['Installation list', ['No.', 'Window', 'Location', 'Size (mm)', 'Materials to carry', 'Installed'], ents.map((e, k) => [k + 1, e.mark, loc(e), `${e.width} x ${e.height}`, `${e.system} · ${e.glass} · fixing screws, sealant`, '☐'])],
    ['Window supply schedule', ['No.', 'Code', 'Type', 'Outer frame (mm)', 'Specification', 'Location'], ents.map((e, k) => [k + 1, e.mark, e.type, `${e.width} x ${e.height}`, `${e.system} / ${e.glass}`, loc(e)])],
    ['Window area report', ['Window', 'Description', 'Qty', 'Area each (sq ft)', 'Total area (sq ft)'], Object.values(ents.reduce((a, e) => { const r = a[e.mark] = a[e.mark] || [e.mark, e.name, 0, sq(e), 0]; r[2]++; r[4] = +(r[4] + sq(e)).toFixed(2); return a }, {}))]
  ];
  if (g && GROUPS[g]) { T[5][2] = regRows('qc', ents, g, false); T[7][2] = regRows('supply', ents, g); T[8][2] = regRows('area', ents, g) }
  return T;
};
api.get('/production/subs/:sid/docs/:n', async (req, res) => {
  const sw = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); if (!sw) return res.status(404).end();
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(sw.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id);
  const n = Math.min(9, Math.max(1, +req.params.n || 1)), fmt = ['pdf', 'xlsx', 'docx'].includes(req.query.format) ? req.query.format : 'pdf';
  try {
    const ents = db.prepare('SELECT e.*, i.mark, i.name, i.width, i.height, i.glass, i.thickness, i.system, i.type FROM swo_items e JOIN quotation_items i ON i.id=e.item_id WHERE e.swo_id=? ORDER BY i.position, e.created_at').all(sw.id);
    if (n === 5) return send(res, await docs.multi(fmt, 'Complete production document', sw.number, prodTables(ents, q, req.query.group).filter((_, i) => i !== 4)), MIME[fmt], `${sw.number}-complete-production-document.${fmt}`);
    const [title, head, rows] = prodTables(ents, q, req.query.group)[n - 1];
    send(res, await docs.table(fmt, title, head, rows.length ? rows : [['No entries', ...head.slice(1).map(() => '')]], sw.number), MIME[fmt], `${sw.number}-${title.replace(/\s+/g, '-').toLowerCase()}.${fmt}`);
  } catch (e) { res.status(500).json({ error: e.message }); }
});
api.get('/production/:id/docs/:n', async (req, res) => {
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id); if (!w) return res.status(404).end();
  const n = +req.params.n || 1, fmt = ['pdf', 'xlsx', 'docx'].includes(req.query.format) ? req.query.format : 'pdf';
  if (n === 4) { try { const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), all = db.prepare('SELECT e.*, i.mark, i.name, i.width, i.height, i.glass, i.thickness, i.system, i.type FROM swo_items e JOIN quotation_items i ON i.id=e.item_id JOIN sub_work_orders s ON s.id=e.swo_id WHERE s.wo_id=? ORDER BY i.position, e.created_at').all(w.id);
    if (!all.length) return res.status(409).json({ error: 'Work order has no saved items' });
    return send(res, await docs.multi(fmt, 'Complete production document', w.number, prodTables(all, q, req.query.group).filter((_, i) => i !== 4)), MIME[fmt], `${w.number}-complete-production-document.${fmt}`); } catch (e) { return res.status(500).json({ error: e.message }) } }
  const ents = db.prepare('SELECT e.*, i.mark, i.name, i.width, i.height, i.glass, i.thickness, i.system, i.type, s.number AS sub FROM swo_items e JOIN quotation_items i ON i.id=e.item_id JOIN sub_work_orders s ON s.id=e.swo_id WHERE s.wo_id=? ORDER BY i.position, e.created_at').all(w.id);
  const sq = e => +(e.width * e.height / 92903.04).toFixed(2);
  const T = [
    ['QC checklist', ['No.', 'Window', 'Location', 'Frame size (mm)', 'Glass', 'Stage', 'Sub work order', 'QC'], ents.map((e, k) => [k + 1, e.mark + ' ' + e.name, e.location || '-', `${e.width} x ${e.height}`, `${e.glass} ${e.thickness}`, e.stage, e.sub.slice(-2), '[  ]'])],
    ['Window supply schedule', ['No.', 'Code', 'Type', 'Outer frame (mm)', 'Specification', 'Location'], ents.map((e, k) => [k + 1, e.mark, e.type, `${e.width} x ${e.height}`, `${e.system} / ${e.glass}`, e.location || '-'])],
    ['Window area report', ['Window', 'Description', 'Qty', 'Area each (sq ft)', 'Total area (sq ft)'], Object.values(ents.reduce((a, e) => { const r = a[e.mark] = a[e.mark] || [e.mark, e.name, 0, sq(e), 0]; r[2]++; r[4] = +(r[4] + sq(e)).toFixed(2); return a }, {}))],
  ][Math.min(2, Math.max(0, n - 1))];
  const [title, head] = T, g = req.query.group, rows = g && GROUPS[g] ? regRows(['qc', 'supply', 'area'][Math.min(2, Math.max(0, n - 1))], ents, g, true) : T[2], fname = `${w.number}-${title.replace(/\s+/g, '-').toLowerCase()}`;
  try { send(res, await docs.table(fmt, title, head, rows, w.number), MIME[fmt], `${fname}.${fmt}`); } catch (e) { res.status(500).json({ error: e.message }); }
});
require('./prodpro')(api, db, { quoteEntries, docs, uid, now, send, MIME });
api.get('/production/subs/:sid', (req, res) => {
  const s = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); if (!s) return res.status(404).json({ error: 'Not found' });
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(s.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
  const entries = db.prepare('SELECT e.*, i.mark, i.name, i.width, i.height FROM swo_items e JOIN quotation_items i ON i.id=e.item_id WHERE e.swo_id=? ORDER BY e.created_at').all(s.id);
  res.json({ ...s, status: subStatus(s), wo: { id: w.id, number: w.number, total: w.total, done: w.done, in_process: w.in_process, balance: Math.max(0, w.total - w.done - w.in_process) }, quotation: { id: q.id, number: q.number }, customer: c && c.name, project: q.project, designs: designRows(w.id, s.id), entries, stages: STAGES });
});
api.post('/production/subs/:sid/confirm', (req, res) => { db.prepare("UPDATE sub_work_orders SET status='confirmed' WHERE id=? AND status='draft'").run(req.params.sid); const s = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); recalc(s.wo_id); res.json({ ok: true }); });
api.put('/production/subs/:sid', (req, res) => { db.prepare('UPDATE sub_work_orders SET notes=COALESCE(?,notes) WHERE id=?').run(req.body.notes ?? null, req.params.sid); res.json({ ok: true }); });
api.delete('/production/subs/:sid', (req, res) => {
  const s = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); if (!s) return res.json({ ok: true });
  if (s.status !== 'draft') return res.status(400).json({ error: 'Only draft sub work orders can be deleted' });
  db.prepare('DELETE FROM swo_items WHERE swo_id=?').run(s.id); db.prepare('DELETE FROM sub_work_orders WHERE id=?').run(s.id); recalc(s.wo_id); res.json({ ok: true });
});
api.post('/production/subs/:sid/entries', (req, res) => {
  const s = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); const { item_id, qty = 1, location = '' } = req.body;
  const d = designRows(s.wo_id, s.id).find(x => x.id === item_id); if (!d) return res.status(400).json({ error: 'Unknown design' });
  const n = Math.min(Math.max(1, +qty || 1), d.balance); if (!d.balance) return res.status(400).json({ error: 'Nothing left to enter for this design' });
  const add = db.prepare('INSERT INTO swo_items (id,swo_id,item_id,location,stage,created_at) VALUES (?,?,?,?,?,?)'); for (let i = 0; i < n; i++) add.run(uid(), s.id, item_id, location, 'cutting', now());
  recalc(s.wo_id); res.json({ ok: true, added: n });
});
api.put('/production/entries/:eid', (req, res) => {
  const e = db.prepare('SELECT e.*, s.wo_id FROM swo_items e JOIN sub_work_orders s ON s.id=e.swo_id WHERE e.id=?').get(req.params.eid); if (!e) return res.status(404).json({ error: 'Not found' });
  if (req.body.stage && STAGES.includes(req.body.stage)) db.prepare('UPDATE swo_items SET stage=? WHERE id=?').run(req.body.stage, e.id); if (['qc', 'packed', 'dispatched'].includes(req.body.stage)) db.prepare('UPDATE swo_items SET qc=1 WHERE id=?').run(e.id);
  if (req.body.location != null) db.prepare('UPDATE swo_items SET location=? WHERE id=?').run(req.body.location, e.id);
  recalc(e.wo_id); res.json({ ok: true });
});
api.delete('/production/entries/:eid', (req, res) => { const e = db.prepare('SELECT e.*, s.wo_id FROM swo_items e JOIN sub_work_orders s ON s.id=e.swo_id WHERE e.id=?').get(req.params.eid); if (e) { db.prepare('DELETE FROM swo_items WHERE id=?').run(e.id); recalc(e.wo_id) } res.json({ ok: true }); });
api.get('/production/:id', (req, res) => {
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id);
  if (!w) return res.status(404).json({ error: 'Not found' });
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
  const designs = designRows(w.id);
  const subs = db.prepare('SELECT * FROM sub_work_orders WHERE wo_id=? ORDER BY number').all(w.id).map(s => {
    const e = db.prepare('SELECT stage FROM swo_items WHERE swo_id=?').all(s.id), d = e.filter(x => isDone(x.stage)).length;
    return { id: s.id, number: s.number, notes: s.notes, windows: e.length, in_process: e.length - d, completed: d, dispatched: e.filter(x => x.stage === 'dispatched').length, status: subStatus(s) };
  });
  res.json({ ...w, balance: Math.max(0, w.total - w.done - w.in_process), quotation: { id: q.id, number: q.number }, project: q.project, customer: c && c.name, customer_detail: c, subs, designs });
});
api.post('/production/:id/subs', (req, res) => {
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(req.params.id); const n = db.prepare('SELECT COUNT(*) n FROM sub_work_orders WHERE wo_id=?').get(w.id).n;
  const id = uid(); db.prepare('INSERT INTO sub_work_orders VALUES (?,?,?,?,?,?)').run(id, w.id, `${w.number}-S${n + 1}`, req.body.notes || '', 'draft', now()); res.json({ id });
});
api.put('/production/:id', (req, res) => { res.json({ ok: true }); });

// invoices
['seller', 'customer_gst', 'invoice_date', 'reference', 'vehicle', 'driver', 'driver_phone', 'items', 'gst_rate', 'cgst', 'sgst', 'igst', 'total', 'taxable', 'sub_id', 'round_off'].forEach(c => { try { db.exec(`ALTER TABLE invoices ADD COLUMN ${c} ${/rate|cgst|sgst|igst|total|taxable|round_off/.test(c) ? 'REAL' : 'TEXT'}`) } catch (e) {} });
const invRow = r => ({ ...r, items: r.items ? JSON.parse(r.items) : [], taxable: r.taxable ?? r.amount, total: r.total ?? +(r.amount + r.gst).toFixed(2) });
api.get('/invoices', (req, res) => res.json(db.prepare('SELECT i.*, c.name AS customer FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at DESC').all().map(invRow)));
api.get('/invoices/export', (req, res) => {
  const rows = db.prepare('SELECT i.*, c.name AS customer FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id ORDER BY i.created_at').all().map(invRow);
  const csv = ['Invoice,Date,Customer,Due date,Taxable,GST,Total,Status', ...rows.map(r => [r.number, (r.invoice_date || r.created_at || '').slice(0, 10), `"${r.customer || ''}"`, r.due_date, r.taxable, r.gst, r.total, r.status].join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv'); res.setHeader('Content-Disposition', 'attachment; filename="invoice-register.csv"'); res.send(csv);
});
api.get('/invoices/eligible', (req, res) => {
  const used = new Set(db.prepare("SELECT sub_id FROM invoices WHERE sub_id IS NOT NULL AND status='issued'").all().map(x => x.sub_id));
  const out = db.prepare('SELECT * FROM sub_work_orders').all().filter(x => !used.has(x.id) && ['production_complete', 'dispatched'].includes(subStatus(x))).map(x => {
    const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(x.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
    return { id: x.id, number: x.number, customer: c && c.name, label: `${x.number} · ${c && c.name}` };
  });
  res.json(out);
});
api.get('/invoices/from-sub/:sid', (req, res) => {
  const sub = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(req.params.sid); if (!sub) return res.status(404).json({ error: 'Not found' });
  const w = db.prepare('SELECT * FROM work_orders WHERE id=?').get(sub.wo_id), q = db.prepare('SELECT * FROM quotations WHERE id=?').get(w.quotation_id), c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id);
  const tot = quoteTotals(q.id), each = Object.fromEntries(tot.items.map(i => [i.id, i.each]));
  const ents = db.prepare('SELECT e.*, i.mark, i.name, i.width, i.height FROM swo_items e JOIN quotation_items i ON i.id=e.item_id WHERE e.swo_id=? ORDER BY i.position, e.created_at').all(sub.id).filter(e => isDone(e.stage));
  const tax = JSON.parse((db.prepare("SELECT value FROM settings WHERE key='tax'").get() || { value: '{}' }).value);
  const billed = db.prepare("SELECT COALESCE(SUM(taxable),0) t FROM invoices i JOIN sub_work_orders s ON s.id=i.sub_id WHERE s.wo_id=? AND i.status='issued'").get(w.id).t;
  const missing = []; if (!c || !c.address) missing.push('Billing address'); if (!c || !c.state) missing.push('State');
  res.json({ sub: { id: sub.id, number: sub.number }, customer_id: q.customer_id, customer: c && c.name, missing, quotation: { id: q.id, number: q.number, value: tot.subtotal }, billed, hsn: tax.hsn_upvc || '3925',
    windows: ents.map(e => ({ code: e.mark, name: e.name, width: e.width, height: e.height, sft: +(e.width * e.height / 92903.04).toFixed(3), price: each[e.item_id] || 0 })) });
});
api.get('/invoices/:id', (req, res) => { const r = db.prepare('SELECT i.*, c.name AS customer FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.id=?').get(req.params.id); r ? res.json(invRow(r)) : res.status(404).json({ error: 'Not found' }); });
api.post('/invoices', (req, res) => {
  const b = req.body, items = Array.isArray(b.items) ? b.items : [];
  const taxable = items.length ? +items.reduce((a, x) => a + (+x.qty || 0) * (+x.price || 0), 0).toFixed(2) : +b.amount || 0;
  const rate = b.gst_rate != null ? +b.gst_rate : 18, gst = +(taxable * rate / 100).toFixed(2), exact = taxable + gst, grand = Math.round(exact), roundOff = +(grand - exact).toFixed(2);
  const co = JSON.parse((db.prepare("SELECT value FROM settings WHERE key='company'").get() || { value: '{}' }).value);
  const cu = db.prepare('SELECT * FROM customers WHERE id=?').get(b.customer_id);
  const inter = !!(cu && cu.state && co.state && String(cu.state) !== String(co.state)) && b.customer_gst === 'registered';
  const i = { id: uid(), number: nextNumber('invoices', 'INV'), customer_id: b.customer_id, amount: taxable, gst, status: 'issued', due_date: b.due_date || '', created_at: now(),
    seller: b.seller || '', customer_gst: b.customer_gst || 'unregistered', invoice_date: b.invoice_date || now().slice(0, 10), reference: b.reference || '', vehicle: b.vehicle || '', driver: b.driver || '', driver_phone: b.driver_phone || '', items: JSON.stringify(items), gst_rate: rate,
    cgst: inter ? 0 : +(gst / 2).toFixed(2), sgst: inter ? 0 : +(gst / 2).toFixed(2), igst: inter ? gst : 0, total: grand, round_off: roundOff, taxable, sub_id: b.sub_id || null };
  db.prepare('INSERT INTO invoices (id,number,customer_id,amount,gst,status,due_date,created_at,seller,customer_gst,invoice_date,reference,vehicle,driver,driver_phone,items,gst_rate,cgst,sgst,igst,total,taxable,sub_id,round_off) VALUES (@id,@number,@customer_id,@amount,@gst,@status,@due_date,@created_at,@seller,@customer_gst,@invoice_date,@reference,@vehicle,@driver,@driver_phone,@items,@gst_rate,@cgst,@sgst,@igst,@total,@taxable,@sub_id,@round_off)').run(i);
  if (b.sub_id) { const sb = db.prepare('SELECT * FROM sub_work_orders WHERE id=?').get(b.sub_id); if (sb) { db.prepare("UPDATE swo_items SET stage='dispatched', qc=1 WHERE swo_id=?").run(sb.id); db.prepare("UPDATE sub_work_orders SET status='confirmed' WHERE id=? AND status='draft'").run(sb.id); recalc(sb.wo_id) } }
  res.json(invRow(i));
});
api.post('/invoices/:id/cancel', (req, res) => { db.prepare("UPDATE invoices SET status='cancelled' WHERE id=?").run(req.params.id); res.json({ ok: true }); });
function inWords(n) {
  const a = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'], t = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = x => x < 20 ? a[x] : t[Math.floor(x / 10)] + (x % 10 ? ' ' + a[x % 10] : '');
  const three = x => (x >= 100 ? a[Math.floor(x / 100)] + ' Hundred' + (x % 100 ? ' ' : '') : '') + two(x % 100);
  let r = Math.round(n), out = [];
  [[10000000, 'Crore'], [100000, 'Lakh'], [1000, 'Thousand']].forEach(([d, l]) => { if (r >= d) { out.push(three(Math.floor(r / d)) + ' ' + l); r %= d } });
  if (r) out.push(three(r)); return (out.join(' ') || 'Zero') + ' Rupees Only';
}
api.get('/invoices/:id/pdf', async (req, res) => {
  const r = db.prepare('SELECT i.*, c.name AS customer, c.phone AS cphone, c.address AS caddress, c.state AS cstate, c.gstin AS cgstin FROM invoices i LEFT JOIN customers c ON c.id=i.customer_id WHERE i.id=?').get(req.params.id); if (!r) return res.status(404).end();
  const inv = invRow(r), co = JSON.parse((db.prepare("SELECT value FROM settings WHERE key='company'").get() || { value: '{}' }).value);
  try { send(res, await docs.invoice(inv, co, inWords), 'application/pdf', inv.number + '.pdf'); } catch (e) { res.status(500).json({ error: e.message }); }
});

// inventory
api.get('/inventory/hardware', (req, res) => {
  const { q, type, deleted } = req.query;
  let rows = db.prepare('SELECT * FROM hardware WHERE deleted=? ORDER BY name').all(deleted === '1' ? 1 : 0);
  if (type) rows = rows.filter(r => r.hardware_type === type);
  if (q) rows = rows.filter(r => (r.name + r.code + r.brand).toLowerCase().includes(q.toLowerCase()));
  res.json(rows);
});
api.get('/inventory/hardware-export', async (req, res) => {
  const wb = new (require('exceljs').Workbook)(), ws = wb.addWorksheet('Hardware');
  ws.addRow(['Product', 'Code', 'Brand', 'Window type', 'Hardware type', 'Unit', 'Default rate', 'Your rate']).font = { bold: true };
  db.prepare('SELECT * FROM hardware WHERE deleted=0 ORDER BY name').all().forEach(h => ws.addRow([h.name, h.code, h.brand, h.window_type, h.hardware_type, h.unit, h.default_rate, h.your_rate]));
  ws.columns = [{ width: 48 }, { width: 18 }, { width: 22 }, { width: 18 }, { width: 22 }, { width: 8 }, { width: 14 }, { width: 14 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', 'attachment; filename="hardware.xlsx"');
  await wb.xlsx.write(res); res.end();
});
api.post('/inventory/hardware-import', express.json({ limit: '10mb' }), async (req, res) => {
  const wb = new (require('exceljs').Workbook)(); await wb.xlsx.load(Buffer.from(String(req.body.file || ''), 'base64'));
  let added = 0, updated = 0;
  wb.worksheets[0].eachRow((r, i) => { if (i === 1) return; const v = [1, 2, 3, 4, 5, 6, 7, 8].map(c => r.getCell(c).value); if (!v[0]) return;
    const ex = db.prepare('SELECT id FROM hardware WHERE name=?').get(String(v[0]));
    if (ex) { db.prepare('UPDATE hardware SET your_rate=COALESCE(?,your_rate), default_rate=COALESCE(?,default_rate), deleted=0 WHERE id=?').run(v[7] != null ? +v[7] : null, v[6] != null ? +v[6] : null, ex.id); updated++ }
    else { db.prepare('INSERT INTO hardware (id,name,code,brand,window_type,hardware_type,unit,default_rate,your_rate,stock,deleted) VALUES (?,?,?,?,?,?,?,?,?,0,0)').run(uid(), String(v[0]), String(v[1] || ''), String(v[2] || 'Generic Hardware'), String(v[3] || ''), String(v[4] || ''), String(v[5] || 'pc'), +v[6] || 0, +v[7] || +v[6] || 0); added++ } });
  res.json({ added, updated });
});
api.post('/inventory/hardware-sync', (req, res) => res.json({ ok: true, synced: db.prepare('SELECT COUNT(*) c FROM hardware').get().c }));
api.post('/inventory/hardware', (req, res) => {
  const h = { id: uid(), name: '', code: '', brand: 'Generic Hardware', window_type: '', hardware_type: '', unit: 'pc', default_rate: 0, your_rate: 0, stock: 0, ...req.body };
  db.prepare('INSERT INTO hardware (id,name,code,brand,window_type,hardware_type,unit,default_rate,your_rate,stock) VALUES (@id,@name,@code,@brand,@window_type,@hardware_type,@unit,@default_rate,@your_rate,@stock)').run(h);
  res.json(h);
});
api.put('/inventory/hardware/:id', (req, res) => {
  db.prepare('UPDATE hardware SET your_rate=COALESCE(?,your_rate), stock=COALESCE(?,stock) WHERE id=?').run(req.body.your_rate ?? null, req.body.stock ?? null, req.params.id);
  res.json({ ok: true });
});
api.delete('/inventory/hardware/:id', (req, res) => {
  db.prepare('UPDATE hardware SET deleted=1 WHERE id=?').run(req.params.id);
  res.json({ ok: true });
});
api.get('/inventory/purchase-orders', (req, res) => res.json([]));

// settings
api.get('/settings', (req, res) => {
  const o = {};
  db.prepare('SELECT * FROM settings').all().forEach(r => { o[r.key] = r.value; });
  o.payment_terms = JSON.parse(o.payment_terms || '[]');
  res.json(o);
});
api.put('/settings', (req, res) => {
  const s = db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)');
  Object.entries(req.body).forEach(([k, v]) => s.run(k, typeof v === 'string' ? v : JSON.stringify(v)));
  res.json({ ok: true });
});

const sect = k => (req, res) => res.json(JSON.parse((db.prepare('SELECT value FROM settings WHERE key=?').get(k) || { value: '{}' }).value));
const putSect = k => (req, res) => { db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)').run(k, JSON.stringify(req.body)); res.json({ ok: true }); };
['company', 'pricing', 'config', 'tax', 'install_map'].forEach(k => { api.get('/settings/' + k, sect(k)); api.put('/settings/' + k, putSect(k)); });
api.get('/profiles', (req, res) => res.json(db.prepare('SELECT * FROM profiles').all().map(p => ({ ...p, rate_per_m: +(p.weight * ((JSON.parse(db.prepare("SELECT value FROM settings WHERE key='pricing'").get().value).white_rate) || 165)).toFixed(2) }))));
api.get('/glass', (req, res) => res.json(db.prepare('SELECT * FROM glass ORDER BY name').all().map(g => ({ ...g, shown_rate: g.rate || g.default_rate || 0 }))));
api.post('/glass', (req, res) => { const g = { id: uid(), name: '', thickness: '', rate: 0, ...req.body }; db.prepare('INSERT INTO glass (id,name,thickness,rate,default_rate) VALUES (@id,@name,@thickness,@rate,@rate)').run(g); res.json(g); });
api.put('/glass/:id', (req, res) => { const b = req.body; db.prepare('UPDATE glass SET name=COALESCE(?,name), thickness=COALESCE(?,thickness), rate=COALESCE(?,rate), status=COALESCE(?,status) WHERE id=?').run(b.name ?? null, b.thickness ?? null, b.rate ?? null, b.status ?? null, req.params.id); res.json({ ok: true }); });
api.get('/glass/export', async (req, res) => {
  const wb = new (require('exceljs').Workbook)(), ws = wb.addWorksheet('Glass');
  ws.addRow(['Name', 'Thickness', 'Rate per m2', 'Status']).font = { bold: true };
  db.prepare('SELECT * FROM glass ORDER BY name').all().forEach(g => ws.addRow([g.name, g.thickness, g.rate || g.default_rate || 0, g.status]));
  ws.columns = [{ width: 40 }, { width: 12 }, { width: 14 }, { width: 12 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', 'attachment; filename="glass.xlsx"');
  await wb.xlsx.write(res); res.end();
});
api.post('/glass/import', express.json({ limit: '10mb' }), async (req, res) => {
  const wb = new (require('exceljs').Workbook)(); await wb.xlsx.load(Buffer.from(String(req.body.file || ''), 'base64'));
  let added = 0, updated = 0;
  wb.worksheets[0].eachRow((r, i) => { if (i === 1) return; const [name, thickness, rate, status] = [1, 2, 3, 4].map(c => r.getCell(c).value); if (!name) return;
    const ex = db.prepare('SELECT id FROM glass WHERE name=?').get(String(name));
    if (ex) { db.prepare('UPDATE glass SET thickness=COALESCE(?,thickness), rate=COALESCE(?,rate), status=COALESCE(?,status) WHERE id=?').run(thickness ? String(thickness) : null, rate != null ? +rate : null, status ? String(status) : null, ex.id); updated++ }
    else { db.prepare('INSERT INTO glass (id,name,thickness,rate,default_rate,status) VALUES (?,?,?,?,?,?)').run(uid(), String(name), String(thickness || ''), +rate || 0, +rate || 0, String(status || 'Active')); added++ } });
  res.json({ added, updated });
});
api.get('/profiles/export', async (req, res) => {
  const wb = new (require('exceljs').Workbook)(), ws = wb.addWorksheet('Profiles');
  ws.addRow(['Item code', 'Description', 'Weight per m (kg)']).font = { bold: true };
  db.prepare('SELECT * FROM profiles ORDER BY code').all().forEach(p => ws.addRow([p.code, p.description, p.weight]));
  ws.columns = [{ width: 16 }, { width: 50 }, { width: 18 }];
  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'); res.setHeader('Content-Disposition', 'attachment; filename="profiles.xlsx"');
  await wb.xlsx.write(res); res.end();
});
api.post('/profiles/import', express.json({ limit: '10mb' }), async (req, res) => {
  const wb = new (require('exceljs').Workbook)(); await wb.xlsx.load(Buffer.from(String(req.body.file || ''), 'base64'));
  let added = 0, updated = 0;
  wb.worksheets[0].eachRow((r, i) => { if (i === 1) return; const code = r.getCell(1).value, d = r.getCell(2).value, w = r.getCell(3).value; if (!code) return;
    const ex = db.prepare('SELECT id FROM profiles WHERE code=?').get(String(code));
    if (ex) { db.prepare('UPDATE profiles SET description=COALESCE(?,description), weight=COALESCE(?,weight) WHERE id=?').run(d ? String(d) : null, w != null ? +w : null, ex.id); updated++ }
    else { db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,NULL)').run(uid(), 'S CRAFT uPVC Profiles v31', String(code), String(d || ''), +w || 0); added++ } });
  res.json({ added, updated });
});
api.get('/suppliers', (req, res) => res.json(db.prepare('SELECT * FROM suppliers').all()));
api.post('/suppliers', (req, res) => { const x = { id: uid(), name: '', phone: '', email: '', address: '', ...req.body }; db.prepare('INSERT INTO suppliers VALUES (@id,@name,@phone,@email,@address)').run(x); res.json(x); });
api.get('/purchase-orders', (req, res) => res.json(db.prepare('SELECT * FROM purchase_orders ORDER BY created_at DESC').all()));
api.post('/purchase-orders', (req, res) => { const x = { id: uid(), number: nextNumber('purchase_orders', 'PO'), supplier_id: req.body.supplier_id, status: 'draft', total: req.body.total || 0, created_at: now() }; db.prepare('INSERT INTO purchase_orders VALUES (@id,@number,@supplier_id,@status,@total,@created_at)').run(x); res.json(x); });
api.put('/purchase-orders/:id', (req, res) => { db.prepare('UPDATE purchase_orders SET status=? WHERE id=?').run(req.body.status, req.params.id); res.json({ ok: true }); });
api.get('/customers/:id', (req, res) => { const c = db.prepare('SELECT * FROM customers WHERE id=?').get(req.params.id); res.json({ ...c, quotations: db.prepare('SELECT * FROM quotations WHERE customer_id=?').all(req.params.id).map(shape) }); });
api.get('/reports/quotations', (req, res) => {
  let rows = db.prepare('SELECT * FROM quotations').all();
  if (req.query.customer) rows = rows.filter(r => r.customer_id === req.query.customer);
  if (req.query.from) rows = rows.filter(r => r.created_at.slice(0, 10) >= req.query.from);
  if (req.query.to) rows = rows.filter(r => r.created_at.slice(0, 10) <= req.query.to);
  const approved = r => ['confirmed', 'dispatched'].includes(r.status);
  const wo = r => !!db.prepare('SELECT 1 FROM work_orders WHERE quotation_id=?').get(r.id);
  const months = {};
  rows.forEach(r => { const m = r.created_at.slice(0, 7); months[m] = months[m] || { month: m, generated: 0, approved: 0, production: 0 }; months[m].generated++; if (approved(r)) months[m].approved++; if (wo(r)) months[m].production++; });
  res.json({ generated: rows.length, approved: rows.filter(approved).length, production: rows.filter(wo).length,
    conversion: rows.length ? +(rows.filter(approved).length / rows.length * 100).toFixed(2) : 0, months: Object.values(months).sort((a, b) => a.month < b.month ? -1 : 1) });
});
const PROFDIR = process.env.VERCEL ? '/tmp/profile-images' : path.join(__dirname, 'uploads', 'profiles');
api.post('/profiles/:code/image', express.json({ limit: '6mb' }), (req, res) => {
  const code = String(req.params.code || ''); if (!/^[\w.\-]{1,40}$/.test(code)) return res.status(400).json({ error: 'Invalid profile code' });
  if (!db.prepare('SELECT 1 FROM profiles WHERE code=?').get(code)) return res.status(404).json({ error: 'Unknown profile' });
  const m = /^data:image\/(png|jpeg|jpg|webp);base64,(.+)$/.exec(String(req.body.data || '')); if (!m) return res.status(400).json({ error: 'Send a PNG, JPG or WebP drawing' });
  const buf = Buffer.from(m[2], 'base64'); if (buf.length > 4e6) return res.status(400).json({ error: 'Drawing is too large (max 4 MB)' });
  require('fs').mkdirSync(PROFDIR, { recursive: true }); require('fs').writeFileSync(path.join(PROFDIR, code + '.' + (m[1] === 'jpeg' ? 'jpg' : m[1])), buf); res.json({ ok: true });
});
api.post('/brands/catalogue', express.json({ limit: '80mb' }), async (req, res) => {
  const brand = String(req.body.brand || '').trim(), m = /^data:application\/pdf;base64,(.+)$/.exec(String(req.body.file || ''))
  if (!brand) return res.status(400).json({ error: 'Enter the brand name' }); if (!m) return res.status(400).json({ error: 'Upload the catalogue as a PDF' })
  const fs = require('fs'), os = require('os'), tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'cat-')), pdf = path.join(tmp, 'c.pdf')
  try {
    fs.writeFileSync(pdf, Buffer.from(m[1], 'base64')); const found = await require('./catalogue').extract(pdf, tmp)
    if (!found.length) return res.status(422).json({ error: 'No profile drawings with item codes were found in this PDF.' })
    fs.mkdirSync(PROFDIR, { recursive: true }); let created = 0, updated = 0, drawings = 0
    for (const f of found) {
      const ex = db.prepare('SELECT id FROM profiles WHERE code=?').get(f.code)
      if (ex) { db.prepare('UPDATE profiles SET description=COALESCE(NULLIF(?,\'\'),description), weight=CASE WHEN ?>0 THEN ? ELSE weight END WHERE id=?').run(f.description, f.weight, f.weight, ex.id); updated++ }
      else { db.prepare('INSERT INTO profiles VALUES (?,?,?,?,?,NULL)').run(uid(), brand, f.code, f.description, f.weight); created++ }
      const bundled = fs.existsSync(path.join(__dirname, '..', 'frontend', 'dist', 'profiles', f.code + '.png'))
      if (f.png && (!ex || !bundled)) { fs.copyFileSync(f.png, path.join(PROFDIR, f.code + '.png')); drawings++ }
    }
    res.json({ found: found.length, created, updated, drawings, profiles: found.map(f => ({ code: f.code, description: f.description, weight: f.weight, drawing: !!f.png })) })
  } catch (e) { res.status(500).json({ error: e.message }) } finally { fs.rmSync(tmp, { recursive: true, force: true }) }
});
api.get('/inventory/profiles', (req, res) => res.json(db.prepare('SELECT * FROM profiles').all()));
api.get('/inventory/issue-receipt', (req, res) => res.json({ issues: [], receipts: [] }));
api.get('/inventory/orders', (req, res) => {
  const cn = qid => (db.prepare('SELECT c.name FROM quotations q JOIN customers c ON c.id=q.customer_id WHERE q.id=?').get(qid) || {}).name;
  const out = [];
  db.prepare('SELECT * FROM work_orders ORDER BY number').all().forEach(w => {
    db.prepare('SELECT * FROM sub_work_orders WHERE wo_id=? ORDER BY number').all(w.id).forEach(s => { const st = subStatus(s); out.push({ id: s.id, label: `${s.number} · ${cn(w.quotation_id)} · ${st === 'draft' ? 'open' : st.replace(/_/g, ' ')}` }) });
    out.push({ id: w.id, label: `${w.number} · ${cn(w.quotation_id)} · ${w.status.replace(/_/g, ' ')}` });
  });
  res.json(out);
});
api.get('/tickets', (req, res) => res.json(db.prepare('SELECT * FROM tickets ORDER BY created_at DESC').all()));
api.post('/tickets', (req, res) => { const t = { id: uid(), subject: '', body: '', quotation_id: '', ...req.body, created_at: now() }; db.prepare("INSERT INTO tickets (id,subject,body,quotation_id,created_at) VALUES (@id,@subject,@body,@quotation_id,@created_at)").run(t); res.json(t); });
try { db.exec("ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'Active'"); } catch (e) {}
try { db.exec('ALTER TABLE users ADD COLUMN manager TEXT'); } catch (e) {}
api.get('/team', (req, res) => res.json(db.prepare('SELECT id,name,email,role,status,manager FROM users ORDER BY rowid').all().map(u => ({ ...u, status: u.status || 'Active' }))));
api.post('/team', (req, res) => {
  const { name, email, role, password, manager } = req.body;
  if (!name || !email) return res.status(400).json({ error: 'Name and email are required.' });
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(email)) return res.status(400).json({ error: 'That email is already used.' });
  const id = uid(); db.prepare('INSERT INTO users (id,name,email,password,role,status,manager) VALUES (?,?,?,?,?,?,?)').run(id, name, email, password || 'changeme', role || 'sales', 'Active', manager || null); res.json({ id });
});
api.put('/team/:id', (req, res) => { const b = req.body; db.prepare('UPDATE users SET role=COALESCE(?,role), status=COALESCE(?,status), manager=COALESCE(?,manager) WHERE id=?').run(b.role ?? null, b.status ?? null, b.manager ?? null, req.params.id); res.json({ ok: true }); });

// ---- My account ----
const SESSIONS = [{ id: 'cur', current: true, signed_in: new Date(Date.now() - 12 * 3600e3).toISOString(), renewed: new Date().toISOString() }, { id: 'oth', current: false, signed_in: new Date(Date.now() - 14 * 3600e3).toISOString(), renewed: new Date(Date.now() - 1 * 3600e3).toISOString() }];
api.get('/account', (req, res) => {
  const co = JSON.parse((db.prepare("SELECT value FROM settings WHERE key='company'").get() || { value: '{}' }).value);
  const u = db.prepare('SELECT id,name,email,role FROM users WHERE id=?').get(req.user.id) || req.user;
  res.json({ user: u, company: { name: co.name || 'Ravi Raja Industries', address: co.address || '', phone: co.phone || '', email: co.email || '' },
    plan: { name: 'Basic', features: 'Basic', expires: '2027-10-13', readonly_until: '2027-11-12', users_paid: 1, users_in_use: db.prepare('SELECT COUNT(*) n FROM users').get().n, renew: 15000, upgrade: 13849.32, days_left: 337 },
    invoices: [], sessions: SESSIONS, language: (JSON.parse((db.prepare("SELECT value FROM settings WHERE key='language'").get() || { value: '"English"' }).value)) });
});
api.put('/account/language', (req, res) => { db.prepare("INSERT OR REPLACE INTO settings (key,value) VALUES ('language',?)").run(JSON.stringify(req.body.language || 'English')); res.json({ ok: true }) });
api.post('/auth/password', (req, res) => {
  const { current, next } = req.body || {}; const u = db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id);
  if (!u || !pwOk(u, current)) return res.status(400).json({ error: 'Current password is incorrect' });
  if (!next || String(next).length < 8) return res.status(400).json({ error: 'Use at least 8 characters' });
  db.prepare('UPDATE users SET password=? WHERE id=?').run(pwHash(next), u.id); res.json({ ok: true });
});
api.delete('/account/sessions/:id', (req, res) => { const i = SESSIONS.findIndex(x => x.id === req.params.id && !x.current); if (i >= 0) SESSIONS.splice(i, 1); res.json({ ok: true }) });
api.get('/getting-started', (req, res) => res.json({ done: 7, total: 10, steps: [
  ['Set up your company profile', false], ['Set your rates and margins', true], ['Check your profile system and hardware', true], ['Add your first customer', true], ['Create a quotation and draw a window', true],
  ['Check the price and send the quotation', true], ['Confirm the order and lock the work order', true], ['View the production lists and start production', true], ['Record a quality check', false], ['Complete and dispatch the order', false]] }));


// ---- Settings extras: demo-default quotation wording, glass catalogue defaults, team, Excel transfer ----
const DEMO_INTRO = "Thank you for the opportunity to quote for your windows and doors. This proposal sets out the specification, drawings, and pricing for your review. Our team is happy to walk through any part of it; reach out any time with questions before you confirm the order.";
const DEMO_TERMS = [
  "1. Specification: Manufacturing follows the profile system, glass, and hardware specified in this document. Final fabrication sizes are taken from site measurement and may vary from the quoted sizes by a small tolerance.",
  "2. Measurement: A site visit is scheduled after all openings are ready for measurement. Production begins only after the measurement sheet and drawings are confirmed in writing.",
  "3. Changes: Once confirmed for production, sizes and design cannot be altered. Any change requested after measurement confirmation is treated as a fresh order.",
  "4. Pricing: Prices are ex-works and exclude installation, freight, and insurance unless stated separately. Applicable taxes are extra.",
  "5. Payment: As per the payment schedule in this document.",
  "6. Delivery: Standard lead time is counted from the date of confirmed order and advance payment, unless otherwise agreed in writing.",
  "7. Installation: Site readiness (power, access, scaffolding where required) is the customer's responsibility. Delays due to site conditions are outside our control.",
  "8. Validity: This quotation is valid for the number of days stated above from its date of issue."].join('\n');
const DEMO_WARRANTY = "Profiles carry the manufacturer's standard structural warranty. Hardware and accessories are covered for one year against manufacturing defects. Glass is covered only for factory defects (bubbles/white dots); breakage after delivery is not covered. Sealant and mesh are not covered under warranty.";
const DEMO_EXCL = "This quotation excludes civil work, painting, and cleaning after installation unless explicitly listed above. Glass breakage during a customer-arranged installation is the customer's responsibility. Wooden packing, if required, is charged separately.";
{
  const get = k => (db.prepare('SELECT value FROM settings WHERE key=?').get(k) || {}).value;
  const put = db.prepare('INSERT OR REPLACE INTO settings VALUES (?,?)');
  if (!get('intro')) put.run('intro', DEMO_INTRO);
  if (!get('terms') || get('terms').length < 200) put.run('terms', DEMO_TERMS);
  if (get('warranty') === undefined) put.run('warranty', DEMO_WARRANTY);
  if (get('exclusions') === undefined) put.run('exclusions', DEMO_EXCL);
}
try { db.exec('ALTER TABLE glass ADD COLUMN default_rate REAL'); } catch (e) {}
const GLASS_DEFAULTS = { '10 mm clear glass': 1200, '10 mm clear toughened glass': 1600, '12 mm clear glass': 1500, '20 mm DGU 5-10-5 clear glass': 3200, '4 mm clear glass': 480, '4 mm pinhead glass': 400, '4.5 mm pinhead glass': 450, '5 mm clear glass': 580, '5 mm clear toughened glass': 850, '5 mm frosted glass': 900, '5 mm frosted toughened glass': 1400, '5 mm grey tinted glass': 750, '5 mm grey tinted toughened glass': 900, '6 mm clear glass': 700, '6 mm frosted glass': 1200, '6 mm grey tinted glass': 1000, '6 mm MDF board': 500, '6 mm toughened glass': 950, '8 mm clear glass': 750, '8 mm clear toughened glass': 1200, '8 mm grey tinted glass': 1000 };
db.prepare('SELECT id,name,default_rate FROM glass').all().forEach(g => { if (g.default_rate == null && GLASS_DEFAULTS[g.name] != null) db.prepare('UPDATE glass SET default_rate=? WHERE id=?').run(GLASS_DEFAULTS[g.name], g.id); });
db.prepare("UPDATE glass SET rate=0 WHERE name='5 mm clear glass' AND rate=350").run();

const SHARE_SECRET = process.env.SHARE_SECRET || 'fenstraworks-share';
const sig = id => crypto.createHmac('sha256', SHARE_SECRET).update(id).digest('hex').slice(0, 24);
app.get('/share/q/:id/:sig', (req, res) => { if (req.params.sig !== sig(req.params.id)) return res.status(404).end(); sendDoc(req, res); });
api.get('/quotations/:id/share', (req, res) => {
  const q = db.prepare('SELECT * FROM quotations WHERE id=?').get(req.params.id);
  if (!q) return res.status(404).json({ error: 'Not found' });
  const c = db.prepare('SELECT * FROM customers WHERE id=?').get(q.customer_id) || {};
  const t = quoteTotals(q.id), base = `${req.protocol}://${req.get('host')}`;
  const url = `${base}/share/q/${q.id}/${sig(q.id)}?format=pdf`;
  const message = `Hello ${c.name || ''}, please find quotation ${q.number} for ${q.project || 'your windows'} — total Rs ${t.total.toLocaleString('en-IN')}.\n${url}`;
  const phone = String(c.phone || '').replace(/\D/g, '');
  res.json({ url, message, phone, customer: c.name || '', whatsapp: `https://wa.me/${phone.length === 10 ? '91' + phone : phone}?text=${encodeURIComponent(message)}`, mailto: `mailto:${c.email || ''}?subject=${encodeURIComponent('Quotation ' + q.number)}&body=${encodeURIComponent(message)}` });
});
app.get(/^\/profiles\/(clean\/)?([\w.\-]+)\.png$/, (req, res, next) => { // uploaded drawings override the bundled ones and are cleaned in the browser
  const fs0 = require('fs'), code = req.params[1], f = ['png', 'jpg', 'webp'].map(e => path.join(PROFDIR, code + '.' + e)).find(x => fs0.existsSync(x))
  if (!f) return next(); if (req.params[0]) return res.status(404).end(); res.sendFile(f) });
app.use('/api/v1/app', api);
const dist = path.join(__dirname, '..', 'frontend', 'dist');
if (require('fs').existsSync(dist)) {
  app.use(express.static(dist, { setHeaders: (res, f) => { res.setHeader('Cache-Control', /[\\/]assets[\\/]/.test(f) ? 'public, max-age=31536000, immutable' : 'no-cache, no-store, must-revalidate') } }));
  app.get(/^\/assets\/.*/, (req, res) => res.status(404).end());
  app.get(/^\/(?!api).*/, (req, res) => { res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate'); res.setHeader('CDN-Cache-Control', 'no-store'); res.setHeader('Vercel-CDN-Cache-Control', 'no-store'); res.sendFile(path.join(dist, 'index.html')) }); }
const PORT = process.env.PORT || 4000;
if (!process.env.VERCEL) app.listen(PORT, () => console.log('FenstraWorks API on :' + PORT));
module.exports = app;
