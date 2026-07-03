from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func
from pydantic import BaseModel, field_validator
from typing import Optional, List
from datetime import datetime, timedelta
from ..database import get_db, FeedingLog, ActivityLog, HealthLog, WeightLog, Pet, User
from ..auth import get_current_user
from ..ai.gemini_service import analyze_feeding, analyze_activity

router = APIRouter(prefix="/api/logs", tags=["Logs"])

BREED_CALORIES = {
    "labrador": 1500, "golden retriever": 1400, "german shepherd": 1300,
    "beagle": 900, "bulldog": 800, "poodle": 700, "chihuahua": 300,
    "cat": 250, "default": 800
}


def get_recommended_calories(breed: str, weight: float) -> float:
    breed_key = (breed or "").lower()
    for k, v in BREED_CALORIES.items():
        if k in breed_key:
            return v * 7
    return BREED_CALORIES["default"] * 7


class FeedingCreate(BaseModel):
    pet_id: int
    food_type: str
    quantity_grams: float
    water_ml: float = 0
    fed_at: Optional[datetime] = None
    notes: Optional[str] = None

    @field_validator("food_type")
    @classmethod
    def food_type_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Food type is required")
        return v

    @field_validator("quantity_grams")
    @classmethod
    def valid_quantity(cls, v: float) -> float:
        if v <= 0 or v > 10000:
            raise ValueError("Quantity must be between 1 and 10000 grams")
        return v

    @field_validator("water_ml")
    @classmethod
    def valid_water(cls, v: float) -> float:
        if v < 0 or v > 10000:
            raise ValueError("Water intake must be between 0 and 10000 ml")
        return v


@router.post("/feeding")
def log_feeding(data: FeedingCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = FeedingLog(**data.model_dump())
    if not log.fed_at:
        log.fed_at = datetime.utcnow()
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "message": "Feeding logged"}


@router.get("/feeding/{pet_id}")
def get_feeding_logs(pet_id: int, days: int = 7, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=days)
    logs = db.query(FeedingLog).filter(FeedingLog.pet_id == pet_id, FeedingLog.fed_at >= since).all()
    return [{"id": l.id, "food_type": l.food_type, "quantity_grams": l.quantity_grams,
             "water_ml": l.water_ml, "fed_at": l.fed_at.isoformat(), "notes": l.notes} for l in logs]


