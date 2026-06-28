// Pure types + helpers — safe to import from Client Components.
export type Employee = {
  id: string;
  fullName: string;
  title: string | null;
  department: string | null;
  position: string | null;
  location: string | null;
  payType: "hourly" | "monthly";
  rate: number;
  employmentRatio: number;
  union: string | null;
  status: string;
  avatarColor: string;
  email: string | null;
  kennitala: string | null;
  phone: string | null;
  bankAccount: string | null;
  role: string;
};

/** Avatar initials = first two letters of the first name (matches the
 * prototype: Mína→MÍ, Bach→BA, Ómar→ÓM). */
export function initials(name: string) {
  return name.trim().split(/\s+/)[0].slice(0, 2).toUpperCase();
}

/** Demo employees mirroring supabase/migrations/0003_seed.sql — used as a
 * fallback so the screen matches the prototype before Supabase is connected. */
export const DEMO_EMPLOYEES: Employee[] = [
  { id: "e1", fullName: "Mína Huong", title: "Vaktstjóri", department: "Eldhús", position: "Kokkur", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 118, union: "Efling", status: "active", avatarColor: "#5b50e6", email: "mina@kaffikronan.is", kennitala: "010195-2389", phone: "+354 691 2389", bankAccount: "0133-26-001234", role: "employee" },
  { id: "e2", fullName: "Bach Luu", title: null, department: "Sal", position: "Þjónn / Sal", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 100, union: "Efling", status: "active", avatarColor: "#1fb6a6", email: "bach@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e3", fullName: "Phong Ha", title: null, department: "Eldhús", position: "Kokkur", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 98, union: "Efling", status: "active", avatarColor: "#18a06a", email: "phong@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e4", fullName: "Jón G.", title: "Rekstrarstjóri", department: "Stjórnun", position: null, location: "Reykjavík Asian", payType: "monthly", rate: 560000, employmentRatio: 100, union: "VR", status: "active", avatarColor: "#8b7bff", email: "jon@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "manager" },
  { id: "e5", fullName: "Ómar S.", title: null, department: "Sal", position: "Þjónn / Sal", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 130, union: "Efling", status: "over_ratio", avatarColor: "#e0533f", email: "omar@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e6", fullName: "Ha Vu", title: null, department: "Eldhús", position: "Kokkur", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 83, union: "Efling", status: "active", avatarColor: "#0891b2", email: "havu@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e7", fullName: "Truong Vu", title: null, department: "Eldhús", position: "Kokkur", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 100, union: "Efling", status: "active", avatarColor: "#0f766e", email: "truong@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e8", fullName: "Moon M.", title: null, department: "Sal", position: "Þjónn / Sal", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 90, union: "Efling", status: "active", avatarColor: "#2563eb", email: "moon@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e9", fullName: "Ngoan Thi", title: null, department: "Eldhús", position: "Kokkur", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 95, union: "Efling", status: "active", avatarColor: "#16a34a", email: "ngoan@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e10", fullName: "Dalya R.", title: null, department: "Sal", position: "Þjónn / Sal", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 80, union: "Efling", status: "active", avatarColor: "#ca8a04", email: "dalya@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e11", fullName: "Fannar F.", title: null, department: "Stjórnun", position: null, location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 100, union: "VR", status: "active", avatarColor: "#9333ea", email: "fannar@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
  { id: "e12", fullName: "Lóa", title: null, department: "Sal", position: "Þjónn / Sal", location: "Reykjavík Asian", payType: "hourly", rate: 2900, employmentRatio: 70, union: "Efling", status: "active", avatarColor: "#e11d48", email: "loa@kaffikronan.is", kennitala: null, phone: null, bankAccount: null, role: "employee" },
];
