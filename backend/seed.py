"""
Run once to seed all demo data:
  cd backend
  python seed.py
"""
import sys, os
sys.path.insert(0, os.path.dirname(__file__))

from datetime import datetime, timedelta
from app.database import (
    SessionLocal, create_tables, User, Pet,
    FeedingLog, ActivityLog, HealthLog,
    Vaccination, Medication, Appointment,
    Notification, VetChatRoom, VetChatMessage,
)
from app.auth import hash_password

# ── Demo accounts ─────────────────────────────────────────────────────────────
DEMO_ACCOUNTS = [
    {"name": "Alex Owner",    "email": "owner@demo.com",     "password": "demo1234", "role": "owner"},
    {"name": "Dr. Sarah Vet", "email": "vet@demo.com",       "password": "demo1234", "role": "vet"},
    {"name": "Admin User",    "email": "admin@demo.com",     "password": "demo1234", "role": "admin"},
    {"name": "Care Taker",    "email": "caretaker@demo.com", "password": "demo1234", "role": "caretaker"},
    {"name": "Happy Shelter", "email": "shelter@demo.com",   "password": "demo1234", "role": "shelter"},
]

def seed():
    create_tables()
    db = SessionLocal()

    # ── Users ──────────────────────────────────────────────────────────────────
    users = {}
    for acc in DEMO_ACCOUNTS:
        u = db.query(User).filter(User.email == acc["email"]).first()
        if not u:
            u = User(name=acc["name"], email=acc["email"],
                     hashed_password=hash_password(acc["password"]), role=acc["role"])
            db.add(u)
            db.flush()
            print(f"  [+] User: {acc['email']} ({acc['role']})")
        else:
            print(f"  [=] User exists: {acc['email']}")
        users[acc["role"]] = u

    db.commit()

    owner = users["owner"]
    vet   = users["vet"]

    # ── Pets ───────────────────────────────────────────────────────────────────
    existing_pets = db.query(Pet).filter(Pet.owner_id == owner.id).count()
    pets = []
    if existing_pets == 0:
        demo_pets = [
            Pet(owner_id=owner.id, name="Buddy",   species="dog", breed="Golden Retriever",
                age=4, weight=28, gender="male",   activity_level="high",
                allergies="Chicken", diet_preferences="Grain-free"),
            Pet(owner_id=owner.id, name="Whiskers", species="cat", breed="Persian",
                age=2, weight=4.5, gender="female", activity_level="low",
                diet_preferences="Wet food only"),
        ]
        for p in demo_pets:
            db.add(p)
        db.flush()
        pets = demo_pets
        print(f"  [+] Created {len(pets)} pets for owner")
    else:
        pets = db.query(Pet).filter(Pet.owner_id == owner.id).all()
        print(f"  [=] Pets exist for owner ({len(pets)})")

    db.commit()

    buddy    = pets[0]
    whiskers = pets[1] if len(pets) > 1 else pets[0]

    # ── Feeding logs (last 7 days) ─────────────────────────────────────────────
    if db.query(FeedingLog).filter(FeedingLog.pet_id == buddy.id).count() == 0:
        foods = [("Royal Canin dry kibble", 200), ("Wet chicken pouch", 100), ("Royal Canin dry kibble", 200)]
        for i, (food, qty) in enumerate(foods * 3):
            db.add(FeedingLog(pet_id=buddy.id, food_type=food, quantity_grams=qty,
                              water_ml=250, fed_at=datetime.utcnow() - timedelta(days=i, hours=8)))
        print("  [+] Feeding logs for Buddy")

    # ── Activity logs ─────────────────────────────────────────────────────────
    if db.query(ActivityLog).filter(ActivityLog.pet_id == buddy.id).count() == 0:
        activities = [("walk", 30, 2.1), ("play", 20, 0), ("walk", 45, 3.5), ("run", 25, 3.0)]
        for i, (atype, dur, dist) in enumerate(activities):
            db.add(ActivityLog(pet_id=buddy.id, activity_type=atype, duration_minutes=dur,
                               distance_km=dist, calories_burned=dur * 5,
                               logged_at=datetime.utcnow() - timedelta(days=i+1)))
        print("  [+] Activity logs for Buddy")

    # ── Health logs ───────────────────────────────────────────────────────────
    if db.query(HealthLog).filter(HealthLog.pet_id == buddy.id).count() == 0:
        logs = [
            ("happy",   "normal", 9,   None,              "normal", "Very playful today"),
            ("neutral", "low",    8,   "mild scratching", "normal", "Scratching left ear"),
            ("happy",   "normal", 8.5, None,              "normal", None),
            ("sad",     "low",    7,   "vomiting once",   "loose",  "Vomited after morning meal"),
        ]
        for i, (mood, app, sleep, symp, stool, notes) in enumerate(logs):
            db.add(HealthLog(pet_id=buddy.id, mood=mood, appetite=app, sleep_hours=sleep,
                             symptoms=symp, stool_quality=stool, notes=notes,
                             logged_at=datetime.utcnow() - timedelta(days=i)))
        print("  [+] Health logs for Buddy")

    # ── Vaccinations ─────────────────────────────────────────────────────────
    if db.query(Vaccination).filter(Vaccination.pet_id == buddy.id).count() == 0:
        vacs = [
            ("Rabies",            datetime(2024, 3, 10),  datetime(2025, 3, 10),  "Dr. Sarah Vet"),
            ("Distemper (DHPP)",  datetime(2024, 1, 15),  datetime(2025, 1, 15),  "Dr. Sarah Vet"),
            ("Bordetella",        datetime(2024, 6, 1),   datetime(2025, 6, 1),   "City Vet Clinic"),
            ("Leptospirosis",     datetime(2024, 6, 1),   datetime.utcnow() + timedelta(days=12), "Dr. Sarah Vet"),
        ]
        for name, admin, due, by in vacs:
            db.add(Vaccination(pet_id=buddy.id, vaccine_name=name,
                               administered_date=admin, next_due_date=due, administered_by=by))
        print("  [+] Vaccinations for Buddy")

    # ── Medications ──────────────────────────────────────────────────────────
    if db.query(Medication).filter(Medication.pet_id == buddy.id).count() == 0:
        db.add(Medication(pet_id=buddy.id, name="Apoquel (Oclacitinib)",
                          dosage="16mg", frequency="daily",
                          start_date=datetime.utcnow() - timedelta(days=10),
                          end_date=datetime.utcnow() + timedelta(days=20),
                          notes="For allergy itching. Give with food.", is_active=True))
        db.add(Medication(pet_id=buddy.id, name="Heartgard Plus",
                          dosage="1 chewable tablet", frequency="monthly",
                          start_date=datetime.utcnow() - timedelta(days=30),
                          notes="Heartworm prevention.", is_active=True))
        print("  [+] Medications for Buddy")

    # ── Appointments ─────────────────────────────────────────────────────────
    if db.query(Appointment).filter(Appointment.pet_id == buddy.id).count() == 0:
        db.add(Appointment(
            pet_id=buddy.id, owner_id=owner.id, vet_id=vet.id,
            title="Annual wellness checkup", appointment_type="checkup",
            scheduled_at=datetime.utcnow() + timedelta(days=5),
            status="confirmed", notes="Bring vaccination booklet",
        ))
        db.add(Appointment(
            pet_id=buddy.id, owner_id=owner.id, vet_id=vet.id,
            title="Follow-up skin allergy", appointment_type="follow-up",
            scheduled_at=datetime.utcnow() - timedelta(days=15),
            status="completed",
            diagnosis="Atopic dermatitis — allergen: chicken protein",
            prescription="Apoquel 16mg daily for 30 days. Hypoallergenic diet.",
        ))
        print("  [+] Appointments for Buddy")

    # ── Notifications ─────────────────────────────────────────────────────────
    if db.query(Notification).filter(Notification.user_id == owner.id).count() == 0:
        notifs = [
            ("Vaccination Due", "Leptospirosis for Buddy is due in 12 days!", "warning"),
            ("Appointment Confirmed", "Your checkup with Dr. Sarah is confirmed for next week.", "info"),
            ("Medication Reminder", "Give Buddy his Apoquel with breakfast today.", "reminder"),
            ("AI Health Tip", "Buddy's activity is 18% below target this week. Consider an extra walk!", "info"),
        ]
        for title, msg, ntype in notifs:
            db.add(Notification(user_id=owner.id, title=title, message=msg, notification_type=ntype))
        print("  [+] Notifications for owner")

    # ── Vet Chat Room + Sample Messages ───────────────────────────────────────
    existing_room = db.query(VetChatRoom).filter(
        VetChatRoom.owner_id == owner.id,
        VetChatRoom.vet_id == vet.id,
    ).first()
    if not existing_room:
        room = VetChatRoom(owner_id=owner.id, vet_id=vet.id, pet_id=buddy.id)
        db.add(room)
        db.flush()
        sample_messages = [
            (owner.id, "Hi Dr. Sarah, Buddy has been scratching his left ear a lot lately. Should I be worried?"),
            (vet.id,   "Hi Alex! Ear scratching can indicate an ear infection or allergies. Is there any odor or discharge from the ear?"),
            (owner.id, "I noticed a little brownish discharge yesterday. He's also shaking his head frequently."),
            (vet.id,   "That sounds like it could be an ear infection (otitis externa). I recommend bringing him in for an examination. I've confirmed your upcoming appointment for the allergy follow-up — we can check the ear then too."),
            (owner.id, "Perfect! Also, he vomited once this morning after breakfast. Is that related?"),
            (vet.id,   "It could be related to the food — you mentioned he's allergic to chicken. Please check the ingredient list on his current food. Try withholding food for 4-6 hours and offer small amounts of bland food (boiled rice + plain chicken-free protein). If vomiting continues, bring him in sooner."),
            (owner.id, "Okay will do. Thank you so much Dr. Sarah!"),
            (vet.id,   "Of course! That's what I'm here for. See you at the appointment. Take care of Buddy!"),
        ]
        t = datetime.utcnow() - timedelta(hours=2)
        for sender_id, text in sample_messages:
            db.add(VetChatMessage(room_id=room.id, sender_id=sender_id, message=text,
                                  is_read=True, sent_at=t))
            t += timedelta(minutes=3)
        print("  [+] Vet chat room + sample conversation")

    db.commit()
    db.close()
    print("\nSeed complete.")

if __name__ == "__main__":
    seed()
