import * as XLSX from "xlsx";
import type { PayLine } from "@/lib/payroll";
import { getExportLines, type HourBuckets } from "@/lib/payroll-export.server";
import { createClient } from "@/lib/supabase/server";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Payday "Hlaða upp tímaskrá" template: Kennitala · Nafn · Dagvinna · Yfirvinna ·
 * Eftirvinna (+ extra columns named exactly like the launaliður in Payday).
 * See hjalp.payday.is/article/131. Kennitala must stay text (leading zeros). */
function paydayTimesheetXlsx(lines: PayLine[], kt: Record<string, string>, hours: Map<string, HourBuckets>): Buffer {
  // Without punch-based buckets (no period / demo) fall back to the line's total as dagvinna.
  const bucket = (l: PayLine): HourBuckets => hours.get(l.employeeId) ?? { dagvinna: l.hours, yfirvinna: 0, alag: {} };
  // Einn dálkur per álagsprósentu sem kemur fyrir („Álag 33%“, „Álag 45%“ …) — nöfnin stemma við launaliði í Payday.
  const pcts = [...new Set(lines.flatMap((l) => Object.entries(bucket(l).alag).filter(([, h]) => h > 0).map(([p]) => Number(p))))].sort((a, b) => a - b);
  const header = ["Kennitala", "Nafn", "Dagvinna", "Yfirvinna", "Eftirvinna", "Mötuneyti", ...pcts.map((p) => `Álag ${String(p).replace(".", ",")}%`)];
  const rows = lines
    .filter((l) => bucket(l).dagvinna + bucket(l).yfirvinna > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "is"))
    .map((l) => { const h = bucket(l); return [kt[l.employeeId] ?? "", l.name, h.dagvinna || null, h.yfirvinna || null, null, null, ...pcts.map((p) => h.alag[p] || null)]; });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Force kennitala cells to text so Excel/Payday never drop a leading zero.
  for (let r = 1; r <= rows.length; r++) { const c = ws[`A${r + 1}`]; if (c) { c.t = "s"; c.v = String(c.v); } }
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, { wch: 10 }, ...pcts.map(() => ({ wch: 11 }))];
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
  const got = await getExportLines(from, to);
  if (got.denied) return new Response("Forbidden", { status: 403 });
  // ids: aðeins valdir starfsmenn (hakað í launakeyrslu)
  const ids = (url.searchParams.get("ids") ?? "").split(",").filter(Boolean);
  const { kt, hours } = got;
  const lines = ids.length ? got.lines.filter((l) => ids.includes(l.employeeId)) : got.lines;

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

  if (format === "dk") {
    // dk Laun: CSV-innlestur í launakeyrslu (desk.dk.is „Lesa úr CSV-skrá inn í launakeyrslu“):
    // Kennitala · Deild · Nafn · einn dálkur per launalið með NÚMER launaliðarins sem fyrirsögn, gildi = tímar.
    // Launaliðirnir eru stilltir í Stillingum → Tengingar → DK (companies.dk_paycodes).
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    const { data: me } = user ? await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle() : { data: null };
    const { data: co } = me?.company_id ? await supabase.from("companies").select("dk_paycodes").eq("id", me.company_id).maybeSingle() : { data: null };
    const codes = (co?.dk_paycodes ?? null) as { dagvinna?: string; yfirvinna?: string; alag?: Record<string, string> } | null;
    if (!codes?.dagvinna) return Response.redirect(new URL("/stillingar?tab=tengingar&dk=1", request.url), 303);
    const cols: string[] = [];
    const add = (c?: string) => { if (c && !cols.includes(c)) cols.push(c); };
    add(codes.dagvinna); add(codes.yfirvinna);
    const alagPcts = Object.keys(codes.alag ?? {}).map(Number).sort((a, b) => a - b);
    for (const p of alagPcts) add(codes.alag?.[String(p)]);
    const num = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
    const missing = new Set<number>();
    // Fastlaunafólk er ekki með: DK greiðir mánaðarlaunin sjálft og tímar á dagvinnulið myndu tvígreiða.
    const dkRows = lines.filter((l) => !got.monthly.has(l.employeeId)).map((l) => {
      const h = hours.get(l.employeeId) ?? { dagvinna: l.hours, yfirvinna: 0, alag: {} };
      const v = new Map<string, number>();
      const put = (c: string | undefined, n: number) => { if (c && n) v.set(c, (v.get(c) ?? 0) + n); };
      put(codes.dagvinna, h.dagvinna); put(codes.yfirvinna || codes.dagvinna, h.yfirvinna);
      for (const [p, n] of Object.entries(h.alag)) { const c = codes.alag?.[String(Number(p))]; if (c) put(c, n); else if (n) missing.add(Number(p)); }
      return { name: l.name, row: [(kt[l.employeeId] ?? "").replace(/\D/g, ""), "", l.name, ...cols.map((c) => (v.get(c) ? num(v.get(c)!) : ""))] };
    }).filter((r) => r.row.slice(3).some(Boolean)).sort((a, b) => a.name.localeCompare(b.name, "is")).map((r) => r.row);
    if (missing.size) console.warn("[dk export] álag án launaliðar:", [...missing]);
    const body = "\uFEFF" + [["Kennitala", "Deild", "Nafn", ...cols], ...dkRows].map((r) => r.map(csvCell).join(";")).join("\r\n") + "\r\n";
    const stamp = from && to ? `${from}_${to}` : "timabil";
    return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="dk-launakeyrsla-${stamp}.csv"` } });
  }

  const header = ["Nafn", "Tímar", "Dagvinna", "Álög", "Yfirvinna", "Uppbót", "Brúttó", "Staðgreiðsla", "Lífeyrir", "Félagsgjald", "Útborgað", "Kostnaður m. byrði"];
  const rows = lines.map((l) => [l.name, l.hours, l.dayPay, l.premiums, l.overtime, l.uppbot, l.gross, l.withholding, l.pension, l.union, l.net, l.cost]);

  const csv =
    "﻿" + // BOM so Excel reads Icelandic chars
    [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\r\n") +
    "\r\n";

  const filename = "vakto-laun.csv";
  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
