"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const ROLES = [
  {
    value: "owner",
    label: "Pet Owner",
    icon: "🐾",
    description: "Manage your pets, track health, feeding, activity and use AI features.",
    color: "border-green-300 bg-green-50 text-green-800",
    active: "border-green-600 bg-green-600 text-white",
  },
  {
    value: "vet",
    label: "Veterinarian",
    icon: "🏥",
    description: "Access all patient records, write diagnoses, prescriptions and manage appointments.",
    color: "border-blue-300 bg-blue-50 text-blue-800",
    active: "border-blue-600 bg-blue-600 text-white",
  },
  {
    value: "caretaker",
    label: "Pet Caretaker",
    icon: "🤝",
    description: "Log feeding, activity and health on behalf of an owner's pets.",
    color: "border-orange-300 bg-orange-50 text-orange-800",
    active: "border-orange-500 bg-orange-500 text-white",
  },
  {
    value: "shelter",
    label: "Shelter / Rescue",
    icon: "🏠",
    description: "Manage shelter pets, post lost/found alerts and track medical care.",
    color: "border-pink-300 bg-pink-50 text-pink-800",
    active: "border-pink-500 bg-pink-500 text-white",
  },
];

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "password" | "confirm", string>>;

function validate(form: {
  name: string; email: string; phone: string; password: string; confirm: string;
}): FieldErrors {
  const errors: FieldErrors = {};
  if (!form.name.trim())                errors.name     = "Full name is required.";
  else if (form.name.trim().length < 2) errors.name     = "Name must be at least 2 characters.";

  if (!form.email.trim())               errors.email    = "Email is required.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email))
                                        errors.email    = "Enter a valid email address.";

  if (form.phone && !/^\+?[\d\s\-().]{7,15}$/.test(form.phone))
                                        errors.phone    = "Enter a valid phone number.";

  if (!form.password)                   errors.password = "Password is required.";
  else if (form.password.length < 6)    errors.password = "Password must be at least 6 characters.";
  else if (!/[A-Za-z]/.test(form.password) || !/[0-9]/.test(form.password))
                                        errors.password = "Password must contain letters and numbers.";

  if (!form.confirm)                    errors.confirm  = "Please confirm your password.";
  else if (form.confirm !== form.password) errors.confirm = "Passwords do not match.";

  return errors;
}

function pwStrength(pw: string) {
  if (!pw) return null;
  if (pw.length < 6)                                              return { label: "Too short", bar: "w-1/4",  cls: "bg-red-400",    text: "text-red-500"    };
  if (pw.length < 8 || !/[0-9]/.test(pw) || !/[A-Za-z]/.test(pw)) return { label: "Weak",      bar: "w-2/4",  cls: "bg-orange-400", text: "text-orange-500" };
  if (!/[^A-Za-z0-9]/.test(pw))                                  return { label: "Good",      bar: "w-3/4",  cls: "bg-yellow-400", text: "text-yellow-600" };
  return                                                                 { label: "Strong",    bar: "w-full", cls: "bg-green-500",  text: "text-green-600"  };
}

