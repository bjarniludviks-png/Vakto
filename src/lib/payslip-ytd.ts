// Uppsöfnun frá áramótum á launaseðli („Ársupphæð“ eins og í Payday/DK). Lagt saman úr vistuðum
// launakeyrslum sama árs. Sama tímabil keyrt oftar en einu sinni → aðeins nýjasta keyrslan telur.
import type { PayslipYtd } from "@/lib/doc-pdf";

export type YtdRow = { from: string; to: string; created: string; employeeId: string; v: Required<PayslipYtd> };

const KEYS = ["hours", "dayPay", "premiums", "overtime", "uppbot", "orlof", "benefits", "gross", "pension", "extraPension", "unionFee", "withholding", "net"] as const;

/** payroll_lines-röð (með payroll_runs) → YtdRow. */
export function ytdRowFrom(l: Record<string, unknown>, run: { period_start: string; period_end: string; created_at?: string | null }): YtdRow {
  const n = (k: string) => Number(l[k] ?? 0) || 0;
  return {
    from: run.period_start, to: run.period_end, created: run.created_at ?? "", employeeId: String(l.employee_id),
    v: { hours: n("hours"), dayPay: n("day_pay"), premiums: n("premiums"), overtime: n("overtime"), uppbot: n("uppbot"), orlof: n("orlof"),
      benefits: n("benefits"), gross: n("gross"), pension: n("pension"), extraPension: n("extra_pension"), unionFee: n("union_fee"),
      withholding: n("withholding"), net: n("net") },
  };
}

/** Summa ársins til og með tímabilinu sem hefst `from`. `current` = lína tímabilsins ef hún er ekki vistuð (Launakeyrslur). */
export function ytdFor(rows: YtdRow[], employeeId: string, from: string, current?: Required<PayslipYtd>): Required<PayslipYtd> {
  const year = from.slice(0, 4);
  const latest = new Map<string, YtdRow>();
  for (const r of rows) {
    if (r.employeeId !== employeeId || r.from.slice(0, 4) !== year || r.from > from) continue;
    if (current && r.from === from) continue; // óvistuð lína tímabilsins kemur í staðinn
    const k = `${r.from}|${r.to}`, prev = latest.get(k);
    if (!prev || r.created > prev.created) latest.set(k, r);
  }
  const out = Object.fromEntries(KEYS.map((k) => [k, 0])) as Required<PayslipYtd>;
  for (const r of [...latest.values()].map((x) => x.v).concat(current ? [current] : [])) for (const k of KEYS) out[k] += r[k];
  return out;
}
