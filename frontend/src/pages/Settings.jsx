import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api, inr2, token, downloadFile } from '../api'
import { profileImg, PROFILE_GROUPS, groupOf } from '../profileImg'
import { TYPES, COEF, defaults, blank, ctx, formula, qty } from '../installMap'
import { askText, askConfirm, say } from '../dialog'
import { resetProfile } from '../profileClean'

// key -> [label, url slug, icon path, page title, subtitle]
const TABS = [
  ['general', 'General', '', 'M4 7h7m4 0h5 M4 17h3m4 0h9 M11 4v6h4V4z M7 14v6h4v-6z', 'Quotation content', 'This wording is frozen into new quotation and work-order PDFs. Existing documents stay unchanged.'],
  ['company', 'Company', 'document', 'M4 21V4h10v17 M14 9h6v12 M8 8h2 M8 12h2 M8 16h2 M3 21h18', 'Company', 'Saving updates draft quotations and new documents. Quotations already sent keep the details they were sent with.'],
  ['profile', 'Profile', 'profile', 'M3 3h18v18H3z M7 7h10v10H7z M3 3l4 4 M21 3l-4 4 M3 21l4-4 M21 21l-4-4', 'Profile pricing', "Each system's pricing mode comes from its own catalogue data. Set the white and coloured rates, and the Georgian bar rate, per brand."],
  ['glass', 'Glass', 'glass', 'M4 3h16v18H4z M12 3v18 M7 7l2-2 M7 11l4-4 M15 7l2-2 M15 11l4-4', 'Glass products', 'Named choices are revision-pinned. Rates never enter drawing data.'],
  ['hardware', 'Hardware and Accessories', 'hardware', 'M8 3h2a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H8a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z M11 7h8.5a1.5 1.5 0 0 1 0 3H11 M9 14v2', 'Hardware and Accessories', 'Shared with Inventory and Settings. Catalogue edits and your prices update in both places.'],
  ['pricing', 'Pricing', 'pricing', 'M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0L3 13V3h10l7.6 7.6a2 2 0 0 1 0 2.8z M7.5 7.5h.01', 'Pricing settings', 'Set your default margins, charges and quotation preferences.'],
  ['configuration', 'Configuration', 'configuration', 'M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z', 'Configuration', 'Configure each licensed profile model. Inherited fields follow admin defaults; your custom values stay until you restore their defaults.'],
  ['tax', 'Tax & invoices', 'tax', 'M19 5 5 19 M6.5 9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z M17.5 20a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z', 'Tax & invoices', 'Used when issuing GST tax invoices and exporting them to Tally.'],
  ['team', 'Team', 'team', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', 'Team accounts', 'Add people, give each a role, and set who reports to whom. Changes require an internet connection. Keep at least one active Owner.'],
  ['support', 'Support', 'support', 'M21 11a8 8 0 0 1-8 8H7l-4 3V11a9 9 0 0 1 18 0z M8 11h.01 M12 11h.01 M16 11h.01', 'Support', 'Submit feedback and read replies here while online. Your browser version is included; do not include passwords or payment details. Owners can view workspace tickets; other users see only their own.'],
]
const Ico = ({ d, size = 20 }) => <svg className="module-sidebar-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const SAVE_ICON = 'M5 3h11l3 3v15H5z M8 3v6h8V3 M8 21v-7h8v7'

/* ---------- shared building blocks ---------- */
function useSection(key) {
  const [v, setV] = useState(null); const [dirty, setDirty] = useState(false)
  useEffect(() => { api('/settings/' + key).then(setV) }, [key])
  const set = (k, val) => { setV(o => ({ ...o, [k]: val })); setDirty(true) }
  const save = async () => { await api('/settings/' + key, { method: 'PUT', body: v }); setDirty(false) }
  return { v, set, save, dirty }
}
const Card = ({ title, sub, actions, children, cls = '' }) => <section className={'qt-info-card ' + cls}>
  {(title || actions) && <div className="ps-card-head"><div><div className="ps-card-title">{title}</div>{sub && <div className="ps-card-sub">{sub}</div>}</div>{actions}</div>}
  <div className="qt-card-body ps-form">{children}</div></section>
const Field = ({ label, children, hint }) => <label className="ps-field"><span>{label}</span>{children}{hint && <em className="ps-hint">{hint}</em>}</label>
const Num = ({ label, unit, sub, hint, value, onChange, placeholder }) => <div className="ps-num"><div className="ps-num-l">{label}</div>
  <div className="ps-num-row">{unit && <span className="ps-unit">{unit}</span>}<input type="number" aria-label={label + ' value'} value={value ?? ''} placeholder={placeholder} onChange={onChange} />{sub && <span className="ps-sub">{sub}</span>}</div>
  {hint && <div className="ps-hint">{hint}</div>}</div>
const SaveBar = ({ dirty, onSave, label }) => <div className="settings-save-bar"><span className="ps-saved"><i className={dirty ? 'dirty' : ''} />{dirty ? 'Unsaved changes' : 'All changes saved'}</span>
  <button className="qt-btn-primary action-with-icon" onClick={onSave}><Ico d={SAVE_ICON} size={16} />{label}</button></div>
const Transfer = ({ what, onExport, onImport, note }) => {
  const f = useRef(null); const [msg, setMsg] = useState('')
  const pick = async ev => { const file = ev.target.files[0]; if (!file) return; const b64 = await new Promise(r => { const rd = new FileReader(); rd.onload = () => r(String(rd.result).split(',')[1]); rd.readAsDataURL(file) }); const res = await onImport(b64); setMsg(`Imported: ${res.added || 0} added, ${res.updated || 0} updated`); ev.target.value = '' }
  return <section className="qt-info-card ps-transfer"><div className="ps-transfer-row"><div className="ps-transfer-ic"><Ico d="M9 9h10v10H9z M5 15V5h10" size={18} /></div>
    <div style={{ flex: 1 }}><div className="ps-card-title">Catalogue transfer</div><div className="ps-card-sub">Excel · products, prices &amp; discontinued items</div></div>
    <button className="qt-btn-ghost ps-btn" onClick={onExport}>⬇ Export Excel</button><button className="qt-btn-primary ps-btn" onClick={() => f.current.click()}>⬆ Import Excel</button><input ref={f} type="file" accept=".xlsx" hidden onChange={pick} /></div>
    <div className="ps-card-sub" style={{ marginTop: 8 }}>{msg || note || 'Import adds new items and updates matches. Items missing from the file are kept.'}</div></section>
}
const download = path => downloadFile(path)

/* ---------- page shell ---------- */
export default function Settings() {
  const { tab: slug = '' } = useParams(); const nav = useNavigate()
  const cur = TABS.find(t => t[2] === slug || t[0] === slug) || TABS[0]
  const go = t => nav(t[2] ? '/settings/' + t[2] : '/settings')
  return <div className="module-workspace">
    <aside className="module-sidebar" aria-label="Settings navigation"><div className="module-sidebar-heading">SETTINGS</div>
      <nav>{TABS.map(t => <button key={t[0]} type="button" title={t[1]} aria-label={t[1]} className={'module-sidebar-link' + (cur[0] === t[0] ? ' active' : '')} onClick={() => go(t)}><Ico d={t[3]} /><span className="module-sidebar-label">{t[1]}</span></button>)}</nav></aside>
    <div className="module-content"><div className="qt-list-root ps-root">
      <div className="qt-nav-pills settings-pills">{TABS.map(t => <button key={t[0]} className={'qt-nav-pill' + (cur[0] === t[0] ? ' active' : '')} onClick={() => go(t)}>{t[1]}</button>)}</div>
      <div className="qt-list-header"><h1 className="qt-page-title">{cur[4]}</h1><p className="qt-page-subtitle">{cur[5]}</p></div>
      {cur[0] === 'general' && <General />}{cur[0] === 'company' && <Company />}{cur[0] === 'profile' && <Profile />}{cur[0] === 'glass' && <Glass />}{cur[0] === 'hardware' && <Hardware />}
      {cur[0] === 'pricing' && <Pricing />}{cur[0] === 'configuration' && <Config />}{cur[0] === 'tax' && <Tax />}{cur[0] === 'team' && <Team />}{cur[0] === 'support' && <Support />}
    </div></div></div>
}

/* ---------- General ---------- */
function General() {
  const [s, setS] = useState(null); const [dirty, setDirty] = useState(false); const [np, setNp] = useState({ name: '', terms: '' }); const [ed, setEd] = useState(null)
  useEffect(() => { api('/settings').then(setS) }, [])
  if (!s) return null
  const set = (k, v) => { setS({ ...s, [k]: v }); setDirty(true) }
  const save = async () => { await api('/settings', { method: 'PUT', body: { intro: s.intro, terms: s.terms, validity_days: s.validity_days, followup_days: s.followup_days, payment_terms: s.payment_terms, warranty: s.warranty, exclusions: s.exclusions, length_unit: s.length_unit, area_unit: s.area_unit } }); setDirty(false) }
  const addTerm = () => { if (!np.name) return; if (ed != null) { set('payment_terms', s.payment_terms.map((p, i) => i === ed ? np : p)); setEd(null) } else set('payment_terms', [...s.payment_terms, np]); setNp({ name: '', terms: '' }) }
  return <>
    <div className="ps-general-cols">
      <div className="ps-col">
        <Card><Field label="Introduction (top of quotation)"><textarea rows="4" placeholder="A short company introduction shown above the quotation total." value={s.intro || ''} onChange={e => set('intro', e.target.value)} /></Field></Card>
        <Card><Field label="Terms & conditions" hint="One clause per line. Start a line with “1.”, “2.” … to number it and “a)” or “-” for a sub-point; words before the first colon print in bold as the clause title (“3. Payment: 50% advance…”). A line without a number continues the clause above. Plain lines with no numbers are numbered for you. Leave blank only when the quotation should omit terms."><textarea rows="12" value={s.terms || ''} onChange={e => set('terms', e.target.value)} /></Field></Card>
        <Card title="Units"><Field label="Sizes are typed and shown in"><select value={s.length_unit} onChange={e => set('length_unit', e.target.value)}><option value="mm">Millimetres (1600)</option><option value="in">Inches (63 1/2")</option><option value="ft">Feet-inches (5' 3 1/2")</option><option value="fts">Feet-inches-soot (5' 3" 4s)</option></select></Field>
          <Field label="Window area is shown in" hint={'1600 × 1200 mm shows as 1600 × 1200 mm · 20.67 sq ft. Any size field also accepts 1.6m, 63", 5\'3" or 5\'3"4s. Cutting lists, labels and factory documents stay in millimetres.'}><select value={s.area_unit} onChange={e => set('area_unit', e.target.value)}><option value="sqft">Square feet (sq ft)</option><option value="m2">Square metres (m²)</option></select></Field>
          <div><button className="qt-btn-ghost ps-btn" onClick={save}>Save units</button></div></Card>
      </div>
      <div className="ps-col">
        <Card><div className="ps-grid"><Num label="Validity (days)" value={s.validity_days} onChange={e => set('validity_days', e.target.value)} />
          <Num label="Follow up after (days)" value={s.followup_days} onChange={e => set('followup_days', e.target.value)} hint="The quotation list shows “Follow up” on a sent quotation after this many days." /></div></Card>
        <Card title="Payment terms" cls="ps-terms">
          <Field label="Name"><input placeholder="e.g. 100% advance" value={np.name} onChange={e => setNp({ ...np, name: e.target.value })} /></Field>
          <Field label="Terms"><textarea rows="2" placeholder="The words printed on the quotation" value={np.terms} onChange={e => setNp({ ...np, terms: e.target.value })} /></Field>
          <div className="ps-terms-foot"><span className="ps-hint">Pick one on a quotation's Pricing tab. Only the terms print.</span><button className="qt-btn-ghost ps-btn" onClick={addTerm}>{ed != null ? 'Update' : 'Add'}</button></div>
          <div className="ps-terms-list">{s.payment_terms.map((p, i) => <div className="ps-terms-entry" key={i}><div className="ps-terms-text"><b>{p.name}</b><div>{p.terms}</div></div>
            <div className="ps-terms-actions"><button className="ps-terms-action" aria-label={'Edit ' + p.name} onClick={() => { setNp(p); setEd(i) }}>✎</button><button className="ps-terms-action danger" aria-label={'Remove ' + p.name} onClick={() => set('payment_terms', s.payment_terms.filter((_, k) => k !== i))}>🗑</button></div></div>)}</div></Card>
        <Card title="Warranty"><textarea rows="5" value={s.warranty || ''} onChange={e => set('warranty', e.target.value)} /></Card>
        <Card title="Exclusions"><textarea rows="4" value={s.exclusions || ''} onChange={e => set('exclusions', e.target.value)} /></Card>
      </div>
    </div>
    <SaveBar dirty={dirty} onSave={save} label="Save content" /></>
}

/* ---------- Company ---------- */
function Company() {
  const { v, set, save, dirty } = useSection('company'); const [reg, setReg] = useState({ state: '', gstin: '', label: '' })
  if (!v) return null
  const bank = (k, val) => set('bank', { ...(v.bank || {}), [k]: val })
  const img = (k, max = 500) => ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > max * 1024) { say(`Please choose an image up to ${max} KB.`); return } const rd = new FileReader(); rd.onload = () => set(k, rd.result); rd.readAsDataURL(f) }
  const regs = v.gst_regs || []
  return <>
    <div className="ps-stack">
      <Card title="Business details"><div className="ps-2col">
        <Field label="Business name"><input value={v.name} onChange={e => set('name', e.target.value)} /></Field>
        <Field label="GSTIN"><input value={v.gstin} disabled={!v.registered} onChange={e => set('gstin', e.target.value)} /></Field>
        <label className="ps-check"><input type="checkbox" checked={!v.registered} onChange={e => set('registered', !e.target.checked)} /> Not registered for GST</label>
        <Field label="State code"><input placeholder="State code" value={v.state} onChange={e => set('state', e.target.value)} /></Field>
        <Field label="Phone"><input type="tel" value={v.phone} onChange={e => set('phone', e.target.value)} /></Field>
        <Field label="Email"><input type="email" value={v.email} onChange={e => set('email', e.target.value)} /></Field></div>
        <Field label="Business address"><textarea rows="3" value={v.address} onChange={e => set('address', e.target.value)} /></Field></Card>
      <Card title="Bank details"><div className="ps-2col">{[['account_name', 'Account name'], ['account_number', 'Account number'], ['ifsc', 'IFSC code'], ['bank_name', 'Bank name'], ['branch', 'Branch']].map(([k, l]) => <Field key={k} label={l}><input value={(v.bank || {})[k] || ''} onChange={e => bank(k, e.target.value)} /></Field>)}</div>
        <Field label="UPI scanner (photo of your QR code)" hint="Printed on your quotations so customers can scan and pay you directly."><input type="file" aria-label="UPI scanner" accept="image/png,image/jpeg" onChange={img('upi')} /></Field>
        {v.upi && <img alt="UPI QR" src={v.upi} style={{ width: 110, borderRadius: 8, border: '1px solid #e5e7eb' }} />}
        <div className="ps-hint">Bank details are display text only and never credentials.</div></Card>
      <Card title="Other GST registrations" sub="Add a registration for each other state or branch you invoice from. Your main registration is the company details above. On a new invoice you choose which one is the seller.">
        {regs.map((r, i) => <div className="ps-reg" key={i}><b>{r.label || r.state}</b><span>{r.state} · {r.gstin}</span><button className="ps-terms-action danger" onClick={() => set('gst_regs', regs.filter((_, k) => k !== i))}>🗑</button></div>)}
        <div className="ps-2col"><Field label="Label"><input value={reg.label} onChange={e => setReg({ ...reg, label: e.target.value })} /></Field><Field label="State code"><input value={reg.state} onChange={e => setReg({ ...reg, state: e.target.value })} /></Field><Field label="GSTIN"><input value={reg.gstin} onChange={e => setReg({ ...reg, gstin: e.target.value })} /></Field></div>
        <div><button className="qt-btn-ghost ps-btn" onClick={() => { if (reg.gstin) { set('gst_regs', [...regs, reg]); setReg({ state: '', gstin: '', label: '' }) } }}>Add GST registration</button></div></Card>
      <Card title="Logos"><Field label="Logo (PNG/JPEG, up to 500 KB)" hint="Printed at the top left of every quotation, costing, cutting list, production and installation document."><input type="file" aria-label="Company logo" accept="image/png,image/jpeg" onChange={img('logo')} /></Field>
        {v.logo && <img alt="Company logo" src={v.logo} style={{ height: 56, objectFit: 'contain', alignSelf: 'flex-start' }} />}
        <Field label="Profile brand / partner logo (optional, PNG/JPEG, up to 500 KB)" hint="Printed at the top right of every document. Leave empty to print the logos of the profile brands each quotation's windows use (from the brand catalogue)."><input type="file" aria-label="Brand logo" accept="image/png,image/jpeg" onChange={img('brand_logo')} /></Field>
        {v.brand_logo && <img alt="Brand logo" src={v.brand_logo} style={{ height: 56, objectFit: 'contain', alignSelf: 'flex-start' }} />}</Card>
    </div>
    <SaveBar dirty={dirty} onSave={save} label="Save company details" /></>
}

