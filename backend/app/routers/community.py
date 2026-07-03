from fastapi import APIRouter, Depends, HTTPException, UploadFile, File
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
from ..database import get_db, LostPetReport, GeofenceZone, Notification, Pet, User
from ..auth import get_current_user
import os, aiofiles, uuid, math

router = APIRouter(prefix="/api/community", tags=["Community & Safety"])
UPLOAD_DIR = os.getenv("UPLOAD_DIR", "uploads")


# ─── Lost Pet ─────────────────────────────────────────────────────────────────

class LostReportCreate(BaseModel):
    pet_id: int
    description: Optional[str] = None
    last_seen_lat: Optional[float] = None
    last_seen_lng: Optional[float] = None
    last_seen_location: Optional[str] = None


@router.post("/lost-pets")
def report_lost(data: LostReportCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = db.query(Pet).filter(Pet.id == data.pet_id, Pet.owner_id == current_user.id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    pet.is_lost = True
    pet.last_known_lat = data.last_seen_lat
    pet.last_known_lng = data.last_seen_lng
    report = LostPetReport(**data.model_dump(), reporter_id=current_user.id)
    db.add(report)
    db.commit()
    return {"message": f"Lost report created for {pet.name}", "report_id": report.id}


@router.get("/lost-pets")
def get_lost_pets(db: Session = Depends(get_db)):
    reports = db.query(LostPetReport).filter(LostPetReport.status == "active").all()
    result = []
    for r in reports:
        pet = db.query(Pet).filter(Pet.id == r.pet_id).first()
        result.append({
            "report_id": r.id, "pet_id": r.pet_id,
            "pet_name": pet.name if pet else None, "species": pet.species if pet else None,
            "breed": pet.breed if pet else None, "photo": pet.photo if pet else None,
            "description": r.description, "last_seen_location": r.last_seen_location,
            "last_seen_lat": r.last_seen_lat, "last_seen_lng": r.last_seen_lng,
            "reported_at": r.reported_at.isoformat()
        })
    return result


@router.post("/lost-pets/{report_id}/upload-found-photo")
async def upload_found_photo(report_id: int, file: UploadFile = File(...), db: Session = Depends(get_db)):
    report = db.query(LostPetReport).filter(LostPetReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.split(".")[-1]
    filename = f"found_{report_id}_{uuid.uuid4().hex[:8]}.{ext}"
    path = os.path.join(UPLOAD_DIR, filename)
    async with aiofiles.open(path, "wb") as f:
        await f.write(await file.read())
    report.found_photo = filename
    db.commit()
    return {"message": "Photo uploaded for matching", "photo": filename}


@router.put("/lost-pets/{report_id}/resolve")
def resolve_lost_report(report_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    report = db.query(LostPetReport).filter(LostPetReport.id == report_id).first()
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    report.status = "found"
    pet = db.query(Pet).filter(Pet.id == report.pet_id).first()
    if pet:
        pet.is_lost = False
    db.commit()
    return {"message": "Pet marked as found"}


# ─── Geofence ─────────────────────────────────────────────────────────────────

class GeofenceCreate(BaseModel):
    pet_id: int
    name: str
    center_lat: float
    center_lng: float
    radius_meters: float


@router.post("/geofence")
def create_geofence(data: GeofenceCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    zone = GeofenceZone(**data.model_dump())
    db.add(zone)
    db.commit()
    db.refresh(zone)
    return {"id": zone.id, "message": "Geofence zone created"}


@router.get("/geofence/{pet_id}")
def get_geofences(pet_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    zones = db.query(GeofenceZone).filter(GeofenceZone.pet_id == pet_id, GeofenceZone.is_active == True).all()
    return [{"id": z.id, "name": z.name, "center_lat": z.center_lat, "center_lng": z.center_lng, "radius_meters": z.radius_meters} for z in zones]


@router.post("/geofence/check-location")
def check_geofence(pet_id: int, lat: float, lng: float, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    """Check if pet is within any geofence zone"""
    zones = db.query(GeofenceZone).filter(GeofenceZone.pet_id == pet_id, GeofenceZone.is_active == True).all()
    alerts = []
    for zone in zones:
        # Haversine distance
        R = 6371000
        lat1, lng1 = math.radians(zone.center_lat), math.radians(zone.center_lng)
        lat2, lng2 = math.radians(lat), math.radians(lng)
        dlat, dlng = lat2 - lat1, lng2 - lng1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlng/2)**2
        distance = R * 2 * math.atan2(math.sqrt(a), math.sqrt(1-a))
        if distance > zone.radius_meters:
            alerts.append({"zone": zone.name, "distance_outside_meters": round(distance - zone.radius_meters)})
    return {"inside_all_zones": len(alerts) == 0, "alerts": alerts}


# ─── Notifications ────────────────────────────────────────────────────────────

@router.get("/notifications")
def get_notifications(unread_only: bool = False, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    q = db.query(Notification).filter(Notification.user_id == current_user.id)
    if unread_only:
        q = q.filter(Notification.is_read == False)
    notifs = q.order_by(Notification.created_at.desc()).limit(50).all()
    return [{"id": n.id, "title": n.title, "message": n.message,
             "notification_type": n.notification_type, "is_read": n.is_read,
             "created_at": n.created_at.isoformat()} for n in notifs]


@router.put("/notifications/{notif_id}/read")
def mark_read(notif_id: int, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    n = db.query(Notification).filter(Notification.id == notif_id, Notification.user_id == current_user.id).first()
    if not n:
        raise HTTPException(status_code=404, detail="Notification not found")
    n.is_read = True
    db.commit()
    return {"message": "Marked as read"}
