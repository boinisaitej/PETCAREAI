---
name: run-app
description: Start the PetCare AI stack locally (FastAPI backend + Next.js frontend) on this Windows machine. Use when asked to run, start, restart, or smoke-test the app.
---

# Run PetCare AI locally

## Critical environment facts

- Python is ONLY available via the `py` launcher (3.10). Bare `python` opens the
  Microsoft Store stub. `uvicorn` is not on PATH — use `py -m uvicorn`.
- Ports: backend **8000**, frontend **3000**.
- `backend/.env` needs a real `GEMINI_API_KEY` for AI features; without it every
  AI endpoint returns a friendly "key not configured" message (rest of the app works).
- bcrypt must stay 4.x (pinned in requirements.txt); bcrypt 5 breaks passlib logins.

## Start

```bash
# Backend (from repo root) — run in background
cd backend && py -m uvicorn main:app --reload --port 8000

# Frontend — run in background
cd frontend && npm run dev
```

Or the user-facing scripts: `start-backend.bat` / `start-frontend.bat`.

## Verify

1. `curl -s http://localhost:8000/health` → `{"status":"healthy"}`
2. Login smoke test (demo accounts seeded by `py seed.py`, password `demo1234`):
   `curl -s -X POST http://localhost:8000/api/auth/login -d "username=owner@demo.com&password=demo1234" -H "Content-Type: application/x-www-form-urlencoded"`
   → JSON containing `access_token`.
3. Frontend: `curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/dashboard` → 200.

## Gotchas

- Schema drift: `create_tables()` auto-adds missing columns on startup — restart
  the backend after adding model columns.
- If login returns 500 with a bcrypt "72 bytes" error: `py -m pip install bcrypt==4.1.3`.
- Stop servers before `npm run build` on Windows (file locks on `.next/`).
- If every page returns 500 with `TurbopackInternalError ... 0xc0000142` in
  `frontend/.next/dev/logs/next-development.log`: a long-running dev server has
  wedged (its PostCSS worker can no longer spawn). Kill the PID shown by
  `next dev`'s "already running" notice, `rm -rf frontend/.next/dev`, restart.
