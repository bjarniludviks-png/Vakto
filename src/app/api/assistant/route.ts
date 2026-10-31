import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createClient } from "@/lib/supabase/server";
import { VAKTO_KNOWLEDGE } from "@/lib/ai/vakto-knowledge";
import { READ_TOOLS, WRITE_TOOLS, WRITE_NAMES, runReadTool, describeWrite, type PendingAction } from "@/lib/ai/assistant-tools";
import { assistantUser, rateLimited } from "@/lib/ai/assistant-auth";
import { aiStop, bumpAiUsage, demoAiCheck, recordDemoVisitorAi } from "@/lib/ai/ai-plan.server";
import { addUsage, recordAiUsage, type AiUsage } from "@/lib/ai/usage.server";
import { companyPlan } from "@/lib/plan.server";
import { planAllows } from "@/lib/plan-features";
import { modelFor, PLAN_CHAT_EFFORT } from "@/lib/ai/models";
import { ndjsonStream, NDJSON_HEADERS, completedShiftStrings, partialNumber, partialString, partialStringOpen, type AssistantEvent } from "@/lib/ai/stream";

// VAKTO AI — aðstoðarmaður í horninu (stjórnendur og vaktstjórar).
// Les gögn með verkfærum; breytingar verða að TILLÖGUM sem notandinn staðfestir með hnappi (sjá ./execute).
export const maxDuration = 300; // heill mánuður (plan_month) getur tekið nokkrar mínútur
const MAX_STEPS = 10;
const DAYS_IS = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];

type Msg = { role: "user" | "assistant"; content: string };

/** Síður sem vefleit VAKTO AI má lesa: stéttarfélög, SA, ríkissáttasemjari og opinberir vefir. */
const WAGE_DOMAINS = ["efling.is", "sgs.is", "vr.is", "matvis.is", "sa.is", "asi.is", "rafis.is", "samidn.is", "fbm.is", "hlif.is", "framsyn.is", "afl.is", "vlfa.is", "bsrb.is", "bhm.is", "rikissattasemjari.is", "island.is", "stjornarradid.is"];

/** Skráahýsingar þar sem stéttarfélögin geyma PDF-launatöflur (Efling: irp.cdn-website.com) — aðeins fyrir web_fetch. */
const WAGE_FILE_HOSTS = ["irp.cdn-website.com"];

/** Textakubbar svarsins: kubbar í röð (vefleit klýfur texta við tilvitnanir) límdir saman, annars málsgreinaskil. */
function joinText(content: Anthropic.ContentBlock[]): string {
  let out = "", prevText = false;
  for (const b of content) {
    if (b.type === "text") { out += prevText || !out ? b.text : `\n\n${b.text}`; prevText = true; }
    else prevText = false;
  }
  return out.trim();
}

/** Heimildir úr vefleit sem svarið vitnar í (eða fann) — birtar sem tenglar neðst ef þær eru ekki þegar í textanum. */
function withSources(text: string, content: Anthropic.ContentBlock[]): string {
  const seen = new Map<string, string>();
  for (const b of content) {
    if (b.type !== "text" || !b.citations) continue;
    for (const c of b.citations) if (c.type === "web_search_result_location" && c.url && !seen.has(c.url)) seen.set(c.url, c.title || new URL(c.url).hostname);
  }
  const extra = [...seen].filter(([url]) => !text.includes(url));
  if (!extra.length) return text;
  return `${text}\n\n**Heimildir:**\n${extra.slice(0, 4).map(([url, title]) => `- [${title.replace(/[[\]]/g, "")}](${url})`).join("\n")}`;
}

