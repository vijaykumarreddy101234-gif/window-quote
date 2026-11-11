// Quotation documents: PDF / Excel / Word in six languages.
const PDFBase = require('pdfkit'), ExcelJS = require('exceljs'), D = require('docx');
const path = require('path'), fs = require('fs');
const F = n => path.join(__dirname, 'node_modules/@fontsource', n);
const FONTS = {
  hi: F('noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff'), mr: F('noto-sans-devanagari/files/noto-sans-devanagari-devanagari-400-normal.woff'),
  ta: F('noto-sans-tamil/files/noto-sans-tamil-tamil-400-normal.woff'), te: F('noto-sans-telugu/files/noto-sans-telugu-telugu-400-normal.woff'), bn: F('noto-sans-bengali/files/noto-sans-bengali-bengali-400-normal.woff') };
const T = {
  en: { quotation: 'Quotation', project: 'Project', customer: 'Customer', phone: 'Phone', no: 'No.', item: 'Window', size: 'Size (mm)', qty: 'Qty', rate: 'Rate', amount: 'Amount', subtotal: 'Subtotal', transport: 'Transport', loading: 'Loading', unloading: 'Unloading', gst: 'GST (18%)', total: 'Total', terms: 'Terms & conditions', area: 'Area (sq ft)', glass: 'Glass' },
  hi: { quotation: 'कोटेशन', project: 'प्रोजेक्ट', customer: 'ग्राहक', phone: 'फ़ोन', no: 'क्र.', item: 'खिड़की', size: 'माप (मिमी)', qty: 'मात्रा', rate: 'दर', amount: 'राशि', subtotal: 'उप-योग', transport: 'परिवहन', loading: 'लोडिंग', unloading: 'अनलोडिंग', gst: 'जीएसटी (18%)', total: 'कुल', terms: 'नियम और शर्तें', area: 'क्षेत्रफल (वर्ग फ़ीट)', glass: 'काँच' },
  ta: { quotation: 'விலைப்புள்ளி', project: 'திட்டம்', customer: 'வாடிக்கையாளர்', phone: 'தொலைபேசி', no: 'எண்', item: 'ஜன்னல்', size: 'அளவு (மிமீ)', qty: 'அளவு', rate: 'விலை', amount: 'தொகை', subtotal: 'துணை மொத்தம்', transport: 'போக்குவரத்து', loading: 'ஏற்றுதல்', unloading: 'இறக்குதல்', gst: 'ஜிஎஸ்டி (18%)', total: 'மொத்தம்', terms: 'விதிமுறைகள்', area: 'பரப்பு (சதுர அடி)', glass: 'கண்ணாடி' },
  te: { quotation: 'కొటేషన్', project: 'ప్రాజెక్ట్', customer: 'కస్టమర్', phone: 'ఫోన్', no: 'సం.', item: 'కిటికీ', size: 'కొలత (మిమీ)', qty: 'పరిమాణం', rate: 'రేటు', amount: 'మొత్తం', subtotal: 'ఉప మొత్తం', transport: 'రవాణా', loading: 'లోడింగ్', unloading: 'అన్‌లోడింగ్', gst: 'జీఎస్టీ (18%)', total: 'మొత్తం', terms: 'నిబంధనలు', area: 'విస్తీర్ణం (చ.అ.)', glass: 'గాజు' },
  bn: { quotation: 'কোটেশন', project: 'প্রকল্প', customer: 'গ্রাহক', phone: 'ফোন', no: 'নং', item: 'জানালা', size: 'মাপ (মিমি)', qty: 'পরিমাণ', rate: 'দর', amount: 'টাকা', subtotal: 'উপমোট', transport: 'পরিবহন', loading: 'লোডিং', unloading: 'আনলোডিং', gst: 'জিএসটি (18%)', total: 'মোট', terms: 'শর্তাবলী', area: 'ক্ষেত্রফল (বর্গফুট)', glass: 'কাচ' },
  mr: { quotation: 'कोटेशन', project: 'प्रकल्प', customer: 'ग्राहक', phone: 'फोन', no: 'क्र.', item: 'खिडकी', size: 'माप (मिमी)', qty: 'प्रमाण', rate: 'दर', amount: 'रक्कम', subtotal: 'उप-बेरीज', transport: 'वाहतूक', loading: 'लोडिंग', unloading: 'अनलोडिंग', gst: 'जीएसटी (18%)', total: 'एकूण', terms: 'अटी व शर्ती', area: 'क्षेत्रफळ (चौ. फूट)', glass: 'काच' } };
const collect = doc => new Promise((ok, no) => { const c = []; doc.on('data', b => c.push(b)); doc.on('end', () => ok(Buffer.concat(c))); doc.on('error', no) });
const inr = n => 'Rs ' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 });
function model(q, cust, t, terms, lang) {
  const L = T[lang] || T.en;
  const rows = t.items.map((i, n) => [n + 1, `${i.mark} ${i.name}\n${i.system || ''} · ${i.glass} · ${i.mesh}`, `${i.width} × ${i.height}`, i.qty, i.each, i.total]);
  const sums = [[L.subtotal, t.subtotal], ...(t.discountAmt ? [[`Discount (${t.discount}%)`, -t.discountAmt]] : []), ...(t.transport ? [[L.transport, t.transport]] : []), ...(t.loading ? [[L.loading, t.loading]] : []), ...(t.unloading ? [[L.unloading, t.unloading]] : []), [L.gst, t.cgst + t.sgst], [L.total, t.total]];
  return { L, rows, sums, head: [[L.project, q.project || ''], [L.customer, cust.name || ''], [L.phone, cust.phone || '']], title: `${L.quotation} ${q.number}`, terms, number: q.number };
}
const D_ = D;
// ---------------------------------------------------------------------------------------------
// Printable documents laid out like the demo's PDFs: Noto Sans, logo header, tiles, tables, footer.
const NF = k => (globalThis.__assets && globalThis.__assets[k]) || fs.readFileSync(path.join(__dirname, k === 'logo' ? 'assets/scraft-logo.png' : `node_modules/@fontsource/noto-sans/files/noto-sans-latin-${k === 'reg' ? 400 : 700}-normal.woff`));
// pdfkit's built-in Helvetica files are not bundled on Vercel: alias the standard names to the bundled Noto fonts
class PDFDocument extends PDFBase { constructor(o) { super(o); this.registerFont('Helvetica', NF('reg')); this.registerFont('Helvetica-Bold', NF('bold')) } }
const COL = { blue: '#4a6785', ink: '#2d3136', grey: '#6e7681', band: '#e6ecf0', tile: '#f4f5f7', rule: '#cdd5dc', head: '#dde6ee', alt: '#f3f3f0', tot: '#ecf0e7', brown: '#8a5a14', dark: '#34495e', line: '#d9e0e6' };
const f2 = n => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const f0 = n => Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fdate = d => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(d || '')); if (m) return `${m[3]} ${MON[+m[2] - 1]} ${m[1]}`; const x = d ? new Date(d) : new Date(); return `${String(x.getDate()).padStart(2, '0')} ${MON[x.getMonth()]} ${x.getFullYear()}` };
const addDays = (iso, n) => { const m = /^(\d{4})-(\d\d)-(\d\d)/.exec(String(iso || '')); const x = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + n)) : new Date(Date.now() + n * 864e5); return `${String(x.getUTCDate()).padStart(2, '0')} ${MON[x.getUTCMonth()]} ${x.getUTCFullYear()}` };
const INR = n => 'INR ' + Number(n || 0).toFixed(2);
const INRc = n => 'INR ' + f2(n);

