from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import datetime, timedelta
from ..database import get_db, Pet, User, WeightLog, Vaccination, Medication, Appointment, MedicalRecord, HealthLog
from ..auth import get_current_user
from ..ai.gemini_service import get_breed_recommendations, predict_health_risks
import os, aiofiles, uuid

router = APIRouter(prefix="/api/pets", tags=["Pets"])
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

VALID_SPECIES = {"dog", "cat", "bird", "rabbit", "fish", "hamster", "reptile", "other"}
VALID_ACTIVITY = {"low", "moderate", "high"}
ALLOWED_IMG_EXTS = {"jpg", "jpeg", "png", "gif", "webp"}

# ── Breed vaccination database ─────────────────────────────────────────────────
BREED_VACCINATIONS: dict[str, list[dict]] = {
    "dog": [
        {"name": "Rabies",           "frequency": "Every 1-3 years", "why": "Fatal viral disease, legally required in most regions. Protects pets and humans."},
        {"name": "DHPP (Distemper, Hepatitis, Parvovirus, Parainfluenza)", "frequency": "Every 1-3 years", "why": "Core combo vaccine. Distemper & Parvo are highly contagious and often fatal."},
        {"name": "Bordetella (Kennel Cough)", "frequency": "Annually", "why": "Recommended for dogs in contact with other dogs — kennels, parks, groomers."},
        {"name": "Leptospirosis",    "frequency": "Annually",         "why": "Bacterial disease spread through water/soil. Can cause kidney/liver failure."},
        {"name": "Canine Influenza",  "frequency": "Annually",        "why": "Recommended for social dogs. Highly contagious respiratory infection."},
        {"name": "Lyme Disease",      "frequency": "Annually",        "why": "Tick-borne disease. Recommended for dogs in wooded/grassy areas."},
    ],
    "cat": [
        {"name": "Rabies",            "frequency": "Every 1-3 years", "why": "Required by law in most areas. Protects cats that go outdoors."},
        {"name": "FVRCP (Feline Distemper Combo)", "frequency": "Every 1-3 years", "why": "Core vaccine covering Rhinotracheitis, Calicivirus, and Panleukopenia."},
        {"name": "FeLV (Feline Leukemia)", "frequency": "Annually",   "why": "Recommended for outdoor cats. FeLV is the leading cause of cancer in cats."},
        {"name": "FIV (Feline Immunodeficiency Virus)", "frequency": "Discuss with vet", "why": "For cats at risk of bite wounds from infected cats."},
    ],
    "rabbit": [
        {"name": "RHDV2 (Rabbit Hemorrhagic Disease)", "frequency": "Annually", "why": "Fatal viral disease with no treatment. Spreads via contact and environment."},
        {"name": "Myxomatosis",        "frequency": "Annually",       "why": "Fatal disease spread by insects. Required in many European countries."},
    ],
    "bird": [
        {"name": "Polyomavirus",       "frequency": "Annually",       "why": "Deadly to young birds. Recommended for birds in contact with others."},
        {"name": "Pacheco's Disease",  "frequency": "Annually",       "why": "Highly contagious herpesvirus. Critical for birds in multi-bird households."},
    ],
}

# Generic fallback for any breed/species
DEFAULT_VACCINATIONS = [
    {"name": "Rabies",    "frequency": "Every 1-3 years", "why": "Core vaccine required by law in most regions."},
    {"name": "Core Combo","frequency": "Annually",        "why": "Species-specific core vaccines — consult your vet for the full schedule."},
]


