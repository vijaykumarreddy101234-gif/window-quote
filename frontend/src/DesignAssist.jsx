// Design assistant: reads the engine's cut list for this window and checks every placed profile for suitability.
// Rule-based (S CRAFT system limits), runs in the browser, works on sliding and casement designs.
const NAME = { 'RST-62T': '2 Track - 62', 'RST-92T': '3 Track - 92', 'RST-112T': '3 Track - 112', 'RST-53ET': '2 Track - 53', 'RST-80ET': '2.5 Track - 80', 'RST-95ET': '3 Track - 95', 'RSS-59SS': 'Small Sash - 59', 'RSS-67MS': 'Mid Sash - 67', 'RSS-84BS': 'Big Sash - 84', 'RSS-60ES': 'Sash - 60X35', 'RSS-75ES': 'Sash - 75X35', 'RSM-53M': 'Mesh - 53', 'RSM-62MM': 'Mesh Mullion - 62', 'RSB-24.5SB': 'Bead - 24.5', 'RSB-11.5DGB': 'DG Bead - 11.5', 'RSB-17.5EB': 'Bead - 17.5', 'RSI-44IL': 'Inter Lock - 44', 'RSI-38EIL': 'Inter Lock - 38', 'RSC-42EVF': 'Eco Casement Frame - 42', 'RSM-42ESM': 'Eco Casement Sash - 42', 'RSB-24.5ESB': 'Eco Bead - 24.5', 'RSC-60OF': 'Outer Frame - 60', 'RSC-72OF': 'Outer Frame - 72', 'RSC-78WO': 'Window Sash - 78', 'RSC-104OD': 'Door Sash - 104', 'RSC-104ID': 'Inward Door Sash - 104', 'RSB-35CB': 'Casement Bead - 35', 'RSC-74TM': 'T Mullion - 74', 'RSC-74ZM': 'Z Mullion - 74', 'RSC-60FM': 'Flat Mullion - 60' }
export const profName = c => NAME[c] || c
const TRACKS = { 'RST-62T': 2, 'RST-92T': 3, 'RST-112T': 3, 'RST-53ET': 2, 'RST-80ET': 2.5, 'RST-95ET': 3 }
const r1 = v => Math.round(v * 10) / 10

