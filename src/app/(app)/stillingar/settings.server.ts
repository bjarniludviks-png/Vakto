import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { nf } from "@/lib/format";

export type LocationRow = { name: string; staff: number; timezone: string };
export type PositionRow = { name: string; staff: number; baseRate: string };
export type UserRow = { name: string; initials: string; role: string; email: string };
export type CompanyInfo = { name: string; kennitala: string; address: string; phone: string; email: string };
export type SettingsData = { locations: LocationRow[]; positions: PositionRow[]; users: UserRow[]; companyId: string | null; company: CompanyInfo | null; live: boolean };

const DEMO: SettingsData = {
  locations: [
    { name: "Reykjavík Asian", staff: 14, timezone: "Atlantic/Reykjavik" },
    { name: "Hotel Umi", staff: 0, timezone: "Atlantic/Reykjavik" },
  ],
  positions: [
    { name: "Kokkur", staff: 6, baseRate: "2.900" },
    { name: "Þjónn / Sal", staff: 4, baseRate: "2.750" },
    { name: "Bílstjóri", staff: 2, baseRate: "2.650" },
  ],
  users: [
    { name: "Bjarni L.", initials: "BL", role: "owner", email: "Eigandi — fullur aðgangur" },
    { name: "Jón", initials: "JÓ", role: "manager", email: "Rekstrarstjóri — vaktir, laun, skýrslur" },
  ],
  companyId: null,
  company: null,
  live: false,
};

const ini = (s: string) => s.trim().split(/\s+/)[0].slice(0, 2).toUpperCase();

/** Locations / positions / users for Settings, with employee counts. Demo fallback. */
export async function getSettingsData(): Promise<SettingsData> {
  if (!isSupabaseConfigured()) return DEMO;
  try {
    const { employees, live } = await getEmployees();
    if (!live) return DEMO;

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return DEMO;

    const countBy = (key: "location" | "position") => (name: string) =>
      employees.filter((e) => e[key] === name).length;

    const [{ data: locs }, { data: pos }, { data: usrs }, compRes] = await Promise.all([
      supabase.from("locations").select("name, timezone").eq("company_id", company).order("name"),
      supabase.from("positions").select("name, base_rate").eq("company_id", company).order("name"),
      supabase.from("users").select("full_name, email, role").eq("company_id", company).order("role"),
      supabase.from("companies").select("name, kennitala, address, phone, email").eq("id", company).maybeSingle(),
    ]);
    // Tolerant of missing 0026 columns — fall back to name+kennitala only.
    const comp = compRes.error
      ? (await supabase.from("companies").select("name, kennitala").eq("id", company).maybeSingle()).data
      : compRes.data;
    const c = (comp ?? {}) as Record<string, string | null>;

    return {
      locations: (locs ?? []).map((l) => ({
        name: l.name as string, timezone: (l.timezone as string) ?? "Atlantic/Reykjavik",
        staff: countBy("location")(l.name as string),
      })),
      positions: (pos ?? []).map((p) => ({
        name: p.name as string, baseRate: nf(Number(p.base_rate) || 0),
        staff: countBy("position")(p.name as string),
      })),
      users: (usrs ?? []).map((u) => ({
        name: (u.full_name as string) ?? (u.email as string) ?? "Notandi",
        initials: ini((u.full_name as string) || (u.email as string) || "VK"),
        role: (u.role as string) ?? "employee",
        email: (u.email as string) ?? "",
      })),
      companyId: company,
      company: { name: c.name ?? "", kennitala: c.kennitala ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "" },
      live: true,
    };
  } catch {
    return DEMO;
  }
}
