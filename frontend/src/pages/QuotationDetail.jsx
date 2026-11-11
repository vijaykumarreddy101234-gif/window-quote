import { useEffect, useState } from 'react'
import { useNavigate, useParams, Link } from 'react-router-dom'
import { api, inr, inr2, token, downloadFile } from '../api'
import { WindowSvg } from '../WindowSvg'
import { Icon } from '../Icons'
import { PricingTab, InventoryTab, DocumentsTab } from './QuoteTabs'
import { askConfirm } from '../dialog'
const ICON = { sliding: '🪟', casement: '🔲', combination: '⊞', fixed: '▫️' }
const STEPS = ['draft', 'sent', 'confirmed', 'work order']

export default function QuotationDetail() {
  const { id } = useParams(); const nav = useNavigate()
  const [q, setQ] = useState(null); const [tab, setTab] = useState('windows'); const [edit, setEdit] = useState(null); const [picked, setPicked] = useState([]); const [note, setNote] = useState(false)
  const load = () => api(`/quotations/${id}`).then(setQ).catch(() => setQ(false))
  useEffect(() => { load() }, [id])
  const [glassOpts, setGlassOpts] = useState([]); useEffect(() => { api('/glass').then(g => setGlassOpts((g || []).map(x => x.name))).catch(() => {}) }, [])
  const [lang, setLang] = useState('en'); const [dlOpen, setDlOpen] = useState(false); const [send, setSend] = useState(null)
  if (q === false) return <div className="card">Quotation not found.</div>
  if (!q) return null
  const p = q.pricing; const locked = q.status !== 'draft'
  const stepIdx = q.workOrder ? 3 : STEPS.indexOf(q.status)
  const setStatus = async s => { await api(`/quotations/${id}/status`, { method: 'POST', body: { status: s } }); load() }
  const save = async it => { it.id ? await api(`/quotations/${id}/items/${it.id}`, { method: 'PUT', body: it }) : await api(`/quotations/${id}/items`, { method: 'POST', body: it }); setEdit(null); load() }
  const del = async it => { if (!await askConfirm(`Delete ${it.mark} — ${it.name}?`, 'Delete')) return; await api(`/quotations/${id}/items/${it.id}`, { method: 'DELETE' }); load() }
  const setQty = async (it, v) => { const n = Math.max(1, Math.min(9999, +v || 1)); await api(`/quotations/${id}/items/${it.id}`, { method: 'PUT', body: { ...it, qty: n } }); load() }
  const dup = async () => { const r = await api(`/quotations/${id}/version`, { method: 'POST' }).catch(() => null); if (r && r.id) nav(`/quotations/${r.id}`) }
  const bulkDel = async () => { if (!await askConfirm(`Delete ${picked.length} selected window(s)?`, 'Delete')) return; for (const k of picked) await api(`/quotations/${id}/items/${k}`, { method: 'DELETE' }); setPicked([]); load() }
  const copy = async it => { await api(`/quotations/${id}/items/${it.id}/copy`, { method: 'POST' }); load() }
  const sel = new Set(picked); const toggle = k => { const n = new Set(picked); n.has(k) ? n.delete(k) : n.add(k); setPicked([...n]) }
  const gst = (p.cgst || 0) + (p.sgst || 0)
  const saveInfo = async (k, val, old) => { if ((val || '') === (old || '')) return; if (['name', 'phone', 'email'].includes(k)) await api(`/customers/${q.customer_id}`, { method: 'PUT', body: { [k]: val } }); else await api(`/quotations/${id}`, { method: 'PUT', body: { [k]: val } }); load() }
  const saveDefault = async (k, val) => { await api(`/quotations/${id}`, { method: 'PUT', body: k === 'glass' ? { default_glass: val } : { defaults: { [k]: val } } }); load() }
  const LANGS = [['en', 'English'], ['hi', 'हिन्दी'], ['ta', 'தமிழ்'], ['te', 'తెలుగు'], ['bn', 'বাংলা'], ['mr', 'मराठी']]
  const dl = f => downloadFile(`/quotations/${id}/download?format=${f}&lang=${lang}`, `quotation.${f}`)
  const openSend = async () => { setSend(await api(`/quotations/${id}/share`)) }
  const markSent = async () => { await setStatus('sent'); setSend(null) }
  return (<div className="qt-detail-root">
    <div className="qt-detail-topbar">
      <button className="qt-back-btn" onClick={() => nav('/quotations')}>← Back</button>
      <span className="qt-topbar-qnum">{q.number}</span>
      <span className="qt-topbar-title">{q.customer && q.customer.name} — {q.project || 'Untitled Project'}</span>
      <div className="qt-nav-pills">{[['windows', 'Windows', 'quotations'], ['documents', 'Documents', 'file'], ['inventory', 'Inventory', 'box'], ['pricing', 'Pricing', 'tag']].map(([t, l, ic]) => <button key={t} type="button" className={'qt-nav-pill' + (tab === t ? ' active' : '')} onClick={() => setTab(t)}><Icon n={ic} size={16} />{l}</button>)}</div>
    </div>
    <div className="qt-quote-workspace">
      <aside className="qt-details-rail"><details className="qt-details-pane"><summary title="Customer & quotation details"><Icon n="file" size={20} /><span>Customer &amp; quotation details</span></summary>
        <div className="qt-details-content"><div className="qt-info-card"><div className="qt-info-card-head"><h4>Customer &amp; Project Details</h4></div>
          <div className="qt-info-grid">{[['Customer Name', 'name', q.customer && q.customer.name, 'text'], ['Phone', 'phone', q.customer && q.customer.phone, 'tel'], ['Email', 'email', q.customer && q.customer.email, 'email'], ['Project Name', 'project', q.project, 'text'], ['Site Address', 'site_address', q.site_address, 'text']].map(([l, k, v, ty]) => <div key={k} className="qt-info-field"><label className="qt-info-label">{l}</label><input key={k + (v || '')} className="qt-info-input" type={ty} readOnly={locked} defaultValue={v || ''} placeholder={'Enter ' + l + '…'} onBlur={e => saveInfo(k, e.target.value, v)} /></div>)}</div>
          <div className="qt-defaults-row">{[['Brand', 'brand', ['S CRAFT'], 'S CRAFT'], ['System', 'system', ['S CRAFT uPVC Profiles'], 'S CRAFT uPVC Profiles'], ['Color', 'color', ['White', 'Ivory', 'Anthracite Grey', 'Rosewood', 'Golden Oak'], 'White'], ['Glass', 'glass', ['Legacy: DGU 4+12+4', ...glassOpts], q.default_glass || '5 mm clear glass'], ['Hardware', 'hardware', ['Generic hardware'], 'Generic hardware']].map(([l, k, o, dv]) => <div key={k} className="qt-default-field"><span>{l}</span><select className="qt-default-select" disabled={locked} value={k === 'glass' ? dv : ((q.defaults || {})[k] || dv)} onChange={e => saveDefault(k, e.target.value)}>{o.map(x => <option key={x}>{x}</option>)}</select></div>)}</div></div></div></details></aside>
      <div className="qt-detail-body qt-windows-panel">
        {tab === 'windows' && <>
        <div className="qt-designs-head"><div className="qt-designs-title"><h3>Designs ({p.designs})</h3>{picked.length > 0 && <span className="qt-bulk">{picked.length} selected{!locked && <button className="qt-action-btn" onClick={bulkDel}>🗑 Delete selected</button>}<button className="qt-action-btn" onClick={() => setPicked([])}>Clear</button></span>}</div>
          <div className="qt-stage-steps">{STEPS.map((s, i) => <span key={s} className="qt-stage-item">{i > 0 && <span className="qt-stage-line" />}<span className={'qt-stage ' + (i === stepIdx ? 'qt-stage-on' : i < stepIdx ? 'qt-stage-done' : 'qt-stage-todo')}><span className="qt-stage-n">{i < stepIdx ? '✓' : i + 1}</span><span className="qt-stage-label">{s[0].toUpperCase() + s.slice(1)}</span></span></span>)}</div></div>
        <button type="button" className="qt-notice-banner" onClick={() => setNote(!note)}><span>⚠</span><span className="qt-first-use-text"><strong>Check before cutting:</strong> first order of this design or profile system for your account.</span><span className="qt-first-use-more">{note ? 'Hide details' : 'Show details'}</span></button>
        {note && <div className="qt-notice-more">Sizes and profile cut lists for a design or profile system you have not produced before should be checked against a trial window before cutting bulk material.</div>}
        <div className="qt-quote-layout"><div className="qt-quote-main"><div className="qt-design-grid">
          {p.items.map(it => <div className="qt-design-card" key={it.id}>
            <label className="qt-design-select"><input type="checkbox" checked={sel.has(it.id)} onChange={() => toggle(it.id)} aria-label={'Select ' + it.mark} /></label>
            {!locked && <div className="qt-design-actions"><button className="qt-action-btn" title="Quick edit: name, size, qty, glass" onClick={() => setEdit(it)}>⋮</button><button className="qt-action-btn" title="Duplicate this window at new sizes (no designer needed)" onClick={() => copy(it)}>⧉</button><button className="qt-action-btn" title="Delete" onClick={() => del(it)}>🗑</button></div>}
            <div className="qt-design-thumb" role="button" tabIndex={0} onClick={() => nav(`/quotations/${id}/design/${it.id}`)}><WindowSvg item={it} mini /><div className="qt-design-thumb-overlay"><span className="qt-design-open-hint">⊞ Open in designer</span></div></div>
            <div className="qt-design-body"><div className="qt-design-name"><span className="qt-design-ref">{it.mark}</span>{it.name}</div>
              <div className="qt-design-spec qt-design-product">{it.system}</div>
              <div className="qt-design-spec"><span className="qt-design-size">{it.width} × {it.height} mm</span> · {it.type === 'combination' || it.type === 'casement' ? (/door/i.test(it.name + it.system) ? 'door' : it.type) : it.type}{it.qty > 1 && <span> · ×{it.qty}</span>}</div>
              <div className="qt-design-spec qt-design-spec-soft"><span>Glass {(String(it.glass).match(/\d+(\.\d+)?/) || [''])[0]}mm</span> · <span>{it.mesh === 'No mesh' ? 'No mesh' : 'Mesh: ' + it.mesh}</span> · <span>{it.area.toFixed(2)} sq ft</span></div>
              {it.error && <div className="qt-design-status error" title={it.error}>⚠ Pricing failed — design {it.mark} cannot be priced: {it.error}</div>}</div>
            <div className="qt-design-footer"><span className="qt-design-price"><strong>{inr(it.each)}</strong></span><span className="qt-design-qty">× <input key={it.id + ':' + it.qty} className="qt-design-qty-input" type="number" min="1" max="9999" disabled={locked} defaultValue={it.qty} aria-label={'Quantity of ' + it.mark} onBlur={ev => +ev.target.value !== it.qty && setQty(it, ev.target.value)} onKeyDown={ev => ev.key === 'Enter' && ev.target.blur()} /></span></div>
          </div>)}
          {!locked && <button className="qt-add-design-card" onClick={() => nav(`/quotations/${id}/new-window`)}><span className="qt-add-icon">+</span><span>Add window</span><span className="qt-add-hint">Template or blank — opens the designer</span></button>}
        </div></div>
        <aside className="qt-summary-panel"><div className="qt-summary-bar"><button type="button" className="qt-summary-head" title="Open the pricing breakdown" onClick={() => setTab('pricing')}><span className="qt-summary-lbl">GRAND TOTAL</span><span className="qt-summary-total">{inr(p.total)}</span><span className="qt-summary-meta">{p.designs} designs · {p.windows} windows</span></button>
          <div className="qt-summary-breakdown"><div className="qt-summary-item"><span className="qt-summary-lbl">Subtotal</span><span className="qt-summary-val">{inr(p.subtotal)}</span></div><div className="qt-summary-item"><span className="qt-summary-lbl">Discount ({p.discount || 0}%)</span><span className="qt-summary-val">-{inr(p.discountAmt || 0)}</span></div>{(p.transport + p.loading + p.unloading) > 0 && <div className="qt-summary-item"><span className="qt-summary-lbl">Charges</span><span className="qt-summary-val">+{inr(p.transport + p.loading + p.unloading)}</span></div>}<div className="qt-summary-item"><span className="qt-summary-lbl">GST (18%)</span><span className="qt-summary-val">+{inr(gst)}</span></div></div>
          <div className="qt-summary-breakdown"><div className="qt-summary-item"><span className="qt-summary-lbl">Total area</span><span className="qt-summary-val">{p.area.toFixed(2)} sq ft</span></div><div className="qt-summary-item"><span className="qt-summary-lbl">Price per sq ft</span><span className="qt-summary-val">{inr2(p.area ? p.total / p.area : 0)} / sq ft</span></div></div></div>
          <section className="qt-quote-actions">
            {q.status === 'draft' && <button className="qt-btn-primary qt-send-btn" onClick={openSend}>Send to customer</button>}
            {q.status === 'sent' && <button className="qt-btn-primary qt-send-btn" onClick={() => setStatus('confirmed')}>Confirm quotation</button>}
            {q.workOrder && <Link className="qt-btn-primary qt-send-btn" to={`/production/${q.workOrder.id}`}>{q.workOrder.number}</Link>}
            {q.status !== 'draft' && <button type="button" className="qt-btn-ghost" onClick={openSend}><Icon n="send" size={16} />Share with customer</button>}
            <div className="document-download" style={{ position: 'relative' }}>
              <button type="button" className="qt-btn-ghost document-download__trigger" onClick={() => setDlOpen(!dlOpen)}><Icon n="pdf" size={16} /><span>Download</span><span className="document-download__chevron">⌄</span></button>
              {dlOpen && <div className="document-download__menu">
                <div className="dd-h">Quotation language</div>
                <div className="dd-langs">{LANGS.map(([k, l]) => <button key={k} className={lang === k ? 'on' : ''} onClick={() => setLang(k)}>{l}</button>)}</div>
                {[['pdf', 'PDF', '.pdf'], ['xlsx', 'Excel', '.xlsx'], ['docx', 'Word', '.docx']].map(([f, n, e]) => <button key={f} className="document-download__option" onClick={() => { dl(f); setDlOpen(false) }}><b>{n}</b><span>{e}</span></button>)}
              </div>}
            </div>
            <button type="button" className="qt-btn-ghost" title="Duplicate quotation as a new draft" onClick={dup}><Icon n="copy" size={16} />Duplicate quotation</button></section></aside></div></>}
        {tab === 'documents' && <DocumentsTab id={id} q={q} lang={lang} setLang={setLang} />}
        {send && <div className="modal-bg" onClick={() => setSend(null)}><div className="modal" onClick={ev => ev.stopPropagation()} style={{ maxWidth: 520 }}>
          <h3 style={{ marginTop: 0 }}>Send to customer</h3>
          <div className="muted" style={{ marginBottom: 8 }}>{send.customer || 'Customer'}{send.phone ? ' · ' + send.phone : ' · no phone on file'}</div>
          <textarea className="note" rows={5} readOnly value={send.message} style={{ width: '100%' }} />
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
            <a className="btn green" href={send.whatsapp} target="_blank" rel="noreferrer" onClick={() => q.status === 'draft' && markSent()}>Send on WhatsApp</a>
            <a className="btn" href={send.mailto} onClick={() => q.status === 'draft' && markSent()}>Email</a>
            <button className="btn ghost" onClick={() => navigator.clipboard && navigator.clipboard.writeText(send.message)}>Copy message</button>
            {q.status === 'draft' && <button className="btn ghost" onClick={markSent}>Mark as sent</button>}
            <button className="btn ghost" onClick={() => setSend(null)}>Close</button></div>
        </div></div>}
    {tab === 'inventory' && <InventoryTab id={id} q={q} />}
    {tab === 'pricing' && <PricingTab id={id} q={q} locked={locked} reload={load} />}

      </div>
    </div>
    {edit && <ItemModal item={edit} glassOpts={glassOpts} onClose={() => setEdit(null)} onSave={save} />}
  </div>)
}

