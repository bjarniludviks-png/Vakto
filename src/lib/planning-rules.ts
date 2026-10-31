// Planreglur fyrirtækisins (0101) — fastar reglur sem AI-vaktaplanið virðir alltaf.
// Hreint (engin þjónsköll) svo vafri og þjónn deili sama formi og texta.

export type PlanningRule = { id: string; text: string; active: boolean; createdAt: string; via: "user" | "ai" };

export const MAX_RULES = 40;
export const MAX_RULE_LEN = 300;

/** Les og hreinsar það sem stendur í companies.planning_rules (þolir gamalt/rangt form). */
export function normalizeRules(raw: unknown): PlanningRule[] {
  if (!Array.isArray(raw)) return [];
  const out: PlanningRule[] = [];
  for (const r of raw) {
    if (!r || typeof r !== "object") continue;
    const o = r as Record<string, unknown>;
    const text = typeof o.text === "string" ? o.text.trim().slice(0, MAX_RULE_LEN) : "";
    if (!text || typeof o.id !== "string") continue;
    out.push({ id: o.id, text, active: o.active !== false, createdAt: typeof o.createdAt === "string" ? o.createdAt : "", via: o.via === "ai" ? "ai" : "user" });
  }
  return out.slice(0, MAX_RULES);
}

/** Virkar reglur sem punktalisti fyrir líkanið (tómt ef engar). */
export function rulesForPrompt(rules: PlanningRule[]): string {
  const act = rules.filter((r) => r.active);
  if (!act.length) return "";
  return `Planreglur fyrirtækisins (vistaðar af stjórnanda — gilda í HVERJU plani eins og skilyrði notandans, nema beiðnin núna segi annað; ef regla gengur ekki upp, segðu hver og hvers vegna):\n${act.map((r) => `- ${r.text}`).join("\n")}`;
}
