# Raviraja Fenestration (FenstraWorks clone)
uPVC window quotation, production, inventory and invoicing app.

Run: `cd backend && npm i && node server.js` then open http://localhost:4000
(frontend build is in `frontend/dist`; to rebuild: `cd frontend && npm i && npx vite build`).

## Database
No separate database server. Each company has its own SQLite file. On Vercel the disk is temporary, so to keep data permanently enable Vercel Blob (built into Vercel): Vercel project → Storage → Create → Blob → Connect to project, then redeploy. Vercel sets `BLOB_READ_WRITE_TOKEN` itself; the app then keeps an encrypted snapshot of every company's data in Blob and shares it between all instances.
