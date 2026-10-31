import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { rateLimited } from "@/lib/ai/assistant-auth";
import { aiAllowance } from "@/lib/ai/ai-plan.server";
import { companyPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { MODEL_HAIKU } from "@/lib/ai/models";
import { recordAiUsage, addUsage, type AiUsage } from "@/lib/ai/usage.server";
import { employeeCtx, EMPLOYEE_TOOLS, EMPLOYEE_WRITE, runEmployeeRead, describeEmployeeWrite } from "@/lib/ai/employee-ai.server";

// VAKTO AI fyrir starfsfólk (appið, Bearer um /api/app/employee-ai): eigin vaktir og tímar, hver getur
// tekið vakt, og tillaga að vaktaskiptum sem starfsmaðurinn staðfestir. Haiku; telst ekki til AI-spurninga
// fyrirtækisins en virðir kostnaðarþakið.
export const maxDuration = 60;
const DAYS_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki uppsett" }, { status: 503 });
  const supabase = await createClient();
  const me = await employeeCtx(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(`emp:${me.userId}`, 20)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });
  const co = await companyPlan(me.companyId).catch(() => null);
  if (co && !planAllows(co.features, "ai")) return NextResponse.json({ ok: false, error: "VAKTO AI er ekki hluti af áskrift fyrirtækisins." }, { status: 402 });
  const a = await aiAllowance(me.companyId).catch(() => null);
  if (a && a.costIsk > a.costCapIsk) return NextResponse.json({ ok: false, error: "VAKTO AI er í hléi út mánuðinn." }, { status: 402 });

  let body: { messages?: { role: string; content: string }[]; lang?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const lang = ["en", "vi", "pl"].includes(body.lang ?? "") ? body.lang! : "is";
  const msgs: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-12).map((m) => ({ role: m.role as "user" | "assistant", content: m.content.slice(0, 2000) }));
  while (msgs.length && msgs[0].role !== "user") msgs.shift();
  if (!msgs.length) return NextResponse.json({ ok: false, error: "Engin spurning" }, { status: 400 });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const langName = lang === "en" ? "ensku" : lang === "vi" ? "víetnömsku" : lang === "pl" ? "pólsku" : "íslensku";
  const system = `Þú ert VAKTO AI, aðstoðarmaður starfsmanns í vaktakerfinu VAKTO. Notandi: ${me.name}${me.dept ? ` (${me.dept})` : ""}. Í dag er ${DAYS_IS[now.getDay()]} ${today}.
Þú hjálpar með: hvenær hann er á vakt (my_shifts), hvað hann hefur unnið marga tíma (my_hours) og hver getur tekið vakt hans (my_shifts → who_can_cover). Ef hann vill skipta, leggðu til request_swap (vaktstjóri samþykkir; ekkert er sent fyrr en hann ýtir á „Staðfesta“ — segðu aldrei að beiðnin sé send).
Þú sérð ALDREI laun, kennitölur eða ástæður annarra (frí, veikindi) — who_can_cover segir bara hverjir eru lausir. Ekki giska á tölur: notaðu verkfærin. Breyttu afstæðum dagsetningum („á laugardaginn“) í nákvæma dagsetningu. Fyrir annað (frí, laun, samning) vísaðu á skjáina í appinu: Beiðnir, Laun, Samningur. Stutt og vingjarnlegt, engin emoji. Svaraðu á ${langName} nema notandinn skrifi greinilega á öðru máli.`;

  const client = new Anthropic();
  let usage: AiUsage = {};
  const actions: { tool: string; input: Record<string, unknown>; summary: string }[] = [];
  let reply = "";
  try {
    for (let step = 0; step < 6; step++) {
      const res = await client.messages.create({ model: MODEL_HAIKU, max_tokens: 1200, system, tools: EMPLOYEE_TOOLS, messages: msgs });
      usage = addUsage(usage, res.usage);
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("").trim();
      const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
      if (!uses.length) { reply = text; break; }
      msgs.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const u of uses) {
        const input = (u.input ?? {}) as Record<string, unknown>;
        if (EMPLOYEE_WRITE.has(u.name)) {
          const d = await describeEmployeeWrite(u.name, input, me);
          if (d.ok) actions.push({ tool: u.name, input, summary: d.summary });
          results.push({ type: "tool_result", tool_use_id: u.id, content: d.ok ? "Tillaga skráð — bíður staðfestingar notandans." : d.error, is_error: !d.ok });
        } else {
          results.push({ type: "tool_result", tool_use_id: u.id, content: await runEmployeeRead(u.name, input, me) });
        }
      }
      msgs.push({ role: "user", content: results });
      reply = text;
    }
  } catch (e) {
    console.error("[employee-ai]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: "VAKTO AI svaraði ekki — reyndu aftur." }, { status: 502 });
  } finally {
    await recordAiUsage({ model: MODEL_HAIKU, usage, feature: "employee_ai", companyId: me.companyId, userId: me.userId });
  }
  return NextResponse.json({ ok: true, reply, actions });
}
