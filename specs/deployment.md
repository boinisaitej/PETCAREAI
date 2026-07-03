# PetCare AI — Deployment Spec (Vercel + Render)

The app deploys as **two services**. Vercel cannot host the FastAPI backend
(persistent SQLite file, /uploads disk, long-lived WebSockets don't fit
serverless), so:

| Piece | Host | Config |
|---|---|---|
| `frontend/` (Next.js 16) | **Vercel** | env var `NEXT_PUBLIC_API_URL` |
| `backend/` (FastAPI) | **Render** (blueprint `render.yaml`) or Railway (`backend/Procfile`) | env vars from `backend/.env.example` |

## 1. Deploy the backend first (Render)

1. Push the repo to GitHub (repo root must contain `render.yaml`).
2. Render → New → Blueprint → select the repo. The blueprint creates
   `petcare-api` with a 1 GB persistent disk at `/var/data`
   (SQLite DB + uploads survive restarts).
3. Fill the two `sync: false` env vars in the Render dashboard:
   - `GEMINI_API_KEY` — from https://aistudio.google.com/apikey
   - `FRONTEND_ORIGINS` — your Vercel URL(s), e.g.
     `https://petcare.vercel.app` (comma-separate to add preview domains)
4. Verify: `https://<backend>.onrender.com/health` → `{"status":"healthy"}`,
   `/docs` shows Swagger UI.
5. Seed demo data (optional): Render Shell → `python seed.py`.

## 2. Deploy the frontend (Vercel)

1. Vercel → Add New Project → import the repo.
2. **Root Directory: `frontend`** (critical — the Next app is a subfolder).
   Framework preset auto-detects Next.js; default build (`next build`) works.
3. Environment variable (all environments):
   `NEXT_PUBLIC_API_URL = https://<backend>.onrender.com` (no trailing slash).
4. Deploy, then update the backend's `FRONTEND_ORIGINS` with the final Vercel
   domain if it changed.

## 3. Post-deploy checklist

- [ ] Login works (demo: `owner@demo.com` / `demo1234` if seeded)
- [ ] Pet photos upload and render (served from backend `/uploads`)
- [ ] Vet chat connects (browser devtools → WS to `wss://<backend>/api/vet-chat/ws/...`)
- [ ] AI features respond (needs real `GEMINI_API_KEY`)
- [ ] No CORS errors in the browser console

## Environment variable reference

Backend (`backend/.env.example`): `GEMINI_API_KEY`, `SECRET_KEY`,
`DATABASE_URL`, `UPLOAD_DIR`, `FRONTEND_ORIGINS`, `ACCESS_TOKEN_EXPIRE_MINUTES`.
Frontend (`frontend/.env.example`): `NEXT_PUBLIC_API_URL`.

## Constraints & gotchas

- **WebSockets**: Render supports them natively — keep the vet chat working by
  not fronting the backend with a serverless proxy.
- **CORS**: wildcard origins disable credentials automatically (main.py);
  production must set `FRONTEND_ORIGINS` explicitly.
- **SQLite on a single disk** is fine for a demo; move `DATABASE_URL` to
  Postgres for multi-instance scaling (SQLAlchemy URL swap, models unchanged).
- **Render free tier** sleeps after idle — first request takes ~30 s to wake.
- Never commit `.env` files; `.gitignore` at repo root covers db/uploads/env.