/* ---------- Profile ---------- */
function Profile() {
  const [bust, setBust] = useState(0); const [rows, setRows] = useState([]); const pr = useSection('pricing'); const [rate, setRate] = useState(165); const [applied, setApplied] = useState(true); const [cols, setCols] = useState([]); const [colTab, setColTab] = useState('White'); const [modes, setModes] = useState({}); const [zoom, setZoom] = useState(null); const [bf, setBf] = useState(''); const [busy, setBusy] = useState(false)
  const load = () => api('/profiles').then(setRows); const brands = [...new Set(rows.map(r => r.brand).filter(Boolean))]
  const addCat = async ev => { const f = ev.target.files[0]; ev.target.value = ''; if (!f) return; const b = await askText('Brand name of this catalogue', ''); if (!b) return; setBusy(true); try { const d = await new Promise((ok, no) => { const rd = new FileReader(); rd.onload = () => ok(rd.result); rd.onerror = no; rd.readAsDataURL(f) }); const r = await api('/brands/catalogue', { method: 'POST', body: { brand: b, file: d } }); setBf(b); setBust(Date.now()); load(); say(`Catalogue read: ${r.found} profiles found — ${r.created} new, ${r.updated} updated, ${r.drawings} drawings added.`) } catch (e) { say(e.message) } setBusy(false) }
  useEffect(() => { load() }, []); useEffect(() => { if (pr.v) { setRate(pr.v.white_rate); setCols(pr.v.colour_rates || []) } }, [pr.v && pr.v.white_rate])
  const isWhite = colTab === 'White'; const cur = isWhite ? { name: 'White & other colours', rate } : cols.find(c => c.name === colTab) || { rate: 0 }
  const apply = async () => { if (isWhite) await api('/settings/pricing', { method: 'PUT', body: { ...pr.v, white_rate: +rate, colour_rates: cols } }); else await api('/settings/pricing', { method: 'PUT', body: { ...pr.v, colour_rates: cols } }); setApplied(true) }
  const addColour = async () => { const n = await askText('Colour name'); if (!n) return; const nc = [...cols, { name: n, rate: +rate }]; setCols(nc); setColTab(n); setApplied(false) }
  return <>
    <Transfer onExport={() => download('/profiles/export')} onImport={b => api('/profiles/import', { method: 'POST', body: { file: b } })} note="Import adds new items and updates matches. Items missing from the file are kept." />
    <p className="ps-intro">Export and import your rates for licensed profile systems. Save any unsaved rate edits before importing.</p>
    <div className="ps-chips"><button className={'ps-chip' + (!bf ? ' on' : '')} onClick={() => setBf('')}>All brands</button>{brands.map(b => <button key={b} className={'ps-chip' + (bf === b ? ' on' : '')} onClick={() => setBf(b)}>{b.replace(/ uPVC Profiles.*/, '')}</button>)}<label className="ps-chip" style={{ cursor: 'pointer' }}>{busy ? 'Reading catalogue…' : '＋ Add brand catalogue (PDF)'}<input type="file" accept="application/pdf" style={{ display: 'none' }} disabled={busy} onChange={addCat} /></label><span className="ps-info" title="Brands come from your licensed profile catalogue">i</span></div>
    <section className="qt-info-card ps-brand"><div className="ps-brand-head"><b>S CRAFT uPVC Profiles</b><span className="ps-ver">v31</span><span style={{ marginLeft: 'auto', fontSize: 12 }}>Priced per kg</span></div>
      <div className="qt-card-body">
        <div className="ps-chips"><button className={'ps-chip sm' + (isWhite ? ' on' : '')} onClick={() => setColTab('White')}>White &amp; other colours</button>{cols.map(c => <button key={c.name} className={'ps-chip sm' + (colTab === c.name ? ' on' : '')} onClick={() => setColTab(c.name)}>{c.name}</button>)}<button className="ps-chip sm" onClick={addColour}>+ Add colour</button></div>
        <div className="ps-rate-row"><span>₹ per kg <span className="ps-info">i</span></span><input type="number" value={cur.rate} onChange={e => { const v = +e.target.value; if (isWhite) setRate(v); else setCols(cols.map(c => c.name === colTab ? { ...c, rate: v } : c)); setApplied(false) }} /><button className="qt-btn-primary ps-btn" disabled={applied} onClick={apply}>Apply rate</button></div>
        <div className="qt-table-wrap" style={{ overflowX: 'auto' }}><table className="ps-table"><thead><tr><th>PROFILE</th><th>ITEM CODE</th><th>DESCRIPTION</th><th>WEIGHT / M (KG)</th><th>PRICE / M</th><th>ALL OTHER COLOURS / M</th></tr></thead>
          <tbody>{[...PROFILE_GROUPS.map(g => g[0]), 'Other'].flatMap(gn => { const list = rows.filter(r => (!bf || r.brand === bf) && groupOf(r.code) === gn).sort((a, b) => { const gi = (PROFILE_GROUPS.find(g => g[0] === gn) || [0, []])[1]; return gi.indexOf(a.code) - gi.indexOf(b.code) }); return list.length ? [<tr key={'g' + gn} className="ps-group"><td colSpan={6}>{gn === 'Other' ? 'Other profiles' : gn}</td></tr>, ...list.map(r => { const m = modes[r.code]; return <tr key={r.id}>
            <td><button className="prof-thumb" title="View profile drawing" onClick={() => setZoom(r)}><span className="prof-plus">＋</span><img alt={r.code} loading="lazy" src={profileImg(r.code) + (bust ? '?v=' + bust : '')} onError={e => { e.currentTarget.style.visibility = 'hidden' }} /></button></td><td>{r.code}</td><td>{r.description}</td><td>{r.weight.toFixed(3)}</td>
            <td><span>{inr2(r.weight * rate)}</span> <span className="ps-mode"><button className={m === 'pm' ? 'on' : ''} onClick={() => setModes({ ...modes, [r.code]: m === 'pm' ? null : 'pm' })}>₹/m instead</button><button className={m === 'kg' ? 'on' : ''} onClick={() => setModes({ ...modes, [r.code]: m === 'kg' ? null : 'kg' })}>own ₹/kg</button></span></td>
            <td><span>—</span> <span className="ps-mode"><button>₹/m instead</button><button>own ₹/kg</button></span></td></tr> })] : [] })}</tbody></table></div>
        {zoom && <div className="prof-modal" onClick={() => setZoom(null)}><div className="prof-modal-card" onClick={e => e.stopPropagation()}>
          <button className="x" aria-label="Close" onClick={() => setZoom(null)}>✕</button>
          <img alt={zoom.code} src={profileImg(zoom.code) + (bust ? '?v=' + bust : '')} onError={e => { e.currentTarget.style.display = 'none' }} onLoad={e => { e.currentTarget.style.display = '' }} />
          <label className="btn ghost sm" style={{ display: 'inline-block', cursor: 'pointer', margin: '6px 0' }}>Upload / replace drawing<input type="file" accept="image/png,image/jpeg,image/webp" style={{ display: 'none' }} onChange={ev => { const f = ev.target.files[0]; if (!f) return; if (f.size > 3.5e6) return say('Please choose a drawing up to 3.5 MB.'); const rd = new FileReader(); rd.onload = async () => { try { await api('/profiles/' + zoom.code + '/image', { method: 'POST', body: { data: rd.result } }); resetProfile(zoom.code); setBust(Date.now()); say('Drawing saved. Cross-sections in the designer now use it automatically.') } catch (e) { say(e.message) } }; rd.readAsDataURL(f) }} /></label>
          <h3>{zoom.description}</h3><div className="muted">{zoom.code} · {groupOf(zoom.code)}</div>
          <div className="prof-facts"><span>Weight / m <b>{zoom.weight.toFixed(3)} kg</b></span><span>Price / m <b>{inr2(zoom.weight * rate)}</b></span></div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>Cross-section from the S CRAFT profile brochure (dimensions in mm).</div></div></div>}
      </div></section></>
}

