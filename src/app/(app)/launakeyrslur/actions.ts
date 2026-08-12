"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeFromPunches, computeUppbot, uppbotForMonth, totals as sumTotals, type PayLine } from "@/lib/payroll";
import { resolveRuleSet, resolveUppbot } from "@/lib/payrules";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { nf, dec1 } from "@/lib/format";
import { logAudit } from "@/lib/audit";
import { notifyEmployee } from "@/lib/push";
import type { PayrollView } from "./payroll.server";

export type RunResult = { ok: boolean; demo?: boolean; count?: number; error?: string };
export type PeriodPayroll = PayrollView & { needsMigration: boolean; periodLabel: string; from: string; to: string };

const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };
const million = (n: number) => dec1(Math.round(n / 100000) / 10);

async function companyOf(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" as const };
  const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
  const company = profile?.company_id as string | undefined;
  if (!company) return { error: "Fyrirtæki fannst ekki" as const };
  return { userId: user.id, company };
}

/** Build payroll lines from APPROVED worked hours in a date range. Falls back to
 * all closed punches (with needsMigration=true) before migration 0008 is run. */
async function approvedLines(supabase: Awaited<ReturnType<typeof createClient>>, company: string, from: string, to: string): Promise<{ lines: PayLine[]; needsMigration: boolean }> {
  const { employees } = await getEmployees();
  let needsMigration = false;
  let punches: { employee_id: string; clock_in: string; clock_out: string }[] = [];
  const approved = await supabase.from("punches")
    .select("employee_id, clock_in, clock_out")
    .eq("company_id", company).eq("approved", true).not("clock_out", "is", null)
    .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
  if (approved.error) {
    needsMigration = true;
    const all = await supabase.from("punches")
      .select("employee_id, clock_in, clock_out")
      .eq("company_id", company).not("clock_out", "is", null)
      .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
    punches = (all.data ?? []) as typeof punches;
  } else {
    punches = (approved.data ?? []) as typeof punches;
  }

  // Punches grouped per employee (for per-shift premium calc).
  const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
  for (const p of punches) {
    if (!byEmp.has(p.employee_id)) byEmp.set(p.employee_id, []);
    byEmp.get(p.employee_id)!.push({ clockIn: p.clock_in, clockOut: p.clock_out });
  }

  // Per-employee custom pay-rule overrides (tolerant — null before migration 0013).
  const ruleMap = new Map<string, { eve: number; weekend: number; overtime: number; holiday: number; night: number } | null>();
  const pr = await supabase.from("employees").select("id, pay_rule").eq("company_id", company);
  if (!pr.error) for (const r of pr.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never) ?? null);

  // Desember-/orlofsuppbót: paid automatically in the June / December run,
  // prorated by starfshlutfall (per the employee's kjarasamningur).
  const uppKind = uppbotForMonth(Number(from.slice(5, 7)));

  const lines = employees
    .filter((e) => (byEmp.get(e.id)?.length ?? 0) > 0 || e.payType === "monthly")
    .map((e) => {
      const ub = uppKind ? computeUppbot(resolveUppbot(e.union)[uppKind], e.employmentRatio) : 0;
      return computeFromPunches(e, byEmp.get(e.id) ?? [], resolveRuleSet(e.union, ruleMap.get(e.id)), ub);
    });
  return { lines, needsMigration };
}

