"use server";

// ============================================================
// AI report assistant — ask questions about your own data in plain
// language, get a summary + table + chart for the selected period.
// Requires ANTHROPIC_API_KEY (the card is only rendered when it is set);
// without it the action returns an honest error, never a canned answer.
// ============================================================

import { getManagerReport } from "./actions";
import { getDashboardPeriod } from "../maelabord/actions";
import { getPerfHistory } from "../frammistada/perf.server";

export type AiChart = { labels: string[]; values: number[]; label: string };
export type AiReportResult = {
  ok: boolean;
  title: string;
  summary: string;
  columns?: string[];
  numeric?: number[];
  rows?: (string | number)[][];
  chart?: AiChart;
  error?: string;
};

/** Compact data bundle for the period — exactly what the three library
 * reports are built from (profitability, labor cost, attendance). */
async function gatherContext(fromISO: string, toISO: string) {
  const [pd, cost, attendance, history] = await Promise.all([
    getDashboardPeriod(fromISO, toISO),
    getManagerReport("cost", fromISO, toISO),
    getManagerReport("attendance", fromISO, toISO),
    getPerfHistory(6),
  ]);
  return { pd, cost, attendance, history };
}

export async function aiReportQuery(question: string, fromISO: string, toISO: string): Promise<AiReportResult> {
  if (!process.env.ANTHROPIC_API_KEY) return { ok: false, title: "", summary: "", error: "AI-greining er ekki virk." };
  try {
    const ctx = await gatherContext(fromISO, toISO);
    const compact = {
      period: { from: fromISO, to: toISO },
      totals: ctx.pd.ok ? {
        plannedHours: ctx.pd.planned, actualHours: ctx.pd.actual, overtimeHours: ctx.pd.overtime,
        totalCost: ctx.pd.cost, levies: ctx.pd.levies, revenue: ctx.pd.revenue, laborPct: ctx.pd.laborPct,
      } : null,
      costPerEmployee: ctx.cost.rows,
      attendance: ctx.attendance.rows,
      monthlyHistory: ctx.history.months,
    };

    const { default: Anthropic } = await import("@anthropic-ai/sdk");
    const client = new Anthropic();
    const msg = await client.messages.create({
      model: "claude-opus-4-8",
      max_tokens: 3000,
      thinking: { type: "adaptive" },
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              title: { type: "string", description: "Stuttur titill skýrslunnar á íslensku" },
              summary: { type: "string", description: "Greining á mannamáli, 2-4 setningar, með raunverulegum tölum" },
              columns: { type: "array", items: { type: "string" } },
              numeric: { type: "array", items: { type: "number" }, description: "Vísar dálka sem eru tölur (hægri-jafnaðir)" },
              rows: { type: "array", items: { type: "array", items: { type: ["string", "number"] } } },
              chart: {
                type: "object",
                properties: {
                  labels: { type: "array", items: { type: "string" } },
                  values: { type: "array", items: { type: "number" } },
                  label: { type: "string" },
                },
              },
            },
            required: ["title", "summary", "columns", "numeric", "rows"],
          },
        },
      },
      messages: [{
        role: "user",
        content: `Þú ert greiningaraðstoð VAKTO (vaktakerfi). Notandinn spyr um SÍN gögn — svaraðu með nákvæmum tölum úr gögnunum, aldrei giska. Íslenskt talnasnið (punktur í þúsundum, komma í brotum). Ef spurningin biður um samanburð, reiknaðu hann. Skilaðu töflu sem svarar spurningunni og chart ef það á við.

GÖGN TÍMABILSINS:
${JSON.stringify(compact)}

SPURNING: ${question}`,
      }],
    });
    const block = msg.content.find((b) => b.type === "text");
    const parsed = block && "text" in block ? JSON.parse(block.text) : null;
    if (!parsed?.summary) return { ok: false, title: "", summary: "", error: "AI skilaði engu svari — reyndu aftur." };
    return { ok: true, ...parsed };
  } catch (e) {
    console.error("[skyrslur] aiReportQuery", e);
    return { ok: false, title: "", summary: "", error: "AI-greining tókst ekki — reyndu aftur síðar." };
  }
}
