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
// taxable = staðgreiðsluskylt (true) eða undanþegið staðgreiðslu (false).
export type Benefit = { name: string; type: "fixed" | "perkm"; amount: number; taxable?: boolean };
// amount = kr/month for fixed, kr/km for perkm.

// Payday-samhæfðir launaliðir (hlunnindi & styrkir). type/taxable eru sjálfgefin
// per lið; notandi getur breytt. taxable=false → undanþegið staðgreiðslu.
export type BenefitPreset = { name: string; type: "fixed" | "perkm"; taxable: boolean };
export const BENEFIT_PRESETS: BenefitPreset[] = [
  { name: "Bónus", type: "fixed", taxable: true },
  { name: "Samgöngustyrkur", type: "fixed", taxable: true },
  { name: "Íþróttastyrkur", type: "fixed", taxable: true },
  { name: "Húsnæðishlunnindi", type: "fixed", taxable: true },
  { name: "Fæðishlunnindi", type: "fixed", taxable: true },
  { name: "Fatahlunnindi", type: "fixed", taxable: true },
  { name: "Bifreiðahlunnindi", type: "fixed", taxable: true },
  { name: "Ökutækjastyrkur", type: "perkm", taxable: true },
  { name: "Ökutækjastyrkur undanþeginn staðgreiðslu", type: "perkm", taxable: false },
  { name: "Dagpeningar undanþegnir staðgreiðslu", type: "fixed", taxable: false },
];

export const BENEFIT_NAMES = BENEFIT_PRESETS.map((p) => p.name);
export function benefitPreset(name: string): BenefitPreset | undefined {
  return BENEFIT_PRESETS.find((p) => p.name === name);
}
/** Default taxable when not stored (older rows): infer from the name. */
export function isTaxable(b: Benefit): boolean {
  if (typeof b.taxable === "boolean") return b.taxable;
  return benefitPreset(b.name)?.taxable ?? !/undanþeg/i.test(b.name);
}
