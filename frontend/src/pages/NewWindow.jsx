import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../api'
import { askForm } from '../dialog'
import { WindowSvg } from '../WindowSvg'
import { GROUPS, GALLERY, CAT_ICONS } from '../templates'

const TINTS = { 'SLIDING WINDOWS': '#eff6ff', 'SLIDING DOORS': '#eff6ff', 'CASEMENT WINDOWS': '#f0fdf4', 'CASEMENT DOORS': '#f0fdf4', VENTILATORS: '#fefce8', 'BAY WINDOWS': '#f5f3ff' }
const CatIcon = ({ d }) => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const label = c => c === 'All Designs' ? c : c[0] + c.slice(1).toLowerCase()
export default function NewWindow() {
  const { id } = useParams(); const nav = useNavigate(); const [cat, setCat] = useState('All Designs')
  const make = async t => {
    const f = await askForm(`Window code for ${t ? t.name : 'blank window'}`, [{ k: 'code', label: 'Window code', placeholder: 'e.g. W1, D1, V1 — your own code for this window', required: true }, { k: 'qty', label: 'Quantity', value: '1', type: 'number', required: true }], 'Open in designer →', 'The code stays on every window produced from this design; production tells them apart by location.')
    if (!f) return
    const r = await api(`/quotations/${id}/items`, { method: 'POST', body: { mark: f.code.trim(), name: t ? t.name : 'Window', system: t ? t.system : '62 series sliding window', width: t ? t.w : 1200, height: t ? t.h : 1200, type: t ? t.type : 'sliding', qty: Math.max(1, +f.qty || 1), glass: '5 mm clear glass', thickness: '5 mm', mesh: t?.mesh || 'No mesh' } })
    await api(`/quotations/${id}/items/${r.id}/design`, { method: 'PUT', body: { design: t ? t.d : { kind: 'sliding', panels: 2, mesh: 0 } } })
    nav(`/quotations/${id}/design/${r.id}`)
  }
  const list = GALLERY.filter(t => cat === 'All Designs' || t.group === cat)
  return <div className="qt-catalog-root">
    <div className="qt-catalog-head"><div><button className="qt-back-btn" onClick={() => nav(`/quotations/${id}`)}>← Back to Quote</button><h3 className="qt-catalog-title">New window</h3></div>
      <button className="qt-btn-primary" onClick={() => make(null)}>+ Start blank</button></div>
    <div className="qt-catalog-cats">{['All Designs', ...GROUPS].map(c => <button key={c} className={'qt-cat-pill' + (cat === c ? ' on' : '')} onClick={() => setCat(c)}><CatIcon d={CAT_ICONS[c]} /><span className="qt-cat-label">{label(c)}</span></button>)}</div>
    <div className="qt-catalog-grid">{list.map(t => <div key={t.id} className="qt-template-card" onClick={() => make(t)}>
      <div className="qt-template-thumb" style={{ background: TINTS[t.group] }}><WindowSvg item={{ width: t.w, height: t.h, type: t.type, name: t.name, system: t.system }} design={t.d} mini /></div>
      <div className="qt-template-info"><div className="qt-template-cat">{label(t.group)}</div><div className="qt-template-name">{t.name}</div></div>
      <button className="qt-template-select" aria-label={`Open ${t.name} in designer`}>Open in designer →</button></div>)}</div>
  </div>
}
