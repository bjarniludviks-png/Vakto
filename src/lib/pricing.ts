// Verðskrá VAKTO — EINI staðurinn sem verð eru skilgreind (reikningar, texti, /admin, spjallgaur).
// Öll verð í kr án VSK.
//
// v2 (30.9.2026): 9.990 kr/mán með 5 VIRKUM starfsmönnum + 1.490 kr á hvern virkan umfram.
//   „Virkur“ = átti vakt eða stimplaði sig á tímabilinu (billing_usage, 0063 — eyðing breytir engu).
//   Grunngjaldið er greitt fyrirfram; umfram-starfsmenn og undirritanir eru gerð upp eftir á
//   fyrir tímabilið sem lauk, á sama reikningi.
// v1 (eldri viðskiptavinir til price_v1_until): 5.990 kr/mán með 5 notendum + 590 kr á notanda umfram.
// Fullgild rafræn undirskrift (Taktikal): 490 kr á hverja undirskrift (samningur = 2 undirskriftir) — öll plön.

export const VAT_RATE = 0.24;
export const ESIGN_PRICE = 490;

export const PLANS = {
  v1: { base: 5990, included: 5, extra: 590, unit: "notanda" },
  v2: { base: 9990, included: 5, extra: 1490, unit: "virkan starfsmann" },
} as const;
export type PlanId = keyof typeof PLANS;
export const CURRENT_PLAN: PlanId = "v2";

/** Hvaða verðskrá gildir fyrir fyrirtæki á tilteknum degi. */
export function planFor(co: { price_plan?: string | null; price_v1_until?: string | null }, on = new Date()): PlanId {
  if (co.price_plan === "v1" && (!co.price_v1_until || new Date(co.price_v1_until).getTime() > on.getTime())) return "v1";
  return "v2";
}

export type InvoiceAmounts = { base: number; extra: number; extraCount: number; esign: number; esignCount: number; vat: number; total: number };

/** `units` = virkir starfsmenn (v2) eða notendur (v1); `esigns` = fullgildar undirskriftir á uppgjörstímabilinu. */
export function invoiceFor(plan: PlanId, units: number, esigns = 0): InvoiceAmounts {
  const p = PLANS[plan];
  const extraCount = Math.max(0, units - p.included);
  const base = p.base, extra = extraCount * p.extra, esign = esigns * ESIGN_PRICE;
  const net = base + extra + esign;
  const vat = Math.round(net * VAT_RATE);
  return { base, extra, extraCount, esign, esignCount: esigns, vat, total: net + vat };
}
