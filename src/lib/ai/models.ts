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
