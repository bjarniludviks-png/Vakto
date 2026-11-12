// Icelandic payroll calc (brief §9) — pure, deterministic.
// AFRIT af src/lib/payroll.ts á vefnum (sami útreikningur og launakeyrslan). Breyttu báðum saman.
import type { RuleSet, CustomRules, Band, OrlofSet } from "./payrules";
import { resolveOrlof } from "./payrules";
import { resolvePay, taxBeforeAllowance, taxYear, type PaySettings } from "./paysettings";

type Employee = { id: string; fullName: string; payType: "hourly" | "monthly"; rate: number; employmentRatio: number };

export const PERSONAL_ALLOWANCE = taxYear(new Date().getFullYear()).allowance; // persónuafsláttur kr/mán
// Gróft hlutfall launatengdra gjalda ofan á brúttó — AÐEINS fyrir áætlanir þar sem enginn starfsmaður er
// (mælaborð, launaáætlun). Raunverulegur kostnaður starfsmanns er PayLine.cost úr finalize().
export const BURDEN = 0.302;
const MONTHLY_HOURS = 173.33;

export type PayLine = {
  employeeId: string;
  name: string;
  hours: number;
  gross: number;          // öll staðgreiðsluskyld laun tímabilsins (m. orlofi sem er greitt/lagt inn og uppbót)
  dayPay: number;
  premiums: number;
  overtime: number;
  uppbot: number; // desember-/orlofsuppbót this period (0 outside June/December)
  orlof: number;          // orlofslaun greidd út eða lögð inn á orlofsreikning (hluti af gross)
  orlofToBank: number;    // sá hluti sem fer á orlofsreikning (dreginn frá útborgun)
  orlofAccrued: number;   // orlof sem safnast upp (ekki greitt núna — kostnaður, ekki laun)
  benefits: number;       // staðgreiðsluskyld hlunnindi og styrkir (hluti af gross)
  benefitsInKind: number; // þar af hlunnindi í fríðu (húsnæði, fæði, bíll) — skattlögð en ekki greidd út
  benefitsFree: number;   // undanþegið staðgreiðslu (t.d. dagpeningar) — bætist við útborgun
  withholding: number;
  pension: number;        // lífeyrisiðgjald starfsmanns
  extraPension: number;   // viðbótarlífeyrissparnaður starfsmanns
  union: number;          // félagsgjald
  allowanceUsed: number;  // nýttur uppsafnaður persónuafsláttur
  net: number;
  employerPension: number; // mótframlag + VIRK + mótframlag í viðbót
  insurance: number;      // tryggingagjald
  funds: number;          // sjúkra-, orlofs-, starfsmennta- og félagsmannasjóðir
  cost: number; // employer cost: gross + launatengd gjöld + uppsafnað orlof
};

type EmpPick = Pick<Employee, "id" | "fullName" | "payType" | "rate" | "employmentRatio"> & { pay?: Partial<PaySettings> | null; orlof?: Partial<OrlofSet> | null; benefits?: { name: string; type: string; amount: number; taxable?: boolean }[] | null };

