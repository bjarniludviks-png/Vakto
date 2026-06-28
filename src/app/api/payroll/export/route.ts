import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { computeLine, type PayLine } from "@/lib/payroll";
import { DEMO_EMPLOYEES, type Employee } from "@/lib/employees";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function getLines(): Promise<{ lines: PayLine[]; kt: Record<string, string>; live: boolean }> {
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
      ? await supabase.from("employees").select("id, full_name, kennitala, pay_type, rate, employment_ratio").eq("company_id", company)
      : { data: null };
    if (!emps?.length) {
      const kt: Record<string, string> = {};
      DEMO_EMPLOYEES.forEach((e) => { if (e.kennitala) kt[e.id] = e.kennitala; });
      return { lines: DEMO_EMPLOYEES.map(computeLine), kt, live: false };
    }
    const kt: Record<string, string> = {};
    const lines = emps.map((e) => {
      if (e.kennitala) kt[e.id as string] = e.kennitala as string;
      return computeLine({
        id: e.id as string, fullName: e.full_name as string,
        payType: (e.pay_type as Employee["payType"]) ?? "hourly",
        rate: Number(e.rate), employmentRatio: Number(e.employment_ratio),
      });
    });
    return { lines, kt, live: true };
  } catch {
    return { lines: DEMO_EMPLOYEES.map(computeLine), kt: {}, live: false };
  }
}

export async function GET(request: Request) {
  const format = new URL(request.url).searchParams.get("format") === "excel" ? "excel" : "payday";
  const { lines, kt } = await getLines();

  let header: string[];
  let rows: (string | number)[][];
  if (format === "payday") {
    header = ["Kennitala", "Nafn", "Tímar", "Brúttó", "Lífeyrir", "Félagsgjald", "Staðgreiðsla", "Útborgað"];
    rows = lines.map((l) => [kt[l.employeeId] ?? "", l.name, l.hours, l.gross, l.pension, l.union, l.withholding, l.net]);
  } else {
    header = ["Nafn", "Tímar", "Dagvinna", "Álög", "Yfirvinna", "Brúttó", "Staðgreiðsla", "Lífeyrir", "Félagsgjald", "Útborgað", "Kostnaður m. byrði"];
    rows = lines.map((l) => [l.name, l.hours, l.dayPay, l.premiums, l.overtime, l.gross, l.withholding, l.pension, l.union, l.net, l.cost]);
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
