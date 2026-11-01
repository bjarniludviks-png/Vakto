// Launatímabil — AFRIT af `src/lib/periods.ts` á vefnum (normalizePayPeriod / payPeriodOf / shiftPayPeriod).
// Breyttu báðum saman. Dagsetningar eru YYYY-MM-DD (Ísland = UTC).
import { tr } from "./i18n";

export type PayPeriodCfg =
  | { kind: "month"; startDay?: number }
  | { kind: "semimonth" }
  | { kind: "biweekly"; anchor: string }
  | { kind: "weekly"; anchor: string };
export type PayPeriodInput = number | PayPeriodCfg | null | undefined;
export type PeriodRange = { from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m0: number, d: number) => {
  const x = new Date(Date.UTC(y, m0, d));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;

export function normalizePayPeriod(p: unknown, legacyStartDay = 1): PayPeriodCfg {
  const sd = (n: unknown) => Math.min(28, Math.max(1, Math.round(Number(n)) || 1));
  if (typeof p === "number") return { kind: "month", startDay: sd(p) };
  const o = (p && typeof p === "object" ? p : {}) as { kind?: string; startDay?: number; anchor?: string };
  if (o.kind === "semimonth") return { kind: "semimonth" };
  if ((o.kind === "biweekly" || o.kind === "weekly") && typeof o.anchor === "string" && ISO_RE.test(o.anchor)) return { kind: o.kind, anchor: o.anchor };
  if (o.kind === "month") return { kind: "month", startDay: sd(o.startDay) };
  return { kind: "month", startDay: sd(legacyStartDay) };
}

const dayNum = (s: string) => Math.round(Date.parse(`${s}T00:00:00Z`) / 86400000);
const fromDayNum = (n: number) => new Date(n * 86400000).toISOString().slice(0, 10);
export const addDaysISO = (s: string, n: number) => fromDayNum(dayNum(s) + n);

export function payPeriodOf(date: string, period: PayPeriodInput = 1): PeriodRange {
  const cfg = normalizePayPeriod(period ?? 1);
  const [y, m, day] = date.split("-").map(Number);
  if (cfg.kind === "semimonth") return day <= 15 ? { from: iso(y, m - 1, 1), to: iso(y, m - 1, 15) } : { from: iso(y, m - 1, 16), to: iso(y, m, 0) };
  if (cfg.kind === "weekly" || cfg.kind === "biweekly") {
    const len = cfg.kind === "weekly" ? 7 : 14;
    const a = dayNum(cfg.anchor), d = dayNum(date);
    const start = a + Math.floor((d - a) / len) * len;
    return { from: fromDayNum(start), to: fromDayNum(start + len - 1) };
  }
  const d = cfg.startDay ?? 1;
  if (d === 1) return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
  const m0 = day >= d ? m - 1 : m - 2;
  return { from: iso(y, m0, d), to: iso(y, m0 + 1, d - 1) };
}

export function shiftPayPeriod(from: string, period: PayPeriodInput, n: number): PeriodRange {
  const cfg = normalizePayPeriod(period ?? 1);
  if (cfg.kind === "weekly" || cfg.kind === "biweekly") {
    const len = cfg.kind === "weekly" ? 7 : 14;
    return payPeriodOf(fromDayNum(dayNum(payPeriodOf(from, cfg).from) + n * len), cfg);
  }
  if (cfg.kind === "semimonth") {
    let cur = payPeriodOf(from, cfg);
    for (let i = 0; i < Math.abs(n); i++) cur = payPeriodOf(fromDayNum(n < 0 ? dayNum(cur.from) - 1 : dayNum(cur.to) + 1), cfg);
    return cur;
  }
  const [y, m, d] = from.split("-").map(Number);
  return payPeriodOf(iso(y, m - 1 + n, d), cfg);
}

// ---- app-sértækt ----

/** Tímabilið `offset` skrefum frá því sem dagurinn í dag fellur í (0 = núverandi, −1 = síðasta). */
export function periodAt(cfg: PayPeriodInput, offset: number, today: string): PeriodRange {
  const cur = payPeriodOf(today, cfg);
  return offset === 0 ? cur : shiftPayPeriod(cur.from, cfg, offset);
}

/** Heill almanaksmánuður? (þá heitir tímabilið „október 2026“). */
export function isCalendarMonth(r: PeriodRange): boolean {
  return r.from.endsWith("-01") && addDaysISO(r.to, 1).endsWith("-01") && r.from.slice(0, 7) === r.to.slice(0, 7);
}

const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const MON = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];

/** „október 2026“ fyrir almanaksmánuð, annars „21. okt. – 20. nóv.“ */
export function periodLabel(r: PeriodRange): string {
  const [y, m, d] = r.from.split("-").map(Number);
  if (isCalendarMonth(r)) return `${tr(MONTHS[m - 1])} ${y}`;
  const [, tm, td] = r.to.split("-").map(Number);
  return `${d}. ${tr(MON[m - 1])} – ${td}. ${tr(MON[tm - 1])}`;
}

/** Staðbundið miðnætti dagsetningar (fyrir timestamptz-fyrirspurnir). */
export const localMidnight = (s: string) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };

/** Hve mörg tímabil aftur má fletta (~2 ár). */
export function stepLimit(cfg: PayPeriodInput): number {
  const c = normalizePayPeriod(cfg ?? 1);
  return c.kind === "weekly" ? 104 : c.kind === "biweekly" ? 52 : c.kind === "semimonth" ? 48 : 24;
}
