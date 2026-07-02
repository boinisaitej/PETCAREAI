# 🐾 PetCare AI — AI-Powered Pet Operating System

A production-grade platform where pet owners, vets, groomers, and care providers collaborate around a pet's digital health record. Powered by **Google Gemini AI**.

---

## 🚀 Quick Start

### 1. Configure Gemini API Key

Edit `backend/.env`:
```
GEMINI_API_KEY=your_actual_gemini_api_key_here
SECRET_KEY=your_secret_key_here
```

Get your Gemini API key at: https://aistudio.google.com/app/apikey

### 2. Start Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```
Or double-click `start-backend.bat`

### 3. Start Frontend
```bash
cd frontend
npm install
npm run dev
```
Or double-click `start-frontend.bat`

### 4. Open App
- **Frontend**: http://localhost:3000
- **API Docs**: http://localhost:8000/docs
- **API ReDoc**: http://localhost:8000/redoc

---

## 🏗️ Architecture

```
PetCareAI/
├── backend/                    # FastAPI + SQLite
│   ├── main.py                 # App entrypoint
│   ├── app/
│   │   ├── database.py         # SQLAlchemy models (12 tables)
│   │   ├── auth.py             # JWT authentication
│   │   ├── ai/
│   │   │   └── gemini_service.py  # All Gemini AI functions
│   │   └── routers/
│   │       ├── auth.py         # Register / Login
│   │       ├── pets.py         # Pet CRUD + AI recommendations
│   │       ├── logs.py         # Feeding / Activity / Health logs
│   │       ├── medical.py      # Vaccinations / Medications / Appointments
│   │       ├── ai_features.py  # Symptom checker / Photo scan / Chat / Report
│   │       ├── community.py    # Lost pets / Geofence / Notifications
│   │       ├── realtime.py     # WebSocket rooms (Emergency / Monitor / Geo)
│   │       └── vet.py          # Vet dashboard APIs
│   └── requirements.txt
│
└── frontend/                   # Next.js 15 + TypeScript + Tailwind
    ├── app/
    │   ├── page.tsx            # Root redirect
    │   ├── login/              # Auth
    │   ├── register/           # Auth
    │   ├── dashboard/          # Main app layout + pages
    │   │   ├── feeding/        # Feeding tracker + AI analysis
    │   │   ├── activity/       # Activity tracker + AI analysis
    │   │   ├── health/         # Daily health journal
    │   │   ├── medical/        # Appointments / Vaccinations / Meds
    │   │   ├── lost-pets/      # Lost pet alert system
    │   │   └── notifications/  # Smart notifications
    │   ├── pets/               # Pet profiles + AI insights + photo scan
    │   ├── ai/                 # AI hub: chat, symptom checker, reports, sound
    │   └── vet/                # Vet-only dashboard
    └── lib/
        ├── api.ts              # All API calls
        └── auth-context.tsx    # Global auth state
```

---

## ✨ Features

### Core (MVP)
| Feature | Status |
|---------|--------|
| Multi-role auth (Owner / Vet / Admin / Caretaker / Shelter) | ✅ |
| Pet profiles with full health data | ✅ |
| Feeding tracker + calorie analysis | ✅ |
| Activity / Walk tracker | ✅ |
| Daily health journal | ✅ |
| Vaccination management + reminders | ✅ |
| Medication scheduling | ✅ |
| Appointment booking | ✅ |
| Medical records upload | ✅ |

### AI Features (Gemini-Powered)
| Feature | Status |
|---------|--------|
| Breed-specific health recommendations | ✅ |
| Nutrition & feeding AI analysis | ✅ |
| Activity trend analysis | ✅ |
| AI Symptom Checker (with severity + emergency flag) | ✅ |
| Photo-based health scanner (Vision AI) | ✅ |
| Pet Chat Assistant (RAG-style) | ✅ |
| Monthly AI health report | ✅ |
| Bark/Meow sound interpreter | ✅ |
| Predictive health risk analysis | ✅ |

### Real-time & Safety
| Feature | Status |
|---------|--------|
| WebSocket Emergency Vet Connect | ✅ |
| Live health monitoring (Smart collar ready) | ✅ |
| Geofencing with Haversine distance | ✅ |
| Lost pet alert system | ✅ |
| Smart notifications | ✅ |

### Vet Dashboard
| Feature | Status |
|---------|--------|
| Patient management | ✅ |
| Appointment management | ✅ |
| AI-generated patient summaries | ✅ |
| Platform statistics | ✅ |

---

## 🔐 User Roles

| Role | Permissions |
|------|-------------|
| `owner` | Manage own pets, all tracking, AI features |
| `vet` | View all pets, appointments, vet dashboard |
| `admin` | Full access including stats |
| `caretaker` | Same as owner |
| `shelter` | Same as owner |

---

## 🤖 AI Functions (Gemini 1.5 Flash)

| Function | Description |
|----------|-------------|
| `get_breed_recommendations()` | Species/breed/age-specific health tips |
| `analyze_feeding()` | Weekly calorie vs recommended analysis |
| `analyze_activity()` | Activity trend + obesity risk |
| `symptom_checker()` | Severity + emergency flag + causes |
| `analyze_health_photo()` | Vision AI health assessment from photo |
| `pet_chat_assistant()` | Context-aware Q&A with pet data |
| `generate_health_report()` | Monthly health/nutrition/activity report |
| `interpret_pet_sound()` | Bark/meow emotional state estimation |
| `predict_health_risks()` | Predictive risk analysis (diabetes, obesity, etc.) |
| `smart_notification_message()` | Personalized notification copy |

---

## 📡 WebSocket Endpoints

| Endpoint | Purpose |
|----------|---------|
| `ws://localhost:8000/ws/emergency/{room_id}` | Emergency vet video/chat room |
| `ws://localhost:8000/ws/health-monitor/{pet_id}` | Live smart collar metrics |
| `ws://localhost:8000/ws/geofence-alerts/{owner_id}` | Real-time geofence alerts |

---

## 🗄️ Database Schema (SQLite)

12 tables: `users`, `pets`, `feeding_logs`, `activity_logs`, `health_logs`, `vaccinations`, `medications`, `appointments`, `medical_records`, `lost_pet_reports`, `notifications`, `geofence_zones`

---

## 📱 Future Enhancements

- React Native / Expo mobile app
- Apple Health / Google Fit integration  
- Smart collar BLE integration
- PDF report generation (reportlab ready)
- Push notifications (FCM)
- WhatsApp / SMS alerts
- AI pet facial recognition for lost pet matching
- XGBoost/LightGBM predictive models
- Multi-pet household shared accounts
"# PETCAREAI" 
