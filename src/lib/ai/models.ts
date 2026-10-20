// Claude-líkön VAKTO á einum stað. Breyta hér, ekki í köllunum.
//   chat     — VAKTO AI aðstoðarmaðurinn (og heimasíðuspjallið)
//   plan     — AI-vaktaplan
//   analysis — kjarasamningar, ráðningarákvæði, AI-skýrslur, reglutillögur
// Opna demo-ið (og nafnlaus umferð á heimasíðu) fær ódýrari líkön.

export const MODEL_OPUS = "claude-opus-5-5";
export const MODEL_SONNET = "claude-sonnet-5-5";
export const MODEL_HAIKU = "claude-haiku-5-5";

/** Heimasíðuspjallið: nafnlausir gestir → Haiku. */
export const HOME_CHAT_MODEL = MODEL_HAIKU;

export type AiTask = "chat" | "plan" | "analysis";

export function modelFor(task: AiTask, opts: { demo?: boolean } = {}): string {
  if (task === "chat") return opts.demo ? MODEL_HAIKU : MODEL_SONNET;
  return opts.demo ? MODEL_SONNET : MODEL_OPUS;
}

/**
 * Effort þegar VAKTO AI setur upp vaktaplan fyrir viku (Sonnet 5.5 er sjálfgefið á „high“).
 * Mælt á staging (scripts/ai-plan-bench.mjs): „medium“ stenst sömu skilyrði og „high“ en er mun fljótara.
 */
export const PLAN_CHAT_EFFORT = "medium" as const;

/**
 * Effort fyrir „Biðja AI“ á Vaktaplani (Opus 5.5, sjálfgefið „medium“). „low“ stóðst öll skilyrði í mælingum
 * (scripts/ai-plan-bench.mjs, BENCH_ROUTE=schedule) og styttir hugsunina um 4–6 sek.
 */
export const SCHEDULE_EFFORT = "low" as const;
