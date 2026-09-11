import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import * as XLSX from "xlsx";
import { computeLine, computeFromPunches, classifyPay, type PayLine } from "@/lib/payroll";
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

/** Worked hours split the way Payday's timesheet import wants them. */
type HourBuckets = { dagvinna: number; yfirvinna: number };

async function getLines(from?: string, to?: string): Promise<{ lines: PayLine[]; kt: Record<string, string>; hours: Map<string, HourBuckets>; live: boolean }> {
  const hours = new Map<string, HourBuckets>();
  if (!isSupabaseConfigured()) {
    const kt: Record<string, string> = {};
    DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt, hours, live: false };
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
      return { lines: DEMO_EMPLOYEES.map(computeLine), kt, hours, live: false };
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
        .map((e) => {
          const rules = resolveRuleSet(e.union_agreement as string, ruleMap.get(e.id as string));
          const group = byEmp.get(e.id as string) ?? [];
          // Same overtime threshold logic as the pay engine (weekly/monthly), so
          // the Payday hours agree with what Vakto shows.
          const cls = classifyPay(Number(e.rate), e.pay_type === "hourly", group, rules);
          hours.set(e.id as string, { dagvinna: Math.round((cls.total - cls.overtime) * 100) / 100, yfirvinna: Math.round(cls.overtime * 100) / 100 });
          return computeFromPunches(toEmp(e), group, rules);
        });
      return { lines, kt, hours, live: true };
    }

    const lines = emps.map((e) => computeLine(toEmp(e)));
    return { lines, kt, hours, live: true };
  } catch {
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt: {}, hours, live: false };
  }
}

/** Payday "Hlaða upp tímaskrá" template: Kennitala · Nafn · Dagvinna · Yfirvinna ·
 * Eftirvinna (+ extra columns named exactly like the launaliður in Payday).
 * See hjalp.payday.is/article/131. Kennitala must stay text (leading zeros). */
function paydayTimesheetXlsx(lines: PayLine[], kt: Record<string, string>, hours: Map<string, HourBuckets>): Buffer {
  const header = ["Kennitala", "Nafn", "Dagvinna", "Yfirvinna", "Eftirvinna", "Mötuneyti"];
  // Without punch-based buckets (no period / demo) fall back to the line's total as dagvinna.
  const bucket = (l: PayLine): HourBuckets => hours.get(l.employeeId) ?? { dagvinna: l.hours, yfirvinna: 0 };
  const rows = lines
    .filter((l) => bucket(l).dagvinna + bucket(l).yfirvinna > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "is"))
    .map((l) => { const h = bucket(l); return [kt[l.employeeId] ?? "", l.name, h.dagvinna || null, h.yfirvinna || null, null, null]; });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Force kennitala cells to text so Excel/Payday never drop a leading zero.
  for (let r = 1; r <= rows.length; r++) { const c = ws[`A${r + 1}`]; if (c) { c.t = "s"; c.v = String(c.v); } }
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }];
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  return XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const fmtParam = url.searchParams.get("format");
  const format = fmtParam === "excel" ? "excel" : fmtParam === "dk" ? "dk" : "payday";
  const from = url.searchParams.get("from") ?? undefined;
  const to = url.searchParams.get("to") ?? undefined;
  const { lines, kt, hours } = await getLines(from, to);

  if (format === "payday") {
    // Payday imports HOURS per launaliður and prices them itself — so this is a
    // timesheet, not a pay summary. Needs a period (approved punches).
    const buf = paydayTimesheetXlsx(lines, kt, hours);
    const stamp = from && to ? `${from}_${to}` : "timabil";
    return new Response(new Uint8Array(buf), {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="payday-timaskra-${stamp}.xlsx"`,
      },
    });
  }

  let header: string[];
  let rows: (string | number)[][];
  if (format === "dk") {
    // DK launakerfi: kennitala + launaliðir í röð sem DK-innlestur skilur.
    header = ["Kennitala", "Nafn", "Dagvinnustundir", "Yfirvinnustundir", "Dagvinna", "Álag", "Yfirvinna", "Uppbót", "Brúttó"];
    rows = lines.map((l) => [kt[l.employeeId] ?? "", l.name, l.hours, "", l.dayPay, l.premiums, l.overtime, l.uppbot, l.gross]);
  } else {
    header = ["Nafn", "Tímar", "Dagvinna", "Álög", "Yfirvinna", "Uppbót", "Brúttó", "Staðgreiðsla", "Lífeyrir", "Félagsgjald", "Útborgað", "Kostnaður m. byrði"];
    rows = lines.map((l) => [l.name, l.hours, l.dayPay, l.premiums, l.overtime, l.uppbot, l.gross, l.withholding, l.pension, l.union, l.net, l.cost]);
  }

  const csv =
    "﻿" + // BOM so Excel reads Icelandic chars
    [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") +
    "\r\n";

  const filename = format === "dk" ? "vakto-dk.csv" : "vakto-laun.csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
