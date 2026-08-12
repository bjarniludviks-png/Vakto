// ============================================================
// VAKTO universal rules engine — types + presets.
// A RuleSet is a plain, country-agnostic description of working rules.
// Companies build their own (manually or AI-suggested, always approved);
// Icelandic kjarasamningar ship as OPTIONAL presets, not as the core.
// ============================================================

export type RuleSet = {
  /** Overtime: when it kicks in and what it pays. */
  overtime?: { afterHoursPerDay?: number; afterHoursPerWeek?: number; afterHoursPerMonth?: number; pct?: number };
  /** Weekend premium (Sat/Sun unless days overridden). */
  weekend?: { pct?: number };
  /** Night/evening premium between from–to (HH:MM). */
  night?: { from?: string; to?: string; pct?: number };
  /** Free-form premium rules — the user builds any list: name + % and an
   * optional time window and/or weekdays (0=Mon…6=Sun). */
  premiums?: { label: string; pct: number; from?: string; to?: string; days?: number[] }[];
  /** Public-holiday pay premium. */
  holiday?: { pct?: number };
  /** Breaks: minutes owed per worked hours, paid or not. */
  breaks?: { minutesPer6h?: number; paid?: boolean };
  /** Rest rules the scheduler must respect. */
  rest?: { minHoursBetweenShifts?: number; maxConsecutiveDays?: number };
  /** Vacation accrual. */
  vacation?: { daysPerYear?: number; accrualPct?: number };
  /** Sick leave. */
  sick?: { daysPerYear?: number; paidPct?: number };
  /** Payroll levies employer pays on top of gross (%, e.g. 30.2 in Iceland). */
  levies?: { pct?: number };
  /** Free-text union/local/company rules the numbers can't capture. */
  notes?: string;
};

export type RuleTemplate = {
  id: string;
  name: string;
  description?: string | null;
  country?: string | null;
  region?: string | null;
  industry?: string | null;
  union_name?: string | null;
  rules: RuleSet;
  source: "manual" | "preset" | "ai";
  approved: boolean;
};

/** Optional starting points — the system never depends on these. */
export const RULE_PRESETS: { key: string; name: string; country: string; rules: RuleSet }[] = [
  {
    key: "is-general",
    name: "Ísland — almennt (kjarasamningsgrunnur)",
    country: "Ísland",
    rules: {
      overtime: { afterHoursPerWeek: 40, pct: 80 },
      weekend: { pct: 45 },
      night: { from: "17:00", to: "08:00", pct: 33 },
      holiday: { pct: 90 },
      premiums: [
        { label: "Kvöld-/næturálag", pct: 33, from: "17:00", to: "08:00" },
        { label: "Helgarálag", pct: 45, days: [5, 6] },
        { label: "Stórhátíðarálag", pct: 90 },
      ],
      breaks: { minutesPer6h: 30, paid: true },
      rest: { minHoursBetweenShifts: 11, maxConsecutiveDays: 6 },
      vacation: { daysPerYear: 24, accrualPct: 10.17 },
      sick: { daysPerYear: 12, paidPct: 100 },
      levies: { pct: 30.2 },
      notes: "Grunnur skv. almennum íslenskum kjarasamningum — staðfestu tölur við þinn samning.",
    },
  },
  {
    key: "universal-basic",
    name: "Almennt — einfaldur grunnur / Universal basic",
    country: "",
    rules: {
      overtime: { afterHoursPerWeek: 40, pct: 50 },
      weekend: { pct: 0 },
      breaks: { minutesPer6h: 30, paid: false },
      rest: { minHoursBetweenShifts: 11, maxConsecutiveDays: 6 },
      vacation: { daysPerYear: 20 },
      sick: { daysPerYear: 10, paidPct: 100 },
      levies: { pct: 0 },
    },
  },
];

/** Contract types — extensible free-text friendly list. */
export const CONTRACT_TYPES = [
  { key: "fulltime", is: "Fullt starf", en: "Full-time" },
  { key: "parttime", is: "Hlutastarf", en: "Part-time" },
  { key: "temporary", is: "Tímabundið", en: "Temporary" },
  { key: "contractor", is: "Verktaki", en: "Contractor" },
  { key: "custom", is: "Annað", en: "Other" },
] as const;

/** Scheduling patterns — used to prefill/auto-suggest shifts. */
export type SchedulePattern = {
  kind: "fixed_week" | "rotating" | "2_2_3" | "weekdays" | "evenings" | "weekends" | "open" | "custom";
  /** fixed_week: ISO weekday numbers (1=Mon…7=Sun) the employee works. */
  days?: number[];
  /** Default shift window HH:MM–HH:MM for generated shifts. */
  start?: string;
  end?: string;
  note?: string;
};

