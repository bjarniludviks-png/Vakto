import "server-only";
import type { createClient } from "@/lib/supabase/server";

type Db = Awaited<ReturnType<typeof createClient>>;

/** Staðir fyrirtækisins og hvernig deildir og starfsfólk raðast á þá (0109).
 * `deptLocs`: deildarheiti → staðir sem hafa deild með því heiti (sama heiti getur verið á fleiri stöðum).
 * `empHome`: starfsmaður → staður aðaldeildar (annars employees.location_id). */
export type LocTree = {
  locations: { id: string; name: string }[];
  deptLocs: Record<string, string[]>;
  empHome: Record<string, string>;
};

export async function getLocTree(supabase: Db, companyId: string): Promise<LocTree> {
  const [locRes, depRes, empRes] = await Promise.all([
    supabase.from("locations").select("id, name").eq("company_id", companyId).order("name"),
    supabase.from("departments").select("name, location_id, locations!inner(company_id)").eq("locations.company_id", companyId),
    supabase.from("employees").select("id, location_id, departments(location_id)").eq("company_id", companyId),
  ]);
  const locations = (locRes.data ?? []).map((l) => ({ id: l.id as string, name: (l.name as string) ?? "" }));
  const deptLocs: Record<string, string[]> = {};
  for (const d of depRes.data ?? []) {
    const n = ((d.name as string) ?? "").trim();
    if (!n || !d.location_id) continue;
    const arr = (deptLocs[n] ??= []);
    if (!arr.includes(d.location_id as string)) arr.push(d.location_id as string);
  }
  const empHome: Record<string, string> = {};
  for (const e of empRes.data ?? []) {
    const dep = (Array.isArray(e.departments) ? e.departments[0] : e.departments) as { location_id?: string } | null;
    const home = dep?.location_id ?? (e.location_id as string | null) ?? null;
    if (home) empHome[e.id as string] = home;
  }
  return { locations, deptLocs, empHome };
}
