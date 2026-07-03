import google.generativeai as genai
import os
from PIL import Image
import io
import base64
from dotenv import load_dotenv

load_dotenv()

genai.configure(api_key=os.getenv("GEMINI_API_KEY"))

# gemini-1.5-* is retired; the -latest alias tracks the current stable flash model.
_MODEL_NAME = os.getenv("GEMINI_MODEL", "gemini-flash-latest")
_text_model = genai.GenerativeModel(_MODEL_NAME)
_vision_model = genai.GenerativeModel(_MODEL_NAME)


def _safe_generate(model, prompt, image=None) -> str:
    try:
        if image:
            response = model.generate_content([prompt, image])
        else:
            response = model.generate_content(prompt)
        return response.text.strip()
    except Exception as e:
        err = str(e)
        if "API_KEY_INVALID" in err or "API key not valid" in err:
            return "⚠️ Gemini API key is not configured. Please add a valid GEMINI_API_KEY to backend/.env and restart the server."
        if "quota" in err.lower():
            return "⚠️ Gemini API quota exceeded. Please check your Google AI Studio usage limits."
        return f"AI analysis unavailable: {err[:120]}"


def get_breed_recommendations(species: str, breed: str, age: float, weight: float, activity_level: str) -> str:
    prompt = f"""You are a veterinary AI assistant. Provide breed-specific health recommendations.
Pet: {species}, Breed: {breed}, Age: {age} years, Weight: {weight}kg, Activity: {activity_level}
Give 3-5 specific, actionable health recommendations. Include age-related risks if applicable.
Format as bullet points. Be concise."""
    return _safe_generate(_text_model, prompt)


def analyze_feeding(pet_name: str, breed: str, weight: float, weekly_calories: float, recommended_calories: float) -> str:
    diff_pct = round(((weekly_calories - recommended_calories) / recommended_calories) * 100, 1)
    prompt = f"""Veterinary nutrition analysis for {pet_name} ({breed}, {weight}kg):
Weekly calories consumed: {weekly_calories} kcal
Recommended weekly calories: {recommended_calories} kcal
Difference: {diff_pct}%
Provide a brief nutritional assessment and 2-3 specific feeding recommendations."""
    return _safe_generate(_text_model, prompt)


def analyze_activity(pet_name: str, breed: str, age: float, weekly_minutes: float, target_minutes: float) -> str:
    prompt = f"""Activity analysis for {pet_name} ({breed}, {age} years old):
Weekly activity: {weekly_minutes} minutes, Target: {target_minutes} minutes.
Assess activity level and provide 2-3 recommendations including obesity risk if applicable."""
    return _safe_generate(_text_model, prompt)


def symptom_checker(pet_name: str, species: str, breed: str, age: float, symptoms: str) -> dict:
    prompt = f"""You are a veterinary AI. Analyze symptoms for {pet_name} ({species}, {breed}, {age} years).
Symptoms reported: {symptoms}

Respond in this exact format:
POSSIBLE_CAUSES: [list causes separated by semicolons]
SEVERITY: [Low/Moderate/High/Emergency]
RECOMMENDATION: [specific action to take]
EMERGENCY: [Yes/No]
DISCLAIMER: Always consult a licensed veterinarian for diagnosis."""
    result = _safe_generate(_text_model, prompt)
    parsed = {"raw": result, "severity": "Moderate", "emergency": False, "recommendation": "Consult your vet."}
    for line in result.split("\n"):
        if line.startswith("SEVERITY:"):
            parsed["severity"] = line.replace("SEVERITY:", "").strip()
        elif line.startswith("EMERGENCY:"):
            parsed["emergency"] = "yes" in line.lower()
        elif line.startswith("RECOMMENDATION:"):
            parsed["recommendation"] = line.replace("RECOMMENDATION:", "").strip()
    return parsed


