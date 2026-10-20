// Tímabil fyrir skýrslur: launatímabil (companies.pay_period_start), mánuður, ársfjórðungur, ár.
// Hreinar föll (engin tímabelti — dagsetningar sem YYYY-MM-DD, Ísland = UTC).

export type Gran = "period" | "month" | "quarter" | "year";
export type Range = { key: string; label: string; short: string; from: string; to: string };

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (y: number, m0: number, d: number) => {
  const x = new Date(Date.UTC(y, m0, d));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
};
const MON = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** Launatímabilið sem dagsetningin fellur í. startDay 1 = almanaksmánuður. */
export function payPeriodOf(date: string, startDay = 1): { from: string; to: string } {
  const d = Math.min(28, Math.max(1, Math.round(startDay) || 1));
  const [y, m, day] = date.split("-").map(Number);
  if (d === 1) return { from: iso(y, m - 1, 1), to: iso(y, m, 0) };
  const m0 = day >= d ? m - 1 : m - 2;
  return { from: iso(y, m0, d), to: iso(y, m0 + 1, d - 1) };
}

/** Síðasta LOKNA launatímabil (sjálfgefið fyrir vinnuyfirlit). */
export function lastPayPeriod(startDay = 1, today = todayISO()): { from: string; to: string } {
  const cur = payPeriodOf(today, startDay);
  const [y, m, d] = cur.from.split("-").map(Number);
  return payPeriodOf(iso(y, m - 1, d - 1), startDay);
}

/** Færa launatímabil um n tímabil (−1 = fyrra). */
export function shiftPayPeriod(from: string, startDay: number, n: number): { from: string; to: string } {
  const [y, m, d] = from.split("-").map(Number);
  return payPeriodOf(iso(y, m - 1 + n, d), startDay);
}

export function rangeLabel(gran: Gran, from: string, to: string): string {
  const [y, m] = from.split("-").map(Number);
  if (gran === "year") return String(y);
  if (gran === "quarter") return `${Math.floor((m - 1) / 3) + 1}. ársfj. ${y}`;
  if (gran === "month") return `${MONTHS[m - 1]} ${y}`;
  const [, tm, td] = to.split("-").map(Number);
  const [, , fd] = from.split("-").map(Number);
  return `${fd}. ${MON[m - 1]} – ${td}. ${MON[tm - 1]}`;
}

/** Stutt heiti fyrir súlurit: „okt. 26“, „3F 26“, „2026“, „21.9.“ */
export function shortLabel(gran: Gran, from: string): string {
  const [y, m, d] = from.split("-").map(Number);
  const yy = String(y).slice(2);
  if (gran === "year") return String(y);
  if (gran === "quarter") return `${Math.floor((m - 1) / 3) + 1}F ${yy}`;
  if (gran === "month") return `${MON[m - 1]} ${yy}`;
  return `${d}.${m}.`;
}

/** `count` síðustu tímabil af gerðinni `gran`, elsta fyrst, endar á tímabilinu sem `end` er í. */
export function lastRanges(gran: Gran, count: number, startDay = 1, end = todayISO()): Range[] {
  const out: Range[] = [];
  const [y, m] = end.split("-").map(Number);
  for (let i = count - 1; i >= 0; i--) {
    let from: string, to: string;
    if (gran === "year") { from = iso(y - i, 0, 1); to = iso(y - i, 11, 31); }
    else if (gran === "quarter") { const q0 = Math.floor((m - 1) / 3) * 3 - i * 3; from = iso(y, q0, 1); to = iso(y, q0 + 3, 0); }
    else if (gran === "month") { from = iso(y, m - 1 - i, 1); to = iso(y, m - i, 0); }
    else ({ from, to } = shiftPayPeriod(payPeriodOf(end, startDay).from, startDay, -i));
    out.push({ key: from, label: rangeLabel(gran, from, to), short: shortLabel(gran, from), from, to });
  }
  return out;
}

/** Allir dagar á bilinu (með báðum endum). */
export function daysIn(from: string, to: string): string[] {
  const out: string[] = [];
  const [y, m, d] = from.split("-").map(Number);
  for (let i = 0; i < 400; i++) {
    const s = iso(y, m - 1, d + i);
    if (s > to) break;
    out.push(s);
  }
  return out;
}