@router.get("/feeding/{pet_id}/ai-analysis")
def feeding_analysis(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    since = datetime.utcnow() - timedelta(days=7)
    logs = db.query(FeedingLog).filter(FeedingLog.pet_id == pet_id, FeedingLog.fed_at >= since).all()
    # Rough calorie estimate: 3.5 kcal per gram of dry food
    total_calories = sum(l.quantity_grams * 3.5 for l in logs)
    recommended = get_recommended_calories(pet.breed or "", pet.weight or 5)
    analysis = analyze_feeding(pet.name, pet.breed or "mixed", pet.weight or 5, total_calories, recommended)
    return {"pet_id": pet_id, "weekly_calories": round(total_calories), "recommended_calories": round(recommended), "analysis": analysis}


# ─── Activity ─────────────────────────────────────────────────────────────────

class ActivityCreate(BaseModel):
    pet_id: int
    activity_type: str
    duration_minutes: float
    distance_km: float = 0
    gps_route: Optional[list] = None
    calories_burned: float = 0

    @field_validator("activity_type")
    @classmethod
    def valid_activity_type(cls, v: str) -> str:
        valid = {"walk", "run", "play", "swim", "rest", "other"}
        if v.lower() not in valid:
            raise ValueError(f"activity_type must be one of: {', '.join(valid)}")
        return v.lower()

    @field_validator("duration_minutes")
    @classmethod
    def valid_duration(cls, v: float) -> float:
        if v <= 0 or v > 1440:
            raise ValueError("Duration must be between 1 and 1440 minutes")
        return v

    @field_validator("distance_km")
    @classmethod
    def valid_distance(cls, v: float) -> float:
        if v < 0 or v > 1000:
            raise ValueError("Distance must be between 0 and 1000 km")
        return v


@router.post("/activity")
def log_activity(data: ActivityCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = ActivityLog(**data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "message": "Activity logged"}


@router.get("/activity/{pet_id}")
def get_activity_logs(pet_id: int, days: int = 7, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=days)
    logs = db.query(ActivityLog).filter(ActivityLog.pet_id == pet_id, ActivityLog.logged_at >= since).all()
    return [{"id": l.id, "activity_type": l.activity_type, "duration_minutes": l.duration_minutes,
             "distance_km": l.distance_km, "calories_burned": l.calories_burned,
             "logged_at": l.logged_at.isoformat()} for l in logs]


@router.get("/activity/{pet_id}/ai-analysis")
def activity_analysis(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    since = datetime.utcnow() - timedelta(days=7)
    logs = db.query(ActivityLog).filter(ActivityLog.pet_id == pet_id, ActivityLog.logged_at >= since).all()
    total_minutes = sum(l.duration_minutes for l in logs)
    # Target: 30 min/day for most dogs
    target_minutes = 210 if pet.species == "dog" else 70
    analysis = analyze_activity(pet.name, pet.breed or "mixed", pet.age or 1, total_minutes, target_minutes)
    return {"pet_id": pet_id, "weekly_minutes": round(total_minutes), "target_minutes": target_minutes, "analysis": analysis}


# ─── Health Logs ──────────────────────────────────────────────────────────────

class HealthLogCreate(BaseModel):
    pet_id: int
    mood: Optional[str] = None
    appetite: Optional[str] = None
    sleep_hours: Optional[float] = None
    symptoms: Optional[str] = None
    stool_quality: Optional[str] = None
    notes: Optional[str] = None


@router.post("/health")
def log_health(data: HealthLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    log = HealthLog(**data.model_dump())
    db.add(log)
    db.commit()
    db.refresh(log)
    return {"id": log.id, "message": "Health log saved"}


@router.get("/health/{pet_id}")
def get_health_logs(pet_id: int, days: int = 30, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=days)
    logs = db.query(HealthLog).filter(HealthLog.pet_id == pet_id, HealthLog.logged_at >= since).all()
    return [{"id": l.id, "mood": l.mood, "appetite": l.appetite, "sleep_hours": l.sleep_hours,
             "symptoms": l.symptoms, "stool_quality": l.stool_quality, "notes": l.notes,
             "logged_at": l.logged_at.isoformat()} for l in logs]


# ─── Weight Logs (growth charts) ──────────────────────────────────────────────

class WeightLogCreate(BaseModel):
    pet_id: int
    weight_kg: float
    notes: Optional[str] = None
    logged_at: Optional[datetime] = None

    @field_validator("weight_kg")
    @classmethod
    def valid_weight(cls, v: float) -> float:
        if v <= 0 or v > 1000:
            raise ValueError("Weight must be a positive number under 1000 kg")
        return v


@router.post("/weight")
def log_weight(data: WeightLogCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    log = WeightLog(pet_id=data.pet_id, weight_kg=data.weight_kg, notes=data.notes,
                    logged_at=data.logged_at or datetime.utcnow())
    db.add(log)
    # Keep the pet's current weight in sync with the latest measurement
    pet.weight = data.weight_kg
    db.commit()
    db.refresh(log)
    return {"id": log.id, "message": "Weight logged", "weight_kg": log.weight_kg}


@router.get("/weight/{pet_id}")
def get_weight_logs(pet_id: int, months: int = 24, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(days=months * 30)
    logs = (db.query(WeightLog)
            .filter(WeightLog.pet_id == pet_id, WeightLog.logged_at >= since)
            .order_by(WeightLog.logged_at).all())
    return [{"id": l.id, "weight_kg": l.weight_kg, "notes": l.notes,
             "logged_at": l.logged_at.isoformat()} for l in logs]
