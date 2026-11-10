import { say } from './dialog'
const BASE = '/api/v1/app'
export const token = () => localStorage.getItem('fw_token')
export async function api(path, opts = {}) {
  const res = await fetch(BASE + path, {
    ...opts,
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token(), ...(opts.headers || {}) },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  })
  if (res.status === 401) { localStorage.removeItem('fw_token'); location.href = '/login'; throw new Error('Unauthorized') }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error || 'Request failed')
  return data
}
export const inr = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })
export const inr2 = (n) => '₹' + Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })

// Download a file from the API (works with the Bearer token, no pop-up blockers, no inline PDF viewer needed)
export async function downloadFile(path, fallbackName = 'download') {
  const res = await fetch(BASE + path, { headers: { Authorization: 'Bearer ' + token() } })
  if (res.status === 401) { localStorage.removeItem('fw_token'); location.href = '/login'; return }
  if (!res.ok) { const e = await res.json().catch(() => ({})); say(e.error || 'Download failed'); return }
  const cd = res.headers.get('Content-Disposition') || '', m = /filename="?([^";]+)"?/.exec(cd)
  const blob = await res.blob(), name = m ? m[1] : fallbackName
  return saveBlob(blob, name)
}
export async function saveBlob(blob, name) {
  // inside the artifact viewer plain downloads are blocked: use its download capability when present
  try { const dl = window.claude && window.claude.use ? await window.claude.use('downloads') : null; if (dl) { await dl.save({ filename: name, data: blob }).catch(() => {}); return } } catch (e) {}
  const url = URL.createObjectURL(blob), a = document.createElement('a')
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 4000)
}
