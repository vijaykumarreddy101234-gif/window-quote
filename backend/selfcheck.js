// Self-check: logs in to a dedicated test company and runs the whole business flow against a running server.
// Usage: node selfcheck.js https://window-quote-two.vercel.app   (exit code 1 + list of failures when something is broken)
const base = (process.argv[2] || 'http://localhost:5055').replace(/\/$/, '') + '/api/v1/app', EM = 'selfcheck@fenestra.test', PW = 'selfcheck-pass-1';
const fails = []; let tok = '';
const call = async (m, p, b, raw) => { const t0 = Date.now(), r = await fetch(base + p, { method: m, headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) }, body: b ? JSON.stringify(b) : undefined }); const buf = raw ? Buffer.from(await r.arrayBuffer()) : await r.json().catch(() => ({})); return { s: r.status, b: buf, ms: Date.now() - t0 } };
const ok = (name, c, info) => { if (!c) fails.push(name + (info ? ' → ' + info : '')); console.log((c ? 'PASS ' : 'FAIL ') + name) };
(async () => {
  let r = await call('POST', '/auth/login', { email: EM, password: PW });
  if (r.s !== 200) r = await call('POST', '/auth/signup', { company: 'Selfcheck Co', name: 'Selfcheck', email: EM, password: PW });
  ok('login/signup', r.s === 200 && r.b.token, 'HTTP ' + r.s); if (!r.b.token) return finish(); tok = r.b.token;
  r = await call('GET', '/auth/me'); ok('auth/me', r.s === 200 && r.b.tenant && r.b.tenant !== 'main');
  r = await call('POST', '/customers', { name: 'Check Customer', phone: '9999999999' }); ok('create customer', r.s === 200 && r.b.id, 'HTTP ' + r.s); const cid = r.b.id;
  r = await call('POST', '/quotations', { customer_id: cid, project: 'selfcheck' }); ok('create quotation', r.s === 200 && r.b.id, 'HTTP ' + r.s); const qid = r.b.id;
  r = await call('POST', `/quotations/${qid}/items`, { mark: 'W1', name: 'Sliding', system: '62 series sliding window', width: 1200, height: 1200, type: 'sliding', qty: 1, glass: '5 mm clear glass', thickness: '5 mm', mesh: 'No mesh' }); ok('add window', r.s === 200 && r.b.id, 'HTTP ' + r.s); const iid = r.b.id;
  r = await call('GET', `/quotations/${qid}/items/${iid}/engine`); ok('price engine', r.s === 200 && r.b.engine && !r.b.engine.error, 'HTTP ' + r.s);
  const d = r.b.item && r.b.item.design; r = await call('PUT', `/quotations/${qid}/items/${iid}/design`, { design: typeof d === 'string' ? JSON.parse(d) : d, width: 1300, height: 1200, qty: 2, type: 'sliding', mesh: 'No mesh', glass: '5 mm clear glass' }); ok('design save', r.s === 200, 'HTTP ' + r.s + ' ' + JSON.stringify(r.b).slice(0, 120));
  r = await call('GET', `/quotations/${qid}/items/${iid}/engine`); ok('design save persisted', r.s === 200 && r.b.item && r.b.item.width === 1300, 'width=' + (r.b.item && r.b.item.width));
  for (const p of ['/dashboard', '/customers', '/quotations', '/profiles', '/glass', '/settings/company']) { r = await call('GET', p); ok('GET ' + p, r.s === 200, 'HTTP ' + r.s + ' ' + r.ms + 'ms') }
  r = await call('GET', `/quotations/${qid}/pdf`, null, true); ok('quotation PDF', r.s === 200 && r.b.slice(0, 4).toString() === '%PDF', 'HTTP ' + r.s);
  r = await call('POST', `/quotations/${qid}/status`, { status: 'confirmed' }); ok('confirm quotation', r.s === 200, 'HTTP ' + r.s + ' ' + JSON.stringify(r.b).slice(0, 120));
  r = await call('GET', '/production'); ok('work orders list', r.s === 200, 'HTTP ' + r.s);
  finish();
})().catch(e => { fails.push('crash: ' + e.message); finish() });
function finish() { console.log(fails.length ? '\nFAILED:\n- ' + fails.join('\n- ') : '\nALL CHECKS PASSED'); process.exit(fails.length ? 1 : 0) }