export function assess({ dsn, size, engine, glassName, cells: cellsIn }) {
  const e = engine || {}, cuts = e.cuts || [], W = size[0], H = size[1], out = { kind: dsn.kind === 'sliding' ? 'Sliding window' : dsn.door ? 'Casement door' : 'Casement window', rows: [], tips: [], ok: true }
  const by = role => cuts.find(c => c.role === role), code = role => (by(role) || {}).code
  const glassMm = parseFloat(glassName) || 5
  const add = (role, c, status, why) => { if (!c) return; out.rows.push({ role, code: c, name: profName(c), status, why }); if (status === 'warn') out.ok = false }
  if (e.error) { out.tips.push(e.error); out.ok = false; return out }
  const frame = code('Frame'), sash = code('Sash'), bead = code('Bead'), il = code('Interlock'), mesh = code('Mesh Sash'), mull = code('Mullion')
  if (dsn.kind === 'sliding') {
    const n = dsn.panels || 2, meshN = dsn.mesh || 0, tracks = TRACKS[frame] || 0, glassN = n - meshN
    const leafW = Math.round(W / n), leafH = H
    add('Frame', frame, 'ok', `${tracks} track · ${glassN} glass ${glassN > 1 ? 'leaves' : 'leaf'}${meshN ? ` + ${meshN} mesh` : ''} laid out by the engine`)
    const heavy = leafW > 1200 || leafH > 2100 || (leafW * leafH / 1e6) * glassMm * 2.5 > 45
    const want = leafH > 2100 ? 'big' : leafW > 1000 ? 'mid' : 'small'
    const sashIsBig = /84BS|75ES/.test(sash || ''), sashIsMid = /67MS/.test(sash || '')
    add('Sash', sash, want === 'big' && !sashIsBig ? 'warn' : want === 'mid' && !sashIsBig && !sashIsMid && /^RSS-(59|60)/.test(sash || '') ? 'tip' : 'ok', `leaf ${leafW} × ${leafH} mm · ${want === 'big' ? 'door height — Big Sash 84 / 75 recommended' : want === 'mid' ? 'wide leaf — Mid Sash 67 holds the glass with less bow' : 'suits a leaf up to 1000 mm wide'}`)
    add('Bead', bead, glassMm > 8 && !/DGB/.test(bead || '') ? 'warn' : glassMm <= 8 && /DGB/.test(bead || '') ? 'warn' : 'ok', glassMm > 8 ? `${glassMm} mm glazing needs the DG bead 11.5` : `${glassMm} mm glass sits in the ${profName(bead)} rebate`)
    add('Interlock', il, 'ok', `${n > 2 ? n + 1 : n} meeting stiles sealed`)
    if (meshN) add('Mesh sash', mesh, tracks === 2.5 && /^RSS-/.test(mesh || '') ? 'warn' : 'ok', tracks === 2.5 ? 'half track — slim Mesh 53 profile' : `full track — ${profName(mesh)} runs on the third track`)
    if (heavy) out.tips.push(`Leaf ${leafW} × ${leafH} mm with ${glassMm} mm glass weighs about ${r1((leafW * leafH / 1e6) * glassMm * 2.5)} kg — use tandem rollers and 1.2 mm reinforcement.`)
    if (W / H > 2.6) out.tips.push('Very wide window — a coupler or a fixed centre light keeps the leaves under 1200 mm.')
  } else {
    const cols = dsn.cols || [], tw = cols.reduce((a, c) => a + (c.w || 1), 0) || 1, cells = cellsIn || cols.flatMap(c => c.rows.map(r => ({ ...r, w: Math.round(W * (c.w || 1) / tw) }))), opens = cells.filter(c => c.op && c.op !== 'FIXED').length
    add('Frame', frame, 'ok', dsn.door ? 'door-height outer frame' : `${cells.length || 1} pane${cells.length > 1 ? 's' : ''} · ${opens} opening`)
    add('Sash', sash, dsn.door && !/104/.test(sash || '') ? 'warn' : 'ok', dsn.door ? 'door leaf needs the 104 sash' : opens ? `${opens} opening ${opens > 1 ? 'leaves' : 'leaf'} on friction stays` : 'fixed glazing only')
    add('Bead', bead, 'ok', `${glassMm} mm glass`)
    if (mull) add('Mullion', mull, 'ok', `${Math.max(0, cols.length - 1)} vertical joint${cols.length > 2 ? 's' : ''}`)
    const maxLeaf = Math.max(0, ...cells.filter(c => c.op && c.op !== 'FIXED').map(c => c.w || 0))
    if (maxLeaf > 750) out.tips.push(`Opening leaf ${maxLeaf} mm wide — keep casement leaves under 750 mm so the friction stay holds.`)
  }
  if (!cuts.length) out.tips.push('No engine cut list yet — save or change a dimension to calculate.')
  if (e.kg && e.area) out.tips.push(`${e.kg} kg of profile for ${e.area} sq ft (${Math.round(e.area * 0.092903 / e.kg * 1000)} m²/t).`)
  return out
}

export function DesignAssist(props) {
  const a = assess(props)
  const col = s => s === 'warn' ? '#b91c1c' : s === 'tip' ? '#b45309' : '#15803d', ic = s => s === 'warn' ? '⚠' : s === 'tip' ? '◆' : '✓'
  return <div className="dcard assist">
    <div className="ins-title"><b>AI DESIGN ASSISTANT</b><span className="ins-badge" style={{ background: a.ok ? '#dcfce7' : '#fee2e2', color: a.ok ? '#166534' : '#991b1b' }}>{a.ok ? 'Profiles suit this design' : 'Check the flagged profiles'}</span></div>
    <div className="muted" style={{ fontSize: 12, margin: '2px 0 6px' }}>{a.kind} · {props.size[0]} × {props.size[1]} mm · every profile below is taken from this window's cut list</div>
    {a.rows.map(r => <div key={r.role} className="arow"><span style={{ color: col(r.status), width: 16 }}>{ic(r.status)}</span><span className="arole">{r.role}</span><b>{r.name}</b><span className="muted">{r.code} · {r.why}</span></div>)}
    {a.tips.map((t, i) => <div key={i} className="muted" style={{ fontSize: 12, marginTop: 4 }}>• {t}</div>)}
  </div>
}
