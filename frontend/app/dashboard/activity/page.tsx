"use client";
import { useEffect, useState } from "react";
import { petsApi, logsApi } from "@/lib/api";

export default function ActivityPage() {
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [analysis, setAnalysis] = useState<any>(null);
  const [form, setForm] = useState({ activity_type: "walk", duration_minutes: "", distance_km: "", calories_burned: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    petsApi.list().then((r) => { setPets(r.data); if (r.data.length > 0) setSelectedPet(r.data[0].id); });
  }, []);

  useEffect(() => {
    if (selectedPet) {
      logsApi.getActivity(selectedPet).then((r) => setLogs(r.data));
      logsApi.activityAnalysis(selectedPet).then((r) => setAnalysis(r.data)).catch(() => {});
    }
  }, [selectedPet]);

  const handleLog = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedPet) return;
    setLoading(true);
    await logsApi.logActivity({
      ...form, pet_id: selectedPet,
      duration_minutes: parseFloat(form.duration_minutes),
      distance_km: parseFloat(form.distance_km) || 0,
      calories_burned: parseFloat(form.calories_burned) || 0,
    });
    setForm({ activity_type: "walk", duration_minutes: "", distance_km: "", calories_burned: "" });
    const r = await logsApi.getActivity(selectedPet);
    setLogs(r.data);
    setLoading(false);
  };

  const activityIcons: Record<string, string> = { walk: "🚶", play: "🎾", swim: "🏊", run: "🏃", rest: "😴" };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">🏃 Activity Tracker</h1>
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
          <h2 className="font-semibold text-gray-800 mb-4">Log Activity</h2>
          <form onSubmit={handleLog} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Activity Type</label>
              <select value={form.activity_type} onChange={(e) => setForm({ ...form, activity_type: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                {["walk", "run", "play", "swim", "rest"].map((a) => <option key={a} value={a}>{activityIcons[a]} {a.charAt(0).toUpperCase() + a.slice(1)}</option>)}
              </select>
            </div>
            {[
              { label: "Duration (minutes)*", key: "duration_minutes", required: true },
              { label: "Distance (km)", key: "distance_km" },
              { label: "Calories Burned", key: "calories_burned" },
            ].map(({ label, key, required }) => (
              <div key={key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                <input type="number" step="0.1" required={required} value={(form as any)[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            ))}
            <button type="submit" disabled={loading || !selectedPet}
              className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? "Logging..." : "Log Activity"}
            </button>
          </form>
        </div>

        {analysis && (
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">🤖 Activity Analysis</h2>
            <div className="flex gap-4 mb-4">
              <div className="flex-1 bg-green-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-green-600">{analysis.weekly_minutes}m</p>
                <p className="text-xs text-green-500">This week</p>
              </div>
              <div className="flex-1 bg-blue-50 rounded-lg p-3 text-center">
                <p className="text-xl font-bold text-blue-600">{analysis.target_minutes}m</p>
                <p className="text-xs text-blue-500">Target</p>
              </div>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2 mb-4">
              <div className="bg-green-500 h-2 rounded-full transition-all"
                style={{ width: `${Math.min(100, (analysis.weekly_minutes / analysis.target_minutes) * 100)}%` }} />
            </div>
            <div className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed bg-gray-50 rounded-lg p-4">{analysis.analysis}</div>
          </div>
        )}
      </div>

      {logs.length > 0 && (
        <div className="mt-6 bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Recent Activities</h2>
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{activityIcons[l.activity_type] || "🐾"}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-700 capitalize">{l.activity_type}</p>
                    <p className="text-xs text-gray-400">{new Date(l.logged_at).toLocaleString()}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-semibold text-gray-800">{l.duration_minutes} min</p>
                  {l.distance_km > 0 && <p className="text-xs text-gray-500">{l.distance_km} km</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
