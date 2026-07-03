"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { useState, useEffect } from "react";

// ── Per-role navigation ───────────────────────────────────────────────────────
const COMMON_NAV = [
  { href: "/dashboard",             label: "Dashboard",     icon: "🏠" },
  { href: "/dashboard/notifications",label: "Notifications", icon: "🔔" },
];

const OWNER_NAV = [
  { href: "/pets",                  label: "My Pets",       icon: "🐾" },
  { href: "/dashboard/feeding",     label: "Feeding",       icon: "🍽️" },
  { href: "/dashboard/activity",    label: "Activity",      icon: "🏃" },
  { href: "/dashboard/health",      label: "Health Journal",icon: "📋" },
  { href: "/dashboard/timeline",    label: "Timeline & Growth", icon: "📈" },
  { href: "/dashboard/medical",     label: "Medical",       icon: "💊" },
  { href: "/dashboard/care-plans",  label: "Care Plans",    icon: "🗓️" },
  { href: "/dashboard/vet-chat",    label: "Vet Chat",      icon: "💬" },
  { href: "/ai",                    label: "AI Features",   icon: "🤖" },
  { href: "/dashboard/food-scanner",label: "Food Scanner",  icon: "🍎" },
  { href: "/dashboard/poison",      label: "Poison Center", icon: "☠️" },
  { href: "/dashboard/encyclopedia",label: "Encyclopedia",  icon: "📚" },
  { href: "/dashboard/expenses",    label: "Expenses",      icon: "💰" },
  { href: "/dashboard/lost-pets",   label: "Lost Pets",     icon: "📍" },
  { href: "/dashboard/emergency",   label: "Emergency",     icon: "🆘" },
];

const VET_NAV = [
  { href: "/vet",                   label: "Vet Dashboard", icon: "🏥" },
  { href: "/vet/patients",          label: "Patients",      icon: "🐕" },
  { href: "/vet/appointments",      label: "Appointments",  icon: "📅" },
  { href: "/dashboard/vet-chat",    label: "Patient Chat",  icon: "💬" },
  { href: "/dashboard/medical",     label: "Medical",       icon: "💊" },
  { href: "/ai",                    label: "AI Tools",      icon: "🤖" },
  { href: "/dashboard/poison",      label: "Poison Center", icon: "☠️" },
  { href: "/dashboard/encyclopedia",label: "Encyclopedia",  icon: "📚" },
];

const ADMIN_NAV = [
  { href: "/vet",                   label: "Admin Panel",   icon: "⚙️" },
  { href: "/pets",                  label: "All Pets",      icon: "🐾" },
  { href: "/dashboard/medical",     label: "Medical",       icon: "💊" },
  { href: "/dashboard/vet-chat",    label: "All Chats",     icon: "💬" },
  { href: "/ai",                    label: "AI Features",   icon: "🤖" },
  { href: "/dashboard/lost-pets",   label: "Lost Pets",     icon: "📍" },
];

const CARETAKER_NAV = [
  { href: "/pets",                  label: "Assigned Pets", icon: "🐾" },
  { href: "/dashboard/feeding",     label: "Feeding",       icon: "🍽️" },
  { href: "/dashboard/activity",    label: "Activity",      icon: "🏃" },
  { href: "/dashboard/health",      label: "Health Journal",icon: "📋" },
  { href: "/dashboard/medical",     label: "Medical",       icon: "💊" },
];

const SHELTER_NAV = [
  { href: "/pets",                  label: "Shelter Pets",  icon: "🐾" },
  { href: "/dashboard/medical",     label: "Medical",       icon: "💊" },
  { href: "/dashboard/lost-pets",   label: "Lost & Found",  icon: "📍" },
  { href: "/ai",                    label: "AI Features",   icon: "🤖" },
];

