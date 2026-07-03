"use client";
import { useCallback, useEffect, useState } from "react";
import { financeApi } from "@/lib/api";
import PetPicker from "@/components/PetPicker";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LabelList,
} from "recharts";

// Chart tokens (validated palette): single hue for magnitude, hairline grid, muted ink
const SERIES = "#2a78d6";
const GRID = "#e1e0d9";
const MUTED = "#898781";

const CATEGORIES = [
  { key: "food",      label: "Food",      icon: "🍖" },
  { key: "medicine",  label: "Medicine",  icon: "💊" },
  { key: "vet",       label: "Vet",       icon: "🏥" },
  { key: "grooming",  label: "Grooming",  icon: "✂️" },
  { key: "insurance", label: "Insurance", icon: "🛡️" },
  { key: "toys",      label: "Toys",      icon: "🧸" },
  { key: "training",  label: "Training",  icon: "🎓" },
  { key: "other",     label: "Other",     icon: "📦" },
];
const catIcon = (k: string) => CATEGORIES.find((c) => c.key === k)?.icon || "📦";

const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`;

export default function ExpensesPage() {
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [tab, setTab] = useState<"expenses" | "insurance">("expenses");
  const [expenses, setExpenses] = useState<any[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [policies, setPolicies] = useState<any[]>([]);
  const [error, setError] = useState("");

  // Add expense form
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("food");
  const [amount, setAmount] = useState("");
  const [description, setDescription] = useState("");

  // Add policy form
  const [showPolicyForm, setShowPolicyForm] = useState(false);
  const [provider, setProvider] = useState("");
  const [policyNumber, setPolicyNumber] = useState("");
  const [premium, setPremium] = useState("");
  const [frequency, setFrequency] = useState("monthly");
  const [renewal, setRenewal] = useState("");
  const [coverage, setCoverage] = useState("");

  const reload = useCallback(() => {
    if (!selectedPet) return;
    financeApi.listExpenses(selectedPet).then((r) => setExpenses(r.data));
    financeApi.expenseSummary(selectedPet).then((r) => setSummary(r.data));
    financeApi.listPolicies(selectedPet).then((r) => setPolicies(r.data));
  }, [selectedPet]);

  useEffect(reload, [reload]);

  const addExpense = async () => {
    if (!selectedPet || !amount) return;
    setError("");
    try {
      await financeApi.addExpense({ pet_id: selectedPet, category, amount: parseFloat(amount), description });
      setAmount(""); setDescription(""); setShowForm(false);
      reload();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save expense");
    }
  };

  const addPolicy = async () => {
    if (!selectedPet || !provider.trim()) return;
    setError("");
    try {
      await financeApi.addPolicy({
        pet_id: selectedPet, provider, policy_number: policyNumber || null,
        premium_amount: premium ? parseFloat(premium) : null, premium_frequency: frequency,
        renewal_date: renewal ? new Date(renewal).toISOString() : null,
        coverage_summary: coverage || null,
      });
      setProvider(""); setPolicyNumber(""); setPremium(""); setRenewal(""); setCoverage("");
      setShowPolicyForm(false);
      reload();
    } catch (e: any) {
      setError(e.response?.data?.detail || "Failed to save policy");
    }
  };

  const monthData = (summary?.by_month || []).map((m: any) => ({
    ...m,
    label: new Date(m.month + "-01").toLocaleDateString("en", { month: "short" }),
  }));
  const categoryData = summary?.by_category || [];

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">💰 Expenses & Insurance</h1>
      <p className="text-gray-500 mb-6">Track what your pet costs and manage insurance policies</p>

      <PetPicker selected={selectedPet} onSelect={(id) => setSelectedPet(id)} />

      <div className="flex gap-2 mb-6">
        {(["expenses", "insurance"] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize transition ${
              tab === t ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"
            }`}>
            {t === "expenses" ? "💸 Expenses" : "🛡️ Insurance"}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700 mb-6">{error}</div>}

      {tab === "expenses" && (
        <>
          {/* KPI row */}
          {summary && (
            <div className="grid grid-cols-3 gap-3 mb-6">
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">This month</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{fmt(summary.this_month)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Last 6 months</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{fmt(summary.total)}</p>
              </div>
              <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <p className="text-xs text-gray-400 mb-1">Entries</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-800">{summary.count}</p>
              </div>
            </div>
          )}

          {/* Add expense */}
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            {!showForm ? (
              <button onClick={() => setShowForm(true)}
                className="w-full text-sm text-green-600 font-semibold hover:text-green-700 transition">
                + Add expense
              </button>
            ) : (
              <div className="space-y-3">
                <div className="flex flex-wrap gap-2">
                  {CATEGORIES.map((c) => (
                    <button key={c.key} onClick={() => setCategory(c.key)}
                      className={`text-xs rounded-full px-3 py-1.5 border transition ${
                        category === c.key ? "bg-green-600 text-white border-green-600" : "bg-gray-50 text-gray-600 border-gray-200 hover:bg-gray-100"
                      }`}>
                      {c.icon} {c.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-2 flex-col sm:flex-row">
                  <input type="number" min="0" value={amount} onChange={(e) => setAmount(e.target.value)}
                    placeholder="Amount (₹)"
                    className="sm:w-36 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={description} onChange={(e) => setDescription(e.target.value)}
                    placeholder="Description (optional)"
                    className="flex-1 border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <button onClick={addExpense} disabled={!amount}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                    Save
                  </button>
                  <button onClick={() => setShowForm(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 transition">Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Monthly trend */}
          {monthData.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 mb-4 text-sm">Monthly spend</h2>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={monthData} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: MUTED, fontSize: 12 }} axisLine={{ stroke: GRID }} tickLine={false} />
                  <YAxis tick={{ fill: MUTED, fontSize: 12 }} axisLine={false} tickLine={false} width={56}
                    tickFormatter={(v) => `₹${v >= 1000 ? `${(v / 1000).toFixed(0)}k` : v}`} />
                  <Tooltip formatter={(v: any) => [fmt(Number(v)), "Spent"]} cursor={{ fill: "rgba(42,120,214,0.06)" }} />
                  <Bar dataKey="amount" fill={SERIES} radius={[4, 4, 0, 0]} maxBarSize={44} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Category breakdown */}
          {categoryData.length > 0 && (
            <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
              <h2 className="font-semibold text-gray-800 mb-4 text-sm">By category (last 6 months)</h2>
              <ResponsiveContainer width="100%" height={Math.max(140, categoryData.length * 42)}>
                <BarChart data={categoryData} layout="vertical" margin={{ top: 0, right: 56, left: 8, bottom: 0 }}>
                  <CartesianGrid stroke={GRID} horizontal={false} />
                  <XAxis type="number" hide />
                  <YAxis type="category" dataKey="category" tick={{ fill: MUTED, fontSize: 12 }}
                    axisLine={false} tickLine={false} width={80}
                    tickFormatter={(v) => `${catIcon(v)} ${v}`} />
                  <Tooltip formatter={(v: any) => [fmt(Number(v)), "Spent"]} cursor={{ fill: "rgba(42,120,214,0.06)" }} />
                  <Bar dataKey="amount" fill={SERIES} radius={[0, 4, 4, 0]} maxBarSize={22}>
                    <LabelList dataKey="amount" position="right" formatter={(v: any) => fmt(Number(v))}
                      style={{ fill: "#52514e", fontSize: 12 }} />
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Expense list */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 divide-y divide-gray-50">
            {expenses.length === 0 && (
              <p className="p-6 text-sm text-gray-400 text-center">No expenses yet — add your first one above.</p>
            )}
            {expenses.map((e) => (
              <div key={e.id} className="flex items-center gap-3 p-4">
                <span className="text-xl">{catIcon(e.category)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 capitalize">{e.description || e.category}</p>
                  <p className="text-xs text-gray-400">
                    {e.category} · {e.spent_at ? new Date(e.spent_at).toLocaleDateString() : ""}
                  </p>
                </div>
                <span className="text-sm font-semibold text-gray-800">{fmt(e.amount)}</span>
                <button onClick={() => financeApi.deleteExpense(e.id).then(reload)}
                  className="text-gray-300 hover:text-red-500 transition text-sm" title="Delete">✕</button>
              </div>
            ))}
          </div>
        </>
      )}

      {tab === "insurance" && (
        <>
          <div className="bg-white rounded-xl p-5 shadow-sm border border-gray-100 mb-6">
            {!showPolicyForm ? (
              <button onClick={() => setShowPolicyForm(true)}
                className="w-full text-sm text-green-600 font-semibold hover:text-green-700 transition">
                + Add insurance policy
              </button>
            ) : (
              <div className="space-y-3">
                <div className="grid sm:grid-cols-2 gap-3">
                  <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="Provider *"
                    className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input value={policyNumber} onChange={(e) => setPolicyNumber(e.target.value)} placeholder="Policy number"
                    className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <input type="number" min="0" value={premium} onChange={(e) => setPremium(e.target.value)} placeholder="Premium (₹)"
                    className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  <select value={frequency} onChange={(e) => setFrequency(e.target.value)}
                    className="border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 bg-white">
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                  <div>
                    <label className="block text-xs text-gray-400 mb-1">Renewal date</label>
                    <input type="date" value={renewal} onChange={(e) => setRenewal(e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
                  </div>
                </div>
                <textarea value={coverage} onChange={(e) => setCoverage(e.target.value)} rows={2}
                  placeholder="Coverage summary — what's included, limits, exclusions..."
                  className="w-full border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 resize-none" />
                <div className="flex gap-2">
                  <button onClick={addPolicy} disabled={!provider.trim()}
                    className="bg-green-600 hover:bg-green-700 text-white px-6 py-2 rounded-lg text-sm font-semibold transition disabled:opacity-50">
                    Save Policy
                  </button>
                  <button onClick={() => setShowPolicyForm(false)}
                    className="text-sm text-gray-400 hover:text-gray-600 px-3 py-2 transition">Cancel</button>
                </div>
              </div>
            )}
          </div>

          <div className="grid gap-4">
            {policies.length === 0 && (
              <p className="bg-white rounded-xl p-6 text-sm text-gray-400 text-center shadow-sm border border-gray-100">
                No policies yet.
              </p>
            )}
            {policies.map((p) => {
              const renewalSoon = p.renewal_date &&
                new Date(p.renewal_date).getTime() - Date.now() < 30 * 24 * 3600 * 1000;
              return (
                <div key={p.id} className={`bg-white rounded-xl p-5 shadow-sm border ${p.is_active ? "border-gray-100" : "border-gray-100 opacity-60"}`}>
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-gray-800">🛡️ {p.provider}</h3>
                        <span className={`text-xs rounded-full px-2 py-0.5 font-medium ${p.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {p.is_active ? "Active" : "Inactive"}
                        </span>
                        {renewalSoon && p.is_active && (
                          <span className="text-xs rounded-full px-2 py-0.5 font-medium bg-orange-100 text-orange-700">⏰ Renews soon</span>
                        )}
                      </div>
                      {p.policy_number && <p className="text-xs text-gray-400 mt-1">Policy #{p.policy_number}</p>}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => financeApi.togglePolicy(p.id).then(reload)}
                        className="text-xs text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg px-3 py-1.5 transition">
                        {p.is_active ? "Deactivate" : "Activate"}
                      </button>
                      <button onClick={() => financeApi.deletePolicy(p.id).then(reload)}
                        className="text-xs text-red-400 hover:text-red-600 border border-red-100 rounded-lg px-3 py-1.5 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3 mt-4 text-sm">
                    {p.premium_amount != null && (
                      <div><p className="text-xs text-gray-400">Premium</p><p className="font-medium text-gray-700">{fmt(p.premium_amount)} / {p.premium_frequency}</p></div>
                    )}
                    {p.renewal_date && (
                      <div><p className="text-xs text-gray-400">Renewal</p><p className="font-medium text-gray-700">{new Date(p.renewal_date).toLocaleDateString()}</p></div>
                    )}
                  </div>
                  {p.coverage_summary && <p className="text-sm text-gray-500 mt-3 bg-gray-50 rounded-lg p-3">{p.coverage_summary}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
