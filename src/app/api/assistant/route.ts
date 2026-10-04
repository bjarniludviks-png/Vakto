import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { VAKTO_KNOWLEDGE } from "@/lib/ai/vakto-knowledge";
import { READ_TOOLS, WRITE_TOOLS, WRITE_NAMES, runReadTool, describeWrite, type PendingAction } from "@/lib/ai/assistant-tools";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";

// VAKTO AI — aðstoðarmaður í horninu (stjórnendur og vaktstjórar).
// Les gögn með verkfærum; breytingar verða að TILLÖGUM sem notandinn staðfestir með hnappi (sjá ./execute).
export const maxDuration = 60;
const MODEL = "claude-sonnet-5";
const MAX_STEPS = 8;
const DAYS_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki uppsett" }, { status: 503 });
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });

  let body: { messages?: Msg[]; path?: string; lang?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const lang = body.lang === "en" ? "en" : body.lang === "vi" ? "vi" : "is";
  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return NextResponse.json({ ok: false, error: "Engin spurning" }, { status: 400 });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const system = `Þú ert VAKTO AI, aðstoðarmaður inni í vaktakerfinu VAKTO.
Fyrirtæki: ${me.company}. Notandi: ${me.name} (${me.role === "owner" ? "stjórnandi" : "vaktstjóri"}). Í dag er ${DAYS_IS[now.getDay()]} ${today}. Notandinn er á síðunni ${body.path ?? "/"}.

Hlutverk þín:
1. Svara spurningum um reksturinn með tölum úr verkfærunum (laun % af veltu, velta, kostnaður, tímar, frávik, hver er á vakt, vaktaplan, beiðnir). Notaðu ALLTAF verkfæri fyrir tölur — aldrei giska eða búa til tölur.
2. Undirbúa breytingar: setja/breyta/eyða vakt, afgreiða frí-beiðnir og vaktaskipti, stimpla út. Skrifverkfærin framkvæma EKKERT — þau búa til tillögu sem notandinn staðfestir með „Staðfesta"-hnappi undir svarinu þínu. Segðu því aldrei að breyting sé búin; segðu að tillagan bíði staðfestingar. Skoðaðu fyrst stöðuna (t.d. shifts eða pending_requests) svo nöfn og id séu rétt.
3. Svara „hvernig geri ég…“ spurningum út frá upplýsingunum hér að neðan. Ef þú veist ekki svarið, vísaðu á hallo@vakto.is.

Reglur: stutt og skýrt, punktalistar frekar en töflur, engin emoji. Upphæðir eins og „12.345 kr.“ og prósentur með kommu („27,6 %“). Breyttu afstæðum dagsetningum („næsta föstudag“, „síðasta vika“) í nákvæma dagsetningu og nefndu hana. Vikan byrjar á mánudegi. Ef eitthvað er óljóst, spurðu einnar spurningar í einu. Laun % af veltu: lægra er betra, miðað við markmið fyrirtækisins.
Tungumál: svaraðu á ${lang === "en" ? "ensku" : lang === "vi" ? "víetnömsku" : "íslensku"} nema notandinn skrifi greinilega á öðru máli.

Um VAKTO:
${VAKTO_KNOWLEDGE}`;

  const client = new Anthropic();
  const tools = [...READ_TOOLS, ...WRITE_TOOLS];
  const actions: PendingAction[] = [];
  const msgs: Anthropic.MessageParam[] = [...history];
  let reply = "";
  try {
    for (let step = 0; step < MAX_STEPS; step++) {
      const res = await client.messages.create({ model: MODEL, max_tokens: 1500, system, tools, messages: msgs });
      const text = res.content.filter((b): b is Anthropic.TextBlock => b.type === "text").map((b) => b.text).join("\n").trim();
      if (res.stop_reason !== "tool_use") { reply = text; break; }
      msgs.push({ role: "assistant", content: res.content });
      const results: Anthropic.ToolResultBlockParam[] = [];
      for (const b of res.content) {
        if (b.type !== "tool_use") continue;
        const input = (b.input ?? {}) as Record<string, unknown>;
        if (WRITE_NAMES.has(b.name)) {
          const d = describeWrite(b.name, input, lang);
          if (d.ok && actions.length < 12) actions.push({ tool: b.name, input, summary: d.summary });
          results.push({ type: "tool_result", tool_use_id: b.id, is_error: !d.ok, content: d.ok ? `Tillaga skráð og bíður staðfestingar notandans (EKKI framkvæmt): ${d.summary}` : d.error });
        } else {
          results.push({ type: "tool_result", tool_use_id: b.id, content: await runReadTool(b.name, input) });
        }
      }
      msgs.push({ role: "user", content: results });
      reply = text;
    }
  } catch (e) {
    console.error("[assistant]", e instanceof Error ? e.message : e);
    return NextResponse.json({ ok: false, error: lang === "en" ? "VAKTO AI could not answer right now. Try again." : "VAKTO AI gat ekki svarað núna. Reyndu aftur." }, { status: 502 });
  }
  return NextResponse.json({ ok: true, reply: reply || (actions.length ? "" : "…"), actions });
}
