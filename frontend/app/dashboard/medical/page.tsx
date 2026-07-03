"use client";
import { useEffect, useState } from "react";
import { petsApi, medicalApi, uploadUrl } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const TABS = ["Appointments", "Vaccinations", "Medications", "Records"];

const APPT_TYPES  = ["checkup", "vaccination", "surgery", "grooming", "emergency", "dental", "follow-up"];
const FREQUENCIES = ["daily", "twice_daily", "weekly", "monthly", "as_needed"];
const RECORD_TYPES = ["lab_result", "surgery", "diagnosis", "prescription", "imaging", "other"];

const STATUS_STYLE: Record<string, string> = {
  pending:   "bg-yellow-100 text-yellow-700",
  confirmed: "bg-blue-100 text-blue-700",
  completed: "bg-green-100 text-green-700",
  cancelled: "bg-red-100 text-red-600",
};

function parseError(err: any): string {
  const detail = err?.response?.data?.detail;
  if (Array.isArray(detail)) return detail.map((e: any) => e.msg || JSON.stringify(e)).join("; ");
  return typeof detail === "string" ? detail : "An error occurred. Please try again.";
}

export default function MedicalPage() {
  const { user } = useAuth();
  const isVet = user?.role === "vet" || user?.role === "admin";

  const [pets, setPets]               = useState<any[]>([]);
  const [selectedPet, setSelectedPet] = useState<number | null>(null);
  const [activeTab, setActiveTab]     = useState("Appointments");
  const [appointments, setAppointments] = useState<any[]>([]);
  const [vaccinations, setVaccinations] = useState<any[]>([]);
  const [medications, setMedications]   = useState<any[]>([]);
  const [records, setRecords]           = useState<any[]>([]);
  const [loading, setLoading]           = useState(false);
  const [formError, setFormError]       = useState("");
  const [success, setSuccess]           = useState("");

  const [apptForm, setApptForm] = useState({ title: "", appointment_type: "checkup", scheduled_at: "", notes: "" });
  const [vacForm,  setVacForm]  = useState({ vaccine_name: "", administered_date: "", next_due_date: "", administered_by: "", batch_number: "" });
  const [medForm,  setMedForm]  = useState({ name: "", dosage: "", frequency: "daily", start_date: "", end_date: "", notes: "" });
  const [updateAppt, setUpdateAppt] = useState<{ id: number; status: string; diagnosis: string; prescription: string } | null>(null);

  useEffect(() => {
    petsApi.list().then((r) => {
      setPets(r.data);
      if (r.data.length > 0) setSelectedPet(r.data[0].id);
    });
  }, []);

  useEffect(() => {
    if (!selectedPet) return;
    medicalApi.getAppointments(selectedPet).then((r) => setAppointments(r.data));
    medicalApi.getVaccinations(selectedPet).then((r) => setVaccinations(r.data));
    medicalApi.getMedications(selectedPet).then((r) => setMedications(r.data));
    medicalApi.getRecords(selectedPet).then((r) => setRecords(r.data));
  }, [selectedPet]);

  const notify = (msg: string) => {
    setSuccess(msg);
    setFormError("");
    setTimeout(() => setSuccess(""), 3000);
  };

  const submit = async (fn: () => Promise<void>) => {
    setLoading(true);
    setFormError("");
    setSuccess("");
    try {
      await fn();
    } catch (err: any) {
      setFormError(parseError(err));
    } finally {
      setLoading(false);
    }
  };

  // ── Appointments ──────────────────────────────────────────────────────────
  const addAppointment = (e: React.FormEvent) => {
    e.preventDefault();
    submit(async () => {
      await medicalApi.addAppointment({ ...apptForm, pet_id: selectedPet });
      setApptForm({ title: "", appointment_type: "checkup", scheduled_at: "", notes: "" });
      const r = await medicalApi.getAppointments(selectedPet!);
      setAppointments(r.data);
      notify("Appointment booked!");
    });
  };

  const saveApptUpdate = async () => {
    if (!updateAppt) return;
    submit(async () => {
      await medicalApi.updateAppointment(updateAppt.id, {
        status: updateAppt.status,
        diagnosis: updateAppt.diagnosis || undefined,
        prescription: updateAppt.prescription || undefined,
      });
      setUpdateAppt(null);
      const r = await medicalApi.getAppointments(selectedPet!);
      setAppointments(r.data);
      notify("Appointment updated!");
    });
  };

  // ── Vaccinations ──────────────────────────────────────────────────────────
  const addVaccination = (e: React.FormEvent) => {
    e.preventDefault();
    submit(async () => {
      await medicalApi.addVaccination({ ...vacForm, pet_id: selectedPet });
      setVacForm({ vaccine_name: "", administered_date: "", next_due_date: "", administered_by: "", batch_number: "" });
      const r = await medicalApi.getVaccinations(selectedPet!);
      setVaccinations(r.data);
      notify("Vaccination recorded!");
    });
  };

  // ── Medications ───────────────────────────────────────────────────────────
  const addMedication = (e: React.FormEvent) => {
    e.preventDefault();
    submit(async () => {
      await medicalApi.addMedication({
        ...medForm, pet_id: selectedPet,
        end_date: medForm.end_date || undefined,
      });
      setMedForm({ name: "", dosage: "", frequency: "daily", start_date: "", end_date: "", notes: "" });
      const r = await medicalApi.getMedications(selectedPet!);
      setMedications(r.data);
      notify("Medication added!");
    });
  };

  const deactivateMed = (id: number) => {
    submit(async () => {
      await medicalApi.updateAppointment; // reuse via medicalApi below
      // call deactivate directly
      const { default: api } = await import("@/lib/api");
      await api.put(`/api/medical/medications/${id}/deactivate`);
      const r = await medicalApi.getMedications(selectedPet!);
      setMedications(r.data);
      notify("Medication stopped.");
    });
  };

  const fieldCls = (err?: boolean) =>
    `w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 ${err ? "border-red-400 bg-red-50" : "border-gray-200"}`;

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">💊 Medical Management</h1>
          {isVet && (
            <span className="inline-block mt-1 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              🏥 Vet Mode — full write access
            </span>
          )}
        </div>
      </div>

      {/* Role info banner */}
      <div className={`rounded-xl p-3 mb-5 text-sm border ${isVet ? "bg-blue-50 border-blue-200 text-blue-800" : "bg-green-50 border-green-200 text-green-800"}`}>
        {isVet ? (
          <><strong>Vet / Admin:</strong> You can confirm/complete appointments, write diagnoses &amp; prescriptions, and delete records.</>
        ) : (
          <><strong>{user?.role === "caretaker" ? "Caretaker" : user?.role === "shelter" ? "Shelter" : "Owner"}:</strong> You can book appointments, log vaccinations &amp; medications. Only vets can add diagnoses and prescriptions.</>
        )}
      </div>

      {/* Pet selector */}
      {pets.length > 0 && (
        <div className="flex gap-2 mb-5 flex-wrap">
          {pets.map((p) => (
            <button key={p.id} onClick={() => setSelectedPet(p.id)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${selectedPet === p.id ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
              {p.species === "dog" ? "🐕" : p.species === "cat" ? "🐈" : "🐾"} {p.name}
            </button>
          ))}
        </div>
      )}

      {/* Alerts */}
      {formError && (
        <div className="bg-red-50 border border-red-200 text-red-600 rounded-lg p-3 mb-4 text-sm flex gap-2">
          <span className="flex-shrink-0">⚠️</span><span>{formError}</span>
        </div>
      )}
      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-lg p-3 mb-4 text-sm flex gap-2">
          <span>✅</span><span>{success}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {TABS.map((t) => (
          <button key={t} onClick={() => { setActiveTab(t); setFormError(""); setSuccess(""); }}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${activeTab === t ? "bg-green-600 text-white" : "bg-white text-gray-600 hover:bg-gray-100 border border-gray-200"}`}>
            {t}
          </button>
        ))}
      </div>

      {/* ── APPOINTMENTS ── */}
      {activeTab === "Appointments" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">📅 Book Appointment</h2>
            <form onSubmit={addAppointment} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Title <span className="text-red-500">*</span></label>
                <input required value={apptForm.title}
                  onChange={(e) => setApptForm({ ...apptForm, title: e.target.value })}
                  placeholder="e.g. Annual checkup" className={fieldCls()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Type</label>
                <select value={apptForm.appointment_type}
                  onChange={(e) => setApptForm({ ...apptForm, appointment_type: e.target.value })}
                  className={fieldCls()}>
                  {APPT_TYPES.map((t) => <option key={t} value={t}>{t.replace("-", " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Date & Time <span className="text-red-500">*</span></label>
                <input type="datetime-local" required value={apptForm.scheduled_at}
                  min={new Date().toISOString().slice(0, 16)}
                  onChange={(e) => setApptForm({ ...apptForm, scheduled_at: e.target.value })}
                  className={fieldCls()} />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Notes</label>
                <textarea rows={2} value={apptForm.notes}
                  onChange={(e) => setApptForm({ ...apptForm, notes: e.target.value })}
                  className={`${fieldCls()} resize-none`} />
              </div>
              <button type="submit" disabled={loading || !selectedPet}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Booking…" : "Book Appointment"}
              </button>
            </form>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">All Appointments</h2>
            {appointments.length === 0
              ? <p className="text-gray-400 text-sm text-center py-8">No appointments yet</p>
              : <div className="space-y-3 max-h-96 overflow-y-auto pr-1">
                  {appointments.map((a) => (
                    <div key={a.id} className="p-3 rounded-lg border border-gray-100 hover:border-gray-200">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-800 text-sm">{a.title}</p>
                        <span className={`text-xs px-2 py-0.5 rounded-full flex-shrink-0 ml-2 ${STATUS_STYLE[a.status]}`}>{a.status}</span>
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5">{new Date(a.scheduled_at).toLocaleString()} · {a.appointment_type}</p>
                      {a.diagnosis    && <p className="text-xs text-blue-600  mt-1">🩺 Diagnosis: {a.diagnosis}</p>}
                      {a.prescription && <p className="text-xs text-purple-600 mt-0.5">💊 Rx: {a.prescription}</p>}
                      {/* Vet update panel */}
                      {isVet && a.status !== "completed" && a.status !== "cancelled" && (
                        <button onClick={() => setUpdateAppt({ id: a.id, status: a.status, diagnosis: a.diagnosis || "", prescription: a.prescription || "" })}
                          className="mt-2 text-xs bg-blue-50 text-blue-700 hover:bg-blue-100 px-3 py-1 rounded-lg transition">
                          ✏️ Update
                        </button>
                      )}
                      {/* Owner cancel */}
                      {!isVet && a.status === "pending" && (
                        <button onClick={() => submit(async () => {
                          await medicalApi.updateAppointment(a.id, { status: "cancelled" });
                          const r = await medicalApi.getAppointments(selectedPet!);
                          setAppointments(r.data);
                          notify("Appointment cancelled.");
                        })}
                          className="mt-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-lg transition">
                          Cancel
                        </button>
                      )}
                    </div>
                  ))}
                </div>}
          </div>

          {/* Vet update modal */}
          {updateAppt && (
            <div className="md:col-span-2 bg-blue-50 border border-blue-200 rounded-xl p-5">
              <h3 className="font-semibold text-blue-800 mb-3">🏥 Vet Update — Appointment #{updateAppt.id}</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Status</label>
                  <select value={updateAppt.status}
                    onChange={(e) => setUpdateAppt({ ...updateAppt, status: e.target.value })}
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400">
                    {["pending", "confirmed", "completed", "cancelled"].map((s) =>
                      <option key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-blue-700 mb-1">Diagnosis</label>
                  <input value={updateAppt.diagnosis}
                    onChange={(e) => setUpdateAppt({ ...updateAppt, diagnosis: e.target.value })}
                    placeholder="e.g. Mild gastritis"
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-blue-700 mb-1">Prescription</label>
                  <input value={updateAppt.prescription}
                    onChange={(e) => setUpdateAppt({ ...updateAppt, prescription: e.target.value })}
                    placeholder="e.g. Metronidazole 250mg twice daily for 5 days"
                    className="w-full border border-blue-200 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-400" />
                </div>
              </div>
              <div className="flex gap-2 mt-3">
                <button onClick={saveApptUpdate} disabled={loading}
                  className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                  {loading ? "Saving…" : "Save Update"}
                </button>
                <button onClick={() => setUpdateAppt(null)} className="bg-white border border-gray-200 text-gray-600 px-5 py-2 rounded-lg text-sm transition hover:bg-gray-50">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── VACCINATIONS ── */}
      {activeTab === "Vaccinations" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">💉 Add Vaccination</h2>
            <form onSubmit={addVaccination} className="space-y-3">
              {[
                { label: "Vaccine Name *", key: "vaccine_name", required: true, placeholder: "e.g. Rabies, Distemper" },
                { label: "Date Administered *", key: "administered_date", type: "date", required: true },
                { label: "Next Due Date", key: "next_due_date", type: "date" },
                { label: "Administered By", key: "administered_by", placeholder: "Dr. Smith / Clinic name" },
                { label: "Batch Number", key: "batch_number", placeholder: "Optional" },
              ].map(({ label, key, type, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type || "text"} required={required} placeholder={placeholder}
                    value={(vacForm as any)[key]}
                    onChange={(e) => setVacForm({ ...vacForm, [key]: e.target.value })}
                    className={fieldCls()} />
                </div>
              ))}
              <button type="submit" disabled={loading || !selectedPet}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Saving…" : "Record Vaccination"}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">Vaccination History</h2>
            {vaccinations.length === 0
              ? <div className="text-center py-10"><div className="text-4xl mb-2">💉</div><p className="text-gray-400 text-sm">No vaccinations recorded</p></div>
              : <div className="space-y-3 max-h-96 overflow-y-auto">
                  {vaccinations.map((v) => {
                    const daysLeft = v.days_until_due;
                    const urgent = daysLeft !== null && daysLeft !== undefined && daysLeft <= 14;
                    return (
                      <div key={v.id} className={`p-3 rounded-lg border ${urgent ? "border-yellow-300 bg-yellow-50" : "border-gray-100 bg-gray-50"}`}>
                        <div className="flex justify-between items-start">
                          <p className="font-medium text-gray-800 text-sm">💉 {v.vaccine_name}</p>
                          {urgent && <span className="text-xs bg-yellow-200 text-yellow-800 px-2 py-0.5 rounded-full">Due soon</span>}
                        </div>
                        <p className="text-xs text-gray-500 mt-0.5">Given: {new Date(v.administered_date).toLocaleDateString()}</p>
                        {v.administered_by && <p className="text-xs text-gray-400">By: {v.administered_by}</p>}
                        {v.next_due_date && (
                          <p className={`text-xs mt-0.5 font-medium ${urgent ? "text-yellow-700" : "text-gray-500"}`}>
                            Next due: {new Date(v.next_due_date).toLocaleDateString()}
                            {daysLeft !== null && daysLeft !== undefined && ` (${daysLeft} days)`}
                          </p>
                        )}
                        {v.batch_number && <p className="text-xs text-gray-400">Batch: {v.batch_number}</p>}
                      </div>
                    );
                  })}
                </div>}
          </div>
        </div>
      )}

      {/* ── MEDICATIONS ── */}
      {activeTab === "Medications" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">💊 Add Medication</h2>
            <form onSubmit={addMedication} className="space-y-3">
              {[
                { label: "Medication Name *", key: "name", required: true, placeholder: "e.g. Metronidazole" },
                { label: "Dosage *", key: "dosage", required: true, placeholder: "e.g. 250mg, 1 tablet" },
                { label: "Start Date *", key: "start_date", type: "date", required: true },
                { label: "End Date", key: "end_date", type: "date" },
                { label: "Notes", key: "notes", placeholder: "With food, etc." },
              ].map(({ label, key, type, required, placeholder }) => (
                <div key={key}>
                  <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
                  <input type={type || "text"} required={required} placeholder={placeholder}
                    value={(medForm as any)[key]}
                    onChange={(e) => setMedForm({ ...medForm, [key]: e.target.value })}
                    className={fieldCls()} />
                </div>
              ))}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Frequency</label>
                <select value={medForm.frequency}
                  onChange={(e) => setMedForm({ ...medForm, frequency: e.target.value })}
                  className={fieldCls()}>
                  {FREQUENCIES.map((f) => <option key={f} value={f}>{f.replace(/_/g, " ")}</option>)}
                </select>
              </div>
              <button type="submit" disabled={loading || !selectedPet}
                className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
                {loading ? "Adding…" : "Add Medication"}
              </button>
            </form>
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">Active Medications</h2>
            {medications.length === 0
              ? <div className="text-center py-10"><div className="text-4xl mb-2">💊</div><p className="text-gray-400 text-sm">No active medications</p></div>
              : <div className="space-y-3 max-h-96 overflow-y-auto">
                  {medications.map((m) => (
                    <div key={m.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100">
                      <div className="flex justify-between items-start">
                        <p className="font-medium text-gray-800 text-sm">💊 {m.name}</p>
                        <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-full flex-shrink-0">{m.frequency.replace(/_/g, " ")}</span>
                      </div>
                      <p className="text-xs text-gray-600 mt-0.5">Dosage: <strong>{m.dosage}</strong></p>
                      <p className="text-xs text-gray-400">Started: {new Date(m.start_date).toLocaleDateString()} · {m.days_on_medication} days</p>
                      {m.end_date && <p className="text-xs text-gray-400">Until: {new Date(m.end_date).toLocaleDateString()}</p>}
                      {m.notes && <p className="text-xs text-gray-500 italic mt-0.5">{m.notes}</p>}
                      <button onClick={() => deactivateMed(m.id)} disabled={loading}
                        className="mt-2 text-xs bg-red-50 text-red-600 hover:bg-red-100 px-3 py-1 rounded-lg transition disabled:opacity-50">
                        Stop Medication
                      </button>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      )}

      {/* ── RECORDS ── */}
      {activeTab === "Records" && (
        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-1">📁 Upload Medical Record</h2>
            <p className="text-xs text-gray-400 mb-4">Accepted: PDF, JPG, PNG, DOC · Max 10 MB</p>
            <UploadRecordForm petId={selectedPet} recordTypes={RECORD_TYPES} onSuccess={(msg) => {
              notify(msg);
              if (selectedPet) medicalApi.getRecords(selectedPet).then((r) => setRecords(r.data));
            }} />
          </div>
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-semibold text-gray-800 mb-4">Medical Records</h2>
            {records.length === 0
              ? <div className="text-center py-10"><div className="text-4xl mb-2">📁</div><p className="text-gray-400 text-sm">No records uploaded</p></div>
              : <div className="space-y-3 max-h-96 overflow-y-auto">
                  {records.map((r) => (
                    <div key={r.id} className="p-3 rounded-lg bg-gray-50 border border-gray-100 flex items-start gap-3">
                      <span className="text-2xl flex-shrink-0">
                        {r.record_type === "lab_result" ? "🔬" : r.record_type === "imaging" ? "🩻" : r.record_type === "prescription" ? "💊" : "📄"}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-gray-800 text-sm truncate">{r.title}</p>
                        <p className="text-xs text-gray-400">{r.record_type.replace(/_/g, " ")} · {new Date(r.recorded_at).toLocaleDateString()}</p>
                        {r.recorded_by && <p className="text-xs text-gray-400">By: {r.recorded_by}</p>}
                      </div>
                      <a href={uploadUrl(r.file_path)} target="_blank" rel="noreferrer"
                        className="text-xs bg-green-50 text-green-700 hover:bg-green-100 px-2 py-1 rounded-lg transition flex-shrink-0">
                        View
                      </a>
                    </div>
                  ))}
                </div>}
          </div>
        </div>
      )}
    </div>
  );
}

// ── Upload Record Sub-component ───────────────────────────────────────────────
function UploadRecordForm({ petId, recordTypes, onSuccess }: {
  petId: number | null; recordTypes: string[]; onSuccess: (msg: string) => void;
}) {
  const [title, setTitle]           = useState("");
  const [recordType, setRecordType] = useState("lab_result");
  const [file, setFile]             = useState<File | null>(null);
  const [error, setError]           = useState("");
  const [loading, setLoading]       = useState(false);

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!petId || !file) { setError("Please select a file."); return; }
    if (!title.trim())   { setError("Record title is required."); return; }
    setLoading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      const { default: api } = await import("@/lib/api");
      await api.post(`/api/medical/records/${petId}/upload?record_type=${recordType}&title=${encodeURIComponent(title)}`, form);
      setTitle(""); setFile(null);
      onSuccess("Record uploaded!");
    } catch (err: any) {
      const d = err?.response?.data?.detail;
      setError(typeof d === "string" ? d : "Upload failed.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleUpload} className="space-y-3">
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Title *</label>
        <input required value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g. Blood test results – Jan 2025"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500" />
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">Record Type</label>
        <select value={recordType} onChange={(e) => setRecordType(e.target.value)}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-green-500">
          {recordTypes.map((t) => <option key={t} value={t}>{t.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase())}</option>)}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-gray-600 mb-1">File *</label>
        <input type="file" accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="w-full text-sm text-gray-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-green-50 file:text-green-700 hover:file:bg-green-100" />
      </div>
      <button type="submit" disabled={loading || !petId}
        className="w-full bg-green-600 hover:bg-green-700 text-white py-2 rounded-lg text-sm font-medium transition disabled:opacity-50">
        {loading ? "Uploading…" : "Upload Record"}
      </button>
    </form>
  );
}
