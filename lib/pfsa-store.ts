import { programmes, courses, tasks, type Programme } from "@/lib/pfsa-data";

export type Role = "student" | "admin";
export type User = { id: string; name: string; email: string; password: string; role: Role; createdAt: string };
export type Application = { id: string; userId: string; programmeId: string; status: "pending" | "approved" | "rejected"; createdAt: string };
export type Submission = { id: string; userId: string; programmeId: string; week: number; fileName: string; description: string; status: "submitted" | "reviewed"; feedback?: string; submittedAt: string };
export type PaymentClaim = { id: string; userId: string; packageKey: string; utr: string; proofName: string; status: "pending" | "approved" | "follow-up" | "rejected"; createdAt: string };
export type Document = { id: string; number: string; userId: string; type: string; programmeId: string; status: "draft" | "published"; issuedAt: string };
export type AppStore = { version: 1; users: User[]; programmes: Programme[]; courses: typeof courses; applications: Application[]; submissions: Submission[]; payments: PaymentClaim[]; documents: Document[]; batchDate: string };

const KEY = "pfsa-prototype-store-v1", SESSION = "pfsa-prototype-session-v1";
const uid = (kind: string) => `${kind}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
const defaultStore = (): AppStore => ({ version: 1, users: [{ id: "admin-demo", name: "PFSA Administrator", email: "admin@pfsa.demo", password: "admin123", role: "admin", createdAt: new Date().toISOString() }], programmes: programmes.map(x => ({ ...x })), courses: courses.map(x => ({ ...x })), applications: [], submissions: [], payments: [], documents: [{ id: "doc-demo", number: "PFSA-2026-DEMO-001", userId: "student-demo", type: "Digital Letter of Experience", programmeId: "computer-cyber", status: "published", issuedAt: "2026-11-01T00:00:00.000Z" }], batchDate: "2026-12-20" });

export const repo = {
  read(): AppStore { if (typeof window === "undefined") return defaultStore(); const raw = localStorage.getItem(KEY); if (!raw) { const fresh = defaultStore(); localStorage.setItem(KEY, JSON.stringify(fresh)); return fresh; } try { return JSON.parse(raw) as AppStore; } catch { const fresh = defaultStore(); localStorage.setItem(KEY, JSON.stringify(fresh)); return fresh; } },
  write(data: AppStore) { localStorage.setItem(KEY, JSON.stringify(data)); window.dispatchEvent(new Event("pfsa-store-changed")); return data; },
  reset() { return this.write(defaultStore()); },
  session() { return typeof window === "undefined" ? null : localStorage.getItem(SESSION); },
  setSession(id: string | null) { if (id) localStorage.setItem(SESSION, id); else localStorage.removeItem(SESSION); window.dispatchEvent(new Event("pfsa-store-changed")); },
  user() { const state = this.read(); return state.users.find(x => x.id === this.session()) ?? null; },
  register(name: string, email: string, password: string) { const state = this.read(); if (state.users.some(x => x.email.toLowerCase() === email.toLowerCase())) throw new Error("An account already exists for this email."); const user: User = { id: uid("student"), name, email: email.toLowerCase(), password, role: "student", createdAt: new Date().toISOString() }; state.users.push(user); this.write(state); this.setSession(user.id); return user; },
  login(email: string, password: string, role?: Role) { const user = this.read().users.find(x => x.email.toLowerCase() === email.toLowerCase() && x.password === password && (!role || x.role === role)); if (!user) throw new Error(role === "admin" ? "Invalid administrator credentials." : "Invalid email or password."); this.setSession(user.id); return user; },
  apply(programmeId: string) { const user = this.requireStudent(); const state = this.read(); if (state.applications.some(x => x.userId === user.id && x.programmeId === programmeId)) throw new Error("You have already applied for this programme."); state.applications.push({ id: uid("application"), userId: user.id, programmeId, status: "pending", createdAt: new Date().toISOString() }); this.write(state); },
  submit(programmeId: string, week: number, fileName: string, description: string) { const user = this.requireStudent(); if (!fileName) throw new Error("Choose a submission file first."); if (description.trim().split(/\s+/).filter(Boolean).length < 200) throw new Error("Your weekly description must contain at least 200 words."); const state = this.read(); const record: Submission = { id: uid("submission"), userId: user.id, programmeId, week, fileName, description, status: "submitted", submittedAt: new Date().toISOString() }; state.submissions = state.submissions.filter(x => !(x.userId === user.id && x.programmeId === programmeId && x.week === week)); state.submissions.push(record); this.write(state); },
  claimPayment(packageKey: string, utr: string, proofName: string) { const user = this.requireStudent(); const state = this.read(); state.payments.push({ id: uid("payment"), userId: user.id, packageKey, utr, proofName, status: "pending", createdAt: new Date().toISOString() }); this.write(state); },
  requestDocument(type: string, programmeId: string) { const user = this.requireStudent(); const state = this.read(); const number = `PFSA-${new Date().getFullYear()}-${Math.random().toString(36).slice(2, 8).toUpperCase()}`; state.documents.push({ id: uid("document"), number, userId: user.id, type, programmeId, status: "draft", issuedAt: new Date().toISOString() }); this.write(state); return number; },
  adminUpdate(mutator: (s: AppStore) => void) { this.requireAdmin(); const state = this.read(); mutator(state); this.write(state); },
  requireStudent() { const user = this.user(); if (!user || user.role !== "student") throw new Error("Please sign in with a student account."); return user; },
  requireAdmin() { const user = this.user(); if (!user || user.role !== "admin") throw new Error("Please sign in with an administrator account."); return user; },
};

export { tasks };

