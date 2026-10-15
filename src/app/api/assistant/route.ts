import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { VAKTO_KNOWLEDGE } from "@/lib/ai/vakto-knowledge";
import { READ_TOOLS, WRITE_TOOLS, WRITE_NAMES, runReadTool, describeWrite, type PendingAction } from "@/lib/ai/assistant-tools";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";
import { aiAllowance, bumpAiUsage } from "@/lib/ai/ai-plan.server";

// VAKTO AI — aðstoðarmaður í horninu (stjórnendur og vaktstjórar).
// Les gögn með verkfærum; breytingar verða að TILLÖGUM sem notandinn staðfestir með hnappi (sjá ./execute).
export const maxDuration = 180;
const MODEL = "claude-sonnet-5";
const MAX_STEPS = 10;
const DAYS_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

type Msg = { role: "user" | "assistant"; content: string };

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki uppsett" }, { status: 503 });
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });

  // Mánaðarheimild (0075): 25 frítt, 500 með viðbót eða í prufu. Þegar hún er búin svarar
  // aðstoðarmaðurinn ekki; spjallið sýnir þá hnapp á Stillingar → Áskrift.
  const allowance = await aiAllowance(me.companyId).catch(() => null);
  if (allowance && allowance.used >= allowance.limit) {
    const free = allowance.mode === "free";
    return NextResponse.json({
      ok: false, limit: { mode: allowance.mode, used: allowance.used, limit: allowance.limit, canUpgrade: free && me.role === "owner" },
      error: free
        ? (me.role === "owner"
          ? `Fríu spurningarnar ${allowance.limit} í þessum mánuði eru búnar. Kveiktu á VAKTO AI-viðbótinni (1.990 kr/mán, allt að 500 spurningar) í Stillingum → Áskrift.`
          : `Fríu spurningarnar ${allowance.limit} í þessum mánuði eru búnar. Stjórnandi fyrirtækisins getur kveikt á VAKTO AI-viðbótinni í Stillingum → Áskrift.`)
        : `Spurningarnar ${allowance.limit} í þessum mánuði eru búnar. Heimildin endurnýjast 1. næsta mánaðar; hafðu samband á hallo@vakto.is ef þig vantar meira.`,
    }, { status: 402 });
  }

  let body: { messages?: Msg[]; path?: string; lang?: string; conversationId?: string } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const lang = body.lang === "en" ? "en" : body.lang === "vi" ? "vi" : body.lang === "pl" ? "pl" : "is";
  const history: Anthropic.MessageParam[] = (body.messages ?? [])
    .filter((m) => (m.role === "user" || m.role === "assistant") && typeof m.content === "string" && m.content.trim())
    .slice(-20)
    .map((m) => ({ role: m.role, content: m.content.slice(0, 4000) }));
  while (history.length && history[0].role !== "user") history.shift();
  if (!history.length) return NextResponse.json({ ok: false, error: "Engin spurning" }, { status: 400 });

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  // Föstu leiðbeiningarnar (og verkfærin) eru vistaðar í skyndiminni Anthropic (prompt caching) —
  // breytilega samhengið (fyrirtæki, notandi, dagur, síða) kemur í sérstökum kubbi á eftir.
  const context = `Fyrirtæki: ${me.company}. Notandi: ${me.name} (${me.role === "owner" ? "stjórnandi" : "vaktstjóri"}). Í dag er ${DAYS_IS[now.getDay()]} ${today}. Notandinn er á síðunni ${body.path ?? "/"}.`;
  const instructions = `Þú ert VAKTO AI, aðstoðarmaður inni í vaktakerfinu VAKTO. Fyrirtækið, notandinn, dagurinn í dag og síðan sem notandinn er á koma fram í lok leiðbeininganna.

Hlutverk þín:
1. Svara spurningum um reksturinn með tölum úr verkfærunum (laun % af veltu, velta, kostnaður, tímar, frávik, hver er á vakt, vaktaplan, beiðnir). Notaðu ALLTAF verkfæri fyrir tölur — aldrei giska eða búa til tölur.
2. Undirbúa breytingar: setja/breyta/eyða vakt, afgreiða frí-beiðnir og vaktaskipti, stimpla út. Skrifverkfærin framkvæma EKKERT — þau búa til tillögu sem notandinn staðfestir með „Staðfesta"-hnappi undir svarinu þínu. Segðu því aldrei að breyting sé búin; segðu að tillagan bíði staðfestingar. Skoðaðu fyrst stöðuna (t.d. shifts eða pending_requests) svo nöfn og id séu rétt.
3. Setja upp heila viku: þegar beðið er um vaktaplan fyrir viku („settu upp næstu viku“, „allir vinni 36 tíma og fái einn frídag“), kallaðu fyrst á week_planning_context og síðan á plan_week með ÖLLUM vöktum vikunnar í einni tillögu. Virtu óframboð og samþykkt frí (settu aldrei vakt á þá daga), ein vakt per starfsmann per dag, minnst 11 klst hvíld milli vakta, notaðu tíma úr vaktategundum fyrirtækisins þegar þær passa, haltu þig við mönnunarþörf og launamarkmið ef þau eru gefin, og dreifðu helgum sanngjarnt. Fastlaunafólk fær vaktir eins og aðrir. Ef ósk notandans stangast á við óframboð eða frí, segðu frá því í svarinu í stað þess að brjóta á því. Lýstu planinu í 3–6 punktum (tímar per mann, frídagar, áætlaður kostnaður og laun % ef veltuspá er til) — ekki telja upp hverja vakt.
4. Bera saman og greina: notaðu compare_periods þegar spurt er um breytingu milli tímabila („miðað við síðasta mánuð“, „sama tíma í fyrra“, „hvers vegna hækkaði launakostnaðurinn“), labor_trend fyrir þróun yfir marga mánuði eða vikur, og payroll_runs fyrir raunveruleg útborguð laun úr launakeyrslum. Gerðu skýran greinarmun: launakostnaður í labor_summary/compare_periods er reiknaður út frá stimpluðum tímum (sama og mælaborðið), en payroll_runs eru keyrð laun. Þegar þú berð saman: nefndu bæði tímabilin með dagsetningum, gefðu breytinguna í kr og %, og bentu á 2–3 helstu ástæður (t.d. fleiri tímar, yfirvinna, álag, ákveðnir starfsmenn eða deildir, minni velta). Ef veltu vantar á öðru tímabilinu, segðu það í stað þess að bera saman laun %.
5. Svara „hvernig geri ég…“ spurningum út frá upplýsingunum hér að neðan. Ef þú veist ekki svarið, vísaðu á hallo@vakto.is.

Reglur: stutt og skýrt, punktalistar frekar en töflur, engin emoji. Upphæðir eins og „12.345 kr.“ og prósentur með kommu („27,6 %“). Breyttu afstæðum dagsetningum („næsta föstudag“, „síðasta vika“) í nákvæma dagsetningu og nefndu hana. Vikan byrjar á mánudegi. Ef eitthvað er óljóst, spurðu einnar spurningar í einu. Laun % af veltu: lægra er betra, miðað við markmið fyrirtækisins.
Tungumál: svaraðu á ${lang === "en" ? "ensku" : lang === "vi" ? "víetnömsku" : lang === "pl" ? "pólsku" : "íslensku"} nema notandinn skrifi greinilega á öðru máli.

Um VAKTO:
${VAKTO_KNOWLEDGE}`;
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: instructions, cache_control: { type: "ephemeral" } },
    { type: "text", text: context },
  ];

  // Svarið getur tekið yfir mínútu (heil vika af vöktum). Til að tengingin slitni ekki sendum við
  // bil á nokkurra sekúndna fresti og JSON-svarið í lokin — JSON.parse hunsar bilin á undan.
  const run = async (): Promise<Record<string, unknown>> => {
  const client = new Anthropic();
    const all = [...READ_TOOLS, ...WRITE_TOOLS];
    const tools: Anthropic.Tool[] = all.map((t, i) => (i === all.length - 1 ? { ...t, cache_control: { type: "ephemeral" } } : t));
    const actions: PendingAction[] = [];
    const msgs: Anthropic.MessageParam[] = [...history];
    let reply = "";
    try {
      for (let step = 0; step < MAX_STEPS; step++) {
        const res = await client.messages.create({ model: MODEL, max_tokens: 12000, system, tools, messages: msgs });
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
      return { ok: false, error: lang === "en" ? "VAKTO AI could not answer right now. Try again." : "VAKTO AI gat ekki svarað núna. Reyndu aftur." };
    }
    await bumpAiUsage(me.companyId);
    // Vista samtalið (þolir að töflurnar vanti — þá er sagan aðeins í vafranum).
    let messageId: string | null = null;
    let conversationId: string | null = /^[0-9a-f-]{36}$/i.test(body.conversationId ?? "") ? body.conversationId! : null;
    try {
      const question = history[history.length - 1].content as string;
      if (conversationId) {
        const { data } = await supabase.from("ai_conversations").update({ updated_at: new Date().toISOString() }).eq("id", conversationId).select("id").maybeSingle();
        if (!data) conversationId = null;
      }
      if (!conversationId) {
        const { data } = await supabase.from("ai_conversations").insert({ company_id: me.companyId, user_id: me.userId, title: question.replace(/\s+/g, " ").slice(0, 70) }).select("id").single();
        conversationId = (data?.id as string) ?? null;
      }
      if (conversationId) {
        const t0 = Date.now();
        const { data: saved } = await supabase.from("ai_messages").insert([
          { conversation_id: conversationId, role: "user", content: question, created_at: new Date(t0).toISOString() },
          { conversation_id: conversationId, role: "assistant", content: reply, actions: actions.length ? actions.map((a) => ({ ...a, state: "pending" })) : null, created_at: new Date(t0 + 1).toISOString() },
        ]).select("id, role");
        messageId = (saved ?? []).find((r) => r.role === "assistant")?.id as string ?? null;
      }
    } catch (e) { console.error("[assistant] save", e instanceof Error ? e.message : e); }
    return { ok: true, reply: reply || (actions.length ? "" : "…"), actions, conversationId, messageId };
  };
  const enc = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const beat = setInterval(() => { try { ctrl.enqueue(enc.encode(" ")); } catch { /* lokað */ } }, 5000);
      let out: Record<string, unknown>;
      try { out = await run(); } catch (e) { console.error("[assistant]", e instanceof Error ? e.message : e); out = { ok: false, error: "VAKTO AI gat ekki svarað núna. Reyndu aftur." }; }
      clearInterval(beat);
      ctrl.enqueue(enc.encode(JSON.stringify(out)));
      ctrl.close();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Accel-Buffering": "no" } });
}