/** Period payroll view from approved hours — drives the screen's period selector. */
export async function getPayrollPeriod(from: string, to: string): Promise<PeriodPayroll> {
  const empty: PeriodPayroll = { rows: [], totals: { count: 0, hours: "0", gross: "0", withholding: "0", pensionUnion: "0", net: "0", cost: "0", grossM: "0", netM: "0", costM: "0", withholdingM: "0", insuranceM: "0" }, live: false, needsMigration: false, periodLabel: `${niceISO(from)} – ${niceISO(to)}`, from, to };
  if (!isSupabaseConfigured()) return empty;
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return empty;
    const { employees, live } = await getEmployees();
    if (!live) return empty;
    const colorOf = (id: string) => employees.find((e) => e.id === id)?.avatarColor ?? "#5b50e6";
    const { lines, needsMigration } = await approvedLines(supabase, ctx.company, from, to);
    const t = sumTotals(lines);
    return {
      rows: lines.map((l) => ({
        n: l.name.split(/\s+/)[0], av: initials(l.name), c: colorOf(l.employeeId),
        h: dec1(l.hours), g: nf(l.gross), w: "−" + nf(l.withholding), p: "−" + nf(l.pension + l.union), net: nf(l.net),
      })),
      totals: {
        count: lines.length, hours: dec1(t.hours), gross: nf(t.gross), withholding: "−" + nf(t.withholding),
        pensionUnion: "−" + nf(t.pension + t.union), net: nf(t.net), cost: nf(t.cost),
        grossM: million(t.gross), netM: million(t.net), costM: million(t.cost), withholdingM: million(t.withholding), insuranceM: million(Math.round(t.gross * 0.0635)),
      },
      live: true, needsMigration, periodLabel: `${niceISO(from)} – ${niceISO(to)}`, from, to,
    };
  } catch {
    return empty;
  }
}

