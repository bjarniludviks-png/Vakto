import "server-only";
// Historical performance for the live Frammistaða/Innsýn view: velta vs
// launakostnaður per month (incl. laun%), plus a labor-cost breakdown by
// department for the current month. Every number comes from the ONE shared
// labor calculation in src/lib/labor.ts (getLaborPeriods) — no local formula.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCompanyId, getLaborPeriods } from "@/lib/labor";

const MONTHS_IS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];

export type PerfMonth = { label: string; ym: string; revenue: number; cost: number; laborPct: number };
export type PerfDept = { name: string; hours: number; cost: number; share: number };
export type PerfHistory = { live: boolean; months: PerfMonth[]; departments: PerfDept[] };

const EMPTY: PerfHistory = { live: false, months: [], departments: [] };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Last `monthsBack` months of revenue/cost/laun% + current-month cost by department.
 * laborPct is 0 for months where it is not computable (no revenue or no cost). */
export async function getPerfHistory(monthsBack = 6): Promise<PerfHistory> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const supabase = await createClient();
    const company = await getCompanyId(supabase);
    if (!company) return EMPTY;

    const now = new Date();
    const windows: { y: number; m: number; label: string; from: string; to: string }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const last = new Date(d.getFullYear(), d.getMonth() + 1, 0);
      windows.push({
        y: d.getFullYear(), m: d.getMonth(),
        label: `${MONTHS_IS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        from: isoOf(d),
        to: i === 0 ? isoOf(now) : isoOf(last), // running month: month-to-date (salaries prorate by day)
      });
    }

    const periods = await getLaborPeriods(supabase, company, windows.map((w) => ({ from: w.from, to: w.to })));

    const months: PerfMonth[] = windows
      .map((w, i) => ({
        label: w.label,
        ym: `${w.y}-${String(w.m + 1).padStart(2, "0")}`,
        revenue: periods[i].revenue,
        cost: periods[i].cost,
        laborPct: periods[i].pct ?? 0,
        active: periods[i].revenue > 0 || periods[i].hours > 0, // ignore months before the company had any activity
      }))
      .filter((m) => m.active)
      .map(({ label, ym, revenue, cost, laborPct }) => ({ label, ym, revenue, cost, laborPct }));

    // Current-month labor cost + hours by department (from the same staff rows).
    const cur = periods[periods.length - 1];
    const deptMap = new Map<string, { hours: number; cost: number }>();
    for (const s of cur.staff) {
      if (s.actual <= 0 && s.cost <= 0) continue;
      const d = deptMap.get(s.dept) ?? { hours: 0, cost: 0 };
      d.hours += s.actual; d.cost += s.cost;
      deptMap.set(s.dept, d);
    }
    const totalCost = [...deptMap.values()].reduce((a, d) => a + d.cost, 0);
    const departments: PerfDept[] = [...deptMap.entries()]
      .map(([name, d]) => ({
        name,
        hours: Math.round(d.hours * 10) / 10,
        cost: Math.round(d.cost),
        share: totalCost > 0 ? Math.round((d.cost / totalCost) * 100) : 0,
      }))
      .sort((a, b) => b.cost - a.cost);

    return { live: months.length > 0 || departments.length > 0, months, departments };
  } catch {
    return EMPTY;
  }
}
