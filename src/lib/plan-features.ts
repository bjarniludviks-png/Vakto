// Hvað fylgir hverri áskriftarleið (0089). Sama tafla og public.plan_allows() í grunninum —
// breyta á báðum stöðum. Öruggt í Client Components (engin server-köll).
import { getPlan, type PlanId } from "@/lib/plans";

export const PLAN_RANK: Record<PlanId, number> = { free: 0, grunnur: 1, voxtur: 2, rekstur: 3 };
export const PLAN_IDS = Object.keys(PLAN_RANK) as PlanId[];

export type Feature =
  | "app"            // starfsmannaappið (innskráning í síma)
  | "clock"          // stimpilklukka, kiosk
  | "chat"           // spjall
  | "requests"       // frí-beiðnir, vaktaskipti, óframboð, umsóknir um lausar vaktir
  | "payroll"        // launakeyrslur
  | "contracts"      // ráðningarsamningar og undirritanir
  | "ai"             // VAKTO AI (spurningar, skýrslur, greining)
  | "ai_schedule"    // AI-vaktaplan
  | "alerts"         // vaktarar og skýrslur á tímaáætlun (líka mánaðarskýrslan í pósti)
  | "work_overview"  // vinnuyfirlit til staðfestingar
  | "terminations"   // starfslok
  | "multi_location"; // fleiri en einn staður

/** Lægsta leið sem inniheldur eiginleikann. */
export const FEATURE_MIN: Record<Feature, PlanId> = {
  app: "grunnur", clock: "grunnur", chat: "grunnur", requests: "grunnur", payroll: "grunnur", contracts: "grunnur", ai: "grunnur",
  ai_schedule: "voxtur", alerts: "voxtur", work_overview: "voxtur", terminations: "voxtur", multi_location: "voxtur",
};

/** Hámarksfjöldi starfsmanna (ekki óvirkra) og staða per leið; null = ótakmarkað. */
export const PLAN_LIMITS: Record<PlanId, { employees: number | null; locations: number | null }> = {
  free: { employees: 5, locations: 1 }, grunnur: { employees: null, locations: 1 }, voxtur: { employees: null, locations: null }, rekstur: { employees: null, locations: null },
};

export const asPlan = (p: unknown): PlanId => (typeof p === "string" && p in PLAN_RANK ? (p as PlanId) : "voxtur");
export const planAllows = (plan: PlanId, f: Feature) => PLAN_RANK[plan] >= PLAN_RANK[FEATURE_MIN[f]];

// Þágufall leiðanna: „Í boði í Grunni“.
const DAT: Record<PlanId, string> = { free: "Fríu leiðinni", grunnur: "Grunni", voxtur: "Vexti", rekstur: "Rekstri" };
export const planName = (p: PlanId) => getPlan(p).name;

/** „Í boði í Grunni — sjá verð“ (hlekkurinn á /verd bætist við í viðmótinu). */
export const upgradeLabel = (f: Feature) => `Í boði í ${DAT[FEATURE_MIN[f]]}`;
/** Villuboð frá þjóninum þegar eiginleiki er utan leiðarinnar. */
export const upgradeError = (f: Feature) => `${upgradeLabel(f)} og ofar — sjá verð á vakto.is/verd. Stjórnandi breytir leiðinni í Stillingum → Áskrift.`;

export const FEATURE_IS: Record<Feature, string> = {
  app: "VAKTO-appið fyrir starfsfólk", clock: "Stimpilklukka og kiosk", chat: "Spjall", requests: "Beiðnir starfsfólks",
  payroll: "Launakeyrslur", contracts: "Ráðningarsamningar", ai: "VAKTO AI", ai_schedule: "AI-vaktaplan",
  alerts: "Vaktarar og skýrslur á tímaáætlun", work_overview: "Vinnuyfirlit", terminations: "Starfslok", multi_location: "Fleiri staðir",
};

export const APP_BLOCKED_EMPLOYEE = "Vinnuveitandinn þinn notar ekki VAKTO-appið. Hafðu samband við hann.";
export const APP_BLOCKED_MANAGER = "Fyrirtækið er á fríu leiðinni, sem inniheldur ekki VAKTO-appið. Skráðu þig inn á vakto.is til að halda áfram eða breyta um leið (Stillingar → Áskrift).";