/** Run + persist payroll for a period using approved worked hours. */
export async function runPayroll(from?: string, to?: string, settleIds: string[] = []): Promise<RunResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: 0 };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const company = ctx.company;

    const now = new Date();
    const start = from ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const end = to ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()).padStart(2, "0")}`;

    const { lines } = await approvedLines(supabase, company, start, end);
    if (!lines.length) return { ok: false, error: "Engir samþykktir tímar á tímabilinu" };

    // Optional time-bank settlement — MONTHLY staff with a negative balance.
    // Deduction = owed hours × BASE hourly rate (rate/173,33). Overtime pay
    // and premiums are untouched: when overtime fills the deficit the
    // employee keeps the premium, only the base part cancels.
    const tb = new Map<string, { hours: number; adj: number }>();
    if (settleIds.length) {
      const [{ getTimeBank }, { applyGrossAdjustment }] = await Promise.all([
        import("../skyrslur/timebank.server"), import("@/lib/payroll"),
      ]);
      const bank = await getTimeBank();
      const { data: empsMeta } = await supabase
        .from("employees").select("id, pay_type, rate").eq("company_id", company);
      const metaById = new Map((empsMeta ?? []).map((e) => [e.id as string, e]));
      for (let i = 0; i < lines.length; i++) {
        const l = lines[i];
        if (!settleIds.includes(l.employeeId)) continue;
        const bal = bank.rows.find((r) => r.id === l.employeeId)?.balance ?? 0;
        const meta = metaById.get(l.employeeId);
        if (bal >= 0 || !meta || meta.pay_type !== "monthly") continue;
        const baseHourly = (Number(meta.rate) || 0) / 173.33;
        if (baseHourly <= 0) continue;
        const offsetHours = Math.min(-bal, 173);
        const adj = Math.round(offsetHours * baseHourly);
        lines[i] = applyGrossAdjustment(l, adj);
        tb.set(l.employeeId, { hours: Math.round(offsetHours * 10) / 10, adj });
      }
    }

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({ company_id: company, period_start: start, period_end: end, status: "approved" })
      .select("id").single();
    if (runErr || !run) return { ok: false, error: runErr?.message ?? "Tókst ekki að stofna keyrslu" };

    const baseRow = (l: PayLine) => ({
      run_id: run.id, employee_id: l.employeeId, hours: l.hours, gross: l.gross,
      day_pay: l.dayPay, premiums: l.premiums, overtime: l.overtime,
      withholding: l.withholding, pension: l.pension, union_fee: l.union, net: l.net,
    });
    // Try with the uppbot column (migration 0017); retry without if not yet run.
    let linesErr = (await supabase.from("payroll_lines").insert(
      lines.map((l) => {
        const t2 = tb.get(l.employeeId);
        return { ...baseRow(l), uppbot: l.uppbot, timebank_hours: t2?.hours ?? 0, timebank_adj: t2?.adj ?? 0 };
      }),
    )).error;
    if (linesErr && /timebank/.test(linesErr.message)) {
      linesErr = (await supabase.from("payroll_lines").insert(
        lines.map((l) => ({ ...baseRow(l), uppbot: l.uppbot })),
      )).error;
    }
    if (linesErr) {
      linesErr = (await supabase.from("payroll_lines").insert(lines.map(baseRow))).error;
    }
    if (linesErr) return { ok: false, error: linesErr.message };

    await logAudit(supabase, company, ctx.userId, {
      action: "payroll.run", entity: "payroll_run", entityId: run.id as string,
      detail: `Launakeyrsla keyrð (${start}–${end}) — ${lines.length} starfsmenn`,
    });
    for (const l of lines) {
      void notifyEmployee(l.employeeId, { title: "Launaseðill tilbúinn", body: "Launakeyrsla er tilbúin — skoðaðu launaseðilinn þinn.", url: "/mitt-svaedi", tag: "payroll" });
    }
    revalidatePath("/launakeyrslur");
    return { ok: true, count: lines.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}


export type SettleCandidate = { id: string; name: string; balance: number };

/** Monthly-paid employees with a NEGATIVE time-bank balance — the pool the
 * manager picks from when settling in a payroll run. */
export async function getSettleCandidates(): Promise<{ ok: boolean; rows: SettleCandidate[] }> {
  if (!isSupabaseConfigured()) return { ok: true, rows: [] };
  try {
    const supabase = await createClient();
    const ctx = await companyOf(supabase);
    if ("error" in ctx) return { ok: false, rows: [] };
    const [{ getTimeBank }] = await Promise.all([import("../skyrslur/timebank.server")]);
    const bank = await getTimeBank();
    const { data: emps } = await supabase
      .from("employees").select("id, full_name, pay_type").eq("company_id", ctx.company).eq("pay_type", "monthly");
    const monthly = new Map((emps ?? []).map((e) => [e.id as string, e.full_name as string]));
    const rows = bank.rows
      .filter((r) => r.balance < 0 && monthly.has(r.id))
      .map((r) => ({ id: r.id, name: monthly.get(r.id) ?? r.name, balance: r.balance }));
    return { ok: true, rows };
  } catch {
    return { ok: false, rows: [] };
  }
}


export type PayrollHistory = {
  live: boolean;
  /** Per calendar month (0–11), in kr: net / withholding / pension+union / insurance / orlof. */
  months: { net: number; withholding: number; pension: number; insurance: number; orlof: number }[];
};

/** Aggregate real payroll runs by month for the history chart. */
export async function getPayrollHistory(year: number): Promise<PayrollHistory> {
  const emptyMonths = () => Array.from({ length: 12 }, () => ({ net: 0, withholding: 0, pension: 0, insurance: 0, orlof: 0 }));
  if (!isSupabaseConfigured()) return { live: false, months: emptyMonths() };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { live: false, months: emptyMonths() };
    const { data: prof } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = prof?.company_id as string | undefined;
    if (!company) return { live: false, months: emptyMonths() };
    const { data: runs } = await supabase.from("payroll_runs")
      .select("id, period_start")
      .eq("company_id", company)
      .gte("period_start", `${year}-01-01`).lte("period_start", `${year}-12-31`);
    if (!runs?.length) return { live: true, months: emptyMonths() };
    const runMonth = new Map(runs.map((r) => [r.id as string, new Date(r.period_start as string).getMonth()]));
    const { data: lines } = await supabase.from("payroll_lines")
      .select("run_id, gross, net, withholding, pension, union_fee")
      .in("run_id", runs.map((r) => r.id as string));
    const months = emptyMonths();
    for (const l of lines ?? []) {
      const m = runMonth.get(l.run_id as string);
      if (m == null) continue;
      const gross = Number(l.gross) || 0;
      months[m].net += Number(l.net) || 0;
      months[m].withholding += Number(l.withholding) || 0;
      months[m].pension += (Number(l.pension) || 0) + (Number(l.union_fee) || 0);
      months[m].insurance += gross * 0.0635;
      months[m].orlof += gross * 0.1017;
    }
    return { live: true, months };
  } catch {
    return { live: false, months: emptyMonths() };
  }
}