function newDoc(o) {
  const doc = new PDFDocument({ size: 'A4', layout: o.landscape ? 'landscape' : 'portrait', margin: 0, bufferPages: true });
  doc.registerFont('N', NF('reg')); doc.registerFont('NB', NF('bold'));
  let L = null; if (o.lang && FONTS[o.lang] && fs.existsSync && fs.existsSync(FONTS[o.lang])) { try { doc.registerFont('L', FONTS[o.lang]); L = 'L' } catch (e) {} }
  const R = { doc, W: doc.page.width, H: doc.page.height, L, o, logo: NF('logo') };
  R.mx = o.landscape ? 28 : 40; R.cw = R.W - 2 * R.mx;
  R.txt = (s, x, y, a = {}) => { s = String(s); const bold = a.b, f = L && /[ऀ-෿]/.test(s) ? L : (bold ? 'NB' : 'N'); doc.font(f).fontSize(a.size || 8).fillColor(a.color || COL.ink); doc.text(s, x, y, { width: a.w, align: a.align || 'left', lineGap: a.gap == null ? 1.5 : a.gap, lineBreak: a.w != null, continued: false, characterSpacing: a.cs || 0 }); };
  R.h = (s, w, a = {}) => { s = String(s); doc.font(L && /[ऀ-෿]/.test(s) ? L : (a.b ? 'NB' : 'N')).fontSize(a.size || 8); return doc.heightOfString(s, { width: w, lineGap: a.gap == null ? 1.5 : a.gap }) };
  R.logoAt = (x, y, w) => { try { const w2 = w * 1.9; doc.image(R.logo, x + w - w2, y, { width: w2 }) } catch (e) {} };
  return R;
}
function pageHeader(R, small) {   // pages after the first: small title + logo + rule
  const { doc } = R; R.logoAt(R.W - R.mx - 62, 14, 62);
  R.txt(R.o.title, R.mx, 18, { b: 1, size: 8.5, color: COL.blue }); R.txt(`${R.o.title} · ${R.o.number}${R.o.customer ? ' · ' + R.o.customer : ''}`, R.mx, 30, { size: 8, color: COL.grey });
  doc.moveTo(R.mx, 47).lineTo(R.W - R.mx, 47).lineWidth(.6).strokeColor(COL.rule).stroke(); R.y = 60;
}
function firstHeader(R, right) {  // right: [lines]
  const { doc } = R; R.logoAt(R.W - R.mx - 72, 20, 72);
  doc.moveTo(R.mx, 62).lineTo(R.W - R.mx, 62).lineWidth(.6).strokeColor(COL.rule).stroke();
  R.txt(R.o.title, R.mx, 70, { b: 1, size: 22, color: COL.blue });
  R.txt(R.o.number, R.mx, 76, { b: 1, size: 12, w: R.cw, align: 'right' });
  let y = 94; (right || []).forEach(r => { R.txt(r.t, R.mx, y, { w: R.cw, align: 'right', size: 7.5, b: r.b, color: r.c || COL.grey }); y += 12 });
  doc.moveTo(R.mx, y + 4).lineTo(R.W - R.mx, y + 4).lineWidth(1).strokeColor(COL.dark).stroke(); R.y = y + 16;
}
function newPage(R) { R.doc.addPage(); pageHeader(R); }
function need(R, h) { if (R.y + h > R.H - 62) newPage(R) }
function tiles(R, list, cols = 3) {
  const gap = 4, w = (R.cw - gap * (cols - 1)) / cols, { doc } = R;
  list.forEach((t, i) => { const c = i % cols, r = Math.floor(i / cols), x = R.mx + c * (w + gap), y = R.y + r * 35; doc.rect(x, y, w, 31).fill(COL.tile); R.txt(String(t[0]).toUpperCase(), x + 6, y + 5, { size: 5.8, color: COL.grey, cs: .2 }); R.txt(t[1], x + 6, y + 15, { size: 8.6, w: w - 10 }) });
  R.y += Math.ceil(list.length / cols) * 35 + 4;
}
function section(R, title, desc) {
  need(R, 40); R.txt(title, R.mx, R.y, { b: 1, size: 12, color: COL.blue }); R.y += 18; R.doc.moveTo(R.mx, R.y).lineTo(R.W - R.mx, R.y).lineWidth(.5).strokeColor(COL.rule).stroke(); R.y += 7;
  if (desc) { R.txt(desc, R.mx, R.y, { w: R.cw, size: 7, color: COL.grey, gap: 3 }); R.y += R.h(desc, R.cw, { size: 7, gap: 3 }) + 8 }
}
// cols: [{h, w (relative), a: 'l'|'r'|'c', b?}] rows: [{c:[..], t: 'strong'|'group'}|[..]]
function tbl(R, cols, rows, o = {}) {
  const { doc } = R, tw = R.cw, sum = cols.reduce((a, c) => a + c.w, 0), W = cols.map(c => c.w / sum * tw), fs_ = o.size || 8, pad = o.pad == null ? 5 : o.pad, hp = o.hp == null ? 4 : o.hp;
  const X = []; let ax = R.mx; W.forEach(w => { X.push(ax); ax += w });
  const head = () => { const hh = Math.max(...cols.map((c, i) => R.h(c.h, W[i] - 2 * hp, { b: 1, size: o.hsize || 7 }))) + 10; doc.rect(R.mx, R.y, tw, hh).fill(COL.head); cols.forEach((c, i) => R.txt(c.h, X[i] + hp, R.y + 5, { b: 1, size: o.hsize || 7, color: COL.blue, w: W[i] - 2 * hp, align: c.a === 'r' ? 'right' : c.a === 'c' ? 'center' : 'left' })); R.y += hh };
  need(R, 60); head();
  rows.forEach((row, n) => { const c = Array.isArray(row) ? row : row.c, t = Array.isArray(row) ? '' : row.t, strong = t === 'strong', grp = t === 'group';
    const hh = Math.max(o.min || 19, ...c.map((v, i) => R.h(v, W[i] - 2 * hp, { b: strong || grp || cols[i].b, size: fs_ })) .map(x => x + pad * 2));
    if (R.y + hh > R.H - 62) { newPage(R); head() }
    if (strong) doc.rect(R.mx, R.y, tw, hh).fill(COL.tot); else if (grp) doc.rect(R.mx, R.y, tw, hh).fill('#eef2f5'); else if (n % 2) doc.rect(R.mx, R.y, tw, hh).fill(COL.alt);
    c.forEach((v, i) => R.txt(v, X[i] + hp, R.y + pad, { size: fs_, b: strong || grp || cols[i].b, w: W[i] - 2 * hp, align: cols[i].a === 'r' ? 'right' : cols[i].a === 'c' ? 'center' : 'left', gap: 1.5 }));
    R.y += hh; doc.moveTo(R.mx, R.y).lineTo(R.mx + tw, R.y).lineWidth(.4).strokeColor(COL.line).stroke(); });
  R.y += 8;
}
function footers(R, kind, docId) {
  const { doc } = R, n = doc.bufferedPageRange().count;
  for (let i = 0; i < n; i++) { doc.switchToPage(i); const y = R.H - 49; doc.moveTo(R.mx, y).lineTo(R.W - R.mx, y).lineWidth(.5).strokeColor(COL.rule).stroke();
    R.txt(`${R.o.number} | ${kind} | ${i + 1} / ${n}`, R.mx, y + 7, { size: 7, color: COL.grey, w: 300 }); R.txt(`Printed ${R.o.printed}`, R.mx, y + 7, { size: 7, color: COL.grey, w: R.cw, align: 'right' });
    if (docId) R.txt('Document identity: ' + docId, R.mx, y + 17, { size: 5, color: COL.grey, w: 400 }) }
}
const PDFEND = R => { const done = collect(R.doc); R.doc.end(); return done };

