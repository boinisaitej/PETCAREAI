"use client";
import { useState } from "react";
import { timelineApi } from "@/lib/api";
import PetPicker, { speciesEmoji } from "@/components/PetPicker";

export default function EmergencyPage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [summary, setSummary] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const generate = async () => {
    if (!selectedPet) return;
    setLoading(true);
    setError("");
    try {
      const res = await timelineApi.emergencySummary(selectedPet);
      setSummary(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to build emergency summary");
    }
    setLoading(false);
  };

  const openNearbyVets = () => {
    const query = encodeURIComponent("emergency veterinary clinic near me");
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => window.open(`https://www.google.com/maps/search/${query}/@${pos.coords.latitude},${pos.coords.longitude},13z`, "_blank"),
        () => window.open(`https://www.google.com/maps/search/${query}`, "_blank")
      );
    } else {
      window.open(`https://www.google.com/maps/search/${query}`, "_blank");
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🆘 Emergency Mode</h1>
      <p className="text-gray-500 mb-6">One tap: medical summary for the vet + nearest clinics</p>

      <div className="print:hidden">
        <PetPicker selected={selectedPet} onSelect={(id) => setSelectedPet(id)} />

        <div className="grid sm:grid-cols-2 gap-3 mb-6">
          <button onClick={generate} disabled={loading || !selectedPet}
            className="bg-red-600 hover:bg-red-700 text-white rounded-xl p-5 text-left transition disabled:opacity-50 shadow-sm">
            <div className="text-3xl mb-2">{loading ? "⏳" : "🚨"}</div>
            <p className="font-bold">{loading ? "Building summary..." : "Generate Emergency Card"}</p>
            <p className="text-sm text-red-100 mt-0.5">Everything a vet needs in 60 seconds</p>
          </button>
          <button onClick={openNearbyVets}
            className="bg-blue-600 hover:bg-blue-700 text-white rounded-xl p-5 text-left transition shadow-sm">
            <div className="text-3xl mb-2">📍</div>
            <p className="font-bold">Find Nearest Emergency Vet</p>
            <p className="text-sm text-blue-100 mt-0.5">Opens Google Maps with clinics near you</p>
          </button>
        </div>

        {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>}
      </div>

      {summary && (
        <div className="bg-white rounded-xl shadow-sm border-2 border-red-200 overflow-hidden">
          <div className="bg-red-600 text-white px-6 py-4 flex items-center justify-between gap-2 flex-wrap">
            <div>
              <p className="text-xs uppercase tracking-wide text-red-100">Emergency Medical Card</p>
              <h2 className="text-lg font-bold">
                {speciesEmoji(summary.pet.species)} {summary.pet.name}
              </h2>
            </div>
            <button onClick={() => window.print()}
              className="print:hidden bg-white/20 hover:bg-white/30 rounded-lg px-4 py-2 text-sm font-medium transition">
              🖨️ Print / Save PDF
            </button>
          </div>

          <div className="p-6 space-y-5">
            {/* Vitals */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-sm">
              <div><p className="text-xs text-gray-400">Species / Breed</p><p className="font-medium text-gray-800 capitalize">{summary.pet.species} · {summary.pet.breed || "mixed"}</p></div>
              <div><p className="text-xs text-gray-400">Age</p><p className="font-medium text-gray-800">{summary.pet.age ?? "?"} years</p></div>
              <div><p className="text-xs text-gray-400">Weight</p><p className="font-medium text-gray-800">{summary.pet.weight ?? "?"} kg</p></div>
              <div><p className="text-xs text-gray-400">Microchip</p><p className="font-medium text-gray-800">{summary.pet.microchip_id || "—"}</p></div>
            </div>

            {/* Allergies — most critical */}
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <p className="text-xs font-bold text-red-700 uppercase mb-1">⚠️ Allergies</p>
              <p className="text-sm text-red-900 font-medium">{summary.allergies}</p>
            </div>

            {/* Active medications */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">💊 Current medications</p>
              {summary.active_medications.length === 0 ? (
                <p className="text-sm text-gray-400">None</p>
              ) : (
                <div className="space-y-1.5">
                  {summary.active_medications.map((m: any, i: number) => (
                    <p key={i} className="text-sm text-gray-800 bg-purple-50 border border-purple-100 rounded-lg px-3 py-2">
                      <span className="font-semibold">{m.name}</span> — {m.dosage}, {m.frequency}
                    </p>
                  ))}
                </div>
              )}
            </div>

            {/* Recent symptoms */}
            {summary.recent_symptoms.length > 0 && (
              <div>
                <p className="text-xs font-bold text-gray-500 uppercase mb-2">🤒 Recent symptoms</p>
                <div className="space-y-1.5">
                  {summary.recent_symptoms.map((s: any, i: number) => (
                    <p key={i} className="text-sm text-gray-700 bg-orange-50 border border-orange-100 rounded-lg px-3 py-2">
                      {s.symptoms} <span className="text-xs text-gray-400">({s.date ? new Date(s.date).toLocaleDateString() : ""})</span>
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Vaccinations */}
            <div>
              <p className="text-xs font-bold text-gray-500 uppercase mb-2">💉 Vaccination history</p>
              {summary.vaccinations.length === 0 ? (
                <p className="text-sm text-gray-400">No records</p>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {summary.vaccinations.map((v: any, i: number) => (
                    <span key={i} className="text-xs bg-blue-50 border border-blue-100 text-blue-800 rounded-full px-3 py-1">
                      {v.name} · {v.date ? new Date(v.date).toLocaleDateString() : "?"}
                    </span>
                  ))}
                </div>
              )}
            </div>

            {/* Owner contact */}
            {summary.owner && (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                <p className="text-xs font-bold text-gray-500 uppercase mb-1">👤 Owner contact</p>
                <p className="text-sm text-gray-800 font-medium">{summary.owner.name}</p>
                <p className="text-sm text-gray-600">
                  {summary.owner.phone && <a href={`tel:${summary.owner.phone}`} className="text-blue-600 hover:underline">{summary.owner.phone}</a>}
                  {summary.owner.phone && " · "}{summary.owner.email}
                </p>
              </div>
            )}

            <p className="text-xs text-gray-300">Generated {new Date(summary.generated_at).toLocaleString()}</p>
          </div>
        </div>
      )}
    </div>
  );
}
