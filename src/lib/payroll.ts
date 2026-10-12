// Icelandic payroll calc (brief §9) — pure, deterministic. Used by the payroll
// run (persistence), the Payday/Excel export, and the labor% metric.
import type { Employee } from "@/lib/employees";
import type { RuleSet, CustomRules, Band } from "@/lib/payrules";

export const PERSONAL_ALLOWANCE = 68691; // persónuafsláttur kr/mán
export const BURDEN = 0.302; // launatengd gjöld ~30,2%
const WITHHOLDING_RATE = 0.3162; // staðgreiðsla (samsett þrep, einföldun)
const PENSION_RATE = 0.04; // lífeyrir
const UNION_RATE = 0.01; // félagsgjald
const MONTHLY_HOURS = 173.33;

export type PayLine = {
  employeeId: string;
  name: string;
  hours: number;
  gross: number;
  dayPay: number;
  premiums: number;
  overtime: number;
  uppbot: number; // desember-/orlofsuppbót this period (0 outside June/December)
  withholding: number;
  pension: number;
  union: number;
  net: number;
  cost: number; // employer cost incl. burden
};

type EmpPick = Pick<Employee, "id" | "fullName" | "payType" | "rate" | "employmentRatio">;

// baseGross = pay from worked/contracted hours. uppbot is added on top (taxable +
// pension-bearing) and tracked separately so it shows as its own launaliður.
// split = raunveruleg sundurliðun (úr stimplunum). Án hennar er notuð gróf skipting sem má
// ALDREI birta á launaseðli — aðeins fyrir yfirlitstölur (computeLine, demo).
function finalize(e: EmpPick, hours: number, baseGross: number, uppbot = 0, split?: { dayPay: number; premiums: number; overtime: number }): PayLine {
  const dayPay = split ? Math.round(split.dayPay) : Math.round(baseGross * 0.78);
  const premiums = split ? Math.round(split.premiums) : Math.round(baseGross * 0.15);
  const overtime = split ? Math.round(baseGross) - dayPay - premiums : Math.round(baseGross - dayPay - premiums);
  const gross = Math.round(baseGross) + Math.round(uppbot);
  const pension = Math.round(gross * PENSION_RATE);
  const union = Math.round(gross * UNION_RATE);
  const taxable = gross - pension;
  const withholding = Math.max(0, Math.round(taxable * WITHHOLDING_RATE - PERSONAL_ALLOWANCE));
  const net = Math.round(gross - pension - union - withholding);
  const cost = Math.round(gross * (1 + BURDEN));
  return { employeeId: e.id, name: e.fullName, hours, gross, dayPay, premiums, overtime, uppbot: Math.round(uppbot), withholding, pension, union, net, cost };
}

/** Contracted-hours payroll line (monthly baseline). */
export function computeLine(e: EmpPick, uppbot = 0): PayLine {
  const hours = Math.round(MONTHLY_HOURS * (e.employmentRatio / 100));
  const gross = e.payType === "monthly" ? e.rate : hours * e.rate * 1.18;
  return finalize(e, hours, gross, uppbot);
}

/** Payroll line from actual worked hours (from approved punches in a period).
 * Hourly: gross = worked × rate × uplift. Monthly: full monthly salary. */
export function computeLineHours(e: EmpPick, workedHours: number, uppbot = 0): PayLine {
  const hours = Math.round(workedHours * 10) / 10;
  const gross = e.payType === "monthly" ? e.rate : Math.round(workedHours * e.rate * 1.18);
  return finalize(e, hours, gross, uppbot);
}

// ---------- desember- & orlofsuppbót ----------
/** Prorated uppbót. annual = kr/ár @100%, ratio = starfshlutfall %, monthsServed = months in the qualifying period (0–12). */
export function computeUppbot(annual: number, employmentRatio: number, monthsServed = 12): number {
  const r = Math.max(0, Math.min(1, employmentRatio / 100));
  const m = Math.max(0, Math.min(12, monthsServed));
  return Math.round(annual * r * (m / 12));
}
/** Which uppbót (if any) a payroll month pays. orlof → June, desember → December. */
export function uppbotForMonth(month1to12: number): "orlof" | "desember" | null {
  if (month1to12 === 6) return "orlof";
  if (month1to12 === 12) return "desember";
  return null;
}

