import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { api, inr } from '../api'
const LANGS = ['English', 'हिन्दी', 'தமிழ்', 'తెలుగు', 'বাংলা', 'मराठी']
const m2 = n => '₹' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const d = s => new Date(s).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
const dt = s => new Date(s).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false })
export default function Account() {
  const [a, setA] = useState(null); const [sp] = useSearchParams(); const [cur, setCur] = useState(''); const [nw, setNw] = useState(''); const [cf, setCf] = useState(''); const [show, setShow] = useState(false); const [msg, setMsg] = useState('')
  const load = () => api('/account').then(setA)
  useEffect(() => { load() }, [])
  useEffect(() => { if (sp.get('section') === 'password') setTimeout(() => { const e = document.getElementById('acc-password'); e && e.scrollIntoView({ behavior: 'smooth' }) }, 300) }, [a])
  if (!a) return <p className="muted">Loading…</p>
  const u = a.user, ini = (u.name || '').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(), p = a.plan
  const setLang = l => { setA({ ...a, language: l }); api('/account/language', { method: 'PUT', body: { language: l } }) }
  const change = async () => { setMsg(''); if (nw !== cf) return setMsg('The new passwords do not match.'); try { await api('/auth/password', { method: 'POST', body: { current: cur, next: nw } }); localStorage.removeItem('fw_token'); window.location.href = '/login' } catch (e) { setMsg(e.message || 'Could not change the password') } }
  const End = id => api('/account/sessions/' + id, { method: 'DELETE' }).then(load)
  return <div className="acc-page">
    <h1 className="qt-page-title">My account</h1><p className="qt-page-subtitle">Manage your profile, language and sign-in security.</p>
    <div className="acc-hero"><span className="acc-av">{ini}</span><div><div className="acc-name">{u.name}</div><div className="acc-mail">{u.email}</div><div><span className="acc-owner">{(u.role || 'owner').toUpperCase()}</span> <span className="acc-co">{a.company.name}</span></div></div></div>
    <div className="acc-cols"><div className="acc-col">
      <section className="acc-card"><header><h3>Company</h3><Link to="/settings/company">Edit company details</Link></header>
        {[['BUSINESS NAME', a.company.name], ['BUSINESS ADDRESS', a.company.address], ['PHONE', a.company.phone], ['EMAIL', a.company.email]].map(([l, v]) => <div className="acc-field" key={l}><label>{l}</label>{v ? <div>{v}</div> : <i>Not set</i>}</div>)}</section>
      <section className="acc-card"><header><h3>Language</h3></header><label className="acc-lbl">Default language</label>
        <div className="acc-langs">{LANGS.map(l => <button key={l} className={'acc-lang' + (a.language === l ? ' on' : '')} onClick={() => setLang(l)}>{l}</button>)}</div>
        <p className="muted" style={{ fontSize: 13 }}>Used throughout the app. You can choose a different language when downloading a quotation.</p></section>
      <section className="acc-card"><header><h3>Subscription</h3></header>
        <div className="acc-kv">{[['Billing plan', p.name], ['Active features', p.features], ['Subscription expires', d(p.expires)], ['Read-only access until', d(p.readonly_until)], ['Users paid for', p.users_paid], ['Users in use', p.users_in_use]].map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}</div>
        <p className="muted" style={{ fontSize: 13 }}>Adding users is not available right now: Basic includes 1 user. More users are sold on Pro: upgrade your plan below, then add users here.</p>
        <button className="btn" disabled>Add users</button></section>
      <section className="acc-card"><header><h3>Upgrade or renew</h3></header><p className="muted" style={{ fontSize: 13 }}>Online payments are temporarily unavailable. Please try again later.</p>
        {[[`Basic plan renewal — 12 months`, '1 users', '2027-10-13 to 2028-10-13 (end exclusive)', p.renew, `Renew Basic · Pay ${m2(p.renew)}`], [`Plan upgrade from Basic to Pro, ${p.days_left} of 365 days left`, '1 users', '2026-11-10 to 2027-10-13 (end exclusive)', p.upgrade, `Upgrade to Pro · Pay ${m2(p.upgrade)}`]].map(([t, u1, r, amt, b]) => <div className="acc-offer" key={t}><b>{t}</b><div className="muted">{u1}</div><div className="muted">{r}</div><div>Before tax: {m2(amt)}</div><div>GST (0%): ₹0.00</div><div><b>Total to pay: {m2(amt)}</b></div><button className="btn" disabled>{b}</button></div>)}
        <p className="muted" style={{ fontSize: 13 }}>Subscription support: <a href="mailto:support@fenstraworks.com">support@fenstraworks.com</a></p></section>
      <section className="acc-card"><header><h3>Subscription invoices</h3></header><p className="muted">No subscription invoices yet.</p></section>
    </div><div className="acc-col">
      <section className="acc-card" id="acc-password"><header><h3>Change password</h3></header>
        <label className="acc-lbl">Current password</label><input className="acc-in" type={show ? 'text' : 'password'} autoComplete="current-password" value={cur} onChange={e => setCur(e.target.value)} />
        <div className="acc-row"><label className="acc-lbl">New password</label><a onClick={() => setShow(!show)}>{show ? 'Hide password' : 'Show password'}</a></div><input className="acc-in" type={show ? 'text' : 'password'} autoComplete="new-password" value={nw} onChange={e => setNw(e.target.value)} />
        <label className="acc-lbl">Confirm new password</label><input className="acc-in" type={show ? 'text' : 'password'} autoComplete="new-password" value={cf} onChange={e => setCf(e.target.value)} />
        <p className="muted" style={{ fontSize: 13 }}>Use at least 8 characters. Changing it signs you out on every device.</p>{msg && <p style={{ color: '#dc2626', fontSize: 13 }}>{msg}</p>}
        <button className="btn acc-primary" disabled={!cur || nw.length < 8 || !cf} onClick={change}>Change password</button></section>
      <section className="acc-card"><header><h3>Sign-in security</h3></header><p className="muted" style={{ fontSize: 13 }}>Passwords, MFA and account recovery are managed by your identity provider when secure sign-in is enabled.</p></section>
      <section className="acc-card"><header><h3>Active sessions</h3><button className="btn ghost" onClick={load}>Refresh sessions</button></header><p className="muted" style={{ fontSize: 13 }}>End sessions you no longer use. To end this session, use Sign Out in your account menu.</p>
        {a.sessions.map(s => <div className="acc-sess" key={s.id}><div><b>{s.current ? 'This session' : 'Other session'}</b><div className="muted">Signed in {dt(s.signed_in)}</div><div className="muted">Last renewed {dt(s.renewed)}</div></div>{!s.current && <button className="btn ghost" onClick={() => End(s.id)}>End session</button>}</div>)}</section>
    </div></div></div>
}
