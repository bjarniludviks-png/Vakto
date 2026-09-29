// Orlofsstaða — AFRIT af src/lib/orlof.ts (vefurinn). Breyta báðum saman.
//
// Orlofsárið er 1. maí – 30. apríl (orlofslög nr. 30/1987). Áunnið orlof reiknast
// af unnum tímum á orlofsárinu × orlofsprósentu starfsmanns (sjálfgefið 10,17%),
// í 8 klst dögum. Tekið = samþykktar orlofsbeiðnir á orlofsárinu, í bið = óafgreiddar.
// Dagar í beiðni eru virkir dagar (mán–fös). Þeir sem fá orlofið greitt út
// jafnóðum eða lagt inn á orlofsreikning safna ekki dögum — þá er engin dagastaða.

export type OrlofMode = "accrue_amount" | "accrue_hours" | "accrue_days" | "pay_out" | "to_bank";

export type OrlofBalance = {
  /** false = orlof greitt út jafnóðum / á orlofsreikning — engin dagastaða. */
  tracksDays: boolean;
  mode: OrlofMode;
  pct: number;
  yearStart: string;       // YYYY-MM-DD (1. maí)
  earnedDays: number;
  takenDays: number;
  pendingDays: number;
  remainingDays: number;   // earned − taken − pending
};

const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const round1 = (n: number) => Math.round(n * 10) / 10;

/** First day of the orlof year containing `d` (1 May). */
export function orlofYearStart(d = new Date()): string {
  const y = d.getMonth() >= 4 ? d.getFullYear() : d.getFullYear() - 1;
  return `${y}-05-01`;
}

/** Workdays (Mon–Fri) in an inclusive YYYY-MM-DD range. */
export function leaveWorkdays(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  let n = 0;
  const d = new Date(from + "T12:00:00");
  const end = new Date(to + "T12:00:00");
  while (d <= end) {
    const wd = d.getDay();
    if (wd !== 0 && wd !== 6) n++;
    d.setDate(d.getDate() + 1);
  }
  return n;
}

/** Part of a leave range that falls on/after `since` (for the current orlof year). */
function clipFrom(from: string, to: string, since: string): [string, string] | null {
  if (to < since) return null;
  return [from < since ? since : from, to];
}

export type OrlofLeave = { from_date: string; to_date: string; status: string; type: string };

export function orlofBalance(input: {
  hoursWorked: number;               // closed-punch hours since yearStart
  orlof?: { mode?: string; pct?: number } | null;
  leaves: OrlofLeave[];              // this employee's leave rows (any year)
  now?: Date;
}): OrlofBalance {
  const mode = (input.orlof?.mode as OrlofMode) || "accrue_amount";
  const pct = Number(input.orlof?.pct) > 0 ? Number(input.orlof?.pct) : 10.17;
  const yearStart = orlofYearStart(input.now ?? new Date());
  const tracksDays = mode !== "pay_out" && mode !== "to_bank";
  let taken = 0, pending = 0;
  for (const l of input.leaves) {
    if (l.type !== "orlof") continue;
    const r = clipFrom(l.from_date, l.to_date, yearStart);
    if (!r) continue;
    const n = leaveWorkdays(r[0], r[1]);
    if (l.status === "approved") taken += n;
    else if (l.status === "pending") pending += n;
  }
  const earned = (input.hoursWorked * pct) / 100 / 8;
  return {
    tracksDays, mode, pct, yearStart,
    earnedDays: round1(earned),
    takenDays: taken,
    pendingDays: pending,
    remainingDays: round1(earned - taken - pending),
  };
}

export { isoOf as orlofIso };
