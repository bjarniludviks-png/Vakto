// Pure pay-rule types + defaults — safe to import from Client Components.
// ⚠️ These percentages are the STANDARD Icelandic structure but are UNCONFIRMED
// placeholders. They MUST be verified against the real agreement (Efling / VR /
// SGS …) before being used on real pay. The DB (pay_rules) stores per-company
// overrides + a `confirmed` flag set when a manager verifies a rate.

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
export type RuleSet = { eve: number; weekend: number; overtime: number; holiday: number; night: number };

export const RULE_FIELDS: { key: keyof RuleSet; label: string; hint: string }[] = [
  { key: "eve", label: "Kvöld-/morgunálag", hint: "t.d. fyrir 08:00 og eftir 17:00" },
  { key: "weekend", label: "Helgarálag", hint: "laugardaga & sunnudaga" },
  { key: "overtime", label: "Yfirvinna", hint: "yfir umsaminni vinnuviku" },
  { key: "holiday", label: "Stórhátíðarálag", hint: "stórhátíðardagar" },
  { key: "night", label: "Næturálag", hint: "yfir nóttina" },
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
};
export const DEFAULT_OT_WEEKLY = 40;
export const DEFAULT_MONTHLY_HOURS = 173.33;

// ⚠️ UNCONFIRMED placeholders — verify against each agreement before real pay.
export const UNION_PRESETS: Record<string, RuleSet> = {
  "Efling": { eve: 33, weekend: 45, overtime: 90, holiday: 90, night: 45 },
  "Efling – veitingar/SGS": { eve: 33, weekend: 45, overtime: 90, holiday: 90, night: 55 },
  "VR": { eve: 33, weekend: 45, overtime: 80, holiday: 90, night: 40 },
  "Matvís": { eve: 33, weekend: 45, overtime: 95, holiday: 100, night: 50 },
};
export const ZERO_RULESET: RuleSet = { eve: 0, weekend: 0, overtime: 0, holiday: 0, night: 0 };

/** Effective rule set: union preset, or the employee's custom set (incl. custom
 * overtime thresholds + premium bands when "Eigin reglur" is selected). */
export function resolveRuleSet(union: string | null | undefined, custom?: Partial<CustomRules> | null): CustomRules {
  if (union === CUSTOM_UNION) return { ...ZERO_RULESET, ...(custom ?? {}) };
  return UNION_PRESETS[union ?? ""] ?? UNION_PRESETS["Efling"];
}

// ---------- desember- & orlofsuppbót (kjarasamningsbundnar árlegar greiðslur) ----------
// kr/ár fyrir 100% starfshlutfall, fullt orlofs-/almanaksár. Hlutfallað eftir
// starfshlutfalli (og starfstíma). Orlofsuppbót greiðist 1. júní, desemberuppbót
// 1. desember. ⚠️ ÓSTAÐFEST — yfirfarið gegn samningi hvers árs áður en greitt er.
export type UppbotSet = { orlof: number; desember: number };

export const UNION_UPPBOT: Record<string, UppbotSet> = {
  "Efling": { orlof: 60000, desember: 112000 },
  "Efling – veitingar/SGS": { orlof: 60000, desember: 112000 },
  "VR": { orlof: 56000, desember: 103000 },
  "Matvís": { orlof: 60000, desember: 112000 },
};
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

/** Uppbót amounts for an employee's agreement (custom = company can override). */
export function resolveUppbot(union: string | null | undefined, custom?: Partial<UppbotSet> | null): UppbotSet {
  if (union === CUSTOM_UNION) return { ...ZERO_UPPBOT, ...(custom ?? {}) };
  return UNION_UPPBOT[union ?? ""] ?? UNION_UPPBOT["Efling"];
}