// ---- window drawing (elevation, viewed from inside) --------------------------------------------
function dwg(doc, spec, x, y, bw, bh, o = {}) {
  const W = +spec.w || 1000, H = +spec.h || 1000, d = spec.d || {}, dims = o.dims !== false;
  const padL = dims ? 26 : 2, padB = dims ? 28 : 2, padT = 3, padR = dims ? 14 : 2;
  const k = Math.min((bw - padL - padR) / W, (bh - padB - padT) / H), ww = W * k, hh = H * k, x0 = x + padL + (bw - padL - padR - ww) / 2, y0 = o.top ? y + padT : y + padT + (bh - padT - padB - hh) / 2;
  const ink = '#3a4757';
  const glass = (gx, gy, gw, gh) => { doc.save().rect(gx, gy, gw, gh).fill('#d6ebf8'); doc.rect(gx, gy, gw, gh).clip(); doc.fillOpacity(.3).fillColor('#ffffff').polygon([gx + gw * .12, gy + gh], [gx + gw * .36, gy + gh], [gx + gw * .8, gy], [gx + gw * .56, gy]).fill().polygon([gx + gw * .5, gy + gh], [gx + gw * .58, gy + gh], [gx + gw * .98, gy], [gx + gw * .9, gy]).fill(); doc.restore(); doc.save().lineWidth(.5).strokeColor('#8fb4d0').rect(gx, gy, gw, gh).stroke().restore() };
  const chip = (cx, cy, s) => { const w = Math.max(14, s.length * 5 + 8); doc.save().lineWidth(.5).rect(cx - w / 2, cy - 4.5, w, 9).fillAndStroke('#ffffff', '#333333').restore(); R_txt(doc, s, cx - w / 2, cy - 3.2, w, 5.8) };
  const plus = (cx, cy, r = 3) => doc.save().lineWidth(.5).strokeColor('#8a97a3').moveTo(cx - r, cy).lineTo(cx + r, cy).moveTo(cx, cy - r).lineTo(cx, cy + r).stroke().restore();
  const arrow = (xa, xb, ya) => { const s = xb > xa ? 1 : -1; doc.save().lineWidth(.8).strokeColor('#1d4ed8').moveTo(xa, ya).lineTo(xb - s * 3, ya).stroke().fillColor('#1d4ed8').polygon([xb, ya], [xb - s * 4.5, ya - 2.2], [xb - s * 4.5, ya + 2.2]).fill().restore() };
  const handle = (hx, hy, hgt = 9) => doc.save().lineWidth(.5).roundedRect(hx - 1.2, hy - hgt / 2, 2.4, hgt, 1.2).fillAndStroke('#ffffff', '#3a4757').restore();
  const lever = (ax, ay, dr) => { const L = Math.min(13, Math.max(7, ww * .05)); doc.save().lineWidth(.5).roundedRect(dr > 0 ? ax : ax - L, ay - 1.2, L, 2.4, 1.2).fillAndStroke('#ffffff', '#3a4757'); doc.roundedRect(dr > 0 ? ax - t3 * 1.6 - 2.4 : ax + t3 * 1.6, ay - 4.5, 2.4, 9, 1.2).fillAndStroke('#ffffff', '#3a4757'); doc.restore() };
  const hatch = (gx, gy, gw, gh) => { doc.save().rect(gx, gy, gw, gh).clip().lineWidth(.35).strokeColor('#5d7080'); for (let t = -gh; t < gw; t += 4.2) { doc.moveTo(gx + t, gy).lineTo(gx + t + gh, gy + gh).stroke(); doc.moveTo(gx + t + gh, gy).lineTo(gx + t, gy + gh).stroke() } doc.restore() };
  // mitred profile frame helper (like the demo's drawings)
  const U = Math.min(ww, hh), t1 = Math.max(2.6, Math.min(7, U * .036)), t2 = Math.max(2.6, Math.min(7.5, U * .05)), t3 = Math.max(1.2, t2 * .4), dk = '#3a4757';
  const mframe = (fx, fy, fw, fh, t, fill = '#f8f9fa') => { doc.save().lineWidth(.55).rect(fx, fy, fw, fh).fillAndStroke(fill, dk); doc.lineWidth(.3).strokeColor('#7f8b98').rect(fx + t * .5, fy + t * .5, fw - t, fh - t).stroke(); doc.lineWidth(.5).strokeColor(dk).rect(fx + t, fy + t, fw - 2 * t, fh - 2 * t).stroke(); doc.lineWidth(.4).moveTo(fx, fy).lineTo(fx + t, fy + t).moveTo(fx + fw, fy).lineTo(fx + fw - t, fy + t).moveTo(fx, fy + fh).lineTo(fx + t, fy + fh - t).moveTo(fx + fw, fy + fh).lineTo(fx + fw - t, fy + fh - t).stroke(); doc.restore() };
  mframe(x0, y0, ww, hh, t1, '#f3f5f7');
  const fr = t1, ix = x0 + fr, iy = y0 + fr, iw = ww - 2 * fr, ih = hh - 2 * fr;
  if (d.kind === 'sliding') {
    const n = d.panels || 2, ctr = n === 3 && !!(d.centre || d.mesh), cnt = ctr ? 3 : n, dw = Array.isArray(d.widths) && d.widths.length === cnt ? d.widths.map(Number) : (ctr ? [.25, .5, .25] : Array(n).fill(1)), ts = dw.reduce((a, b) => a + b, 0);
    const meshN = d.mesh ? (+d.mesh > 1 ? +d.mesh : 1) : 0, meshAt = i => meshN && (ctr ? (i === 0 || i === 2) : meshN >= 2 ? (i === 0 || i === cnt - 1) : i === cnt - 1);
    let cx = ix; for (let i = 0; i < cnt; i++) { const lw = iw * dw[i] / ts, dir = ctr ? (i === 0 ? 1 : i === 2 ? -1 : 0) : (i % 2 ? -1 : 1), lab = ctr ? ['S1', 'F1', 'S2'][i] : 'S' + (i + 1);
      const st = t2 * .78; mframe(cx, iy, lw, ih, st, dir ? '#fbfbfc' : '#f3f5f7'); const gx = cx + st + t3 * .5, gy = iy + st + t3 * .5, gw = lw - 2 * st - t3, gh = ih - 2 * st - t3; glass(gx, gy, gw, gh);
      if (dir) { doc.save().fillOpacity(.55).fillColor('#7d8896').rect(dir > 0 ? gx + gw - t3 * 1.1 : gx, gy, t3 * 1.1, gh).fill().restore() }
      if (meshAt(i)) hatch(gx, gy, gw, gh);
      chip(cx + lw / 2, gy + 9, lab); if (meshAt(i)) R_txt(doc, 'MESH', cx, gy + 15, lw, 5.6, '#6e7681');
      if (dir) { arrow(dir > 0 ? cx + lw * .2 : cx + lw * .8, dir > 0 ? cx + lw * .8 : cx + lw * .2, gy + gh / 2); handle(dir > 0 ? cx + st * .5 : cx + lw - st * .5, gy + gh / 2) } else plus(cx + lw / 2, gy + gh / 2);
      cx += lw }
  } else if (d.bay) {
    const a = x0, b = x0 + ww * .26, c = x0 + ww * .74, e = x0 + ww; [[[a, y0 + hh * .08], [b, y0], [b, y0 + hh], [a, y0 + hh * .92]], [[b, y0], [c, y0], [c, y0 + hh], [b, y0 + hh]], [[c, y0], [e, y0 + hh * .08], [e, y0 + hh * .92], [c, y0 + hh]]].forEach((p, i) => { doc.save().lineWidth(.7).polygon(...p).fillAndStroke('#cfe5f3', ink).restore(); const mx = (p[0][0] + p[2][0]) / 2; chip(mx, y0 + hh * .12 + 9, 'B' + (i + 1)) })
  } else {
    const cols = d.cols && d.cols.length ? d.cols : [{ w: 1, rows: [{ h: 1, op: 'FIXED' }] }], tw = cols.reduce((a, c) => a + c.w, 0) || 1; let cx = ix, idx = 0, fi = 0;
    cols.forEach(c => { const cw = iw * c.w / tw, th = c.rows.reduce((a, r) => a + r.h, 0) || 1; let cy = iy; c.rows.forEach(r => { const ch = ih * r.h / th, op = r.op || 'FIXED', open = !/FIXED|LOUVRE|FAN/.test(op); idx++;
      const st2 = open ? t2 : t2 * .8; mframe(cx, cy, cw, ch, st2, open ? '#fbfbfc' : '#f3f5f7'); const gx = cx + st2 + t3 * .5, gy = cy + st2 + t3 * .5, gw = cw - 2 * st2 - t3, gh = ch - 2 * st2 - t3; glass(gx, gy, gw, gh);
      const dash = () => doc.save().lineWidth(.5).dash(3, { space: 2 }).strokeColor('#444444');
      if (op === 'LH') { dash().moveTo(gx, gy).lineTo(gx + gw, gy + gh / 2).lineTo(gx, gy + gh).stroke().restore(); lever(gx + gw, gy + gh / 2, -1) }
      else if (op === 'RH') { dash().moveTo(gx + gw, gy).lineTo(gx, gy + gh / 2).lineTo(gx + gw, gy + gh).stroke().restore(); lever(gx, gy + gh / 2, 1) }
      else if (op === 'TOP') { dash().moveTo(gx, gy + gh).lineTo(gx + gw / 2, gy).lineTo(gx + gw, gy + gh).stroke().restore() }
      else if (op === 'TT') { dash().moveTo(gx + gw, gy).lineTo(gx, gy + gh / 2).lineTo(gx + gw, gy + gh).stroke().moveTo(gx, gy + gh).lineTo(gx + gw / 2, gy).lineTo(gx + gw, gy + gh).stroke().restore() }
      else if (op === 'LOUVRE') { doc.save().lineWidth(.5).strokeColor('#7ea3bf'); const nb = Math.max(3, Math.round(gh / 5)); for (let i = 1; i < nb; i++) doc.moveTo(gx, gy + gh * i / nb).lineTo(gx + gw, gy + gh * i / nb).stroke(); doc.restore() }
      else if (op === 'FAN') { doc.save().lineWidth(.7).strokeColor('#64748b').circle(gx + gw / 2, gy + gh / 2, Math.min(gw, gh) * .38).stroke().circle(gx + gw / 2, gy + gh / 2, Math.min(gw, gh) * .07).stroke().restore() }
      let lab; if (open) lab = 'C' + idx; else if (op === 'LOUVRE') lab = 'L' + idx; else if (op === 'FAN') lab = 'EF'; else lab = 'F' + (++fi); chip(cx + cw / 2, gy + 9, lab); if (op !== 'LOUVRE' && op !== 'FAN') plus(cx + cw / 2, gy + gh / 2 + (open ? 0 : 0));
      cy += ch }); cx += cw });
  }
  if (dims) { const ln = '#3b4652', yy = y0 + hh + 14, xx = x0 - 14, ar = (ax, ay, ux, uy) => doc.save().fillColor(ln).polygon([ax, ay], [ax + ux * 5 - uy * 1.8, ay + uy * 5 + ux * 1.8], [ax + ux * 5 + uy * 1.8, ay + uy * 5 - ux * 1.8]).fill().restore(), ext = (ax, ay, bx, by) => doc.save().lineWidth(.35).strokeColor(ln).moveTo(ax, ay).lineTo(bx, by).stroke().restore();
    const lbl = String(Math.round(W)), tw = lbl.length * 5.2 + 10; ext(x0, y0 + hh + 1, x0, yy + 5); ext(x0 + ww, y0 + hh + 1, x0 + ww, yy + 5); doc.save().lineWidth(.45).strokeColor(ln).moveTo(x0 + 4, yy).lineTo(x0 + ww / 2 - tw / 2, yy).moveTo(x0 + ww / 2 + tw / 2, yy).lineTo(x0 + ww - 4, yy).stroke().restore(); ar(x0, yy, 1, 0); ar(x0 + ww, yy, -1, 0); R_txt(doc, lbl, x0 + ww / 2 - 30, yy - 4.2, 60, 8.6, ln, 1);
    const lb2 = String(Math.round(H)), th = lb2.length * 5.2 + 10; ext(x0 - 1, y0, xx - 5, y0); ext(x0 - 1, y0 + hh, xx - 5, y0 + hh); doc.save().lineWidth(.45).strokeColor(ln).moveTo(xx, y0 + 4).lineTo(xx, y0 + hh / 2 - th / 2).moveTo(xx, y0 + hh / 2 + th / 2).lineTo(xx, y0 + hh - 4).stroke().restore(); ar(xx, y0, 0, 1); ar(xx, y0 + hh, 0, -1);
    doc.save().translate(xx, y0 + hh / 2).rotate(-90); R_txt(doc, lb2, -30, -4.2, 60, 8.6, ln, 1); doc.restore(); }
  return { x0, y0, ww, hh };
}
function R_txt(doc, s, x, y, w, size, color, bold) { doc.font(bold ? 'NB' : 'NB').fontSize(size).fillColor(color || '#222222').text(s, x, y, { width: w, align: 'center', lineBreak: false }) }

