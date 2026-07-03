# PetCare AI — API Spec

Machine-readable spec: [`openapi.json`](./openapi.json) (regenerate with
`cd backend && py -c "import json, main; json.dump(main.app.openapi(), open('../specs/openapi.json','w'), indent=2)"`).
Interactive docs at `http://localhost:8000/docs` when the backend is running.

**Auth**: `POST /api/auth/login` (form: username, password) → `{access_token}`.
All other endpoints require `Authorization: Bearer <token>`.

## Router map (76 paths)

| Prefix | File | Purpose |
|---|---|---|
| `/api/auth` | routers/auth.py | Register, login, profile |
| `/api/pets` | routers/pets.py | Pet CRUD, photo upload, AI recommendations, risk prediction, vaccination suggestions, **timeline**, **emergency-summary**, mark lost/found |
| `/api/logs` | routers/logs.py | Feeding / activity / health / **weight** logs + AI analyses |
| `/api/medical` | routers/medical.py | Vaccinations, medications, appointments, medical records |
| `/api/ai` | routers/ai_features.py | Symptom check, photo scan, chat, monthly report, sound interpretation |
| `/api/care` | routers/care.py | Poison center, food scanner, care plans, behavior plans, onboarding roadmap, document reader, vaccine & medicine encyclopedia |
| `/api/finance` | routers/finance.py | Expenses (+summary), insurance policies |
| `/api/community` | routers/community.py | Lost pets, geofences, notifications |
| `/api/vet` | routers/vet.py | Vet dashboard: patients, summaries, appointments, stats |
| `/api/vet-chat` | routers/vet_chat.py | Owner↔vet chat rooms, messages, WebSocket at `/api/vet-chat/ws/{room_id}/{user_id}` |

## Care & Safety endpoints (`/api/care`)

| Method & path | Body | Returns |
|---|---|---|
| POST `/poison-check` | `{substance, pet_id?, species?, amount?}` | `{toxicity, why, symptoms, first_aid, vet_urgency, raw}` |
| POST `/food-scan/{pet_id}` | multipart `file` | `{food, safe, safe_quantity, benefits, risks, calories, verdict, raw}` |
| POST `/food-check` | `{pet_id, food}` | same as food-scan |
| GET `/plan-types` | — | `{types: [deworming, tick_prevention, grooming, exercise, feeding, senior_care, pregnancy, travel, vet_visit]}` |
| POST `/plan` | `{pet_id, plan_type, extra_context?}` | `{plan}` markdown-ish text |
| POST `/behavior-plan` | `{pet_id, problem}` | `{plan}` |
| POST `/onboarding-roadmap` | `{pet_id, known_history?, visible_symptoms?, vaccination_known}` | `{roadmap}` |
| POST `/document-reader` | multipart `file` + form `doc_hint` | `{analysis}` |
| GET `/vaccines` | — | `{species: [...]}` |
| GET `/vaccines/{species}` | — | curated `{vaccines: [{name, core, schedule, protects}]}` |
| POST `/vaccine-info` | `{vaccine_name, species}` | `{info}` |
| POST `/medicine-info` | `{medicine_name, species?}` | `{info}` |

## Finance endpoints (`/api/finance`)

- `POST/GET /expenses`, `DELETE /expenses/{id}` — categories:
  food, medicine, vet, grooming, insurance, toys, training, other
- `GET /expenses-summary?pet_id&months` → `{total, this_month, count, by_category[], by_month[]}`
- `POST/GET /insurance`, `PUT /insurance/{id}/toggle`, `DELETE /insurance/{id}`

## Conventions

- Validation errors return **422 with a plain string** `detail` (custom handler
  in main.py) so the frontend can render it directly.
- AI responses always include `raw`; parsed fields are best-effort.
- Dates are ISO 8601 strings; SQLite stores naive UTC.
- Ownership checks: mutating endpoints filter by `owner_id == current_user.id`
  (admin/vet get wider read access on list endpoints).