class PetCreate(BaseModel):
    name: str
    species: str
    breed: Optional[str] = None
    age: Optional[float] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    color: Optional[str] = None
    microchip_id: Optional[str] = None
    allergies: Optional[str] = None
    diet_preferences: Optional[str] = None
    activity_level: str = "moderate"
    date_of_birth: Optional[str] = None  # ISO date string YYYY-MM-DD

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Pet name is required")
        return v

    @field_validator("species")
    @classmethod
    def valid_species(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_SPECIES:
            raise ValueError(f"Species must be one of: {', '.join(VALID_SPECIES)}")
        return v

    @field_validator("age")
    @classmethod
    def valid_age(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v < 0 or v > 100):
            raise ValueError("Age must be between 0 and 100")
        return v

    @field_validator("weight")
    @classmethod
    def valid_weight(cls, v: Optional[float]) -> Optional[float]:
        if v is not None and (v <= 0 or v > 1000):
            raise ValueError("Weight must be a positive number under 1000 kg")
        return v

    @field_validator("activity_level")
    @classmethod
    def valid_activity(cls, v: str) -> str:
        if v not in VALID_ACTIVITY:
            raise ValueError("activity_level must be low, moderate, or high")
        return v


class PetUpdate(BaseModel):
    name: Optional[str] = None
    species: Optional[str] = None
    breed: Optional[str] = None
    age: Optional[float] = None
    weight: Optional[float] = None
    gender: Optional[str] = None
    color: Optional[str] = None
    microchip_id: Optional[str] = None
    allergies: Optional[str] = None
    diet_preferences: Optional[str] = None
    activity_level: Optional[str] = None
    date_of_birth: Optional[str] = None


def _compute_age(pet: Pet) -> Optional[float]:
    """Return age from date_of_birth if available, else stored age."""
    if pet.date_of_birth:
        try:
            dob = datetime.fromisoformat(pet.date_of_birth)
            delta = datetime.utcnow() - dob
            return round(delta.days / 365.25, 1)
        except Exception:
            pass
    return pet.age


def pet_to_dict(pet: Pet) -> dict:
    computed_age = _compute_age(pet)
    return {
        "id": pet.id, "name": pet.name, "species": pet.species, "breed": pet.breed,
        "age": computed_age, "weight": pet.weight, "gender": pet.gender, "color": pet.color,
        "microchip_id": pet.microchip_id, "allergies": pet.allergies,
        "diet_preferences": pet.diet_preferences, "activity_level": pet.activity_level,
        "is_lost": pet.is_lost, "photo": pet.photo, "owner_id": pet.owner_id,
        "date_of_birth": pet.date_of_birth,
        "created_at": pet.created_at.isoformat() if pet.created_at else None,
    }


@router.post("")
def create_pet(data: PetCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    payload = data.model_dump()
    # If DOB provided, compute age from it
    if payload.get("date_of_birth"):
        try:
            dob = datetime.fromisoformat(payload["date_of_birth"])
            payload["age"] = round((datetime.utcnow() - dob).days / 365.25, 1)
        except Exception:
            pass
    pet = Pet(**{k: v for k, v in payload.items() if hasattr(Pet, k)}, owner_id=current_user.id)
    db.add(pet)
    db.commit()
    db.refresh(pet)
    return pet_to_dict(pet)


@router.get("")
def list_pets(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if current_user.role in {"admin", "vet"}:
        pets = db.query(Pet).all()
    else:
        pets = db.query(Pet).filter(Pet.owner_id == current_user.id).all()
    return [pet_to_dict(p) for p in pets]


@router.get("/{pet_id}")
def get_pet(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet_to_dict(pet)


@router.put("/{pet_id}")
def update_pet(pet_id: int, data: PetUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    updates = data.model_dump(exclude_none=True)
    if "date_of_birth" in updates and updates["date_of_birth"]:
        try:
            dob = datetime.fromisoformat(updates["date_of_birth"])
            updates["age"] = round((datetime.utcnow() - dob).days / 365.25, 1)
        except Exception:
            pass
    for k, v in updates.items():
        if hasattr(pet, k):
            setattr(pet, k, v)
    db.commit()
    db.refresh(pet)
    return pet_to_dict(pet)


@router.delete("/{pet_id}")
def delete_pet(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    db.delete(pet)
    db.commit()
    return {"message": "Pet deleted"}


@router.post("/{pet_id}/photo")
async def upload_pet_photo(
    pet_id: int, file: UploadFile = File(...),
    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)
):
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    ext = (file.filename or "photo.jpg").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_IMG_EXTS:
        raise HTTPException(status_code=422, detail=f"Image must be one of: {', '.join(ALLOWED_IMG_EXTS)}")
    content = await file.read()
    if len(content) > 5 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Photo must be under 5 MB")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"pet_{pet_id}_{uuid.uuid4().hex[:8]}.{ext}"
    async with aiofiles.open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        await f.write(content)
    # Remove old photo file
    if pet.photo:
        old_path = os.path.join(UPLOAD_DIR, pet.photo)
        if os.path.exists(old_path):
            os.remove(old_path)
    pet.photo = filename
    db.commit()
    return {"photo": filename, "url": f"/uploads/{filename}"}


@router.get("/{pet_id}/vaccination-suggestions")
def vaccination_suggestions(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Return breed/species-specific vaccination schedule with explanations."""
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    species = (pet.species or "").lower()
    vacs = BREED_VACCINATIONS.get(species, DEFAULT_VACCINATIONS)
    # Mark which ones the pet already has
    existing = {v.vaccine_name.lower() for v in pet.vaccinations}
    result = []
    for v in vacs:
        already_done = any(e in v["name"].lower() for e in existing)
        result.append({**v, "already_recorded": already_done})
    return {
        "pet_id": pet_id, "species": species, "breed": pet.breed,
        "vaccinations": result,
        "note": f"Consult Dr. {pet.owner.name if pet.owner else 'your vet'} for personalized schedule.",
    }


@router.get("/{pet_id}/ai-recommendations")
def ai_recommendations(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    age = _compute_age(pet) or 1
    recommendations = get_breed_recommendations(
        pet.species or "unknown", pet.breed or "mixed", age,
        pet.weight or 5, pet.activity_level or "moderate"
    )
    return {"pet_id": pet_id, "recommendations": recommendations}


@router.get("/{pet_id}/risk-prediction")
def risk_prediction(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    health_history = [{"mood": h.mood, "symptoms": h.symptoms} for h in pet.health_logs[-10:]]
    risks = predict_health_risks(pet_to_dict(pet), health_history)
    return {"pet_id": pet_id, "risk_analysis": risks}


@router.get("/{pet_id}/timeline")
def health_timeline(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Aggregate every medical/health event into one chronological timeline."""
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    events = []
    for v in db.query(Vaccination).filter(Vaccination.pet_id == pet_id).all():
        events.append({"type": "vaccination", "icon": "💉", "title": v.vaccine_name,
                       "detail": f"By {v.administered_by}" if v.administered_by else "Vaccine administered",
                       "date": v.administered_date.isoformat() if v.administered_date else None})
    for m in db.query(Medication).filter(Medication.pet_id == pet_id).all():
        events.append({"type": "medication", "icon": "💊", "title": f"Started {m.name}",
                       "detail": f"{m.dosage}, {m.frequency}",
                       "date": m.start_date.isoformat() if m.start_date else None})
    for a in db.query(Appointment).filter(Appointment.pet_id == pet_id).all():
        events.append({"type": "appointment", "icon": "🏥", "title": a.title,
                       "detail": a.diagnosis or a.appointment_type,
                       "date": a.scheduled_at.isoformat() if a.scheduled_at else None})
    for r in db.query(MedicalRecord).filter(MedicalRecord.pet_id == pet_id).all():
        events.append({"type": "record", "icon": "📄", "title": r.title,
                       "detail": r.record_type,
                       "date": r.recorded_at.isoformat() if r.recorded_at else None})
    for h in db.query(HealthLog).filter(HealthLog.pet_id == pet_id, HealthLog.symptoms.isnot(None)).all():
        if h.symptoms and h.symptoms.strip():
            events.append({"type": "symptom", "icon": "🤒", "title": "Symptoms noted",
                           "detail": h.symptoms,
                           "date": h.logged_at.isoformat() if h.logged_at else None})
    for w in db.query(WeightLog).filter(WeightLog.pet_id == pet_id).all():
        events.append({"type": "weight", "icon": "⚖️", "title": f"Weight: {w.weight_kg} kg",
                       "detail": w.notes or "Weight check",
                       "date": w.logged_at.isoformat() if w.logged_at else None})
    events = [e for e in events if e["date"]]
    events.sort(key=lambda e: e["date"], reverse=True)
    return {"pet_id": pet_id, "pet_name": pet.name, "events": events}


@router.get("/{pet_id}/emergency-summary")
def emergency_summary(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """One-click emergency card: everything a vet needs in the first 60 seconds."""
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    active_meds = db.query(Medication).filter(Medication.pet_id == pet_id, Medication.is_active == True).all()
    vaccinations = (db.query(Vaccination).filter(Vaccination.pet_id == pet_id)
                    .order_by(Vaccination.administered_date.desc()).limit(10).all())
    recent_symptoms = (db.query(HealthLog)
                       .filter(HealthLog.pet_id == pet_id, HealthLog.symptoms.isnot(None))
                       .order_by(HealthLog.logged_at.desc()).limit(5).all())
    recent_records = (db.query(MedicalRecord).filter(MedicalRecord.pet_id == pet_id)
                      .order_by(MedicalRecord.recorded_at.desc()).limit(5).all())
    owner = pet.owner
    return {
        "pet": pet_to_dict(pet),
        "owner": {"name": owner.name, "phone": owner.phone, "email": owner.email} if owner else None,
        "allergies": pet.allergies or "None recorded",
        "active_medications": [{"name": m.name, "dosage": m.dosage, "frequency": m.frequency} for m in active_meds],
        "vaccinations": [{"name": v.vaccine_name, "date": v.administered_date.isoformat() if v.administered_date else None,
                          "next_due": v.next_due_date.isoformat() if v.next_due_date else None} for v in vaccinations],
        "recent_symptoms": [{"symptoms": h.symptoms, "date": h.logged_at.isoformat() if h.logged_at else None} for h in recent_symptoms],
        "recent_records": [{"title": r.title, "type": r.record_type,
                            "date": r.recorded_at.isoformat() if r.recorded_at else None} for r in recent_records],
        "generated_at": datetime.utcnow().isoformat(),
    }


@router.post("/{pet_id}/mark-lost")
def mark_lost(pet_id: int, lat: float = None, lng: float = None, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet.is_lost = True
    if lat: pet.last_known_lat = lat
    if lng: pet.last_known_lng = lng
    db.commit()
    return {"message": f"{pet.name} marked as lost"}


@router.post("/{pet_id}/mark-found")
def mark_found(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet.is_lost = False
    db.commit()
    return {"message": f"{pet.name} marked as found"}
