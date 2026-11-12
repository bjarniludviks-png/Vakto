import * as XLSX from "xlsx";
import type { PayLine } from "@/lib/payroll";
import { getExportLines, type HourBuckets } from "@/lib/payroll-export.server";
import { payItems } from "@/lib/pay-keys";
import type { CustomRules, PayKeys } from "@/lib/payrules";
import { createClient } from "@/lib/supabase/server";

function csvCell(v: string | number): string {
  const s = String(v);
  return /[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Payday "Hlaða upp tímaskrá" template: Kennitala · Nafn · Dagvinna · Yfirvinna ·
 * Eftirvinna (+ extra columns named exactly like the launaliður in Payday).
 * See hjalp.payday.is/article/131. Kennitala must stay text (leading zeros).
 * Dálkaheiti fylgja launalyklum (pay-keys.ts); án lykla eru þau „Dagvinna“, „Yfirvinna“, „Álag 33%“ eins og áður. */
function paydayTimesheetXlsx(lines: PayLine[], kt: Record<string, string>, hours: Map<string, HourBuckets>, rules?: Map<string, CustomRules>, payKeys?: PayKeys): Buffer {
  // Without punch-based buckets (no period / demo) fall back to the line's total as dagvinna.
  const bucket = (l: PayLine): HourBuckets => hours.get(l.employeeId) ?? { dagvinna: l.hours, yfirvinna: 0, alag: {} };
  const items = new Map(lines.map((l) => [l.employeeId, payItems(bucket(l), rules?.get(l.employeeId), payKeys)]));
  const dagName = payKeys?.dagvinna || "Dagvinna", yfName = payKeys?.yfirvinna || "Yfirvinna";
  // Fastir dálkar fyrst (sniðmát Payday), svo einn dálkur per launalið sem kemur fyrir — álag í prósenturöð.
  const fixed = [dagName, yfName, "Eftirvinna", "Mötuneyti"];
  const extra = [...new Set([...items.values()].flatMap((xs) => xs.map((x) => x.name)))].filter((n) => !fixed.includes(n));
  const pctOf = (n: string) => { const m = /^Álag ([\d,]+)%$/.exec(n); return m ? Number(m[1].replace(",", ".")) : Infinity; };
  extra.sort((a, b) => pctOf(a) - pctOf(b) || a.localeCompare(b, "is"));
  const cols = [...fixed, ...extra];
  const header = ["Kennitala", "Nafn", ...cols];
  const rows = lines
    .filter((l) => bucket(l).dagvinna + bucket(l).yfirvinna > 0)
    .sort((a, b) => a.name.localeCompare(b.name, "is"))
    .map((l) => { const m = new Map((items.get(l.employeeId) ?? []).map((x) => [x.name, x.quantity])); return [kt[l.employeeId] ?? "", l.name, ...cols.map((c) => m.get(c) || null)]; });
  const ws = XLSX.utils.aoa_to_sheet([header, ...rows]);
  // Force kennitala cells to text so Excel/Payday never drop a leading zero.
  for (let r = 1; r <= rows.length; r++) { const c = ws[`A${r + 1}`]; if (c) { c.t = "s"; c.v = String(c.v); } }
  ws["!cols"] = [{ wch: 12 }, { wch: 28 }, ...cols.map((c) => ({ wch: Math.max(10, c.length + 1) }))];
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
    const buf = paydayTimesheetXlsx(lines, kt, hours, got.rules, got.payKeys);
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
    // Deildarnúmer í dk Laun (0110, Stillingar → Tengingar → DK). Tímar hvers starfsmanns skiptast á deildir eftir
    // deild vaktanna (morgunmatur / þrif …) — ein lína per deild. Deild án númers → tómur dálkur (DK notar deild starfsmanns).
    const { data: deps } = me?.company_id
      ? await supabase.from("departments").select("id, dk_code, locations!inner(company_id)").eq("locations.company_id", me.company_id)
      : { data: null };
    const dkDept = new Map((deps ?? []).map((d) => [d.id as string, ((d.dk_code as string | null) ?? "").trim()]));
    type HB = HourBuckets;
    // Launalyklar reglunnar (Band.key / keys, 0113) ganga framar DK-launaliðum eftir prósentu.
    const rowOf = (l: (typeof lines)[number], h: HB, deild: string) => {
      const v = new Map<string, number>();
      const items = payItems(h, got.rules?.get(l.employeeId), null, {
        dagvinna: codes.dagvinna, yfirvinna: codes.yfirvinna || codes.dagvinna, yfirvinna1: codes.yfirvinna || codes.dagvinna,
        alagFallback: (p) => { const c = codes.alag?.[String(Number(p))]; if (!c) missing.add(Number(p)); return c ?? null; },
      });
      for (const it of items) { add(it.name); v.set(it.name, (v.get(it.name) ?? 0) + it.quantity); }
      // Dálkar geta bæst við í síðari línum (lyklar reglu) — línan er því smíðuð eftir á.
      return { name: l.name, deild, has: [...v.values()].some(Boolean), row: () => [(kt[l.employeeId] ?? "").replace(/\D/g, ""), deild, l.name, ...cols.map((c) => (v.get(c) ? num(v.get(c)!) : ""))] };
    };
    // Fastlaunafólk er ekki með: DK greiðir mánaðarlaunin sjálft og tímar á dagvinnulið myndu tvígreiða.
    const dkRows = lines.filter((l) => !got.monthly.has(l.employeeId)).flatMap((l) => {
      const split = got.byDept?.get(l.employeeId);
      if (split && split.size) {
        // Deildir með sama DK-númer (eða ekkert) sameinast í eina línu.
        const merged = new Map<string, HB>();
        for (const [deptId, h] of split) {
          const k = dkDept.get(deptId) ?? "";
          const m = merged.get(k) ?? merged.set(k, { dagvinna: 0, yfirvinna: 0, alag: {}, parts: {} }).get(k)!;
          m.dagvinna += h.dagvinna; m.yfirvinna += h.yfirvinna; if (h.yfirvinna1) m.yfirvinna1 = (m.yfirvinna1 ?? 0) + h.yfirvinna1;
          for (const [p, n] of Object.entries(h.alag)) m.alag[Number(p)] = (m.alag[Number(p)] ?? 0) + n;
          for (const [id, x] of Object.entries(h.parts ?? {})) { const cur = m.parts![id] ?? (m.parts![id] = { pct: x.pct, hours: 0 }); cur.hours += x.hours; }
        }
        return [...merged].map(([deild, h]) => rowOf(l, h, deild));
      }
      return [rowOf(l, hours.get(l.employeeId) ?? { dagvinna: l.hours, yfirvinna: 0, alag: {} }, "")];
    }).filter((r) => r.has).sort((a, b) => a.name.localeCompare(b.name, "is") || a.deild.localeCompare(b.deild)).map((r) => r.row());
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
