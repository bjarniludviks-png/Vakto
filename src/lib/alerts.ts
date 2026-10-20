// Vaktarar og sjálfvirkar skýrslur — sameiginlegar gerðir, sannprófun og lýsingar á mannamáli.
// Notað af Stillingum (viðmót), VAKTO AI (tillögur) og cron (mat). Engin gagnagrunnsköll hér.

import { nf, dec1 } from "@/lib/format";

export type AlertKind = "hours_threshold" | "overtime_threshold" | "labor_pct_above" | "report";
export type AlertPeriod = "week" | "month" | "payroll";
export type AlertChannel = "email" | "push" | "both";
/** Skýrslur úr Skýrslusafninu (skyrslur/actions.ts). timebank þarf innskráðan notanda → aðeins „senda núna“. */
export type AlertReport = "hours" | "overtime" | "attendance" | "cost" | "costDept" | "absence" | "timebank";
export type ReportRange = "yesterday" | "this_week" | "last_week" | "this_month" | "last_month";
export type ReportFreq = "daily" | "weekly" | "monthly";
export type ReportSchedule = { freq: ReportFreq; weekday?: number; day?: number; hour?: number };

export type AlertParams = {
  hours?: number;          // hours_threshold / overtime_threshold
  warnPct?: number;        // hours_threshold: snemmviðvörun (t.d. 90), 0 = engin
  includePlanned?: boolean;// hours_threshold: telja vaktir sem eru eftir á tímabilinu („mun fara yfir“)
  period?: AlertPeriod;
  pct?: number;            // labor_pct_above
  report?: AlertReport;    // report
  range?: ReportRange;     // report
};

export type AlertRuleInput = {
  kind: AlertKind;
  params: AlertParams;
  channel: AlertChannel;
  schedule: ReportSchedule | null;
  recipients: string[];
  description: string;
};

export type AlertRule = AlertRuleInput & {
  id: string;
  active: boolean;
  createdVia: "ui" | "ai";
  createdBy: string | null;
  lastFiredAt: string | null;
  createdAt: string;
};

export const ALERT_KINDS: AlertKind[] = ["hours_threshold", "overtime_threshold", "labor_pct_above", "report"];
export const REPORTS: AlertReport[] = ["hours", "overtime", "attendance", "cost", "costDept", "absence", "timebank"];
export const SCHEDULABLE_REPORTS: AlertReport[] = ["hours", "overtime", "attendance", "cost", "costDept", "absence"];
/** Klukkan sem /api/cron/alerts keyrir (vercel.json: 0 8 * * *). */
export const REPORT_HOUR = 8;
export const RANGES: ReportRange[] = ["yesterday", "this_week", "last_week", "this_month", "last_month"];

/** Sniðmát í „Nýr vaktari“ — 180 klst./mánuð fyrst (beiðni frá viðskiptavini). */
export const ALERT_PRESETS: { id: string; is: string; en: string; rule: Omit<AlertRuleInput, "recipients" | "description"> }[] = [
  { id: "h180", is: "180 klst. á mánuði", en: "180 hrs a month", rule: { kind: "hours_threshold", params: { hours: 180, period: "month", warnPct: 90, includePlanned: true }, channel: "email", schedule: null } },
  { id: "h48", is: "48 klst. á viku", en: "48 hrs a week", rule: { kind: "hours_threshold", params: { hours: 48, period: "week", warnPct: 90, includePlanned: true }, channel: "email", schedule: null } },
  { id: "ot20", is: "20 yfirvinnutímar á mánuði", en: "20 overtime hrs a month", rule: { kind: "overtime_threshold", params: { hours: 20, period: "month" }, channel: "email", schedule: null } },
  { id: "lab", is: "Laun % yfir markmiði", en: "Labor % above target", rule: { kind: "labor_pct_above", params: { pct: 32, period: "week" }, channel: "email", schedule: null } },
  { id: "rep-ot", is: "Yfirvinnuskýrsla á mánudögum", en: "Overtime report on Mondays", rule: { kind: "report", params: { report: "overtime", range: "last_week" }, channel: "email", schedule: { freq: "weekly", weekday: 1, hour: 8 } } },
];

const num = (n: number) => (Number.isInteger(n) ? nf(n) : dec1(n));
const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

