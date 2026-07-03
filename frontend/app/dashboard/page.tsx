"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { petsApi, medicalApi, communityApi } from "@/lib/api";

interface Pet { id: number; name: string; species: string; breed: string; age: number; weight: number; photo: string; is_lost: boolean; }

export default function DashboardPage() {
  const { user } = useAuth();
  const [pets, setPets] = useState<Pet[]>([]);
  const [dueVaccinations, setDueVaccinations] = useState<any[]>([]);
  const [notifications, setNotifications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const petsRes = await petsApi.list();
        const petList = petsRes.data;
        setPets(petList);
        const allDue: any[] = [];
        for (const pet of petList.slice(0, 5)) {
          const dueRes = await medicalApi.getDueVaccinations(pet.id);
          dueRes.data.forEach((v: any) => allDue.push({ ...v, pet_name: pet.name }));
        }
        setDueVaccinations(allDue);
        const notifRes = await communityApi.getNotifications(true);
        setNotifications(notifRes.data.slice(0, 5));
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const quickActions = [
    { href: "/pets", label: "Add Pet", icon: "➕", color: "bg-green-500" },
    { href: "/ai", label: "AI Chat", icon: "🤖", color: "bg-blue-500" },
    { href: "/dashboard/medical", label: "Book Appointment", icon: "📅", color: "bg-purple-500" },
    { href: "/dashboard/lost-pets", label: "Lost Pet Alert", icon: "🚨", color: "bg-red-500" },
  ];

  return (
    <div className="max-w-6xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Welcome back, {user?.name?.split(" ")[0]} 👋</h1>
        <p className="text-gray-500 mt-1">Here&apos;s an overview of your pets&apos; health today.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard icon="🐾" label="My Pets" value={pets.length} color="green" />
        <StatCard icon="💉" label="Due Vaccinations" value={dueVaccinations.length} color="yellow" />
        <StatCard icon="🔔" label="Unread Alerts" value={notifications.length} color="blue" />
        <StatCard icon="📍" label="Lost Pets" value={pets.filter(p => p.is_lost).length} color="red" />
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {quickActions.map((a) => (
          <Link key={a.href} href={a.href}
            className="flex flex-col items-center justify-center gap-2 bg-white rounded-xl p-5 shadow-sm border border-gray-100 hover:shadow-md transition group">
            <span className="text-3xl group-hover:scale-110 transition-transform">{a.icon}</span>
            <span className="text-sm font-medium text-gray-700">{a.label}</span>
          </Link>
        ))}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Pets */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-800">My Pets</h2>
            <Link href="/pets" className="text-sm text-green-600 hover:underline">View all →</Link>
          </div>
          {loading ? <p className="text-gray-400 text-sm">Loading...</p> : pets.length === 0 ? (
            <div className="text-center py-6">
              <p className="text-gray-400 text-sm">No pets yet.</p>
              <Link href="/pets" className="mt-2 inline-block text-green-600 text-sm font-medium hover:underline">Add your first pet →</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {pets.slice(0, 4).map((pet) => (
                <Link key={pet.id} href={`/pets/${pet.id}`}
                  className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition">
                  <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center text-xl">
                    {pet.species === "dog" ? "🐕" : pet.species === "cat" ? "🐈" : "🐾"}
                  </div>
                  <div>
                    <p className="font-medium text-gray-800 text-sm">{pet.name}</p>
                    <p className="text-xs text-gray-400">{pet.breed} · {pet.age}y · {pet.weight}kg</p>
                  </div>
                  {pet.is_lost && <span className="ml-auto text-xs bg-red-100 text-red-600 px-2 py-0.5 rounded-full">Lost</span>}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Due Vaccinations */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h2 className="font-semibold text-gray-800 mb-4">Upcoming Vaccinations</h2>
          {dueVaccinations.length === 0 ? (
            <p className="text-gray-400 text-sm py-4 text-center">✅ No vaccinations due in next 30 days</p>
          ) : (
            <div className="space-y-3">
              {dueVaccinations.map((v, i) => (
                <div key={i} className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg border border-yellow-100">
                  <span className="text-xl">💉</span>
                  <div>
                    <p className="text-sm font-medium text-gray-800">{v.vaccine_name}</p>
                    <p className="text-xs text-gray-500">{v.pet_name} · Due: {new Date(v.due_date).toLocaleDateString()}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, color }: { icon: string; label: string; value: number; color: string }) {
  const colorMap: Record<string, string> = {
    green: "bg-green-50 text-green-700",
    yellow: "bg-yellow-50 text-yellow-700",
    blue: "bg-blue-50 text-blue-700",
    red: "bg-red-50 text-red-700",
  };
  return (
    <div className={`rounded-xl p-5 ${colorMap[color]} border border-opacity-20`}>
      <div className="text-2xl mb-2">{icon}</div>
      <div className="text-2xl font-bold">{value}</div>
      <div className="text-sm opacity-75">{label}</div>
    </div>
  );
}
