// Pure pay-rule types + defaults — safe to import from Client Components.
// ⚠️ These percentages are the STANDARD Icelandic structure but are UNCONFIRMED
// placeholders. They MUST be verified against the real agreement (Efling / VR /
// SGS …) before being used on real pay. The DB (pay_rules) stores per-company
// overrides + a `confirmed` flag set when a manager verifies a rate.
import { familyFor } from "./entitlements";

export type PayRuleKind = "premium" | "overtime" | "holiday";
export type PayRule = {
  code: string;
  label: string;
  kind: PayRuleKind;
  pct: number; // premium % over the base rate
  confirmed: boolean;
  sort: number;
};

export const DEFAULT_RULES: PayRule[] = [
  { code: "dagvinna", label: "Dagvinna", kind: "premium", pct: 0, confirmed: false, sort: 0 },
  { code: "alag_kvold", label: "Kvöld-/morgunálag", kind: "premium", pct: 33, confirmed: false, sort: 1 },
  { code: "alag_helgi", label: "Helgarálag", kind: "premium", pct: 45, confirmed: false, sort: 2 },
  { code: "yfirvinna", label: "Yfirvinna", kind: "overtime", pct: 90, confirmed: false, sort: 3 },
  { code: "storhatid", label: "Stórhátíðarálag", kind: "holiday", pct: 90, confirmed: false, sort: 4 },
];

/** Merge DB overrides (by code) over the code defaults. */
export function mergeRules(overrides: Partial<PayRule>[]): PayRule[] {
  return DEFAULT_RULES.map((d) => {
    const o = overrides.find((x) => x.code === d.code);
    return o ? { ...d, ...o, code: d.code, label: o.label ?? d.label } : d;
  }).sort((a, b) => a.sort - b.sort);
}

/** True when every premium/overtime rate has been verified. */
export function allConfirmed(rules: PayRule[]): boolean {
  return rules.every((r) => r.confirmed);
}

// ---------- per-employee rule sets (union preset or custom) ----------
export type RuleSet = {
  eve: number; weekend: number; overtime: number; holiday: number; night: number;
  // Tímagluggar (heilar klst., virkir dagar). Sjálfgefið skv. vaktaálagsgreinum SA-samninga:
  // næturálag 00–08, dagvinna 08–17, kvöldálag 17–24. VR: næturvinna 00–07, dagvinna 09–18.
  nightEnd?: number; dayStart?: number; dayEnd?: number;
  verslStor?: boolean; // frídagur verslunarmanna er stórhátíðardagur (VR, gr. 2.3.2)
};

export type RulePctKey = "eve" | "weekend" | "overtime" | "holiday" | "night";
export const RULE_FIELDS: { key: RulePctKey; label: string; hint: string }[] = [
  { key: "eve", label: "Kvöld-/morgunálag", hint: "virka daga utan dagvinnu, t.d. 17–24" },
  { key: "weekend", label: "Helgarálag", hint: "laugardaga & sunnudaga" },
  { key: "overtime", label: "Yfirvinna", hint: "yfir umsaminni vinnuviku" },
  { key: "holiday", label: "Stórhátíðarálag", hint: "stórhátíðardagar" },
  { key: "night", label: "Næturálag", hint: "t.d. 00–08" },
];

export const CUSTOM_UNION = "Eigin reglur";

// ---- custom (build-your-own) rules: thresholds + user-defined premium bands ----
// A band = "this weekday + time window → this % premium" (e.g. Sun 00:00–24:00 +45%,
// or 18:00–23:00 +33% weekdays). days: 0=Sun … 6=Sat. from/to "HH:MM" (to may wrap
// past midnight). Bands stack on top of the base RuleSet — the highest % wins.
export type Band = { label: string; days: number[]; from: string; to: string; pct: number };
export type CustomRules = RuleSet & {
  otWeekly?: number;  // klst/viku áður en yfirvinna tekur við (default 40)
  otMonthly?: number; // klst/mánuði áður en yfirvinna tekur við (0/ósett = óvirkt)
  bands?: Band[];
  /** Staðall valinn fyrir félag sem er ekki sjálft staðall (sama og vefurinn, employees.pay_rule.agreement). */
  agreement?: string;
};
export const DEFAULT_OT_WEEKLY = 40;
export const DEFAULT_MONTHLY_HOURS = 173.33;

