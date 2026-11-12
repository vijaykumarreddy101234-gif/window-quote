# Raviraja Fenestration (FenstraWorks clone)
uPVC window quotation, production, inventory and invoicing app.

Run: `cd backend && npm i && node server.js` then open http://localhost:4000
(frontend build is in `frontend/dist`; to rebuild: `cd frontend && npm i && npx vite build`).

## Database
No external database server. Each company has its own SQLite file. On Vercel the disk is temporary, so data resets when the server restarts; run on a server with a persistent disk for real use.