def analyze_health_photo(image_bytes: bytes, pet_name: str, species: str) -> dict:
    try:
        img = Image.open(io.BytesIO(image_bytes))
        prompt = f"""You are a veterinary vision AI. Analyze this photo of {pet_name} ({species}).
Check for visible health indicators:
- Eye condition (redness, discharge, clarity)
- Coat/skin condition (patches, inflammation, dryness)
- Body condition score (underweight/healthy/overweight)
- Ear condition if visible
- Any visible wounds or abnormalities

Respond in this format:
HEALTH_SCORE: [1-10]
OBSERVATIONS: [key observations separated by semicolons]
CONCERNS: [any concerns, or None]
RECOMMENDATION: [action to take]"""
        result = _safe_generate(_vision_model, prompt, img)
        parsed = {"raw": result, "health_score": 7, "concerns": "None", "recommendation": "Consult vet if concerns persist."}
        for line in result.split("\n"):
            if line.startswith("HEALTH_SCORE:"):
                try:
                    parsed["health_score"] = int(line.replace("HEALTH_SCORE:", "").strip())
                except:
                    pass
            elif line.startswith("CONCERNS:"):
                parsed["concerns"] = line.replace("CONCERNS:", "").strip()
            elif line.startswith("RECOMMENDATION:"):
                parsed["recommendation"] = line.replace("RECOMMENDATION:", "").strip()
        return parsed
    except Exception as e:
        return {"error": str(e), "health_score": 0, "recommendation": "Unable to analyze photo."}


def pet_chat_assistant(question: str, pet_context: dict) -> str:
    prompt = f"""You are an expert veterinary AI assistant for a pet care app.
Pet context: {pet_context}
Owner's question: {question}
Answer helpfully and accurately. If it's a medical emergency, advise seeing a vet immediately.
Keep response under 150 words. Never replace professional veterinary advice."""
    return _safe_generate(_text_model, prompt)


def generate_health_report(pet: dict, feeding_summary: dict, activity_summary: dict, health_logs: list, vaccinations: list) -> str:
    prompt = f"""Generate a monthly pet health report for {pet.get('name')} ({pet.get('breed')}).
Feeding: {feeding_summary}
Activity: {activity_summary}
Recent health logs: {health_logs[-5:] if health_logs else []}
Vaccinations: {vaccinations}

Provide:
1. Overall health score (1-10) with justification
2. Nutrition score (1-10)
3. Activity score (1-10)
4. Key observations (3 bullet points)
5. Recommendations for next month (3 bullet points)
Be concise and practical."""
    return _safe_generate(_text_model, prompt)


def interpret_pet_sound(sound_description: str, species: str, context: str) -> str:
    prompt = f"""Analyze this {species} vocalization/behavior:
Sound/behavior description: {sound_description}
Context: {context}
Estimate the emotional state (stress/hunger/excitement/pain/contentment) with brief explanation.
Note: This is experimental and not a medical diagnosis."""
    return _safe_generate(_text_model, prompt)


def predict_health_risks(pet: dict, health_history: list) -> str:
    prompt = f"""Predictive health risk analysis for {pet.get('name')} ({pet.get('species')}, {pet.get('breed')}, {pet.get('age')} years, {pet.get('weight')}kg):
Health history summary: {health_history[-10:] if health_history else []}
Identify top 3 health risks with probability (Low/Medium/High) and prevention tips.
Format as: RISK: [name] | LEVEL: [Low/Medium/High] | PREVENTION: [tip]"""
    return _safe_generate(_text_model, prompt)


def poison_lookup(substance: str, species: str, weight: float | None, amount: str) -> str:
    prompt = f"""You are a veterinary toxicology AI for a pet poison control center.
Substance ingested/exposed: {substance}
Species: {species}{f", Weight: {weight}kg" if weight else ""}
Amount/exposure: {amount or "unknown"}

Respond in this exact format:
TOXICITY: [Non-toxic/Mild/Moderate/Severe/Life-threatening]
WHY: [1-2 sentences on why it is or isn't dangerous for this species]
SYMPTOMS: [symptoms to watch for, separated by semicolons]
FIRST_AID: [immediate steps the owner should take at home]
VET_URGENCY: [None/Monitor at home/Call vet/Go to vet today/Emergency - go NOW]
NOTE: This is guidance only — when in doubt, call a vet or animal poison control immediately."""
    return _safe_generate(_text_model, prompt)


