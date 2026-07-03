from sqlalchemy import create_engine, Column, Integer, String, Float, Boolean, DateTime, Text, ForeignKey, JSON
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker, relationship
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./petcare.db")
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class User(Base):
    __tablename__ = "users"
    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    hashed_password = Column(String, nullable=False)
    role = Column(String, default="owner")  # owner, vet, admin, caretaker, shelter
    phone = Column(String, nullable=True)
    avatar = Column(String, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    pets = relationship("Pet", back_populates="owner")
    appointments = relationship("Appointment", back_populates="owner", foreign_keys="Appointment.owner_id")


class Pet(Base):
    __tablename__ = "pets"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"))
    name = Column(String, nullable=False)
    species = Column(String, nullable=False)  # dog, cat, bird, etc.
    breed = Column(String, nullable=True)
    age = Column(Float, nullable=True)
    weight = Column(Float, nullable=True)
    gender = Column(String, nullable=True)
    color = Column(String, nullable=True)
    microchip_id = Column(String, nullable=True)
    allergies = Column(Text, nullable=True)
    diet_preferences = Column(Text, nullable=True)
    activity_level = Column(String, default="moderate")  # low, moderate, high
    is_lost = Column(Boolean, default=False)
    last_known_lat = Column(Float, nullable=True)
    last_known_lng = Column(Float, nullable=True)
    photo = Column(String, nullable=True)
    date_of_birth = Column(String, nullable=True)  # ISO date YYYY-MM-DD for auto-age
    created_at = Column(DateTime, default=datetime.utcnow)
    owner = relationship("User", back_populates="pets")
    feeding_logs = relationship("FeedingLog", back_populates="pet")
    activity_logs = relationship("ActivityLog", back_populates="pet")
    health_logs = relationship("HealthLog", back_populates="pet")
    vaccinations = relationship("Vaccination", back_populates="pet")
    medications = relationship("Medication", back_populates="pet")
    appointments = relationship("Appointment", back_populates="pet")
    medical_records = relationship("MedicalRecord", back_populates="pet")


class FeedingLog(Base):
    __tablename__ = "feeding_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    food_type = Column(String, nullable=False)
    quantity_grams = Column(Float, nullable=False)
    water_ml = Column(Float, default=0)
    fed_at = Column(DateTime, default=datetime.utcnow)
    notes = Column(Text, nullable=True)
    pet = relationship("Pet", back_populates="feeding_logs")


class ActivityLog(Base):
    __tablename__ = "activity_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    activity_type = Column(String, nullable=False)  # walk, play, swim, rest
    duration_minutes = Column(Float, nullable=False)
    distance_km = Column(Float, default=0)
    gps_route = Column(JSON, nullable=True)  # list of {lat, lng}
    calories_burned = Column(Float, default=0)
    logged_at = Column(DateTime, default=datetime.utcnow)
    pet = relationship("Pet", back_populates="activity_logs")


class HealthLog(Base):
    __tablename__ = "health_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    mood = Column(String, nullable=True)  # happy, neutral, sad, anxious
    appetite = Column(String, nullable=True)  # normal, low, high, none
    sleep_hours = Column(Float, nullable=True)
    symptoms = Column(Text, nullable=True)
    stool_quality = Column(String, nullable=True)
    notes = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)
    pet = relationship("Pet", back_populates="health_logs")


class Vaccination(Base):
    __tablename__ = "vaccinations"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    vaccine_name = Column(String, nullable=False)
    administered_date = Column(DateTime, nullable=False)
    next_due_date = Column(DateTime, nullable=True)
    administered_by = Column(String, nullable=True)
    batch_number = Column(String, nullable=True)
    pet = relationship("Pet", back_populates="vaccinations")


class Medication(Base):
    __tablename__ = "medications"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    name = Column(String, nullable=False)
    dosage = Column(String, nullable=False)
    frequency = Column(String, nullable=False)  # daily, twice_daily, weekly
    start_date = Column(DateTime, nullable=False)
    end_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    notes = Column(Text, nullable=True)
    pet = relationship("Pet", back_populates="medications")


class Appointment(Base):
    __tablename__ = "appointments"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    owner_id = Column(Integer, ForeignKey("users.id"))
    vet_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    title = Column(String, nullable=False)
    appointment_type = Column(String, default="checkup")  # checkup, vaccination, surgery, grooming, emergency
    scheduled_at = Column(DateTime, nullable=False)
    status = Column(String, default="pending")  # pending, confirmed, completed, cancelled
    notes = Column(Text, nullable=True)
    diagnosis = Column(Text, nullable=True)
    prescription = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    pet = relationship("Pet", back_populates="appointments")
    owner = relationship("User", back_populates="appointments", foreign_keys=[owner_id])


