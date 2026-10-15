// Launaliðir starfsmanns sem ráða útborgun og kostnaði: skattkort, lífeyrir, viðbótarlífeyrir,
// stéttarfélag og sjóðir. Hrein föll — má nota í Client Components. Geymt í employees.pay_settings (0081).
// Fyrirtækið á sjálfgefin gildi (companies.pay_defaults) sem nýir starfsmenn erfa.

export type PaySettings = {
  taxCardPct: number;            // hlutfall persónuafsláttar nýtt hér (0–100)
  spouseTaxCardPct: number;      // hlutfall persónuafsláttar maka (0–100)
  accumulatedAllowance: number;  // uppsafnaður ónýttur persónuafsláttur á árinu (kr), gengur á hann
  startBracket: 1 | 2 | 3;       // fleiri launagreiðendur: hefja staðgreiðslu í hærra þrepi
  pensionPct: number;            // iðgjald starfsmanns (4%)
  employerPensionPct: number;    // mótframlag (11,5%)
  rehabPct: number;              // endurhæfingarsjóður VIRK, greitt með lífeyri (0,1%)
  extraPensionFund: string | null;
  extraPensionPct: number;       // viðbótarlífeyrir starfsmanns (0–4%), frádráttarbær frá skatti
  extraEmployerPct: number;      // mótframlag í viðbót (2%), aðeins ef starfsmaður greiðir viðbót
  unionFeePct: number;           // félagsgjald, dregið af starfsmanni
  sickFundPct: number;           // sjúkrasjóður, greitt af launagreiðanda
  holidayFundPct: number;        // orlofs(heimila)sjóður
  educationFundPct: number;      // starfsmenntasjóður
  memberFundPct: number;         // félagsmannasjóður (sum félög)
  orlofAccount: string | null;   // orlofsreikningur „0000-00-000000“ (orlof lagt inn á banka)
};

export const DEFAULT_PAY: PaySettings = {
  taxCardPct: 100, spouseTaxCardPct: 0, accumulatedAllowance: 0, startBracket: 1,
  pensionPct: 4, employerPensionPct: 11.5, rehabPct: 0.1,
  extraPensionFund: null, extraPensionPct: 0, extraEmployerPct: 2,
  unionFeePct: 0.7, sickFundPct: 1, holidayFundPct: 0.25, educationFundPct: 0.3, memberFundPct: 0,
  orlofAccount: null,
};

/** Starfsmaður utan stéttarfélags: engin félagsgjöld né sjóðir. */
export const NO_UNION_PAY: Partial<PaySettings> = { unionFeePct: 0, sickFundPct: 0, holidayFundPct: 0, educationFundPct: 0, memberFundPct: 0 };

const num = (v: unknown, d: number, lo = 0, hi = 100) => { const n = Number(v); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : d; };

/** Starfsmannsstillingar ofan á sjálfgefin gildi fyrirtækisins ofan á landsstaðal. */
export function resolvePay(own?: Partial<PaySettings> | null, company?: Partial<PaySettings> | null): PaySettings {
  const m = { ...DEFAULT_PAY, ...(company ?? {}), ...(own ?? {}) };
  return {
    taxCardPct: num(m.taxCardPct, 100), spouseTaxCardPct: num(m.spouseTaxCardPct, 0),
    accumulatedAllowance: num(m.accumulatedAllowance, 0, 0, 1e9),
    startBracket: ([1, 2, 3].includes(Number(m.startBracket)) ? Number(m.startBracket) : 1) as 1 | 2 | 3,
    pensionPct: num(m.pensionPct, 4), employerPensionPct: num(m.employerPensionPct, 11.5), rehabPct: num(m.rehabPct, 0.1),
    extraPensionFund: m.extraPensionFund?.trim() || null,
    extraPensionPct: num(m.extraPensionPct, 0, 0, 4), extraEmployerPct: num(m.extraEmployerPct, 2),
    unionFeePct: num(m.unionFeePct, 0.7), sickFundPct: num(m.sickFundPct, 1), holidayFundPct: num(m.holidayFundPct, 0.25),
    educationFundPct: num(m.educationFundPct, 0.3), memberFundPct: num(m.memberFundPct, 0),
    orlofAccount: m.orlofAccount?.trim() || null,
  };
}

// ---------- staðgreiðsla (skatturinn.is) ----------
// Mánaðarleg þrep og persónuafsláttur. Bætið við nýju ári í desember þegar Skatturinn birtir það.
export type TaxYear = { allowance: number; brackets: [number, number][]; insurance: number };
export const TAX_BY_YEAR: Record<number, TaxYear> = {
  2025: { allowance: 68691, brackets: [[472005, 31.49], [1325127, 37.99], [Infinity, 46.29]], insurance: 6.35 },
  2026: { allowance: 72492, brackets: [[498122, 31.49], [1398450, 37.99], [Infinity, 46.29]], insurance: 6.35 },
};
export function taxYear(year: number): TaxYear {
  const ys = Object.keys(TAX_BY_YEAR).map(Number).sort((a, b) => a - b);
  return TAX_BY_YEAR[Math.max(ys[0], Math.min(ys[ys.length - 1], year))];
}

/** Staðgreiðsla mánaðar áður en persónuafsláttur er dreginn frá. */
export function taxBeforeAllowance(taxable: number, year: number, startBracket: 1 | 2 | 3 = 1): number {
  const { brackets } = taxYear(year);
  let tax = 0, lower = 0;
  for (let i = 0; i < brackets.length; i++) {
    const [upper, pct] = brackets[i];
    if (i + 1 < startBracket) { lower = upper; continue; }
    const from = i + 1 === startBracket ? 0 : lower;
    const slice = Math.max(0, Math.min(taxable, upper) - from);
    tax += slice * pct / 100;
    lower = upper;
    if (taxable <= upper) break;
  }
  return tax;
}

/** Orlofsdagar ↔ orlofsprósenta: dagar / (260 − dagar). 24 → 10,17%, 30 → 13,04%. */
export const ORLOF_DAYS = [24, 25, 26, 27, 28, 29, 30] as const;
export const orlofPctForDays = (d: number) => Math.round((d / (260 - d)) * 10000) / 100;
export const orlofDaysForPct = (p: number) => ORLOF_DAYS.find((d) => Math.abs(orlofPctForDays(d) - p) < 0.005) ?? null;
