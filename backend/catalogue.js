// Reads a brand catalogue (PDF): finds every profile label block (description / item code / "Mtr Wt-x") and crops the drawing above it.
// Needs poppler-utils (pdftotext, pdftoppm) on the server.
const { execFile } = require('child_process'), fs = require('fs'), path = require('path'), os = require('os');
const run = (cmd, args) => new Promise((res, rej) => execFile(cmd, args, { maxBuffer: 256 * 1024 * 1024 }, (e, so, se) => e ? rej(new Error(e.code === 'ENOENT' ? `${cmd} is not installed on the server (install poppler-utils)` : (se || e.message).toString().slice(0, 200))) : res(so)));
const CODE = /^([A-Z]{2,5})-?(\d+(?:\.\d+)?)([A-Z]{1,6})$/, WT = /Wt\s*-?\s*(\d+(?:\.\d+)?)/i, DIMLAB = /^\d+(?:\.\d+)?\s*[xX×]\s*\d/;
const attr = (s, k) => parseFloat(new RegExp(k + '="([\\d.\\-]+)"').exec(s)[1]);
function parsePages(html) {
  return [...html.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)].map((m, i) => {
    const blocks = [...m[3].matchAll(/<block ([^>]*)>([\s\S]*?)<\/block>/g)].map(b => ({ x0: attr(b[1], 'xMin'), y0: attr(b[1], 'yMin'), x1: attr(b[1], 'xMax'), y1: attr(b[1], 'yMax'),
      lines: [...b[2].matchAll(/<line [^>]*>([\s\S]*?)<\/line>/g)].map(l => [...l[1].matchAll(/<word [^>]*>([^<]*)<\/word>/g)].map(w => w[1].replace(/&amp;/g, '&').replace(/&#x[0-9a-f]+;/gi, '')).join(' ').trim()).filter(Boolean) }));
    return { n: i + 1, w: +m[1], h: +m[2], blocks };
  });
}
function profileOf(b) {
  const ci = b.lines.findIndex(l => CODE.test(l.replace(/\s+/g, '').toUpperCase())); if (ci < 0) return null
  const code = b.lines[ci].replace(/\s+/g, '').toUpperCase(), wl = b.lines.find(l => WT.test(l)), desc = b.lines.slice(0, ci).join(' ').replace(/\s+/g, ' ').trim()
  return { code, description: desc || code, weight: wl ? parseFloat(WT.exec(wl)[1]) : 0 }
}
async function extract(pdfPath, outDir, dpi = 220) {
  const html = await run('pdftotext', ['-bbox-layout', pdfPath, '-']), pages = parsePages(html), found = [], k = dpi / 72
  for (const pg of pages) {
    const prof = pg.blocks.map(b => ({ b, p: profileOf(b) })).filter(x => x.p)
    for (const { b, p } of prof) {
      const cx = (b.x0 + b.x1) / 2, row = prof.filter(o => o.b !== b && Math.abs(o.b.y0 - b.y0) < 70).map(o => (o.b.x0 + o.b.x1) / 2)
      const left = row.filter(x => x < cx).sort((a, c) => c - a)[0], right = row.filter(x => x > cx).sort((a, c) => a - c)[0]
      const xl = Math.max(0, left !== undefined ? (left + cx) / 2 : cx - 110), xr = Math.min(pg.w, right !== undefined ? (right + cx) / 2 : cx + 110)
      const above = pg.blocks.filter(o => o !== b && o.y1 <= b.y0 + 1 && !(o.lines.length === 1 && DIMLAB.test(o.lines[0])) && !(o.lines.length === 1 && o.lines[0].length < 3) && o.x1 > xl && o.x0 < xr)
      const top = Math.max(0, ...above.map(o => o.y1)) + 2, bot = b.y0 - 2
      let png = null
      if (bot - top > 25) {
        const base = path.join(outDir, p.code), X = Math.round(xl * k), Y = Math.round(top * k), W = Math.round((xr - xl) * k), H = Math.round((bot - top) * k)
        try { await run('pdftoppm', ['-r', String(dpi), '-f', String(pg.n), '-l', String(pg.n), '-x', String(X), '-y', String(Y), '-W', String(W), '-H', String(H), '-png', '-singlefile', pdfPath, base]); png = base + '.png' } catch (e) { if (/not installed/.test(e.message)) throw e }
      }
      if (!found.some(f => f.code === p.code)) found.push({ ...p, page: pg.n, png })
    }
  }
  return found;
}
module.exports = { extract };