/** Frádráttur, staðgreiðsla og launatengd gjöld ofan á gefin laun. Ein regla fyrir alla útreikninga. */
function deductions(e: EmpPick, base: Omit<PayLine, "withholding" | "pension" | "extraPension" | "union" | "allowanceUsed" | "net" | "employerPension" | "insurance" | "funds" | "cost">, year: number): PayLine {
  const pay = resolvePay(e.pay);
  const gross = base.gross;
  const pension = Math.round(gross * pay.pensionPct / 100);
  const extraPension = Math.round(gross * pay.extraPensionPct / 100);
  const union = Math.round(gross * pay.unionFeePct / 100);
  const taxable = Math.max(0, gross - pension - extraPension);
  const tax = Math.round(taxBeforeAllowance(taxable, year, pay.startBracket));
  const allowance = Math.round(taxYear(year).allowance * (Math.min(100, pay.taxCardPct) + Math.min(100, pay.spouseTaxCardPct)) / 100);
  const afterOwn = Math.max(0, tax - allowance);
  const allowanceUsed = Math.min(afterOwn, Math.round(pay.accumulatedAllowance));
  const withholding = afterOwn - allowanceUsed;
  const net = Math.round(gross - pension - extraPension - union - withholding - base.orlofToBank - base.benefitsInKind + base.benefitsFree);
  const ins = taxYear(year).insurance;
  const empPct = pay.employerPensionPct + pay.rehabPct + (pay.extraPensionPct > 0 ? pay.extraEmployerPct : 0);
  const fundPct = pay.sickFundPct + pay.holidayFundPct + pay.educationFundPct + pay.memberFundPct;
  const employerPension = Math.round(gross * empPct / 100);
  const insurance = Math.round(gross * ins / 100);
  const funds = Math.round(gross * fundPct / 100);
  // Uppsafnað orlof er greitt síðar og ber þá sömu gjöld — telst með í kostnaði tímabilsins.
  const accruedCost = Math.round(base.orlofAccrued * (1 + (empPct + ins + fundPct) / 100));
  const cost = gross + employerPension + insurance + funds + accruedCost + base.benefitsFree;
  return { ...base, withholding, pension, extraPension, union, allowanceUsed, net, employerPension, insurance, funds, cost };
}

// baseGross = pay from worked/contracted hours. uppbot is added on top (taxable +
// pension-bearing, orlof ekki reiknað af henni) and tracked separately so it shows as its own launaliður.
// split = raunveruleg sundurliðun (úr stimplunum). Án hennar er notuð gróf skipting sem má
// ALDREI birta á launaseðli — aðeins fyrir yfirlitstölur (computeLine, demo).
function finalize(e: EmpPick, hours: number, baseGross: number, uppbot = 0, split?: { dayPay: number; premiums: number; overtime: number }, year = new Date().getFullYear()): PayLine {
  const dayPay = split ? Math.round(split.dayPay) : Math.round(baseGross * 0.78);
  const premiums = split ? Math.round(split.premiums) : Math.round(baseGross * 0.15);
  const overtime = split ? Math.round(baseGross) - dayPay - premiums : Math.round(baseGross - dayPay - premiums);
  // Orlof reiknast af öllum launum nema uppbótum. Fastlaunafólk heldur mánaðarlaunum í orlofi
  // (orlof í dögum) — þar reiknast orlof aðeins af yfirvinnu, sem fastlaunin hér innihalda ekki.
  const o = resolveOrlof(e.orlof);
  const orlofBase = e.payType === "monthly" ? Math.round(baseGross) - dayPay - premiums : Math.round(baseGross);
  const orlofAmt = Math.max(0, Math.round(orlofBase * o.pct / 100));
  const paid = o.mode === "pay_out" || o.mode === "to_bank";
  const orlof = paid ? orlofAmt : 0;
  // Föst hlunnindi/styrkir (kr/mán). Staðgreiðsluskyld eru í stofni lífeyris og tryggingagjalds (lög 129/1997, 3. gr.),
  // en orlof reiknast ekki af þeim. Hlunnindi í fríðu eru ekki greidd út. Per-km styrkir krefjast skráðra km (ekki enn).
  const fixed = (e.benefits ?? []).filter((b) => b.type === "fixed" && Number(b.amount) > 0);
  const isTax = (b: { name: string; taxable?: boolean }) => (typeof b.taxable === "boolean" ? b.taxable : !/undanþeg/i.test(b.name));
  const benefits = Math.round(fixed.filter(isTax).reduce((a, b) => a + Number(b.amount), 0));
  const benefitsInKind = Math.round(fixed.filter((b) => isTax(b) && /hlunnindi/i.test(b.name)).reduce((a, b) => a + Number(b.amount), 0));
  const benefitsFree = Math.round(fixed.filter((b) => !isTax(b)).reduce((a, b) => a + Number(b.amount), 0));
  const gross = Math.round(baseGross) + Math.round(uppbot) + orlof + benefits;
  return deductions(e, {
    employeeId: e.id, name: e.fullName, hours, gross, dayPay, premiums, overtime, uppbot: Math.round(uppbot),
    orlof, orlofToBank: o.mode === "to_bank" ? orlof : 0, orlofAccrued: paid ? 0 : orlofAmt,
    benefits, benefitsInKind, benefitsFree,
  }, year);
}