export const SCHEDULE_PATTERNS: { key: SchedulePattern["kind"]; is: string; en: string }[] = [
  { key: "open", is: "Opið — laus í allt", en: "Open availability" },
  { key: "fixed_week", is: "Föst vika (sömu dagar)", en: "Fixed weekly schedule" },
  { key: "rotating", is: "Rúllandi plan", en: "Rotating schedule" },
  { key: "2_2_3", is: "2-2-3 vaktir", en: "2-2-3 schedule" },
  { key: "weekdays", is: "Virkir dagar", en: "Full-time weekdays" },
  { key: "evenings", is: "Kvöld (hlutastarf)", en: "Part-time evenings" },
  { key: "weekends", is: "Bara helgar", en: "Weekends only" },
  { key: "custom", is: "Sérsniðið", en: "Custom pattern" },
];

/** Human summary of a rule set (for lists and the approval dialog). */
export function summarizeRules(r: RuleSet, lang: "is" | "en" = "is"): string {
  const parts: string[] = [];
  const t = (is: string, en: string) => (lang === "is" ? is : en);
  if (r.overtime?.pct != null) {
    const thr = r.overtime.afterHoursPerMonth
      ? ` ${t("eftir", "after")} ${r.overtime.afterHoursPerMonth} ${t("klst/mán", "h/mo")}`
      : r.overtime.afterHoursPerWeek ? ` ${t("eftir", "after")} ${r.overtime.afterHoursPerWeek} ${t("klst/viku", "h/wk")}` : "";
    parts.push(`${t("Yfirvinna", "Overtime")} +${r.overtime.pct}%${thr}`);
  }
  if (r.premiums?.length) for (const pr of r.premiums) parts.push(`${pr.label} +${pr.pct}%${pr.from && pr.to ? ` (${pr.from}–${pr.to})` : ""}`);
  if (!r.premiums?.length && r.night?.pct) parts.push(`${t("Nætur/kvöldálag", "Night")} +${r.night.pct}%`);
  if (!r.premiums?.length && r.weekend?.pct) parts.push(`${t("Helgarálag", "Weekend")} +${r.weekend.pct}%`);
  if (!r.premiums?.length && r.holiday?.pct) parts.push(`${t("Stórhátíð", "Holiday")} +${r.holiday.pct}%`);
  if (r.rest?.minHoursBetweenShifts) parts.push(`${t("Hvíld", "Rest")} ${r.rest.minHoursBetweenShifts} ${t("klst", "h")}`);
  if (r.vacation?.daysPerYear) parts.push(`${t("Orlof", "Vacation")} ${r.vacation.daysPerYear} ${t("dagar", "days")}`);
  if (r.sick?.daysPerYear) parts.push(`${t("Veikindi", "Sick")} ${r.sick.daysPerYear} ${t("dagar", "days")}`);
  if (r.levies?.pct) parts.push(`${t("Launatengd gjöld", "Levies")} ${r.levies.pct}%`);
  return parts.join(" · ") || t("Engar reglur skilgreindar enn", "No rules defined yet");
}

/** Convert a saved rule template into the per-employee pay-rule shape the
 * payroll engine consumes (bands + thresholds). Used when an employee is
 * assigned a template — one conversion path, client and server alike. */
export function templateToPayRule(r: RuleSet): {
  eve: number; weekend: number; overtime: number; holiday: number; night: number;
  otWeekly?: number; otMonthly?: number;
  bands: { label: string; days: number[]; from: string; to: string; pct: number }[];
} {
  // Template premiums use 0=Mon…6=Sun; payroll bands use JS getDay (0=Sun…6=Sat).
  const bands = (r.premiums ?? []).map((p) => ({
    label: p.label || "Álag",
    days: p.days && p.days.length ? p.days.map((d) => (d + 1) % 7) : [0, 1, 2, 3, 4, 5, 6],
    from: p.from ?? "00:00",
    to: p.to ?? "23:59",
    pct: p.pct,
  }));
  return {
    eve: r.night?.pct ?? 0,
    night: r.night?.pct ?? 0,
    weekend: r.weekend?.pct ?? 0,
    overtime: r.overtime?.pct ?? 80,
    holiday: r.holiday?.pct ?? 90,
    otWeekly: r.overtime?.afterHoursPerWeek,
    otMonthly: r.overtime?.afterHoursPerMonth,
    bands,
  };
}
