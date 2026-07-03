---
name: deploy-check
description: Pre-deployment verification for PetCare AI (Vercel frontend + Render backend). Use before deploying, when asked "is this ready to deploy", or after changes that touch config, env vars, or URLs.
---

# Deploy readiness check

Full deployment topology and steps live in `specs/deployment.md` — read it first.
This skill is the verification gate.

## 1. Build gates (must pass)

```bash
cd frontend && npm run build          # what Vercel runs — must exit 0
cd backend && py -c "import main"     # FastAPI app must import cleanly
```

## 2. Config gates

- No hardcoded `localhost` outside `lib/api.ts` defaults:
  `grep -rn "localhost:8000" frontend/app frontend/components` → must be empty.
  All URLs must derive from `API_BASE` / `WS_BASE` / `uploadUrl()` in `frontend/lib/api.ts`.
- `frontend/.env.example` and `backend/.env.example` list every env var the code
  reads (`grep -rn "os.getenv" backend` to cross-check).
- Real `.env` files are gitignored (never committed).

## 3. Runtime smoke test (backend on :8000)

```bash
curl -s http://localhost:8000/health
# login as owner@demo.com / demo1234 → token, then hit:
#   GET /api/pets, GET /api/care/vaccines, GET /api/finance/expenses-summary
```

## 4. Production env values (set on the hosts, not in code)

| Where | Var | Value |
|---|---|---|
| Vercel | `NEXT_PUBLIC_API_URL` | backend public URL, no trailing slash |
| Vercel | Root Directory | `frontend` |
| Render | `GEMINI_API_KEY` | real key |
| Render | `FRONTEND_ORIGINS` | Vercel domain(s), comma-separated |
| Render | `SECRET_KEY` | long random string (blueprint auto-generates) |

## 5. Post-deploy

Walk the checklist at the bottom of `specs/deployment.md` (login, photo upload,
WebSocket chat, AI response, no CORS errors in console).
