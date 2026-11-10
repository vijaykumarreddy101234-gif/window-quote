import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [err, setErr] = useState('')
  const nav = useNavigate()
  async function submit(e) {
    e.preventDefault(); setErr('')
    const r = await fetch('/api/v1/app/auth/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) })
    const d = await r.json()
    if (!r.ok) return setErr(d.error || 'Sign in failed')
    localStorage.setItem('fw_token', d.token); nav('/dashboard')
  }
  return (
    <div className="login"><form className="box" onSubmit={submit}>
      <img src="/brand/raviraja-logo.png" width="200" alt="Raviraja Industries" />
      <h2 style={{ margin: '18px 0 4px' }}>Welcome back</h2>
      <div className="muted" style={{ fontSize: 14 }}>Sign in to your workspace</div>
      <label>Email</label><input type="email" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} required />
      <label>Password</label><input type="password" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} required />
      {err && <div className="err">{err}</div>}
      <button className="btn" type="submit">Sign In</button>
    </form></div>
  )
}
