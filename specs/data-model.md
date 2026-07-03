# PetCare AI — Data Model Spec

SQLAlchemy models in `backend/app/database.py`. SQLite in dev; any SQLAlchemy
URL in prod. Schema evolves additively — `create_tables()` auto-adds missing
columns on startup.

```
User 1──* Pet 1──* FeedingLog / ActivityLog / HealthLog / WeightLog
              1──* Vaccination / Medication / MedicalRecord
              1──* Appointment *──1 User(vet)
              1──* Expense / InsurancePolicy   (also keyed to user)
              1──* LostPetReport / GeofenceZone
User 1──* Notification
User(owner) 1──* VetChatRoom *──1 User(vet);  VetChatRoom 1──* VetChatMessage
```

## Tables

| Table | Key fields | Notes |
|---|---|---|
| users | role (owner/vet/admin/caretaker/shelter), email unique, hashed_password | bcrypt 4.x via passlib |
| pets | species, breed, age, weight, gender, allergies, activity_level, is_lost, last_known_lat/lng, photo, date_of_birth | age auto-computed from date_of_birth when present |
| feeding_logs | food_type, quantity_grams, water_ml, fed_at | water intake tracking lives here |
| activity_logs | activity_type, duration_minutes, distance_km, gps_route (JSON), calories_burned | |
| health_logs | mood, appetite, sleep_hours, symptoms, stool_quality | symptoms feed the timeline |
| weight_logs | weight_kg, logged_at | powers growth chart; logging also syncs `pets.weight` |
| vaccinations | vaccine_name, administered_date, next_due_date, batch_number | |
| medications | name, dosage, frequency, start/end date, is_active | active meds appear on emergency card |
| appointments | pet_id, owner_id, vet_id, appointment_type, scheduled_at, status, diagnosis, prescription | |
| medical_records | record_type, title, file_path | files under UPLOAD_DIR, served at /uploads |
| expenses | pet_id, user_id, category, amount, spent_at | categories validated server-side |
| insurance_policies | provider, policy_number, premium_amount/frequency, renewal_date, is_active | |
| lost_pet_reports | last_seen lat/lng/location, status | |
| notifications | user_id, notification_type, is_read | |
| geofence_zones | center lat/lng, radius_meters | |
| vet_chat_rooms / vet_chat_messages | owner_id, vet_id, pet_id / sender_id, message, is_read | WebSocket-backed |

## Invariants

- Every pet-scoped row carries `pet_id`; finance rows also carry `user_id`
  (queries filter on the authenticated user).
- `weight_logs` insert updates `pets.weight` to the latest measurement.
- Deleting a pet does not cascade in the DB layer — treat pet deletion as
  soft-destructive and confirm in the UI.
- Timestamps are naive UTC (`datetime.utcnow`); format to local time in the UI.
