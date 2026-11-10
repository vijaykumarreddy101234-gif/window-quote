import { useEffect, useState } from 'react'
// Loads a profile drawing as clean line-art. Pre-cleaned files live in /profiles/clean/<CODE>.png; any other drawing
// (e.g. a newly added profile image at /profiles/<CODE>.png) is cleaned in the browser: red dimension marks, text and the white background are removed.
const cache = {}
const load = url => new Promise((res, rej) => { const im = new Image(); im.onload = () => res(im); im.onerror = rej; im.src = url })
export const profileSrc = code => (typeof window !== 'undefined' && window.__profData && window.__profData[code]) || `/profiles/clean/${code}.png`
function cleanRaw(im) {
  const W = im.naturalWidth, H = im.naturalHeight, c = document.createElement('canvas'); c.width = W; c.height = H
  const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0); const d = g.getImageData(0, 0, W, H).data, n = W * H
  const red = new Uint8Array(n), ink = new Uint8Array(n)
  for (let i = 0; i < n; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3]; if (a > 128 && r > gg + 35 && r > b + 35) red[i] = 1 }
  const near = new Uint8Array(n); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (red[y * W + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) near[yy * W + xx] = 1 }
  for (let i = 0; i < n; i++) { const r = d[i * 4], gg = d[i * 4 + 1], b = d[i * 4 + 2], a = d[i * 4 + 3], lum = (r + gg + b) / 3, sat = Math.max(r, gg, b) - Math.min(r, gg, b); if (a > 128 && !near[i] && lum < 190 && sat < 70) ink[i] = 1 }
  const keep = new Uint8Array(n), seen = new Uint8Array(n), stack = []
  for (let s = 0; s < n; s++) {
    if (!ink[s] || seen[s]) continue
    const comp = []; let x0 = W, x1 = 0, y0 = H, y1 = 0; stack.push(s); seen[s] = 1
    while (stack.length) { const p = stack.pop(); comp.push(p); const x = p % W, y = (p / W) | 0; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) { const xx = x + dx, yy = y + dy; if (xx < 0 || yy < 0 || xx >= W || yy >= H) continue; const q = yy * W + xx; if (ink[q] && !seen[q]) { seen[q] = 1; stack.push(q) } } }
    if (Math.max(x1 - x0, y1 - y0) >= 34) comp.forEach(p => { keep[p] = 1 })
  }
  const k2 = new Uint8Array(n); for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (keep[y * W + x]) for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) { const yy = y + dy, xx = x + dx; if (yy >= 0 && yy < H && xx >= 0 && xx < W) k2[yy * W + xx] = 1 }
  keep.set(k2)
  let bx0 = W, bx1 = 0, by0 = H, by1 = 0; for (let i = 0; i < n; i++) if (keep[i]) { const x = i % W, y = (i / W) | 0; if (x < bx0) bx0 = x; if (x > bx1) bx1 = x; if (y < by0) by0 = y; if (y > by1) by1 = y }
  if (bx1 <= bx0) return null
  const w = bx1 - bx0 + 1, h = by1 - by0 + 1, o = document.createElement('canvas'); o.width = w; o.height = h; const og = o.getContext('2d'), od = og.createImageData(w, h)
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (keep[(y + by0) * W + x + bx0]) { const k = (y * w + x) * 4; od.data[k] = 38; od.data[k + 1] = 50; od.data[k + 2] = 66; od.data[k + 3] = 255 }
  og.putImageData(od, 0, 0); return { src: o.toDataURL('image/png'), w, h }
}
async function resolve(code) {
  if (typeof window !== 'undefined' && window.__profRaw && window.__profRaw[code]) { try { return cleanRaw(await load(window.__profRaw[code])) } catch (e) {} }
  try { const im = await load(profileSrc(code)); if (im.naturalWidth > 20) return { src: im.src, w: im.naturalWidth, h: im.naturalHeight } } catch (e) {}
  try { const im = await load(`/profiles/${code}.png`); return cleanRaw(im) } catch (e) { return null }
}
// returns a getter code -> {src,w,h} | null; re-renders when drawings finish loading
export function useProfiles(codes) {
  const [, force] = useState(0); const key = codes.filter(Boolean).join()
  useEffect(() => { let live = true; codes.filter(Boolean).forEach(c => { if (cache[c] === undefined) { cache[c] = null; resolve(c).then(r => { cache[c] = r || false; live && force(x => x + 1) }) } }); return () => { live = false } }, [key])
  return c => (c && cache[c]) || null
}
// largest real dimension in mm, taken from the profile code (RST-62T -> 62, RSB-24.5SB -> 24.5)
export const profMm = (code, fb = 40) => { const m = /-(\d+(?:\.\d+)?)/.exec(code || ''); return m ? parseFloat(m[1]) : fb }

export const resetProfile = code => { delete cache[code] }