/** Contracted-hours payroll line (monthly baseline). */
export function computeLine(e: EmpPick, uppbot = 0): PayLine {
  const hours = Math.round(MONTHLY_HOURS * (e.employmentRatio / 100));
  const gross = e.payType === "monthly" ? e.rate : hours * e.rate * 1.18;
  return finalize(e, hours, gross, uppbot);
}

/** Payroll line from actual worked hours (from approved punches in a period).
 * Hourly: gross = worked × rate × uplift. Monthly: full monthly salary. */
export function computeLineHours(e: EmpPick, workedHours: number, uppbot = 0): PayLine {
  const hours = Math.round(workedHours * 10) / 10;
  const gross = e.payType === "monthly" ? e.rate : Math.round(workedHours * e.rate * 1.18);
  return finalize(e, hours, gross, uppbot);
}

// ---------- desember- & orlofsuppbót ----------
/** Prorated uppbót. annual = kr/ár @100%, ratio = starfshlutfall %, monthsServed = months in the qualifying period (0–12). */
export function computeUppbot(annual: number, employmentRatio: number, monthsServed = 12): number {
  const r = Math.max(0, Math.min(1, employmentRatio / 100));
  const m = Math.max(0, Math.min(12, monthsServed));
  return Math.round(annual * r * (m / 12));
}
/** Mánuðir af 12 sem starfsmaður á rétt á uppbót fyrir, eftir starfstíma á viðmiðunartímabilinu:
 *  desember = almanaksár greiðsluársins, orlof = 1. maí árið áður til 30. apríl.
 *  Fullt ár = 45 unnar vikur utan orlofs, sem jafngildir öllu árinu í starfi; því hlutfall
 *  vikna í starfi af 52. Án ráðningardags er greidd full uppbót (eins og áður). */