export async function POST(request: Request) {
  if (!process.env.ANTHROPIC_API_KEY) return NextResponse.json({ ok: false, error: "AI er ekki uppsett" }, { status: 503 });
  const supabase = await createClient();
  const me = await assistantUser(supabase);
  if ("error" in me) return NextResponse.json({ ok: false, error: me.error }, { status: me.status });
  if (rateLimited(me.userId)) return NextResponse.json({ ok: false, error: "Of margar fyrirspurnir í einu — bíddu aðeins." }, { status: 429 });

  // Heimild (0089): leið, kvóti mánaðarins (+ AI-pakkar) og kostnaðarþak. Þegar hún er búin svarar
  // aðstoðarmaðurinn ekki; spjallið sýnir þá hnapp á Stillingar → Áskrift.
  const demo = await demoAiCheck(); // opið demo: dagsþök alls + per gest (talið hér að neðan eins og annað)
  if (demo?.stop) return NextResponse.json({ ok: false, error: demo.stop, signup: demo.signup }, { status: 429 });
  const model = modelFor("chat", { demo: !!demo }); // demo → Haiku
  const stop = demo ? null : await aiStop(me.companyId, me.role).catch(() => null);
  if (stop) return NextResponse.json({ ok: false, error: stop.error, ...(stop.limit ? { limit: stop.limit } : {}) }, { status: 402 });
  // AI-vaktaplan (plan_week) fylgir Vexti og Rekstri.
  const canPlan = !!demo || planAllows((await companyPlan(me.companyId)).features, "ai_schedule");

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
  const context = `Fyrirtæki: ${me.company}. Notandi: ${me.name} (${me.role === "owner" ? "stjórnandi" : "vaktstjóri"}). Í dag er ${DAYS_IS[now.getDay()]} ${today}. Notandinn er á síðunni ${body.path ?? "/"}.${canPlan ? "" : " Áskriftarleið fyrirtækisins (Grunnur) inniheldur ekki AI-vaktaplan fyrir heila viku, vaktara né skýrslur á tímaáætlun — ef beðið er um það, segðu vingjarnlega að það sé í boði í Vexti (sjá vakto.is/verd) og bjóddu aðra hjálp."}`;
  const instructions = `Þú ert VAKTO AI, aðstoðarmaður inni í vaktakerfinu VAKTO. Fyrirtækið, notandinn, dagurinn í dag og síðan sem notandinn er á koma fram í lok leiðbeininganna.

Hlutverk þín:
1. Svara spurningum um reksturinn með tölum úr verkfærunum (laun % af veltu, velta, kostnaður, tímar, frávik, hver er á vakt, vaktaplan, beiðnir, veikindahlutfall með sick_rate — nefndu skilgreininguna stuttlega). Notaðu ALLTAF verkfæri fyrir tölur — aldrei giska eða búa til tölur.
2. Undirbúa breytingar: setja/breyta/eyða vakt, stofna lausar vaktir (create_open_shifts, t.d. „opnaðu vaktir alla daga næstu viku milli 17 og 23“), afgreiða frí-beiðnir og vaktaskipti, stimpla út, og senda ráðningarsamning aftur til undirritunar (employee_contracts fyrst, svo resend_contract; ef fleiri en einn starfsmaður passar, spurðu hvern; ef samningurinn er þegar undirritaður, segðu það og sendu ekkert). Skrifverkfærin framkvæma EKKERT — þau búa til tillögu sem notandinn staðfestir með „Staðfesta"-hnappi undir svarinu þínu. Segðu því aldrei að breyting sé búin; segðu að tillagan bíði staðfestingar. Skoðaðu fyrst stöðuna (t.d. shifts eða pending_requests) svo nöfn og id séu rétt.
3. Setja upp heila viku: þegar beðið er um vaktaplan fyrir viku („settu upp næstu viku“, „allir vinni 36 tíma og fái einn frídag“), kallaðu fyrst á week_planning_context (nema það fylgi þegar spurningunni) og síðan á plan_week með ÖLLUM vöktum vikunnar í einni tillögu. Virtu óframboð og samþykkt frí (settu aldrei vakt á þá daga), ein vakt per starfsmann per dag, minnst 11 klst hvíld milli vakta, notaðu tíma úr vaktategundum fyrirtækisins þegar þær passa, haltu þig við mönnunarþörf og launamarkmið ef þau eru gefin, og dreifðu helgum sanngjarnt. Fastlaunafólk fær vaktir eins og aðrir. Skilyrði notandans eru reglur, ekki óskir: „allir fá tvo frídaga“ = hver starfsmaður í planinu fær nákvæmlega 5 vaktir (7 − 2); „alltaf þrír á vakt“ = nákvæmlega 3 vaktir á hverjum degi vikunnar. Teldu áður en þú leggur til og athugaðu að talan gangi upp. Ef beðið er um eina deild („í eldhúsinu“): notaðu aðeins starfsfólk þeirrar deildar (dept í staff, sjá departments) og settu department í plan_week — þá haldast vaktir annarra deilda. Ef skilyrðin ganga ekki upp (t.d. of fáir í deildinni, óframboð eða frí), segðu nákvæmlega hvað vantar og hvað þú gerðir í staðinn. Ef ósk notandans stangast á við óframboð eða frí, segðu frá því í svarinu í stað þess að brjóta á því. Ef week_planning_context skilar companyRules eru það vistaðar planreglur fyrirtækisins: virtu þær í hverju plani eins og skilyrði notandans, nema hann taki annað fram núna, og nefndu í notes ef regla gekk ekki upp. Ef notandinn biður þig að muna eitthvað um vaktaplan til frambúðar („mundu að…“, „alltaf…“, „aldrei…“) skaltu leggja til save_planning_rule (ein regla per kall); planning_rules sýnir vistaðar reglur og remove_planning_rule eyðir. Heill mánuður („settu upp nóvember“, „allan næsta mánuð“): kallaðu á month_planning_context og síðan plan_month með ÖLLUM vöktum mánaðarins í einni tillögu, sömu reglur og fyrir viku; yfirvinna er 40 klst á viku (mán–sun), dreifðu helgum sanngjarnt yfir mánuðinn. Saga: week_planning_context og month_planning_context skila history (síðustu 8 vikur: planað/unnið per vikudag og klukkustund, deildir). Notaðu hana til að plana nær raunverulegri þörf — þar sem reglulega er unnið meira en planað (sömu vikudagar/klukkustundir) skaltu bæta við eða lengja vaktir, og þar sem planað er meira en unnið skaltu stytta, innan skilyrða notandans, reglna og launamarkmiðs. Nefndu í notes 1–2 helstu breytingar sem sagan leiddi af sér (t.d. „bætti við manni á föstudagskvöldum 18–22, þar var unnið að meðaltali 6 klst. umfram plan“). Ef spurt er sérstaklega hvar eða hvenær farið er yfir tíma, notaðu planning_history (líka fyrir lengra tímabil eða sama mánuð í fyrra) og lýstu vikudögum, tímum, deildum og starfsfólki; bentu á að langar stimplanir (gleymd útstimplun) séu ekki taldar og vísaðu þá á timesheet_issues. Lýstu planinu í notes-sviði plan_week/plan_month (á eftir shifts) í 3–6 punktum (tímar per mann, frídagar, áætlaður kostnaður og laun % ef veltuspá er til, og hvað gekk ekki upp) — ekki telja upp hverja vakt. notes er svarið sem notandinn sér; skrifaðu ekkert meira eftir að tillagan er skráð.
4. Bera saman og greina: notaðu compare_periods þegar spurt er um breytingu milli tímabila („miðað við síðasta mánuð“, „sama tíma í fyrra“, „hvers vegna hækkaði launakostnaðurinn“), labor_trend fyrir þróun yfir marga mánuði eða vikur, og payroll_runs fyrir raunveruleg útborguð laun úr launakeyrslum. Gerðu skýran greinarmun: launakostnaður í labor_summary/compare_periods er reiknaður út frá stimpluðum tímum (sama og mælaborðið), en payroll_runs eru keyrð laun. Þegar þú berð saman: nefndu bæði tímabilin með dagsetningum, gefðu breytinguna í kr og %, og bentu á 2–3 helstu ástæður (t.d. fleiri tímar, yfirvinna, álag, ákveðnir starfsmenn eða deildir, minni velta). Ef veltu vantar á öðru tímabilinu, segðu það í stað þess að bera saman laun %.
Frávik í tímaskráningu („farðu yfir frávik“, „hver gleymdi að stimpla sig út?“): notaðu timesheet_issues fyrir tímabilið, lýstu stuttlega hvað fannst og leggðu til lagfæringu fyrir hvert atriði: close_punch þegar fix er close (áætluð lok vaktar), annars ask_correction ef starfsmaðurinn er með aðgang (hasAccount); ef ekki, segðu að stjórnandi þurfi að leiðrétta sjálfur í Tímaskráningu. Mest 15 tillögur í einu; segðu ef fleiri bíða. Vaktarar og skýrslur: þegar notandinn vill láta vita af einhverju sjálfkrafa („láttu mig vita ef einhver fer yfir 180 tíma í mánuðinum“, „minntu mig ef laun % fer yfir 32 %“) notaðu create_alert; fyrir skýrslur á tímaáætlun („sendu mér yfirvinnuskýrslu alla mánudaga“) schedule_report; fyrir skýrslu strax í tölvupósti („sendu mér mætingarskýrslu síðasta mánaðar“) send_report_now með nákvæmum dagsetningum. Til að slökkva á eða eyða vaktara: list_alerts fyrst, svo toggle_alert eða delete_alert. Vaktarar eru metnir einu sinni á dag kl. 8 og skýrslur fara kl. 8 að morgni; ef beðið er um annan tíma, segðu að þær fari kl. 8. Tilkynningar fara á notandann sem biður um þær. Ef „einhver“ fer yfir tímamörk og ekki er tekið fram hvort planaðar vaktir eigi að teljast, settu includePlanned true og nefndu það.
Laun og kjarasamningar („hvað eru laun starfsmanns í eldhúsi með 4 ára starfsaldur?“, „er Jón á réttum launum?“): leitaðu með web_search að gildandi launatöflu (og opnaðu töfluna/PDF-skjalið með web_fetch ef niðurstaðan sýnir ekki tölurnar; notaðu nýjustu töflu sem er í gildi í dag) á opinberri síðu stéttarfélagsins (t.d. efling.is, sgs.is, vr.is, matvis.is, sa.is, asi.is). Skrifaðu leitarorð á íslensku (t.d. „Efling launatafla veitinga- og gistihús 2026“). Veitinga- og gististaðir fylgja yfirleitt samningi SGS/Eflingar og SA um veitinga- og gistihús; matreiðslumenn Matvís; verslun og skrifstofa VR. Gefðu upphæðina (mánaðarlaun og tímakaup í dagvinnu ef það kemur fram), launaflokk/þrep, frá hvaða dagsetningu taflan gildir og heimildina sem markdown-tengil [heiti](slóð). Taktu fram að þetta séu lágmarkslaun samkvæmt samningi og að álag (kvöld, helgar, yfirvinna) bætist við. Ef starfsaldur eða starfsheiti ræður þrepi og það er óljóst, gefðu bilið og segðu hvað ræður. Aldrei giska á upphæð — finnist ekki gild tafla, segðu það og vísaðu á stéttarfélagið. Ef spurt er um ákveðinn starfsmann, notaðu staff_pay til að fá stéttarfélag, starfsheiti, starfsaldur og núverandi laun, og berðu saman við töfluna (segðu skýrt ef laun virðast undir lágmarki).
5. Svara „hvernig geri ég…“ spurningum út frá upplýsingunum hér að neðan. Ef þú veist ekki svarið, vísaðu á hallo@vakto.is.

Reglur: stutt og skýrt, punktalistar frekar en töflur, engin emoji. Upphæðir eins og „12.345 kr.“ og prósentur með kommu („27,6 %“). Breyttu afstæðum dagsetningum („næsta föstudag“, „síðasta vika“) í nákvæma dagsetningu og nefndu hana. Vikan byrjar á mánudegi. Ef eitthvað er óljóst, spurðu einnar spurningar í einu. Laun % af veltu: lægra er betra, miðað við markmið fyrirtækisins.
Tungumál: svaraðu á ${lang === "en" ? "ensku" : lang === "vi" ? "víetnömsku" : lang === "pl" ? "pólsku" : "íslensku"} nema notandinn skrifi greinilega á öðru máli.

Um VAKTO:
${VAKTO_KNOWLEDGE}`;
  const system: Anthropic.TextBlockParam[] = [
    { type: "text", text: instructions, cache_control: { type: "ephemeral" } },
    { type: "text", text: context },
  ];

  // Svarið er streymt sem NDJSON (lib/ai/stream.ts): stig („Les vaktaplan…“), texti orð fyrir orð,
  // vaktir plan_week jafnóðum og þær eru skrifaðar, tillögur um leið og þær eru tilbúnar og loks
  // „done“ með sama innihaldi og JSON-svarið var áður. Ping á 5 sek. fresti heldur tengingunni opinni.
  const question = history[history.length - 1].content as string;
  const planning = canPlan && isPlanningRequest(question);
  const run = async (send: (ev: AssistantEvent) => void): Promise<Record<string, unknown>> => {
    const client = new Anthropic();
    const all = [...READ_TOOLS, ...WRITE_TOOLS.filter((t) => canPlan || (t.name !== "plan_week" && t.name !== "plan_month"))];
    // Vefleit (server tool hjá Anthropic) eingöngu á síðum stéttarfélaga/vinnumarkaðar — fyrir launatöflur
    // kjarasamninga. Demo (Haiku) fær grunnútgáfuna; síuð útgáfa (20260209) krefst Sonnet/Opus.
    const webSearch = { type: demo ? "web_search_20250305" : "web_search_20260209", name: "web_search", max_uses: 3, allowed_domains: WAGE_DOMAINS } as unknown as Anthropic.ToolUnion;
    // Opna síðu/PDF sem leitin fann (launatöflur eru oft í PDF eða undirsíðum). Ekki í demo.
    const webFetch = { type: "web_fetch_20260209", name: "web_fetch", max_uses: 3, allowed_domains: [...WAGE_DOMAINS, ...WAGE_FILE_HOSTS], max_content_tokens: 30000 } as unknown as Anthropic.ToolUnion;
    const tools: Anthropic.ToolUnion[] = [webSearch, ...(demo ? [] : [webFetch]), ...all.map((t, i) => (i === all.length - 1 ? { ...t, cache_control: { type: "ephemeral" as const } } : t))];
    const actions: PendingAction[] = [];
    const msgs: Anthropic.MessageParam[] = [...history];
    let reply = "";
    let usage: AiUsage = {};
    const track = () => recordAiUsage({ model, usage, feature: "assistant", companyId: me.companyId, userId: me.userId });
    try {
      // Vaktaplansbeiðni: samhengi vikunnar sótt strax og sett með spurningunni — sparar heila umferð
      // (líkanið kallaði alltaf fyrst á week_planning_context). Vilji það aðra viku kallar það sjálft.
      if (planning) {
        send({ t: "stage", stage: "read", tool: "week_planning_context" });
        const monday = planningMonday(question, now);
        const ctx = await runReadTool("week_planning_context", { monday });
        msgs[msgs.length - 1] = { role: "user", content: [
          { type: "text", text: question },
          { type: "text", text: `[Kerfið sótti week_planning_context fyrir vikuna sem hefst ${monday} — ekki kalla á það aftur fyrir þá viku.]\n${ctx}` },
        ] };
      }
      let jsonRetries = 0;
      for (let step = 0; step < MAX_STEPS; step++) {
        send({ t: "stage", stage: actions.length ? "summary" : "think" });
        if (step > 0) send({ t: "turn" });
        const stream = client.messages.stream({ model, max_tokens: 16000, system, tools, messages: msgs, ...(planning ? { output_config: { effort: actions.length ? "low" : PLAN_CHAT_EFFORT } } : {}) });
        const blocks = new Map<number, { name: string; json: string; sent: number; notes: number }>();
        let res: Anthropic.Message;
        try {
          for await (const ev of stream) {
            if (ev.type === "content_block_start" && ev.content_block.type === "tool_use") {
              const name = ev.content_block.name;
              blocks.set(ev.index, { name, json: "", sent: 0, notes: 0 });
              send({ t: "stage", stage: name === "plan_week" || name === "plan_month" ? "plan" : WRITE_NAMES.has(name) ? "write" : "read", tool: name });
            } else if (ev.type === "content_block_start" && ev.content_block.type === "server_tool_use") {
              send({ t: "stage", stage: "read", tool: ev.content_block.name === "web_fetch" ? "web_fetch" : "web_search" });
            } else if (ev.type === "content_block_delta") {
              if (ev.delta.type === "text_delta") send({ t: "text", d: ev.delta.text });
              else if (ev.delta.type === "input_json_delta") {
                const b = blocks.get(ev.index);
                if (b?.name === "plan_week" || b?.name === "plan_month") {
                  b.json += ev.delta.partial_json;
                  const done = completedShiftStrings(b.json);
                  if (done.length > b.sent) {
                    send({ t: "plan", add: done.slice(b.sent), total: partialNumber(b.json, "shiftCount"), dept: partialString(b.json, "department") });
                    b.sent = done.length;
                  }
                  // notes (svarið til notandans) kemur á eftir vöktunum — streymt sem texti.
                  const notes = partialStringOpen(b.json, "notes");
                  if (notes && notes.length > b.notes) { send({ t: "text", d: notes.slice(b.notes) }); b.notes = notes.length; }
                }
              }
            }
          }
          res = await stream.finalMessage();
          usage = addUsage(usage, res.usage);
        } catch (e) {
          // plan_week streymir inntakinu óbuffrað: ef JSON-ið er ógilt reynum við umferðina einu sinni enn.
          if (e instanceof Anthropic.APIError || jsonRetries++ >= 1) throw e;
          console.error("[assistant] ógilt tool-inntak, reyni aftur", e instanceof Error ? e.message : e);
          send({ t: "turn" });
          step--;
          continue;
        }
        const text = joinText(res.content);
        // Vefleit getur gert hlé á umferðinni (pause_turn): halda áfram með sama efni.
        if (res.stop_reason === "pause_turn") { msgs.push({ role: "assistant", content: res.content }); reply = text; continue; }
        if (res.stop_reason !== "tool_use") { reply = withSources(text, res.content); break; }
        msgs.push({ role: "assistant", content: res.content });
        const results: Anthropic.ToolResultBlockParam[] = [];
        for (const b of res.content) {
          if (b.type !== "tool_use") continue;
          const input = (b.input ?? {}) as Record<string, unknown>;
          if (WRITE_NAMES.has(b.name)) {
            const d = describeWrite(b.name, input, lang);
            if (d.ok && actions.length < 12) {
              const action = { tool: b.name, input, summary: d.summary };
              actions.push(action);
              send({ t: "action", action });
            }
            results.push({ type: "tool_result", tool_use_id: b.id, is_error: !d.ok, content: d.ok ? `Tillaga skráð og bíður staðfestingar notandans (EKKI framkvæmt): ${d.summary}` : d.error });
          } else {
            results.push({ type: "tool_result", tool_use_id: b.id, content: await runReadTool(b.name, input) });
          }
        }
        msgs.push({ role: "user", content: results });
        reply = text;
        // plan_week skilaði svarinu sjálft (notes) og allar tillögur umferðarinnar stóðust: þá þarf ekki
        // aðra umferð bara til að lýsa planinu (sparar 5–8 sek.).
        const uses = res.content.filter((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
        const planNotes = uses.map((b) => (b.name === "plan_week" || b.name === "plan_month" ? String((b.input as Record<string, unknown>)?.notes ?? "").trim() : "")).find(Boolean);
        if (planNotes && uses.every((b) => WRITE_NAMES.has(b.name)) && !results.some((r) => r.is_error)) {
          reply = [text, planNotes].filter(Boolean).join("\n\n");
          break;
        }
      }
    } catch (e) {
      console.error("[assistant]", e instanceof Error ? e.message : e);
      await track();
      return { ok: false, error: lang === "en" ? "VAKTO AI could not answer right now. Try again." : "VAKTO AI gat ekki svarað núna. Reyndu aftur." };
    }
    await Promise.all([bumpAiUsage(me.companyId), track()]);
    if (demo) await recordDemoVisitorAi(demo.companyId, demo.key);
    // Vista samtalið (þolir að töflurnar vanti — þá er sagan aðeins í vafranum).
    let messageId: string | null = null;
    let conversationId: string | null = /^[0-9a-f-]{36}$/i.test(body.conversationId ?? "") ? body.conversationId! : null;
    try {
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
    return { ok: true, reply: reply || (actions.length ? "" : "…"), actions, conversationId, messageId, ...(demo ? { demo: { left: Math.max(0, demo.remaining - 1), of: demo.perVisitor } } : {}) };
  };
  const stream = ndjsonStream<AssistantEvent>(async (send) => {
    let out: Record<string, unknown>;
    try { out = await run(send); } catch (e) { console.error("[assistant]", e instanceof Error ? e.message : e); out = { ok: false, error: "VAKTO AI gat ekki svarað núna. Reyndu aftur." }; }
    send({ ...out, t: "done", ok: out.ok === true });
  });
  return new Response(stream, { headers: NDJSON_HEADERS });
}

/** Er þetta beiðni um vaktaplan fyrir viku? Þá er samhengi vikunnar sótt strax (sparar eina umferð). */
function isPlanningRequest(q: string): boolean {
  const s = q.toLowerCase();
  const plan = /(vaktaplan|vaktir|vöktum|vakt\b|plan\b|planið|settu upp|setja upp|raðaðu|schedule|rota|shifts|grafik|zmian|lịch|ca làm)/.test(s);
  const week = /(vik[uae]|week|tydzie|tygod|tuần)/.test(s);
  return plan && week;
}

/** Mánudagur vikunnar sem beðið er um: „þessa viku“ → núverandi vika, annars næsta vika (algengast). */
function planningMonday(q: string, now: Date): string {
  const thisWeek = /(þessa viku|þessari viku|this week|ten tydzień|tym tygodniu|tuần này)/.test(q.toLowerCase());
  const dow = (now.getDay() + 6) % 7; // 0 = mánudagur
  const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - dow + (thisWeek ? 0 : 7));
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
