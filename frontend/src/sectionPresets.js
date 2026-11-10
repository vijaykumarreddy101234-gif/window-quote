// Exact assembly placements (mm) for frame / sash / bead / interlock / mesh / mullion cross-sections,
// taken from the S CRAFT profile pack's section presets. Each participant: [id, code, rotation, reflectX, reflectY, x, y].
// Transform of a profile point p (profile coordinates, y up): global = [x,y] + Rot(rotation) * diag(reflectX?-1:1, reflectY?-1:1) * p
export const PDIM = { 'RST-62T': [62, 50], 'RST-92T': [92, 50], 'RST-112T': [112, 50], 'RSS-59SS': [59, 42], 'RSS-67MS': [67, 42], 'RSS-84BS': [84, 42], 'RSM-53M': [53, 22], 'RSM-62MM': [62, 27], 'RSM-42SM': [60, 42], 'RSB-11.5DGB': [11.5, 16], 'RSB-24.5SB': [24.5, 16], 'RSI-44IL': [44, 29.5], 'RST-53ET': [53, 45], 'RST-80ET': [80, 45], 'RST-95ET': [95, 45], 'RSS-60ES': [60, 35], 'RSI-38EIL': [38, 33.6], 'RSB-17.5EB': [17.5, 16], 'RSC-42EVF': [42, 40], 'RSM-42ESM': [60, 42], 'RSB-24.5ESB': [24.5, 16], 'RSC-42VF': [42, 40], 'RSC-60OF': [60, 60], 'RSC-72OF': [60, 72], 'RSC-74TM': [74, 60], 'RSC-78WO': [78, 60], 'RSC-74ZM': [74, 60], 'RSC-60FM': [60, 60], 'RSC-104OD': [104, 60], 'RSC-104ID': [104, 60], 'RSB-35CB': [35, 20], 'RSA-HC': [18.5, 13], 'RSA-11MC': [11, 19.8], 'RSA-38TC': [38, 24], 'RSA-12P': [100, 12], 'RSA-22SA': [46.5, 22], 'RSM-68OM': [68, 38.1], 'RSA-92CJC': [47, 28], 'RSA-112CJC': [67, 28.2], 'RSA-50AT': [33, 50], 'RSA-25GB': [28.5, 10], 'RSA-60B': [68.3, 68.3], 'RSA-92B': [100.32, 68.29] }

export const seriesKey = frame => /^RST-(62|92|112)T$/.test(frame) ? 'premium' : /^RST-(53|80|95)ET$/.test(frame) ? 'eco' : /^RSC-42/.test(frame) ? 'eco_casement' : /^RSC-(60|72)OF$/.test(frame) ? 'casement' : null
const beadW = c => (PDIM[c] || [24.5])[0]
const lane = 49.9