/* ---------- Glass ---------- */
function Glass() {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [m, setM] = useState(null)
  const load = () => api('/glass').then(setRows); useEffect(() => { load() }, [])
  const saveG = async () => { if (!m.name) return; if (m.id) await api('/glass/' + m.id, { method: 'PUT', body: { name: m.name, thickness: m.thickness, rate: +m.rate, status: m.status } }); else await api('/glass', { method: 'POST', body: { name: m.name, thickness: m.thickness, rate: +m.rate || 0 } }); setM(null); load() }
  const archive = async g => { await api('/glass/' + g.id, { method: 'PUT', body: { status: g.status === 'Active' ? 'Archived' : 'Active' } }); load() }
  return <>
    <Transfer onExport={() => download('/glass/export')} onImport={b => api('/glass/import', { method: 'POST', body: { file: b } })} />
    <section className="qt-info-card"><div className="ps-card-head"><div className="ps-chips" style={{ margin: 0 }}><span className="ps-chip on sm">Master</span><input className="ps-search" type="search" placeholder="Search glass…" value={q} onChange={e => setQ(e.target.value)} /></div>
      <button className="qt-btn-primary ps-btn" onClick={() => setM({ name: '', thickness: '', rate: '' })}>+ Add glass product</button></div>
      <div className="qt-card-body" style={{ padding: 0, overflowX: 'auto' }}><table className="ps-table"><thead><tr><th>NAME</th><th>THICKNESS</th><th>RATE / M²</th><th>STATUS</th><th></th></tr></thead>
        <tbody>{rows.filter(g => g.name.toLowerCase().includes(q.toLowerCase())).map(g => <tr key={g.id}><td>{g.name} rev {g.rev || 1}</td><td>{g.thickness}</td><td>{g.name === 'UPVC panel board' ? 'Profile price list' : '₹' + g.shown_rate}</td><td><span className={'ps-status ' + (g.status === 'Active' ? 'on' : '')}>{g.status}</span></td>
          <td className="ps-actions"><button aria-label={'Edit ' + g.name} onClick={() => setM({ ...g, rate: g.rate || g.default_rate || '' })}>✏️</button><button aria-label="Archive" title={g.status === 'Active' ? 'Archive' : 'Restore'} onClick={() => archive(g)}>🗄</button></td></tr>)}</tbody></table></div></section>
    {m && <div className="modal-bg" onClick={() => setM(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}><h3 style={{ marginTop: 0 }}>{m.id ? 'Edit glass product' : 'Add glass product'}</h3>
      <Field label="Name"><input value={m.name} onChange={e => setM({ ...m, name: e.target.value })} /></Field><Field label="Thickness"><input placeholder="e.g. 5 mm" value={m.thickness} onChange={e => setM({ ...m, thickness: e.target.value })} /></Field>
      <Field label="Rate per m²"><input type="number" value={m.rate} onChange={e => setM({ ...m, rate: e.target.value })} /></Field>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="qt-btn-primary ps-btn" onClick={saveG}>Save</button><button className="qt-btn-ghost ps-btn" onClick={() => setM(null)}>Cancel</button></div></div></div>}</>
}

/* ---------- Hardware ---------- */
const HW_TYPES = ['2D hinges · Casement door', '3D hinges · Casement door', 'Espags · Casement window', 'Espags · Casement door', 'Espags · Sliding', 'Handles · Casement door', 'Handles · Casement window', 'Handles · Sliding', 'Hinges · Casement window', 'Locks · Sliding', 'Movable louver · Ventilators', 'Restrictor · Casement window', 'Rollers · Sliding', 'Shoot bolt · Casement door', 'Striker · Casement door', 'Striker · Casement window', 'Striker · Sliding']
function Hardware() {
  const [rows, setRows] = useState([]); const [q, setQ] = useState(''); const [type, setType] = useState(''); const [del, setDel] = useState(false); const [sub, setSub] = useState('Hardware'); const [brand, setBrand] = useState(''); const [ed, setEd] = useState(null); const [m, setM] = useState(null); const [lim, setLim] = useState(80); const [synced, setSynced] = useState('')
  const load = () => api('/inventory/hardware' + (del ? '?deleted=1' : '')).then(setRows); useEffect(() => { load() }, [del])
  const isAcc = h => /Accessories/i.test(h.brand), isCons = h => /Consumable/i.test(h.brand) || /Consumable/i.test(h.hardware_type)
  const list = rows.filter(h => sub === 'Hardware' ? !isAcc(h) && !isCons(h) : sub === 'Accessories and Installation' ? isAcc(h) : sub === 'Consumables' ? isCons(h) : false)
    .filter(h => (!brand || h.brand === brand) && (!type || `${h.hardware_type} · ${h.window_type}` === type) && (!q || (h.name + h.code + h.brand + h.hardware_type).toLowerCase().includes(q.toLowerCase())))
  const brands = [...new Set(rows.filter(h => sub === 'Hardware' ? !isAcc(h) && !isCons(h) : isAcc(h)).map(h => h.brand))]
  const saveRate = async h => { await api('/inventory/hardware/' + h.id, { method: 'PUT', body: { ...h, your_rate: +ed.v } }); setEd(null); load() }
  const add = async () => { if (!m.name) return; await api('/inventory/hardware', { method: 'POST', body: { ...m, default_rate: +m.default_rate || 0, your_rate: +m.your_rate || +m.default_rate || 0 } }); setM(null); load() }
  const sync = async () => { const r = await api('/inventory/hardware-sync', { method: 'POST' }); setSynced(`Synced ${r.synced} items`); load() }
  return <>
    <Transfer onExport={() => download('/inventory/hardware-export')} onImport={b => api('/inventory/hardware-import', { method: 'POST', body: { file: b } })} />
    <div className="ps-chips">{['Hardware', 'Accessories and Installation', 'Consumables', 'Installation material mapping'].map(t => <button key={t} className={'ps-chip' + (sub === t ? ' on' : '')} onClick={() => { setSub(t); setBrand('') }}>{t}</button>)}</div>
    {sub === 'Installation material mapping' ? <InstallMap /> : <>
    <div className="ps-filters"><div className="ps-chips" style={{ margin: 0 }}><button className={'ps-chip sm' + (!brand ? ' on' : '')} onClick={() => setBrand('')}>All brands</button>{brands.map(b => <button key={b} className={'ps-chip sm' + (brand === b ? ' on' : '')} onClick={() => setBrand(b)}>{b}</button>)}</div></div>
    <section className="qt-info-card"><div className="ps-card-head ps-filter-row"><input className="ps-search" type="search" placeholder="Search product, brand or type" value={q} onChange={e => setQ(e.target.value)} />
      <select aria-label="Hardware type" value={type} onChange={e => setType(e.target.value)}><option value="">All hardware types</option>{HW_TYPES.map(t => <option key={t}>{t}</option>)}</select>
      <label className="ps-check"><input type="checkbox" checked={del} onChange={e => setDel(e.target.checked)} /> Show deleted</label>
      <button className="qt-btn-primary ps-btn" style={{ marginLeft: 'auto' }} onClick={() => setM({ name: '', code: '', brand: 'Generic Hardware', window_type: '', hardware_type: '', unit: 'pc', default_rate: '', your_rate: '' })}>Add hardware / accessory</button></div>
      <div className="ps-card-head" style={{ borderTop: '1px solid #f1f5f9' }}><b>{sub}</b><span><span className="ps-hint">{synced}</span> <button className="qt-btn-ghost ps-btn" onClick={sync}>Sync all rates with server</button></span></div>
      <div className="qt-card-body" style={{ padding: 0, overflowX: 'auto' }}><table className="ps-table"><thead><tr><th>PRODUCT</th><th>BRAND</th><th>WINDOW TYPE</th><th>HARDWARE TYPE</th><th>UNIT</th><th>DEFAULT RATE</th><th>YOUR RATE</th><th>ACTIONS</th></tr></thead>
        <tbody>{list.slice(0, lim).map(h => <tr key={h.id}><td>{h.name}{h.code ? ` [${h.code}]` : ''}</td><td>{h.brand}</td><td>{h.window_type}</td><td>{h.hardware_type}</td><td>{h.unit}</td><td>{inr2(h.default_rate)}</td>
          <td>{ed && ed.id === h.id ? <span className="ps-inline"><input type="number" autoFocus value={ed.v} onChange={e => setEd({ ...ed, v: e.target.value })} onKeyDown={e => e.key === 'Enter' && saveRate(h)} /><button onClick={() => saveRate(h)}>✓</button></span> : <>{inr2(h.your_rate)} <button className="ps-pen" aria-label={'Edit rate ' + h.name} onClick={() => setEd({ id: h.id, v: h.your_rate })}>✎</button></>}</td>
          <td className="ps-actions"><button aria-label="Delete" onClick={async () => { await api('/inventory/hardware/' + h.id, { method: 'DELETE' }); load() }}>🗑</button></td></tr>)}</tbody></table>
        {list.length > lim && <div style={{ padding: 12, textAlign: 'center' }}><button className="qt-btn-ghost ps-btn" onClick={() => setLim(lim + 100)}>Show more ({list.length - lim} left)</button></div>}
        {!list.length && <div className="ps-empty">{sub === 'Consumables' ? 'No consumables yet. Use “Add hardware / accessory” to add one.' : 'Nothing matches.'}</div>}</div></section></>}
    {m && <div className="modal-bg" onClick={() => setM(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 460 }}><h3 style={{ marginTop: 0 }}>Add hardware / accessory</h3>
      {[['name', 'Product'], ['code', 'Code'], ['brand', 'Brand'], ['window_type', 'Window type'], ['hardware_type', 'Hardware type'], ['unit', 'Unit'], ['default_rate', 'Default rate'], ['your_rate', 'Your rate']].map(([k, l]) => <Field key={k} label={l}><input value={m[k]} onChange={e => setM({ ...m, [k]: e.target.value })} /></Field>)}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="qt-btn-primary ps-btn" onClick={add}>Add</button><button className="qt-btn-ghost ps-btn" onClick={() => setM(null)}>Cancel</button></div></div></div>}</>
}

/* ---------- Installation material mapping ---------- */
function InstallMap() {
  const [map, setMap] = useState(null); const [saved, setSaved] = useState(null); const [type, setType] = useState(TYPES[0]); const [q, setQ] = useState('')
  const [ex, setEx] = useState({ w: 4, h: 4 }); const [xs, setXs] = useState({ sash: 0, mesh: 0, coupler: 0 }); const [more, setMore] = useState(false); const [open, setOpen] = useState({}); const [adv, setAdv] = useState({}); const [msg, setMsg] = useState('')
  useEffect(() => { api('/settings/install_map').then(r => { const m = r && r.types ? r.types : defaults(); setMap(m); setSaved(JSON.stringify(m)) }) }, [])
  if (!map) return null
  const rows = map[type] || [], dirty = JSON.stringify(map) !== saved
  const upd = (id, patch) => setMap({ ...map, [type]: rows.map(r => r.id === id ? { ...r, ...patch } : r) })
  const c = ctx(type, +ex.w || 0, +ex.h || 0, xs)
  const save = async () => { await api('/settings/install_map', { method: 'PUT', body: { types: map, revision: 1 } }); setSaved(JSON.stringify(map)); setMsg('Installation mapping saved.') }
  const reset = async () => { if (await askConfirm(`Reset ${type} to the default installation items?`, 'Reset')) { setMap({ ...map, [type]: defaults()[type] }); setMsg('') } }
  const shown = rows.filter(r => !q || (r.name + r.unit + r.group).toLowerCase().includes(q.toLowerCase()))
  const setBasis = (r, b) => { const patch = { basis: b }; if (b === 'advanced') { setAdv(a => ({ ...a, [r.id]: true })); patch.window = r.window ?? ''; if (r.sqft != null && r.sqft !== '') patch.sqft = r.sqft } upd(r.id, patch) }
  return <section className="qt-info-card installation-mapping">
    <div className="ps-card-head" style={{ alignItems: 'flex-start' }}><div><div className="ps-card-title" style={{ fontSize: 17 }}>Installation material by window type</div>
      <div className="ps-card-sub" style={{ maxWidth: 560 }}>Default installation items are ready when you sign in. Add or edit items for each window type to suit your work. Your saved mapping applies to your designs; quantities can also be changed for one window in the designer.</div></div><span className="ps-hint">Revision 1 · {dirty || saved !== JSON.stringify(defaults()) ? 'edited' : 'defaults'}</span></div>
    <div className="qt-card-body ps-form">
      <div className="ps-chips">{TYPES.map(t => <button key={t} className={'ps-chip sm' + (type === t ? ' on' : '')} onClick={() => setType(t)}>{t} <small>({(map[t] || []).length})</small></button>)}</div>
      <div className="installation-example"><strong>Example window</strong><label>width ft <input aria-label="Example width ft" type="number" min="0.1" step="0.5" value={ex.w} onChange={e => setEx({ ...ex, w: e.target.value })} /></label>
        <label>height ft <input aria-label="Example height ft" type="number" min="0.1" step="0.5" value={ex.h} onChange={e => setEx({ ...ex, h: e.target.value })} /></label><span>{+(c.area).toFixed(2)} sq ft · perimeter {+(c.perim).toFixed(2)} ft</span>
        <details open={more} onToggle={e => setMore(e.target.open)}><summary>More example measurements</summary><div className="installation-example-extra">
          <label>Sashes <input type="number" min="0" step="1" value={xs.sash} onChange={e => setXs({ ...xs, sash: e.target.value })} /></label><label>Mesh screens <input type="number" min="0" step="1" value={xs.mesh} onChange={e => setXs({ ...xs, mesh: e.target.value })} /></label><label>Coupler ft <input type="number" min="0" step="0.5" value={xs.coupler} onChange={e => setXs({ ...xs, coupler: e.target.value })} /></label></div></details></div>
      <input className="ps-search" type="search" aria-label="Search installation material" placeholder="Search item, unit or group" value={q} onChange={e => setQ(e.target.value)} />
      <div style={{ overflowX: 'auto' }}><table className="ps-table installation-table"><thead><tr><th>ITEM</th><th>UNIT</th><th>QUANTITY BASIS</th><th>AMOUNT</th><th>EXAMPLE QTY</th><th>OPTIONS</th></tr></thead><tbody>
        {shown.map((r, i) => { const idx = rows.indexOf(r) + 1; return [
          <tr className="installation-material-row" key={r.id}>
            <td><input aria-label={`Item ${idx} description`} placeholder="Item name" maxLength="120" value={r.name} onChange={e => upd(r.id, { name: e.target.value })} /><div className="installation-formula" aria-label={`Item ${idx} formula`}>{formula(r)}</div></td>
            <td><input aria-label={`Item ${idx} unit`} className="installation-unit" maxLength="16" value={r.unit} onChange={e => upd(r.id, { unit: e.target.value })} /></td>
            <td><select aria-label={`Item ${idx} quantity basis`} value={r.basis} onChange={e => setBasis(r, e.target.value)}><option value="window">per window</option><option value="sqft">per sq ft</option><option value="perimeter_ft">per ft of perimeter</option><option value="advanced">Advanced formula</option></select></td>
            <td>{r.basis === 'advanced' ? <button type="button" className="ps-pen" aria-label={`Edit formula for ${r.name}`} title={`Edit formula for ${r.name}`} onClick={() => setAdv({ ...adv, [r.id]: !adv[r.id] })}>✎</button>
              : <input type="number" min="0" step="any" aria-label={`Item ${idx} amount`} value={r.basis === 'window' ? (r.window ?? '') : r.basis === 'sqft' ? (r.sqft ?? '') : (r.perim ?? '')} onChange={e => upd(r.id, { [r.basis === 'window' ? 'window' : r.basis === 'sqft' ? 'sqft' : 'perim']: e.target.value === '' ? '' : +e.target.value })} />}</td>
            <td className="installation-example-qty"><b>{qty(r, c)}</b> <small>{r.unit}</small><br /><small className="installation-rounding">rounded up</small></td>
            <td><div className="installation-row-actions"><button type="button" className="ps-pen" aria-label={`More options for ${r.name}`} title={`More options for ${r.name}`} aria-expanded={!!open[r.id]} onClick={() => setOpen({ ...open, [r.id]: !open[r.id] })}>⚙</button>
              <button type="button" className="ps-pen" aria-label={`Remove ${r.name}`} title={`Remove ${r.name}`} onClick={() => setMap({ ...map, [type]: rows.filter(x => x.id !== r.id) })}>🗑</button></div></td></tr>,
          (open[r.id] || (r.basis === 'advanced' && adv[r.id])) && <tr className="installation-advanced-row" key={r.id + 'a'}><td colSpan="6"><div className="installation-advanced-fields">
            {open[r.id] && <><label>Group <input aria-label={`Item ${idx} group`} maxLength="40" placeholder="Optional" value={r.group || ''} onChange={e => upd(r.id, { group: e.target.value })} /></label>
              <label>Applies to <select aria-label={`Item ${idx} applies to`} value={r.applies} onChange={e => upd(r.id, { applies: e.target.value })}><option value="frame">Outer frame</option><option value="component">Each opening or unit</option></select></label>
              <p>Outer frame counts shared materials once; each opening or unit scales separately.</p><p>Always round up to whole units.</p></>}
            {r.basis === 'advanced' && adv[r.id] && <><p>Quantity = the sum of each amount × its measurement. Leave unused amounts blank.</p>
              {COEF.map(([k, l]) => <label key={k}>{l}<input type="number" min="0" step="any" aria-label={`Item ${idx} ${l}`} value={r[k] ?? ''} onChange={e => upd(r.id, { [k]: e.target.value === '' ? '' : +e.target.value })} /></label>)}</>}
          </div></td></tr>] })}
      </tbody></table></div>
      <div className="installation-footer"><button className="qt-btn-ghost ps-btn" onClick={() => { setMap({ ...map, [type]: [...rows, blank()] }); setQ('') }}>Add item</button><button className="qt-btn-ghost ps-btn" onClick={reset}>Reset this type to defaults</button>
        <span style={{ flex: 1 }} className="ps-hint">{msg}</span><button className="qt-btn-primary ps-btn" onClick={save}>Save installation mapping</button></div>
    </div></section>
}

/* ---------- Pricing ---------- */
const LINES = [['discount_line', 'Discount'], ['profile_cost', 'Profile Cost'], ['profile_wastage_line', 'Profile Wastage'], ['ri_cost', 'RI Cost'], ['ri_wastage_line', 'Reinforcement wastage'], ['hardware_cost', 'Hardware Cost'], ['glass_cost', 'Glass Cost'], ['glass_wastage_line', 'Glass Wastage'], ['mesh_cost', 'Mesh Cost'], ['mesh_wastage_line', 'Mesh Wastage'], ['raw_total', 'Total Raw Material Cost'], ['fab_line', 'Fabrication Labour'], ['inst_line', 'Installation Labour'], ['inst_mat_line', 'Installation material'], ['sub_total', 'Sub Total inc. Labour'], ['profit_line', 'Profit margin'], ['basic_value', 'Basic Value'], ['transport_line', 'Transportation'], ['loading_line', 'Loading & Unloading'], ['project_total', 'Total Project Cost'], ['cgst_line', 'CGST'], ['sgst_line', 'SGST'], ['grand_total', 'Grand Total']]
function Pricing() {
  const { v, set, save, dirty } = useSection('pricing'); const [open, setOpen] = useState(false); const [h, setH] = useState({ name: '', type: 'AreaSqftFg', to: 'project_charge', value: 0 })
  if (!v) return null
  const N = (k, label, unit, sub, hint) => <Num label={label} unit={unit} sub={sub} hint={hint} value={v[k]} onChange={e => set(k, e.target.value === '' ? '' : +e.target.value)} />
  const shown = k => v['q_' + k] !== false; const heads = v.heads || []
  return <>
    <div className="ps-stack ps-pricing">
      <Card title="Quotation defaults" sub="Starting values for new quotations. Adjust them for each customer in Project costing.">
        <div className="ps-pillnote">Per quotation</div><div className="ps-grid">{N('profit', 'Profit margin', '%', 'Percentage', 'Added to cost. At 20%, ₹100 becomes ₹120.')}{N('discount', 'Discount', '%', 'Percentage', 'Applied to the window subtotal.')}
          {N('install_material', 'Installation material', '₹', '/ sq ft', 'Material allowance for every square foot.')}{N('transport', 'Transportation', '₹', 'Rupees per project', 'Total transportation charge per project.')}</div>
        <div className="ps-hint">Saved quotation choices are retained when these defaults change.</div></Card>
      <Card title="Labour & handling" sub="Rates for fabrication, fitting and handling."><div className="ps-grid">{N('fab_labour', 'Fabrication Labour', '₹', '/ sq ft')}{N('install_labour', 'Installation Labour', '₹', '/ sq ft')}{N('loading_unloading', 'Loading & Unloading', '₹', 'Rupees per project')}</div></Card>
      <Card title="Material wastage" sub="Allowance added to each material's cost."><div className="ps-grid">{N('profile_wastage', 'Profile Wastage', '%', 'Percentage')}{N('ri_wastage', 'Reinforcement wastage', '%', 'Percentage')}{N('glass_wastage', 'Glass Wastage', '%', 'Percentage')}{N('mesh_wastage', 'Mesh Wastage', '%', 'Percentage')}</div></Card>
      <Card title="Default reinforcement cost" sub="New quotations start at this rate. Change it for one customer in Project costing."><div className="ps-grid">{N('gi_rate', 'GI reinforcement', '₹', 'per kg')}</div><div><button className="qt-btn-ghost ps-btn" onClick={save}>Save</button></div></Card>
      <Card title="GST & quotation display" sub="GST is selected automatically from your Company GSTIN/state and the customer's location.">
        <div className="ps-grid">{N('gst', 'Default GST rate', '%', undefined, 'Same state: split equally into CGST and SGST. Different states: the full rate applies as IGST.')}</div><div className="ps-hint">Without customer GSTIN or state, quotations default to intra-state GST.</div>
        <label className="ps-check big"><input type="checkbox" aria-label="Show GST to customer" checked={!!v.show_gst} onChange={e => set('show_gst', e.target.checked)} /><span><b>Show GST to customer</b><em>Ticked: basic prices with GST rows at the bottom. Unticked: prices include GST, no GST rows.</em></span></label>
        <label className="ps-check big"><input type="checkbox" aria-label="Discount in quote" checked={!!v.show_discount} onChange={e => set('show_discount', e.target.checked)} /><span><b>Show discount on quotations</b><em>Hiding the line keeps the discount applied.</em></span></label></Card>
      <section className="qt-info-card"><button className="ps-collapse" onClick={() => setOpen(!open)}><span><div className="ps-card-title">Cost breakdown &amp; custom charges</div><div className="ps-card-sub">Manage quotation line visibility and add extra charges.</div></span><span>{open ? '⌃' : '⌄'}</span></button>
        {open && <div className="qt-card-body ps-form"><div className="ps-lines">{LINES.map(([k, l]) => <label key={k} className="ps-check"><input type="checkbox" aria-label={l + ' in quote'} checked={shown(k)} onChange={e => set('q_' + k, e.target.checked)} /> {l}</label>)}</div>
          <div className="ps-card-title" style={{ marginTop: 8 }}>Custom cost heads</div>{heads.map((x, i) => <div className="ps-reg" key={i}><b>{x.name}</b><span>{x.type} · {x.to} · {x.value}</span><button className="ps-terms-action danger" onClick={() => set('heads', heads.filter((_, k) => k !== i))}>🗑</button></div>)}
          <div className="ps-grid"><Field label="Name"><input placeholder="e.g. Delivery fee" value={h.name} onChange={e => setH({ ...h, name: e.target.value })} /></Field>
            <Field label="Type"><select aria-label="New cost head type" value={h.type} onChange={e => setH({ ...h, type: e.target.value })}><option value="AreaSqftFg">Per sq ft</option><option value="Percent">Percent</option><option value="Fixed">Fixed amount</option></select></Field>
            <Field label="Add to"><select aria-label="Add to" value={h.to} onChange={e => setH({ ...h, to: e.target.value })}><option value="project_charge">Project charge</option><option value="window_cost">Window cost</option></select></Field>
            <Field label="Value"><input type="number" aria-label="New cost head value" value={h.value} onChange={e => setH({ ...h, value: +e.target.value })} /></Field></div>
          <div><button className="qt-btn-ghost ps-btn" onClick={() => { if (h.name) { set('heads', [...heads, h]); setH({ name: '', type: 'AreaSqftFg', to: 'project_charge', value: 0 }) } }}>Add cost head</button></div></div>}</section>
      <div className="ps-foot">Material rates: Settings → Profile for profiles; Hardware → Accessories and Installation for gasket and mesh. Revision 1</div>
    </div>
    <SaveBar dirty={dirty} onSave={save} label="Save pricing" /></>
}

/* ---------- Configuration ---------- */
const CFG = [['welding', 'Welding allowance (per end)', 'Extra cut length at each welded end.'], ['sliding_lap', 'Sliding lap', 'Sliding sash overlap at each jamb.'], ['casement_overlap', 'Casement overlap', 'Sash overlap on the frame, per side.'], ['glass_clearance', 'Glass clearance (per side)', 'Subtracted from each side of the profile seating opening to size the glass.'], ['building_loss', 'Building loss (per side)', 'Gap between the wall opening and frame; zero uses the entered frame size.'], ['ri_deduction', 'Reinforcement deduction', 'Length removed from the profile length for its reinforcement.'], ['coupler_gap', 'Coupler gap', 'Gap between independently framed coupled units.'], ['louvre_pitch', 'Louvre blade pitch', 'Blade spacing; when unset, the catalogue joint rule applies.'], ['louvre_clearance', 'Louvre clearance', 'Blade end and stack clearance; when unset, the catalogue joint rule applies.']]
const CFG_DEF = { welding: 3, sliding_lap: 8, casement_overlap: 8, glass_clearance: 4, building_loss: 0, ri_deduction: 100, coupler_gap: 2, louvre_pitch: '', louvre_clearance: '' }
function Config() {
  const { v, set, save, dirty } = useSection('config'); if (!v) return null
  const sync = async () => { await api('/settings/config', { method: 'PUT', body: CFG_DEF }); location.reload() }
  return <>
    <p className="ps-intro">Save requires an internet connection. Sync to default removes this model’s custom values and fetches the latest server defaults. A saved change updates every draft quotation and open work order at once; confirmed quotations and work orders in production keep their recorded values.</p>
    <section className="qt-info-card"><div className="ps-brand-head"><b>S CRAFT uPVC Profiles</b><span className="ps-ver">Catalogue version 31</span></div>
      <div className="qt-card-body ps-cfg">{CFG.map(([k, l, h]) => <div className="ps-cfg-row" key={k}><div><div className="ps-num-l">{l}</div><div className="ps-hint">{h}</div></div>
        <div className="ps-cfg-in"><input type="number" placeholder="Auto" value={v[k] ?? ''} onChange={e => set(k, e.target.value === '' ? '' : +e.target.value)} /><span className="ps-sub">mm</span><span className={'ps-inh' + (v[k] === CFG_DEF[k] || v[k] === '' ? '' : ' custom')}>{v[k] === CFG_DEF[k] || v[k] === '' ? 'Inherited default' : 'Custom'}</span></div></div>)}</div></section>
    <div className="settings-save-bar"><span className="ps-saved"><i className={dirty ? 'dirty' : ''} />{dirty ? 'Unsaved changes' : 'All changes saved'}</span><span style={{ display: 'flex', gap: 10 }}><button className="qt-btn-ghost ps-btn" onClick={sync}>Sync to default</button><button className="qt-btn-primary action-with-icon" onClick={save}><Ico d={SAVE_ICON} size={16} />Save configuration</button></span></div></>
}

/* ---------- Tax ---------- */
function Tax() {
  const { v, set, save, dirty } = useSection('tax'); if (!v) return null
  const T = ([k, l]) => <Field key={k} label={l}><input value={v[k] || ''} onChange={e => set(k, e.target.value)} /></Field>
  return <>
    <div className="ps-stack">
      <Card title="Default HSN / SAC codes" sub="Starting points only — confirm each code with your accountant. Codes are frozen into each invoice when it is issued."><div className="ps-2col">{[['hsn_upvc', 'HSN — uPVC windows/doors'], ['hsn_alu', 'HSN — aluminium windows/doors'], ['hsn_glass', 'HSN — glass'], ['sac_install', 'SAC — installation / fabrication service'], ['sac_transport', 'SAC — transport'], ['sac_loading', 'SAC — loading / unloading']].map(T)}</div></Card>
      <Card title="Tally ledger names" sub="Must match the ledger names in your Tally company exactly; used when you export invoices to Tally."><div className="ps-2col">{[['ledger_sales', 'Sales ledger'], ['ledger_cgst', 'Output CGST ledger'], ['ledger_sgst', 'Output SGST ledger'], ['ledger_igst', 'Output IGST ledger'], ['ledger_round', 'Round-off ledger']].map(T)}</div></Card>
      <Card title="Invoice numbering" sub="Numbers run per financial year, e.g. INV/2026-27/0001. The prefix is 1–3 letters, digits or hyphens so the number stays within 16 characters (GST rule 46)."><div className="ps-2col">{T(['prefix', 'Invoice prefix'])}</div></Card>
    </div><SaveBar dirty={dirty} onSave={save} label="Save tax settings" /></>
}

/* ---------- Team ---------- */
function Team() {
  const [m, setM] = useState([]); const [add, setAdd] = useState(null); const [err, setErr] = useState('')
  const load = () => api('/team').then(setM); useEffect(() => { load() }, [])
  const active = m.filter(x => x.status !== 'Disabled').length, disabled = m.length - active, owner = m.find(x => x.role === 'owner') || {}
  const create = async () => { setErr(''); try { await api('/team', { method: 'POST', body: add }); setAdd(null); load() } catch (e) { setErr(e.message || 'Could not add') } }
  return <>
    <div className="ps-team-head"><button className="qt-btn-primary ps-btn" onClick={() => setAdd({ name: '', email: '', role: 'sales', password: '' })}>Add team member</button>
      <span className="ps-hint">Disabling or resetting an account revokes online sessions immediately. Previously issued offline licences remain valid until their signed expiry; secure the device when offboarding.</span></div>
    <div className="ps-stats">{[['ACTIVE MEMBERS', active], ['DISABLED', disabled], ['PAID SEATS', 1]].map(([l, n]) => <div className="qt-info-card ps-stat" key={l}><span>{l}</span><b>{n}</b></div>)}</div>
    <Card title="Members"><div className="ps-members">{m.map(x => <div className="ps-member" key={x.id}><span className="ps-avatar">{x.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}</span>
      <div style={{ flex: 1 }}><b>{x.name}</b><div className="ps-hint">{x.email}</div></div><span className="ps-role">{x.role[0].toUpperCase() + x.role.slice(1)}</span><span className={'ps-status ' + (x.status === 'Disabled' ? '' : 'on')}>{x.status}</span>
      {x.role === 'owner' ? <span className="ps-protected">PROTECTED</span> : <button className="qt-btn-ghost ps-btn" onClick={async () => { await api('/team/' + x.id, { method: 'PUT', body: { status: x.status === 'Disabled' ? 'Active' : 'Disabled' } }); load() }}>{x.status === 'Disabled' ? 'Enable' : 'Disable'}</button>}</div>)}</div></Card>
    <Card title="Reporting structure" sub="Each person sees their own leads and customers, and those of everyone beneath them. People with no named manager report to the company Owner.">
      <div className="ps-tree"><div><b>{owner.name}</b> <span className="ps-hint">owner</span></div>{m.filter(x => x.role !== 'owner').map(x => <div key={x.id} className="ps-tree-c">└ {x.name} <span className="ps-hint">{x.role}</span></div>)}</div>
      <div className="ps-hint">{owner.name} holds the only paid seat (the company Owner). Add paid users to your plan to invite team members.</div></Card>
    <Card title="FenstraWorks support access" sub="Every read-only support view of your workspace is recorded here with the staff member and the reason. Support can look but cannot change anything."><div className="ps-hint">FenstraWorks support has not viewed this workspace.</div></Card>
    {add && <div className="modal-bg" onClick={() => setAdd(null)}><div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420 }}><h3 style={{ marginTop: 0 }}>Add team member</h3>
      <Field label="Name"><input value={add.name} onChange={e => setAdd({ ...add, name: e.target.value })} /></Field><Field label="Email"><input type="email" value={add.email} onChange={e => setAdd({ ...add, email: e.target.value })} /></Field>
      <Field label="Role"><select value={add.role} onChange={e => setAdd({ ...add, role: e.target.value })}><option value="sales">Sales</option><option value="production">Production</option><option value="accounts">Accounts</option><option value="admin">Admin</option></select></Field>
      <Field label="Temporary password"><input type="text" value={add.password} onChange={e => setAdd({ ...add, password: e.target.value })} /></Field>
      {err && <div style={{ color: '#b91c1c', fontSize: 13 }}>{err}</div>}<div style={{ display: 'flex', gap: 8, marginTop: 14 }}><button className="qt-btn-primary ps-btn" onClick={create}>Add member</button><button className="qt-btn-ghost ps-btn" onClick={() => setAdd(null)}>Cancel</button></div></div></div>}</>
}