// Helgidagar reiknaðir fyrir hvaða ár sem er (páskar með Gauss/Meeus-reglunni).
// ⚠️ ÓSTAÐFEST gagnvart einstökum kjarasamningum — skiptingin fylgir almennu reglunni á vinnumarkaði:
//   Stórhátíðardagar (stórhátíðarálag): nýársdagur, föstudagurinn langi, páskadagur, hvítasunnudagur,
//     17. júní, aðfangadagur frá kl. 12, jóladagur, gamlársdagur frá kl. 12.
//   Aðrir frídagar (sama álag og um helgar): skírdagur, annar í páskum, sumardagurinn fyrsti, 1. maí,
//     uppstigningardagur, annar í hvítasunnu, frídagur verslunarmanna, annar í jólum.
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const yearCache = new Map<number, { stor: Set<string>; half: Set<string>; fri: Set<string> }>();
function holidaysOf(y: number) {
  const hit = yearCache.get(y); if (hit) return hit;
  const E = easter(y), plus = (n: number) => isoOf(new Date(y, E.getMonth(), E.getDate() + n));
  const sumar = (() => { for (let d = 19; d <= 25; d++) if (new Date(y, 3, d).getDay() === 4) return `${y}-04-${pad2(d)}`; return `${y}-04-23`; })();
  const versl = (() => { for (let d = 1; d <= 7; d++) if (new Date(y, 7, d).getDay() === 1) return `${y}-08-${pad2(d)}`; return `${y}-08-01`; })();
  const out = {
    stor: new Set([`${y}-01-01`, plus(-2), plus(0), plus(49), `${y}-06-17`, `${y}-12-25`]),
    half: new Set([`${y}-12-24`, `${y}-12-31`]),                       // stórhátíð frá kl. 12
    fri: new Set([plus(-3), plus(1), sumar, `${y}-05-01`, plus(39), plus(50), versl, `${y}-12-26`]),
  };
  yearCache.set(y, out); return out;
}
/** Stórhátíðarálag á þessari stundu? (Aðfangadagur og gamlársdagur aðeins frá kl. 12.) */
export function isStorhatid(dt: Date): boolean {
  const h = holidaysOf(dt.getFullYear()), iso = isoOf(dt);
  return h.stor.has(iso) || (h.half.has(iso) && dt.getHours() >= 12);
}
/** Almennur frídagur (ekki stórhátíð) — greiddur með helgarálagi. */
export function isFridagur(dt: Date): boolean {
  return holidaysOf(dt.getFullYear()).fri.has(isoOf(dt));
}
/** Dagsetning (YYYY-MM-DD) sem er stórhátíðardagur að hluta eða öllu leyti. */
export const STORHATID = { has(iso: string): boolean { const h = holidaysOf(Number(iso.slice(0, 4))); return h.stor.has(iso) || h.half.has(iso); } };
const OT_WEEKLY = 40; // yfirvinna yfir 40 klst/viku
const STEP = 0.25;

function mondayKey(d: Date): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}
function premiumPct(dt: Date, holiday: boolean, r: RuleSet): number {
  if (holiday) return r.holiday;
  const wd = dt.getDay();
  if (wd === 0 || wd === 6 || isFridagur(dt)) return r.weekend;
  const h = dt.getHours();
  if (h < 6 || h >= 23) return r.night;
  if (h < 8 || h >= 17) return r.eve;
  return 0; // dagvinna
}

/** Highest matching custom-band premium for a moment (0 if none match). */
function bandPct(dt: Date, bands: Band[]): number {
  const mins = dt.getHours() * 60 + dt.getMinutes();
  const wd = dt.getDay();
  let best = 0;
  for (const b of bands) {
    if (!b.days?.includes(wd)) continue;
    const [fh, fm] = b.from.split(":").map(Number);
    const [th, tm] = b.to.split(":").map(Number);
    const from = fh * 60 + (fm || 0);
    const to = th * 60 + (tm || 0);
    const inRange = from <= to ? mins >= from && mins < to : mins >= from || mins < to; // wrap past midnight
    if (inRange && b.pct > best) best = b.pct;
  }
  return best;
}

/** Payroll line from punches with per-shift premiums applied (evening/weekend/
 * night/holiday) + weekly overtime. Monthly staff keep their salary. */