// sliding (premium / eco); returns { v:{parts,glass}, h:{parts,glass} } in preset coordinates
function sliding(kind, c) {
  const { sash, bead, il, mesh, mull, frame } = c, sw = (PDIM[sash] || [59])[0], bw = beadW(bead), withMesh = !!mesh
  if (kind === 'premium') {
    const y1 = 27.05 - bw, gy = { 24.5: -2.92, 17.5: 0.6, 11.5: 3.55 }[bw] ?? (y1 - 5.47), bx = 42.01 + sw - 22.02
    const v = [['frame', frame, 90, 0, 1, 0, 0], ['sash@1', sash, 0, 0, 1, 42.01, 27.05], ['sash@2', sash, 0, 0, 1, 42.01, 76.95], ['bead@1', bead, 90, 0, 1, bx, y1], ['bead@2', bead, 90, 0, 1, bx, y1 + lane]]
    const h = [['frame', frame, 90, 0, 1, -300, 0], ['sash@1', sash, 0, 1, 1, sw + 2.5, 27.05], ['sash@2', sash, 0, 0, 1, 0, 76.95], ['bead@1', bead, 90, 0, 0, 24.5, y1], ['bead@2', bead, 90, 0, 1, sw - 22.02, y1 + lane], ['interlock@1', il || 'RSI-44IL', 90, 0, 1, sw - 24.62, -11.06], ['interlock@2', il || 'RSI-44IL', 90, 1, 0, 27.12, 73.05]]
    if (withMesh) { v.push(['mesh_sash@3', mesh, 0, 0, 1, 42.02, 102.37]); h.push(['mesh_sash@3', mesh, 0, 0, 1, sw + 42.5, 102.37]); if (mull) { v.push(['mullion', mull, 90, 0, 0, 69.04, 80.33]); h.push(['mullion', mull, 90, 0, 0, sw + 69.52, 80.33]) } }
    return { v: { parts: v, glass: [bx + 1.98, gy, 1, 0, 30, bw < 12 ? 24 : 5], lane, meshY: 102.37 }, h: { parts: h, glass: [sw - 20.03, gy + lane, 1, 0, 30, bw < 12 ? 24 : 5], lane, meshY: 102.37 } }
  }
  // eco
  const y1 = 23.04 - bw, gy = bw > 12 ? -0.24 : 3.13, sx = frame === 'RST-53ET' ? 39.47 : 37.02, bx = sx + 38.15, thk = bw > 12 ? 5 : 12, my = frame === 'RST-95ET' ? 106.95 : 90.38
  const v = [['frame', frame, 90, 0, 1, 0, 0], ['sash@1', sash, 0, 0, 1, sx, 23.04], ['sash@2', sash, 0, 0, 1, sx, 64.98], ['bead@1', bead, 90, 0, 1, bx, y1], ['bead@2', bead, 90, 0, 1, bx, y1 + 41.94]]
  const h = [['frame', frame, 90, 0, 1, -300, 0], ['sash@1', sash, 0, 1, 1, 62.5, 23.04], ['sash@2', sash, 0, 0, 1, 0, 64.98], ['bead@1', bead, 90, 0, 0, 24.32, y1], ['bead@2', bead, 90, 0, 1, 38.18, y1 + 41.94], ['interlock@1', il || 'RSI-38EIL', 90, 0, 1, 31.49, -9.27], ['interlock@2', il || 'RSI-38EIL', 90, 1, 0, 31.01, 62.27]]
  if (withMesh) { v.push(['mesh_sash@3', mesh, 0, 0, 1, sx, my]); h.push(['mesh_sash@3', mesh, 0, 0, 1, 102.5, my]) }
  return { v: { parts: v, glass: [bx + 1.79, gy, 1, 0, 30, thk], lane: 41.94, meshY: my }, h: { parts: h, glass: [39.96, gy + 41.94, 1, 0, 30, thk], lane: 41.94, meshY: my } }
}

// casement (single lane): frame + sash + bead
const CAS = { 'RSC-78WO': { frame: 'RSC-60OF', v: [31.9, 42.92, 51.95], fy: 60.01 }, 'RSC-104OD': { frame: 'RSC-72OF', v: [45.52, 42.93, 77.92], fy: 60 }, 'RSC-104ID': { frame: 'RSC-72OF', v: [46.13, 77.05, 79.54], fy: 0, inner: true }, 'RSM-42ESM': { frame: 'RSC-42EVF', v: [15.9, 32.45, 37.99], fy: 41.99 } }
function casement(c) {
  const k = CAS[c.sash]; if (!k) return null; const bw = beadW(c.bead), sy = k.v[1], by = sy - bw
  const parts = [['frame', c.frame, 90, k.inner ? 0 : 1, 1, 0, k.inner ? 0 : k.fy], ['sash', c.sash, 0, 0, 1, k.v[0], sy], ['bead', c.bead, 90, 0, 1, k.v[0] + k.v[2], by]]
  return { v: { parts, glass: [k.v[0] + k.v[2] + (c.frame === 'RSC-42EVF' ? 2 : 6), by - 5.5, 1, 0, 30, 5], lane: 0 }, h: null }
}

export function getPreset(c) {
  const kind = seriesKey(c.frame); if (!kind) return null
  if (kind === 'premium' || kind === 'eco') { if (!PDIM[c.sash] || !PDIM[c.bead]) return null; return sliding(kind, c) }
  return casement(c)
}