// ---- Quotation -------------------------------------------------------------------------------
function termsList(s) { return String(s || '').split(/\n+/).map(x => x.trim()).filter(Boolean).map(x => { const m = /^(\d+)\.\s*([^:]{1,40}):\s*([\s\S]*)$/.exec(x); return m ? { n: m[1], k: m[2], t: m[3] } : { n: '', k: '', t: x } }) }
function quotationPdf(c, V, lang) {
  const T_ = (T[lang] || T.en), tr = (k, en) => (lang !== 'en' && T_[k]) || en;
  const R = newDoc({ title: tr('quotation', 'Quotation'), number: c.number, customer: c.customer.name, printed: c.printed, lang }), { doc } = R;
  firstHeader(R, [{ t: `Dated ${c.date} · ${c.status}` }, { t: `Valid until ${c.validUntil} (${c.validDays} days)`, b: 1, c: COL.brown }]);
  tiles(R, [['Customer', c.customer.name || '—'], ['Windows', `${V.count} design${V.count === 1 ? '' : 's'} · ${V.units} unit${V.units === 1 ? '' : 's'}`], ['Total area', `${f2(V.area)} sq ft`], ['Average rate (excl. GST)', `INR ${f2(V.rateEx)} / sq ft`], ['Average rate (incl. GST)', `INR ${f2(V.rateInc)} / sq ft`]]);
  R.y += 4; if (c.intro) { R.txt(c.intro, R.mx, R.y, { w: R.cw, size: 9, gap: 4.2, color: '#333' }); R.y += R.h(c.intro, R.cw, { size: 9, gap: 4.2 }) + 8 }
  R.txt('Commercial saved quotation only. Not a production release.', R.mx, R.y, { size: 7.3, color: COL.brown }); R.y += 20;
  section(R, `Windows (${V.count})`, 'How to read the drawings: viewed from inside · sizes in mm · an arrow shows the direction a sliding sash opens · the dashed lines of an opening sash meet at its hinge side (the handle is on the opposite edge).');
  V.items.forEach(it => {
    const rows = [['Product', it.product], ['Size', `${it.w} × ${it.h} mm · ${f2(it.area)} sq ft each`], ...(it.frame ? [['Outer frame', it.frame]] : []), ...(it.sash ? [['Sash', it.sash]] : []), ['Glass', it.glass], ['Finish', it.finish]];
    const lw = 100, vw = 285 - lw - 12, rh = rows.map(r => Math.max(17.5, R.h(r[1], vw, { size: 8 }) + 9)), need_ = 28 + 17 + 5 * 17.5 + 10 + 17 + rh.reduce((a, b) => a + b, 0) + 20;
    need(R, Math.max(need_, 225)); const y0 = R.y;
    doc.rect(R.mx, y0, R.cw, 24).fill(COL.band); R.txt(`${it.mark}  ${it.name}`, R.mx + 8, y0 + 6, { b: 1, size: 11, color: COL.blue, w: R.cw - 16 });
    let y = y0 + 32; const lx = R.mx, lwid = 218; R.txt(`Assembly drawing / elevation · ${it.w} x ${it.h} mm · Ordered frame`, lx, y, { size: 7, color: COL.grey, w: lwid, gap: 2 }); const dy = y + 24;
    const g = dwg(doc, { w: it.w, h: it.h, d: it.d, type: it.type }, lx, dy, lwid, 170, { top: 1 }); const capY = g.y0 + g.hh + 40; R.txt('Cut-layout projection — not installed section geometry', lx, capY, { size: 6.5, color: COL.grey, w: lwid });
    const rx = R.mx + R.cw - 285, rw = 285; let ry = y;
    const hdr = t => { doc.rect(rx, ry, rw, 17).fill(COL.head); R.txt(t, rx + 6, ry + 5, { b: 1, size: 7.5, color: COL.blue }); ry += 17 };
    hdr('Price'); [['Unit price', INR(it.unit)], ['Quantity', String(it.qty)], ['Area per window', `${f2(it.area)} sq ft`], ['Price per sq ft', INR(it.perSqft)], ['Total value', `${INR(it.total)} (${f2(it.area * it.qty)} sq ft)`]].forEach(([k, v], i, a) => { const last = i === a.length - 1; if (last) doc.rect(rx, ry, rw, 17.5).fill(COL.tot); else if (i % 2) doc.rect(rx, ry, rw, 17.5).fill(COL.alt); R.txt(k, rx + 6, ry + 5, { size: 8, b: last }); R.txt(v, rx, ry + 5, { size: 8, b: last, w: rw - 8, align: 'right' }); ry += 17.5; doc.moveTo(rx, ry).lineTo(rx + rw, ry).lineWidth(.4).strokeColor(COL.line).stroke() });
    ry += 10; hdr('Specification'); rows.forEach((r, i) => { const h = rh[i]; if (i % 2) doc.rect(rx, ry, rw, h).fill(COL.alt); R.txt(r[0], rx + 6, ry + 5, { size: 8 }); R.txt(r[1], rx + lw, ry + 5, { size: 8, w: vw }); ry += h; doc.moveTo(rx, ry).lineTo(rx + rw, ry).lineWidth(.4).strokeColor(COL.line).stroke() });
    R.y = Math.max(ry, capY + 12) + 10; doc.moveTo(R.mx, R.y).lineTo(R.W - R.mx, R.y).lineWidth(.5).strokeColor(COL.rule).stroke(); R.y += 14;
  });
  newPage(R); section(R, 'Quotation summary');
  tbl(R, [{ h: 'Field', w: 3 }, { h: 'Saved value', w: 2, a: 'r' }], [['Total windows', String(V.count)], ['Total area (sq ft)', f2(V.area)], ['Item subtotal', INR(V.subtotal)], [`Discount (${V.discountPct}%)`, '-' + INR(V.discount)], ['CGST', INR(V.cgst)], ['SGST', INR(V.sgst)], ['Round off', INR(V.round)], { c: ['Grand total', INR(V.grand)], t: 'strong' }, ['Price per sq ft (before GST)', INR(V.rateEx)], ['Price per sq ft (after GST)', INR(V.rateInc)]], { size: 8.5, pad: 4, min: 15 });
  R.y += 6;
  if (c.payment) { section(R, 'Payment schedule'); R.txt(c.payment, R.mx, R.y, { w: R.cw, size: 8.6, gap: 4 }); R.y += R.h(c.payment, R.cw, { size: 8.6, gap: 4 }) + 12 }
  section(R, tr('terms', 'Terms & conditions'));
  termsList(c.terms).forEach(t => { const h = R.h((t.k ? t.k + ': ' : '') + t.t, R.cw - 26, { size: 8.6, gap: 3.4 }); need(R, h + 10); R.txt(t.n ? t.n + '.' : '', R.mx, R.y, { b: 1, size: 8.6, color: COL.blue });
    if (t.k) { doc.font('NB').fontSize(8.6).fillColor(COL.ink).text(t.k + ':', R.mx + 26, R.y, { width: R.cw - 26, continued: true, lineGap: 3.4 }); doc.font('N').text(' ' + t.t, { lineGap: 3.4 }) } else R.txt(t.t, R.mx + 26, R.y, { w: R.cw - 26, size: 8.6, gap: 3.4 }); R.y += h + 9 });
  R.y += 2; [['Warranty', c.warranty], ['Exclusions', c.exclusions]].forEach(([t, b]) => { if (!b) return; need(R, 70); section(R, t); R.txt(b, R.mx, R.y, { w: R.cw, size: 8.6, gap: 4 }); R.y += R.h(b, R.cw, { size: 8.6, gap: 4 }) + 10 });
  const bk = (c.company || {}).bank || {}, bank = [bk.account_name && 'A/c name: ' + bk.account_name, bk.account_number && 'A/c no: ' + bk.account_number, bk.ifsc && 'IFSC: ' + bk.ifsc, [bk.bank_name, bk.branch].filter(Boolean).join(', ')].filter(Boolean).join('  ·  '); if (bank) { need(R, 60); section(R, 'Bank details'); R.txt(bank, R.mx, R.y, { w: R.cw, size: 8.6 }); R.y += 24 }
  need(R, 150); section(R, 'Customer acceptance'); const bw = (R.cw - 14) / 2, by = R.y + 2;
  [[R.mx, 'For the fabricator'], [R.mx + bw + 14, 'Customer']].forEach(([x, t]) => { doc.save().lineWidth(.6).roundedRect(x, by, bw, 100, 4).stroke(COL.rule).restore(); R.txt(t, x + 10, by + 10, { b: 1, size: 8.4, color: COL.blue }) });
  R.txt('Signature and company stamp', R.mx + 10, by + 52, { size: 7, color: COL.grey }); R.txt('Authorized signatory for Fabricator:', R.mx + 10, by + 66, { size: 8.6 }); R.txt('____________________', R.mx + 10, by + 82, { size: 8.6, color: COL.grey });
  const cx = R.mx + bw + 24; R.txt(`Customer name: ${c.customer.name || ''}`, cx, by + 24, { size: 8.6 }); R.txt('Customer signature: ____________________', cx, by + 44, { size: 8.6 }); R.txt('Date: ____________________', cx, by + 64, { size: 8.6 }); R.y = by + 112;
  R.txt('Text uses licensed Noto Sans. Unsupported characters are shown explicitly as [U+XXXX].', R.mx, R.y, { size: 6.5, color: COL.grey });
  footers(R, 'Quotation'); return PDFEND(R);
}

// ---- Elevation Diagram Report (landscape, two windows per page) --------------------------------
const SERIES_NAME = d => { d = d || {}; if (d.bay) return 'Bay Window'; if (d.kind === 'sliding') return (d.door ? 'Sliding Door' : (['53', '80', '95'].includes(String(d.series)) ? 'Elite Sliding' : 'Premium Sliding')); if (d.door) return 'Casement Door'; if (d.cols && d.cols.every(c => c.rows.every(r => /LOUVRE|FAN/.test(r.op || '')))) return 'Ventilator'; return 'Casement' };
function elevationPdf(c, items, notes) {
  const R = newDoc({ title: 'Elevation Diagram Report', number: c.number, printed: c.printed, landscape: true }), { doc } = R;
  const head = () => { R.logoAt(R.W - R.mx - 62, 22, 62); R.txt('Elevation Diagram Report', R.mx, 46, { b: 1, size: 16, color: '#2f3b46' }); R.txt(c.number, R.mx, 52, { b: 1, size: 9, w: R.cw - 80, align: 'right' }); R.txt(`Project: ${c.project || '—'} | Customer: ${c.customer.name || '—'}`, R.mx, 76, { size: 8 }); R.txt(`Quotation date: ${c.date} | Status: ${c.status} | Total quantity: ${items.reduce((a, x) => a + x.qty, 0)} | Dimensions in mm`, R.mx, 90, { size: 8 }); doc.moveTo(R.mx, 108).lineTo(R.W - R.mx, 108).lineWidth(.8).strokeColor('#4a6785').stroke(); R.y = 117 };
  head(); const cardW = (R.cw - 10) / 2, cardH = 432;
  items.forEach((it, n) => { if (n && n % 2 === 0) { doc.addPage(); head() } const x = R.mx + (n % 2) * (cardW + 10), y = R.y;
    doc.save().lineWidth(.6).rect(x, y, cardW, cardH).stroke('#c5ced6').restore(); R.txt('View from inside', x + 7, y + 8, { size: 6.5 });
    dwg(doc, { w: it.w, h: it.h, d: it.d }, x + 6, y + 20, cardW - 12, 345);
    const by = y + cardH - 76; doc.moveTo(x, by).lineTo(x + cardW, by).lineWidth(.5).strokeColor('#c5ced6').stroke(); const c1 = x + 9, c2 = x + cardW / 2 + 4;
    [[c1, by + 11, `Design Ref: ${it.mark} | Qty: ${it.qty}`], [c2, by + 11, `Location: ${it.location || '—'}`], [c1, by + 27, `Design name: ${it.name}`], [c2, by + 27, `Size (W x H): ${it.w} x ${it.h} mm`], [c1, by + 43, `Series: ${SERIES_NAME(it.d)}`], [c2, by + 43, `Finish: ${it.finish || 'White'}`], [c1, by + 59, `Glass: ${String(it.glass || '').replace(/\s*clear glass$/i, '')}`], [c2, by + 59, `Mesh: ${it.hasMesh ? 'Yes' : 'No'}`]].forEach(([tx, ty, t]) => R.txt(t, tx, ty, { size: 7.2, w: cardW / 2 - 14, gap: 1 })) });
  if (notes && notes.length) { doc.addPage(); head(); R.txt('Report notes', R.mx, R.y + 2, { b: 1, size: 11, color: COL.blue }); R.y += 24; notes.forEach(t => { R.txt(t, R.mx, R.y, { size: 8, w: R.cw }); R.y += 14 }) }
  const n = doc.bufferedPageRange().count; for (let i = 0; i < n; i++) { doc.switchToPage(i); R.txt(`${c.number} | Page ${i + 1} of ${n}`, R.mx, R.H - 24, { size: 7, color: COL.grey, w: 300 }) }
  return PDFEND(R);
}

