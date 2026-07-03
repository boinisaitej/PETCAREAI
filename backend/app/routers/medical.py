from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Query
from sqlalchemy.orm import Session
from pydantic import BaseModel, field_validator, model_validator
from typing import Optional, Literal
from datetime import datetime, timedelta
from ..database import get_db, Vaccination, Medication, Appointment, MedicalRecord, Pet, User
from ..auth import get_current_user
import os, aiofiles, uuid

router = APIRouter(prefix="/api/medical", tags=["Medical"])
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")

VALID_APPT_TYPES = {"checkup", "vaccination", "surgery", "grooming", "emergency", "dental", "follow-up"}
VALID_FREQUENCIES = {"daily", "twice_daily", "weekly", "monthly", "as_needed"}
VALID_STATUSES = {"pending", "confirmed", "completed", "cancelled"}
VALID_RECORD_TYPES = {"lab_result", "surgery", "diagnosis", "prescription", "imaging", "other"}
ALLOWED_EXTENSIONS = {"pdf", "jpg", "jpeg", "png", "gif", "doc", "docx"}

# ─── Role helpers ──────────────────────────────────────────────────────────────

def _owner_or_vet(user: User):
    """Owner, caretaker, shelter, vet, admin can all access medical data."""
    if user.role not in {"owner", "vet", "admin", "caretaker", "shelter"}:
        raise HTTPException(status_code=403, detail="Access denied")

def _vet_or_admin(user: User):
    """Only vets and admins can write diagnoses / prescriptions."""
    if user.role not in {"vet", "admin"}:
        raise HTTPException(status_code=403, detail="Only vets and admins can perform this action")

def _get_pet_or_404(pet_id: int, db: Session) -> Pet:
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet


# ─── Vaccination Schemas ───────────────────────────────────────────────────────

