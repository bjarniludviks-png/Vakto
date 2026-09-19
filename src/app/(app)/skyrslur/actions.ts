"use server";

// Manager report library (Skýrslusafn) — the three period-scoped datasets a
// framkvæmdastjóri actually pulls: profitability (labor % of revenue per month),
// labor cost per employee, and attendance deviations. One generic table shape →
// the client exports it as Excel or PDF. No demo rows: without a connected
// company the report is simply empty.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { resolveRuleSet } from "@/lib/payrules";
import { classifyPay, computeFromPunches, BURDEN } from "@/lib/payroll";
import { getPerfHistory } from "../frammistada/perf.server";

export type ReportKind = "profit" | "cost" | "attendance";

/** Filter-first reporting: narrow the employee set before any metric runs. */
export type ReportFilters = {
  department?: string;
  location?: string;
  position?: string;
  employee?: string; // name substring
};
export type ManagerReport = {
  ok: boolean;
  title: string;
  company: string;
  columns: string[];
  /** Column indexes rendered right-aligned / numeric in the export. */
  numeric: number[];
  rows: (string | number)[][];
  error?: string;
};

const TITLES: Record<ReportKind, string> = {
  profit: "Arðsemi (laun % af veltu)",
  cost: "Launakostnaður per starfsmaður",
  attendance: "Mæting & frávik",
};

const COLUMNS: Record<ReportKind, { columns: string[]; numeric: number[] }> = {
  profit: { columns: ["Mánuður", "Velta kr", "Launakostnaður kr", "Laun % af veltu", "Framlegð kr"], numeric: [1, 2, 3, 4] },
  cost: { columns: ["Starfsmaður", "Deild", "Klst", "Grunnlaun kr", "Álag kr", "Yfirvinna kr", "Launatengd gjöld kr", "Heildarkostnaður kr"], numeric: [2, 3, 4, 5, 6, 7] },
  attendance: { columns: ["Starfsmaður", "Deild", "Áætl. klst", "Raun klst", "Frávik klst", "Vantar útstimplun"], numeric: [2, 3, 4, 5] },
};

const fail = (kind: ReportKind, error: string): ManagerReport =>
  ({ ok: false, title: TITLES[kind], company: "", columns: [], numeric: [], rows: [], error });
const emptyReport = (kind: ReportKind): ManagerReport =>
  ({ ok: true, title: TITLES[kind], company: "", ...COLUMNS[kind], rows: [] });

/** Apply the report filters to the employee set. */
function applyFilters<E extends { fullName: string; department: string | null; location: string | null; position: string | null }>(employees: E[], f?: ReportFilters): E[] {
  if (!f) return employees;
  return employees.filter((e) =>
    (!f.department || e.department === f.department) &&
    (!f.location || e.location === f.location) &&
    (!f.position || e.position === f.position) &&
    (!f.employee || e.fullName.toLowerCase().includes(f.employee.toLowerCase())),
  );
}

/** Build one manager report over [fromISO, toISO], optionally filtered. */
export async function getManagerReport(kind: ReportKind, fromISO: string, toISO: string, filters?: ReportFilters): Promise<ManagerReport> {
  const title = TITLES[kind];
  if (!isSupabaseConfigured()) return emptyReport(kind);
  try {
    const { employees: allEmployees, live } = await getEmployees();
    if (!live) return emptyReport(kind);
    const employees = applyFilters(allEmployees, filters);
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(kind, "Ekki innskráð(ur)");
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return fail(kind, "Fyrirtæki fannst ekki");
    const { data: comp } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
    const companyName = (comp?.name as string) ?? "VAKTO";

    const r1 = (n: number) => Math.round(n * 10) / 10;

    if (kind === "profit") {
      // Month granularity from the shared perf history, clipped to the period.
      const hist = await getPerfHistory(12);
      const fromYm = fromISO.slice(0, 7), toYm = toISO.slice(0, 7);
      const rows = hist.months
        .filter((m) => m.ym >= fromYm && m.ym <= toYm && (m.revenue > 0 || m.cost > 0))
        .map((m) => [m.label, Math.round(m.revenue), Math.round(m.cost), m.laborPct > 0 ? r1(m.laborPct) : 0, Math.round(Math.max(0, m.revenue - m.cost))] as (string | number)[]);
      return { ok: true, title, company: companyName, ...COLUMNS.profit, rows };
    }

    if (kind === "attendance") {
      const [{ data: shifts }, { data: punches }] = await Promise.all([
        supabase.from("shifts").select("employee_id, start_time, end_time")
          .eq("company_id", company).gte("date", fromISO).lte("date", toISO),
        supabase.from("punches").select("employee_id, clock_in, clock_out")
          .eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59"),
      ]);
      const planned = new Map<string, number>();
      for (const s of shifts ?? []) {
        const [sh, sm] = String(s.start_time ?? "0:0").split(":").map(Number);
        const [eh, em] = String(s.end_time ?? "0:0").split(":").map(Number);
        let h = (eh + em / 60) - (sh + sm / 60); if (h < 0) h += 24;
        planned.set(s.employee_id as string, (planned.get(s.employee_id as string) ?? 0) + h);
      }
      const actual = new Map<string, number>();
      const openCount = new Map<string, number>();
      for (const p of punches ?? []) {
        const eid = p.employee_id as string;
        if (!p.clock_out) { openCount.set(eid, (openCount.get(eid) ?? 0) + 1); continue; }
        const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
        if (h > 0) actual.set(eid, (actual.get(eid) ?? 0) + h);
      }
      const rows = employees.map((e) => {
        const pl = r1(planned.get(e.id) ?? 0), ac = r1(actual.get(e.id) ?? 0);
        return [e.fullName, e.department ?? "—", pl, ac, r1(ac - pl), openCount.get(e.id) ?? 0] as (string | number)[];
      }).filter((r) => Number(r[2]) > 0 || Number(r[3]) > 0 || Number(r[5]) > 0);
      return { ok: true, title, company: companyName, ...COLUMNS.attendance, rows };
    }

    // cost: punch groups + rules per employee.
    const [{ data: punches }, prRes] = await Promise.all([
      supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59"),
      supabase.from("employees").select("id, pay_rule").eq("company_id", company),
    ]);
    const ruleMap = new Map<string, unknown>();
    if (!prRes.error) for (const r of prRes.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never) ?? null);
    const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
    for (const p of punches ?? []) {
      if (!p.clock_out) continue;
      const eid = p.employee_id as string;
      if (!byEmp.has(eid)) byEmp.set(eid, []);
      byEmp.get(eid)!.push({ clockIn: p.clock_in as string, clockOut: p.clock_out as string });
    }

    const rows: (string | number)[][] = [];
    for (const e of employees) {
      const group = byEmp.get(e.id) ?? [];
      if (!group.length) continue;
      const rules = resolveRuleSet(e.union, ruleMap.get(e.id) as never);
      const cls = classifyPay(e.rate, e.payType === "hourly", group, rules);
      const line = computeFromPunches(e, group, rules);
      const levies = Math.round(line.gross * BURDEN);
      const total = line.gross + levies;
      const basePay = Math.max(0, line.gross - cls.overtimePay - cls.premiumPay);
      rows.push([e.fullName, e.department ?? "—", cls.total, basePay, cls.premiumPay, cls.overtimePay, levies, total]);
    }
    return { ok: true, title, company: companyName, ...COLUMNS.cost, rows };
  } catch (e) {
    console.error("[skyrslur] getManagerReport", kind, e);
    return fail(kind, "Tókst ekki að sækja skýrsluna");
  }
}
