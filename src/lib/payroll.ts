// Icelandic payroll calc (brief §9) — pure, deterministic. Used by the payroll
// run (persistence), the Payday/Excel export, and the labor% metric.
import type { Employee } from "@/lib/employees";
import type { RuleSet } from "@/lib/payrules";

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
  withholding: number;
  pension: number;
  union: number;
  net: number;
  cost: number; // employer cost incl. burden
};

type EmpPick = Pick<Employee, "id" | "fullName" | "payType" | "rate" | "employmentRatio">;

function finalize(e: EmpPick, hours: number, gross: number): PayLine {
  const dayPay = Math.round(gross * 0.78);
  const premiums = Math.round(gross * 0.15);
  const overtime = Math.round(gross - dayPay - premiums);
  const pension = Math.round(gross * PENSION_RATE);
  const union = Math.round(gross * UNION_RATE);
  const taxable = gross - pension;
  const withholding = Math.max(0, Math.round(taxable * WITHHOLDING_RATE - PERSONAL_ALLOWANCE));
  const net = Math.round(gross - pension - union - withholding);
  const cost = Math.round(gross * (1 + BURDEN));
  return { employeeId: e.id, name: e.fullName, hours, gross: Math.round(gross), dayPay, premiums, overtime, withholding, pension, union, net, cost };
}

/** Contracted-hours payroll line (monthly baseline). */
export function computeLine(e: EmpPick): PayLine {
  const hours = Math.round(MONTHLY_HOURS * (e.employmentRatio / 100));
  const gross = e.payType === "monthly" ? e.rate : hours * e.rate * 1.18;
  return finalize(e, hours, gross);
}

/** Payroll line from actual worked hours (from approved punches in a period).
 * Hourly: gross = worked × rate × uplift. Monthly: full monthly salary. */
export function computeLineHours(e: EmpPick, workedHours: number): PayLine {
  const hours = Math.round(workedHours * 10) / 10;
  const gross = e.payType === "monthly" ? e.rate : Math.round(workedHours * e.rate * 1.18);
  return finalize(e, hours, gross);
}

// ⚠️ Icelandic stórhátíðardagar 2026 — UNCONFIRMED placeholders, verify before real pay.
export const STORHATID = new Set<string>([
  "2026-01-01", "2026-04-02", "2026-04-03", "2026-04-06", "2026-05-25",
  "2026-06-17", "2026-12-24", "2026-12-25", "2026-12-26", "2026-12-31",
]);
const OT_WEEKLY = 40; // yfirvinna yfir 40 klst/viku
const STEP = 0.25;

function mondayKey(d: Date): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}
function premiumPct(dt: Date, holiday: boolean, r: RuleSet): number {
  if (holiday) return r.holiday;
  const wd = dt.getDay();
  if (wd === 0 || wd === 6) return r.weekend;
  const h = dt.getHours();
  if (h < 6 || h >= 23) return r.night;
  if (h < 8 || h >= 17) return r.eve;
  return 0; // dagvinna
}

/** Payroll line from punches with per-shift premiums applied (evening/weekend/
 * night/holiday) + weekly overtime. Monthly staff keep their salary. */
export function computeFromPunches(e: EmpPick, punches: { clockIn: string; clockOut: string }[], rules: RuleSet): PayLine {
  if (e.payType === "monthly") {
    return finalize(e, Math.round(MONTHLY_HOURS * (e.employmentRatio / 100)), e.rate);
  }
  let hours = 0, gross = 0;
  const weekHrs = new Map<string, number>();
  const sorted = punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn));
  for (const p of sorted) {
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
      let pct = premiumPct(dt, STORHATID.has(iso), rules);
      if (acc >= OT_WEEKLY) pct = Math.max(pct, rules.overtime); // yfirvinna
      gross += e.rate * STEP * (1 + pct / 100);
      hours += STEP;
      weekHrs.set(wk, acc + STEP);
      t += STEP * 3600000;
    }
  }
  return finalize(e, Math.round(hours * 10) / 10, Math.round(gross));
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
