"use server";

// ============================================================
// AI report assistant — ask questions about your own data in plain
// language, get a summary + table + chart for the selected period.
// With ANTHROPIC_API_KEY: Claude analyses the real figures.
// Without: a deterministic intent-router answers from the same data,
// so the feature works today and upgrades itself when the key lands.
// ============================================================

import { getManagerReport, type ReportKind } from "./actions";
import { getDashboardPeriod } from "../maelabord/actions";
import { getPerfHistory } from "../frammistada/perf.server";
import { dec1, nf, krCompact } from "@/lib/format";

export type AiChart = { labels: string[]; values: number[]; label: string };
export type AiReportResult = {
  ok: boolean;
  live: boolean; // true = real AI, false = built-in analysis
  title: string;
  summary: string;
  columns?: string[];
  numeric?: number[];
  rows?: (string | number)[][];
  chart?: AiChart;
  error?: string;
};

/** Compact data bundle for the period — context for AI and the fallback. */
async function gatherContext(fromISO: string, toISO: string) {
  const [pd, cost, costDept, overtime, absence, attendance, history] = await Promise.all([
    getDashboardPeriod(fromISO, toISO),
    getManagerReport("cost", fromISO, toISO),
    getManagerReport("costDept", fromISO, toISO),
    getManagerReport("overtime", fromISO, toISO),
    getManagerReport("absence", fromISO, toISO),
    getManagerReport("attendance", fromISO, toISO),
    getPerfHistory(6),
  ]);
  return { pd, cost, costDept, overtime, absence, attendance, history };
}

const sum = (rows: (string | number)[][], col: number) => rows.reduce((a, r) => a + (Number(r[col]) || 0), 0);

/** Deterministic analysis when no API key: route by intent keywords. */
function fallbackAnswer(question: string, ctx: Awaited<ReturnType<typeof gatherContext>>): AiReportResult {
  const q = question.toLowerCase();
  const pick = (kind: ReportKind) =>
    ({ cost: ctx.cost, costDept: ctx.costDept, overtime: ctx.overtime, absence: ctx.absence, attendance: ctx.attendance, hours: ctx.cost, timebank: ctx.cost } as const)[kind];

  let kind: ReportKind = "cost";
  if (/yfirvinn|overtime/.test(q)) kind = "overtime";
  else if (/deild|department/.test(q)) kind = "costDept";
  else if (/fjarvist|veikind|orlof|absence|sick/.test(q)) kind = "absence";
  else if (/mæting|frávik|attendance|stimpl/.test(q)) kind = "attendance";

  const rep = pick(kind);
  const rows = rep.rows ?? [];
  let summary = "";
  let chart: AiChart | undefined;

  if (kind === "costDept" && rows.length) {
    const top = rows[0];
    summary = `${top[0]} ber mest — ${krCompact(Number(top[3]))} (${dec1(Number(top[4]))}% af heildinni). Heildarkostnaður tímabilsins: ${krCompact(sum(rows, 3))} á ${nf(sum(rows, 2))} klst.`;
    chart = { labels: rows.map((r) => String(r[0])), values: rows.map((r) => Number(r[3]) / 1000), label: "þ.kr. per deild" };
  } else if (kind === "overtime") {
    summary = rows.length
      ? `Yfirvinna hjá ${rows.length} starfsmönnum: ${dec1(sum(rows, 2))} klst (${krCompact(sum(rows, 3))}) og álagstímar ${dec1(sum(rows, 4))} klst (${krCompact(sum(rows, 5))}).`
      : "Engin yfirvinna á tímabilinu — vel gert.";
    if (rows.length) chart = { labels: rows.map((r) => String(r[0]).split(" ")[0]), values: rows.map((r) => Number(r[2])), label: "yfirvinnutímar" };
  } else if (kind === "absence") {
    summary = rows.length
      ? `${nf(sum(rows, 5))} fjarvistardagar á tímabilinu — þar af ${nf(sum(rows, 2))} veikindadagar og ${nf(sum(rows, 3))} orlofsdagar.`
      : "Engar skráðar fjarvistir á tímabilinu.";
  } else if (kind === "attendance") {
    const pl = sum(rows, 2), ac = sum(rows, 3);
    summary = `Áætlaðar ${dec1(pl)} klst vs ${dec1(ac)} unnar — frávik ${ac - pl >= 0 ? "+" : ""}${dec1(ac - pl)} klst${ctx.pd.ok && ctx.pd.deviationCost ? ` (${krCompact(ctx.pd.deviationCost)})` : ""}.`;
    chart = { labels: rows.map((r) => String(r[0]).split(" ")[0]), values: rows.map((r) => Number(r[3])), label: "unnar klst" };
  } else {
    const total = sum(rows, 7);
    summary = rows.length
      ? `Heildarlaunakostnaður tímabilsins: ${krCompact(total)} — þar af launatengd gjöld ${krCompact(sum(rows, 6))} og yfirvinna ${krCompact(sum(rows, 5))}. ${ctx.pd.ok && ctx.pd.laborPct ? `Laun% af veltu: ${dec1(ctx.pd.laborPct)}%.` : ""}`
      : "Engar tímafærslur á tímabilinu — kostnaður reiknast af stimplunum.";
    if (rows.length) chart = { labels: rows.map((r) => String(r[0]).split(" ")[0]), values: rows.map((r) => Number(r[7]) / 1000), label: "þ.kr. per starfsmann" };
  }

  return {
    ok: true, live: false,
    title: rep.title,
    summary: `${summary}\n\nInnbyggð greining — settu ANTHROPIC_API_KEY til að spyrja frjálst (samanburði, hlutföll, hvað sem er).`,
    columns: rep.columns, numeric: rep.numeric, rows,
    chart,
  };
}

export async function aiReportQuery(question: string, fromISO: string, toISO: string): Promise<AiReportResult> {
  try {
    const ctx = await gatherContext(fromISO, toISO);
    if (!process.env.ANTHROPIC_API_KEY) return fallbackAnswer(question, ctx);

    const compact = {
      period: { from: fromISO, to: toISO },
      totals: ctx.pd.ok ? {
        plannedHours: ctx.pd.planned, actualHours: ctx.pd.actual, overtimeHours: ctx.pd.overtime,
        totalCost: ctx.pd.cost, levies: ctx.pd.levies, revenue: ctx.pd.revenue, laborPct: ctx.pd.laborPct,
      } : null,
      costPerEmployee: ctx.cost.rows,
      costPerDepartment: ctx.costDept.rows,
      overtime: ctx.overtime.rows,
      absence: ctx.absence.rows,
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
    if (!parsed?.summary) return fallbackAnswer(question, ctx);
    return { ok: true, live: true, ...parsed };
  } catch (e) {
    return { ok: false, live: false, title: "Villa", summary: "", error: e instanceof Error ? e.message : "Villa" };
  }
}
