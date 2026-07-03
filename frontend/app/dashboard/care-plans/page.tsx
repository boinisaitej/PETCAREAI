"use client";
import { useState } from "react";
import { careApi } from "@/lib/api";
import PetPicker from "@/components/PetPicker";

const PLAN_TYPES = [
  { key: "deworming",       label: "Deworming",        icon: "🪱", desc: "Species & weight specific schedule" },
  { key: "tick_prevention", label: "Tick & Flea",      icon: "🕷️", desc: "Prevention meds & inspection routine" },
  { key: "grooming",        label: "Grooming",         icon: "✂️", desc: "Bath, brush, nails, teeth, ears" },
  { key: "exercise",        label: "Exercise",         icon: "🏃", desc: "Breed-based activity & games" },
  { key: "feeding",         label: "Meal Plan",        icon: "🍽️", desc: "Personalized portions & foods" },
  { key: "senior_care",     label: "Senior Care",      icon: "👴", desc: "Joints, vision, dental, screening" },
  { key: "pregnancy",       label: "Pregnancy",        icon: "🤰", desc: "Timeline, nutrition, birth prep" },
  { key: "travel",          label: "Travel",           icon: "✈️", desc: "Documents, packing, restrictions" },
  { key: "vet_visit",       label: "Vet Visit Prep",   icon: "🩺", desc: "Questions, history & med list" },
];

type Mode = "plans" | "behavior" | "onboarding";

export default function CarePlansPage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [petName, setPetName] = useState("");
  const [mode, setMode] = useState<Mode>("plans");
  const [loading, setLoading] = useState(false);
  const [activePlan, setActivePlan] = useState<string | null>(null);
  const [result, setResult] = useState<{ title: string; body: string } | null>(null);
  const [error, setError] = useState("");

  // Behavior trainer
  const [problem, setProblem] = useState("");
  // Onboarding
  const [history, setHistory] = useState("");
  const [symptoms, setSymptoms] = useState("");
  const [vaccKnown, setVaccKnown] = useState(false);

  const run = async (fn: () => Promise<{ title: string; body: string }>, planKey?: string) => {
    if (!selectedPet) return;
    setLoading(true);
    setError("");
    setResult(null);
    setActivePlan(planKey || null);
    try {
      setResult(await fn());
    } catch (e: any) {
      setError(e.response?.data?.detail || "Generation failed. Please try again.");
    }
    setLoading(false);
    setActivePlan(null);
  };

  const generatePlan = (p: (typeof PLAN_TYPES)[number]) =>
    run(async () => {
      const res = await careApi.carePlan(selectedPet!, p.key);
      return { title: `${p.icon} ${p.label} plan for ${res.data.pet_name}`, body: res.data.plan };
    }, p.key);

  const generateBehavior = () =>
    run(async () => {
      const res = await careApi.behaviorPlan(selectedPet!, problem);
      return { title: `🎓 Training plan: ${problem}`, body: res.data.plan };
    });

  const generateOnboarding = () =>
    run(async () => {
      const res = await careApi.onboardingRoadmap(selectedPet!, history, symptoms, vaccKnown);
      return { title: `🏡 Adoption care roadmap for ${res.data.pet_name}`, body: res.data.roadmap };
    });

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🗓️ AI Care Plans</h1>
      <p className="text-gray-500 mb-6">Personalized plans built from your pet&apos;s breed, age, weight and activity</p>

      <PetPicker selected={selectedPet} onSelect={(id, p) => { setSelectedPet(id); setPetName(p.name); }} />

      {/* Mode tabs */}
      <div className="flex gap-2 mb-6 overflow-x-auto">
        {([
          ["plans", "📋 Care Plans"],
          ["behavior", "🎓 Behavior Trainer"],
          ["onboarding", "🏡 New Pet Onboarding"],
        ] as [Mode, string][]).map(([m, label]) => (
          <button key={m} onClick={() => { setMode(m); setResult(null); setError(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${
              mode === m ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}>
            {label}
          </button>
        ))}
      </div>

      {mode === "plans" && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-6">
          {PLAN_TYPES.map((p) => (
            <button key={p.key} onClick={() => generatePlan(p)} disabled={loading || !selectedPet}
              className={`bg-white rounded-xl p-4 shadow-sm border text-left transition hover:shadow-md hover:border-green-300 disabled:opacity-50 ${
                activePlan === p.key ? "border-green-500 ring-2 ring-green-200" : "border-gray-100"
              }`}>
              <div className="text-2xl mb-2">{activePlan === p.key && loading ? "⏳" : p.icon}</div>
              <p className="text-sm font-semibold text-gray-800">{p.label}</p>
              <p className="text-xs text-gray-400 mt-0.5">{p.desc}</p>
            </button>
          ))}
        </div>
      )}

      {mode === "behavior" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-800 mb-3">What behavior needs work?</h2>
          <div className="flex flex-wrap gap-2 mb-4">
            {["Jumping on people", "Biting / nipping", "Scratching furniture", "Destructive chewing", "Aggression toward other pets", "Excessive barking", "Separation anxiety"].map((p) => (
              <button key={p} onClick={() => setProblem(p)}
                className={`text-xs rounded-full px-3 py-1.5 border transition ${
                  problem === p ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                }`}>
                {p}
              </button>
            ))}
          </div>
          <textarea value={problem} onChange={(e) => setProblem(e.target.value)} rows={2}
            placeholder="Describe the behavior problem in your own words..."
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none mb-4" />
          <button onClick={generateBehavior} disabled={loading || !problem.trim() || !selectedPet}
            className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
            {loading ? "Creating training plan..." : "Create Training Plan"}
          </button>
        </div>
      )}

      {mode === "onboarding" && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <h2 className="font-semibold text-gray-800 mb-1">Just adopted {petName || "a pet"}? 🎉</h2>
          <p className="text-xs text-gray-400 mb-4">
            AI builds a complete care roadmap — first-week priorities, vaccination recovery for unknown history, deworming, and vet checklist.
          </p>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Known history (optional)</label>
              <textarea value={history} onChange={(e) => setHistory(e.target.value)} rows={2}
                placeholder="e.g. 'Rescued from shelter, approx 2 years old, was underweight'"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Visible symptoms or concerns (optional)</label>
              <input value={symptoms} onChange={(e) => setSymptoms(e.target.value)}
                placeholder="e.g. 'scratching a lot, dull coat'"
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input type="checkbox" checked={vaccKnown} onChange={(e) => setVaccKnown(e.target.checked)}
                className="w-4 h-4 rounded text-green-600 focus:ring-green-500" />
              I have the vaccination records
            </label>
            <button onClick={generateOnboarding} disabled={loading || !selectedPet}
              className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
              {loading ? "Building roadmap..." : "Build Care Roadmap"}
            </button>
          </div>
        </div>
      )}

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>}

      {result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4 gap-2 flex-wrap">
            <h2 className="font-semibold text-gray-800">{result.title}</h2>
            <button onClick={() => navigator.clipboard.writeText(result.body)}
              className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition">
              📋 Copy
            </button>
          </div>
          <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{result.body}</div>
        </div>
      )}
    </div>
  );
}