// ---- Costing sheet and Material requirement: one section list drives PDF, Excel and Word ----------
function costingSections(D) {
  const S = [], uni = a => a.length ? a.join(', ') : '—', qty = (v, u) => (u === 'pc' || u === 'lot') ? f0(v) : f2(v);
  S.push({ title: 'Cost summary — whole quotation', desc: 'Sum of every window’s saved cost heads × its quantity. Discount, transport, loading/unloading, GST and the grand total are the quotation’s saved commercial amounts.', cols: [{ h: 'Cost head', w: 28 }, { h: 'Basis', w: 33 }, { h: 'Amount (INR)', w: 15, a: 'r' }, { h: 'Per sq ft (INR)', w: 15, a: 'r' }, { h: '% of basic value', w: 14, a: 'r' }], rows: D.summary.map(r => ({ c: [r.label, r.basis, f2(r.value), f2(r.perSqft), r.pct.toFixed(1)], t: r.strong ? 'strong' : '' })) });
  const tr = D.items.reduce((a, x) => { Object.keys(x).forEach(k => { if (typeof x[k] === 'number' && !['w', 'h', 'perSqft', 'margin'].includes(k)) a[k] = (a[k] || 0) + x[k] }); return a }, {});
  S.push({ title: 'Window-wise cost estimate', desc: 'Amounts in INR for the full quantity of each window. Cost total = raw material + wastage + labour; net selling excludes GST.', small: 1, cols: [{ h: 'Ref', w: 4 }, { h: 'Window', w: 8.5 }, { h: 'Size mm', w: 7 }, { h: 'Qty', w: 3.5, a: 'r' }, { h: 'Sq ft', w: 5.5, a: 'r' }, { h: 'Profile', w: 8.5, a: 'r' }, { h: 'Reinf.', w: 8, a: 'r' }, { h: 'Hardware', w: 8, a: 'r' }, { h: 'Glass & mesh', w: 8, a: 'r' }, { h: 'Wastage', w: 8, a: 'r' }, { h: 'Labour', w: 8, a: 'r' }, { h: 'Other', w: 8, a: 'r' }, { h: 'Cost total', w: 9, a: 'r' }, { h: 'Cost / sq ft', w: 7, a: 'r' }, { h: 'Net selling', w: 9, a: 'r' }, { h: 'Margin %', w: 6.5, a: 'r' }],
    rows: [...D.items.map(x => [x.mark, x.name, `${x.w} x ${x.h}`, String(x.qty), f2(x.area), f2(x.profile), f2(x.reinf), f2(x.hw), f2(x.glassMesh), f2(x.waste), f2(x.labour), f2(x.other), f2(x.cost), f2(x.perSqft), f2(x.net), x.margin.toFixed(1)]), { c: ['Total', `${D.count} designs`, '', String(D.units), f2(D.area), f2(tr.profile), f2(tr.reinf), f2(tr.hw), f2(tr.glassMesh), f2(tr.waste), f2(tr.labour), f2(tr.other), f2(tr.cost), f2(D.area ? tr.cost / D.area : 0), f2(tr.net), (tr.net ? (tr.net - tr.cost) / tr.net * 100 : 0).toFixed(1)], t: 'strong' }] });
  const pt = D.profileLines.reduce((a, x) => a + x.amount, 0);
  S.push({ title: 'Profile costing', cols: [{ h: 'Code', w: 14 }, { h: 'Profile', w: 26 }, { h: 'Length m', w: 10, a: 'r' }, { h: 'Weight kg', w: 10, a: 'r' }, { h: 'Rate', w: 12, a: 'r' }, { h: 'Amount (INR)', w: 13, a: 'r' }, { h: 'Windows', w: 15 }], rows: [...D.profileLines.map(x => [x.code, x.name, f2(x.m), x.kg == null ? '—' : f2(x.kg), x.unit === 'm' ? `${f2(x.rate)}/m` : `${f2(x.rate)}/kg`, f2(x.amount), uni(x.w)]), { c: ['Total', '', '', '', '', f2(pt), ''], t: 'strong' }] });
  S.push({ title: 'Reinforcement costing', cols: [{ h: 'Code', w: 14 }, { h: 'Reinforcement', w: 26 }, { h: 'Length m', w: 10, a: 'r' }, { h: 'Weight kg', w: 10, a: 'r' }, { h: 'Rate', w: 12, a: 'r' }, { h: 'Amount (INR)', w: 13, a: 'r' }, { h: 'Windows', w: 15 }], rows: [...D.riLines.map(x => [x.code, x.name, f2(x.m), f2(x.kg), `${f2(x.rate)}/kg`, f2(x.amount), uni(x.w)]), { c: ['Total', '', '', '', '', f2(D.riLines.reduce((a, x) => a + x.amount, 0)), ''], t: 'strong' }] });
  S.push({ title: 'Hardware costing', cols: [{ h: 'Item', w: 40 }, { h: 'Qty', w: 9, a: 'r' }, { h: 'Unit', w: 7 }, { h: 'Rate', w: 13, a: 'r' }, { h: 'Amount (INR)', w: 14, a: 'r' }, { h: 'Windows', w: 17 }], rows: [...D.hwLines.map(x => [x.name, qty(x.qty, x.unit), x.unit, `${f2(x.rate)}/${x.unit}`, f2(x.amount), uni(x.w)]), { c: ['Total', '', '', '', f2(D.hwLines.reduce((a, x) => a + x.amount, 0)), ''], t: 'strong' }] });
  S.push({ title: 'Glass & mesh costing', cols: [{ h: 'Item', w: 30 }, { h: 'Area m²', w: 11, a: 'r' }, { h: 'Area sq ft', w: 11, a: 'r' }, { h: 'Rate', w: 14, a: 'r' }, { h: 'Amount (INR)', w: 14, a: 'r' }, { h: 'Windows', w: 16 }], rows: [...D.glassLines.map(x => [x.name, x.m2.toFixed(3), f2(x.sqft), `${f2(x.rate)}/m2`, f2(x.amount), uni(x.w)]), { c: ['Total', '', '', '', f2(D.glassLines.reduce((a, x) => a + x.amount, 0)), ''], t: 'strong' }] });
  S.push({ title: 'Internal costing', cols: [{ h: 'Design', w: 22 }, { h: 'Qty', w: 8 }, { h: 'Raw cost', w: 16 }, { h: 'Markup/wastage', w: 16 }, { h: 'Profit / total', w: 16 }, { h: 'Margin / note', w: 22 }], rows: [...D.items.map(x => [x.mark, String(x.qty), INR(x.cost), INR(x.net - x.cost), INR(x.net - x.cost), x.margin.toFixed(2) + '%']), ['quotation net (excl. GST)', '', '', '', INR(D.net), 'Frozen taxable subtotal; the basis for contribution and margin.'], ['quotation gross (incl. GST)', '', '', '', INR(D.gross), 'Frozen commercial total for reconciliation; GST is excluded from profit.']] });
  return S;
}
function materialSections(D) {
  const M = D.mat, S = [], uni = a => a.length ? a.join(', ') : '—', bt = M.bars.reduce((a, x) => { a.p += x.pieces; a.m += x.m; a.b += x.bars; a.bl += x.billing; a.kg += x.kg; return a }, { p: 0, m: 0, b: 0, bl: 0, kg: 0 });
  S.push({ title: 'Profile requirement', desc: `Default cutting, longest piece first, without bar optimisation. Bars counted on the stock lengths listed per material (default ${M.stock} mm), kerf 10 mm, trim 0 mm; weight is of the full bars bought (billing m × the pack’s kg/m). Waste % is saw loss + scrap; offcuts of 350 mm or more count as reusable stock, not waste.`, cols: [{ h: 'Code', w: 14 }, { h: 'Profile', w: 24 }, { h: 'Pieces', w: 8, a: 'r' }, { h: 'Cut length m', w: 10, a: 'r' }, { h: 'Bar length mm', w: 10, a: 'r' }, { h: 'Bars required', w: 9, a: 'r' }, { h: 'Billing m', w: 10, a: 'r' }, { h: 'Weight kg', w: 9, a: 'r' }, { h: 'Waste %', w: 7, a: 'r' }], rows: [...M.bars.map(x => [x.code, x.name, String(x.pieces), f2(x.m), String(x.len), String(x.bars), f2(x.billing), f2(x.kg), x.waste.toFixed(1)]), { c: ['Total', '', String(bt.p), f2(bt.m), '', String(bt.b), f2(bt.bl), f2(bt.kg), ''], t: 'strong' }] });
  const rt = M.riBars.reduce((a, x) => { a.p += x.pieces; a.m += x.m; a.b += x.bars; a.bl += x.billing; a.kg += x.kg; return a }, { p: 0, m: 0, b: 0, bl: 0, kg: 0 });
  S.push({ title: 'Reinforcement requirement', desc: `Default cutting, longest piece first, without bar optimisation. GI bars are ${M.stock} mm unless a length is set for the item; weight is of the full bars bought (billing m × kg/m).`, cols: [{ h: 'Host profile', w: 18 }, { h: 'GI thickness', w: 12 }, { h: 'Pieces', w: 9, a: 'r' }, { h: 'Cut length m', w: 11, a: 'r' }, { h: 'Bar length mm', w: 11, a: 'r' }, { h: 'Bars required', w: 9, a: 'r' }, { h: 'Billing m', w: 10, a: 'r' }, { h: 'Weight kg', w: 10, a: 'r' }, { h: 'Waste %', w: 8, a: 'r' }], rows: [...M.riBars.map(x => [x.host, `${x.thk} mm`, String(x.pieces), f2(x.m), String(x.len), String(x.bars), f2(x.billing), f2(x.kg), x.waste.toFixed(1)]), { c: ['Total', '', String(rt.p), f2(rt.m), '', String(rt.b), f2(rt.bl), f2(rt.kg), ''], t: 'strong' }] });
  S.push({ title: 'Glass, mesh & board requirement', cols: [{ h: 'Specification', w: 50 }, { h: 'Kind', w: 14 }, { h: 'Pieces', w: 14, a: 'r' }, { h: 'Area sq ft', w: 14, a: 'r' }], rows: M.glassReq.map(k => [k.spec, k.kind, String(k.pieces), f2(k.sqft)]) });
  const gz = []; M.glassReq.forEach(k => { gz.push({ c: [k.spec, '', '', '', '', ''], t: 'group' }); Object.values(k.sizes).sort((a, b) => b.w - a.w || b.h - a.h).forEach(z => gz.push([String(z.w), String(z.h), String(z.qty), f2(z.w * z.h / 92903.04), f2(z.w * z.h / 92903.04 * z.qty), uni(z.win)])) });
  S.push({ title: 'Glass sizes to order', cols: [{ h: 'Width mm', w: 16, a: 'c' }, { h: 'Height mm', w: 16, a: 'c' }, { h: 'Qty', w: 12, a: 'c' }, { h: 'Area each sq ft', w: 18, a: 'c' }, { h: 'Total sq ft', w: 16, a: 'c' }, { h: 'Windows', w: 22 }], rows: gz });
  S.push({ title: 'Hardware & accessories requirement', desc: 'Totals already include each window’s quantity.', cols: [{ h: 'Item', w: 62 }, { h: 'Qty', w: 10, a: 'r' }, { h: 'Unit', w: 8 }, { h: 'Used in', w: 20 }], rows: M.hw.map(x => [x.name, x.unit === 'pc' ? f0(x.qty) : (+x.qty.toFixed(3)).toString(), x.unit, uni(x.w)]) });
  return S;
}
function trackingSections(T) {
  const n = v => v == null ? '—' : (+v).toLocaleString('en-IN', { maximumFractionDigits: 3 }), S = [];
  S.push({ title: 'Quoted, in process, completed and balance', desc: 'In process includes windows entered in draft batches. Completed includes dispatched windows. Balance is quoted quantity not yet entered in any work order. Still to supply means quoted windows not yet dispatched.', cols: [{ h: 'Ref', w: 8 }, { h: 'Window', w: 30 }, { h: 'Quoted', w: 10, a: 'r' }, { h: 'In process', w: 10, a: 'r' }, { h: 'Completed', w: 10, a: 'r' }, { h: 'Balance to allocate', w: 11, a: 'r' }, { h: 'Dispatched', w: 10, a: 'r' }, { h: 'Still to supply', w: 11, a: 'r' }], rows: [...T.rows.map(r => [r.mark, r.name, String(r.quoted), String(r.inProcess), String(r.completed), String(r.balance), String(r.dispatched), String(r.still)]), { c: ['TOTAL', '', ...['quoted', 'inProcess', 'completed', 'balance', 'dispatched', 'still'].map(k => String(T.total[k] || 0))], t: 'strong' }] });
  S.push({ title: 'Projected and actual costs by head', desc: 'Actual manufacturing cost uses saved material requirements and current rates frozen when each work order starts production. Variance compares the same started quantity; a positive amount means increased cost.', small: 1, cols: [{ h: 'Cost head', w: 22 }, { h: 'Projected full quotation', w: 13, a: 'r' }, { h: 'Projected started qty', w: 13, a: 'r' }, { h: 'Actual started qty', w: 13, a: 'r' }, { h: 'Started variance', w: 13, a: 'r' }, { h: 'Projected supplied qty', w: 13, a: 'r' }, { h: 'Actual supplied qty', w: 13, a: 'r' }], rows: T.costRows.map(r => ({ c: [r.label, INRc(r.full), INRc(r.started), INRc(r.actualStarted), INRc(r.variance), INRc(r.supplied), INRc(r.actualSupplied)], t: r.strong ? 'strong' : '' })) });
  const p = T.profit; S.push({ title: 'Window manufacturing profit', desc: 'Profit is realized as work orders are dispatched, using pro-rata quoted selling values for those windows. GST and separately quoted project charges are excluded.', cols: [{ h: 'Measure', w: 30 }, { h: 'Projected full quotation', w: 20, a: 'r' }, { h: 'Projected supplied quantity', w: 20, a: 'r' }, { h: 'Actual supplied quantity', w: 20, a: 'r' }], rows: [['Net window revenue', INRc(p.rev), INRc(p.revSupplied), INRc(p.revSupplied)], ['Manufacturing cost', INRc(p.cost), INRc(p.costSupplied), INRc(p.costSupplied)], ['Profit', INRc(p.profit), INRc(p.profitSupplied), INRc(p.profitSupplied)], ['Profit margin (%)', p.margin == null ? 'Unavailable' : p.margin.toFixed(1), p.marginSupplied == null ? 'Unavailable' : p.marginSupplied.toFixed(1), p.marginSupplied == null ? 'Unavailable' : p.marginSupplied.toFixed(1)]] });
  S.push({ title: 'Materials and supplies', desc: 'Supply progress follows associated work-order completion and dispatch. Stock issued is shown separately and does not prove customer delivery.', small: 1, cols: [{ h: 'Material / supply', w: 34 }, { h: 'Unit', w: 5 }, { h: 'Quoted', w: 9, a: 'r' }, { h: 'Allocated', w: 9, a: 'r' }, { h: 'In process', w: 8, a: 'r' }, { h: 'Completed', w: 8, a: 'r' }, { h: 'Supplied', w: 8, a: 'r' }, { h: 'Balance to allocate', w: 9, a: 'r' }, { h: 'Still to supply', w: 9, a: 'r' }], rows: T.materials.map(m => [m.label, m.unit, n(m.quoted), n(m.allocated), n(m.inProcess), n(m.completed), n(m.supplied), n(m.balance), n(m.still)]) });
  return S;
}
async function reportDoc(kind, fmt, c, D) {
  const costing = kind === 'costing', trk = kind === 'tracking', title = costing ? 'Costing sheet' : trk ? 'Project Tracking' : 'Material requirement', S = costing ? costingSections(D) : trk ? trackingSections(D) : materialSections(D), tr = D.tiles, docId = `quotation/${c.id}/production/${kind}`;
  if (fmt === 'xlsx') { const wb = new ExcelJS.Workbook(); S.forEach(s => { const ws = wb.addWorksheet(s.title.replace(/[\\/?*\[\]:]/g, '-').slice(0, 30)); ws.addRow([`${title} · ${c.number} · ${c.customer.name || ''}`]).font = { bold: true, size: 13 }; ws.addRow([s.title]).font = { bold: true, size: 11, color: { argb: 'FF4A6785' } }; if (s.desc) { const r = ws.addRow([s.desc]); r.font = { size: 9, color: { argb: 'FF666666' } } } ws.addRow([]);
      const h = ws.addRow(s.cols.map(x => x.h)); h.font = { bold: true, color: { argb: 'FF4A6785' } }; h.eachCell(x => { x.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFDDE6EE' } } });
      s.rows.forEach(r => { const row = ws.addRow(Array.isArray(r) ? r : r.c); if (!Array.isArray(r) && (r.t === 'strong' || r.t === 'group')) row.font = { bold: true }; s.cols.forEach((cl, i) => { if (cl.a === 'r') row.getCell(i + 1).alignment = { horizontal: 'right' } }) });
      s.cols.forEach((cl, i) => { ws.getColumn(i + 1).width = Math.max(12, Math.min(48, cl.w * 1.5)) }); ws.pageSetup = { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'landscape', paperSize: 9 } }); return Buffer.from(await wb.xlsx.writeBuffer()) }
  if (fmt === 'docx') { const cell = (t, b, fill) => new D_.TableCell({ shading: fill ? { type: D_.ShadingType.CLEAR, fill } : undefined, children: [new D_.Paragraph({ children: [new D_.TextRun({ text: String(t), bold: b, size: 16 })] })] }); const kids = [new D_.Paragraph({ children: [new D_.TextRun({ text: `${title} · ${c.number}`, bold: true, size: 30 })] })];
    S.forEach(s => { kids.push(new D_.Paragraph({ spacing: { before: 240 }, children: [new D_.TextRun({ text: s.title, bold: true, size: 22, color: '4A6785' })] })); if (s.desc) kids.push(new D_.Paragraph({ children: [new D_.TextRun({ text: s.desc, size: 15, color: '666666' })] })); kids.push(new D_.Table({ rows: [new D_.TableRow({ tableHeader: true, children: s.cols.map(x => cell(x.h, true, 'DDE6EE')) }), ...s.rows.map(r => new D_.TableRow({ children: (Array.isArray(r) ? r : r.c).map(v => cell(v, !Array.isArray(r) && r.t === 'strong')) }))] })) });
    return Buffer.from(await D_.Packer.toBuffer(new D_.Document({ sections: [{ properties: { page: { size: { orientation: D_.PageOrientation.LANDSCAPE } } }, children: kids }] }))) }
  const R = newDoc({ title, number: c.number, customer: c.customer.name, printed: c.printed }), { doc } = R;
  firstHeader(R, [{ t: `Dated ${c.date} · ${c.status}` }]);
  if (trk) { tiles(R, [['Quoted', String(D.tiles.quoted)], ['In process', String(D.tiles.inProcess)], ['Completed', String(D.tiles.completed)], ['Supplied / dispatched', String(D.tiles.dispatched)], ['Balance to allocate', String(D.tiles.balance)], ['Still to supply (quoted windows)', String(D.tiles.still)]]) } else
  tiles(R, [['Customer', c.customer.name || '—'], ['Windows', `${D.count} design${D.count === 1 ? '' : 's'} · ${D.units} unit${D.units === 1 ? '' : 's'}`], ...(costing ? [['Total area', `${f2(D.area)} sq ft`], ['Cost total', INRc(tr.cost)], ['Net selling', INRc(tr.net)], ['Contribution', INRc(tr.contribution)], ['Margin', `${tr.margin.toFixed(1)} %`], ['Wastage', `${INRc(tr.wastage)} · ${tr.wastePct.toFixed(1)} % of cost`]] : [['Profile bars', String(D.mat.profileBars)], ['GI bars', String(D.mat.giBars)], ['Glass area', `${f2(D.mat.glassArea)} sq ft`], ['Stock length', `${D.mat.stock} mm`]])]);
  R.txt('Pre-production estimate from the quotation\'s current designs; not a frozen work-order release.', R.mx, R.y + 2, { size: 7.3, color: COL.brown }); R.y += 22;
  S.forEach((s, i) => { if (i) newPage(R); section(R, s.title, s.desc); tbl(R, s.cols, s.rows, s.small ? { size: 5.8, hsize: 5.4, pad: 4, min: 16, hp: 1.6 } : {}) });
  footers(R, title, docId); return PDFEND(R);
}

const ex_ = m => m.extra || {}, co_ = m => ex_(m).company || {};
const info = m => { const ex = ex_(m), co = co_(m), bk = co.bank || {}, pt = Array.isArray(ex.payment) && ex.payment[0] ? ex.payment[0].terms : '';
  return { co, ex, lines: { company: [co.name || 'FenstraWorks', co.address, co.registered && co.gstin ? 'GSTIN: ' + co.gstin : '', [co.phone, co.email].filter(Boolean).join(' · ')].filter(Boolean),
    cust: [(ex.cust || {}).name, (ex.cust || {}).address, (ex.cust || {}).phone, (ex.cust || {}).email].filter(Boolean),
    secs: [['Payment terms', pt], ['Warranty', ex.warranty], ['Exclusions', ex.exclusions], ['Bank details', [bk.account_name && 'A/c name: ' + bk.account_name, bk.account_number && 'A/c no: ' + bk.account_number, bk.ifsc && 'IFSC: ' + bk.ifsc, [bk.bank_name, bk.branch].filter(Boolean).join(', ')].filter(Boolean).join('  ·  ')]].filter(x => x[1]) } } };
async function xlsx(m) {
  const { ex, lines } = info(m), wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(String(m.number).slice(0, 30), { pageSetup: { fitToPage: true, fitToWidth: 1, fitToHeight: 0, orientation: 'portrait', paperSize: 9 } });
  ws.columns = [{ width: 6 }, { width: 46 }, { width: 16 }, { width: 14 }, { width: 8 }, { width: 14 }, { width: 16 }];
  const merge = (v, o = {}) => { const row = ws.addRow([v]); ws.mergeCells(`A${row.number}:G${row.number}`); Object.assign(row.getCell(1), o); return row };
  lines.company.forEach((l, i) => merge(l, { font: i === 0 ? { bold: true, size: 16, color: { argb: 'FF20395A' } } : { size: 9, color: { argb: 'FF555555' } } }));
  merge(m.title, { font: { bold: true, size: 13 }, alignment: { horizontal: 'right' } });
  if (ex.date) merge('Date: ' + ex.date + (ex.validity ? `   ·   Valid for ${ex.validity} days` : ''), { alignment: { horizontal: 'right' }, font: { size: 9 } });
  ws.addRow([]); merge('Quotation for', { font: { bold: true } }); lines.cust.forEach(l => merge(l));
  merge('Project: ' + [(m.head[0] || [])[1], ex.site].filter(Boolean).join(' · '), { font: { bold: true } });
  if (ex.intro) merge(ex.intro, { alignment: { wrapText: true, vertical: 'top' }, font: { size: 9 } }).height = 40;
  ws.addRow([]);
  const h = ws.addRow([m.L.no, m.L.item, m.L.size, m.L.area, m.L.qty, m.L.rate, m.L.amount]); h.font = { bold: true }; h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } }; c.border = { bottom: { style: 'thin' } } });
  const its = ex.items || [];
  m.rows.forEach((r, n) => { const w = its[n] || {}, a = w.w && w.h ? +(w.w * w.h / 92903.04).toFixed(2) : ''; const row = ws.addRow([r[0], r[1], r[2], a, r[3], r[4], r[5]]); row.alignment = { vertical: 'top', wrapText: true }; row.height = 44; row.getCell(6).numFmt = '#,##0.00'; row.getCell(7).numFmt = '#,##0.00' });
  ws.addRow([]); m.sums.forEach(([k, v]) => { const r = ws.addRow(['', '', '', '', '', k, v]); r.getCell(7).numFmt = '#,##0.00'; if (k === m.L.total) { r.font = { bold: true, size: 12 } } });
  ws.addRow([]); merge(m.L.terms, { font: { bold: true } }); if (m.terms) merge(m.terms, { alignment: { wrapText: true, vertical: 'top' }, font: { size: 9 } }).height = 60;
  lines.secs.forEach(([t, b]) => { merge(t, { font: { bold: true } }); merge(b, { alignment: { wrapText: true, vertical: 'top' }, font: { size: 9 } }).height = 30 });
  merge('For ' + (co_(m).name || 'FenstraWorks') + ' · Authorised signatory', { alignment: { horizontal: 'right' } });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
