import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
export default function Login() {
  const [email, setEmail] = useState('vijaykumarreddy101234@gmail.com'); const [password, setPassword] = useState(''); const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false); const [show, setShow] = useState(false)
  const nav = useNavigate()
  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true)
    try {
      const r = await fetch('/api/v1/app/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
      const d = await r.json().catch(() => ({}))
      if (!r.ok) { setErr(d.error || 'Wrong email or password'); return }
      localStorage.setItem('fw_token', d.token); nav('/dashboard')
    } catch (e2) { setErr('Cannot reach the server — check your connection and try again') }
    finally { setBusy(false) }
  }
  return (
    <div className="login">
      <form className="box" onSubmit={submit}>
        <div className="login-head">
          <img src="/brand/raviraja-logo.png" width="190" alt="Raviraja Industries" />
          <h2>Welcome back</h2>
          <div className="muted">Sign in to your fabrication workspace</div>
        </div>
        <label>Email</label>
        <input type="email" autoComplete="username" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
        <label>Password</label>
        <div className="pw-wrap">
          <input type={show ? 'text' : 'password'} autoComplete="current-password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
          <button type="button" className="pw-eye" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow(s => !s)}>{show ? '🙈' : '👁'}</button>
        </div>
        {err && <div className="err-banner">⚠ {err}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign In'}</button>
        <div className="login-foot">uPVC windows · quotations · production · invoicing</div>
      </form>
    </div>
  )
}