/** Sjálfgefið skýrslutímabil eftir tíðni. */
export function defaultRange(freq: ReportFreq): ReportRange {
  return freq === "daily" ? "yesterday" : freq === "weekly" ? "last_week" : "last_month";
}

/** Sannprófar og hreinsar reglu (úr viðmóti, AI eða gagnagrunni). Ekkert framkvæmt. */
export function normalizeAlert(raw: unknown): { ok: true; rule: AlertRuleInput } | { ok: false; error: string } {
  const r = (raw ?? {}) as Record<string, unknown>;
  const p = ((r.params ?? r) as Record<string, unknown>) ?? {};
  const kind = ALERT_KINDS.find((k) => k === r.kind);
  if (!kind) return { ok: false, error: "Óþekkt tegund vaktara" };
  const channel: AlertChannel = r.channel === "push" || r.channel === "both" ? r.channel : "email";
  const recipients = (Array.isArray(r.recipients) ? r.recipients : []).map(String).filter(isUuid).slice(0, 20);
  const period: AlertPeriod = p.period === "week" || p.period === "payroll" ? p.period : "month";
  const description = typeof r.description === "string" ? r.description.trim().slice(0, 200) : "";
  const n = (v: unknown) => Number(String(v ?? "").replace(",", "."));
  let params: AlertParams;
  let schedule: ReportSchedule | null = null;
  switch (kind) {
    case "hours_threshold": {
      const hours = n(p.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 744) return { ok: false, error: "Tímafjöldi þarf að vera á bilinu 1–744" };
      const w = p.warnPct === undefined || p.warnPct === null || p.warnPct === "" ? 90 : n(p.warnPct);
      params = { hours: Math.round(hours * 10) / 10, period, warnPct: Number.isFinite(w) && w >= 50 && w < 100 ? Math.round(w) : 0, includePlanned: p.includePlanned === true || p.includePlanned === "true" };
      break;
    }
    case "overtime_threshold": {
      const hours = n(p.hours);
      if (!Number.isFinite(hours) || hours <= 0 || hours > 300) return { ok: false, error: "Yfirvinnutímar þurfa að vera á bilinu 1–300" };
      params = { hours: Math.round(hours * 10) / 10, period };
      break;
    }
    case "labor_pct_above": {
      const pct = n(p.pct);
      if (!Number.isFinite(pct) || pct <= 0 || pct >= 100) return { ok: false, error: "Hlutfall þarf að vera á bilinu 1–99 %" };
      params = { pct: Math.round(pct * 10) / 10, period: period === "week" ? "week" : "month" };
      break;
    }
    case "report": {
      const report = SCHEDULABLE_REPORTS.find((x) => x === p.report);
      if (!report) return { ok: false, error: "Óþekkt skýrsla — veldu tímaskýrslu, yfirvinnu, mætingu, kostnað eða fjarvistir" };
      const s = ((r.schedule ?? {}) as Record<string, unknown>);
      const freq: ReportFreq = s.freq === "daily" || s.freq === "monthly" ? s.freq : "weekly";
      // Cron keyrir einu sinni á dag kl. 8 → skýrslur fara kl. 8 (önnur klukkustund er ekki í boði enn).
      schedule = { freq, hour: REPORT_HOUR };
      if (freq === "weekly") schedule.weekday = clamp(Math.round(n(s.weekday ?? 1)) || 1, 1, 7);
      if (freq === "monthly") schedule.day = clamp(Math.round(n(s.day ?? 1)) || 1, 1, 28);
      params = { report, range: RANGES.find((x) => x === p.range) ?? defaultRange(freq) };
      break;
    }
  }
  return { ok: true, rule: { kind, params, channel, schedule, recipients, description } };
}

