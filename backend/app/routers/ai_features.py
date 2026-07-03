from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db, Pet, User, FeedingLog, ActivityLog, HealthLog, Vaccination
from ..auth import get_current_user
from ..ai.gemini_service import (
    symptom_checker, analyze_health_photo, pet_chat_assistant,
    generate_health_report, interpret_pet_sound
)
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/ai", tags=["AI Features"])


class SymptomRequest(BaseModel):
    pet_id: int
    symptoms: str


class ChatRequest(BaseModel):
    pet_id: int
    question: str


class SoundRequest(BaseModel):
    pet_id: int
    sound_description: str
    context: str = ""


@router.post("/symptom-check")
def check_symptoms(data: SymptomRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    result = symptom_checker(pet.name, pet.species or "unknown", pet.breed or "mixed", pet.age or 1, data.symptoms)
    return {"pet_id": data.pet_id, "pet_name": pet.name, **result}


@router.post("/photo-scan/{pet_id}")
async def scan_photo(pet_id: int, file: UploadFile = File(...),
                     db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    image_bytes = await file.read()
    result = analyze_health_photo(image_bytes, pet.name, pet.species or "animal")
    return {"pet_id": pet_id, "pet_name": pet.name, **result}


@router.post("/chat")
def chat_with_ai(data: ChatRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet_context = {
        "name": pet.name, "species": pet.species, "breed": pet.breed,
        "age": pet.age, "weight": pet.weight, "allergies": pet.allergies,
        "activity_level": pet.activity_level,
    }
    answer = pet_chat_assistant(data.question, pet_context)
    return {"question": data.question, "answer": answer, "pet_name": pet.name}


@router.get("/monthly-report/{pet_id}")
def monthly_report(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    since = datetime.utcnow() - timedelta(days=30)
    feeding_logs = db.query(FeedingLog).filter(FeedingLog.pet_id == pet_id, FeedingLog.fed_at >= since).all()
    activity_logs = db.query(ActivityLog).filter(ActivityLog.pet_id == pet_id, ActivityLog.logged_at >= since).all()
    health_logs = db.query(HealthLog).filter(HealthLog.pet_id == pet_id, HealthLog.logged_at >= since).all()
    vaccinations = db.query(Vaccination).filter(Vaccination.pet_id == pet_id).all()

    feeding_summary = {
        "total_meals": len(feeding_logs),
        "avg_daily_grams": round(sum(l.quantity_grams for l in feeding_logs) / 30, 1) if feeding_logs else 0,
    }
    activity_summary = {
        "total_sessions": len(activity_logs),
        "total_minutes": round(sum(l.duration_minutes for l in activity_logs), 1),
        "total_km": round(sum(l.distance_km for l in activity_logs), 2),
    }
    health_data = [{"mood": h.mood, "appetite": h.appetite, "symptoms": h.symptoms} for h in health_logs]
    vac_data = [{"name": v.vaccine_name, "next_due": str(v.next_due_date)} for v in vaccinations]

    pet_dict = {"name": pet.name, "species": pet.species, "breed": pet.breed, "age": pet.age, "weight": pet.weight}
    report = generate_health_report(pet_dict, feeding_summary, activity_summary, health_data, vac_data)
    return {"pet_id": pet_id, "report_period": "Last 30 days", "report": report,
            "feeding_summary": feeding_summary, "activity_summary": activity_summary}


@router.post("/sound-interpret")
def interpret_sound(data: SoundRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    result = interpret_pet_sound(data.sound_description, pet.species or "animal", data.context)
    return {"pet_id": data.pet_id, "interpretation": result}
