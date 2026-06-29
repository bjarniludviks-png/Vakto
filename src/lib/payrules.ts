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
