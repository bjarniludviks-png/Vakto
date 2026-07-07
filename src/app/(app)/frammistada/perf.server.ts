import "server-only";
// Historical performance for the live Frammistaða view: velta vs launakostnaður
// per month (incl. laun%), plus a labor-cost breakdown by department for the
// current month. Built from the revenue table + punches + employee pay.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { BURDEN } from "@/lib/payroll";

const MONTHS_IS = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
const HOURLY_UPLIFT = 1.18; // avg premium uplift used across the app's quick cost estimates

export type PerfMonth = { label: string; revenue: number; cost: number; laborPct: number };
export type PerfDept = { name: string; hours: number; cost: number; share: number };
export type PerfHistory = { live: boolean; months: PerfMonth[]; departments: PerfDept[] };

const EMPTY: PerfHistory = { live: false, months: [], departments: [] };
const isoOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

/** Last `monthsBack` months of revenue/cost/laun% + current-month cost by department. */
export async function getPerfHistory(monthsBack = 6): Promise<PerfHistory> {
  if (!isSupabaseConfigured()) return EMPTY;
  try {
    const { employees, live } = await getEmployees();
    if (!live) return EMPTY;
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return EMPTY;
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return EMPTY;

    const now = new Date();
    const windows: { y: number; m: number; label: string; days: number; share: number }[] = [];
    for (let i = monthsBack - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const daysInMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
      const isCurrent = i === 0;
      windows.push({
        y: d.getFullYear(), m: d.getMonth(),
        label: `${MONTHS_IS[d.getMonth()]} ${String(d.getFullYear()).slice(2)}`,
        days: daysInMonth,
        share: isCurrent ? Math.min(1, now.getDate() / daysInMonth) : 1, // prorate the running month
      });
    }
    const from = isoOf(new Date(windows[0].y, windows[0].m, 1));
    const to = isoOf(now);

    const { data: locs } = await supabase.from("locations").select("id").eq("company_id", company);
    const locIds = (locs ?? []).map((l) => l.id as string);
    const [{ data: rev }, { data: punches }] = await Promise.all([
      locIds.length
        ? supabase.from("revenue").select("amount, date").in("location_id", locIds).gte("date", from).lte("date", to)
        : Promise.resolve({ data: [] as { amount: number; date: string }[] }),
      supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", from).lte("clock_in", to + "T23:59:59"),
    ]);

    const idx = (y: number, m: number) => windows.findIndex((w) => w.y === y && w.m === m);

    // Revenue per month.
    const revByMonth = new Array(windows.length).fill(0);
    for (const r of rev ?? []) {
      const [y, m] = String(r.date).split("-").map(Number);
      const i = idx(y, m - 1);
      if (i >= 0) revByMonth[i] += Number(r.amount ?? 0);
    }

    // Worked hours per employee per month (+ department totals for the current month).
    const hoursByEmpMonth = new Map<string, number[]>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const ci = new Date(p.clock_in as string);
      const h = (new Date(p.clock_out as string).getTime() - ci.getTime()) / 3600000;
      if (h <= 0) continue;
      const i = idx(ci.getFullYear(), ci.getMonth());
      if (i < 0) continue;
      const eid = p.employee_id as string;
      if (!hoursByEmpMonth.has(eid)) hoursByEmpMonth.set(eid, new Array(windows.length).fill(0));
      hoursByEmpMonth.get(eid)![i] += h;
    }

    // Cost per month: hourly staff = hours × rate × uplift × (1+burden);
    // monthly staff = salary × (1+burden), prorated for the running month.
    const costByMonth = new Array(windows.length).fill(0);
    const anyActivity = windows.map((_, i) => revByMonth[i] > 0 || [...hoursByEmpMonth.values()].some((hs) => hs[i] > 0));
    for (const e of employees) {
      const hs = hoursByEmpMonth.get(e.id) ?? new Array(windows.length).fill(0);
      for (let i = 0; i < windows.length; i++) {
        if (e.payType === "monthly") {
          if (anyActivity[i]) costByMonth[i] += e.rate * (1 + BURDEN) * windows[i].share;
        } else {
          costByMonth[i] += hs[i] * e.rate * HOURLY_UPLIFT * (1 + BURDEN);
        }
      }
    }

    const months: PerfMonth[] = windows
      .map((w, i) => ({
        label: w.label,
        revenue: Math.round(revByMonth[i]),
        cost: Math.round(costByMonth[i]),
        laborPct: revByMonth[i] > 0 ? Math.round((costByMonth[i] / revByMonth[i]) * 1000) / 10 : 0,
      }))
      .filter((m) => m.revenue > 0 || m.cost > 0);

    // Current-month labor cost + hours by department.
    const cur = windows.length - 1;
    const deptMap = new Map<string, { hours: number; cost: number }>();
    for (const e of employees) {
      const dept = e.department ?? "—";
      const hs = (hoursByEmpMonth.get(e.id) ?? [])[cur] ?? 0;
      const cost = e.payType === "monthly"
        ? (anyActivity[cur] ? e.rate * (1 + BURDEN) * windows[cur].share : 0)
        : hs * e.rate * HOURLY_UPLIFT * (1 + BURDEN);
      if (hs <= 0 && cost <= 0) continue;
      const d = deptMap.get(dept) ?? { hours: 0, cost: 0 };
      d.hours += hs; d.cost += cost;
      deptMap.set(dept, d);
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
