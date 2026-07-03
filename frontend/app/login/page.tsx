"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const DEMO_ACCOUNTS = [
  {
    label: "Pet Owner",  email: "owner@demo.com",    password: "demo1234", icon: "🐾",
    desc: "Manage pets, feeding, activity, AI features & vet chat",
    color: "border-green-200 bg-green-50 hover:bg-green-100 text-green-800",
    ring:  "ring-2 ring-green-500",
  },
  {
    label: "Vet",        email: "vet@demo.com",       password: "demo1234", icon: "🏥",
    desc: "Patient records, diagnoses, prescriptions, vet chat",
    color: "border-blue-200 bg-blue-50 hover:bg-blue-100 text-blue-800",
    ring:  "ring-2 ring-blue-500",
  },
  {
    label: "Admin",      email: "admin@demo.com",     password: "demo1234", icon: "⚙️",
    desc: "Full platform access, all stats & all features",
    color: "border-purple-200 bg-purple-50 hover:bg-purple-100 text-purple-800",
    ring:  "ring-2 ring-purple-500",
  },
  {
    label: "Caretaker",  email: "caretaker@demo.com", password: "demo1234", icon: "🤝",
    desc: "Log feeding, activity & health on behalf of owner",
    color: "border-orange-200 bg-orange-50 hover:bg-orange-100 text-orange-800",
    ring:  "ring-2 ring-orange-500",
  },
  {
    label: "Shelter",    email: "shelter@demo.com",   password: "demo1234", icon: "🏠",
    desc: "Manage shelter pets, lost/found alerts",
    color: "border-pink-200 bg-pink-50 hover:bg-pink-100 text-pink-800",
    ring:  "ring-2 ring-pink-500",
  },
];

export default function LoginPage() {
  const [email, setEmail]         = useState("");
  const [password, setPassword]   = useState("");
  const [showPw, setShowPw]       = useState(false);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(false);
  const [demoOpen, setDemoOpen]   = useState(true);
  const { login } = useAuth();
  const router    = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim())    { setError("Email is required.");    return; }
    if (!password.trim()) { setError("Password is required."); return; }
    setLoading(true);
    setError("");
    try {
      const res = await authApi.login(email, password);
      login(res.data.access_token, res.data.user);
      router.push("/dashboard");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(", "));
      } else {
        setError(typeof detail === "string" ? detail : "Login failed. Check your credentials.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = (acc: typeof DEMO_ACCOUNTS[0]) => {
    setEmail(acc.email);
    setPassword(acc.password);
    setError("");
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">

        {/* Top card */}
        <div className="p-8 pb-6">
          <div className="text-center mb-6">
            <div className="text-5xl mb-3">🐾</div>
            <h1 className="text-2xl font-bold text-gray-800">PetCare AI</h1>
            <p className="text-gray-500 text-sm mt-1">Sign in to your account</p>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm flex items-start gap-2">
              <span className="flex-shrink-0 mt-0.5">⚠️</span><span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input
                type="email" value={email}
                onChange={(e) => { setEmail(e.target.value); setError(""); }}
                className="w-full border border-gray-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                placeholder="you@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPw ? "text" : "password"} value={password}
                  onChange={(e) => { setPassword(e.target.value); setError(""); }}
                  className="w-full border border-gray-300 rounded-lg px-4 py-2.5 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-green-500"
                  placeholder="••••••••"
                />
                <button type="button" onClick={() => setShowPw(!showPw)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg">
                  {showPw ? "🙈" : "👁️"}
                </button>
              </div>
            </div>
            <button type="submit" disabled={loading}
              className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm">
              {loading ? "Signing in…" : "Sign In"}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-4">
            Don&apos;t have an account?{" "}
            <Link href="/register" className="text-green-600 font-medium hover:underline">Register</Link>
          </p>
        </div>

        {/* Demo accounts section */}
        <div className="border-t border-gray-100">
          {/* Toggle button */}
          <button
            onClick={() => setDemoOpen(!demoOpen)}
            className="w-full flex items-center justify-between px-5 py-3 text-sm font-medium text-gray-500 hover:bg-gray-50 transition"
          >
            <div className="flex items-center gap-2">
              <span>🎭</span>
              <span>Demo Accounts</span>
              <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">
                {DEMO_ACCOUNTS.length} roles · password: demo1234
              </span>
            </div>
            <svg
              className={`w-4 h-4 text-gray-400 transition-transform duration-200 ${demoOpen ? "rotate-180" : ""}`}
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* Collapsible panel */}
          <div className={`overflow-hidden transition-all duration-300 ${demoOpen ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0"}`}>
            <div className="px-4 pb-4 space-y-1.5">
              {DEMO_ACCOUNTS.map((acc) => (
                <button
                  key={acc.email}
                  type="button"
                  onClick={() => fillDemo(acc)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border text-left transition ${acc.color} ${email === acc.email ? acc.ring : ""}`}
                >
                  <span className="text-2xl flex-shrink-0">{acc.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold leading-tight">{acc.label}</p>
                    <p className="text-xs opacity-70 leading-tight">{acc.desc}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-mono opacity-50 leading-tight">{acc.email}</p>
                    {email === acc.email
                      ? <p className="text-xs font-semibold text-green-600 mt-0.5">✓ selected</p>
                      : <p className="text-xs text-gray-400 mt-0.5">click to fill</p>
                    }
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
