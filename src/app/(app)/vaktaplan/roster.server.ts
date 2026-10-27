import "server-only";
import { createClient } from "@/lib/supabase/server";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";

/** Starfsmaður í vaktaplani. `name` er stutta nafnið sem birtist — fornafn, nema tveir heiti
 * það sama (þá „Jan K.“, annars fullt nafn). `depts` = aðaldeild + aðrar deildir (0094). */
export type PlanEmp = { id: string; name: string; full: string; init: string; dept: string; depts: string[]; color: string };

/** Virkt starfsfólk fyrirtækisins fyrir vaktaplanið (óvirkir/hættir ekki með). */
export async function planEmployees(): Promise<{ live: boolean; list: PlanEmp[] }> {
  const { employees, live } = await getEmployees();
  if (!live) return { live, list: [] };
  const active = employees.filter((e) => e.status !== "inactive");
  // Aðrar deildir (0094) — sér fyrirspurn svo planið virki þótt dálkinn vanti.
  const extra = new Map<string, string[]>();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("employees").select("id, extra_departments");
    if (!error) for (const r of data ?? []) extra.set(r.id as string, ((r.extra_departments as string[] | null) ?? []).filter(Boolean));
  } catch { /* án aukadeilda */ }
  const first = (full: string) => full.trim().split(/\s+/)[0] ?? full;
  const short = (full: string) => { const p = full.trim().split(/\s+/); return p.length > 1 ? `${p[0]} ${p[p.length - 1][0]}.` : p[0]; };
  const count = (xs: string[], x: string) => xs.filter((y) => y === x).length;
  const firsts = active.map((e) => first(e.fullName));
  const shorts = active.map((e) => short(e.fullName));
  const list = active.map((e, i) => {
    const name = count(firsts, firsts[i]) === 1 ? firsts[i] : count(shorts, shorts[i]) === 1 ? shorts[i] : e.fullName;
    const dept = e.department ?? "";
    const depts = [...new Set([dept, ...(extra.get(e.id) ?? [])].filter(Boolean))];
    return { id: e.id, name, full: e.fullName, init: initials(e.fullName), dept, depts, color: e.avatarColor };
  });
  return { live, list };
}
