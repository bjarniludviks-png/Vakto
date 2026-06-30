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

// ⚠️ UNCONFIRMED placeholders — verify against each agreement before real pay.
export const UNION_PRESETS: Record<string, RuleSet> = {
  "Efling": { eve: 33, weekend: 45, overtime: 90, holiday: 90, night: 45 },
  "Efling – veitingar/SGS": { eve: 33, weekend: 45, overtime: 90, holiday: 90, night: 55 },
  "VR": { eve: 33, weekend: 45, overtime: 80, holiday: 90, night: 40 },
  "Matvís": { eve: 33, weekend: 45, overtime: 95, holiday: 100, night: 50 },
};
export const ZERO_RULESET: RuleSet = { eve: 0, weekend: 0, overtime: 0, holiday: 0, night: 0 };

/** Effective rule set: union preset, or the employee's custom set. */
export function resolveRuleSet(union: string | null | undefined, custom?: Partial<RuleSet> | null): RuleSet {
  if (union === CUSTOM_UNION) return { ...ZERO_RULESET, ...(custom ?? {}) };
  return UNION_PRESETS[union ?? ""] ?? UNION_PRESETS["Efling"];
}
