import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
// Dimension keypad (digits, + - . C, backspace, =, close, ok) shown when a dimension is pressed.
const evalExpr = s => { const t = String(s).replace(/\s+/g, ''); if (!/^[0-9.+\-]+$/.test(t)) return NaN; const parts = t.match(/[+-]?[0-9.]+/g); if (!parts || parts.join('') !== t.replace(/^\+/, '')) return NaN; return parts.reduce((a, p) => a + parseFloat(p), 0) }
export function CalcPad({ value, x, y, onOk, onClose }) {
  const [txt, setTxt] = useState(String(value)); const [fresh, setFresh] = useState(true)
  const press = k => { setFresh(false); setTxt(t => (fresh && /[0-9.]/.test(k)) ? k : t + k) }
  const eq = () => { const v = evalExpr(txt); if (!isNaN(v)) { setTxt(String(Math.round(v * 100) / 100)); setFresh(false); return v } return NaN }
  const ok = () => { const v = evalExpr(txt); if (!isNaN(v) && v > 0) onOk(Math.round(v)); else onClose() }
  useEffect(() => {
    const h = e => { if (e.key === 'Escape') onClose(); else if (e.key === 'Enter') { e.preventDefault(); ok() } else if (/^[0-9.+\-]$/.test(e.key)) press(e.key); else if (e.key === 'Backspace') { setFresh(false); setTxt(t => t.slice(0, -1)) } else if (e.key === '=') eq() }
    window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h)
  })
  const W = 270, H = 330, left = Math.max(8, Math.min(window.innerWidth - W - 8, x - W / 2)), top = Math.max(8, Math.min(window.innerHeight - H - 8, y - 60))
  const keys = [['1', '2', '3', 'C'], ['4', '5', '6', '+'], ['7', '8', '9', '-'], ['.', '0', '⌫', '=']]
  return createPortal(<div className="calc-back" onMouseDown={e => e.target === e.currentTarget && onClose()}>
    <div className="calc" style={{ left, top }}>
      <div className="calc-disp"><span className={fresh ? 'sel' : ''}>{txt || '0'}</span></div>
      <div className="calc-grid">{keys.flat().map(k => <button key={k} className={'ck' + (/[C+\-=⌫]/.test(k) ? ' op' : '')} onClick={() => { if (k === 'C') { setTxt('0'); setFresh(true) } else if (k === '⌫') { setFresh(false); setTxt(t => t.length > 1 ? t.slice(0, -1) : '0') } else if (k === '=') eq(); else press(k) }}>{k}</button>)}</div>
      <div className="calc-act"><button onClick={onClose}>close</button><button onClick={ok}>ok</button></div>
    </div></div>, document.body)
}
