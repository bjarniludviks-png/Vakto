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

// baseYear/extraYear = verð á mánuði þegar greitt er árlega (~15% afsláttur). Árgjald = 12 × baseYear, fyrirfram.
export const PLANS = {
  v1: { base: 5990, included: 5, extra: 590, baseYear: 5090, extraYear: 500, unit: "notanda" },
  v2: { base: 9990, included: 5, extra: 1490, baseYear: 8490, extraYear: 1270, unit: "virkan starfsmann" },
} as const;
export type BillingInterval = "month" | "year";
export type PlanId = keyof typeof PLANS;
export const CURRENT_PLAN: PlanId = "v2";

/** Hvaða verðskrá gildir fyrir fyrirtæki á tilteknum degi. */
export function planFor(co: { price_plan?: string | null; price_v1_until?: string | null }, on = new Date()): PlanId {
  if (co.price_plan === "v1" && (!co.price_v1_until || new Date(co.price_v1_until).getTime() > on.getTime())) return "v1";
  return "v2";
}

export type InvoiceAmounts = { base: number; extra: number; extraCount: number; esign: number; esignCount: number; vat: number; total: number };

/** `units` = virkir starfsmenn (v2) eða notendur (v1); `esigns` = fullgildar undirskriftir á uppgjörstímabilinu.
 *  `base`: "month" = mánaðargjald · "year" = árgjald (12 × baseYear) · "none" = grunngjald þegar greitt (árið).
 *  `yearly` = árleg kjör á umfram-einingar (extraYear). */
export function invoiceFor(plan: PlanId, units: number, esigns = 0, opts: { base?: "month" | "year" | "none"; yearly?: boolean } = {}): InvoiceAmounts {
  const p = PLANS[plan];
  const mode = opts.base ?? "month";
  const yearly = opts.yearly ?? mode === "year";
  const extraCount = Math.max(0, units - p.included);
  const base = mode === "year" ? 12 * p.baseYear : mode === "none" ? 0 : p.base;
  const extra = extraCount * (yearly ? p.extraYear : p.extra), esign = esigns * ESIGN_PRICE;
  const net = base + extra + esign;
  const vat = Math.round(net * VAT_RATE);
  return { base, extra, extraCount, esign, esignCount: esigns, vat, total: net + vat };
}

/** Hvernig grunngjald tímabils sem hefst `periodStart` er innheimt.
 *  Innan greidds árs [yearStart, +12 mán): árgjald í fyrsta mánuði, annars ekkert.
 *  Utan greidds árs: árlegt → nýtt ár hefst (startYear), annars mánaðargjald. */
export function baseModeFor(o: { interval: BillingInterval; yearStart: Date | null; periodStart: Date }): { mode: "month" | "year" | "none"; startYear: boolean } {
  const { yearStart, periodStart } = o;
  if (yearStart) {
    const end = new Date(yearStart); end.setUTCMonth(end.getUTCMonth() + 12);
    if (periodStart.getTime() >= yearStart.getTime() && periodStart.getTime() < end.getTime()) {
      return { mode: periodStart.toISOString().slice(0, 10) === yearStart.toISOString().slice(0, 10) ? "year" : "none", startYear: false };
    }
  }
  return o.interval === "year" ? { mode: "year", startYear: true } : { mode: "month", startYear: false };
}
