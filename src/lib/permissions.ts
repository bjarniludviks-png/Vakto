// Per-employee access to "Mitt svæði" functions + benefits/allowances.
// Pure types — safe to import from Client Components.

export type Perms = { clock: boolean; shifts: boolean; pay: boolean; requests: boolean; card: boolean; chat: boolean };

export const PERM_FIELDS: { key: keyof Perms; label: string; hint: string }[] = [
  { key: "clock", label: "Stimpla inn/út", hint: "klukka sig inn og út í appinu" },
  { key: "shifts", label: "Sjá eigin vaktir & tíma", hint: "vaktaplan og unnir tímar" },
  { key: "pay", label: "Sjá laun & launaseðla", hint: "launaupplýsingar og seðlar" },
  { key: "requests", label: "Senda beiðnir", hint: "frí, vaktaskipti og leiðréttingar" },
  { key: "card", label: "Starfsmannaskírteini", hint: "stafrænt skírteini" },
  { key: "chat", label: "Spjall", hint: "innra spjall fyrirtækisins" },
];

export const DEFAULT_PERMS: Perms = { clock: true, shifts: true, pay: true, requests: true, card: true, chat: true };

export function resolvePerms(p?: Partial<Perms> | null): Perms {
  return { ...DEFAULT_PERMS, ...(p ?? {}) };
}

// ---- benefits / allowances ----
export type Benefit = { name: string; type: "fixed" | "perkm"; amount: number };
// amount = kr/month for fixed, kr/km for perkm.

export const BENEFIT_PRESETS = ["Ökutækjastyrkur", "Símakostnaður", "Fatastyrkur", "Líkamsrækt", "Dagpeningar"];
