import * as XLSX from "xlsx";
import type { PayLine } from "@/lib/payroll";
import { getExportLines, type HourBuckets } from "@/lib/payroll-export.server";

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
