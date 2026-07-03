import axios from "axios";

export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";

/** WebSocket base derived from the API URL (http→ws, https→wss). */
export const WS_BASE = API_BASE.replace(/^http/, "ws");

/** Absolute URL for a file stored in the backend uploads directory. */
export const uploadUrl = (path: string) => `${API_BASE}/uploads/${path}`;

const api = axios.create({ baseURL: API_BASE });

api.interceptors.request.use((config) => {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && typeof window !== "undefined") {
      localStorage.removeItem("token");
      window.location.href = "/login";
    }
    return Promise.reject(err);
  }
);

export const authApi = {
  register: (data: { name: string; email: string; password: string; role?: string; phone?: string }) =>
    api.post("/api/auth/register", data),
  login: (email: string, password: string) => {
    const form = new URLSearchParams();
    form.append("username", email);
    form.append("password", password);
    return api.post("/api/auth/login", form, { headers: { "Content-Type": "application/x-www-form-urlencoded" } });
  },
};

export const petsApi = {
  list: () => api.get("/api/pets"),
  get: (id: number) => api.get(`/api/pets/${id}`),
  create: (data: object) => api.post("/api/pets", data),
  update: (id: number, data: object) => api.put(`/api/pets/${id}`, data),
  delete: (id: number) => api.delete(`/api/pets/${id}`),
  uploadPhoto: (id: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/pets/${id}/photo`, form, { headers: { "Content-Type": "multipart/form-data" } });
  },
  aiRecommendations: (id: number) => api.get(`/api/pets/${id}/ai-recommendations`),
  riskPrediction: (id: number) => api.get(`/api/pets/${id}/risk-prediction`),
  vaccinationSuggestions: (id: number) => api.get(`/api/pets/${id}/vaccination-suggestions`),
  markLost: (id: number, lat?: number, lng?: number) =>
    api.post(`/api/pets/${id}/mark-lost`, null, { params: { lat, lng } }),
  markFound: (id: number) => api.post(`/api/pets/${id}/mark-found`),
};

export const logsApi = {
  logFeeding: (data: object) => api.post("/api/logs/feeding", data),
  getFeeding: (petId: number, days = 7) => api.get(`/api/logs/feeding/${petId}`, { params: { days } }),
  feedingAnalysis: (petId: number) => api.get(`/api/logs/feeding/${petId}/ai-analysis`),
  logActivity: (data: object) => api.post("/api/logs/activity", data),
  getActivity: (petId: number, days = 7) => api.get(`/api/logs/activity/${petId}`, { params: { days } }),
  activityAnalysis: (petId: number) => api.get(`/api/logs/activity/${petId}/ai-analysis`),
  logHealth: (data: object) => api.post("/api/logs/health", data),
  getHealth: (petId: number, days = 30) => api.get(`/api/logs/health/${petId}`, { params: { days } }),
};

export const medicalApi = {
  addVaccination: (data: object) => api.post("/api/medical/vaccinations", data),
  getVaccinations: (petId: number) => api.get(`/api/medical/vaccinations/${petId}`),
  getDueVaccinations: (petId: number) => api.get(`/api/medical/vaccinations/${petId}/due`),
  addMedication: (data: object) => api.post("/api/medical/medications", data),
  getMedications: (petId: number) => api.get(`/api/medical/medications/${petId}`),
  addAppointment: (data: object) => api.post("/api/medical/appointments", data),
  getAppointments: (petId: number) => api.get(`/api/medical/appointments/${petId}`),
  updateAppointment: (id: number, data: object) => api.put(`/api/medical/appointments/${id}`, data),
  getRecords: (petId: number) => api.get(`/api/medical/records/${petId}`),
};

export const aiApi = {
  symptomCheck: (petId: number, symptoms: string) =>
    api.post("/api/ai/symptom-check", { pet_id: petId, symptoms }),
  photoScan: (petId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/ai/photo-scan/${petId}`, form);
  },
  chat: (petId: number, question: string) =>
    api.post("/api/ai/chat", { pet_id: petId, question }),
  monthlyReport: (petId: number) => api.get(`/api/ai/monthly-report/${petId}`),
  interpretSound: (petId: number, soundDescription: string, context: string) =>
    api.post("/api/ai/sound-interpret", { pet_id: petId, sound_description: soundDescription, context }),
};

