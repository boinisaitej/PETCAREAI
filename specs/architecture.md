# PetCare AI — Architecture Spec

## Overview

AI-powered platform for pet owners, veterinary doctors, and veterinary hospitals:
health tracking, AI diagnosis & care planning, vet collaboration, finance, and
emergency response.

```
Browser (owner / vet / admin / caretaker / shelter)
        │
        ▼
Next.js 16 frontend (App Router, client components)  ──▶  deployed on Vercel
        │  REST (axios, Bearer JWT)  +  WebSocket (vet chat)
        ▼
FastAPI backend (Python 3.10+)                        ──▶  deployed on Render/Railway
 ├─ Routers: auth, pets, logs, medical, ai_features, care,
 │           finance, community, realtime, vet, vet_chat
 ├─ AI layer: app/ai/gemini_service.py (Google Gemini, text + vision)
 ├─ SQLAlchemy ORM → SQLite (dev) / any SQLAlchemy URL (prod)
 └─ Static /uploads (pet photos, medical documents)
```

## Frontend

| Concern | Choice |
|---|---|
| Framework | Next.js 16.2.9, App Router, React 19, TypeScript |
| Styling | Tailwind CSS v4, card-based UI, green-600 accent |
| Charts | Recharts (single-hue accessible palette `#2a78d6`) |
| Data fetching | axios client in `lib/api.ts` (one exported API object per domain) |
| Auth state | `lib/auth-context.tsx` — JWT + user in localStorage, 401 interceptor redirects to /login |
| Realtime | Native WebSocket for vet chat (`WS_BASE` derived from `NEXT_PUBLIC_API_URL`) |

Route groups:
- `/dashboard/*` — owner features (feeding, activity, health, timeline, medical,
  care-plans, poison, food-scanner, encyclopedia, expenses, emergency, lost-pets, vet-chat)
- `/ai` — AI hub (symptom checker, image diagnosis, chat, monthly report, sound, document reader)
- `/pets`, `/pets/[id]` — pet CRUD & profile
- `/vet` — vet dashboard (patients, appointments, stats)
- Role-based sidebar navigation in `components/Sidebar.tsx`

## Backend

- **App entry**: `backend/main.py` — CORS (env `FRONTEND_ORIGINS`), uploads mount,
  friendly 422 handler, router registration.
- **Models**: `backend/app/database.py` — User, Pet, FeedingLog, ActivityLog,
  HealthLog, WeightLog, Vaccination, Medication, Appointment, MedicalRecord,
  LostPetReport, Notification, GeofenceZone, Expense, InsurancePolicy,
  VetChatRoom, VetChatMessage.
- **Migrations**: `create_tables()` runs `Base.metadata.create_all` plus a
  lightweight `_add_missing_columns()` (SQLite `ALTER TABLE ADD COLUMN`) so older
  DB files pick up new model columns automatically.
- **Auth**: JWT Bearer (python-jose), passlib+bcrypt (bcrypt pinned to 4.x),
  roles: owner, vet, admin, caretaker, shelter.
- **AI**: all Gemini access goes through `app/ai/gemini_service.py`.
  `_safe_generate()` degrades gracefully (missing key / quota → friendly message,
  never a 500). Structured responses use `KEY: value` line formats parsed
  server-side.

## Key design rules

1. Frontend never hardcodes backend URLs — everything derives from
   `NEXT_PUBLIC_API_URL` (`API_BASE`, `WS_BASE`, `uploadUrl()` in `lib/api.ts`).
2. Every new API domain gets its own router file + its own `xxxApi` object in
   `lib/api.ts`.
3. AI endpoints return both a `raw` text blob and parsed convenience fields.
4. New DB columns/tables only — destructive schema changes require a manual
   migration plan.