export function computeFromPunches(e: EmpPick, punches: { clockIn: string; clockOut: string }[], rules: CustomRules, uppbot = 0): PayLine {
  if (e.payType === "monthly") {
    return finalize(e, Math.round(MONTHLY_HOURS * (e.employmentRatio / 100)), e.rate, uppbot, { dayPay: e.rate, premiums: 0, overtime: 0 });
  }
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  const bands = rules.bands ?? [];
  let hours = 0, gross = 0, monthAcc = 0, base = 0, premExtra = 0, otExtra = 0;
  const weekHrs = new Map<string, number>();
  const sorted = punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  for (const p of sorted) {
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      // síðasti bútur stimplunar er nákvæmur — ekki námundað upp í heilt korter
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const prem = Math.max(premiumPct(dt, isStorhatid(dt), rules), bandPct(dt, bands));
      let pct = prem;
      const isOt = (acc >= otWeekly || monthAcc >= otMonthly) && rules.overtime > prem;
      if (acc >= otWeekly || monthAcc >= otMonthly) pct = Math.max(pct, rules.overtime); // yfirvinna (viku/mánuði)
      gross += e.rate * s * (1 + pct / 100);
      base += e.rate * s;
      if (isOt) otExtra += e.rate * s * (pct / 100); else premExtra += e.rate * s * (pct / 100);
      hours += s;
      monthAcc += s;
      weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  return finalize(e, Math.round(hours * 10) / 10, Math.round(gross), uppbot, { dayPay: base, premiums: premExtra, overtime: otExtra });
}

/** Operational classification of worked hours + their extra cost (from punches)
 * by the employee's rule set — for the dashboard. hours: total/overtime/premium
 * where overtime = hours beyond the weekly/monthly threshold (correctly, NOT just
 * actual−planned) and premium = hours in a premium window. overtimePay/premiumPay
 * = the EXTRA kr (above base, incl. employer burden) those hours cost — hourly
 * staff only (monthly salary isn't hour-priced). */
export function classifyPay(rate: number, hourly: boolean, punches: { clockIn: string; clockOut: string }[], rules: CustomRules): { total: number; overtime: number; premium: number; overtimePay: number; premiumPay: number } {
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  const otPct = rules.overtime ?? 0;
  const bands = rules.bands ?? [];
  let total = 0, overtime = 0, premium = 0, overtimePay = 0, premiumPay = 0, monthAcc = 0;
  const weekHrs = new Map<string, number>();
  const sorted = punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  for (const p of sorted) {
    if (!p.clockOut) continue;
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      // síðasti bútur stimplunar er nákvæmur — ekki námundað upp í heilt korter
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const prem = Math.max(premiumPct(dt, isStorhatid(dt), rules), bandPct(dt, bands));
      const otActive = acc >= otWeekly || monthAcc >= otMonthly;
      if (prem > 0) premium += s;
      if (otActive) overtime += s;
      if (hourly) {
        const effPct = otActive ? Math.max(prem, otPct) : prem; // engine pays the higher
        const extra = rate * s * (effPct / 100) * (1 + BURDEN);
        if (otActive && otPct >= prem) overtimePay += extra; else premiumPay += extra;
      }
      total += s; monthAcc += s; weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { total: r1(total), overtime: r1(overtime), premium: r1(premium), overtimePay: Math.round(overtimePay), premiumPay: Math.round(premiumPay) };
}

/** Tímar flokkaðir eins og launakerfi (Payday) vill þá: dagvinna = allir tímar utan yfirvinnu,
 * álag[pct] = þeir dagvinnutímar sem bera vaktaálag (greitt OFAN Á dagvinnu, pct % af taxta),
 * yfirvinna = tímar yfir viku-/mánaðarmörkum. Sama regla og computeFromPunches, svo
 * dagvinna×taxti + Σ álag×pct×taxti + yfirvinna×taxti×(1+yfirv.%) = brúttó. */
export function hourBuckets(punches: { clockIn: string; clockOut: string }[], rules: CustomRules): { dagvinna: number; yfirvinna: number; alag: Record<number, number> } {
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  const otPct = rules.overtime ?? 0;
  const bands = rules.bands ?? [];
  let dagvinna = 0, yfirvinna = 0, monthAcc = 0;
  const alag: Record<number, number> = {};
  const weekHrs = new Map<string, number>();
  const sorted = punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  for (const p of sorted) {
    if (!p.clockOut) continue;
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const prem = Math.max(premiumPct(dt, isStorhatid(dt), rules), bandPct(dt, bands));
      const otActive = acc >= otWeekly || monthAcc >= otMonthly;
      if (otActive && otPct >= prem) yfirvinna += s;
      else { dagvinna += s; if (prem > 0) alag[prem] = (alag[prem] ?? 0) + s; }
      monthAcc += s; weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const k of Object.keys(alag)) alag[Number(k)] = r2(alag[Number(k)]);
  return { dagvinna: r2(dagvinna), yfirvinna: r2(yfirvinna), alag };
}

export type PayrollTotals = { hours: number; gross: number; withholding: number; pension: number; union: number; net: number; cost: number };

export function totals(lines: PayLine[]): PayrollTotals {
  return lines.reduce<PayrollTotals>(
    (a, l) => ({
      hours: a.hours + l.hours, gross: a.gross + l.gross, withholding: a.withholding + l.withholding,
      pension: a.pension + l.pension, union: a.union + l.union, net: a.net + l.net, cost: a.cost + l.cost,
    }),
    { hours: 0, gross: 0, withholding: 0, pension: 0, union: 0, net: 0, cost: 0 },
  );
}

/** Re-derive a line after a pre-tax gross adjustment (e.g. time-bank
 * settlement at BASE rate — premiums/overtime pay stay untouched). */
export function applyGrossAdjustment(l: PayLine, adj: number): PayLine {
  const gross = Math.max(0, l.gross - Math.round(adj));
  const pension = Math.round(gross * PENSION_RATE);
  const union = Math.round(gross * UNION_RATE);
  const taxable = gross - pension;
  const withholding = Math.max(0, Math.round(taxable * WITHHOLDING_RATE - PERSONAL_ALLOWANCE));
  const net = Math.round(gross - pension - union - withholding);
  const cost = Math.round(gross * (1 + BURDEN));
  return { ...l, gross, pension, union, withholding, net, cost };
}
