from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from ..database import get_db, Pet, User
from ..auth import get_current_user
from ..ai.gemini_service import (
    poison_lookup, food_safety_scan, food_safety_text, generate_care_plan,
    behavior_training_plan, onboarding_roadmap, read_medical_document,
    vaccine_info, medicine_info, CARE_PLAN_PROMPTS,
)

router = APIRouter(prefix="/api/care", tags=["Care & Safety"])


# ── Vaccine encyclopedia (curated, per q.md species list) ──────────────────────
VACCINE_ENCYCLOPEDIA: dict[str, list[dict]] = {
    "dog": [
        {"name": "Rabies", "core": True, "schedule": "12-16 weeks, booster every 1-3 years", "protects": "Rabies virus — fatal, legally required in most regions"},
        {"name": "DHPP", "core": True, "schedule": "6-8 wks, boosters every 3-4 wks until 16 wks, then 1-3 yearly", "protects": "Distemper, Hepatitis, Parvovirus, Parainfluenza"},
        {"name": "Bordetella", "core": False, "schedule": "Annually", "protects": "Kennel cough — for social dogs (parks, kennels, groomers)"},
        {"name": "Leptospirosis", "core": False, "schedule": "Annually", "protects": "Bacterial disease from water/soil; can cause kidney & liver failure"},
        {"name": "Canine Influenza", "core": False, "schedule": "2 doses, then annually", "protects": "Contagious respiratory infection"},
        {"name": "Lyme Disease", "core": False, "schedule": "2 doses, then annually", "protects": "Tick-borne borreliosis — for dogs in wooded/grassy areas"},
    ],
    "cat": [
        {"name": "Rabies", "core": True, "schedule": "12-16 weeks, booster every 1-3 years", "protects": "Rabies virus — required by law in most areas"},
        {"name": "FVRCP", "core": True, "schedule": "6-8 wks, boosters until 16 wks, then every 1-3 years", "protects": "Rhinotracheitis, Calicivirus, Panleukopenia (feline distemper)"},
        {"name": "FeLV", "core": False, "schedule": "2 doses, then annually for outdoor cats", "protects": "Feline Leukemia — leading cause of cancer in cats"},
        {"name": "FIV", "core": False, "schedule": "Discuss with vet", "protects": "Feline Immunodeficiency Virus — for cats at risk of bite wounds"},
    ],
    "bird": [
        {"name": "Polyomavirus", "core": False, "schedule": "2 doses 2-4 wks apart, then annually", "protects": "Deadly to young birds; for multi-bird households"},
        {"name": "Pacheco's Disease", "core": False, "schedule": "Annually", "protects": "Highly contagious herpesvirus in parrots"},
        {"name": "Avian Influenza", "core": False, "schedule": "Region-dependent", "protects": "Bird flu — mainly poultry/aviary settings"},
    ],
    "rabbit": [
        {"name": "RHDV2", "core": True, "schedule": "Annually", "protects": "Rabbit Hemorrhagic Disease — fatal, no treatment"},
        {"name": "Myxomatosis", "core": True, "schedule": "Annually (region-dependent)", "protects": "Fatal insect-borne viral disease"},
    ],
    "horse": [
        {"name": "Tetanus", "core": True, "schedule": "Annually", "protects": "Clostridium tetani — horses are highly susceptible"},
        {"name": "Rabies", "core": True, "schedule": "Annually", "protects": "Rabies virus"},
        {"name": "EEE/WEE (Encephalomyelitis)", "core": True, "schedule": "Annually, before mosquito season", "protects": "Mosquito-borne brain inflammation"},
        {"name": "West Nile Virus", "core": True, "schedule": "Annually", "protects": "Mosquito-borne neurological disease"},
        {"name": "Equine Influenza", "core": False, "schedule": "Every 6-12 months", "protects": "Contagious respiratory disease"},
    ],
    "ferret": [
        {"name": "Canine Distemper", "core": True, "schedule": "8, 11, 14 wks, then annually", "protects": "Distemper — nearly 100% fatal in ferrets"},
        {"name": "Rabies", "core": True, "schedule": "Annually from 12-16 weeks", "protects": "Rabies virus"},
    ],
    "fish": [
        {"name": "No routine vaccines", "core": False, "schedule": "—", "protects": "Pet fish rarely need vaccines; focus on water quality, quarantine of new fish, and parasite prevention"},
    ],
    "hamster": [
        {"name": "No routine vaccines", "core": False, "schedule": "—", "protects": "Hamsters don't receive routine vaccines; focus on habitat hygiene, wet-tail prevention and annual checkups"},
    ],
    "snake": [
        {"name": "No routine vaccines", "core": False, "schedule": "—", "protects": "Snakes don't receive routine vaccines; focus on parasite screening, quarantine and habitat temperature/humidity"},
    ],
    "turtle": [
        {"name": "No routine vaccines", "core": False, "schedule": "—", "protects": "Turtles don't receive routine vaccines; focus on UVB lighting, calcium, water hygiene and salmonella precautions"},
    ],
}


class PoisonRequest(BaseModel):
    substance: str
    pet_id: Optional[int] = None
    species: Optional[str] = None
    amount: str = ""


class FoodCheckRequest(BaseModel):
    pet_id: int
    food: str


class CarePlanRequest(BaseModel):
    pet_id: int
    plan_type: str  # keys of CARE_PLAN_PROMPTS
    extra_context: str = ""


class BehaviorRequest(BaseModel):
    pet_id: int
    problem: str


class OnboardingRequest(BaseModel):
    pet_id: int
    known_history: str = ""
    visible_symptoms: str = ""
    vaccination_known: bool = False


