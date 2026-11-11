import { useEffect, useState, useCallback } from 'react'
import { api, inr, downloadFile } from '../api'
import { say, askConfirm } from '../dialog'

const TABS = [['dashboard', 'Dashboard', 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z'], ['leads', 'Leads', 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM19 8v6M22 11h-6'],
  ['customers', 'Customers', 'M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM23 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8'], ['pipeline', 'Pipeline', 'M22 3H2l8 9.5V19l4 2v-8.5z'],
  ['reports', 'Sales Reports', 'M22 7l-8.5 8.5-5-5L2 17M16 7h6v6'], ['settings', 'CRM Settings', 'M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z']]
const ago = d => { if (!d) return '—'; const n = Math.floor((Date.now() - new Date(d)) / 864e5); return n < 1 ? 'Today' : n < 7 ? n + 'd ago' : new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) }
const dmy = d => d ? new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'

export default function CRM() {
  const [tab, setTab] = useState(() => sessionStorage.getItem('crm_tab') || 'pipeline')
  const [S, setS] = useState(null), [leads, setLeads] = useState([]), [q, setQ] = useState(''), [adding, setAdding] = useState(false), [editing, setEditing] = useState(null), [tick, setTick] = useState(0)
  const go = t => { setTab(t); sessionStorage.setItem('crm_tab', t) }
  const load = useCallback(() => { api('/crm/leads').then(r => setLeads(r.data)); api('/crm/settings').then(r => setS(r.data)) }, [])
  useEffect(load, [load, tick])
  const reload = () => setTick(x => x + 1)
  if (!S) return <p className="muted">Loading…</p>
  const stages = S.pipeline.stages
  const move = async (l, stage) => {
    let extra = {}
    if (stage === 'won' || stage === 'lost') { const list = S.pipeline[stage + '_reasons'] || []; const r = await pickReason(stage, list); if (r === null) return; extra = { [stage + '_reason']: r } }
    setLeads(ls => ls.map(x => x.id === l.id ? { ...x, stage, ...extra } : x)); await api('/crm/leads/' + l.id, { method: 'PUT', body: { stage, ...extra } }); reload()
  }
  return <div className="crm">
    <aside className="crm-side"><h6>CRM</h6>{TABS.map(([k, l, d]) => <button key={k} className={tab === k ? 'on' : ''} onClick={() => go(k)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>{l}</button>)}</aside>
    <section className="crm-main">
      {tab === 'dashboard' && <Dash S={S} tick={tick} />}
      {tab === 'leads' && <Leads S={S} leads={leads} onAdd={() => setAdding(true)} onOpen={setEditing} />}
      {tab === 'customers' && <Customers tick={tick} />}
      {tab === 'pipeline' && <Pipeline S={S} leads={leads} q={q} setQ={setQ} onAdd={() => setAdding(true)} onOpen={setEditing} move={move} />}
      {tab === 'reports' && <Reports S={S} />}
      {tab === 'settings' && <Settings S={S} onSaved={setS} />}
    </section>
    {adding && <LeadForm S={S} onClose={() => setAdding(false)} onSaved={() => { setAdding(false); reload() }} />}
    {editing && <LeadForm S={S} lead={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); reload() }} />}
    {tab !== 'settings' && null}
  </div>
}
function pickReason(stage, list) {
  return new Promise(res => { const el = document.createElement('div'); document.body.appendChild(el); import('react-dom/client').then(({ createRoot }) => { const root = createRoot(el); const done = v => { root.unmount(); el.remove(); res(v) }
    root.render(<ReasonDlg stage={stage} list={list} done={done} />) }) })
}
function ReasonDlg({ stage, list, done }) {
  const [v, setV] = useState('')
  return <div className="crm-modal"><div className="crm-dlg" style={{ width: 380 }}><h3>{stage === 'won' ? '🏆 Mark as Won' : '✖ Mark as Lost'}</h3>
    <label>{stage === 'won' ? 'Why was it won?' : 'Why was it lost?'}<select value={v} onChange={e => setV(e.target.value)}><option value="">— Select reason —</option>{list.map(r => <option key={r}>{r}</option>)}</select></label>
    <div className="crm-foot"><button className="btn ghost" onClick={() => done(null)}>Cancel</button><button className="btn" onClick={() => done(v)}>Confirm</button></div></div></div>
}

