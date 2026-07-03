// Company country → which payroll modules/labels are shown.
// "IS" = full Icelandic mode (kjarasamningar, uppbætur, kennitala, orlof handling,
// staðgreiðsla/tryggingagjald, Payday export). Anything else = standardized mode
// (hourly/monthly + configurable overtime %/premium bands + generic pension/union/
// vacation %). Pure — safe for Client Components.

export type Country = "IS" | "OTHER";

export function normCountry(c?: string | null): Country {
  return (c ?? "IS").toUpperCase() === "IS" ? "IS" : "OTHER";
}

/** True when Icelandic-specific features should show (kennitala, union presets,
 * uppbætur, Payday, staðgreiðsla labels). */
export function isIceland(c?: string | null): boolean {
  return normCountry(c) === "IS";
}

export const COUNTRY_OPTIONS: { value: Country; label: string }[] = [
  { value: "IS", label: "Ísland" },
  { value: "OTHER", label: "Annað land" },
];
