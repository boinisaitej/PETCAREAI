"use client";
import { useEffect, useRef, useState } from "react";
import { petsApi, aiApi, careApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

const tabs = ["Symptom Checker", "Image Diagnosis", "AI Chat", "Monthly Report", "Sound Interpreter", "Document Reader"];

export default function AiPage() {
  const [pets, setPets] = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [activeTab, setActiveTab] = useState("Symptom Checker");
  const [loading, setLoading] = useState(false);

  // Symptom Checker
  const [symptoms, setSymptoms] = useState("");
  const [symptomResult, setSymptomResult] = useState<any>(null);

  // Chat
  const [messages, setMessages] = useState<{ role: "user" | "ai"; text: string }[]>([]);
  const [chatInput, setChatInput] = useState("");

  // Report
  const [report, setReport] = useState<any>(null);

  // Sound
  const [soundDesc, setSoundDesc] = useState("");
  const [soundContext, setSoundContext] = useState("");
  const [soundResult, setSoundResult] = useState("");

  // Image Diagnosis
  const [scanFile, setScanFile] = useState<File | null>(null);
  const [scanPreview, setScanPreview] = useState<string | null>(null);
  const [scanResult, setScanResult] = useState<any>(null);
  const scanInput = useRef<HTMLInputElement>(null);

  // Document Reader
  const [docFile, setDocFile] = useState<File | null>(null);
  const [docPreview, setDocPreview] = useState<string | null>(null);
  const [docHint, setDocHint] = useState("");
  const [docResult, setDocResult] = useState("");
  const docInput = useRef<HTMLInputElement>(null);

  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (user) petsApi.list().then((r) => { setPets(r.data); if (r.data.length > 0) setSelectedPet(r.data[0].id); });
  }, [user, isLoading]);

  const checkSymptoms = async () => {
    if (!selectedPet || !symptoms.trim()) return;
    setLoading(true);
    const res = await aiApi.symptomCheck(selectedPet, symptoms);
    setSymptomResult(res.data);
    setLoading(false);
  };

  const sendChat = async () => {
    if (!selectedPet || !chatInput.trim()) return;
    const q = chatInput;
    setChatInput("");
    setMessages((prev) => [...prev, { role: "user", text: q }]);
    setLoading(true);
    const res = await aiApi.chat(selectedPet, q);
    setMessages((prev) => [...prev, { role: "ai", text: res.data.answer }]);
    setLoading(false);
  };

  const loadReport = async () => {
    if (!selectedPet) return;
    setLoading(true);
    const res = await aiApi.monthlyReport(selectedPet);
    setReport(res.data);
    setLoading(false);
  };

  const interpretSound = async () => {
    if (!selectedPet || !soundDesc.trim()) return;
    setLoading(true);
    const res = await aiApi.interpretSound(selectedPet, soundDesc, soundContext);
    setSoundResult(res.data.interpretation);
    setLoading(false);
  };

  const runPhotoScan = async () => {
    if (!selectedPet || !scanFile) return;
    setLoading(true);
    setScanResult(null);
    try {
      const res = await aiApi.photoScan(selectedPet, scanFile);
      setScanResult(res.data);
    } catch {
      setScanResult({ raw: "Photo analysis failed. Please try again.", health_score: 0 });
    }
    setLoading(false);
  };

  const runDocReader = async () => {
    if (!docFile) return;
    setLoading(true);
    setDocResult("");
    try {
      const res = await careApi.documentReader(docFile, docHint);
      setDocResult(res.data.analysis);
    } catch {
      setDocResult("Document analysis failed. Please try again.");
    }
    setLoading(false);
  };

  const severityColor: Record<string, string> = {
    Low: "bg-green-100 text-green-800", Moderate: "bg-yellow-100 text-yellow-800",
    High: "bg-orange-100 text-orange-800", Emergency: "bg-red-100 text-red-800",
  };

  return (
    <div className="max-w-3xl mx-auto">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">🤖 AI Features</h1>
          <p className="text-gray-500 mb-6">Powered by Google Gemini AI</p>

          {/* Pet Selector */}
          {pets.length > 0 && (
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2">Select Pet</label>
              <div className="flex gap-2 flex-wrap">
                {pets.map((p) => (
                  <button key={p.id} onClick={() => setSelectedPet(p.id)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedPet === p.id ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"}`}>
                    {p.species === "dog" ? "🐕" : p.species === "cat" ? "🐈" : "🐾"} {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Tabs */}
          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button key={t} onClick={() => setActiveTab(t)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition ${activeTab === t ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
                {t}
              </button>
            ))}
          </div>

          {/* Symptom Checker */}
          {activeTab === "Symptom Checker" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">🩺 AI Symptom Checker</h2>
              <p className="text-xs text-gray-400 mb-4">Not a replacement for professional veterinary care.</p>
              <textarea value={symptoms} onChange={(e) => setSymptoms(e.target.value)} rows={3}
                placeholder="Describe symptoms... e.g. 'My dog is vomiting and not eating since yesterday'"
                className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-4 resize-none" />
              <button onClick={checkSymptoms} disabled={loading || !symptoms.trim() || !selectedPet}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Analyzing..." : "Check Symptoms"}
              </button>
              {symptomResult && (
                <div className="mt-6 space-y-4">
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-full text-sm font-semibold ${severityColor[symptomResult.severity] || "bg-gray-100"}`}>
                      {symptomResult.severity} Severity
                    </span>
                    {symptomResult.emergency && (
                      <span className="bg-red-600 text-white px-3 py-1 rounded-full text-sm font-semibold animate-pulse">🚨 EMERGENCY</span>
                    )}
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{symptomResult.raw}</div>
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">
                    💡 {symptomResult.recommendation}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Image Diagnosis */}
          {activeTab === "Image Diagnosis" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-2">📷 AI Image Diagnosis</h2>
              <p className="text-xs text-gray-400 mb-4">Upload a photo of skin, eyes, ears, paws, mouth — or anything that looks off. Not a replacement for a vet exam.</p>
              <input ref={scanInput} type="file" accept="image/*" capture="environment" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setScanFile(f);
                  setScanResult(null);
                  setScanPreview(f ? URL.createObjectURL(f) : null);
                }} />
              <button onClick={() => scanInput.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 hover:border-green-400 rounded-xl p-6 text-center transition mb-4">
                {scanPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={scanPreview} alt="Scan preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="text-gray-400">
                    <div className="text-4xl mb-2">📸</div>
                    <p className="text-sm font-medium">Tap to take or upload a photo</p>
                  </div>
                )}
              </button>
              <button onClick={runPhotoScan} disabled={loading || !scanFile || !selectedPet}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Analyzing photo..." : "Analyze Photo"}
              </button>
              {scanResult && (
                <div className="mt-6 space-y-4">
                  {scanResult.health_score > 0 && (
                    <div className="flex items-center gap-3">
                      <div className={`w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold ${
                        scanResult.health_score >= 7 ? "bg-green-100 text-green-700" :
                        scanResult.health_score >= 4 ? "bg-yellow-100 text-yellow-700" : "bg-red-100 text-red-700"
                      }`}>
                        {scanResult.health_score}
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Visual health score</p>
                        <p className="text-xs text-gray-400">out of 10, from visible indicators only</p>
                      </div>
                    </div>
                  )}
                  <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{scanResult.raw}</div>
                  {scanResult.recommendation && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-800">💡 {scanResult.recommendation}</div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* AI Chat */}
          {activeTab === "AI Chat" && (
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: "480px" }}>
              <div className="p-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-800">💬 Pet Care AI Assistant</h2>
              </div>
              <div className="flex-1 overflow-y-auto p-4 space-y-3">
                {messages.length === 0 && (
                  <div className="text-center py-8 text-gray-400 text-sm">
                    Ask anything about your pet&apos;s health, nutrition, behavior...
                    <div className="mt-3 space-y-2">
                      {["Can my Beagle eat mango?", "How much exercise does a Labrador need?", "My cat is drinking more water than usual"].map((q) => (
                        <button key={q} onClick={() => setChatInput(q)}
                          className="block w-full text-left text-xs bg-gray-50 hover:bg-gray-100 rounded-lg px-3 py-2 transition">{q}</button>
                      ))}
                    </div>
                  </div>
                )}
                {messages.map((m, i) => (
                  <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                    <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl text-sm ${m.role === "user" ? "bg-green-600 text-white" : "bg-gray-100 text-gray-800"}`}>
                      {m.text}
                    </div>
                  </div>
                ))}
                {loading && <div className="flex justify-start"><div className="bg-gray-100 px-4 py-3 rounded-2xl text-sm text-gray-400">Thinking...</div></div>}
              </div>
              <div className="p-4 border-t border-gray-100 flex gap-2">
                <input value={chatInput} onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
                  placeholder="Ask about your pet's health..."
                  className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                <button onClick={sendChat} disabled={loading || !chatInput.trim() || !selectedPet}
                  className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm transition disabled:opacity-50">Send</button>
              </div>
            </div>
          )}

          {/* Monthly Report */}
          {activeTab === "Monthly Report" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-4">📊 AI Monthly Health Report</h2>
              <button onClick={loadReport} disabled={loading || !selectedPet}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50 mb-6">
                {loading ? "Generating..." : "Generate Report"}
              </button>
              {report && (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-blue-600">{report.feeding_summary.total_meals}</p>
                      <p className="text-xs text-blue-500">Total Meals</p>
                    </div>
                    <div className="bg-green-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-green-600">{report.activity_summary.total_minutes}m</p>
                      <p className="text-xs text-green-500">Activity</p>
                    </div>
                    <div className="bg-purple-50 rounded-lg p-3 text-center">
                      <p className="text-2xl font-bold text-purple-600">{report.activity_summary.total_km}km</p>
                      <p className="text-xs text-purple-500">Distance</p>
                    </div>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{report.report}</div>
                </div>
              )}
            </div>
          )}

          {/* Sound Interpreter */}
          {activeTab === "Sound Interpreter" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-2">🔊 Bark / Meow Interpreter</h2>
              <p className="text-xs text-amber-600 bg-amber-50 rounded-lg px-3 py-2 mb-4">Experimental feature — for educational purposes only</p>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Describe the sound/behavior</label>
                  <textarea value={soundDesc} onChange={(e) => setSoundDesc(e.target.value)} rows={2}
                    placeholder="e.g. 'High-pitched repetitive barking every 5 minutes'"
                    className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Context (optional)</label>
                  <input value={soundContext} onChange={(e) => setSoundContext(e.target.value)}
                    placeholder="e.g. 'During mealtime', 'When left alone'"
                    className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                </div>
                <button onClick={interpretSound} disabled={loading || !soundDesc.trim() || !selectedPet}
                  className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                  {loading ? "Interpreting..." : "Interpret"}
                </button>
                {soundResult && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4 text-sm text-purple-800 whitespace-pre-wrap">{soundResult}</div>
                )}
              </div>
            </div>
          )}
          {/* Document Reader */}
          {activeTab === "Document Reader" && (
            <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
              <h2 className="font-semibold text-gray-800 mb-2">📄 AI Document Reader</h2>
              <p className="text-xs text-gray-400 mb-4">Upload a vaccine card, prescription, blood report or invoice — get it explained in plain English.</p>
              <input ref={docInput} type="file" accept="image/*" className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0] || null;
                  setDocFile(f);
                  setDocResult("");
                  setDocPreview(f ? URL.createObjectURL(f) : null);
                }} />
              <button onClick={() => docInput.current?.click()}
                className="w-full border-2 border-dashed border-gray-300 hover:border-green-400 rounded-xl p-6 text-center transition mb-4">
                {docPreview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={docPreview} alt="Document preview" className="max-h-56 mx-auto rounded-lg object-contain" />
                ) : (
                  <div className="text-gray-400">
                    <div className="text-4xl mb-2">🗂️</div>
                    <p className="text-sm font-medium">Tap to upload a photo of the document</p>
                  </div>
                )}
              </button>
              <input value={docHint} onChange={(e) => setDocHint(e.target.value)}
                placeholder="What is it? (optional) — e.g. 'blood report from last week'"
                className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 mb-4" />
              <button onClick={runDocReader} disabled={loading || !docFile}
                className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Reading document..." : "Read & Explain"}
              </button>
              {docResult && (
                <div className="mt-6 bg-gray-50 rounded-lg p-5 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{docResult}</div>
              )}
            </div>
          )}
    </div>
  );
}
