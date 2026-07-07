"use server";

// Manager report library (Skýrslusafn) — period-scoped datasets a framkvæmdastjóri
// wants to pull and compare: hours for payroll, overtime/premiums, attendance
// deviations, and orlof/time-bank status. One generic table shape → the client
// exports it as Excel or PDF. Demo fallback when Supabase isn't connected.

import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getEmployees } from "@/lib/employees.server";
import { resolveRuleSet } from "@/lib/payrules";
import { classifyPay, computeFromPunches } from "@/lib/payroll";
import { getTimeBank } from "./timebank.server";

export type ReportKind = "hours" | "overtime" | "attendance" | "timebank";
export type ManagerReport = {
  ok: boolean;
  demo?: boolean;
  title: string;
  company: string;
  columns: string[];
  /** Column indexes rendered right-aligned / numeric in the export. */
  numeric: number[];
  rows: (string | number)[][];
  error?: string;
};

const TITLES: Record<ReportKind, string> = {
  hours: "Launatímar per starfsmaður",
  overtime: "Yfirvinna & álög",
  attendance: "Mæting & frávik",
  timebank: "Orlof & tímabanki",
};

const ORLOF_PCT = 0.1017; // áunnið orlof af unnum tímum

const fail = (kind: ReportKind, error: string): ManagerReport =>
  ({ ok: false, title: TITLES[kind], company: "", columns: [], numeric: [], rows: [], error });

const DEMO_ROWS: Record<ReportKind, { columns: string[]; numeric: number[]; rows: (string | number)[][] }> = {
  hours: {
    columns: ["Starfsmaður", "Deild", "Dagvinna klst", "Álag klst", "Yfirvinna klst", "Samtals klst", "Brúttólaun kr"],
    numeric: [2, 3, 4, 5, 6],
    rows: [
      ["Mína Huong", "Eldhús", 118, 18.5, 6, 142.5, 451000],
      ["Bach Luu", "Sal", 128, 24, 8, 160, 507200],
      ["Phong Ha", "Eldhús", 130, 22, 5.5, 157.5, 489300],
    ],
  },
  overtime: {
    columns: ["Starfsmaður", "Deild", "Yfirvinna klst", "Yfirvinnukostn. kr", "Álagstímar klst", "Álagskostn. kr"],
    numeric: [2, 3, 4, 5],
    rows: [
      ["Ómar Þór", "Sal", 8, 24500, 16, 31200],
      ["Mína Huong", "Eldhús", 6, 18400, 18.5, 34600],
    ],
  },
  attendance: {
    columns: ["Starfsmaður", "Deild", "Áætl. klst", "Raun klst", "Frávik klst", "Vantar útstimplun"],
    numeric: [2, 3, 4, 5],
    rows: [
      ["Mína Huong", "Eldhús", 40, 41.2, 1.2, 0],
      ["Bach Luu", "Sal", 40, 39.1, -0.9, 1],
    ],
  },
  timebank: {
    columns: ["Starfsmaður", "Deild", "Vinnuskylda klst/mán", "Unnið klst (tímabil)", "Áunnið orlof klst", "Tímabanki klst (6 mán)"],
    numeric: [2, 3, 4, 5],
    rows: [
      ["Mína Huong", "Eldhús", 162, 171, 17.4, 9],
      ["Ómar Þór", "Sal", 130, 148, 15.1, 18],
    ],
  },
};

/** Build one manager report over [fromISO, toISO]. */
export async function getManagerReport(kind: ReportKind, fromISO: string, toISO: string): Promise<ManagerReport> {
  const title = TITLES[kind];
  if (!isSupabaseConfigured()) return { ok: true, demo: true, title, company: "Kaffi Krónan", ...DEMO_ROWS[kind] };
  try {
    const { employees, live } = await getEmployees();
    if (!live) return { ok: true, demo: true, title, company: "Kaffi Krónan", ...DEMO_ROWS[kind] };
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return fail(kind, "Ekki innskráð(ur)");
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return fail(kind, "Fyrirtæki fannst ekki");
    const { data: comp } = await supabase.from("companies").select("name").eq("id", company).maybeSingle();
    const companyName = (comp?.name as string) ?? "VAKTO";

    const r1 = (n: number) => Math.round(n * 10) / 10;

    if (kind === "timebank") {
      const tb = await getTimeBank(6);
      const byId = new Map(tb.rows.map((r) => [r.id, r.balance]));
      const { rows: workRows } = await workedHours(supabase, company, employees.map((e) => e.id), fromISO, toISO);
      const rows = employees.map((e) => {
        const worked = r1(workRows.get(e.id) ?? 0);
        return [
          e.fullName, e.department ?? "—",
          r1(173.33 * (e.employmentRatio / 100)),
          worked,
          r1(worked * ORLOF_PCT),
          tb.live ? (byId.get(e.id) ?? 0) : 0,
        ] as (string | number)[];
      });
      return { ok: true, title, company: companyName, columns: DEMO_ROWS.timebank.columns, numeric: DEMO_ROWS.timebank.numeric, rows };
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
      return { ok: true, title, company: companyName, columns: DEMO_ROWS.attendance.columns, numeric: DEMO_ROWS.attendance.numeric, rows };
    }

    // hours + overtime need punch groups + rules per employee.
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
      if (kind === "overtime") {
        if (cls.overtime > 0 || cls.premium > 0) {
          rows.push([e.fullName, e.department ?? "—", cls.overtime, cls.overtimePay, cls.premium, cls.premiumPay]);
        }
      } else {
        const line = computeFromPunches(e, group, rules);
        const day = r1(Math.max(0, cls.total - cls.premium - cls.overtime));
        rows.push([e.fullName, e.department ?? "—", day, cls.premium, cls.overtime, cls.total, line.gross]);
      }
    }
    const meta = kind === "overtime" ? DEMO_ROWS.overtime : DEMO_ROWS.hours;
    return { ok: true, title, company: companyName, columns: meta.columns, numeric: meta.numeric, rows };
  } catch (e) {
    return fail(kind, e instanceof Error ? e.message : "Villa");
  }
}

/** Sum of closed punch hours per employee over a range. */
async function workedHours(
  supabase: Awaited<ReturnType<typeof createClient>>,
  company: string,
  _ids: string[],
  fromISO: string,
  toISO: string,
): Promise<{ rows: Map<string, number> }> {
  const { data: punches } = await supabase.from("punches").select("employee_id, clock_in, clock_out")
    .eq("company_id", company).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59");
  const rows = new Map<string, number>();
  for (const p of punches ?? []) {
    if (!p.clock_out) continue;
    const h = (new Date(p.clock_out as string).getTime() - new Date(p.clock_in as string).getTime()) / 3600000;
    if (h > 0) rows.set(p.employee_id as string, (rows.get(p.employee_id as string) ?? 0) + h);
  }
  return { rows };
}
