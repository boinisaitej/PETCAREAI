"use client";
import { useCallback, useEffect, useState } from "react";
import { timelineApi, weightApi } from "@/lib/api";
import PetPicker from "@/components/PetPicker";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";

// Chart tokens (validated palette): single blue series, hairline grid, muted ink
const SERIES = "#2a78d6";
const GRID = "#e1e0d9";
const MUTED = "#898781";

const TYPE_STYLE: Record<string, string> = {
  vaccination: "bg-blue-50 border-blue-200",
  medication: "bg-purple-50 border-purple-200",
  appointment: "bg-green-50 border-green-200",
  record: "bg-gray-50 border-gray-200",
  symptom: "bg-orange-50 border-orange-200",
  weight: "bg-teal-50 border-teal-200",
};

export default function TimelinePage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [events, setEvents] = useState<any[]>([]);
  const [weights, setWeights] = useState<any[]>([]);
  const [filter, setFilter] = useState("all");
  const [newWeight, setNewWeight] = useState("");
  const [saving, setSaving] = useState(false);

  const reload = useCallback(() => {
    if (!selectedPet) return;
    timelineApi.get(selectedPet).then((r) => setEvents(r.data.events));
    weightApi.history(selectedPet).then((r) => setWeights(r.data));
  }, [selectedPet]);

  useEffect(reload, [reload]);

  const logWeight = async () => {
    if (!selectedPet || !newWeight) return;
    setSaving(true);
    try {
      await weightApi.log(selectedPet, parseFloat(newWeight));
      setNewWeight("");
      reload();
    } catch { /* validation errors surface via reload staying unchanged */ }
    setSaving(false);
  };

  const chartData = weights.map((w) => ({
    date: new Date(w.logged_at).toLocaleDateString("en", { month: "short", day: "numeric" }),
    weight: w.weight_kg,
  }));

  const types = ["all", ...Array.from(new Set(events.map((e) => e.type)))];
  const visible = filter === "all" ? events : events.filter((e) => e.type === filter);

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📈 Timeline & Growth</h1>
      <p className="text-gray-500 mb-6">Weight curve and every health event in one place</p>

      <PetPicker selected={selectedPet} onSelect={(id) => setSelectedPet(id)} />

      {/* Growth chart */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 className="font-semibold text-gray-800 text-sm">Weight (kg)</h2>
          <div className="flex gap-2">
            <input type="number" min="0" step="0.1" value={newWeight} onChange={(e) => setNewWeight(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && logWeight()}
              placeholder="kg"
              className="w-24 border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            <button onClick={logWeight} disabled={saving || !newWeight}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-1.5 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {saving ? "..." : "Log weight"}
            </button>
          </div>
        </div>
        {chartData.length >= 2 ? (
          <ResponsiveContainer width="100%" height={240}>
            <LineChart data={chartData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
              <CartesianGrid stroke={GRID} vertical={false} />
              <XAxis dataKey="date" tick={{ fill: MUTED, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
              <YAxis tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} width={40}
                domain={["auto", "auto"]} />
              <Tooltip formatter={(v: any) => [`${v} kg`, "Weight"]} />
              <Line type="monotone" dataKey="weight" stroke={SERIES} strokeWidth={2}
                dot={{ r: 4, fill: SERIES, strokeWidth: 0 }} activeDot={{ r: 5 }} />
            </LineChart>
          </ResponsiveContainer>
        ) : (
          <p className="text-sm text-gray-400 text-center py-10">
            {chartData.length === 1
              ? "One measurement logged — add another to see the growth curve."
              : "No weight entries yet. Log the first one above — regular weigh-ins catch problems early."}
          </p>
        )}
      </div>

      {/* Timeline */}
      <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100">
        <div className="flex items-center justify-between gap-2 flex-wrap mb-4">
          <h2 className="font-semibold text-gray-800 text-sm">Health timeline</h2>
          <div className="flex gap-1.5 flex-wrap">
            {types.map((t) => (
              <button key={t} onClick={() => setFilter(t)}
                className={`text-xs rounded-full px-3 py-1 capitalize border transition ${
                  filter === t ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-500 border-gray-200 hover:bg-gray-100"
                }`}>
                {t}
              </button>
            ))}
          </div>
        </div>

        {visible.length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-8">
            No events yet — vaccinations, medications, appointments, symptoms and weigh-ins will appear here.
          </p>
        ) : (
          <div className="relative pl-6">
            {/* vertical rail */}
            <div className="absolute left-2 top-2 bottom-2 w-px bg-gray-200" />
            <div className="space-y-3">
              {visible.map((e, i) => (
                <div key={i} className="relative">
                  <span className="absolute -left-6 top-3 w-4 h-4 rounded-full bg-white border-2 border-gray-300 flex items-center justify-center" />
                  <div className={`rounded-xl border p-4 ${TYPE_STYLE[e.type] || "bg-gray-50 border-gray-200"}`}>
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-gray-800">{e.icon} {e.title}</p>
                      <span className="text-xs text-gray-400">
                        {e.date ? new Date(e.date).toLocaleDateString("en", { year: "numeric", month: "short", day: "numeric" }) : ""}
                      </span>
                    </div>
                    {e.detail && <p className="text-xs text-gray-500 mt-1">{e.detail}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