def food_safety_scan(image_bytes: bytes, species: str, breed: str, weight: float | None, allergies: str | None) -> str:
    img = Image.open(io.BytesIO(image_bytes))
    prompt = f"""You are a pet nutrition vision AI. Identify the food in this photo and assess it for a {species} ({breed or "mixed breed"}{f", {weight}kg" if weight else ""}).
Known allergies: {allergies or "none"}

Respond in this exact format:
FOOD: [what you see in the photo]
SAFE: [Yes/No/With caution]
SAFE_QUANTITY: [safe serving amount for this pet, or "None - do not feed"]
BENEFITS: [nutritional benefits if any, separated by semicolons]
RISKS: [risks if any, separated by semicolons]
CALORIES: [approximate kcal per typical serving]
VERDICT: [one-sentence recommendation]"""
    return _safe_generate(_vision_model, prompt, img)


def food_safety_text(food: str, species: str, breed: str, weight: float | None, allergies: str | None) -> str:
    prompt = f"""You are a pet nutrition AI. Assess this food for a {species} ({breed or "mixed breed"}{f", {weight}kg" if weight else ""}).
Food: {food}
Known allergies: {allergies or "none"}

Respond in this exact format:
FOOD: {food}
SAFE: [Yes/No/With caution]
SAFE_QUANTITY: [safe serving amount for this pet, or "None - do not feed"]
BENEFITS: [nutritional benefits if any, separated by semicolons]
RISKS: [risks if any, separated by semicolons]
CALORIES: [approximate kcal per typical serving]
VERDICT: [one-sentence recommendation]"""
    return _safe_generate(_text_model, prompt)


CARE_PLAN_PROMPTS = {
    "deworming": "Create a species- and weight-specific deworming plan: schedule by age/life stage, recommended dewormer types, dosing cadence, and signs of worm infestation to watch for.",
    "tick_prevention": "Create a tick & flea prevention plan: preventive medicine schedule, inspection routine, high-risk seasons/areas, and what to do if a tick is found.",
    "grooming": "Create a grooming plan covering bathing, haircuts, brushing, nail trimming, teeth brushing, and ear cleaning — with breed-appropriate frequency for each.",
    "exercise": "Create a breed-appropriate exercise plan: daily activity targets, outdoor walks, indoor games, and mental stimulation ideas. Account for age and weight.",
    "feeding": "Create a personalized meal plan: meals per day, portion sizes in grams, food types to prefer/avoid, treats budget, and daily water target. Account for breed, weight, age and activity level.",
    "senior_care": "Create a senior pet care plan: joint & arthritis care, vision and dental checks, diet adjustments, mobility aids, and recommended vet screening schedule.",
    "pregnancy": "Create a pregnancy care plan: week-by-week timeline, nutrition changes, vet visit schedule, birth preparation checklist, and warning signs requiring immediate vet care.",
    "travel": "Create a pet travel plan: required vaccines & documents, packing checklist, carrier/transport tips, feeding around travel time, and common travel restrictions.",
    "vet_visit": "Create a vet visit preparation sheet: questions to ask the vet, relevant history to mention, current symptoms summary, and current medication list to bring.",
}


def generate_care_plan(plan_type: str, pet: dict, extra_context: str = "") -> str:
    instruction = CARE_PLAN_PROMPTS.get(plan_type, "Create a general care plan.")
    prompt = f"""You are a veterinary care-planning AI.
Pet: {pet.get('name')} — {pet.get('species')}, {pet.get('breed') or 'mixed'}, {pet.get('age') or '?'} years, {pet.get('weight') or '?'}kg, activity: {pet.get('activity_level')}
Allergies: {pet.get('allergies') or 'none'}
{f"Additional context from owner: {extra_context}" if extra_context else ""}

{instruction}

Format with clear section headings and bullet points. Be specific and practical. Keep under 350 words."""
    return _safe_generate(_text_model, prompt)