function Dash({ S, tick }) {
  const [d, setD] = useState(null); useEffect(() => { api('/crm/dashboard').then(r => setD(r.data)) }, [tick])
  if (!d) return <p className="muted">Loading…</p>
  const T = S.targets, Card = ({ l, v, s, c }) => <div className="crm-stat"><small>{l}</small><b style={{ color: c }}>{v}</b><span>{s}</span></div>
  return <><div className="crm-h"><div><h2>Dashboard</h2><p className="muted">Your leads, opportunities and sales at a glance.</p></div></div>
    <div className="crm-stats"><Card l="TOTAL LEADS" v={d.total_leads} s={`${d.unique_customers} unique customers`} /><Card l="PIPELINE VALUE" v={inr(d.pipeline_value)} s="Active opportunities" c="#2563eb" /><Card l="WON THIS PERIOD" v={inr(d.won_value)} s={`${d.won_count} deals closed`} c="#059669" /><Card l="WIN RATE" v={d.win_rate + '%'} s={`${d.won_count} won / ${d.lost_count} lost`} /></div>
    <div className="crm-stats"><Card l="NEW LEADS" v={d.new_count} s="Awaiting contact" /><Card l="FOLLOW-UPS" v={d.followup_count} s="Need attention" c="#d97706" /><Card l="QUOTED" v={d.quoted_count} s="Awaiting decision" c="#7c3aed" /><Card l="CUSTOMERS" v={d.unique_customers} s="Across all leads" /></div>
    {(T.monthly_revenue_target > 0 || T.monthly_lead_target > 0) && <div className="card crm-targets">{T.monthly_revenue_target > 0 && <Bar l={`Revenue target ${inr(d.won_value)} / ${inr(T.monthly_revenue_target)}`} p={d.won_value / T.monthly_revenue_target} />}{T.monthly_lead_target > 0 && <Bar l={`Lead target ${d.total_leads} / ${T.monthly_lead_target}`} p={d.total_leads / T.monthly_lead_target} />}</div>}
    <div className="card"><h3>Pipeline Stage Breakdown</h3>{S.pipeline.stages.map(s => { const n = d.stage_counts[s.id] || 0, mx = Math.max(1, ...Object.values(d.stage_counts)); return <div className="crm-bar" key={s.id}><span>{s.icon} {s.label}</span><i><u style={{ width: (n / mx * 100) + '%', background: s.color }} /></i><b>{n} leads · {inr(d.stage_values[s.id])}</b></div> })}</div></>
}
const Bar = ({ l, p }) => <div style={{ marginBottom: 10 }}><small>{l}</small><div className="crm-prog"><u style={{ width: Math.min(100, p * 100) + '%' }} /></div></div>

