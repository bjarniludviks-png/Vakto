import "server-only";
// Historical performance for the live Frammistaða/Innsýn view: velta vs
// launakostnaður per month (incl. laun%), plus a labor-cost breakdown by
// department for the current month. Every number comes from the ONE shared
// labor calculation in src/lib/labor.ts (getLaborPeriods) — no local formula.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getCompanyId, getLaborPeriods } from "@/lib/labor";

const MONTHS_IS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];

/** laborPct null = engin gögn (engin velta eða enginn kostnaður) — aldrei 0 sem staðgengill. */
export type PerfMonth = { label: string; ym: string; revenue: number; cost: number; laborPct: number | null };
export type PerfDept = { name: string; hours: number; cost: number; share: number };
/** prevToDate: fyrri mánuður dag 1..sami dagur og í dag — sanngjarn samanburður við
 * yfirstandandi mánuð (hálfur mánuður á móti heilum gefur −35 % veltu). toDay = dagur mánaðar. */
export type PerfHistory = { live: boolean; months: PerfMonth[]; departments: PerfDept[]; prevToDate?: PerfMonth & { toDay: number } };

const EMPTY: PerfHistory = { live: false, months: [], departments: [] };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Last `monthsBack` months of revenue/cost/laun% + current-month cost by department.
 * laborPct is null for months where it is not computable (no revenue or no cost);
 * months before the company's first activity are left out. */
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

    // Auka-bil: fyrri mánuður til sama dags (fyrir samanburð við yfirstandandi mánuð).
    const pm = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const pmLast = new Date(now.getFullYear(), now.getMonth(), 0).getDate();
    const toDay = Math.min(now.getDate(), pmLast);
    const prevRange = { from: isoOf(pm), to: isoOf(new Date(pm.getFullYear(), pm.getMonth(), toDay)) };
    const all = await getLaborPeriods(supabase, company, [...windows.map((w) => ({ from: w.from, to: w.to })), prevRange]);
    const periods = all.slice(0, windows.length), prevP = all[windows.length];

    const months: PerfMonth[] = windows
      .map((w, i) => ({
        label: w.label,
        ym: `${w.y}-${String(w.m + 1).padStart(2, "0")}`,
        revenue: periods[i].revenue,
        cost: periods[i].cost,
        laborPct: periods[i].pct,
        // mánuðir fyrir fyrstu virkni (eða alveg án gagna) sleppa
        active: periods[i].activeDays > 0 && (periods[i].revenue > 0 || periods[i].hours > 0),
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

    const prevToDate = prevP.activeDays > 0 && (prevP.revenue > 0 || prevP.hours > 0)
      ? { label: `${MONTHS_IS[pm.getMonth()]} ${String(pm.getFullYear()).slice(2)}`, ym: prevRange.from.slice(0, 7), revenue: prevP.revenue, cost: prevP.cost, laborPct: prevP.pct, toDay }
      : undefined;

    return { live: months.length > 0 || departments.length > 0, months, departments, prevToDate };
  } catch {
    return EMPTY;
  }
}