// Úr samningum við SA 2024–2028 (lesnir 13. okt. 2026). Álag er % ofan á dagvinnutímakaup.
// Yfirvinna og stórhátíðarkaup eru í samningunum % af mánaðarlaunum á klst.; hér umreiknað
// með deilitölu samningsins (1,0385% × deilitala − 100%). Einfaldanir sem ein tala nær ekki:
//  • Vaktaálag gildir um vaktavinnufólk. Dagvinnufólk fær yfirvinnukaup utan dagvinnu —
//    notið „Eigin reglur“ fyrir það.
//  • Efling almennur: vaktaálag fer eftir köflum (33/45/90 er kafli 21–23: mötuneyti, ræsting, gæsla).
//  • Matvís: yfirvinna 1 (fyrstu 4 klst./viku umfram 36, ~56%) er ekki reiknuð sér; yfirvinna 2
//    (~79,4%) gildir yfir 40 klst. Matreiðslu- og framreiðslumenn: 31% álag á 2% hærri grunn.
//  • VR: eftirvinna/næturvinna (verslun, deilitala 167,94); skrifstofa er sér.
export const UNION_PRESETS: Record<string, RuleSet> = {
  "Efling": { eve: 33, weekend: 45, overtime: 80, holiday: 90, night: 45 },
  "Efling – veitingar/SGS": { eve: 33, weekend: 45, overtime: 78.6, holiday: 90, night: 45 },
  "VR": { eve: 38.3, weekend: 38.3, overtime: 74.4, holiday: 130.9, night: 48.2, nightEnd: 7, dayStart: 9, dayEnd: 18, verslStor: true },
  "VR – skrifstofa": { eve: 39.4, weekend: 39.4, overtime: 65.4, holiday: 119, night: 49.3, nightEnd: 7, dayStart: 9, dayEnd: 18, verslStor: true },
  "Matvís": { eve: 33, weekend: 45, overtime: 79.4, holiday: 90, night: 45 },
};
export const ZERO_RULESET: RuleSet = { eve: 0, weekend: 0, overtime: 0, holiday: 0, night: 0 };

/** Effective rule set: union preset, or the employee's custom set (incl. custom
 * overtime thresholds + premium bands when "Eigin reglur" is selected). */
export function resolveRuleSet(union: string | null | undefined, custom?: Partial<CustomRules> | null): CustomRules {
  if (union === CUSTOM_UNION) return { ...ZERO_RULESET, ...(custom ?? {}) };
  return UNION_PRESETS[agreementFor(union, custom)];
}

/** Sama regla og vefurinn (src/lib/payrules.ts): val stjórnanda, félagið ef staðall, SGS-félög → SGS-veitingar, VR-félög → VR. */
export function agreementFor(union: string | null | undefined, custom?: Partial<CustomRules> | null): string {
  if (custom?.agreement && UNION_PRESETS[custom.agreement]) return custom.agreement;
  const u = union ?? "";
  if (UNION_PRESETS[u]) return u;
  const fam = familyFor(u);
  if (fam === "sa-sgs") return "Efling – veitingar/SGS";
  if (fam === "sa-vr") return "VR";
  return "Efling";
}

// ---------- desember- & orlofsuppbót (kjarasamningsbundnar árlegar greiðslur) ----------
// kr/ár fyrir 100% starfshlutfall, fullt ár (45 unnar vikur). Hlutfallað eftir starfshlutfalli
// og starfstíma. Orlofsuppbót greiðist 1. júní, desemberuppbót í síðasta lagi 15. desember.
// Upphæðirnar eru þær sömu í samningum Eflingar, SGS, VR og Matvís við SA 2024–2028
// (gr. 1.3/1.4; lesið úr samningstextunum 13. okt. 2026). Lykillinn er GREIÐSLUÁRIÐ:
// orlofsuppbót greidd í júní 2026 er fyrir orlofsárið sem hefst 1. maí 2026.
// Samningarnir gilda til 1. feb. 2028 — bætið við nýju ári þegar nýr samningur liggur fyrir.
export type UppbotSet = { orlof: number; desember: number };

export const UPPBOT_BY_YEAR: Record<number, UppbotSet> = {
  2024: { orlof: 58000, desember: 106000 },
  2025: { orlof: 60000, desember: 110000 },
  2026: { orlof: 62000, desember: 114000 },
  2027: { orlof: 64000, desember: 118000 },
};
/** Upphæðir greiðsluársins; utan töflunnar gildir næsta þekkta ár. */
export function uppbotForYear(year: number): UppbotSet {
  const years = Object.keys(UPPBOT_BY_YEAR).map(Number).sort((a, b) => a - b);
  const y = Math.max(years[0], Math.min(years[years.length - 1], year));
  return UPPBOT_BY_YEAR[y];
}
export const ZERO_UPPBOT: UppbotSet = { orlof: 0, desember: 0 };

// ---------- orlof (vacation) handling — mirrors Payday's options ----------
// How the employee's accrued vacation pay is treated each payroll run.
export type OrlofMode = "accrue_amount" | "accrue_hours" | "accrue_days" | "pay_out" | "to_bank";
export type OrlofSet = { mode: OrlofMode; pct: number }; // pct = orlofsprósenta (e.g. 10.17)
export const DEFAULT_ORLOF: OrlofSet = { mode: "accrue_amount", pct: 10.17 };
export const ORLOF_MODES: { key: OrlofMode; label: string }[] = [
  { key: "accrue_amount", label: "Uppsöfnuð upphæð" },
  { key: "accrue_hours", label: "Uppsafnaðir tímar" },
  { key: "accrue_days", label: "Uppsafnaðir dagar" },
  { key: "pay_out", label: "Greitt út jafnóðum" },
  { key: "to_bank", label: "Lagt inn á orlofsreikning" },
];
export function resolveOrlof(o?: Partial<OrlofSet> | null): OrlofSet {
  return { ...DEFAULT_ORLOF, ...(o ?? {}) };
}

/** Uppbót amounts for an employee's agreement in a payment year (custom = company can override). */
export function resolveUppbot(union: string | null | undefined, custom?: Partial<UppbotSet> | null, year: number = new Date().getFullYear()): UppbotSet {
  if (union === CUSTOM_UNION) return { ...ZERO_UPPBOT, ...(custom ?? {}) };
  return uppbotForYear(year);
}
