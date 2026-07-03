import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";

const MONTHLY_HOURS = 173.33;
const MONTHS_IS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];

export type TbMonth = { label: string; required: number; actual: number; delta: number };
export type TbRow = { id: string; name: string; av: string; c: string; dept: string; months: TbMonth[]; balance: number };
export type TimeBank = { live: boolean; rows: TbRow[]; monthLabels: string[] };

// Demo: illustrative accumulated balances.
const DEMO: TbRow[] = [
  { id: "e1", name: "Mína", av: "MÍ", c: "#5b50e6", dept: "Eldhús", balance: 12.5, months: [] },
  { id: "e2", name: "Bach", av: "BA", c: "#1fb6a6", dept: "Sal", balance: -8.0, months: [] },
  { id: "e3", name: "Phong", av: "PH", c: "#0891b2", dept: "Eldhús", balance: 3.2, months: [] },
  { id: "e4", name: "Ha", av: "HA", c: "#7c6ff2", dept: "Eldhús", balance: -14.5, months: [] },
];

/** Accumulated time bank per employee: (actual − contracted) summed over the last
 * `months` completed months. Positive = worked over contract (owed to them);
 * negative = under contract (company has hours "inni" with them). Demo fallback. */
export async function getTimeBank(months = 6): Promise<TimeBank> {
  if (!isSupabaseConfigured()) return { live: false, rows: DEMO, monthLabels: [] };
  try {
    const { employees, live } = await getEmployees();
    if (!live) return { live: false, rows: DEMO, monthLabels: [] };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle() : { data: null };
    const company = profile?.company_id as string | undefined;
    if (!company) return { live: false, rows: DEMO, monthLabels: [] };

    const now = new Date();
    // Month windows (oldest → newest), each a completed calendar month up to current.
    const windows: { y: number; m: number; from: string; to: string; label: string }[] = [];
    for (let i = months - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const y = d.getFullYear(), m = d.getMonth();
      const iso = (dt: Date) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      windows.push({ y, m, from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)), label: `${MONTHS_IS[m]} ${String(y).slice(2)}` });
    }
    const from0 = windows[0].from, to0 = windows[windows.length - 1].to;
    const { data: punches } = await supabase.from("punches")
      .select("employee_id, clock_in, clock_out").eq("company_id", company)
      .gte("clock_in", from0).lte("clock_in", to0 + "T23:59:59");

    // actual hours per employee per month index.
    const actual = new Map<string, number[]>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const ci = new Date(p.clock_in as string);
      const h = (new Date(p.clock_out as string).getTime() - ci.getTime()) / 3600000;
      if (h <= 0) continue;
      const idx = windows.findIndex((w) => w.y === ci.getFullYear() && w.m === ci.getMonth());
      if (idx < 0) continue;
      if (!actual.has(p.employee_id as string)) actual.set(p.employee_id as string, new Array(windows.length).fill(0));
      actual.get(p.employee_id as string)![idx] += h;
    }

    const rows: TbRow[] = employees.map((e) => {
      const required = Math.round(MONTHLY_HOURS * (e.employmentRatio / 100) * 10) / 10;
      const acts = actual.get(e.id) ?? new Array(windows.length).fill(0);
      const monthsOut: TbMonth[] = windows.map((w, i) => {
        const ac = Math.round(acts[i] * 10) / 10;
        return { label: w.label, required, actual: ac, delta: Math.round((ac - required) * 10) / 10 };
      });
      // Only count months where the employee actually has punches (avoid penalising
      // months before they started / with no data).
      const worked = monthsOut.filter((m) => m.actual > 0);
      const balance = Math.round(worked.reduce((a, m) => a + m.delta, 0) * 10) / 10;
      return { id: e.id, name: e.fullName.split(/\s+/)[0], av: initials(e.fullName), c: e.avatarColor, dept: e.department ?? "—", months: monthsOut, balance };
    });
    const anyData = rows.some((r) => r.months.some((m) => m.actual > 0));
    return anyData ? { live: true, rows: rows.sort((a, b) => a.balance - b.balance), monthLabels: windows.map((w) => w.label) } : { live: false, rows: DEMO, monthLabels: [] };
  } catch {
    return { live: false, rows: DEMO, monthLabels: [] };
  }
}
