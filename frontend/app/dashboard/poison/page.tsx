"use client";
import { useState } from "react";
import { careApi } from "@/lib/api";
import PetPicker from "@/components/PetPicker";

const COMMON_TOXINS = [
  "Chocolate", "Xylitol (sugar-free gum)", "Grapes / Raisins", "Onions / Garlic",
  "Lilies", "Ibuprofen", "Paracetamol", "Rat poison", "Antifreeze", "Bleach",
];

const toxicityStyle = (t: string) => {
  const v = (t || "").toLowerCase();
  if (v.includes("life") || v.includes("severe")) return "bg-red-100 text-red-800 border-red-300";
  if (v.includes("moderate")) return "bg-orange-100 text-orange-800 border-orange-300";
  if (v.includes("mild")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-green-100 text-green-800 border-green-300";
};

export default function PoisonCenterPage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [substance, setSubstance] = useState("");
  const [amount, setAmount] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");

  const check = async (sub?: string) => {
    const query = sub || substance;
    if (!query.trim()) return;
    if (sub) setSubstance(sub);
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = await careApi.poisonCheck(query, selectedPet ?? undefined, amount);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Lookup failed. Please try again.");
    }
    setLoading(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">☠️ Poison Center</h1>
      <p className="text-gray-500 mb-6">Check if a food, plant, medicine or chemical is dangerous for your pet</p>

      <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 text-sm text-red-800">
        🚨 <strong>If your pet is collapsing, seizing, or struggling to breathe — go to an emergency vet NOW.</strong> Don&apos;t wait for an AI answer.
      </div>

      <PetPicker selected={selectedPet} onSelect={(id) => setSelectedPet(id)} />

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">What did your pet ingest / touch?</label>
            <input value={substance} onChange={(e) => setSubstance(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && check()}
              placeholder="e.g. 'dark chocolate bar', 'lily plant leaves', 'ibuprofen 400mg'"
              className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">How much? (optional)</label>
            <input value={amount} onChange={(e) => setAmount(e.target.value)}
              placeholder="e.g. 'half a bar', '2 tablets', 'a few licks'"
              className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500" />
          </div>
          <button onClick={() => check()} disabled={loading || !substance.trim()}
            className="bg-red-600 hover:bg-red-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 w-full sm:w-auto">
            {loading ? "Checking toxicity..." : "Check Toxicity"}
          </button>
        </div>

        <div className="mt-5">
          <p className="text-xs text-gray-400 mb-2">Common toxins — tap to check:</p>
          <div className="flex flex-wrap gap-2">
            {COMMON_TOXINS.map((t) => (
              <button key={t} onClick={() => check(t)} disabled={loading}
                className="text-xs bg-gray-50 hover:bg-red-50 hover:text-red-700 text-gray-600 border border-gray-200 rounded-full px-3 py-1.5 transition disabled:opacity-50">
                {t}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>}

      {result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${toxicityStyle(result.toxicity || "")}`}>
              {result.toxicity || "Assessment"}
            </span>
            {result.vet_urgency && (
              <span className="px-4 py-1.5 rounded-full text-sm font-semibold bg-blue-100 text-blue-800 border border-blue-200">
                🏥 {result.vet_urgency}
              </span>
            )}
          </div>
          {result.why && <p className="text-sm text-gray-700">{result.why}</p>}
          {result.symptoms && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-yellow-700 uppercase mb-1">Watch for these symptoms</p>
              <p className="text-sm text-yellow-900">{result.symptoms}</p>
            </div>
          )}
          {result.first_aid && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-blue-700 uppercase mb-1">First aid</p>
              <p className="text-sm text-blue-900">{result.first_aid}</p>
            </div>
          )}
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">Full AI response</summary>
            <pre className="whitespace-pre-wrap mt-2 text-gray-600 font-sans">{result.raw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
