// Launamat — per-shift estimate and month projection from confirmed shifts.
// Uses the same rule engine as the web (payroll.ts / payrules.ts).
import { classifyPay, computeFromPunches, BURDEN } from "../payroll";
import type { Me } from "./me";

export type ShiftPay = { hours: number; base: number; extra: number; total: number; label: string };

/** Synthetic punch for a planned shift (local time). */
export function shiftPunch(date: string, start: string, end: string): { clockIn: string; clockOut: string } {
  const a = new Date(`${date}T${start.slice(0, 5)}:00`);
  const b = new Date(`${date}T${end.slice(0, 5)}:00`);
  if (b <= a) b.setDate(b.getDate() + 1); // yfir miðnætti
  return { clockIn: a.toISOString(), clockOut: b.toISOString() };
}

/** Estimated gross pay for one planned shift (hourly staff). */
export function estimateShift(me: Me, date: string, start: string | null, end: string | null): ShiftPay | null {
  if (!me.hourly || !start || !end || !me.rate) return null;
  const p = [shiftPunch(date, start, end)];
  const cls = classifyPay(me.rate, true, p, me.rules);
  const base = cls.total * me.rate;
  const extra = (cls.premiumPay + cls.overtimePay) / (1 + BURDEN);
  const d = new Date(date + "T12:00:00").getDay();
  const label = cls.overtime > 0 ? "yfirvinna" : d === 0 || d === 6 ? `helgarálag ${me.rules.weekend}%` : cls.premium > 0 ? `kvöldálag ${me.rules.eve}%` : "dagvinna";
  return { hours: cls.total, base: Math.round(base), extra: Math.round(extra), total: Math.round(base + extra), label };
}

export type MonthPay = {
  earnedKr: number;      // unnið hingað til (lokaðar stimplanir)
  earnedH: number;
  plannedKr: number;     // eftirstandandi staðfestar vaktir í mánuðinum
  plannedH: number;
  projectedKr: number;   // earned + planned
  dayKr: number; dayH: number;
  premKr: number; premH: number;
  otKr: number; otH: number;
  orlofKr: number;
  shifts: number;
  weeks: { label: string; hours: number; kr: number; planned: boolean }[];
  monthLabel: string;
  payday: string;
};

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

/** Combine closed punches (earned) and future confirmed shifts (planned) for the month. */
export function monthPay(
  me: Me,
  punches: { clockIn: string; clockOut: string }[],
  futureShifts: { date: string; start: string | null; end: string | null }[],
  now = new Date()
): MonthPay {
  const rate = me.rate;
  const earnedCls = classifyPay(rate, me.hourly, punches, me.rules);
  const earnedLine = punches.length ? computeFromPunches({ id: me.empId, fullName: me.fullName, payType: me.hourly ? "hourly" : "monthly", rate, employmentRatio: me.ratio }, punches, me.rules) : null;
  const earnedKr = me.hourly ? Math.round(earnedLine?.gross ?? 0) : Math.round((rate * me.ratio) / 100);

  const planned = futureShifts.filter((s) => s.start && s.end).map((s) => shiftPunch(s.date, s.start!, s.end!));
  const plannedCls = classifyPay(rate, me.hourly, planned, me.rules);
  const plannedKr = me.hourly ? Math.round(plannedCls.total * rate + (plannedCls.premiumPay + plannedCls.overtimePay) / (1 + BURDEN)) : 0;

  const dayH = Math.max(0, earnedCls.total - earnedCls.premium - earnedCls.overtime);
  const premKr = Math.round(earnedCls.premium * rate + earnedCls.premiumPay / (1 + BURDEN));
  const otKr = Math.round(earnedCls.overtime * rate + earnedCls.overtimePay / (1 + BURDEN));

  // vikur mánaðarins
  const y = now.getFullYear(), m = now.getMonth();
  const first = new Date(y, m, 1);
  const weeks: MonthPay["weeks"] = [];
  const cur = new Date(first);
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7));
  const end = new Date(y, m + 1, 0);
  while (cur <= end) {
    const ws = new Date(cur), we = new Date(cur); we.setDate(we.getDate() + 6);
    const inWeek = (iso: string) => { const d = new Date(iso); return d >= ws && d <= new Date(we.getFullYear(), we.getMonth(), we.getDate(), 23, 59, 59); };
    const pw = punches.filter((p) => inWeek(p.clockIn));
    const sw = planned.filter((p) => inWeek(p.clockIn));
    const cw = classifyPay(rate, me.hourly, [...pw, ...sw], me.rules);
    const krw = me.hourly ? Math.round(cw.total * rate + (cw.premiumPay + cw.overtimePay) / (1 + BURDEN)) : 0;
    if (cw.total > 0) weeks.push({ label: `${ws.getDate()}.${ws.getMonth() + 1}–${we.getDate()}.${we.getMonth() + 1}`, hours: cw.total, kr: krw, planned: pw.length === 0 && sw.length > 0 });
    cur.setDate(cur.getDate() + 7);
  }
  const payday = new Date(y, m + 1, 1);
  return {
    earnedKr, earnedH: earnedCls.total, plannedKr, plannedH: plannedCls.total, projectedKr: earnedKr + plannedKr,
    dayKr: Math.round(dayH * rate), dayH, premKr, premH: earnedCls.premium, otKr, otH: earnedCls.overtime,
    orlofKr: Math.round(earnedKr * 0.1017), shifts: punches.length,
    weeks, monthLabel: `${MONTHS[m]} ${y}`, payday: `${payday.getDate()}. ${MONTHS[payday.getMonth()]}`,
  };
}