class MedicalRecord(Base):
    __tablename__ = "medical_records"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    record_type = Column(String, nullable=False)  # lab_result, surgery, diagnosis, prescription
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    file_path = Column(String, nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)
    recorded_by = Column(String, nullable=True)
    pet = relationship("Pet", back_populates="medical_records")


class LostPetReport(Base):
    __tablename__ = "lost_pet_reports"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    reporter_id = Column(Integer, ForeignKey("users.id"))
    description = Column(Text, nullable=True)
    last_seen_lat = Column(Float, nullable=True)
    last_seen_lng = Column(Float, nullable=True)
    last_seen_location = Column(String, nullable=True)
    found_photo = Column(String, nullable=True)
    status = Column(String, default="active")  # active, found, closed
    reported_at = Column(DateTime, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"
    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))
    title = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    notification_type = Column(String, default="info")  # info, warning, emergency, reminder
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)


class GeofenceZone(Base):
    __tablename__ = "geofence_zones"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    name = Column(String, nullable=False)
    center_lat = Column(Float, nullable=False)
    center_lng = Column(Float, nullable=False)
    radius_meters = Column(Float, nullable=False)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class WeightLog(Base):
    """Weight measurement over time — powers growth charts."""
    __tablename__ = "weight_logs"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    weight_kg = Column(Float, nullable=False)
    notes = Column(Text, nullable=True)
    logged_at = Column(DateTime, default=datetime.utcnow)


class Expense(Base):
    """Pet-related expense — food, medicine, vet, grooming, insurance, etc."""
    __tablename__ = "expenses"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    category = Column(String, nullable=False)  # food, medicine, vet, grooming, insurance, toys, other
    description = Column(String, nullable=True)
    amount = Column(Float, nullable=False)
    spent_at = Column(DateTime, default=datetime.utcnow)


class InsurancePolicy(Base):
    __tablename__ = "insurance_policies"
    id = Column(Integer, primary_key=True, index=True)
    pet_id = Column(Integer, ForeignKey("pets.id"))
    user_id = Column(Integer, ForeignKey("users.id"))
    provider = Column(String, nullable=False)
    policy_number = Column(String, nullable=True)
    coverage_summary = Column(Text, nullable=True)
    premium_amount = Column(Float, nullable=True)
    premium_frequency = Column(String, default="monthly")  # monthly, quarterly, yearly
    start_date = Column(DateTime, nullable=True)
    renewal_date = Column(DateTime, nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class VetChatRoom(Base):
    """A persistent chat room between one owner and one vet."""
    __tablename__ = "vet_chat_rooms"
    id = Column(Integer, primary_key=True, index=True)
    owner_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    vet_id   = Column(Integer, ForeignKey("users.id"), nullable=False)
    pet_id   = Column(Integer, ForeignKey("pets.id"),  nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    messages = relationship("VetChatMessage", back_populates="room", order_by="VetChatMessage.sent_at")


class VetChatMessage(Base):
    """Individual message in a vet-owner chat room."""
    __tablename__ = "vet_chat_messages"
    id        = Column(Integer, primary_key=True, index=True)
    room_id   = Column(Integer, ForeignKey("vet_chat_rooms.id"), nullable=False)
    sender_id = Column(Integer, ForeignKey("users.id"),          nullable=False)
    message   = Column(Text, nullable=False)
    is_read   = Column(Boolean, default=False)
    sent_at   = Column(DateTime, default=datetime.utcnow)
    room      = relationship("VetChatRoom", back_populates="messages")


def _add_missing_columns():
    """Lightweight SQLite migration: add columns that exist on models but not in the DB file."""
    from sqlalchemy import inspect, text
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table in Base.metadata.sorted_tables:
            if not inspector.has_table(table.name):
                continue
            existing = {c["name"] for c in inspector.get_columns(table.name)}
            for col in table.columns:
                if col.name not in existing:
                    col_type = col.type.compile(engine.dialect)
                    conn.execute(text(f'ALTER TABLE "{table.name}" ADD COLUMN "{col.name}" {col_type}'))


def create_tables():
    Base.metadata.create_all(bind=engine)
    _add_missing_columns()
