"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeFromPunches, totals as sumTotals, type PayLine } from "@/lib/payroll";
import { resolveRuleSet } from "@/lib/payrules";
import { getEmployees } from "@/lib/employees.server";
import { initials } from "@/lib/employees";
import { nf, dec1 } from "@/lib/format";
import { logAudit } from "@/lib/audit";
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

  const lines = employees
    .filter((e) => (byEmp.get(e.id)?.length ?? 0) > 0 || e.payType === "monthly")
    .map((e) => computeFromPunches(e, byEmp.get(e.id) ?? [], resolveRuleSet(e.union, ruleMap.get(e.id))));
  return { lines, needsMigration };
}

/** Period payroll view from approved hours — drives the screen's period selector. */
export async function getPayrollPeriod(from: string, to: string): Promise<PeriodPayroll> {
  const empty: PeriodPayroll = { rows: [], totals: { count: 0, hours: "0", gross: "0", withholding: "0", pensionUnion: "0", net: "0", cost: "0", grossM: "0", netM: "0", costM: "0", withholdingM: "0" }, live: false, needsMigration: false, periodLabel: `${niceISO(from)} – ${niceISO(to)}`, from, to };
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
        grossM: million(t.gross), netM: million(t.net), costM: million(t.cost), withholdingM: million(t.withholding),
      },
      live: true, needsMigration, periodLabel: `${niceISO(from)} – ${niceISO(to)}`, from, to,
    };
  } catch {
    return empty;
  }
}

/** Run + persist payroll for a period using approved worked hours. */
export async function runPayroll(from?: string, to?: string): Promise<RunResult> {
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

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({ company_id: company, period_start: start, period_end: end, status: "approved" })
      .select("id").single();
    if (runErr || !run) return { ok: false, error: runErr?.message ?? "Tókst ekki að stofna keyrslu" };

    const { error: linesErr } = await supabase.from("payroll_lines").insert(
      lines.map((l) => ({
        run_id: run.id, employee_id: l.employeeId, hours: l.hours, gross: l.gross,
        day_pay: l.dayPay, premiums: l.premiums, overtime: l.overtime,
        withholding: l.withholding, pension: l.pension, union_fee: l.union, net: l.net,
      })),
    );
    if (linesErr) return { ok: false, error: linesErr.message };

    await logAudit(supabase, company, ctx.userId, {
      action: "payroll.run", entity: "payroll_run", entityId: run.id as string,
      detail: `Launakeyrsla keyrð (${start}–${end}) — ${lines.length} starfsmenn`,
    });
    revalidatePath("/launakeyrslur");
    return { ok: true, count: lines.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
