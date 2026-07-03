"use client";
import { useEffect, useState } from "react";
import { petsApi, logsApi } from "@/lib/api";

export default function FeedingPage() {
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [form, setForm] = useState({ food_type: "", quantity_grams: "", water_ml: "", notes: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    petsApi.list().then((r) => { setPets(r.data); if (r.data.length > 0) setSelectedPet(r.data[0].id); });
  }, []);

  useEffect(() => {
    if (selectedPet) {
      logsApi.getFeeding(selectedPet).then((r) => setLogs(r.data));
      logsApi.feedingAnalysis(selectedPet).then((r) => setAnalysis(r.data)).catch(() => {});
    }
  }, [selectedPet]);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet) return;
    setLoading(true);
    await logsApi.logFeeding({ ...form, pet_id: selectedPet, quantity_grams: parseFloat(form.quantity_grams), water_ml: parseFloat(form.water_ml) || 0 });
    setForm({ food_type: "", quantity_grams: "", water_ml: "", notes: "" });
    const r = await logsApi.getFeeding(selectedPet);
    setLogs(r.data);
    setLoading(false);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">🍽️ Feeding Tracker</h1>
      {pets.length > 0 && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {pets.map((p) => (
            <button key={p.id} onClick={() => setSelectedPet(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedPet === p.id ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
              {p.name}
            </button>
          ))}
        </div>
      )}

      <div className="grid md:grid-cols-2 gap-6">
        {/* Log Form */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Log Feeding</h2>
          <form onSubmit={handleLog} className="space-y-3">
            {[
              { label: "Food Type*", key: "food_type", placeholder: "e.g. Dry kibble, Wet food", required: true },
              { label: "Quantity (grams)*", key: "quantity_grams", placeholder: "e.g. 200", required: true, type: "number" },
              { label: "Water (ml)", key: "water_ml", placeholder: "e.g. 250", type: "number" },
              { label: "Notes", key: "notes", placeholder: "Optional notes" },
            ].map(({ label, key, placeholder, required, type }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type={type || "text"} placeholder={placeholder} required={required}
                  value={(form as any)[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
            <button type="submit" disabled={loading || !selectedPet}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? "Logging..." : "Log Feeding"}
            </button>
          </form>
        </div>

        {/* AI Analysis */}
        {analysis && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">🤖 AI Nutrition Analysis</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{analysis.weekly_calories}</p>
                <p className="text-xs text-blue-500">Weekly kcal</p>
              </div>
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600">{analysis.recommended_calories}</p>
                <p className="text-xs text-green-500">Recommended</p>
              </div>
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4">{analysis.analysis}</div>
          </div>
        )}
      </div>

      {/* Recent Logs */}
      {logs.length > 0 && (
        <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Feeding Logs</h2>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div>
                  <p className="text-sm font-medium text-gray-700">{l.food_type}</p>
                  <p className="text-xs text-gray-400">{new Date(l.fed_at).toLocaleString()}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{l.quantity_grams}g</p>
                  {l.water_ml > 0 && <p className="text-xs text-blue-500">{l.water_ml}ml water</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