const PERIOD = {
  is: { week: "á viku", month: "á mánuði", payroll: "á launatímabili" },
  en: { week: "a week", month: "a month", payroll: "per pay period" },
};
const REPORT_NAME: Record<"is" | "en", Record<AlertReport, string>> = {
  is: { hours: "launatímaskýrslu", overtime: "yfirvinnuskýrslu", attendance: "mætingarskýrslu", cost: "launakostnaðarskýrslu", costDept: "kostnaðarskýrslu per deild", absence: "fjarvistaskýrslu", timebank: "tímabankaskýrslu" },
  en: { hours: "an hours report", overtime: "an overtime report", attendance: "an attendance report", cost: "a labor cost report", costDept: "a cost-by-department report", absence: "an absence report", timebank: "a time bank report" },
};
export const REPORT_TITLE: Record<"is" | "en", Record<AlertReport, string>> = {
  is: { hours: "Launatímar", overtime: "Yfirvinna & álög", attendance: "Mæting & frávik", cost: "Launakostnaður", costDept: "Kostnaður per deild", absence: "Fjarvistir & veikindi", timebank: "Orlof & tímabanki" },
  en: { hours: "Hours", overtime: "Overtime & premiums", attendance: "Attendance", cost: "Labor cost", costDept: "Cost by department", absence: "Absence & sick leave", timebank: "Leave & time bank" },
};
export const RANGE_LABEL: Record<"is" | "en", Record<ReportRange, string>> = {
  is: { yesterday: "gærdagurinn", this_week: "vikan til þessa", last_week: "síðasta vika", this_month: "mánuðurinn til þessa", last_month: "síðasti mánuður" },
  en: { yesterday: "yesterday", this_week: "this week so far", last_week: "last week", this_month: "this month so far", last_month: "last month" },
};
const WEEKDAYS_PL = {
  is: ["", "mánudaga", "þriðjudaga", "miðvikudaga", "fimmtudaga", "föstudaga", "laugardaga", "sunnudaga"],
  en: ["", "Mondays", "Tuesdays", "Wednesdays", "Thursdays", "Fridays", "Saturdays", "Sundays"],
};

/** Hvenær skýrsla fer, á mannamáli: „alla mánudaga kl. 8“. */
export function describeSchedule(s: ReportSchedule, lang: string): string {
  const en = lang !== "is";
  const h = `${s.hour ?? 8}`;
  if (s.freq === "daily") return en ? `every day at ${h}:00` : `alla daga kl. ${h}`;
  if (s.freq === "monthly") return en ? `on day ${s.day ?? 1} of every month at ${h}:00` : `${s.day ?? 1}. hvers mánaðar kl. ${h}`;
  return en ? `every ${WEEKDAYS_PL.en[s.weekday ?? 1].slice(0, -1)} at ${h}:00` : `alla ${WEEKDAYS_PL.is[s.weekday ?? 1]} kl. ${h}`;
}

/** Reglan á mannamáli: „Láttu mig vita ef starfsmaður fer yfir 180 klst. á mánuði“. */
export function describeAlert(rule: Pick<AlertRuleInput, "kind" | "params" | "schedule">, lang: string): string {
  const L = lang === "is" ? "is" : "en";
  const p = rule.params;
  const per = PERIOD[L][p.period ?? "month"];
  switch (rule.kind) {
    case "hours_threshold": {
      const base = L === "is" ? `Láttu mig vita ef starfsmaður fer yfir ${num(p.hours ?? 0)} klst. ${per}` : `Tell me if an employee goes over ${num(p.hours ?? 0)} hrs ${per}`;
      const extra = [
        p.warnPct ? (L === "is" ? `viðvörun við ${p.warnPct} %` : `early warning at ${p.warnPct}%`) : "",
        p.includePlanned ? (L === "is" ? "líka ef planaðar vaktir fara yfir" : "including remaining planned shifts") : "",
      ].filter(Boolean);
      return extra.length ? `${base} (${extra.join(", ")})` : base;
    }
    case "overtime_threshold":
      return L === "is" ? `Láttu mig vita ef starfsmaður fer yfir ${num(p.hours ?? 0)} yfirvinnutíma ${per}` : `Tell me if an employee goes over ${num(p.hours ?? 0)} overtime hrs ${per}`;
    case "labor_pct_above":
      return L === "is"
        ? `Láttu mig vita ef laun % af veltu fer yfir ${dec1(p.pct ?? 0)} % ${p.period === "week" ? "í vikunni" : "í mánuðinum"}`
        : `Tell me if labor % of revenue goes over ${dec1(p.pct ?? 0)}% ${p.period === "week" ? "this week" : "this month"}`;
    case "report": {
      const rep = REPORT_NAME[L][p.report ?? "hours"];
      const when = rule.schedule ? describeSchedule(rule.schedule, L) : "";
      const rng = RANGE_LABEL[L][p.range ?? "last_week"];
      return L === "is" ? `Sendu mér ${rep} ${when} (${rng})` : `Send me ${rep} ${when} (${rng})`;
    }
  }
}