class VaccineInfoRequest(BaseModel):
    vaccine_name: str
    species: str


class MedicineInfoRequest(BaseModel):
    medicine_name: str
    species: str = ""


def _get_pet(db: Session, pet_id: int) -> Pet:
    pet = db.query(Pet).filter(Pet.id == pet_id).first()
    if not pet:
        raise HTTPException(status_code=404, detail="Pet not found")
    return pet


def _pet_dict(pet: Pet) -> dict:
    return {
        "name": pet.name, "species": pet.species, "breed": pet.breed,
        "age": pet.age, "weight": pet.weight, "allergies": pet.allergies,
        "activity_level": pet.activity_level,
    }


def _parse_sections(raw: str) -> dict:
    """Parse KEY: value lines from a structured AI response."""
    parsed = {}
    for line in raw.split("\n"):
        if ":" in line:
            key, _, val = line.partition(":")
            key = key.strip().upper().replace(" ", "_")
            if key.isidentifier() or key.replace("_", "").isalpha():
                parsed[key.lower()] = val.strip()
    return parsed


# ── Poison Center ──────────────────────────────────────────────────────────────
@router.post("/poison-check")
def poison_check(data: PoisonRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    species, weight = data.species or "dog", None
    if data.pet_id:
        pet = _get_pet(db, data.pet_id)
        species, weight = pet.species or species, pet.weight
    result = poison_lookup(data.substance, species, weight, data.amount)
    return {"substance": data.substance, "species": species, "raw": result, **_parse_sections(result)}


# ── Food Scanner ───────────────────────────────────────────────────────────────
@router.post("/food-scan/{pet_id}")
async def food_scan(pet_id: int, file: UploadFile = File(...),
                    db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = _get_pet(db, pet_id)
    image_bytes = await file.read()
    result = food_safety_scan(image_bytes, pet.species or "pet", pet.breed, pet.weight, pet.allergies)
    return {"pet_id": pet_id, "pet_name": pet.name, "raw": result, **_parse_sections(result)}


@router.post("/food-check")
def food_check(data: FoodCheckRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = _get_pet(db, data.pet_id)
    result = food_safety_text(data.food, pet.species or "pet", pet.breed, pet.weight, pet.allergies)
    return {"pet_id": data.pet_id, "pet_name": pet.name, "raw": result, **_parse_sections(result)}


# ── Care Plans (deworming, tick, grooming, exercise, feeding, senior, pregnancy, travel, vet visit) ──
@router.get("/plan-types")
def plan_types(current_user: User = Depends(get_current_user)):
    return {"types": list(CARE_PLAN_PROMPTS.keys())}


@router.post("/plan")
def care_plan(data: CarePlanRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if data.plan_type not in CARE_PLAN_PROMPTS:
        raise HTTPException(status_code=422, detail=f"plan_type must be one of: {', '.join(CARE_PLAN_PROMPTS)}")
    pet = _get_pet(db, data.pet_id)
    plan = generate_care_plan(data.plan_type, _pet_dict(pet), data.extra_context)
    return {"pet_id": data.pet_id, "pet_name": pet.name, "plan_type": data.plan_type, "plan": plan}


@router.post("/behavior-plan")
def behavior_plan(data: BehaviorRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = _get_pet(db, data.pet_id)
    plan = behavior_training_plan(_pet_dict(pet), data.problem)
    return {"pet_id": data.pet_id, "pet_name": pet.name, "problem": data.problem, "plan": plan}


# ── AI Pet Onboarding (adopted pets, unknown vaccination recovery) ─────────────
@router.post("/onboarding-roadmap")
def onboarding(data: OnboardingRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    pet = _get_pet(db, data.pet_id)
    roadmap = onboarding_roadmap(_pet_dict(pet), data.known_history, data.visible_symptoms, data.vaccination_known)
    return {"pet_id": data.pet_id, "pet_name": pet.name, "roadmap": roadmap}


# ── AI Document Reader ─────────────────────────────────────────────────────────
@router.post("/document-reader")
async def document_reader(file: UploadFile = File(...), doc_hint: str = Form(""),
                          current_user: User = Depends(get_current_user)):
    image_bytes = await file.read()
    if len(image_bytes) > 10 * 1024 * 1024:
        raise HTTPException(status_code=422, detail="Document image must be under 10 MB")
    analysis = read_medical_document(image_bytes, doc_hint)
    return {"analysis": analysis}


# ── Vaccination Center & Medicine Encyclopedia ─────────────────────────────────
@router.get("/vaccines/{species}")
def vaccines_for_species(species: str, current_user: User = Depends(get_current_user)):
    species = species.lower().strip()
    vaccines = VACCINE_ENCYCLOPEDIA.get(species)
    if vaccines is None:
        raise HTTPException(status_code=404, detail=f"No vaccine data for '{species}'. Available: {', '.join(sorted(VACCINE_ENCYCLOPEDIA))}")
    return {"species": species, "vaccines": vaccines}


@router.get("/vaccines")
def vaccine_species_list(current_user: User = Depends(get_current_user)):
    return {"species": sorted(VACCINE_ENCYCLOPEDIA.keys())}


@router.post("/vaccine-info")
def vaccine_details(data: VaccineInfoRequest, current_user: User = Depends(get_current_user)):
    info = vaccine_info(data.vaccine_name, data.species)
    return {"vaccine": data.vaccine_name, "species": data.species, "info": info}


@router.post("/medicine-info")
def medicine_details(data: MedicineInfoRequest, current_user: User = Depends(get_current_user)):
    info = medicine_info(data.medicine_name, data.species)
    return {"medicine": data.medicine_name, "info": info}
