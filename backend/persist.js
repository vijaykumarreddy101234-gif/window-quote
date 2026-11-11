// Persistent storage for serverless hosts: the SQLite file lives in /tmp, and a gzipped snapshot is kept in a Turso database
// (plain HTTPS "pipeline" API). Every request first pulls a newer snapshot if another instance wrote one;
// every successful write request pushes a new snapshot before its response is sent.
const zlib = require('zlib'), fs = require('fs');
module.exports = function persist(db, { url, token, tmp = '/tmp' }) {
  const base = url.replace(/^libsql:/, 'https:').replace(/\/$/, '');
  const arg = v => typeof v === 'number' ? { type: 'integer', value: String(v) } : { type: 'text', value: String(v) };
  async function run(stmts) {
    const body = { requests: [...stmts.map(([sql, args]) => ({ type: 'execute', stmt: { sql, args: (args || []).map(arg) } })), { type: 'close' }] };
    const r = await fetch(base + '/v2/pipeline', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    if (!r.ok) throw new Error('turso http ' + r.status + ' ' + (await r.text()).slice(0, 200));
    const j = await r.json(); j.results.forEach(x => { if (x.type === 'error') throw new Error('turso: ' + (x.error && x.error.message)) });
    return j.results.map(x => x.response && x.response.result ? x.response.result.rows.map(row => row.map(c => c.value)) : []);
  }
  let localV = 0, ready = null, chain = Promise.resolve();
  const SETUP = [['CREATE TABLE IF NOT EXISTS snap_meta (k TEXT PRIMARY KEY, v TEXT)'], ['CREATE TABLE IF NOT EXISTS snap_parts (version INTEGER, part INTEGER, data TEXT, PRIMARY KEY (version, part))']];
  async function remoteVersion() { const [, , rows] = await run([...SETUP, ["SELECT v FROM snap_meta WHERE k='version'"]]); return rows[0] ? +rows[0][0] : 0 }
  async function pull(v) {
    const [rows] = await run([['SELECT data FROM snap_parts WHERE version=? ORDER BY part', [v]]]);
    const buf = zlib.gunzipSync(Buffer.from(rows.map(r => r[0]).join(''), 'base64')), f = tmp + '/remote-' + v + '.db'; fs.writeFileSync(f, buf);
    db.exec(`ATTACH DATABASE '${f}' AS rm`);
    try {
      const tabs = db.prepare("SELECT name FROM rm.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
      db.transaction(() => tabs.forEach(t => {
        const lc = new Set(db.prepare(`PRAGMA main.table_info("${t}")`).all().map(c => c.name)), cols = db.prepare(`PRAGMA rm.table_info("${t}")`).all().map(c => c.name).filter(c => lc.has(c));
        if (!lc.size) { db.exec(`CREATE TABLE main."${t}" AS SELECT * FROM rm."${t}"`); return }
        const cl = cols.map(c => `"${c}"`).join(','); db.exec(`DELETE FROM main."${t}"`); db.exec(`INSERT INTO main."${t}" (${cl}) SELECT ${cl} FROM rm."${t}"`);
      }))();
    } finally { db.exec('DETACH DATABASE rm'); try { fs.unlinkSync(f) } catch (e) {} }
    localV = v;
  }
  async function push() {
    const f = tmp + '/save.db'; try { fs.unlinkSync(f) } catch (e) {} db.exec(`VACUUM INTO '${f}'`);
    const b64 = zlib.gzipSync(fs.readFileSync(f)).toString('base64'); fs.unlinkSync(f);
    const v = Math.max(localV, await remoteVersion()) + 1, parts = []; for (let i = 0; i < b64.length; i += 400000) parts.push(b64.slice(i, i + 400000));
    await run([...SETUP, ...parts.map((p, i) => ['INSERT INTO snap_parts (version, part, data) VALUES (?,?,?)', [v, i, p]]), ["INSERT INTO snap_meta (k,v) VALUES ('version',?) ON CONFLICT(k) DO UPDATE SET v=excluded.v", [v]], ['DELETE FROM snap_parts WHERE version < ?', [v - 1]]]);
    localV = v;
  }
  const init = () => ready || (ready = (async () => { const v = await remoteVersion(); if (v > 0) await pull(v); else await push(); console.log('persist: ready, version', localV) })().catch(e => { ready = null; throw e }));
  return async function middleware(req, res, next) {
    try { await init(); const v = await remoteVersion(); if (v > localV) await pull(v) } catch (e) { console.error('persist pull failed:', e.message) }
    if (req.method !== 'GET' && req.method !== 'HEAD' && req.method !== 'OPTIONS') {
      const end = res.end.bind(res); let called = false;
      res.end = function (...a) { if (called || res.statusCode >= 400) return end(...a); called = true; chain = chain.then(push).catch(e => console.error('persist push failed:', e.message)); chain.finally(() => end(...a)); return res };
    }
    next();
  };
};