def behavior_training_plan(pet: dict, problem: str) -> str:
    prompt = f"""You are a certified pet behaviorist AI.
Pet: {pet.get('name')} — {pet.get('species')}, {pet.get('breed') or 'mixed'}, {pet.get('age') or '?'} years
Behavior problem: {problem}

Create a step-by-step training plan:
1. Likely cause of the behavior
2. Week-by-week training steps (4 weeks)
3. Do's and don'ts
4. When to consult a professional trainer/vet
Format with headings and bullets. Keep under 350 words."""
    return _safe_generate(_text_model, prompt)


def onboarding_roadmap(pet: dict, known_history: str, visible_symptoms: str, vaccination_known: bool) -> str:
    prompt = f"""You are a veterinary AI helping onboard a newly adopted pet with incomplete history.
Pet: {pet.get('name')} — {pet.get('species')}, {pet.get('breed') or 'mixed'}, approx {pet.get('age') or '?'} years, {pet.get('weight') or '?'}kg
Known history: {known_history or 'none'}
Visible symptoms/concerns: {visible_symptoms or 'none'}
Vaccination history known: {"Yes" if vaccination_known else "No — unknown"}

Create a complete care roadmap:
1. FIRST 7 DAYS — immediate priorities (vet check, settling in, diet)
2. VACCINATION RECOVERY PLAN — {"verify records and fill gaps" if vaccination_known else "restart schedule safely for unknown history: which core vaccines to give, booster timing"}
3. DEWORMING & PARASITE PLAN
4. RECOMMENDED TESTS for the first vet visit
5. FIRST 90 DAYS — checklist with rough timeline
Format with headings and bullets. Be specific to the species. Keep under 400 words."""
    return _safe_generate(_text_model, prompt)


def read_medical_document(image_bytes: bytes, doc_hint: str = "") -> str:
    img = Image.open(io.BytesIO(image_bytes))
    prompt = f"""You are a veterinary document AI. Read this medical document (vaccine card, prescription, lab/blood report, or invoice).
{f"Owner says it is: {doc_hint}" if doc_hint else ""}

1. DOCUMENT TYPE: what kind of document this is
2. KEY DATA: extract the important values/entries (medication names & dosages, vaccine names & dates, lab values with normal ranges, etc.)
3. PLAIN-ENGLISH EXPLANATION: explain what it means for the pet owner in simple terms
4. FLAGS: anything abnormal, out of range, expiring or due soon
5. QUESTIONS FOR THE VET: 2-3 questions the owner should ask
If the image is not a medical document, say so. Format with headings and bullets."""
    return _safe_generate(_vision_model, prompt, img)


def vaccine_info(vaccine_name: str, species: str) -> str:
    prompt = f"""You are a veterinary vaccine encyclopedia. Explain the "{vaccine_name}" vaccine for {species}.

Respond with these sections:
PURPOSE: what it protects against
DISEASE: brief description of the disease and how it spreads
SCHEDULE: typical age/booster schedule
SIDE EFFECTS: common and rare side effects
TYPICAL COST: rough cost range (USD and INR)
MISSED DOSE: what to do if a dose was missed
CONTRAINDICATIONS: when this vaccine should be delayed or avoided
Keep it factual and concise."""
    return _safe_generate(_text_model, prompt)


def medicine_info(medicine_name: str, species: str) -> str:
    prompt = f"""You are a veterinary medicine encyclopedia. Explain "{medicine_name}" for {species or "pets"}.

Respond with these sections:
PURPOSE: what it treats
DOSAGE_FORM: how it's given (tablet, liquid, topical...)
STORAGE: how to store it
WARNINGS: key warnings and common side effects
INTERACTIONS: notable drug/food interactions
PRESCRIPTION: whether a vet prescription is required
ALTERNATIVES: common alternatives a vet might consider
SAFETY NOTE: never dose without veterinary guidance.
Keep it factual and concise."""
    return _safe_generate(_text_model, prompt)


def smart_notification_message(pet_name: str, event_type: str, context: dict) -> str:
    prompt = f"""Create a smart, personalized notification for a pet owner.
Pet: {pet_name}, Event: {event_type}, Context: {context}
Write a natural, engaging notification message (max 20 words). Make it specific, not generic."""
    return _safe_generate(_text_model, prompt)
