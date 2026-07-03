"use client";
import { useEffect, useState } from "react";
import { vetApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function VetDashboardPage() {
  const [stats, setStats]             = useState<any>(null);
  const [appointments, setAppointments] = useState<any[]>([]);
  const [loading, setLoading]         = useState(true);
  const { user, isLoading }           = useAuth();
  const router                        = useRouter();

  useEffect(() => {
    if (!isLoading && !user) { router.push("/login"); return; }
    if (!isLoading && user?.role !== "vet" && user?.role !== "admin") {
      router.push("/dashboard"); return;
    }
    if (user && (user.role === "vet" || user.role === "admin")) {
      Promise.all([
        vetApi.getDashboardStats(),
        vetApi.getAppointments(),
      ]).then(([s, a]) => {
        setStats(s.data);
        setAppointments(a.data);
      }).finally(() => setLoading(false));
    }
  }, [user, isLoading]);

  if (isLoading || loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="text-4xl animate-bounce">🏥</div>
    </div>
  );

  const STATUS_CLS: Record<string, string> = {
    pending:   "bg-yellow-100 text-yellow-700",
    confirmed: "bg-blue-100 text-blue-700",
    completed: "bg-green-100 text-green-700",
    cancelled: "bg-red-100 text-red-600",
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-800">🏥 Vet Dashboard</h1>
        <p className="text-gray-500 mt-1">Welcome back, <span className="font-medium">{user?.name}</span></p>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            { icon: "🐾", label: "Total Pets",     value: stats.total_pets,            color: "bg-green-50  text-green-700"  },
            { icon: "👥", label: "Platform Users", value: stats.total_users,           color: "bg-blue-50   text-blue-700"   },
            { icon: "📅", label: "Pending Appts",  value: stats.pending_appointments,  color: "bg-yellow-50 text-yellow-700" },
            { icon: "📍", label: "Lost Pets",       value: stats.lost_pets,             color: "bg-red-50    text-red-700"    },
          ].map(({ icon, label, value, color }) => (
            <div key={label} className={`rounded-xl p-5 ${color}`}>
              <div className="text-2xl mb-2">{icon}</div>
              <div className="text-2xl font-bold">{value}</div>
              <div className="text-sm opacity-75 mt-0.5">{label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Quick actions for vet */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[
          { href: "/dashboard/vet-chat",  icon: "💬", label: "Patient Chats",  color: "bg-green-600 hover:bg-green-700" },
          { href: "/dashboard/medical",   icon: "💊", label: "Medical Records", color: "bg-blue-600  hover:bg-blue-700"  },
          { href: "/ai",                  icon: "🤖", label: "AI Tools",        color: "bg-purple-600 hover:bg-purple-700" },
        ].map(a => (
          <Link key={a.href} href={a.href}
            className={`${a.color} text-white rounded-xl p-4 flex items-center gap-3 transition`}>
            <span className="text-2xl">{a.icon}</span>
            <span className="font-semibold text-sm">{a.label}</span>
          </Link>
        ))}
      </div>

      {/* Appointments */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-800">My Appointments</h2>
          <Link href="/dashboard/medical" className="text-sm text-green-600 hover:underline">Manage →</Link>
        </div>
        {appointments.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-4xl mb-2">📅</div>
            <p className="text-gray-400 text-sm">No appointments yet</p>
          </div>
        ) : (
          <div className="divide-y divide-gray-50">
            {appointments.slice(0, 8).map(a => (
              <div key={a.id} className="flex items-center justify-between px-5 py-3.5 hover:bg-gray-50 transition">
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-gray-800 text-sm truncate">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    Pet #{a.pet_id} · {new Date(a.scheduled_at).toLocaleString()}
                    <span className="ml-2 capitalize text-gray-400">{a.appointment_type}</span>
                  </p>
                </div>
                <span className={`ml-4 text-xs px-2.5 py-1 rounded-full font-medium flex-shrink-0 ${STATUS_CLS[a.status] || "bg-gray-100 text-gray-600"}`}>
                  {a.status}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