export default function RegisterPage() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", confirm: "", role: "owner" });
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [serverError, setServerError] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [showCf, setShowCf] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const router = useRouter();

  const set = (key: string, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setFieldErrors((e) => ({ ...e, [key]: undefined }));
    setServerError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validate(form);
    if (Object.keys(errors).length) { setFieldErrors(errors); return; }
    setLoading(true);
    setServerError("");
    try {
      const res = await authApi.register({
        name: form.name.trim(), email: form.email.trim(),
        password: form.password, role: form.role,
        phone: form.phone.trim() || undefined,
      });
      login(res.data.access_token, res.data.user);
      router.push("/dashboard");
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setServerError(detail.map((e: any) => e.msg || JSON.stringify(e)).join(", "));
      } else {
        setServerError(typeof detail === "string" ? detail : "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const strength = pwStrength(form.password);
  const selectedRole = ROLES.find((r) => r.value === form.role)!;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 to-blue-50 p-4">
      <div className="bg-white rounded-2xl shadow-xl p-8 w-full max-w-lg">

        <div className="text-center mb-6">
          <div className="text-5xl mb-3">🐾</div>
          <h1 className="text-2xl font-bold text-gray-800">Create Account</h1>
          <p className="text-gray-500 text-sm mt-1">Join PetCare AI today</p>
        </div>

        {serverError && (
          <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-5 text-sm flex items-start gap-2">
            <span className="mt-0.5 flex-shrink-0">⚠️</span><span>{serverError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>

          {/* Full Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Full Name <span className="text-red-500">*</span>
            </label>
            <input
              value={form.name} onChange={(e) => set("name", e.target.value)}
              placeholder="John Doe"
              className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${fieldErrors.name ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            />
            {fieldErrors.name && <p className="text-red-500 text-xs mt-1">{fieldErrors.name}</p>}
          </div>

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Email <span className="text-red-500">*</span>
            </label>
            <input
              type="email" value={form.email} onChange={(e) => set("email", e.target.value)}
              placeholder="you@example.com"
              className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${fieldErrors.email ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            />
            {fieldErrors.email && <p className="text-red-500 text-xs mt-1">{fieldErrors.email}</p>}
          </div>

          {/* Phone */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Phone <span className="text-gray-400 font-normal text-xs">(optional)</span>
            </label>
            <input
              type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)}
              placeholder="+1 234 567 8900"
              className={`w-full border rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${fieldErrors.phone ? "border-red-400 bg-red-50" : "border-gray-300"}`}
            />
            {fieldErrors.phone && <p className="text-red-500 text-xs mt-1">{fieldErrors.phone}</p>}
          </div>

          {/* Role Picker */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              I am a… <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2">
              {ROLES.map((r) => (
                <button
                  key={r.value} type="button" onClick={() => set("role", r.value)}
                  className={`flex items-start gap-3 p-3 rounded-xl border-2 text-left transition ${form.role === r.value ? r.active : r.color}`}
                >
                  <span className="text-2xl flex-shrink-0 mt-0.5">{r.icon}</span>
                  <div>
                    <p className="font-semibold text-sm leading-tight">{r.label}</p>
                    <p className={`text-xs mt-0.5 leading-snug ${form.role === r.value ? "opacity-90" : "opacity-70"}`}>
                      {r.description}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {/* Selected role highlight */}
            <div className={`mt-2 rounded-lg px-3 py-2 text-xs border ${selectedRole.color}`}>
              <span className="font-semibold">{selectedRole.icon} {selectedRole.label}:</span>{" "}
              {selectedRole.description}
            </div>
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showPw ? "text" : "password"} value={form.password}
                onChange={(e) => set("password", e.target.value)}
                placeholder="Min. 6 characters"
                className={`w-full border rounded-lg px-4 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${fieldErrors.password ? "border-red-400 bg-red-50" : "border-gray-300"}`}
              />
              <button type="button" onClick={() => setShowPw(!showPw)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
                {showPw ? "🙈" : "👁️"}
              </button>
            </div>
            {form.password && strength && (
              <div className="mt-1.5">
                <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full transition-all ${strength.cls} ${strength.bar}`} />
                </div>
                <p className={`text-xs mt-0.5 font-medium ${strength.text}`}>{strength.label}</p>
              </div>
            )}
            {fieldErrors.password && <p className="text-red-500 text-xs mt-1">{fieldErrors.password}</p>}
          </div>

          {/* Confirm Password */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Confirm Password <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showCf ? "text" : "password"} value={form.confirm}
                onChange={(e) => set("confirm", e.target.value)}
                placeholder="Re-enter password"
                className={`w-full border rounded-lg px-4 py-2 pr-11 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${
                  fieldErrors.confirm
                    ? "border-red-400 bg-red-50"
                    : form.confirm && form.confirm === form.password
                    ? "border-green-400"
                    : "border-gray-300"
                }`}
              />
              <button type="button" onClick={() => setShowCf(!showCf)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-lg leading-none">
                {showCf ? "🙈" : "👁️"}
              </button>
            </div>
            {form.confirm && form.confirm === form.password && !fieldErrors.confirm && (
              <p className="text-green-600 text-xs mt-1 font-medium">✓ Passwords match</p>
            )}
            {fieldErrors.confirm && <p className="text-red-500 text-xs mt-1">{fieldErrors.confirm}</p>}
          </div>

          <button
            type="submit" disabled={loading}
            className="w-full bg-green-600 hover:bg-green-700 text-white font-semibold py-2.5 rounded-lg transition disabled:opacity-50 text-sm"
          >
            {loading ? "Creating account…" : `Create Account as ${selectedRole.label}`}
          </button>
        </form>

        <p className="text-center text-sm text-gray-500 mt-5">
          Already have an account?{" "}
          <Link href="/login" className="text-green-600 font-medium hover:underline">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