export const communityApi = {
  reportLost: (data: object) => api.post("/api/community/lost-pets", data),
  getLostPets: () => api.get("/api/community/lost-pets"),
  resolveLost: (reportId: number) => api.put(`/api/community/lost-pets/${reportId}/resolve`),
  createGeofence: (data: object) => api.post("/api/community/geofence", data),
  getGeofences: (petId: number) => api.get(`/api/community/geofence/${petId}`),
  getNotifications: (unreadOnly = false) =>
    api.get("/api/community/notifications", { params: { unread_only: unreadOnly } }),
  markNotificationRead: (id: number) => api.put(`/api/community/notifications/${id}/read`),
};

export const careApi = {
  poisonCheck: (substance: string, petId?: number, amount?: string) =>
    api.post("/api/care/poison-check", { substance, pet_id: petId ?? null, amount: amount || "" }),
  foodScan: (petId: number, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/care/food-scan/${petId}`, form);
  },
  foodCheck: (petId: number, food: string) => api.post("/api/care/food-check", { pet_id: petId, food }),
  carePlan: (petId: number, planType: string, extraContext = "") =>
    api.post("/api/care/plan", { pet_id: petId, plan_type: planType, extra_context: extraContext }),
  behaviorPlan: (petId: number, problem: string) =>
    api.post("/api/care/behavior-plan", { pet_id: petId, problem }),
  onboardingRoadmap: (petId: number, knownHistory: string, visibleSymptoms: string, vaccinationKnown: boolean) =>
    api.post("/api/care/onboarding-roadmap", {
      pet_id: petId, known_history: knownHistory, visible_symptoms: visibleSymptoms, vaccination_known: vaccinationKnown,
    }),
  documentReader: (file: File, docHint = "") => {
    const form = new FormData();
    form.append("file", file);
    form.append("doc_hint", docHint);
    return api.post("/api/care/document-reader", form);
  },
  vaccineSpecies: () => api.get("/api/care/vaccines"),
  vaccinesFor: (species: string) => api.get(`/api/care/vaccines/${species}`),
  vaccineInfo: (vaccineName: string, species: string) =>
    api.post("/api/care/vaccine-info", { vaccine_name: vaccineName, species }),
  medicineInfo: (medicineName: string, species = "") =>
    api.post("/api/care/medicine-info", { medicine_name: medicineName, species }),
};

export const financeApi = {
  addExpense: (data: object) => api.post("/api/finance/expenses", data),
  listExpenses: (petId?: number, months = 12) =>
    api.get("/api/finance/expenses", { params: { pet_id: petId, months } }),
  deleteExpense: (id: number) => api.delete(`/api/finance/expenses/${id}`),
  expenseSummary: (petId?: number, months = 6) =>
    api.get("/api/finance/expenses-summary", { params: { pet_id: petId, months } }),
  addPolicy: (data: object) => api.post("/api/finance/insurance", data),
  listPolicies: (petId?: number) => api.get("/api/finance/insurance", { params: { pet_id: petId } }),
  togglePolicy: (id: number) => api.put(`/api/finance/insurance/${id}/toggle`),
  deletePolicy: (id: number) => api.delete(`/api/finance/insurance/${id}`),
};

export const weightApi = {
  log: (petId: number, weightKg: number, notes?: string) =>
    api.post("/api/logs/weight", { pet_id: petId, weight_kg: weightKg, notes }),
  history: (petId: number, months = 24) =>
    api.get(`/api/logs/weight/${petId}`, { params: { months } }),
};

export const timelineApi = {
  get: (petId: number) => api.get(`/api/pets/${petId}/timeline`),
  emergencySummary: (petId: number) => api.get(`/api/pets/${petId}/emergency-summary`),
};

export const vetApi = {
  getPatients: () => api.get("/api/vet/patients"),
  getPatientSummary: (petId: number) => api.get(`/api/vet/patients/${petId}/summary`),
  getAppointments: () => api.get("/api/vet/appointments"),
  getDashboardStats: () => api.get("/api/vet/dashboard-stats"),
};

export const vetChatApi = {
  listVets: () => api.get("/api/vet-chat/vets"),
  listRooms: () => api.get("/api/vet-chat/rooms"),
  createRoom: (vetId: number, petId?: number) =>
    api.post("/api/vet-chat/rooms", { vet_id: vetId, pet_id: petId ?? null }),
  getMessages: (roomId: number) => api.get(`/api/vet-chat/rooms/${roomId}/messages`),
};

export default api;
