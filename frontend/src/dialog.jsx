import { useEffect, useState } from 'react'
// In-app dialogs (native prompt/confirm/alert are blocked in embedded frames)
let push = null
const call = d => new Promise(res => { if (push) push({ ...d, res }); else res(d.kind === 'confirm' ? false : null) })
// fields: [{k,label,value,type,required}] -> resolves object or null
export const askForm = (title, fields, ok = 'Save') => call({ kind: 'form', title, fields, ok })
export const askText = async (title, value = '') => { const r = await askForm(title, [{ k: 'v', label: title, value, required: true }], 'OK'); return r ? r.v : null }
export const askConfirm = (msg, ok = 'Confirm') => call({ kind: 'confirm', msg, ok })
export const say = msg => call({ kind: 'alert', msg })
export function DialogHost() {
  const [d, setD] = useState(null); const [vals, setVals] = useState({}); const [err, setErr] = useState('')
  useEffect(() => { push = x => { setVals(Object.fromEntries((x.fields || []).map(f => [f.k, f.value ?? '']))); setErr(''); setD(x) }; return () => { push = null } }, [])
  if (!d) return null
  const close = r => { d.res(r); setD(null) }
  const submit = e => {
    e && e.preventDefault()
    if (d.kind === 'form') { const m = d.fields.find(f => f.required && !String(vals[f.k] ?? '').trim()); if (m) return setErr(m.label + ' is required'); close(vals) } else close(d.kind === 'confirm' ? true : null)
  }
  return <div className="dlg-back" onMouseDown={e => e.target === e.currentTarget && close(d.kind === 'confirm' ? false : null)}>
    <form className="dlg" onSubmit={submit}>
      {d.title && <h3>{d.title}</h3>}{d.msg && <p>{d.msg}</p>}
      {d.kind === 'form' && d.fields.map((f, i) => <label key={f.k} className="dlg-f"><span>{f.label}{f.required ? ' *' : ''}</span><input autoFocus={i === 0} type={f.type || 'text'} value={vals[f.k]} onChange={e => setVals({ ...vals, [f.k]: e.target.value })} /></label>)}
      {err && <div className="dlg-err">{err}</div>}
      <div className="dlg-a">{d.kind !== 'alert' && <button type="button" className="btn ghost" onClick={() => close(d.kind === 'confirm' ? false : null)}>Cancel</button>}<button className="btn" autoFocus={d.kind !== 'form'}>{d.kind === 'alert' ? 'OK' : d.ok}</button></div>
    </form></div>
}
