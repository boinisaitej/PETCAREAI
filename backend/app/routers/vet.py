from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from ..database import get_db, Pet, User, Appointment, HealthLog, FeedingLog, ActivityLog
from ..auth import get_current_user, require_role
from ..ai.gemini_service import generate_health_report
from datetime import datetime, timedelta

router = APIRouter(prefix="/api/vet", tags=["Vet Dashboard"])


@router.get("/patients")
def get_patients(db: Session = Depends(get_db), current_user: User = Depends(require_role("vet", "admin"))):
    appointments = db.query(Appointment).filter(Appointment.vet_id == current_user.id).all()
    pet_ids = list(set(a.pet_id for a in appointments))
    pets = db.query(Pet).filter(Pet.id.in_(pet_ids)).all()
    return [{"id": p.id, "name": p.name, "species": p.species, "breed": p.breed,
             "age": p.age, "weight": p.weight, "owner_id": p.owner_id} for p in pets]


@router.get("/patients/{pet_id}/summary")
def patient_summary(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(require_role("vet", "admin"))):
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    since = datetime.utcnow() - timedelta(days=180)
    health_logs = db.query(HealthLog).filter(HealthLog.pet_id == pet_id, HealthLog.logged_at >= since).all()
    feeding_logs = db.query(FeedingLog).filter(FeedingLog.pet_id == pet_id).all()

    # Weight trend (from appointments)
    appointments = db.query(Appointment).filter(Appointment.pet_id == pet_id).order_by(Appointment.scheduled_at).all()

    return {
        "pet": {"id": pet.id, "name": pet.name, "species": pet.species, "breed": pet.breed,
                "age": pet.age, "weight": pet.weight, "allergies": pet.allergies},
        "health_logs_count": len(health_logs),
        "recent_symptoms": [h.symptoms for h in health_logs[-5:] if h.symptoms],
        "appointment_count": len(appointments),
        "recent_appointments": [{"title": a.title, "date": a.scheduled_at.isoformat(),
                                  "diagnosis": a.diagnosis, "status": a.status} for a in appointments[-3:]],
        "vaccinations": [{"name": v.vaccine_name, "due": str(v.next_due_date)} for v in pet.vaccinations],
        "active_medications": [{"name": m.name, "dosage": m.dosage} for m in pet.medications if m.is_active],
    }


@router.get("/appointments")
def vet_appointments(db: Session = Depends(get_db), current_user: User = Depends(require_role("vet", "admin"))):
    appts = db.query(Appointment).filter(Appointment.vet_id == current_user.id).order_by(Appointment.scheduled_at.desc()).all()
    return [{"id": a.id, "title": a.title, "pet_id": a.pet_id, "owner_id": a.owner_id,
             "scheduled_at": a.scheduled_at.isoformat(), "status": a.status,
             "appointment_type": a.appointment_type} for a in appts]


@router.get("/dashboard-stats")
def dashboard_stats(db: Session = Depends(get_db), current_user: User = Depends(require_role("vet", "admin"))):
    total_pets = db.query(Pet).count()
    total_users = db.query(User).count()
    pending_appts = db.query(Appointment).filter(Appointment.status == "pending").count()
    lost_pets = db.query(Pet).filter(Pet.is_lost == True).count()
    return {
        "total_pets": total_pets, "total_users": total_users,
        "pending_appointments": pending_appts, "lost_pets": lost_pets
    }
