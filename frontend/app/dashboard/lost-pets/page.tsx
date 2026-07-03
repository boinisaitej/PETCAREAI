"use client";
import { useEffect, useState } from "react";
import { petsApi, communityApi } from "@/lib/api";

export default function LostPetsPage() {
  const [myPets, setMyPets] = useState<any[]>([]);
  const [lostPets, setLostPets] = useState<any[]>([]);
  const [form, setForm] = useState({ pet_id: "", description: "", last_seen_location: "", last_seen_lat: "", last_seen_lng: "" });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    petsApi.list().then((r) => setMyPets(r.data));
    communityApi.getLostPets().then((r) => setLostPets(r.data));
  }, []);

  const reportLost = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await communityApi.reportLost({
      ...form, pet_id: parseInt(form.pet_id),
      last_seen_lat: form.last_seen_lat ? parseFloat(form.last_seen_lat) : null,
      last_seen_lng: form.last_seen_lng ? parseFloat(form.last_seen_lng) : null,
    });
    setForm({ pet_id: "", description: "", last_seen_location: "", last_seen_lat: "", last_seen_lng: "" });
    const r = await communityApi.getLostPets();
    setLostPets(r.data);
    setLoading(false);
  };

  const resolveReport = async (reportId: number) => {
    await communityApi.resolveLost(reportId);
    const r = await communityApi.getLostPets();
    setLostPets(r.data);
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">📍 Lost Pet System</h1>
      <div className="grid md:grid-cols-2 gap-6 mb-8">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">🚨 Report Lost Pet</h2>
          <form onSubmit={reportLost} className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Select Pet*</label>
              <select required value={form.pet_id} onChange={(e) => setForm({ ...form, pet_id: e.target.value })}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                <option value="">-- Select --</option>
                {myPets.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Last Seen Location</label>
              <input value={form.last_seen_location} onChange={(e) => setForm({ ...form, last_seen_location: e.target.value })}
                placeholder="e.g. Central Park, New York" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Latitude</label>
                <input type="number" step="any" value={form.last_seen_lat} onChange={(e) => setForm({ ...form, last_seen_lat: e.target.value })}
                  placeholder="40.7128" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Longitude</label>
                <input type="number" step="any" value={form.last_seen_lng} onChange={(e) => setForm({ ...form, last_seen_lng: e.target.value })}
                  placeholder="-74.0060" className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2}
                placeholder="Distinctive features, what they were wearing..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-red-600 hover:bg-red-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
              {loading ? "Reporting..." : "🚨 Report Lost Pet"}
            </button>
          </form>
        </div>

        <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-5">
          <h3 className="font-semibold text-yellow-800 mb-3">📢 How Lost Pet System Works</h3>
          <ol className="text-sm text-yellow-700 space-y-2 list-decimal list-inside">
            <li>Owner marks pet as lost with last known location</li>
            <li>Alert broadcast to nearby community members</li>
            <li>Community members can upload found photos</li>
            <li>AI matches found photos to lost pet profiles</li>
            <li>Owner receives instant notification when match found</li>
          </ol>
        </div>
      </div>

      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h2 className="font-semibold text-gray-800 mb-4">Active Lost Pet Alerts ({lostPets.length})</h2>
        {lostPets.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">✅</div>
            <p className="text-gray-400 text-sm">No active lost pet reports</p>
          </div>
        ) : (
          <div className="grid md:grid-cols-2 gap-4">
            {lostPets.map((p) => (
              <div key={p.report_id} className="border border-red-200 bg-red-50 rounded-xl p-4">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-2xl">
                    {p.species === "dog" ? "🐕" : p.species === "cat" ? "🐈" : "🐾"}
                  </div>
                  <div>
                    <p className="font-bold text-gray-800">{p.pet_name}</p>
                    <p className="text-xs text-gray-500">{p.breed}</p>
                  </div>
                  <span className="ml-auto text-xs bg-red-600 text-white px-2 py-0.5 rounded-full">LOST</span>
                </div>
                {p.last_seen_location && (
                  <p className="text-sm text-gray-600 mb-2">📍 {p.last_seen_location}</p>
                )}
                {p.description && <p className="text-xs text-gray-500 mb-3">{p.description}</p>}
                <p className="text-xs text-gray-400 mb-3">Reported: {new Date(p.reported_at).toLocaleDateString()}</p>
                <button onClick={() => resolveReport(p.report_id)}
                  className="w-full bg-green-600 hover:bg-green-700 text-white py-1.5 rounded-lg text-xs font-medium transition">
                  ✅ Mark as Found
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