async function docx(m) {
  const { ex, lines } = info(m), P = (t, o = {}, p = {}) => new D.Paragraph({ ...p, children: [new D.TextRun({ text: String(t), ...o })] });
  const cell = (t, o = {}, w, al) => new D.TableCell({ width: w ? { size: w, type: D.WidthType.DXA } : undefined, shading: o.fill ? { type: D.ShadingType.CLEAR, fill: o.fill } : undefined, margins: { top: 40, bottom: 40, left: 80, right: 80 }, children: String(t).split('\n').map(s => P(s, { size: 18, ...o }, al ? { alignment: al } : {})) });
  const W = [500, 3700, 1200, 800, 1200, 1300], R = D.AlignmentType.RIGHT;
  const rows = [new D.TableRow({ tableHeader: true, children: [m.L.no, m.L.item, m.L.size, m.L.qty, m.L.rate, m.L.amount].map((t, i) => cell(t, { bold: true, fill: 'EEF2F7' }, W[i], i >= 3 ? R : undefined)) }),
    ...m.rows.map(r => new D.TableRow({ children: [r[0], r[1], r[2], r[3], inr(r[4]), inr(r[5])].map((c, i) => cell(c, {}, W[i], i >= 3 ? R : undefined)) })),
    ...m.sums.map(([k, v]) => new D.TableRow({ children: [cell('', {}, W[0]), cell('', {}, W[1]), cell('', {}, W[2]), cell('', {}, W[3]), cell(k, { bold: k === m.L.total }, W[4], R), cell(inr(v), { bold: k === m.L.total }, W[5], R)] }))];
  const kids = [...lines.company.map((l, i) => i === 0 ? P(l, { bold: true, size: 34, color: '20395A' }) : P(l, { size: 17, color: '555555' })), P(m.title, { bold: true, size: 26 }, { alignment: R }),
    ...(ex.date ? [P('Date: ' + ex.date + (ex.validity ? `  ·  Valid for ${ex.validity} days` : ''), { size: 17, color: '555555' }, { alignment: R })] : []), P(''),
    P('Quotation for', { bold: true, size: 18 }), ...lines.cust.map(l => P(l, { size: 18 })), P('Project: ' + [(m.head[0] || [])[1], ex.site].filter(Boolean).join(' · '), { bold: true, size: 18 }), P(''),
    ...(ex.intro ? [P(ex.intro, { size: 17, color: '444444' }), P('')] : []), new D.Table({ width: { size: 8700, type: D.WidthType.DXA }, rows }), P(''), P(m.L.terms, { bold: true, size: 18 }), ...String(m.terms || '').split('\n').map(l => P(l, { size: 16 })),
    ...lines.secs.flatMap(([t, b]) => [P(''), P(t, { bold: true, size: 18 }), ...String(b).split('\n').map(l => P(l, { size: 16 }))]), P(''), P('For ' + (co_(m).name || 'FenstraWorks') + ' · Authorised signatory', { size: 17 }, { alignment: R })];
  return Buffer.from(await D.Packer.toBuffer(new D.Document({ sections: [{ properties: { page: { margin: { top: 720, bottom: 720, left: 900, right: 900 } } }, children: kids }] })));
}
async function table(fmt, title, head, rows, number) {
  if (fmt === 'xlsx') { const wb = new ExcelJS.Workbook(), ws = wb.addWorksheet(title.slice(0, 30)); ws.addRow([title + ' - ' + number]).font = { bold: true, size: 13 }; const h = ws.addRow(head); h.font = { bold: true }; h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } } }); rows.forEach(r => ws.addRow(r)); ws.columns.forEach(c => c.width = 22); return Buffer.from(await wb.xlsx.writeBuffer()) }
  if (fmt === 'docx') { const c = (t, b) => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: String(t), bold: b, size: 18 })] })] });
    return Buffer.from(await D.Packer.toBuffer(new D.Document({ sections: [{ children: [new D.Paragraph({ children: [new D.TextRun({ text: `${title} - ${number}`, bold: true, size: 28 })] }), new D.Table({ rows: [new D.TableRow({ children: head.map(h => c(h, true)) }), ...rows.map(r => new D.TableRow({ children: r.map(x => c(x)) }))] })] }] }))) }
  const d = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' }), done = collect(d);
  d.fontSize(15).text(`${title} - ${number}`).moveDown(.5); const cw = 770 / head.length; let y = d.y + 4; d.fontSize(8.5).font('Helvetica-Bold'); head.forEach((h, i) => d.text(h, 36 + i * cw, y, { width: cw - 6 })); d.font('Helvetica'); y += 16;
  rows.forEach(r => { if (y > 540) { d.addPage(); y = 40 } r.forEach((c, i) => d.text(String(c), 36 + i * cw, y, { width: cw - 6, height: 12, ellipsis: true })); y += 15 }); d.end(); return done;
}
async function multi(fmt, title, number, secs) {
  if (fmt === 'xlsx') { const wb = new ExcelJS.Workbook(); secs.forEach(([t, head, rows]) => { const ws = wb.addWorksheet(t.replace(/[\\/?*\[\]:]/g, '-').slice(0, 30)); ws.addRow([`${t} - ${number}`]).font = { bold: true, size: 13 }; const h = ws.addRow(head); h.font = { bold: true }; h.eachCell(c => { c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF2F7' } } }); rows.forEach(r => ws.addRow(r)); ws.columns.forEach(c => c.width = 20) }); return Buffer.from(await wb.xlsx.writeBuffer()) }
  if (fmt === 'docx') { const c = (t, b) => new D.TableCell({ children: [new D.Paragraph({ children: [new D.TextRun({ text: String(t), bold: b, size: 16 })] })] }); const kids = [new D.Paragraph({ children: [new D.TextRun({ text: `${title} - ${number}`, bold: true, size: 32 })] })];
    secs.forEach(([t, head, rows]) => { kids.push(new D.Paragraph({ spacing: { before: 300 }, children: [new D.TextRun({ text: t, bold: true, size: 24, color: '4A6785' })] }), new D.Table({ rows: [new D.TableRow({ tableHeader: true, children: head.map(h => c(h, true)) }), ...(rows.length ? rows : [head.map((_, i) => i ? '' : 'No entries')]).map(r => new D.TableRow({ children: r.map(x => c(x)) }))] })) });
    return Buffer.from(await D.Packer.toBuffer(new D.Document({ sections: [{ properties: { page: { size: { orientation: D.PageOrientation.LANDSCAPE } } }, children: kids }] }))) }
  const d = new PDFDocument({ margin: 36, size: 'A4', layout: 'landscape' }), done = collect(d);
  d.fontSize(20).text(title).fontSize(11).fillColor('#555').text(number).fillColor('#000').moveDown(.6); d.fontSize(10);
  secs.forEach(([t, head, rows], k) => { if (k) d.addPage(); d.fontSize(14).font('Helvetica-Bold').text(`${k + 1}. ${t}`).font('Helvetica'); const cw = 770 / head.length; let y = d.y + 6; d.fontSize(8.5).font('Helvetica-Bold'); head.forEach((h, i) => d.text(h, 36 + i * cw, y, { width: cw - 6 })); d.font('Helvetica'); y += 16;
    (rows.length ? rows : [['No entries']]).forEach(r => { if (y > 540) { d.addPage(); y = 40 } r.forEach((c, i) => d.text(String(c), 36 + i * cw, y, { width: cw - 6, height: 12, ellipsis: true })); y += 15 }) });
  d.end(); return done;
}
function invoice(inv, co, inWords) {
  const bank = co.bank || {};
  const d = new PDFDocument({ margin: 36, size: 'A4' }), done = collect(d);
  const m = n => 'Rs ' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }), L = 36, Rr = 559, Wd = Rr - L;
  const img = v => { try { return v && v.startsWith('data:') ? Buffer.from(v.split(',')[1], 'base64') : null } catch (e) { return null } };
  const logo = img(co.logo); let y = 36;
  if (logo) { try { d.image(logo, L, y, { height: 40 }) } catch (e) {} }
  d.font('Helvetica-Bold').fontSize(16).fillColor('#111').text(co.name || 'FenstraWorks', logo ? L + 120 : L, y, { width: 300 }); d.font('Helvetica').fontSize(8.5).fillColor('#555').text([co.address, co.registered && co.gstin ? 'GSTIN: ' + co.gstin : '', co.phone, co.email].filter(Boolean).join('\n'), logo ? L + 120 : L, d.y + 2, { width: 300 });
  d.font('Helvetica-Bold').fontSize(15).fillColor(inv.status === 'cancelled' ? '#b91c1c' : '#111').text(inv.status === 'cancelled' ? 'TAX INVOICE (CANCELLED)' : 'TAX INVOICE', 360, y, { width: Rr - 360, align: 'right' });
  y = Math.max(d.y, 100) + 10; d.moveTo(L, y).lineTo(Rr, y).strokeColor('#d1d5db').stroke(); y += 10;
  const meta = [['Invoice no', inv.number], ['Invoice date', inv.invoice_date || ''], ['Due date', inv.due_date || ''], ['Reference', inv.reference || '-'], ['Vehicle no', inv.vehicle || '-'], ['Driver', [inv.driver, inv.driver_phone].filter(Boolean).join(' · ') || '-']];
  d.font('Helvetica-Bold').fontSize(9).fillColor('#111').text('Bill to', L, y); d.font('Helvetica').fontSize(9).fillColor('#333').text([inv.customer, inv.caddress, inv.cstate && 'State: ' + inv.cstate, inv.customer_gst === 'registered' && inv.cgstin ? 'GSTIN: ' + inv.cgstin : 'Unregistered customer', inv.cphone].filter(Boolean).join('\n'), L, y + 13, { width: 250 });
  meta.forEach(([k, v], i) => { d.font('Helvetica-Bold').fontSize(8.5).fillColor('#555').text(k, 330, y + i * 14, { width: 80 }); d.font('Helvetica').fillColor('#111').text(String(v), 412, y + i * 14, { width: Rr - 412 }) });
  y = Math.max(d.y, y + 6 * 14) + 14;
  const cols = [['#', L, 22], ['Description', L + 24, 190], ['HSN/SAC', L + 216, 52], ['Unit', L + 270, 34], ['Qty', L + 306, 44], ['Rate', L + 352, 70], ['Value', L + 424, 99]];
  d.rect(L, y - 3, Wd, 16).fill('#f1f5f9'); d.fillColor('#374151').font('Helvetica-Bold').fontSize(8.5); cols.forEach(([t, x, w]) => d.text(t, x, y, { width: w, align: ['Qty', 'Rate', 'Value'].includes(t) ? 'right' : 'left' })); y += 18; d.font('Helvetica').fillColor('#111');
  inv.items.forEach((x, n) => { const h = Math.max(14, d.heightOfString(String(x.desc || ''), { width: 190, fontSize: 8.5 }) + 4); if (y + h > 740) { d.addPage(); y = 40 }
    d.fontSize(8.5).text(String(n + 1), L, y, { width: 22 }).text(String(x.desc || ''), L + 24, y, { width: 190 }).text(x.hsn || '', L + 216, y, { width: 52 }).text(x.unit || '', L + 270, y, { width: 34 }).text(String(x.qty), L + 306, y, { width: 44, align: 'right' }).text(m(x.price), L + 352, y, { width: 70, align: 'right' }).text(m((+x.qty || 0) * (+x.price || 0)), L + 424, y, { width: 99, align: 'right' });
    y += h; d.moveTo(L, y - 2).lineTo(Rr, y - 2).strokeColor('#eef2f7').stroke() });
  if (y > 640) { d.addPage(); y = 40 } y += 8;
  const row = (k, v, bold) => { d.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(bold ? 11 : 9).fillColor('#111').text(k, 360, y, { width: 100 }).text(v, 460, y, { width: Rr - 460, align: 'right' }); y += bold ? 18 : 14 };
  row('Taxable value', m(inv.taxable)); if (inv.igst) row(`IGST ${inv.gst_rate}%`, m(inv.igst)); else { row(`CGST ${inv.gst_rate / 2}%`, m(inv.cgst)); row(`SGST ${inv.gst_rate / 2}%`, m(inv.sgst)) }
  if (inv.round_off) row('Round off', m(inv.round_off)); d.moveTo(360, y).lineTo(Rr, y).strokeColor('#111').stroke(); y += 6; row('Total', m(inv.total), true);
  d.font('Helvetica-Bold').fontSize(8.5).text('Amount in words: ', L, y - 36, { continued: true, width: 300 }).font('Helvetica').text(inWords(inv.total), { width: 300 });
  y += 14; d.font('Helvetica-Bold').fontSize(9).text('Bank details', L, y); d.font('Helvetica').fontSize(8.5).fillColor('#333').text([bank.account_name && 'A/c name: ' + bank.account_name, bank.account_number && 'A/c no: ' + bank.account_number, bank.ifsc && 'IFSC: ' + bank.ifsc, [bank.bank_name, bank.branch].filter(Boolean).join(', ')].filter(Boolean).join('\n') || '-', L, y + 13, { width: 250 });
  const upi = img(co.upi); if (upi) { try { d.image(upi, 300, y, { width: 70 }) } catch (e) {} }
  d.font('Helvetica').fontSize(8).fillColor('#555').text('This is a computer-generated invoice. Please confirm HSN/SAC and GST rate with your accountant.', L, 770, { width: Wd * .6 }); d.font('Helvetica-Bold').fontSize(9).fillColor('#111').text('For ' + (co.name || 'FenstraWorks'), 380, 750, { width: Rr - 380, align: 'right' }).font('Helvetica').fontSize(8).text('Authorised signatory', 380, 780, { width: Rr - 380, align: 'right' });
  d.end(); return done;
}
function previewData(kind, c, D) {
  const costing = kind === 'costing', S = costing ? costingSections(D) : materialSections(D), tr = D.tiles;
  const tiles = [['Customer', c.customer.name || '—'], ['Project', c.project || '—'], ['Number', c.number], ['Windows', `${D.count} design${D.count === 1 ? '' : 's'} · ${D.units} unit${D.units === 1 ? '' : 's'}`], ...(costing ? [['Total area', `${f2(D.area)} sq ft`], ['Cost total', INRc(tr.cost)], ['Net selling', INRc(tr.net)], ['Contribution', INRc(tr.contribution)], ['Margin', `${tr.margin.toFixed(1)} %`], ['Wastage', `${INRc(tr.wastage)} · ${tr.wastePct.toFixed(1)} % of cost`]] : [['Profile bars', String(D.mat.profileBars)], ['GI bars', String(D.mat.giBars)], ['Glass area', `${f2(D.mat.glassArea)} sq ft`], ['Stock length', `${D.mat.stock} mm`]])];
  return { tiles, note: "Pre-production estimate from the quotation's current designs; not a frozen work-order release.", sections: S.map(x => ({ title: x.title, desc: x.desc || '', cols: x.cols.map(k => ({ h: k.h, a: k.a || '' })), rows: x.rows.map(r => Array.isArray(r) ? { c: r, t: '' } : { c: r.c, t: r.t || '' }) })) };
}
module.exports = { multi, previewData, model, pdf: quotationPdf, quotationPdf, elevationPdf, reportDoc, xlsx, docx, table, invoice, dwg, quoteDate: fdate, addDays, collect, PDFDocument };
