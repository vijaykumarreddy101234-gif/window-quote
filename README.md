# Raviraja Fenestration (FenstraWorks clone)
uPVC window quotation, production, inventory and invoicing app.

Run: `cd backend && npm i && node server.js` then open http://localhost:4000
(frontend build is in `frontend/dist`; to rebuild: `cd frontend && npm i && npx vite build`).

## Permanent database on Vercel (Turso)
Vercel's disk is temporary, so without this new customers/quotations vanish after a cold start. Create a free Turso database, then add two Vercel environment variables and redeploy:
- `TURSO_DATABASE_URL` — e.g. `libsql://your-db-name.turso.io`
- `TURSO_AUTH_TOKEN` — a token from `turso db tokens create <db>`
On first start the demo data in `backend/seed.db` is loaded into the empty database automatically.