class VaccineCreate(BaseModel):
    pet_id: int
    vaccine_name: str
    administered_date: datetime
    next_due_date: Optional[datetime] = None
    administered_by: Optional[str] = None
    batch_number: Optional[str] = None

    @field_validator("vaccine_name")
    @classmethod
    def name_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Vaccine name is required")
        if len(v) < 2:
            raise ValueError("Vaccine name must be at least 2 characters")
        return v

    @field_validator("administered_date")
    @classmethod
    def not_future_admin(cls, v: datetime) -> datetime:
        if v > datetime.utcnow() + timedelta(hours=1):
            raise ValueError("Administered date cannot be in the future")
        return v

    @field_validator("batch_number")
    @classmethod
    def clean_batch(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None

    @model_validator(mode="after")
    def due_after_admin(self) -> "VaccineCreate":
        if self.next_due_date and self.administered_date:
            if self.next_due_date <= self.administered_date:
                raise ValueError("Next due date must be after the administered date")
        return self


# ─── Vaccination Endpoints ────────────────────────────────────────────────────

@router.post("/vaccinations", summary="Add vaccination record [Owner/Vet/Caretaker]")
def add_vaccination(
    data: VaccineCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Roles allowed:** owner, caretaker, shelter, vet, admin
    - Owners log vaccinations for their pets.
    - Vets can log for any pet.
    """
    _owner_or_vet(current_user)
    _get_pet_or_404(data.pet_id, db)
    v = Vaccination(**data.model_dump())
    db.add(v)
    db.commit()
    db.refresh(v)
    return {"id": v.id, "message": "Vaccination recorded", "vaccine_name": v.vaccine_name}


@router.get("/vaccinations/{pet_id}", summary="List vaccinations [Owner/Vet]")
def get_vaccinations(
    pet_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Roles allowed:** all authenticated users"""
    _owner_or_vet(current_user)
    _get_pet_or_404(pet_id, db)
    vacs = db.query(Vaccination).filter(Vaccination.pet_id == pet_id).order_by(Vaccination.administered_date.desc()).all()
    return [
        {
            "id": v.id,
            "vaccine_name": v.vaccine_name,
            "administered_date": v.administered_date.isoformat(),
            "next_due_date": v.next_due_date.isoformat() if v.next_due_date else None,
            "administered_by": v.administered_by or "Unknown",
            "batch_number": v.batch_number,
            "days_until_due": (v.next_due_date - datetime.utcnow()).days if v.next_due_date else None,
        }
        for v in vacs
    ]


@router.delete("/vaccinations/{vac_id}", summary="Delete vaccination [Vet/Admin only]")
def delete_vaccination(
    vac_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Roles allowed:** vet, admin only"""
    _vet_or_admin(current_user)
    v = db.query(Vaccination).filter(Vaccination.id == vac_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Vaccination record not found")
    db.delete(v)
    db.commit()
    return {"message": "Vaccination record deleted"}


@router.get("/vaccinations/{pet_id}/due", summary="Get upcoming due vaccinations [All roles]")
def due_vaccinations(
    pet_id: int,
    days_ahead: int = Query(default=30, ge=1, le=365),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Returns vaccinations due within `days_ahead` days (default 30)."""
    _get_pet_or_404(pet_id, db)
    cutoff = datetime.utcnow() + timedelta(days=days_ahead)
    vacs = db.query(Vaccination).filter(
        Vaccination.pet_id == pet_id,
        Vaccination.next_due_date <= cutoff,
        Vaccination.next_due_date >= datetime.utcnow(),
    ).all()
    return [
        {
            "vaccine_name": v.vaccine_name,
            "due_date": v.next_due_date.isoformat(),
            "days_remaining": (v.next_due_date - datetime.utcnow()).days,
        }
        for v in vacs
    ]


# ─── Medication Schemas ───────────────────────────────────────────────────────

class MedCreate(BaseModel):
    pet_id: int
    name: str
    dosage: str
    frequency: str
    start_date: datetime
    end_date: Optional[datetime] = None
    notes: Optional[str] = None

    @field_validator("name")
    @classmethod
    def name_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Medication name is required")
        return v

    @field_validator("dosage")
    @classmethod
    def dosage_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Dosage is required (e.g. 10mg, 1 tablet)")
        return v

    @field_validator("frequency")
    @classmethod
    def valid_frequency(cls, v: str) -> str:
        if v not in VALID_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(VALID_FREQUENCIES))}")
        return v

    @model_validator(mode="after")
    def end_after_start(self) -> "MedCreate":
        if self.end_date and self.end_date <= self.start_date:
            raise ValueError("End date must be after start date")
        return self


class MedUpdate(BaseModel):
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    end_date: Optional[datetime] = None
    notes: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("frequency")
    @classmethod
    def valid_frequency(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_FREQUENCIES:
            raise ValueError(f"Frequency must be one of: {', '.join(sorted(VALID_FREQUENCIES))}")
        return v


# ─── Medication Endpoints ─────────────────────────────────────────────────────

@router.post("/medications", summary="Add medication [Owner/Vet]")
def add_medication(
    data: MedCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Roles allowed:** owner, caretaker, shelter, vet, admin
    - Owners add OTC medications.
    - Vets add prescription medications.
    """
    _owner_or_vet(current_user)
    _get_pet_or_404(data.pet_id, db)
    med = Medication(**data.model_dump())
    db.add(med)
    db.commit()
    db.refresh(med)
    return {"id": med.id, "message": "Medication added", "name": med.name}


@router.get("/medications/{pet_id}", summary="List medications [All roles]")
def get_medications(
    pet_id: int,
    active_only: bool = True,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Set `active_only=false` to include inactive/completed medications."""
    _owner_or_vet(current_user)
    _get_pet_or_404(pet_id, db)
    q = db.query(Medication).filter(Medication.pet_id == pet_id)
    if active_only:
        q = q.filter(Medication.is_active == True)
    meds = q.order_by(Medication.start_date.desc()).all()
    return [
        {
            "id": m.id, "name": m.name, "dosage": m.dosage, "frequency": m.frequency,
            "start_date": m.start_date.isoformat(),
            "end_date": m.end_date.isoformat() if m.end_date else None,
            "is_active": m.is_active, "notes": m.notes,
            "days_on_medication": (datetime.utcnow() - m.start_date).days,
        }
        for m in meds
    ]


@router.put("/medications/{med_id}", summary="Update medication [Owner/Vet]")
def update_medication(
    med_id: int,
    data: MedUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Update dosage, frequency, end date, or deactivate a medication."""
    _owner_or_vet(current_user)
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    for k, v in data.model_dump(exclude_none=True).items():
        setattr(med, k, v)
    db.commit()
    return {"message": "Medication updated"}


@router.put("/medications/{med_id}/deactivate", summary="Stop medication [Owner/Vet]")
def deactivate_medication(
    med_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Mark a medication as completed/stopped."""
    _owner_or_vet(current_user)
    med = db.query(Medication).filter(Medication.id == med_id).first()
    if not med:
        raise HTTPException(status_code=404, detail="Medication not found")
    if not med.is_active:
        raise HTTPException(status_code=400, detail="Medication is already inactive")
    med.is_active = False
    med.end_date = datetime.utcnow()
    db.commit()
    return {"message": f"{med.name} marked as completed"}


# ─── Appointment Schemas ──────────────────────────────────────────────────────

class ApptCreate(BaseModel):
    pet_id: int
    title: str
    appointment_type: str = "checkup"
    scheduled_at: datetime
    vet_id: Optional[int] = None
    notes: Optional[str] = None

    @field_validator("title")
    @classmethod
    def title_required(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Appointment title is required")
        if len(v) < 3:
            raise ValueError("Title must be at least 3 characters")
        return v

    @field_validator("appointment_type")
    @classmethod
    def valid_type(cls, v: str) -> str:
        v = v.lower().strip()
        if v not in VALID_APPT_TYPES:
            raise ValueError(f"Type must be one of: {', '.join(sorted(VALID_APPT_TYPES))}")
        return v

    @field_validator("scheduled_at")
    @classmethod
    def not_in_past(cls, v: datetime) -> datetime:
        if v < datetime.utcnow() - timedelta(minutes=5):
            raise ValueError("Appointment cannot be scheduled in the past")
        return v


class ApptUpdate(BaseModel):
    status: Optional[str] = None
    diagnosis: Optional[str] = None
    prescription: Optional[str] = None
    notes: Optional[str] = None

    @field_validator("status")
    @classmethod
    def valid_status(cls, v: Optional[str]) -> Optional[str]:
        if v and v not in VALID_STATUSES:
            raise ValueError(f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        return v

    @field_validator("diagnosis", "prescription")
    @classmethod
    def strip_text(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v else None


# ─── Appointment Endpoints ────────────────────────────────────────────────────

@router.post("/appointments", summary="Book appointment [Owner/Caretaker/Shelter]")
def create_appointment(
    data: ApptCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Roles allowed:** owner, caretaker, shelter, vet, admin
    - Owners/caretakers book appointments for their pets.
    - Vets can also create appointments on behalf of owners.
    """
    _owner_or_vet(current_user)
    _get_pet_or_404(data.pet_id, db)
    appt = Appointment(**data.model_dump(), owner_id=current_user.id)
    db.add(appt)
    db.commit()
    db.refresh(appt)
    return {"id": appt.id, "message": "Appointment booked", "scheduled_at": appt.scheduled_at.isoformat()}


@router.get("/appointments/{pet_id}", summary="List appointments [All roles]")
def get_appointments(
    pet_id: int,
    status: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Filter by status with `?status=pending|confirmed|completed|cancelled`"""
    _owner_or_vet(current_user)
    _get_pet_or_404(pet_id, db)
    q = db.query(Appointment).filter(Appointment.pet_id == pet_id)
    if status:
        if status not in VALID_STATUSES:
            raise HTTPException(status_code=422, detail=f"Status must be one of: {', '.join(sorted(VALID_STATUSES))}")
        q = q.filter(Appointment.status == status)
    appts = q.order_by(Appointment.scheduled_at.desc()).all()
    return [
        {
            "id": a.id, "title": a.title, "appointment_type": a.appointment_type,
            "scheduled_at": a.scheduled_at.isoformat(), "status": a.status,
            "diagnosis": a.diagnosis, "prescription": a.prescription, "notes": a.notes,
            "vet_id": a.vet_id,
        }
        for a in appts
    ]


@router.put("/appointments/{appt_id}", summary="Update appointment status [All roles]")
def update_appointment(
    appt_id: int,
    data: ApptUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    - **Owner/Caretaker:** can cancel their appointments.
    - **Vet/Admin:** can confirm, complete, add diagnosis and prescription.
    """
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    # Owners can only cancel their own
    if current_user.role in {"owner", "caretaker", "shelter"}:
        if appt.owner_id != current_user.id:
            raise HTTPException(status_code=403, detail="You can only modify your own appointments")
        if data.status and data.status not in {"cancelled"}:
            raise HTTPException(status_code=403, detail="Owners can only cancel appointments")
        if data.diagnosis or data.prescription:
            raise HTTPException(status_code=403, detail="Only vets can add diagnosis or prescription")

    for k, v in data.model_dump(exclude_none=True).items():
        setattr(appt, k, v)
    db.commit()
    return {"message": "Appointment updated", "status": appt.status}


@router.delete("/appointments/{appt_id}", summary="Delete appointment [Vet/Admin only]")
def delete_appointment(
    appt_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Roles allowed:** vet, admin only"""
    _vet_or_admin(current_user)
    appt = db.query(Appointment).filter(Appointment.id == appt_id).first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")
    db.delete(appt)
    db.commit()
    return {"message": "Appointment deleted"}


# ─── Medical Records ──────────────────────────────────────────────────────────

@router.post("/records/{pet_id}/upload", summary="Upload medical record [Owner/Vet]")
async def upload_record(
    pet_id: int,
    record_type: str,
    title: str,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """
    **Roles allowed:** owner, caretaker, shelter, vet, admin
    - Allowed file types: pdf, jpg, jpeg, png, gif, doc, docx
    - Record types: lab_result, surgery, diagnosis, prescription, imaging, other
    """
    _owner_or_vet(current_user)
    _get_pet_or_404(pet_id, db)

    title = title.strip()
    if not title:
        raise HTTPException(status_code=422, detail="Record title is required")

    record_type = record_type.lower().strip()
    if record_type not in VALID_RECORD_TYPES:
        raise HTTPException(status_code=422, detail=f"record_type must be one of: {', '.join(sorted(VALID_RECORD_TYPES))}")

    ext = (file.filename or "").rsplit(".", 1)[-1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(status_code=422, detail=f"File .{ext} not allowed. Accepted: {', '.join(sorted(ALLOWED_EXTENSIONS))}")

    # 10 MB size limit
    content = await file.read()
    if len(content) > 10 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="File size must be under 10 MB")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    filename = f"record_{pet_id}_{uuid.uuid4().hex[:8]}.{ext}"
    async with aiofiles.open(os.path.join(UPLOAD_DIR, filename), "wb") as f:
        await f.write(content)

    record = MedicalRecord(
        pet_id=pet_id, record_type=record_type, title=title,
        file_path=filename, recorded_by=current_user.name,
    )
    db.add(record)
    db.commit()
    return {"message": "Record uploaded", "file": filename, "title": title}


@router.get("/records/{pet_id}", summary="List medical records [All roles]")
def get_records(
    pet_id: int,
    record_type: Optional[str] = Query(default=None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Filter by `?record_type=lab_result|surgery|diagnosis|prescription|imaging|other`"""
    _owner_or_vet(current_user)
    _get_pet_or_404(pet_id, db)
    q = db.query(MedicalRecord).filter(MedicalRecord.pet_id == pet_id)
    if record_type:
        q = q.filter(MedicalRecord.record_type == record_type.lower())
    records = q.order_by(MedicalRecord.recorded_at.desc()).all()
    return [
        {
            "id": r.id, "record_type": r.record_type, "title": r.title,
            "file_path": r.file_path, "recorded_at": r.recorded_at.isoformat(),
            "recorded_by": r.recorded_by,
        }
        for r in records
    ]


@router.delete("/records/{record_id}", summary="Delete medical record [Vet/Admin only]")
def delete_record(
    record_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """**Roles allowed:** vet, admin only"""
    _vet_or_admin(current_user)
    record = db.query(MedicalRecord).filter(MedicalRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=404, detail="Record not found")
    # Remove file from disk
    filepath = os.path.join(UPLOAD_DIR, record.file_path or "")
    if record.file_path and os.path.exists(filepath):
        os.remove(filepath)
    db.delete(record)
    db.commit()
    return {"message": "Record deleted"}
