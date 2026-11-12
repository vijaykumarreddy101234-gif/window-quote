// Permanent storage on Vercel without any separate database server: the SQLite file lives in /tmp and an
// encrypted, gzipped snapshot is kept in Vercel Blob (the storage built into Vercel). Every request first pulls a
// newer snapshot if another instance wrote one; every successful write request pushes a new snapshot before replying.
const zlib = require('zlib'), fs = require('fs'), crypto = require('crypto');
const API = 'https://blob.vercel-storage.com';
module.exports = function persist(db, { token, tmp = '/tmp', ns = 'main', secret = 'fenstraworks-auth', api = API }) {
  const key = crypto.createHash('sha256').update('snap:' + secret).digest(), P = 'fw/' + ns.replace(/[^a-z0-9]/gi, '') + '/';
  const H = { authorization: 'Bearer ' + token, 'x-api-version': '13', 'x-vercel-blob-access': 'private' };
  const chk = async (r, what) => { if (!r.ok) throw new Error('blob http ' + r.status + ' ' + what + ' ' + (await r.text()).slice(0, 160)); return r };
  const list = async prefix => { const r = await chk(await fetch(api + '/?prefix=' + encodeURIComponent(prefix) + '&limit=1000', { headers: H }), 'list'); return (await r.json()).blobs || [] };
  const put = async (name, body) => { const r = await chk(await fetch(api + '/' + name, { method: 'PUT', headers: { ...H, 'x-content-type': 'application/octet-stream', 'x-add-random-suffix': '0', 'x-cache-control-max-age': '0' }, body }), 'put'); return (await r.json()).url };
  const del = async urls => { if (!urls.length) return; try { await chk(await fetch(api + '/delete', { method: 'POST', headers: { ...H, 'content-type': 'application/json' }, body: JSON.stringify({ urls }) }), 'delete') } catch (e) { console.error('blob delete:', e.message) } };
  const enc = buf => { const iv = crypto.randomBytes(12), c = crypto.createCipheriv('aes-256-gcm', key, iv), out = Buffer.concat([c.update(buf), c.final()]); return Buffer.concat([iv, c.getAuthTag(), out]) };
  const dec = buf => { const d = crypto.createDecipheriv('aes-256-gcm', key, buf.subarray(0, 12)); d.setAuthTag(buf.subarray(12, 28)); return Buffer.concat([d.update(buf.subarray(28)), d.final()]) };
  const vOf = b => +(b.pathname.match(/\/v(\d+)\.bin$/) || [0, 0])[1];
  let localV = 0, ready = null;
  async function latest() { const bs = await list(P + 'snap/'); let best = null; for (const b of bs) if (vOf(b) > (best ? vOf(best) : 0)) best = b; return best }
  async function pull(b) {
    const raw = await (await chk(await fetch(b.url + (b.url.includes('?') ? '&' : '?') + 'cache=0', { headers: H, cache: 'no-store' }), 'get')).arrayBuffer();
    const buf = zlib.gunzipSync(dec(Buffer.from(raw))), f = tmp + '/remote-' + process.pid + '-' + Date.now() + '.db'; fs.writeFileSync(f, buf);
    db.exec(`ATTACH DATABASE '${f}' AS rm`);
    try {
      const tabs = db.prepare("SELECT name FROM rm.sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'").all().map(t => t.name);
      db.transaction(() => tabs.forEach(t => {
        const lc = new Set(db.prepare(`PRAGMA main.table_info("${t}")`).all().map(c => c.name)), cols = db.prepare(`PRAGMA rm.table_info("${t}")`).all().map(c => c.name).filter(c => lc.has(c));
        if (!lc.size) { db.exec(`CREATE TABLE main."${t}" AS SELECT * FROM rm."${t}"`); return }
        const cl = cols.map(c => `"${c}"`).join(','); db.exec(`DELETE FROM main."${t}"`); db.exec(`INSERT INTO main."${t}" (${cl}) SELECT ${cl} FROM rm."${t}"`);
      }))();
    } finally { db.exec('DETACH DATABASE rm'); try { fs.unlinkSync(f) } catch (e) {} }
    localV = vOf(b);
  }
  async function push() {
    const f = tmp + '/save-' + process.pid + '-' + Date.now() + '.db'; db.exec(`VACUUM INTO '${f}'`);
    const body = enc(zlib.gzipSync(fs.readFileSync(f))); fs.unlinkSync(f);
    const cur = await latest(), v = Math.max(localV, cur ? vOf(cur) : 0) + 1;
    await put(P + 'snap/v' + v + '.bin', body); localV = v;
    const old = (await list(P + 'snap/')).filter(b => vOf(b) < v - 1).map(b => b.url); if (old.length) await del(old);
  }
  // write lease across instances: each writer drops a ticket, the oldest live ticket owns the lock
  const tk = owner => P + 'lock/' + owner;
  async function lock(owner) {
    const mine = Date.now(); await put(tk(mine + '-' + owner), Buffer.from('1'));
    for (let i = 0; i < 80; i++) {
      const ts = (await list(P + 'lock/')).map(b => ({ b, t: +(b.pathname.split('/').pop().split('-')[0] || 0) })).filter(x => x.t > Date.now() - 25000).sort((a, b) => a.t - b.t);
      if (!ts.length || ts[0].b.pathname === tk(mine + '-' + owner)) return true;
      await new Promise(r => setTimeout(r, 150 + Math.random() * 200));
    }
    await unlock(owner); return false;
  }
  const unlock = async owner => { try { const bs = (await list(P + 'lock/')).filter(b => b.pathname.endsWith('-' + owner) || +(b.pathname.split('/').pop().split('-')[0] || 0) < Date.now() - 25000); await del(bs.map(b => b.url)) } catch (e) { console.error('unlock:', e.message) } };
  const init = () => ready || (ready = (async () => { const b = await latest(); if (b) await pull(b); else await push(); console.log('persist(' + ns + '): ready, version', localV) })().catch(e => { ready = null; throw e }));
  let offUntil = 0;
  const mw = async function middleware(req, res, next) {
    if (Date.now() < offUntil) return next();
    const write = !['GET', 'HEAD', 'OPTIONS'].includes(req.method), owner = Math.random().toString(36).slice(2) + Date.now();
    try {
      await init();
      if (write && !(await lock(owner))) return res.status(503).json({ error: 'Server busy, please retry.' });
      const b = await latest(); if (b && vOf(b) > localV) await pull(b);
    } catch (e) { console.error('persist pull failed:', e.message);
      if (/blob http (401|403)/.test(e.message)) { offUntil = Date.now() + 60000; console.error('PERSISTENCE DISABLED for 60s: Vercel Blob rejected the token'); if (write) unlock(owner); return next() }
      if (write) { unlock(owner); return res.status(503).json({ error: 'Storage unavailable, please retry.' }) } }
    if (write) {
      const end = res.end.bind(res); let called = false;
      res.once('close', () => { if (!called) unlock(owner) });
      res.end = function (...a) {
        if (called) return end(...a); called = true;
        if (res.statusCode >= 400) { unlock(owner); return end(...a) }
        push().then(() => unlock(owner), e => { console.error('persist push failed:', e.message); unlock(owner); res.statusCode = 503; res.removeHeader('Content-Length'); res.setHeader('Content-Type', 'application/json'); a = [JSON.stringify({ error: 'Could not save your change, please retry.' })] }).finally(() => end(...a));
        return res;
      };
    }
    next();
  };
  mw.init = init; mw.pushNow = push; mw.sync = async () => { await init(); const b = await latest(); if (b && vOf(b) > localV) await pull(b) }; return mw;
};
