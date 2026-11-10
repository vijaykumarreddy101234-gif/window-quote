import { useLocation, useNavigate } from 'react-router-dom'
export const Ico = ({ d, size = 20 }) => <svg className="module-sidebar-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
const I = {
  wo: 'M9 3h6v3H9z M7 5H5v16h14V5h-2 M9 12h6 M9 16h4', box: 'M21 8l-9-5-9 5v8l9 5 9-5z M3 8l9 5 9-5 M12 13v8', cart: 'M3 4h2l2 11h11l2-8H6 M9 20h.01 M17 20h.01',
  truck: 'M2 6h11v10H2z M13 9h4l3 3v4h-7 M6 19h.01 M17 19h.01', down: 'M12 3v12 M7 10l5 5 5-5 M4 21h16', list: 'M9 3h6v3H9z M7 5H5v16h14V5h-2 M9 11l1.5 1.5L13 10 M9 17h6',
  users: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z M22 21v-2a4 4 0 0 0-3-3.87 M16 3.13a4 4 0 0 1 0 7.75', chart: 'M5 20V10 M12 20V4 M19 20v-7', inv: 'M6 3h9l4 4v14H6z M9 12h6 M9 16h6',
}
const PROD = [['Work orders', '/production', I.wo], ['Inventory', '/inventory', I.box, 'group'], ['Stock', '/inventory', I.box], ['Purchase orders', '/inventory/purchase-orders', I.cart], ['Suppliers', '/inventory/suppliers', I.truck], ['Issue / Receipt', '/inventory/issue-receipt', I.down], ['Order requirements', '/inventory/orders', I.list], ['Customers', '/production?view=customers', I.users], ['Reports', '/production?view=reports', I.chart]]
const INV = [['Work orders', '/production', I.wo], ['Invoices', '/invoices', I.inv]]
export function ProdLayout({ kind = 'production', heading, children }) {
  const nav = useNavigate(); const { pathname, search } = useLocation()
  const items = kind === 'invoices' ? INV : kind === 'wo' ? [['Work order', null, I.wo]] : PROD.filter(x => x[3] === 'group' || x[1].startsWith('/production') || pathname.startsWith('/inventory'))
  const active = it => { const to = it[1]; return act(to, it) }
  const act = (to, it) => { if (!to) return true; const [p, q] = to.split('?'); if (q) return pathname === p && search.includes(q); if (p === '/production') return pathname.startsWith('/production') && !search; if (p === '/inventory') return it[3] === 'group' ? false : pathname === '/inventory'; return pathname === p }
  return <div className="module-workspace">
    <aside className="module-sidebar" aria-label="Section navigation"><div className="module-sidebar-heading">{heading || (kind === 'invoices' ? 'INVOICES' : 'PRODUCTION')}</div>
      <nav>{items.map(it => <button key={it[0]} type="button" title={it[0]} aria-label={it[0]} className={'module-sidebar-link' + (active(it) ? ' active' : '')} onClick={() => it[1] && nav(it[1])}><Ico d={it[2]} /><span className="module-sidebar-label">{it[0]}</span></button>)}</nav></aside>
    <div className="module-content">{children}</div></div>
}