function getNavForRole(role: string) {
  switch (role) {
    case "vet":       return [...COMMON_NAV, ...VET_NAV];
    case "admin":     return [...COMMON_NAV, ...ADMIN_NAV];
    case "caretaker": return [...COMMON_NAV, ...CARETAKER_NAV];
    case "shelter":   return [...COMMON_NAV, ...SHELTER_NAV];
    default:          return [...COMMON_NAV, ...OWNER_NAV];
  }
}

const ROLE_BADGE: Record<string, string> = {
  owner:     "bg-green-100 text-green-700",
  vet:       "bg-blue-100 text-blue-700",
  admin:     "bg-purple-100 text-purple-700",
  caretaker: "bg-orange-100 text-orange-700",
  shelter:   "bg-pink-100 text-pink-700",
};

export default function Sidebar() {
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [open, setOpen] = useState(false);

  // Close sidebar on route change (mobile)
  useEffect(() => setOpen(false), [pathname]);
  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      const aside = document.getElementById("sidebar-aside");
      if (aside && !aside.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const items = getNavForRole(user?.role || "owner");
  const roleBadge = ROLE_BADGE[user?.role || "owner"] || "bg-gray-100 text-gray-600";

  const SidebarContent = () => (
    <>
      {/* Logo */}
      <div className="p-5 border-b border-gray-100 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="text-3xl">🐾</span>
          <div>
            <h1 className="font-bold text-gray-800 text-base leading-tight">PetCare AI</h1>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium capitalize ${roleBadge}`}>
              {user?.role}
            </span>
          </div>
        </div>
        {/* Mobile close */}
        <button onClick={() => setOpen(false)} className="lg:hidden text-gray-400 hover:text-gray-600 p-1">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 space-y-0.5 overflow-y-auto">
        {items.map((item) => {
          const active = pathname === item.href;
          return (
            <Link key={item.href} href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all ${
                active
                  ? "bg-green-600 text-white shadow-sm"
                  : "text-gray-600 hover:bg-gray-100 hover:text-gray-900"
              }`}>
              <span className={`text-base w-6 text-center flex-shrink-0 ${active ? "" : ""}`}>{item.icon}</span>
              <span className="truncate">{item.label}</span>
              {active && <span className="ml-auto w-1.5 h-1.5 bg-white rounded-full opacity-80" />}
            </Link>
          );
        })}
      </nav>

      {/* User footer */}
      <div className="p-4 border-t border-gray-100">
        <div className="flex items-center gap-3 mb-3 p-2 rounded-xl bg-gray-50">
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${roleBadge}`}>
            {user?.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-gray-800 truncate">{user?.name}</p>
            <p className="text-xs text-gray-400 truncate">{user?.email}</p>
          </div>
        </div>
        <button onClick={logout}
          className="w-full flex items-center gap-2 text-sm text-red-500 hover:text-red-700 px-3 py-2 rounded-xl hover:bg-red-50 transition font-medium">
          <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign Out
        </button>
      </div>
    </>
  );

  return (
    <>
      {/* ── Mobile hamburger button ────────────────────────────────────────── */}
      <button
        onClick={() => setOpen(true)}
        className="lg:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white shadow-lg rounded-xl flex items-center justify-center border border-gray-200 hover:bg-gray-50 transition"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      {/* ── Mobile overlay ────────────────────────────────────────────────── */}
      {open && (
        <div className="lg:hidden fixed inset-0 bg-black/40 z-40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* ── Mobile drawer ─────────────────────────────────────────────────── */}
      <aside
        id="sidebar-aside"
        className={`lg:hidden fixed top-0 left-0 h-full w-72 bg-white z-50 flex flex-col shadow-2xl transition-transform duration-300 ${open ? "translate-x-0" : "-translate-x-full"}`}
      >
        <SidebarContent />
      </aside>

      {/* ── Desktop sidebar (always visible) ─────────────────────────────── */}
      <aside className="hidden lg:flex w-64 xl:w-72 bg-white border-r border-gray-200 min-h-screen flex-col flex-shrink-0 sticky top-0 h-screen">
        <SidebarContent />
      </aside>
    </>
  );
}
