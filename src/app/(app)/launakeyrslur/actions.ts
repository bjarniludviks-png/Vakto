"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeLine } from "@/lib/payroll";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";
import { logAudit } from "@/lib/audit";

export type RunResult = { ok: boolean; demo?: boolean; count?: number; error?: string };

const PERIOD_START = "2026-05-21";
const PERIOD_END = "2026-06-20";

export async function runPayroll(): Promise<RunResult> {
  if (!isSupabaseConfigured()) return { ok: true, demo: true, count: DEMO_EMPLOYEES.length };
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
    const { data: profile } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    const company = profile?.company_id as string | undefined;
    if (!company) return { ok: false, error: "Fyrirtæki fannst ekki" };

    const { data: emps } = await supabase
      .from("employees")
      .select("id, full_name, pay_type, rate, employment_ratio")
      .eq("company_id", company);
    if (!emps?.length) return { ok: false, error: "Engir starfsmenn" };

    const { data: run, error: runErr } = await supabase
      .from("payroll_runs")
      .insert({ company_id: company, period_start: PERIOD_START, period_end: PERIOD_END, status: "approved" })
      .select("id")
      .single();
    if (runErr || !run) return { ok: false, error: runErr?.message ?? "Tókst ekki að stofna keyrslu" };

    const lines = emps.map((e) =>
      computeLine({
        id: e.id as string,
        fullName: e.full_name as string,
        payType: (e.pay_type as Employee["payType"]) ?? "hourly",
        rate: Number(e.rate),
        employmentRatio: Number(e.employment_ratio),
      }),
    );
    const { error: linesErr } = await supabase.from("payroll_lines").insert(
      lines.map((l) => ({
        run_id: run.id,
        employee_id: l.employeeId,
        hours: l.hours,
        gross: l.gross,
        day_pay: l.dayPay,
        premiums: l.premiums,
        overtime: l.overtime,
        withholding: l.withholding,
        pension: l.pension,
        union_fee: l.union,
        net: l.net,
      })),
    );
    if (linesErr) return { ok: false, error: linesErr.message };

    await logAudit(supabase, company, user.id, {
      action: "payroll.run", entity: "payroll_run", entityId: run.id as string,
      detail: `Launakeyrsla keyrð — ${lines.length} starfsmenn`,
    });
    revalidatePath("/launakeyrslur");
    return { ok: true, count: lines.length };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Villa" };
  }
}
