"use client";
import { useRef, useState } from "react";
import { careApi } from "@/lib/api";
import PetPicker from "@/components/PetPicker";

const safeStyle = (s: string) => {
  const v = (s || "").toLowerCase();
  if (v.startsWith("yes")) return "bg-green-100 text-green-800 border-green-300";
  if (v.includes("caution")) return "bg-yellow-100 text-yellow-800 border-yellow-300";
  return "bg-red-100 text-red-800 border-red-300";
};

export default function FoodScannerPage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [mode, setMode] = useState<"photo" | "text">("photo");
  const [food, setFood] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState("");
  const fileInput = useRef<HTMLInputElement>(null);

  const onFile = (f: File | null) => {
    setFile(f);
    setResult(null);
    if (f) setPreview(URL.createObjectURL(f));
    else setPreview(null);
  };

  const scan = async () => {
    if (!selectedPet) return;
    setLoading(true);
    setError("");
    setResult(null);
    try {
      const res = mode === "photo" && file
        ? await careApi.foodScan(selectedPet, file)
        : await careApi.foodCheck(selectedPet, food);
      setResult(res.data);
    } catch (e: any) {
      setError(e.response?.data?.detail || "Scan failed. Please try again.");
    }
    setLoading(false);
  };

  const canScan = selectedPet && (mode === "photo" ? !!file : !!food.trim());

  return (
    <div className="max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">🍎 Food Scanner</h1>
      <p className="text-gray-500 mb-6">Snap a photo or type a food — find out if your pet can eat it</p>

      <PetPicker selected={selectedPet} onSelect={(id) => setSelectedPet(id)} />

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
        {/* Mode toggle */}
        <div className="flex gap-2 mb-5">
          {(["photo", "text"] as const).map((m) => (
            <button key={m} onClick={() => { setMode(m); setResult(null); }}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                mode === m ? "bg-green-600 text-white" : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}>
              {m === "photo" ? "📷 Photo" : "⌨️ Type food name"}
            </button>
          ))}
        </div>

        {mode === "photo" ? (
          <div>
            <input ref={fileInput} type="file" accept="image/*" capture="environment" className="hidden"
              onChange={(e) => onFile(e.target.files?.[0] || null)} />
            <button onClick={() => fileInput.current?.click()}
              className="w-full border-2 border-dashed border-gray-300 hover:border-green-400 rounded-xl p-6 text-center transition">
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Food preview" className="max-h-56 mx-auto rounded-lg object-contain" />
              ) : (
                <div className="text-gray-400">
                  <div className="text-4xl mb-2">📸</div>
                  <p className="text-sm font-medium">Tap to take or upload a photo of the food</p>
                </div>
              )}
            </button>
          </div>
        ) : (
          <input value={food} onChange={(e) => setFood(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && canScan && scan()}
            placeholder="e.g. 'mango', 'boiled egg', 'cheese pizza slice'"
            className="w-full border border-gray-200 rounded-lg px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
        )}

        <button onClick={scan} disabled={loading || !canScan}
          className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2.5 rounded-lg text-sm font-semibold transition disabled:opacity-50 w-full sm:w-auto">
          {loading ? "Analyzing..." : "Can my pet eat this?"}
        </button>
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>}

      {result && (
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 space-y-4">
          <div className="flex items-center gap-3 flex-wrap">
            {result.food && <span className="text-lg font-semibold text-gray-800">{result.food}</span>}
            <span className={`px-4 py-1.5 rounded-full text-sm font-bold border ${safeStyle(result.safe || "")}`}>
              {(result.safe || "?").toLowerCase().startsWith("yes") ? "✅ Safe" :
               (result.safe || "").toLowerCase().includes("caution") ? "⚠️ With caution" : "❌ Not safe"}
            </span>
          </div>
          {result.verdict && <p className="text-sm text-gray-700 font-medium">{result.verdict}</p>}
          <div className="grid sm:grid-cols-2 gap-3">
            {result.safe_quantity && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-blue-700 uppercase mb-1">Safe quantity</p>
                <p className="text-sm text-blue-900">{result.safe_quantity}</p>
              </div>
            )}
            {result.calories && (
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-purple-700 uppercase mb-1">Calories</p>
                <p className="text-sm text-purple-900">{result.calories}</p>
              </div>
            )}
            {result.benefits && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-green-700 uppercase mb-1">Benefits</p>
                <p className="text-sm text-green-900">{result.benefits}</p>
              </div>
            )}
            {result.risks && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <p className="text-xs font-semibold text-red-700 uppercase mb-1">Risks</p>
                <p className="text-sm text-red-900">{result.risks}</p>
              </div>
            )}
          </div>
          <details className="text-xs text-gray-400">
            <summary className="cursor-pointer hover:text-gray-600">Full AI response</summary>
            <pre className="whitespace-pre-wrap mt-2 text-gray-600 font-sans">{result.raw}</pre>
          </details>
        </div>
      )}
    </div>
  );
}