export function uppbotMonths(kind: "orlof" | "desember", payYear: number, hireDate?: string | null): number {
  if (!hireDate) return 12;
  const start = kind === "desember" ? Date.UTC(payYear, 0, 1) : Date.UTC(payYear - 1, 4, 1);
  const end = kind === "desember" ? Date.UTC(payYear, 11, 31) : Date.UTC(payYear, 3, 30);
  const hired = Date.parse(`${hireDate.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(hired) || hired <= start) return 12;
  if (hired > end) return 0;
  const weeks = (end - hired) / (7 * 86400e3) + 1 / 7;
  return Math.min(12, Math.round((weeks / 52) * 12 * 100) / 100);
}
/** Which uppbót (if any) a payroll month pays. orlof → June, desember → December. */
export function uppbotForMonth(month1to12: number): "orlof" | "desember" | null {
  if (month1to12 === 6) return "orlof";
  if (month1to12 === 12) return "desember";
  return null;
}

// Helgidagar reiknaðir fyrir hvaða ár sem er (páskar með Gauss/Meeus-reglunni).
// ⚠️ ÓSTAÐFEST gagnvart einstökum kjarasamningum — skiptingin fylgir almennu reglunni á vinnumarkaði:
//   Stórhátíðardagar (stórhátíðarálag): nýársdagur, föstudagurinn langi, páskadagur, hvítasunnudagur,
//     17. júní, aðfangadagur frá kl. 12, jóladagur, gamlársdagur frá kl. 12.
//   Aðrir frídagar (sama álag og um helgar): skírdagur, annar í páskum, sumardagurinn fyrsti, 1. maí,
//     uppstigningardagur, annar í hvítasunnu, frídagur verslunarmanna, annar í jólum.
const pad2 = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
function easter(y: number): Date {
  const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31), day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(y, month - 1, day);
}
const yearCache = new Map<number, { stor: Set<string>; half: Set<string>; fri: Set<string>; versl: string }>();
function holidaysOf(y: number) {
  const hit = yearCache.get(y); if (hit) return hit;
  const E = easter(y), plus = (n: number) => isoOf(new Date(y, E.getMonth(), E.getDate() + n));
  const sumar = (() => { for (let d = 19; d <= 25; d++) if (new Date(y, 3, d).getDay() === 4) return `${y}-04-${pad2(d)}`; return `${y}-04-23`; })();
  const versl = (() => { for (let d = 1; d <= 7; d++) if (new Date(y, 7, d).getDay() === 1) return `${y}-08-${pad2(d)}`; return `${y}-08-01`; })();
  const out = {
    stor: new Set([`${y}-01-01`, plus(-2), plus(0), plus(49), `${y}-06-17`, `${y}-12-25`]),
    half: new Set([`${y}-12-24`, `${y}-12-31`]),                       // stórhátíð frá kl. 12
    fri: new Set([plus(-3), plus(1), sumar, `${y}-05-01`, plus(39), plus(50), versl, `${y}-12-26`]),
    versl,
  };
  yearCache.set(y, out); return out;
}
/** Stórhátíðarálag á þessari stundu? (Aðfangadagur og gamlársdagur aðeins frá kl. 12.) */
export function isStorhatid(dt: Date, r?: Pick<RuleSet, "verslStor">): boolean {
  const h = holidaysOf(dt.getFullYear()), iso = isoOf(dt);
  return h.stor.has(iso) || (h.half.has(iso) && dt.getHours() >= 12) || (!!r?.verslStor && iso === h.versl);
}
/** Almennur frídagur (ekki stórhátíð) — greiddur með helgarálagi. */
export function isFridagur(dt: Date): boolean {
  return holidaysOf(dt.getFullYear()).fri.has(isoOf(dt));
}
/** Dagsetning (YYYY-MM-DD) sem er stórhátíðardagur að hluta eða öllu leyti. */
export const STORHATID = { has(iso: string): boolean { const h = holidaysOf(Number(iso.slice(0, 4))); return h.stor.has(iso) || h.half.has(iso); } };
const OT_WEEKLY = 40; // yfirvinna yfir 40 klst/viku

/** Vikumörk yfirvinnu á gefnum degi — sumir samningar lækka mörkin á gildistímanum (otSteps, t.d. RSÍ 40 → 39,5 → 39). */
function weeklyAt(r: CustomRules, dt: Date, fallback: number): number {
  if (!r.otSteps?.length) return fallback;
  const iso = `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, "0")}-${String(dt.getDate()).padStart(2, "0")}`;
  let w = fallback;
  for (const st of [...r.otSteps].sort((a, b) => a.from.localeCompare(b.from))) if (st.from <= iso && st.weekly > 0) w = st.weekly;
  return w;
}
/** Yfirvinna á stundinni: tier 2 = yfir viku-/mánaðarmörkum (rules.overtime), tier 1 = yfirvinna 1 milli
 *  ot1Weekly og vikumarka (t.d. Matvís/RSÍ/Samiðn 56 %), 0 = engin. Án ot1/otSteps sama regla og áður. */
function otAt(r: CustomRules, dt: Date, acc: number, monthAcc: number, otWeekly: number, otMonthly: number): { active: boolean; pct: number; tier: 0 | 1 | 2 } {
  if (acc >= weeklyAt(r, dt, otWeekly) || monthAcc >= otMonthly) return { active: true, pct: r.overtime ?? 0, tier: 2 };
  if (r.ot1Weekly != null && r.ot1Pct != null && r.ot1Weekly > 0 && acc >= r.ot1Weekly) return { active: true, pct: r.ot1Pct, tier: 1 };
  return { active: false, pct: r.overtime ?? 0, tier: 0 };
}
const STEP = 0.25;

function mondayKey(d: Date): string {
  const x = new Date(d); x.setHours(0, 0, 0, 0); x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return `${x.getFullYear()}-${x.getMonth()}-${x.getDate()}`;
}
/** Launaþáttur álags: grunnþættir eða sérsniðið band (`b<index>` í rules.bands). Notað fyrir launalykla. */
export type PremComp = "holiday" | "weekend" | "night" | "eve" | "day" | `b${number}`;
function premiumComp(dt: Date, holiday: boolean, r: RuleSet): { pct: number; comp: PremComp } {
  if (holiday) return { pct: r.holiday, comp: "holiday" };
  const wd = dt.getDay();
  if (isFridagur(dt) && r.fridagur != null) return { pct: r.fridagur, comp: "weekend" }; // sumir samningar: helgidagar ≠ helgar
  if (wd === 0 || wd === 6 || isFridagur(dt)) return { pct: r.weekend, comp: "weekend" };
  const h = dt.getHours();
  if (h < (r.nightEnd ?? 8)) return { pct: r.night, comp: "night" };                     // næturálag 00–08 (VR 00–07)
  if (h < (r.dayStart ?? 8) || h >= (r.dayEnd ?? 17)) return { pct: r.eve, comp: "eve" }; // kvöld/eftirvinna
  return { pct: 0, comp: "day" }; // dagvinna
}
/** Hæsta álag á stundinni og þátturinn sem gaf það (grunnþáttur vinnur jafntefli). */
function premiumAt(dt: Date, rules: CustomRules): { pct: number; comp: PremComp } {
  const base = premiumComp(dt, isStorhatid(dt, rules), rules);
  const b = bandHit(dt, rules.bands ?? []);
  return b && b.pct > base.pct ? { pct: b.pct, comp: `b${b.index}` } : base;
}

// ---------- svigrúm (grace) ----------
// Stimplun innan ± graceMin mínútna frá upphafi/lokum dagvinnu á virkum degi (ekki frídegi) færist á mörkin.
// Dæmi (svigrúm 10 mín, dagvinna 08–17): inn 07:53 → 08:00, út 17:06 → 17:00. Óvirkt nema reglan setji graceMin.
export function applyGrace<T extends { clockIn: string; clockOut: string }>(punches: T[], rules: Pick<CustomRules, "graceMin" | "dayStart" | "dayEnd">): T[] {
  const g = rules.graceMin ?? 0;
  if (!(g > 0)) return punches;
  const snap = (iso: string, hour: number): string => {
    const d = new Date(iso);
    const wd = d.getDay();
    if (wd === 0 || wd === 6 || isFridagur(d) || isStorhatid(d)) return iso;
    const mark = new Date(d); mark.setHours(hour, 0, 0, 0);
    return Math.abs(d.getTime() - mark.getTime()) <= g * 60000 ? mark.toISOString() : iso;
  };
  return punches.map((p) => {
    if (!p.clockOut) return p;
    const ci = snap(p.clockIn, rules.dayStart ?? 8);
    const co = snap(p.clockOut, rules.dayEnd ?? 17);
    return Date.parse(co) > Date.parse(ci) ? { ...p, clockIn: ci, clockOut: co } : p;
  });
}

/** Highest matching custom band for a moment (null if none match). */
function bandHit(dt: Date, bands: Band[]): { pct: number; index: number } | null {
  const mins = dt.getHours() * 60 + dt.getMinutes();
  const wd = dt.getDay();
  let best: { pct: number; index: number } | null = null;
  for (let index = 0; index < bands.length; index++) {
    const b = bands[index];
    if (!b.days?.includes(wd)) continue;
    const [fh, fm] = b.from.split(":").map(Number);
    const [th, tm] = b.to.split(":").map(Number);
    const from = fh * 60 + (fm || 0);
    const to = th * 60 + (tm || 0);
    const inRange = from <= to ? mins >= from && mins < to : mins >= from || mins < to; // wrap past midnight
    if (inRange && b.pct > (best?.pct ?? 0)) best = { pct: b.pct, index };
  }
  return best;
}

/** Payroll line from punches with per-shift premiums applied (evening/weekend/
 * night/holiday) + weekly overtime. Monthly staff keep their salary. */
export function computeFromPunches(e: EmpPick, punches: { clockIn: string; clockOut: string }[], rules: CustomRules, uppbot = 0, year?: number): PayLine {
  const y = year ?? (punches[0] ? new Date(punches[0].clockIn).getFullYear() : new Date().getFullYear());
  if (e.payType === "monthly") {
    return finalize(e, Math.round(MONTHLY_HOURS * (e.employmentRatio / 100)), e.rate, uppbot, { dayPay: e.rate, premiums: 0, overtime: 0 }, y);
  }
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  let hours = 0, gross = 0, monthAcc = 0, base = 0, premExtra = 0, otExtra = 0;
  const weekHrs = new Map<string, number>();
  const sorted = applyGrace(punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn)), rules);
  for (const p of sorted) {
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      // síðasti bútur stimplunar er nákvæmur — ekki námundað upp í heilt korter
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const prem = premiumAt(dt, rules).pct;
      let pct = prem;
      const ot = otAt(rules, dt, acc, monthAcc, otWeekly, otMonthly);
      const isOt = ot.active && ot.pct > prem;
      if (ot.active) pct = Math.max(pct, ot.pct); // yfirvinna (viku/mánuði, yfirvinna 1/2)
      gross += e.rate * s * (1 + pct / 100);
      base += e.rate * s;
      if (isOt) otExtra += e.rate * s * (pct / 100); else premExtra += e.rate * s * (pct / 100);
      hours += s;
      monthAcc += s;
      weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  return finalize(e, Math.round(hours * 10) / 10, Math.round(gross), uppbot, { dayPay: base, premiums: premExtra, overtime: otExtra }, y);
}

/** Operational classification of worked hours + their extra cost (from punches)
 * by the employee's rule set — for the dashboard. hours: total/overtime/premium
 * where overtime = hours beyond the weekly/monthly threshold (correctly, NOT just
 * actual−planned) and premium = hours in a premium window. overtimePay/premiumPay
 * = the EXTRA kr (above base, incl. employer burden) those hours cost — hourly
 * staff only (monthly salary isn't hour-priced). */
export function classifyPay(rate: number, hourly: boolean, punches: { clockIn: string; clockOut: string }[], rules: CustomRules): { total: number; overtime: number; premium: number; overtimePay: number; premiumPay: number } {
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  let total = 0, overtime = 0, premium = 0, overtimePay = 0, premiumPay = 0, monthAcc = 0;
  const weekHrs = new Map<string, number>();
  const sorted = applyGrace(punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn)), rules);
  for (const p of sorted) {
    if (!p.clockOut) continue;
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      // síðasti bútur stimplunar er nákvæmur — ekki námundað upp í heilt korter
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const prem = premiumAt(dt, rules).pct;
      const ot = otAt(rules, dt, acc, monthAcc, otWeekly, otMonthly), otActive = ot.active, otPct = ot.pct;
      if (prem > 0) premium += s;
      if (otActive) overtime += s;
      if (hourly) {
        const effPct = otActive ? Math.max(prem, otPct) : prem; // engine pays the higher
        const extra = rate * s * (effPct / 100) * (1 + BURDEN);
        if (otActive && otPct >= prem) overtimePay += extra; else premiumPay += extra;
      }
      total += s; monthAcc += s; weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  const r1 = (n: number) => Math.round(n * 10) / 10;
  return { total: r1(total), overtime: r1(overtime), premium: r1(premium), overtimePay: Math.round(overtimePay), premiumPay: Math.round(premiumPay) };
}

/** Tímar flokkaðir eins og launakerfi (Payday) vill þá: dagvinna = allir tímar utan yfirvinnu,
 * álag[pct] = þeir dagvinnutímar sem bera vaktaálag (greitt OFAN Á dagvinnu, pct % af taxta),
 * yfirvinna = tímar yfir viku-/mánaðarmörkum. Sama regla og computeFromPunches, svo
 * dagvinna×taxti + Σ álag×pct×taxti + yfirvinna×taxti×(1+yfirv.%) = brúttó. */
/** Tímar flokkaðir fyrir launakerfi. `parts` = álagstímar eftir launaþætti (eve/night/weekend/holiday/b<i>)
 *  með prósentu — sama summa og `alag`; notað til að gefa hverjum þætti sinn launalykil (pay-keys.ts). */
export type Buckets = { dagvinna: number; yfirvinna: number; alag: Record<number, number>; parts?: Record<string, { pct: number; hours: number }>;
  /** Yfirvinna 1 (lægra yfirvinnuþrep, t.d. Matvís/RSÍ/Samiðn) — aðeins ef reglan hefur ot1. */
  yfirvinna1?: number };

export function hourBuckets(punches: { clockIn: string; clockOut: string }[], rules: CustomRules): Buckets {
  const otWeekly = rules.otWeekly && rules.otWeekly > 0 ? rules.otWeekly : OT_WEEKLY;
  const otMonthly = rules.otMonthly && rules.otMonthly > 0 ? rules.otMonthly : Infinity;
  let dagvinna = 0, yfirvinna = 0, yfirvinna1 = 0, monthAcc = 0;
  const alag: Record<number, number> = {};
  const parts: Record<string, { pct: number; hours: number }> = {};
  const weekHrs = new Map<string, number>();
  const sorted = applyGrace(punches.slice().sort((a, b) => a.clockIn.localeCompare(b.clockIn)), rules);
  for (const p of sorted) {
    if (!p.clockOut) continue;
    const end = new Date(p.clockOut).getTime();
    let t = new Date(p.clockIn).getTime();
    while (t < end) {
      const s = Math.min(STEP, (end - t) / 3600000);
      const dt = new Date(t);
      const wk = mondayKey(dt);
      const acc = weekHrs.get(wk) ?? 0;
      const pa = premiumAt(dt, rules), prem = pa.pct;
      const ot = otAt(rules, dt, acc, monthAcc, otWeekly, otMonthly);
      if (ot.active && ot.pct >= prem) { if (ot.tier === 1) yfirvinna1 += s; else yfirvinna += s; }
      else { dagvinna += s; if (prem > 0) { alag[prem] = (alag[prem] ?? 0) + s; addPart(parts, pa.comp, prem, s); } }
      monthAcc += s; weekHrs.set(wk, acc + s);
      t += s * 3600000;
    }
  }
  const r2 = (n: number) => Math.round(n * 100) / 100;
  for (const k of Object.keys(alag)) alag[Number(k)] = r2(alag[Number(k)]);
  for (const k of Object.keys(parts)) parts[k].hours = r2(parts[k].hours);
  return { dagvinna: r2(dagvinna), yfirvinna: r2(yfirvinna), alag, parts, ...(yfirvinna1 > 0 ? { yfirvinna1: r2(yfirvinna1) } : {}) };
}
function addPart(parts: Record<string, { pct: number; hours: number }>, comp: string, pct: number, h: number) {
  const k = `${comp}@${pct}`;
  const cur = parts[k] ?? (parts[k] = { pct, hours: 0 });
  cur.hours += h;
}

export type PayrollTotals = { hours: number; gross: number; withholding: number; pension: number; union: number; net: number; cost: number; insurance: number; employerPension: number; funds: number };

export function totals(lines: PayLine[]): PayrollTotals {
  return lines.reduce<PayrollTotals>(
    (a, l) => ({
      hours: a.hours + l.hours, gross: a.gross + l.gross, withholding: a.withholding + l.withholding,
      pension: a.pension + l.pension + l.extraPension, union: a.union + l.union, net: a.net + l.net, cost: a.cost + l.cost,
      insurance: a.insurance + l.insurance, employerPension: a.employerPension + l.employerPension, funds: a.funds + l.funds,
    }),
    { hours: 0, gross: 0, withholding: 0, pension: 0, union: 0, net: 0, cost: 0, insurance: 0, employerPension: 0, funds: 0 },
  );
}

/** Re-derive a line after a pre-tax gross adjustment (e.g. time-bank
 * settlement at BASE rate — premiums/overtime pay stay untouched). */
export function applyGrossAdjustment(l: PayLine, adj: number, e: EmpPick, year = new Date().getFullYear()): PayLine {
  const gross = Math.max(0, l.gross - Math.round(adj));
  return deductions(e, { ...l, gross }, year);
}