function Leads({ S, leads, onAdd, onOpen }) {
  const [f, setF] = useState('all'), st = S.pipeline.stages, rows = f === 'all' ? leads : leads.filter(l => l.stage === f), sm = id => st.find(s => s.id === id) || {}
  return <><div className="crm-h"><div><h2>All Leads</h2><p className="muted">{rows.length} of {leads.length} leads</p></div><div className="crm-hb"><button className="btn ghost" onClick={() => downloadFile('/crm/export?kind=leads', 'crm-leads.xlsx')}>Export Excel</button><button className="btn" onClick={onAdd}>+ Add Lead</button></div></div>
    <div className="crm-tabs"><button className={f === 'all' ? 'on' : ''} onClick={() => setF('all')}>All <em>{leads.length}</em></button>{st.map(s => <button key={s.id} className={f === s.id ? 'on' : ''} onClick={() => setF(s.id)}>{s.label} <em>{leads.filter(l => l.stage === s.id).length}</em></button>)}</div>
    <div className="card" style={{ padding: 0, overflow: 'auto' }}><table><thead><tr><th>LEAD TITLE</th><th>CUSTOMER</th><th>STAGE</th><th>VALUE</th><th>CREATED</th></tr></thead><tbody>
      {rows.length === 0 ? <tr><td colSpan="5" className="muted" style={{ textAlign: 'center', padding: 30 }}>No leads found</td></tr> : rows.map(l => <tr key={l.id} className="rowlink" onClick={() => onOpen(l)}><td><b>{l.title}</b><br /><small className="muted">{l.number}</small></td><td>{l.customer_name}<br /><small className="muted">{l.phone}</small></td><td><span className="crm-pill" style={{ background: sm(l.stage).color + '22', color: sm(l.stage).color }}>{sm(l.stage).label}</span></td><td>{l.value ? inr(l.value) : '—'}</td><td>{dmy(l.created_at)}</td></tr>)}</tbody></table></div></>
}
function Customers({ tick }) {
  const [rows, setRows] = useState([]), [q, setQ] = useState(''); const load = () => api('/crm/customers').then(r => setRows(r.data)); useEffect(() => { load() }, [tick])
  const add = async () => { const f = await formDlg('Add customer', [['name', 'Name *'], ['phone', 'Phone'], ['email', 'Email']]); if (!f || !f.name) return; await api('/customers', { method: 'POST', body: f }); load() }
  const shown = rows.filter(r => !q || (r.name + r.phone + r.email).toLowerCase().includes(q.toLowerCase()))
  return <><div className="crm-h"><div><h2>Customers</h2><p className="muted">{rows.length} customers · Your saved customers and everyone in your pipeline</p></div><div className="crm-hb"><button className="btn ghost" onClick={() => downloadFile('/crm/export?kind=customers', 'crm-customers.xlsx')}>Export Excel</button><button className="btn" onClick={add}>+ Add customer</button></div></div>
    <input className="crm-search" type="search" placeholder="Search customers…" value={q} onChange={e => setQ(e.target.value)} />
    <div className="card" style={{ padding: 0, overflow: 'auto' }}><table><thead><tr><th>CUSTOMER</th><th>PHONE</th><th>LEADS</th><th>TOTAL VALUE</th><th>STATUS</th><th>LAST ACTIVITY</th></tr></thead><tbody>{shown.map(r => <tr key={r.id}><td><b>{r.name}</b><br /><small className="muted">{r.email}</small></td><td>{r.phone || '—'}</td><td>{r.leads}</td><td>{r.total_value ? inr(r.total_value) : '—'}</td><td>{r.status}</td><td>{ago(r.last_activity)}</td></tr>)}</tbody></table></div></>
}
function Pipeline({ S, leads, q, setQ, onAdd, onOpen, move }) {
  const st = S.pipeline.stages, [over, setOver] = useState(null), sq = q.toLowerCase(), shown = leads.filter(l => !sq || (l.title + l.customer_name + l.phone).toLowerCase().includes(sq))
  const open = leads.filter(l => !['won', 'lost'].includes(l.stage)), won = leads.filter(l => l.stage === 'won'), fu = leads.filter(l => l.stage === 'followup').length, sum = a => a.reduce((x, l) => x + (l.value || 0), 0)
  return <><div className="crm-h"><div><h2>Pipeline</h2><p className="muted">{leads.length} leads · {fu} to follow up</p></div><div className="crm-hstats"><div><b>{inr(sum(open))}</b><small>Open pipeline value</small></div><div className="won"><b>{inr(sum(won))}</b><small>Won · {won.length} leads</small></div></div></div>
    <div className="crm-bar2"><input type="search" placeholder="Search leads…" value={q} onChange={e => setQ(e.target.value)} /><button className="btn" onClick={onAdd}>+ Add Lead</button></div>
    <div className="crm-board">{st.map(s => { const col = shown.filter(l => l.stage === s.id)
      return <div key={s.id} className={'crm-col' + (over === s.id ? ' over' : '')} style={{ '--c': s.color }} onDragOver={e => { e.preventDefault(); setOver(s.id) }} onDragLeave={() => setOver(null)} onDrop={e => { e.preventDefault(); setOver(null); const l = leads.find(x => x.id === e.dataTransfer.getData('text/plain')); if (l && l.stage !== s.id) move(l, s.id) }}>
        <div className="crm-ch"><span><i style={{ background: s.color }} />{s.label}</span><em style={{ color: s.color }}>{col.length}</em></div><div className="crm-cv" style={{ color: s.color }}>{inr(sum(col))}</div>
        {col.length === 0 ? <div className="crm-drop">Drop leads here</div> : col.map(l => <div key={l.id} className="crm-card" draggable onDragStart={e => e.dataTransfer.setData('text/plain', l.id)} onClick={() => onOpen(l)}><b>{l.title}</b><small>{l.customer_name}{l.phone ? ' · ' + l.phone : ''}</small><div><span>{l.value ? inr(l.value) : '—'}</span>{l.close_date && <small>Close {dmy(l.close_date)}</small>}</div>
          <select aria-label="Move to stage" value={l.stage} onClick={e => e.stopPropagation()} onChange={e => move(l, e.target.value)}>{st.map(x => <option key={x.id} value={x.id}>{x.label}</option>)}</select></div>)}
      </div> })}</div></>
}
function Reports({ S }) {
  const iso = d => d.toISOString().slice(0, 10), [p, setP] = useState({ report: 'cohort', from: iso(new Date(Date.now() - 89 * 864e5)), to: iso(new Date()), source: 'all' }), [R, setR] = useState(null)
  useEffect(() => { api('/crm/reports?' + new URLSearchParams(p)).then(r => setR(r.data)) }, [p])
  const set = (k, v) => setP(x => ({ ...x, [k]: v })), dash = v => v == null ? '—' : v
  const csv = () => { if (!R) return; const t = R.team, rows = [['Salesperson', 'Leads', 'Quoted', 'Won', 'Lost', 'Win rate', 'Pipeline', 'Weighted', 'Won value', 'Avg days to close'], [t.name, t.leads, t.quoted, t.won, t.lost, t.win_rate ?? '', t.pipeline, t.weighted, t.won_value, t.avg_days ?? '']]
    const b = new Blob([rows.map(r => r.join(',')).join('\n')], { type: 'text/csv' }), a = document.createElement('a'); a.href = URL.createObjectURL(b); a.download = 'sales-report.csv'; a.click() }
  const srcs = ['Typed in', 'Website form', 'IndiaMART', 'Other', ...(S.lead_defaults.lead_sources || [])]
  return <><div className="crm-h"><div><h2>Sales Reports</h2><p className="muted">Leads created in the range (India time), by their current outcome.</p></div></div>
    <div className="card crm-filters"><label>Report<select value={p.report} onChange={e => set('report', e.target.value)}><option value="cohort">Created-date cohort</option><option value="closures">Monthly closures</option></select></label><label>From<input type="date" value={p.from} onChange={e => set('from', e.target.value)} /></label><label>To<input type="date" value={p.to} onChange={e => set('to', e.target.value)} /></label>
      <label>Source<select value={p.source} onChange={e => set('source', e.target.value)}><option value="all">All sources</option>{[...new Set(srcs)].map(s => <option key={s}>{s}</option>)}</select></label><button className="btn ghost" onClick={csv}>Download CSV</button></div>
    {!R ? <p className="muted">Loading…</p> : <>
      <div className="card" style={{ overflow: 'auto' }}><h3>By salesperson</h3><table><thead><tr>{['SALESPERSON', 'LEADS', 'QUOTED', 'WON', 'LOST', 'WIN RATE', 'PIPELINE', 'WEIGHTED', 'WON VALUE', 'AVG DAYS TO CLOSE'].map(h => <th key={h}>{h}</th>)}</tr></thead><tbody><tr className="tot"><td><b>{R.team.name}</b></td><td>{R.team.leads}</td><td>{R.team.quoted}</td><td>{R.team.won}</td><td>{R.team.lost}</td><td>{R.team.win_rate == null ? '—' : R.team.win_rate + '%'}</td><td>{inr(R.team.pipeline)}</td><td>{inr(R.team.weighted)}</td><td>{inr(R.team.won_value)}</td><td>{dash(R.team.avg_days)}</td></tr></tbody></table></div>
      <div className="card"><h3>Lost reasons</h3>{R.reasons.length === 0 ? <p className="muted">No lost leads in this range.</p> : R.reasons.map(r => <div className="crm-bar" key={r.reason}><span>{r.reason}</span><i><u style={{ width: (r.count / Math.max(...R.reasons.map(x => x.count)) * 100) + '%', background: '#ef4444' }} /></i><b>{r.count}</b></div>)}</div>
      <div className="card" style={{ overflow: 'auto' }}><h3>Weighted forecast</h3><table><thead><tr><th>STAGE</th><th>PROBABILITY</th><th>LEADS</th><th>VALUE</th><th>WEIGHTED</th></tr></thead><tbody>{R.forecast.map(f => <tr key={f.stage}><td>{f.stage.toUpperCase()}</td><td>{f.probability}%</td><td>{f.leads}</td><td>{inr(f.value)}</td><td>{inr(f.weighted)}</td></tr>)}<tr className="tot"><td><b>FORECAST</b></td><td /><td>{R.forecast_total.leads}</td><td>{inr(R.forecast_total.value)}</td><td>{inr(R.forecast_total.weighted)}</td></tr></tbody></table></div>
      <div className="card"><h3>Quotation funnel</h3><p className="muted">Quotations created in the range. Approval can come without the customer accepting online, so that step may pass 100%.</p>
        {[['Quotations created', 'created'], ['Sent to customer', 'sent'], ['Share link viewed', 'viewed'], ['Customer accepted', 'accepted'], ['Approved', 'approved'], ['Converted to work order', 'converted']].map(([l, k], i, a) => { const v = R.funnel[k], c = R.funnel.created, pv = i ? R.funnel[a[i - 1][1]] : null, pc = n => n ? (v / n * 100).toFixed(1) + '%' : '0%'
          return <div className="crm-fun" key={k}><span>{l}</span><i><u style={{ width: (c ? v / c * 100 : 0) + '%' }} /></i><b>{v}</b><small>{i ? `${pc(c)} of created · ${pv ? pc(pv) : '—'} of previous` : ''}</small></div> })}</div></>}</>
}
function Chips({ list, onChange, ph }) {
  const [v, setV] = useState('')
  return <div className="crm-chips">{list.map(x => <span key={x}>{x}<button onClick={() => onChange(list.filter(y => y !== x))}>✕</button></span>)}<input value={v} placeholder={ph} onChange={e => setV(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && v.trim()) { onChange([...list, v.trim()]); setV('') } }} /><button className="btn ghost sm" onClick={() => { if (v.trim()) { onChange([...list, v.trim()]); setV('') } }}>+ Add</button></div>
}
function Settings({ S, onSaved }) {
  const [d, setD] = useState(() => JSON.parse(JSON.stringify(S))), [busy, setBusy] = useState(false)
  const up = (g, k, v) => setD(x => ({ ...x, [g]: { ...x[g], [k]: v } })), P = d.pipeline, stages = P.stages, drag = { i: null }
  const save = async () => { setBusy(true); try { const r = await api('/crm/settings', { method: 'PUT', body: d }); onSaved(r.data); await say('CRM settings saved.') } finally { setBusy(false) } }
  const setStage = (i, k, v) => up('pipeline', 'stages', stages.map((s, j) => j === i ? { ...s, [k]: v } : s))
  const Sec = ({ ic, t, s, children }) => <div className="card crm-sec"><div className="crm-sh"><span>{ic}</span><div><h3>{t}</h3><p className="muted">{s}</p></div></div>{children}</div>
  const Row = ({ t, s, children }) => <div className="crm-row"><div><b>{t}</b><p className="muted">{s}</p></div><div>{children}</div></div>
  const Tog = ({ g, k }) => <button className={'crm-tog' + (d[g][k] ? ' on' : '')} onClick={() => up(g, k, !d[g][k])}>{d[g][k] ? 'Enabled' : 'Disabled'}</button>
  const req = ['customer_name', 'customer_phone', 'email', 'project_value', 'close_date'], rl = { customer_name: 'Customer Name', customer_phone: 'Phone', email: 'Email', project_value: 'Project Value', close_date: 'Close Date' }
  return <><div className="crm-h"><div><h2>CRM Settings</h2><p className="muted">Configure your pipeline, lead rules, and team preferences</p></div><button className="btn" disabled={busy} onClick={save}>💾 Save Changes</button></div>
    <Sec ic="🔀" t="Pipeline Configuration" s="Customise stage names, colors, and won/lost reasons"><Row t="PIPELINE STAGES" s="Rename stages or change their color. Reorder by dragging (order reflects in the Kanban board).">
      {stages.map((s, i) => <div className="crm-stage" key={s.id} draggable onDragStart={() => { drag.i = i }} onDragOver={e => e.preventDefault()} onDrop={() => { if (drag.i == null || drag.i === i) return; const a = [...stages], [m] = a.splice(drag.i, 1); a.splice(i, 0, m); up('pipeline', 'stages', a) }}><span>⠿</span><input type="color" value={s.color} onChange={e => setStage(i, 'color', e.target.value)} /><input className="ic" value={s.icon} onChange={e => setStage(i, 'icon', e.target.value)} /><input value={s.label} onChange={e => setStage(i, 'label', e.target.value)} /><input type="number" min="0" max="100" value={s.probability} onChange={e => setStage(i, 'probability', +e.target.value)} /><em>%</em></div>)}</Row>
      <Row t="WON REASONS" s="Why do deals close? Shown as a dropdown when marking a lead as Won."><Chips list={P.won_reasons} onChange={v => up('pipeline', 'won_reasons', v)} ph="Add won reason…" /></Row>
      <Row t="LOST REASONS" s="Capture why deals were lost for future analysis."><Chips list={P.lost_reasons} onChange={v => up('pipeline', 'lost_reasons', v)} ph="Add lost reason…" /></Row></Sec>
    <Sec ic="📋" t="Lead Defaults" s="Control how new leads are created and tracked"><Row t="DEFAULT STAGE" s="Which stage new leads start in when added."><select value={d.lead_defaults.default_stage} onChange={e => up('lead_defaults', 'default_stage', e.target.value)}>{stages.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}</select></Row>
      <Row t="LEAD NUMBER FORMAT" s="Format for auto-generated lead IDs. Use {YEAR} and {SEQ} placeholders."><input value={d.lead_defaults.lead_number_format} onChange={e => up('lead_defaults', 'lead_number_format', e.target.value)} /></Row>
      <Row t="LEAD SOURCE TAGS" s="Where do your leads come from? Used to tag and filter leads."><Chips list={d.lead_defaults.lead_sources} onChange={v => up('lead_defaults', 'lead_sources', v)} ph="Add lead source…" /></Row>
      <Row t="REQUIRED FIELDS" s="Fields that must be filled when adding a new lead.">{req.map(k => <label className="crm-chk" key={k}><input type="checkbox" checked={d.lead_defaults.required_fields.includes(k)} onChange={e => up('lead_defaults', 'required_fields', e.target.checked ? [...d.lead_defaults.required_fields, k] : d.lead_defaults.required_fields.filter(x => x !== k))} />{rl[k]}</label>)}</Row></Sec>
    <Sec ic="🔔" t="Follow-ups & Reminders" s="Prevent leads from going stale with automatic reminders"><Row t="FOLLOW-UP REMINDER (DAYS)" s="Alert salesperson if no activity after this many days."><input type="number" value={d.follow_ups.reminder_days} onChange={e => up('follow_ups', 'reminder_days', +e.target.value)} /></Row>
      <Row t="STALE LEAD THRESHOLD (DAYS)" s="Flag a lead as stale after this many days of inactivity."><input type="number" value={d.follow_ups.stale_lead_days} onChange={e => up('follow_ups', 'stale_lead_days', +e.target.value)} /></Row>
      <Row t="AUTO-CLOSE LOST (DAYS)" s="Automatically move inactive leads to Lost after this period."><input type="number" value={d.follow_ups.auto_close_lost_days} onChange={e => up('follow_ups', 'auto_close_lost_days', +e.target.value)} /></Row></Sec>
    <Sec ic="👥" t="Team & Assignment" s="Control how leads are assigned across your sales team"><Row t="SALESPERSON ASSIGNMENT" s="Assign leads to specific team members."><Tog g="team" k="enable_assignment" /></Row>
      <Row t="TERRITORY / REGION TAGS" s="Tag leads with geographic or business-type segments."><Chips list={d.team.territories} onChange={v => up('team', 'territories', v)} ph="Add territory…" /></Row></Sec>
    <Sec ic="📤" t="Notifications" s="Get alerted when important CRM events happen"><Row t="NEW LEAD ALERT" s="Receive a notification whenever a new lead is added."><Tog g="notifications" k="new_lead_alert" /></Row><Row t="STAGE CHANGE ALERT" s="Get notified when a lead is moved to Won or Lost."><Tog g="notifications" k="stage_change_alert" /></Row>
      <Row t="NOTIFICATION EMAIL" s="Where to send alerts (leave blank to use your account email)."><input type="email" placeholder="alerts@yourcompany.com" value={d.notifications.notification_email} onChange={e => up('notifications', 'notification_email', e.target.value)} /></Row></Sec>
    <Sec ic="📊" t="Targets & Quotas" s="Set monthly goals visible on the CRM dashboard"><Row t="MONTHLY REVENUE TARGET (₹)" s="Won-value goal shown as a progress bar on the dashboard."><input type="number" value={d.targets.monthly_revenue_target} onChange={e => up('targets', 'monthly_revenue_target', +e.target.value)} /></Row>
      <Row t="MONTHLY LEAD COUNT TARGET" s="Number of new leads to add each month."><input type="number" value={d.targets.monthly_lead_target} onChange={e => up('targets', 'monthly_lead_target', +e.target.value)} /></Row></Sec></>
}
function formDlg(title, fields) {
  return new Promise(res => { const el = document.createElement('div'); document.body.appendChild(el); import('react-dom/client').then(({ createRoot }) => { const root = createRoot(el), done = v => { root.unmount(); el.remove(); res(v) }; root.render(<GenForm title={title} fields={fields} done={done} />) }) })
}
function GenForm({ title, fields, done }) {
  const [v, setV] = useState({})
  return <div className="crm-modal"><div className="crm-dlg"><h3>{title}</h3>{fields.map(([k, l]) => <label key={k}>{l}<input value={v[k] || ''} onChange={e => setV({ ...v, [k]: e.target.value })} /></label>)}<div className="crm-foot"><button className="btn ghost" onClick={() => done(null)}>Cancel</button><button className="btn" onClick={() => done(v)}>Save</button></div></div></div>
}
function LeadForm({ S, lead, onClose, onSaved }) {
  const st = S.pipeline.stages, req = S.lead_defaults.required_fields || [], [f, setF] = useState(lead ? { ...lead } : { title: '', customer_name: '', phone: '', email: '', stage: S.lead_defaults.default_stage || 'new', value: '', close_date: '', source: '', notes: '' }), [err, setErr] = useState('')
  const set = (k, v) => setF(x => ({ ...x, [k]: v })), star = k => req.includes(k) ? ' *' : ''
  const save = async () => { setErr(''); if (!f.title.trim()) return setErr('Lead title is required')
    const need = { customer_name: f.customer_name, customer_phone: f.phone, email: f.email, project_value: f.value, close_date: f.close_date }; const miss = req.filter(k => need[k] !== undefined && !need[k]); if (miss.length) return setErr('Please fill: ' + miss.map(k => k.replace('_', ' ')).join(', '))
    try { await api(lead ? '/crm/leads/' + lead.id : '/crm/leads', { method: lead ? 'PUT' : 'POST', body: f }); onSaved() } catch (e) { setErr(e.message) } }
  const del = async () => { if (await askConfirm('Delete this lead?', 'Delete')) { await api('/crm/leads/' + lead.id, { method: 'DELETE' }); onSaved() } }
  return <div className="crm-modal" onClick={onClose}><div className="crm-dlg" onClick={e => e.stopPropagation()}><div className="crm-dh"><h3>{lead ? 'Edit Lead' : 'Add New Lead'}</h3><button onClick={onClose}>✕</button></div>
    <label>Lead Title *<input autoFocus placeholder="e.g. Villa — 42 Sliding Windows" value={f.title} onChange={e => set('title', e.target.value)} /></label>
    <div className="crm-2"><label>Customer Name{star('customer_name') || ' *'}<input placeholder="e.g. Mr. Ravi Agarwal" value={f.customer_name} onChange={e => set('customer_name', e.target.value)} /></label><label>Phone{star('customer_phone') || ' *'}<input type="tel" placeholder="9876543210" value={f.phone} onChange={e => set('phone', e.target.value)} /></label></div>
    <label>Email{star('email')}<input type="email" placeholder="customer@email.com" value={f.email} onChange={e => set('email', e.target.value)} /></label>
    <div className="crm-2"><label>Stage<select value={f.stage} onChange={e => set('stage', e.target.value)}>{st.map(s => <option key={s.id} value={s.id}>{s.icon} {s.label}</option>)}</select></label><label>Source<select value={f.source || ''} onChange={e => set('source', e.target.value)}><option value="">—</option>{S.lead_defaults.lead_sources.map(s => <option key={s}>{s}</option>)}</select></label></div>
    <div className="crm-2"><label>Est. Value (₹){star('project_value')}<input type="number" placeholder="850000" value={f.value} onChange={e => set('value', e.target.value)} /></label><label>Expected Close{star('close_date')}<input type="date" value={f.close_date || ''} onChange={e => set('close_date', e.target.value)} /></label></div>
    {lead && <label>Notes<textarea rows="2" value={f.notes || ''} onChange={e => set('notes', e.target.value)} /></label>}
    {err && <div className="err-banner">{err}</div>}
    <div className="crm-foot">{lead && <button className="btn ghost" style={{ marginRight: 'auto', color: '#dc2626' }} onClick={del}>Delete</button>}<button className="btn ghost" onClick={onClose}>Cancel</button><button className="btn" onClick={save}>{lead ? 'Save' : 'Add Lead'}</button></div></div></div>
}