function ItemModal({ item, onClose, onSave, glassOpts = [] }) {
  const [f, setF] = useState({ location: '', notes: '', ...item }); const set = k => e => setF({ ...f, [k]: e.target.type === 'number' ? e.target.value : e.target.value })
  const gl = [...new Set([f.glass, ...glassOpts].filter(Boolean))]
  const clean = () => ({ ...f, width: +f.width || 0, height: +f.height || 0, qty: Math.max(1, +f.qty || 1) })
  return <div className="modal-bg" onClick={onClose}><div className="modal qe-modal" onClick={e => e.stopPropagation()}>
    <div className="qe-head"><h3>{item.id ? <><span className="qe-ref">{item.mark}</span> — Quick Edit</> : 'Add window'}</h3><button className="qe-x" onClick={onClose} aria-label="Close">✕</button></div>
    <div className="qe-grid">
      <div><label>WINDOW CODE</label><input value={f.mark || ''} onChange={set('mark')} /></div>
      <div><label>DESIGN NAME</label><input autoFocus value={f.name || ''} onChange={set('name')} /></div>
      <div><label>WIDTH (MM)</label><input type="number" value={f.width} onChange={set('width')} /></div>
      <div><label>HEIGHT (MM)</label><input type="number" value={f.height} onChange={set('height')} /></div>
      <div><label>QUANTITY</label><input type="number" min="1" max="9999" value={f.qty} onChange={set('qty')} /></div>
      <div><label>LOCATION</label><input placeholder="e.g. Living Room" value={f.location || ''} onChange={set('location')} /></div>
    </div>
    <label>GLASS TYPE</label><select value={f.glass || ''} onChange={set('glass')}>{gl.map(g => <option key={g}>{g}</option>)}</select>
    <p className="qe-hint">Applies to every pane of this window; a fan light keeps its board. Only glass the bead takes is listed.</p>
    <label>NOTES</label><textarea rows="3" placeholder="Special mention for this window, printed on the quotation" value={f.notes || ''} onChange={set('notes')} />
    <div className="qe-foot"><button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={() => onSave(clean())}>Save &amp; Reprice</button></div>
  </div></div>
}
