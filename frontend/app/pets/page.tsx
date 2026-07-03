"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { petsApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";

interface Pet { id: number; name: string; species: string; breed: string; age: number; weight: number; photo: string; is_lost: boolean; activity_level: string; }

export default function PetsPage() {
  const [pets, setPets] = useState<Pet[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState({ name: "", species: "dog", breed: "", age: "", weight: "", gender: "", allergies: "", diet_preferences: "", activity_level: "moderate" });
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !user) router.push("/login");
    if (user) loadPets();
  }, [user, isLoading]);

  const loadPets = async () => {
    try {
      const res = await petsApi.list();
      setPets(res.data);
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    await petsApi.create({ ...form, age: parseFloat(form.age) || 0, weight: parseFloat(form.weight) || 0 });
    setShowForm(false);
    setForm({ name: "", species: "dog", breed: "", age: "", weight: "", gender: "", allergies: "", diet_preferences: "", activity_level: "moderate" });
    loadPets();
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this pet?")) return;
    await petsApi.delete(id);
    loadPets();
  };

  if (isLoading) return null;

  return (
    <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-800">My Pets</h1>
            <button onClick={() => setShowForm(!showForm)}
              className="bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition">
              {showForm ? "Cancel" : "➕ Add Pet"}
            </button>
          </div>

          {showForm && (
            <form onSubmit={handleCreate} className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 mb-4">Add New Pet</h2>
              <div className="grid grid-cols-2 gap-4">
                {[
                  { label: "Name*", key: "name", required: true },
                  { label: "Breed", key: "breed" },
                  { label: "Age (years)", key: "age", type: "number" },
                  { label: "Weight (kg)", key: "weight", type: "number" },
                  { label: "Gender", key: "gender" },
                  { label: "Allergies", key: "allergies" },
                  { label: "Diet Preferences", key: "diet_preferences" },
                ].map(({ label, key, required, type }) => (
                  <div key={key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                    <input
                      type={type || "text"}
                      value={(form as any)[key]}
                      onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                      required={required}
                      className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                    />
                  </div>
                ))}
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Species</label>
                  <select value={form.species} onChange={(e) => setForm({ ...form, species: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="dog">Dog</option>
                    <option value="cat">Cat</option>
                    <option value="bird">Bird</option>
                    <option value="rabbit">Rabbit</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-600 mb-1">Activity Level</label>
                  <select value={form.activity_level} onChange={(e) => setForm({ ...form, activity_level: e.target.value })}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
                    <option value="low">Low</option>
                    <option value="moderate">Moderate</option>
                    <option value="high">High</option>
                  </select>
                </div>
              </div>
              <button type="submit" className="mt-4 bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition">
                Save Pet
              </button>
            </form>
          )}

          {loading ? (
            <div className="text-center py-12 text-gray-400">Loading pets...</div>
          ) : pets.length === 0 ? (
            <div className="text-center py-16 bg-white rounded-xl border border-gray-100">
              <div className="text-6xl mb-4">🐾</div>
              <p className="text-gray-500">No pets yet. Add your first pet!</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {pets.map((pet) => (
                <div key={pet.id} className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition">
                  <div className="flex items-start gap-4">
                    <div className="w-14 h-14 bg-green-100 rounded-full flex items-center justify-center text-3xl flex-shrink-0">
                      {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : pet.species === "bird" ? "🐦" : "🐾"}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-gray-800">{pet.name}</h3>
                        {pet.is_lost && <span className="text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Lost</span>}
                      </div>
                      <p className="text-sm text-gray-500">{pet.breed} · {pet.age}y · {pet.weight}kg</p>
                      <p className="text-xs text-gray-400 capitalize">{pet.activity_level} activity</p>
                    </div>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Link href={`/pets/${pet.id}`}
                      className="flex-1 text-center text-sm bg-green-50 text-green-700 hover:bg-green-100 py-2 rounded-lg font-medium transition">
                      View Details
                    </Link>
                    <button onClick={() => handleDelete(pet.id)}
                      className="text-sm bg-red-50 text-red-600 hover:bg-red-100 px-4 py-2 rounded-lg transition">
                      Delete
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
    </div>
  );
}
