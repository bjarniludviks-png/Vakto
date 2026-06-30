import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeLine, computeFromPunches, type PayLine } from "@/lib/payroll";
import { resolveRuleSet } from "@/lib/payrules";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const toEmp = (e: Record<string, unknown>): Employee => ({
  id: e.id as string, fullName: e.full_name as string,
  payType: (e.pay_type as Employee["payType"]) ?? "hourly",
  rate: Number(e.rate), employmentRatio: Number(e.employment_ratio),
} as Employee);

async function getLines(from?: string, to?: string): Promise<{ lines: PayLine[]; kt: Record<string, string>; live: boolean }> {
  if (!isSupabaseConfigured()) {
    const kt: Record<string, string> = {};
    DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt, live: false };
  }
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: profile } = user
      ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle()
      : { data: null };
    const company = profile?.company_id as string | undefined;
    const { data: emps } = company
      ? await supabase.from("employees").select("id, full_name, kennitala, pay_type, rate, employment_ratio, union_agreement").eq("company_id", company)
      : { data: null };
    if (!emps?.length) {
      const kt: Record<string, string> = {};
      DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
      return { lines: DEMO_EMPLOYEES.map(computeLine), kt, live: false };
    }
    const kt: Record<string, string> = {};
    emps.forEach((e) => { if (e.kennitala) kt[e.id as string] = e.kennitala as string; });

    // With a period: export approved worked hours. Without: contracted baseline.
    if (from && to && company) {
      let punches: { employee_id: string; clock_in: string; clock_out: string }[] = [];
      const approved = await supabase.from("punches").select("employee_id, clock_in, clock_out")
        .eq("company_id", company).eq("approved", true).not("clock_out", "is", null)
        .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
      if (approved.error) {
        const all = await supabase.from("punches").select("employee_id, clock_in, clock_out")
          .eq("company_id", company).not("clock_out", "is", null)
          .gte("clock_in", from).lte("clock_in", to + "T23:59:59");
        punches = (all.data ?? []) as typeof punches;
      } else punches = (approved.data ?? []) as typeof punches;
      const byEmp = new Map<string, { clockIn: string; clockOut: string }[]>();
      for (const p of punches) {
        if (!byEmp.has(p.employee_id)) byEmp.set(p.employee_id, []);
        byEmp.get(p.employee_id)!.push({ clockIn: p.clock_in, clockOut: p.clock_out });
      }
      const ruleMap = new Map<string, never>();
      const pr = await supabase.from("employees").select("id, pay_rule").eq("company_id", company);
      if (!pr.error) for (const r of pr.data ?? []) ruleMap.set(r.id as string, (r.pay_rule as never));
      const lines = emps
        .filter((e) => (byEmp.get(e.id as string)?.length ?? 0) > 0 || e.pay_type === "monthly")
        .map((e) => computeFromPunches(toEmp(e), byEmp.get(e.id as string) ?? [], resolveRuleSet(e.union_agreement as string, ruleMap.get(e.id as string))));
      return { lines, kt, live: true };
    }

    const lines = emps.map((e) => computeLine(toEmp(e)));
    return { lines, kt, live: true };
  } catch {
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt: {}, live: false };
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const format = url.searchParams.get("format") === "excel" ? "excel" : "payday";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const { lines, kt } = await getLines(from, to);

  let header: string[];
  let rows: (string | number)[][];
  if (format === "payday") {
    header = ["Kennitala", "Nafn", "Tímar", "Uppbót", "Brúttó", "Lífeyrir", "Félagsgjald", "Staðgreiðsla", "Útborgað"];
    rows = lines.map((l) => [kt[l.employeeId] ?? "", l.name, l.hours, l.uppbot, l.gross, l.pension, l.union, l.withholding, l.net]);
  } else {
    header = ["Nafn", "Tímar", "Dagvinna", "Álög", "Yfirvinna", "Uppbót", "Brúttó", "Staðgreiðsla", "Lífeyrir", "Félagsgjald", "Útborgað", "Kostnaður m. byrði"];
    rows = lines.map((l) => [l.name, l.hours, l.dayPay, l.premiums, l.overtime, l.uppbot, l.gross, l.withholding, l.pension, l.union, l.net, l.cost]);
  }

  const csv =
    "﻿" + // BOM so Excel reads Icelandic chars
    [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") +
    "\r\n";

  const filename = format === "payday" ? "vakto-payday-2026-06.csv" : "vakto-laun-2026-06.csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
