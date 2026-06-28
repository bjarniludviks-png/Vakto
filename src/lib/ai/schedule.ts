import "server-only";
import Anthropic from "@anthropic-ai/sdk";

export type AiItem = { kind: "good" | "info" | "warn" | "bad"; title: string; detail: string; tag: string };
export type AiProposal = { summary: string; items: AiItem[]; laborPct: string; live: boolean };

const SCHEMA = {
  type: "object",
  properties: {
    summary: { type: "string", description: "Stutt samantekt á tillögunni á íslensku" },
    items: {
      type: "array",
      items: {
        type: "object",
        properties: {
          kind: { type: "string", enum: ["good", "info", "warn", "bad"] },
          title: { type: "string" },
          detail: { type: "string" },
          tag: { type: "string", description: "Stutt merki, t.d. +128 klst eða 31,8%" },
        },
        required: ["kind", "title", "detail", "tag"],
        additionalProperties: false,
      },
    },
    laborPct: { type: "string", description: "Áætlað laun% eftir breytingu, t.d. 31,8%" },
  },
  required: ["summary", "items", "laborPct"],
  additionalProperties: false,
} as const;

const SYSTEM = `Þú ert AI-vaktaplanari VAKTO fyrir íslensk fyrirtæki. Notandinn lýsir markmiði á íslensku
og þú leggur til breytingar á vaktaplani vikunnar. Reglur sem ber að virða:
- 11 klst lágmarks hvíldartími milli vakta.
- Yfirvinna er > 43 klst/viku — merktu hana.
- Aðeins hæsta álag gildir hverju sinni (ekki stafla): +33% morgun/kvöld, +45% helgi, +90% yfirvinna.
- Markmið er laun% af veltu ≤ 30% (grænt), ≤ 33% (gult), annars rautt.
- Þú breytir ekki sjálfvirkt — notandi samþykkir. Skilaðu tillögu sem lista yfir breytingar.
Svaraðu á íslensku. Gefðu 3–5 atriði (items) sem lýsa breytingunum, hvíldartíma/yfirvinnu-athugun og
áhrifum á laun%. Notaðu kind='good' fyrir jákvætt, 'warn' fyrir aðvörun, 'info' fyrir hlutlaust.`;

const DEMO: AiProposal = {
  summary: "VAKTO bjó til eftirfarandi tillögu:",
  laborPct: "31,8%",
  live: false,
  items: [
    { kind: "good", title: "14 vaktir búnar til", detail: "Ómar · 2-2-3 mynstur · 11:00–22:00 · maí 2026", tag: "+128 klst" },
    { kind: "info", title: "Hvíldartími virtur", detail: "11 klst milli vakta — engin brot", tag: "ok" },
    { kind: "warn", title: "Yfirvinna", detail: "4 klst yfir starfshlutfalli — staðfestu eða dreifðu", tag: "+9.800 kr" },
    { kind: "info", title: "Laun af tekjum", detail: "helst í 31,8% — undir 33% viðmiði", tag: "31,8%" },
  ],
};

export function isAiConfigured() {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function getAiScheduleProposal(prompt: string, context: string): Promise<AiProposal> {
  if (!isAiConfigured()) return { ...DEMO, summary: prompt ? `„${prompt}" — ${DEMO.summary}` : DEMO.summary };

  const client = new Anthropic();
  const response = await client.messages.create({
    model: "claude-opus-4-8",
    max_tokens: 4096,
    thinking: { type: "adaptive" },
    output_config: { effort: "medium", format: { type: "json_schema", schema: SCHEMA } },
    system: SYSTEM,
    messages: [
      {
        role: "user",
        content: `Núverandi staða vaktaplans (þessi vika):\n${context}\n\nBeiðni notanda:\n${prompt || "Bestun vaktaplans"}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    throw new Error("AI hafnaði beiðninni");
  }
  const text = response.content.find((b) => b.type === "text");
  if (!text || text.type !== "text") throw new Error("Ekkert svar frá AI");
  const parsed = JSON.parse(text.text) as Omit<AiProposal, "live">;
  return { ...parsed, live: true };
}
