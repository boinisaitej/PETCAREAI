# PetCare AI — Feature Spec

Feature inventory mapped to q.md ("PetGuardian AI"). ✅ = implemented.

## For pet owners

| Feature | Status | Where |
|---|---|---|
| Auth (login/signup, 5 roles) | ✅ | /login, /register |
| Dashboard (tasks, reminders, shortcuts) | ✅ | /dashboard |
| Multi-pet profiles + photos | ✅ | /pets, /pets/[id] |
| AI pet onboarding (adopted pets) | ✅ | /dashboard/care-plans → New Pet Onboarding |
| Unknown vaccination recovery | ✅ | part of onboarding roadmap |
| Vaccination Center (10 species) | ✅ | /dashboard/encyclopedia |
| Medicine Encyclopedia (AI lookup) | ✅ | /dashboard/encyclopedia |
| AI Symptom Checker | ✅ | /ai |
| AI Image Diagnosis (skin/eye/ear/…) | ✅ | /ai → Image Diagnosis |
| AI Audio/behavior interpretation | ✅ | /ai → Sound Interpreter |
| Poison Center (severity, first aid, urgency) | ✅ | /dashboard/poison |
| Food Scanner (photo + text) | ✅ | /dashboard/food-scanner |
| Personalized feeding / meal plan | ✅ | /dashboard/care-plans → Meal Plan; /dashboard/feeding AI analysis |
| Water intake tracking | ✅ | feeding logs (water_ml) |
| Growth charts (weight curve) | ✅ | /dashboard/timeline |
| Medical vault (records + files) | ✅ | /dashboard/medical |
| AI Document Reader (reports, prescriptions) | ✅ | /ai → Document Reader |
| Health timeline (all events) | ✅ | /dashboard/timeline |
| AI monthly health summary | ✅ | /ai → Monthly Report |
| Vet visit planner | ✅ | /dashboard/care-plans → Vet Visit Prep |
| Medication tracking | ✅ | /dashboard/medical |
| Deworming planner | ✅ | care plans |
| Tick & flea prevention | ✅ | care plans |
| Grooming planner | ✅ | care plans |
| Behavior trainer | ✅ | care plans → Behavior Trainer |
| Exercise planner | ✅ | care plans + /dashboard/activity |
| Pregnancy module | ✅ | care plans |
| Senior pet care | ✅ | care plans |
| Lost pet reporting + community | ✅ | /dashboard/lost-pets |
| Expense tracker (charts) | ✅ | /dashboard/expenses |
| Insurance manager | ✅ | /dashboard/expenses → Insurance |
| Travel planner | ✅ | care plans |
| Emergency mode (printable card + nearest clinics) | ✅ | /dashboard/emergency |
| AI chat assistant (knows pet context) | ✅ | /ai → AI Chat |
| Notifications | ✅ | /dashboard/notifications |

## For vets / hospitals

| Feature | Status | Where |
|---|---|---|
| Vet dashboard (stats) | ✅ | /vet |
| Patient list + AI summaries | ✅ | /vet/patients |
| Appointment management | ✅ | /vet/appointments |
| Owner↔vet chat (WebSocket) | ✅ | /dashboard/vet-chat |
| Poison Center & encyclopedia access | ✅ | sidebar (vet role) |

## Not yet implemented (q.md backlog)

- AI video analysis (limping/seizure detection) — needs model hosting
- Real audio-file classification (current: text description → AI)
- OCR pipeline via dedicated OCR APIs (current: Gemini vision reads documents)
- Vector DB / RAG knowledge base (current: direct Gemini prompting)
- Background job queue (Celery/Dramatiq) — AI calls are synchronous today
- QR pet profile, weather alerts, family shared accounts
- Premium: smart collar / GPS hardware, wearables, smart feeder, PWA offline,
  multi-language, dark theme