/* ---------- Support ---------- */
function Support() {
  const [t, setT] = useState([]); const [f, setF] = useState({ subject: '', body: '', quotation_id: '' }); const [q, setQ] = useState(''); const [diag, setDiag] = useState(true); const [drafts, setDrafts] = useState(false); const [prev, setPrev] = useState(false)
  const load = () => api('/tickets').then(setT); useEffect(() => { load() }, [])
  const submit = async () => { await api('/tickets', { method: 'POST', body: f }); setF({ subject: '', body: '', quotation_id: '' }); setPrev(false); load() }
  return <>
    <div className="ps-stack">
      <Card title="New support ticket"><Field label="Subject"><input value={f.subject} onChange={e => setF({ ...f, subject: e.target.value })} /></Field>
        <Field label="Describe the problem"><textarea rows="4" value={f.body} onChange={e => setF({ ...f, body: e.target.value })} /></Field>
        <Field label="Quotation ID (optional)"><input value={f.quotation_id} onChange={e => setF({ ...f, quotation_id: e.target.value })} /></Field>
        <label className="ps-check"><input type="checkbox" checked={diag} onChange={e => setDiag(e.target.checked)} /> Attach diagnostics from this device (recommended)</label>
        <label className="ps-check"><input type="checkbox" checked={drafts} onChange={e => setDrafts(e.target.checked)} /> Also include my unsaved drafts (they can contain customer details)</label>
        {prev && <pre className="ps-preview">{JSON.stringify({ ...f, diagnostics: diag ? { browser: navigator.userAgent, page: location.pathname } : undefined, drafts: drafts ? 'included' : undefined }, null, 2)}</pre>}
        <div style={{ display: 'flex', gap: 8 }}><button className="qt-btn-ghost ps-btn" onClick={() => setPrev(!prev)}>Preview what will be sent</button><button className="qt-btn-primary ps-btn" disabled={!f.subject} onClick={submit}>Submit ticket</button></div></Card>
      <Card title="Tickets"><input className="ps-search" type="search" placeholder="Search tickets" value={q} onChange={e => setQ(e.target.value)} />
        {t.filter(x => x.subject.toLowerCase().includes(q.toLowerCase())).map(x => <div className="ps-reg" key={x.id}><b>{x.subject}</b><span>{(x.created_at || '').slice(0, 10)}</span><span className="ps-status on">{x.status || 'Open'}</span></div>)}
        {!t.filter(x => x.subject.toLowerCase().includes(q.toLowerCase())).length && <div className="ps-hint">No matching tickets.</div>}</Card>
    </div></>
}
