"use client";
import { useEffect, useState } from "react";
import { petsApi, logsApi } from "@/lib/api";

export default function HealthPage() {
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [form, setForm] = useState({ mood: "happy", appetite: "normal", sleep_hours: "", symptoms: "", stool_quality: "normal", notes: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    petsApi.list().then((r) => { setPets(r.data); if (r.data.length > 0) setSelectedPet(r.data[0].id); });
  }, []);

  useEffect(() => {
    if (selectedPet) logsApi.getHealth(selectedPet).then((r) => setLogs(r.data));
  }, [selectedPet]);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet) return;
    setLoading(true);
    await logsApi.logHealth({ ...form, pet_id: selectedPet, sleep_hours: parseFloat(form.sleep_hours) || null });
    setForm({ mood: "happy", appetite: "normal", sleep_hours: "", symptoms: "", stool_quality: "normal", notes: "" });
    const r = await logsApi.getHealth(selectedPet);
    setLogs(r.data);
    setLoading(false);
  };

  const moodEmoji: Record<string, string> = { happy: "😊", neutral: "😐", sad: "😢", anxious: "😰" };
  const appetiteColor: Record<string, string> = { normal: "text-green-600", low: "text-yellow-600", high: "text-blue-600", none: "text-red-600" };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📋 Health Journal</h1>
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
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Daily Health Log</h2>
          <form onSubmit={handleLog} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Mood</label>
              <div className="flex gap-2">
                {["happy", "neutral", "sad", "anxious"].map((m) => (
                  <button key={m} type="button" onClick={() => setForm({ ...form, mood: m })}
                    className={`flex-1 py-2 rounded-lg text-lg transition ${form.mood === m ? "bg-green-100 ring-2 ring-green-400" : "bg-gray-50 hover:bg-gray-100"}`}>
                    {moodEmoji[m]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Appetite</label>
              <select value={form.appetite} onChange={(e) => setForm({ ...form, appetite: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="normal">Normal</option>
                <option value="low">Low</option>
                <option value="high">High</option>
                <option value="none">None (Not eating)</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Sleep Hours</label>
              <input type="number" step="0.5" value={form.sleep_hours} onChange={(e) => setForm({ ...form, sleep_hours: e.target.value })}
                placeholder="e.g. 8"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Symptoms (if any)</label>
              <textarea value={form.symptoms} onChange={(e) => setForm({ ...form, symptoms: e.target.value })} rows={2}
                placeholder="e.g. Sneezing, limping, excessive scratching"
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
              <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any observations..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <button type="submit" disabled={loading || !selectedPet}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? "Saving..." : "Save Health Log"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Health Logs</h2>
          {logs.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm">No health logs yet</div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {logs.map((l) => (
                <div key={l.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xl">{moodEmoji[l.mood] || "😐"}</span>
                    <span className="text-xs text-gray-400">{new Date(l.logged_at).toLocaleDateString()}</span>
                  </div>
                  <div className="flex gap-3 text-xs">
                    <span className={`font-medium ${appetiteColor[l.appetite] || "text-gray-600"}`}>
                      Appetite: {l.appetite || "—"}
                    </span>
                    {l.sleep_hours && <span className="text-gray-500">Sleep: {l.sleep_hours}h</span>}
                  </div>
                  {l.symptoms && <p className="text-xs text-red-600 mt-1">⚠️ {l.symptoms}</p>}
                  {l.notes && <p className="text-xs text-gray-400 mt-1">{l.notes}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
