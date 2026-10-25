import type { PayLine } from "@/lib/payroll";

// Launabókun í Business Central: ein samantektarfærsla per launatímabil (debet = jákvætt, kredit = neikvætt).
// Gjöld: laun (+ dagpeningar + uppsafnað orlof) og launatengd gjöld. Skuldir: útborgun, staðgreiðsla,
// lífeyrissjóðir, stéttarfélög/sjóðir, tryggingagjald og orlofsskuld. Launareikningurinn jafnar færsluna.

export type BcPayAccounts = {
  laun?: string; launatengd?: string; ogreidd?: string; stadgreidsla?: string; lifeyrir?: string;
  felog?: string; trygg?: string; orlof?: string; hlunnindi?: string; batch?: string;
};
export type BcAccKey = Exclude<keyof BcPayAccounts, "batch">;

export const BC_PAY_ACCOUNTS: { k: BcAccKey; is: string; en: string; optional?: boolean }[] = [
  { k: "laun", is: "Laun (gjöld)", en: "Wages (expense)" },
  { k: "launatengd", is: "Launatengd gjöld (gjöld)", en: "Payroll taxes & contributions (expense)" },
  { k: "ogreidd", is: "Ógreidd laun (skuld)", en: "Net pay payable" },
  { k: "stadgreidsla", is: "Staðgreiðsla (skuld)", en: "Withholding tax payable" },
  { k: "lifeyrir", is: "Lífeyrissjóðir (skuld)", en: "Pension funds payable" },
  { k: "felog", is: "Stéttarfélög og sjóðir (skuld)", en: "Union fees & funds payable" },
  { k: "trygg", is: "Tryggingagjald (skuld)", en: "Social security tax payable" },
  { k: "orlof", is: "Orlofsskuld", en: "Holiday pay payable" },
  { k: "hlunnindi", is: "Hlunnindi, mótfærsla (valfrjálst)", en: "Benefits in kind, offset (optional)", optional: true },
];

export type BcJournalLine = { account: string; amount: number; label: string };

export function bcPayrollLines(lines: PayLine[], acc: BcPayAccounts): BcJournalLine[] {
  const s = (f: (l: PayLine) => number) => lines.reduce((a, l) => a + Math.round(f(l) || 0), 0);
  const levies = s((l) => l.employerPension + l.insurance + l.funds);
  const credits: [BcAccKey, number, string][] = [
    ["ogreidd", s((l) => l.net), "Útborguð laun"],
    ["stadgreidsla", s((l) => l.withholding), "Staðgreiðsla"],
    ["lifeyrir", s((l) => l.pension + l.extraPension + l.employerPension), "Lífeyrissjóðir"],
    ["felog", s((l) => l.union + l.funds), "Stéttarfélög og sjóðir"],
    ["trygg", s((l) => l.insurance), "Tryggingagjald"],
    ["orlof", s((l) => l.orlofToBank + l.orlofAccrued), "Orlofsskuld"],
    [acc.hlunnindi ? "hlunnindi" : "laun", s((l) => l.benefitsInKind), "Hlunnindi"],
  ];
  const creditSum = credits.reduce((a, [, v]) => a + v, 0);
  const raw: [BcAccKey, number, string][] = [
    ["laun", creditSum - levies, "Laun"],
    ["launatengd", levies, "Launatengd gjöld"],
    ...credits.map(([k, v, t]) => [k, -v, t] as [BcAccKey, number, string]),
  ];
  // Sami reikningur oftar en einu sinni (t.d. hlunnindi á launareikning) → ein lína.
  const out = new Map<string, BcJournalLine>();
  for (const [k, v, label] of raw) {
    const account = (acc[k] ?? "").trim();
    const cur = out.get(account);
    if (cur) cur.amount += v; else out.set(account, { account, amount: v, label });
  }
  return [...out.values()].filter((l) => l.amount !== 0);
}

/** Reikningar sem vantar (ónotaðar línur skipta ekki máli). */
export function bcMissingAccounts(lines: PayLine[], acc: BcPayAccounts): BcAccKey[] {
  const need: BcAccKey[] = ["laun", "launatengd", "ogreidd", "stadgreidsla", "lifeyrir", "felog", "trygg", "orlof"];
  const used = new Set(bcPayrollLines(lines, Object.fromEntries(need.map((k) => [k, k])) as BcPayAccounts).map((l) => l.account));
  return need.filter((k) => used.has(k) && !(acc[k] ?? "").trim());
}
