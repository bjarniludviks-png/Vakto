import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { nf } from "@/lib/format";

export type LocationRow = { id?: string; name: string; staff: number; timezone: string };
export type PositionRow = { id?: string; name: string; staff: number; baseRate: string; rawRate?: number };
export type UserRow = { name: string; initials: string; role: string; email: string };
export type CompanyInfo = { name: string; kennitala: string; address: string; phone: string; email: string; payPeriodStart?: number };
export type ApiKeyView = { id: string; name: string; prefix: string; created: string; lastUsed: string | null; revoked: boolean };
export type DepartmentRow = { id: string; name: string; location: string; staff: number; color: string | null; members: string[] };
export type SettingsData = { departments: DepartmentRow[]; locations: LocationRow[]; positions: PositionRow[]; users: UserRow[]; apiKeys: ApiKeyView[]; companyId: string | null; company: CompanyInfo | null; live: boolean };

const DEMO: SettingsData = {
  departments: [
    { id: "d1", name: "Eldhús", location: "Reykjavík Asian", staff: 6, color: "#e9700f", members: [] },
    { id: "d2", name: "Sal", location: "Reykjavík Asian", staff: 4, color: "#1fb6a6", members: [] },
  ],
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
  apiKeys: [],
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
      supabase.from("locations").select("id, name, timezone").eq("company_id", company).order("name"),
      supabase.from("positions").select("id, name, base_rate").eq("company_id", company).order("name"),
      supabase.from("users").select("full_name, email, role").eq("company_id", company).order("role"),
      supabase.from("companies").select("name, kennitala, address, phone, email").eq("id", company).maybeSingle(),
    ]);
    // API connections (tolerant of a not-yet-run 0029 migration).
    // Departments live under locations (0001 schema) — join for the company.
    // color column arrives with migration 0038 — tolerant retry without it.
    const depRes0 = await supabase.from("departments")
      .select("id, name, color, locations!inner(name, company_id)")
      .eq("locations.company_id", company).order("name");
    const depData: unknown[] = depRes0.error
      ? ((await supabase.from("departments")
          .select("id, name, locations!inner(name, company_id)")
          .eq("locations.company_id", company).order("name")).data ?? [])
      : (depRes0.data ?? []);
    const departments: DepartmentRow[] = depData.map((d) => {
      const row = d as Record<string, unknown>;
      const loc = row.locations as { name: string } | null;
      const inDept = employees.filter((e) => e.department === (row.name as string));
      return {
        id: row.id as string, name: row.name as string, location: loc?.name ?? "",
        staff: inDept.length,
        color: (row.color as string | null) ?? null,
        members: inDept.map((e) => e.fullName),
      };
    });
    const keysRes = await supabase.from("api_keys")
      .select("id, name, prefix, created_at, last_used_at, revoked")
      .eq("company_id", company).order("created_at", { ascending: false });
    const apiKeys: ApiKeyView[] = (keysRes.data ?? []).map((k) => ({
      id: k.id as string, name: k.name as string, prefix: k.prefix as string,
      created: (k.created_at as string).slice(0, 10),
      lastUsed: k.last_used_at ? (k.last_used_at as string).slice(0, 10) : null,
      revoked: !!k.revoked,
    }));
    // Pay-period start (0036) — tolerant separate fetch.
    let ppd = 1;
    const ppdRes = await supabase.from("companies").select("pay_period_start").eq("id", company).maybeSingle();
    if (!ppdRes.error) { const n = Number(ppdRes.data?.pay_period_start); if (Number.isFinite(n) && n >= 1 && n <= 28) ppd = n; }
    // Tolerant of missing 0026 columns — fall back to name+kennitala only.
    const comp = compRes.error
      ? (await supabase.from("companies").select("name, kennitala").eq("id", company).maybeSingle()).data
      : compRes.data;
    const c = (comp ?? {}) as Record<string, string | null>;

    return {
      departments,
      locations: (locs ?? []).map((l) => ({
        id: l.id as string,
        name: l.name as string, timezone: (l.timezone as string) ?? "Atlantic/Reykjavik",
        staff: countBy("location")(l.name as string),
      })),
      positions: (pos ?? []).map((p) => ({
        id: p.id as string,
        name: p.name as string, baseRate: nf(Number(p.base_rate) || 0), rawRate: Number(p.base_rate) || 0,
        staff: countBy("position")(p.name as string),
      })),
      users: (usrs ?? []).map((u) => ({
        name: (u.full_name as string) ?? (u.email as string) ?? "Notandi",
        initials: ini((u.full_name as string) || (u.email as string) || "VK"),
        role: (u.role as string) ?? "employee",
        email: (u.email as string) ?? "",
      })),
      apiKeys,
      companyId: company,
      company: { name: c.name ?? "", kennitala: c.kennitala ?? "", address: c.address ?? "", phone: c.phone ?? "", email: c.email ?? "", payPeriodStart: ppd },
      live: true,
    };
  } catch {
    return DEMO;
  }
}
