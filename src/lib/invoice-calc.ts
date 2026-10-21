// Reikningsupphæðir eftir áskriftarleiðum (0089). Hrein föll — sömu tölur og /verd (src/lib/plans.ts).
//
//   mánaðarlegt:  grunnverð leiðar (fyrirfram) + virkir umfram innifalda × verð á starfsmann (eftir á)
//   árlegt:       12 × annualMonthly(grunnverð) fyrirfram + umfram á annualMonthly-verði mánaðarlega.
//                 Skipt upp um leið innan greidds árs → mismunur grunnverðs (árlegt) á hverjum mánaðarreikningi.
//   + AI-pakkar mánaðarins sem lauk × 1.490 kr + undirskriftir × 490 kr (enginn árlegur afsláttur af þeim)
//   Eldra verð (legacy_price_until ≥ dagsetning reiknings): min(gamla reikniregla, nýja) fyrir grunn + umfram.
import { AI_PACK, ESIGN_PRICE, annualMonthly, getPlan, type PlanId } from "@/lib/plans";
import { invoiceFor, VAT_RATE, type PlanId as LegacyPlanId } from "@/lib/pricing";

export type BaseMode = "month" | "year" | "none";
export type PlanInvoice = {
  base: number; extra: number; extraCount: number; included: number; esign: number; esignCount: number;
  ai: number; aiPacks: number; vat: number; total: number; legacy: boolean;
};

export function planInvoice(o: {
  plan: PlanId; active: number; esigns?: number; aiPacks?: number; base?: BaseMode; yearly?: boolean;
  /** Leiðin sem greidda árið var keypt fyrir (base "none"). */
  yearPlan?: PlanId | null;
  /** Eldra verð: verðskrá v1/v2 og einingar hennar (v1 = notendur, v2 = virkir). */
  legacy?: { plan: LegacyPlanId; units: number } | null;
}): PlanInvoice {
  const p = getPlan(o.plan), mode = o.base ?? "month", yearly = o.yearly ?? mode !== "month";
  const price = (n: number) => (yearly ? annualMonthly(n) : n);
  let base = mode === "year" ? 12 * annualMonthly(p.base)
    : mode === "none" ? Math.max(0, annualMonthly(p.base) - annualMonthly(getPlan(o.yearPlan ?? o.plan).base))
    : p.base;
  let extraCount = Math.max(0, o.active - p.included), included = p.included;
  let extra = p.extraPerEmployee === null ? 0 : extraCount * price(p.extraPerEmployee);
  let legacy = false;
  if (o.legacy) {
    const old = invoiceFor(o.legacy.plan, o.legacy.units, 0, { base: mode, yearly });
    if (old.base + old.extra < base + extra) { base = old.base; extra = old.extra; extraCount = old.extraCount; included = 5; legacy = true; }
  }
  const esignCount = o.esigns ?? 0, esign = esignCount * ESIGN_PRICE;
  const aiPacks = o.aiPacks ?? 0, ai = aiPacks * AI_PACK.price;
  const net = base + extra + esign + ai, vat = Math.round(net * VAT_RATE);
  return { base, extra, extraCount, included, esign, esignCount, ai, aiPacks, vat, total: net + vat, legacy };
}
