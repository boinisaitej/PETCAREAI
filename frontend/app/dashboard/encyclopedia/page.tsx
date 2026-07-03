"use client";
import { useEffect, useState } from "react";
import { careApi } from "@/lib/api";
import { speciesEmoji } from "@/components/PetPicker";

export default function EncyclopediaPage() {
  const [tab, setTab] = useState<"vaccines" | "medicines">("vaccines");

  // Vaccination center
  const [speciesList, setSpeciesList] = useState<string[]>([]);
  const [species, setSpecies] = useState("dog");
  const [vaccines, setVaccines] = useState<any[]>([]);
  const [vacDetail, setVacDetail] = useState<{ name: string; info: string } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  // Medicine encyclopedia
  const [medQuery, setMedQuery] = useState("");
  const [medSpecies, setMedSpecies] = useState("");
  const [medResult, setMedResult] = useState<{ name: string; info: string } | null>(null);
  const [medLoading, setMedLoading] = useState(false);

  useEffect(() => {
    careApi.vaccineSpecies().then((r) => setSpeciesList(r.data.species));
  }, []);

  useEffect(() => {
    setVacDetail(null);
    careApi.vaccinesFor(species).then((r) => setVaccines(r.data.vaccines)).catch(() => setVaccines([]));
  }, [species]);

  const loadVaccineDetail = async (name: string) => {
    setDetailLoading(true);
    setVacDetail({ name, info: "" });
    try {
      const res = await careApi.vaccineInfo(name, species);
      setVacDetail({ name, info: res.data.info });
    } catch {
      setVacDetail({ name, info: "Failed to load details. Please try again." });
    }
    setDetailLoading(false);
  };

  const searchMedicine = async () => {
    if (!medQuery.trim()) return;
    setMedLoading(true);
    setMedResult(null);
    try {
      const res = await careApi.medicineInfo(medQuery, medSpecies);
      setMedResult({ name: medQuery, info: res.data.info });
    } catch {
      setMedResult({ name: medQuery, info: "Lookup failed. Please try again." });
    }
    setMedLoading(false);
  };

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">📚 Pet Health Encyclopedia</h1>
      <p className="text-gray-500 mb-6">Vaccines for every species and a veterinary medicine reference</p>

      <div className="flex gap-2 mb-6">
        <button onClick={() => setTab("vaccines")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "vaccines" ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
          💉 Vaccination Center
        </button>
        <button onClick={() => setTab("medicines")}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === "medicines" ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
          💊 Medicine Encyclopedia
        </button>
      </div>

      {tab === "vaccines" && (
        <>
          {/* Species picker */}
          <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-2">Species</label>
            <div className="flex gap-2 flex-wrap">
              {speciesList.map((s) => (
                <button key={s} onClick={() => setSpecies(s)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
                    species === s ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                  }`}>
                  {speciesEmoji(s)} {s}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-3 mb-6">
            {vaccines.map((v) => (
              <button key={v.name} onClick={() => v.schedule !== "—" && loadVaccineDetail(v.name)}
                className={`bg-white rounded-xl p-4 shadow-sm border border-gray-100 text-left transition ${
                  v.schedule !== "—" ? "hover:shadow-md hover:border-green-300 cursor-pointer" : "cursor-default"
                }`}>
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{v.name}</span>
                    {v.core && <span className="text-xs bg-green-100 text-green-700 rounded-full px-2 py-0.5 font-medium">Core</span>}
                  </div>
                  {v.schedule !== "—" && <span className="text-xs text-gray-400">{v.schedule}</span>}
                </div>
                <p className="text-sm text-gray-500 mt-1">{v.protects}</p>
                {v.schedule !== "—" && <p className="text-xs text-green-600 mt-2">Tap for full details — schedule, side effects, cost, missed doses →</p>}
              </button>
            ))}
          </div>

          {vacDetail && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">💉 {vacDetail.name} — full details</h2>
              {detailLoading ? (
                <p className="text-sm text-gray-400 animate-pulse">Loading vaccine details...</p>
              ) : (
                <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{vacDetail.info}</div>
              )}
            </div>
          )}
        </>
      )}

      {tab === "medicines" && (
        <>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <label className="block text-sm font-medium text-gray-700 mb-1">Medicine name</label>
            <div className="flex gap-2 flex-col sm:flex-row">
              <input value={medQuery} onChange={(e) => setMedQuery(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && searchMedicine()}
                placeholder="e.g. 'Apoquel', 'Metacam', 'Frontline Plus'"
                className="flex-1 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <input value={medSpecies} onChange={(e) => setMedSpecies(e.target.value)}
                placeholder="Species (optional)"
                className="sm:w-40 border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              <button onClick={searchMedicine} disabled={medLoading || !medQuery.trim()}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                {medLoading ? "Searching..." : "Search"}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-3">
              Get purpose, storage, warnings, interactions, prescription status and alternatives. Never dose without a vet.
            </p>
          </div>

          {medResult && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">💊 {medResult.name}</h2>
              <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{medResult.info}</div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
