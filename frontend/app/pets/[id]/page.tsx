"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { petsApi, medicalApi, logsApi, aiApi } from "@/lib/api";

const tabs = ["Overview", "Vaccinations", "Medications", "Appointments", "AI Insights", "Health Scan"];

export default function PetDetailPage() {
  const { id } = useParams();
  const petId = Number(id);
  const [pet, setPet] = useState<any>(null);
  const [activeTab, setActiveTab] = useState("Overview");
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [medications, setMedications] = useState<any[]>([]);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [aiRec, setAiRec] = useState("");
  const [scanResult, setScanResult] = useState<any>(null);
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(true);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      const [petRes, vacRes, medRes, apptRes] = await Promise.all([
        petsApi.get(petId),
        medicalApi.getVaccinations(petId),
        medicalApi.getMedications(petId),
        medicalApi.getAppointments(petId),
      ]);
      setPet(petRes.data);
      setVaccinations(vacRes.data);
      setMedications(medRes.data);
      setAppointments(apptRes.data);
      setLoading(false);
    };
    load();
  }, [petId]);

  const loadAiRec = async () => {
    setAiLoading(true);
    const res = await petsApi.aiRecommendations(petId);
    setAiRec(res.data.recommendations);
    setAiLoading(false);
  };

  const handleScan = async () => {
    if (!scanFile) return;
    setAiLoading(true);
    const res = await aiApi.photoScan(petId, scanFile);
    setScanResult(res.data);
    setAiLoading(false);
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-4xl animate-bounce">🐾</div>
    </div>
  );

  return (
    <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
            <div className="flex items-center gap-5">
              <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center text-4xl">
                {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}
              </div>
              <div>
                <h1 className="text-2xl font-bold text-gray-800">{pet.name}</h1>
                <p className="text-gray-500">{pet.breed} · {pet.species} · {pet.age} years · {pet.weight} kg</p>
                <div className="flex gap-2 mt-2">
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full capitalize">{pet.activity_level} activity</span>
                  {pet.is_lost && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Lost</span>}
                </div>
              </div>
            </div>
            {pet.allergies && <p className="mt-3 text-sm text-orange-600 bg-orange-50 rounded-lg px-4 py-2">⚠️ Allergies: {pet.allergies}</p>}
          </div>

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t} onClick={() => { setActiveTab(t); if (t === "AI Insights" && !aiRec) loadAiRec(); }}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === t ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Tab Content */}
          {activeTab === "Overview" && (
            <div className="grid grid-cols-2 gap-4">
              {[
                ["Species", pet.species], ["Breed", pet.breed], ["Age", `${pet.age} years`], ["Weight", `${pet.weight} kg`],
                ["Gender", pet.gender || "Unknown"], ["Activity Level", pet.activity_level], ["Diet", pet.diet_preferences || "Standard"], ["Microchip", pet.microchip_id || "Not registered"],
              ].map(([k, v]) => (
                <div key={k} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                  <p className="text-xs text-gray-400 mb-1">{k}</p>
                  <p className="font-medium text-gray-800 capitalize">{v || "—"}</p>
                </div>
              ))}
            </div>
          )}

          {activeTab === "Vaccinations" && (
            <div className="space-y-3">
              {vaccinations.length === 0 ? <EmptyState icon="💉" text="No vaccinations recorded" /> :
                vaccinations.map((v) => (
                  <div key={v.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                      <p className="font-medium text-gray-800">{v.vaccine_name}</p>
                      <p className="text-sm text-gray-500">Given: {new Date(v.administered_date).toLocaleDateString()}</p>
                    </div>
                    {v.next_due_date && <span className="text-xs bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full">Due: {new Date(v.next_due_date).toLocaleDateString()}</span>}
                  </div>
                ))}
            </div>
          )}

          {activeTab === "Medications" && (
            <div className="space-y-3">
              {medications.length === 0 ? <EmptyState icon="💊" text="No active medications" /> :
                medications.map((m) => (
                  <div key={m.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between">
                      <p className="font-medium text-gray-800">{m.name}</p>
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full">{m.frequency}</span>
                    </div>
                    <p className="text-sm text-gray-500 mt-1">Dosage: {m.dosage}</p>
                    {m.notes && <p className="text-xs text-gray-400 mt-1">{m.notes}</p>}
                  </div>
                ))}
            </div>
          )}

          {activeTab === "Appointments" && (
            <div className="space-y-3">
              {appointments.length === 0 ? <EmptyState icon="📅" text="No appointments" /> :
                appointments.map((a) => (
                  <div key={a.id} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="font-medium text-gray-800">{a.title}</p>
                        <p className="text-sm text-gray-500">{new Date(a.scheduled_at).toLocaleString()}</p>
                        {a.diagnosis && <p className="text-sm text-blue-600 mt-1">Diagnosis: {a.diagnosis}</p>}
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${a.status === "completed" ? "bg-green-100 text-green-700" : a.status === "cancelled" ? "bg-red-100 text-red-600" : "bg-yellow-100 text-yellow-700"}`}>
                        {a.status}
                      </span>
                    </div>
                  </div>
                ))}
            </div>
          )}

          {activeTab === "AI Insights" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">🤖 AI Health Recommendations</h3>
              {aiLoading ? <p className="text-gray-400">Analyzing with Gemini AI...</p> :
                aiRec ? <div className="text-gray-700 text-sm whitespace-pre-wrap leading-relaxed">{aiRec}</div> :
                  <button onClick={loadAiRec} className="bg-green-600 text-white px-4 py-2 rounded-lg text-sm">Get AI Recommendations</button>}
            </div>
          )}

          {activeTab === "Health Scan" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-semibold text-gray-800 mb-4">📸 AI Photo Health Scanner</h3>
              <p className="text-sm text-gray-500 mb-4">Upload a clear photo of your pet to get an AI health assessment.</p>
              <input type="file" accept="image/*" onChange={(e) => setScanFile(e.target.files?.[0] || null)}
                className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100 mb-4" />
              <button onClick={handleScan} disabled={!scanFile || aiLoading}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {aiLoading ? "Scanning..." : "Scan Photo"}
              </button>
              {scanResult && (
                <div className="mt-6 space-y-3">
                  <div className="flex items-center gap-3">
                    <span className="text-2xl font-bold text-green-600">{scanResult.health_score}/10</span>
                    <span className="text-gray-600">Health Score</span>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap">{scanResult.raw}</div>
                  {scanResult.concerns !== "None" && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-sm text-yellow-800">
                      ⚠️ Concerns: {scanResult.concerns}
                    </div>
                  )}
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    💡 {scanResult.recommendation}
                  </div>
                </div>
              )}
            </div>
          )}
    </div>
  );
}

function EmptyState({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="text-center py-10 bg-white rounded-xl border border-gray-100">
      <div className="text-4xl mb-2">{icon}</div>
      <p className="text-gray-400 text-sm">{text}</p>
    </div>
  );
}
