// Leiðir VAKTO (okt. 2026): Frítt / Grunnur / Vöxtur / Rekstur.
// EINI staðurinn sem tölur leiðanna eru skilgreindar — verðsíðan (/verd), forsíðan, spjallgaurinn
// og reikningagerðin lesa allar héðan. Engin import: má nota jafnt í server- og client-kóða.
// Öll verð í kr á mánuði, án VSK.
//
// „Virkur starfsmaður“ = var á vakt eða stimplaði sig inn í mánuðinum.
// Frítt: allt að 5 starfsmenn, 1 staður, aðeins á vefnum. Ekki hægt að bæta við starfsmönnum
// (extraPerEmployee = null) og engin VAKTO AI.

export type PlanId = "free" | "grunnur" | "voxtur" | "rekstur";

export type Plan = {
  id: PlanId;
  /** Heiti leiðarinnar (íslenska, eins og á verðsíðunni). */
  name: string;
  /** Grunnverð á mánuði. */
  base: number;
  /** Virkir starfsmenn innifaldir í grunnverði (Frítt: hámark). */
  included: number;
  /** Verð á hvern virkan starfsmann umfram `included`; null = ekki hægt að bæta við (Frítt). */
  extraPerEmployee: number | null;
  /** VAKTO AI-spurningar á mánuði innifaldar. */
  aiQuestions: number;
};

export const PLANS: readonly Plan[] = [
  { id: "free", name: "Frítt", base: 0, included: 5, extraPerEmployee: null, aiQuestions: 0 },
  { id: "grunnur", name: "Grunnur", base: 9990, included: 8, extraPerEmployee: 1190, aiQuestions: 25 },
  { id: "voxtur", name: "Vöxtur", base: 24990, included: 25, extraPerEmployee: 990, aiQuestions: 100 },
  { id: "rekstur", name: "Rekstur", base: 54990, included: 60, extraPerEmployee: 790, aiQuestions: 300 },
];

/** Viðbót við VAKTO AI: 1.490 kr fyrir hverjar 50 spurningar umfram (aðeins ef stjórnandi kveikir, með hámarki). */
export const AI_PACK = { price: 1490, questions: 50 } as const;
/** Undirskrift með rafrænum skilríkjum, á hverja undirskrift. Undirritun með kóða í tölvupósti er alltaf innifalin. */
export const ESIGN_PRICE = 490;
/** Afsláttur af grunnverði og verði á starfsmann þegar greitt er árlega. */
export const ANNUAL_DISCOUNT = 0.15;
/** Lengd fríu prufunnar (á Vexti). */
export const TRIAL_DAYS = 14;
/** Yfir þessum fjölda virkra starfsmanna gerum við tilboð. */
export const QUOTE_ABOVE_EMPLOYEES = 150;

export function getPlan(id: PlanId): Plan {
  return PLANS.find((p) => p.id === id)!;
}

/** Mánaðarverð þegar greitt er árlega (námundað að 10 kr), t.d. 9.990 → 8.490. */
export function annualMonthly(n: number): number {
  return Math.round((n * (1 - ANNUAL_DISCOUNT)) / 10) * 10;
}

export type PlanCost = {
  plan: Plan;
  /** Virkir starfsmenn umfram innifalda. */
  extraEmployees: number;
  /** Fjöldi AI-viðbóta (50 spurningar hver). */
  aiPacks: number;
  base: number;
  extra: number;
  ai: number;
  total: number;
};

/** Kostnaður leiðar á mánuði fyrir `employees` virka starfsmenn og `aiQuestions` spurningar.
 *  null ef leiðin getur ekki borið notkunina (Frítt: >5 starfsmenn eða einhverjar AI-spurningar). */
export function planCost(plan: Plan, employees: number, aiQuestions = 0, yearly = false): PlanCost | null {
  if (plan.extraPerEmployee === null && (employees > plan.included || aiQuestions > plan.aiQuestions)) return null;
  const price = (n: number) => (yearly ? annualMonthly(n) : n);
  const extraEmployees = Math.max(0, employees - plan.included);
  const aiPacks = Math.max(0, Math.ceil((aiQuestions - plan.aiQuestions) / AI_PACK.questions));
  const base = price(plan.base);
  const extra = extraEmployees * price(plan.extraPerEmployee ?? 0);
  const ai = aiPacks * AI_PACK.price;
  return { plan, extraEmployees, aiPacks, base, extra, ai, total: base + extra + ai };
}

/** Ódýrasta leiðin fyrir tiltekna notkun (við jafnt verð vinnur stærri leiðin). */
export function cheapestPlan(employees: number, aiQuestions = 0, yearly = false): PlanCost {
  let best: PlanCost | null = null;
  for (const p of PLANS) {
    const c = planCost(p, employees, aiQuestions, yearly);
    if (c && (!best || c.total <= best.total)) best = c;
  }
  return best!;
}
