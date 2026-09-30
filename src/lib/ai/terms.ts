import "server-only";

// AI semur sérákvæði ráðningarsamnings út frá lýsingu stjórnanda og/eða yfirfer
// núverandi ákvæði. Skilar tvítyngdum ákvæðum og lagaflöggum (t.d. kjör undir
// kjarasamningi, ógreiddar prufuvaktir, frádráttur af launum). Vistar ekkert:
// stjórnandi velur ákvæðin, les og vistar sjálfur.
//
// Líkan: claude-opus-4-8 eins og annars staðar í VAKTO (lib/ai/schedule.ts, agreement.ts).

import Anthropic from "@anthropic-ai/sdk";

export type TermClause = { titleIs: string; titleEn: string; textIs: string; textEn: string };
export type TermFlag = { clause: string; severity: "high" | "medium"; issueIs: string; issueEn: string };
export type TermsDraft = { ok: boolean; clauses: TermClause[]; flags: TermFlag[]; summary: string; error?: string };

const obj = (properties: Record<string, unknown>, required: string[]) =>
  ({ type: "object", properties, required, additionalProperties: false });
const str = { type: "string" };

const SCHEMA = obj({
  summary: { type: "string", description: "1–2 setningar á íslensku: hvað var samið eða hvað fannst við yfirferð" },
  clauses: {
    type: "array",
    items: obj({
      titleIs: { type: "string", description: "Stutt heiti ákvæðis á íslensku, t.d. „Trúnaður“" },
      titleEn: { type: "string", description: "Sama heiti á ensku, t.d. „Confidentiality“" },
      textIs: { type: "string", description: "Ákvæðið sjálft á skýrri, faglegri íslensku, 1–3 setningar" },
      textEn: { type: "string", description: "Sama ákvæði á ensku" },
    }, ["titleIs", "titleEn", "textIs", "textEn"]),
  },
  flags: {
    type: "array",
    description: "Ákvæði (ný eða úr núverandi texta) sem gætu stangast á við lög eða kjarasamninga",
    items: obj({
      clause: { type: "string", description: "Heiti eða stutt tilvitnun í ákvæðið sem flaggað er" },
      severity: { type: "string", enum: ["high", "medium"] },
      issueIs: { type: "string", description: "Hvers vegna þetta er vafasamt, á íslensku, með vísun í lög ef við á" },
      issueEn: str,
    }, ["clause", "severity", "issueIs", "issueEn"]),
  },
}, ["summary", "clauses", "flags"]);

const SYSTEM = `Þú aðstoðar íslensk fyrirtæki við að semja sérákvæði í ráðningarsamninga (kaflann „Sérákvæði“ á eftir hefðbundnum atriðum samningsins).

Reglur:
- Skrifaðu stutt, skýr og fagleg ákvæði á íslensku og ensku. Eitt efni á hvert ákvæði. Engar tölur um laun, álag eða yfirvinnu — þær ráðast af kjarasamningi og eru annars staðar í samningnum.
- Ekkert ákvæði má veita lakari kjör en kjarasamningur eða lög (samningar um lakari kjör eru ógildir skv. 1. gr. laga nr. 55/1980).
- Endurtaktu ekki atriði sem samningurinn nær þegar yfir (laun, orlof, uppsagnarfrestur, lífeyrissjóður, vinnutími almennt).
- Notaðu aldrei rununa „ / “ (skástrik með bilum) inni í texta.
- Flaggaðu (flags) allt sem gæti verið ólöglegt eða vafasamt, bæði í nýjum tillögum og í núverandi texta ef hann fylgir. Dæmi: ógreiddar prufuvaktir, frádráttur af launum vegna tjóns eða fatnaðar, sektir, óhóflegt samkeppnis- eða starfsbann, afsal á veikindarétti, kröfur um að vera ávallt til taks án greiðslu, persónuvernd (t.d. eftirlit), mismunun.
- „high“ = líklega ólöglegt eða ógilt; „medium“ = óljóst eða þarf að orða betur.
- Þetta er tillaga sem stjórnandi yfirfer — ekki lögfræðiráðgjöf.`;

const clean = (s: string) => s.replace(/\s+\/\s+/g, "/").replace(/\s+/g, " ").trim();

export async function draftContractTerms(input: { description?: string; current?: string; companyName?: string }): Promise<TermsDraft> {
  const empty: TermsDraft = { ok: false, clauses: [], flags: [], summary: "" };
  if (!process.env.ANTHROPIC_API_KEY) return { ...empty, error: "AI er ekki virkt á þessum aðgangi." };
  const description = input.description?.trim() ?? "";
  const current = input.current?.trim() ?? "";
  if (!description && !current) return { ...empty, error: "Lýstu vinnustaðnum eða skrifaðu ákvæði til að yfirfara." };

  const parts = [
    input.companyName ? `Fyrirtæki: ${input.companyName}` : "",
    description ? `Lýsing stjórnanda á vinnustaðnum og því sem á að vera í ákvæðunum:\n${description}` : "",
    current ? `Núverandi sérákvæði (yfirfarðu þau, lagaðu orðalag og flaggaðu vandamál; skilaðu endurbættri útgáfu í clauses):\n${current}` : "",
  ].filter(Boolean).join("\n\n");

  try {
    const client = new Anthropic();
    const msg = await client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: SCHEMA } },
      system: SYSTEM,
      messages: [{ role: "user", content: parts }],
    }).finalMessage();
    if (msg.stop_reason === "refusal") return { ...empty, error: "AI hafnaði beiðninni." };
    if (msg.stop_reason === "max_tokens") return { ...empty, error: "Svarið varð of langt — styttu lýsinguna." };
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { ...empty, error: "Ekkert svar frá AI" };
    const p = JSON.parse(block.text) as { summary: string; clauses: TermClause[]; flags: TermFlag[] };
    return {
      ok: true,
      summary: p.summary,
      clauses: (p.clauses ?? []).map((c) => ({ titleIs: clean(c.titleIs), titleEn: clean(c.titleEn), textIs: clean(c.textIs), textEn: clean(c.textEn) })),
      flags: p.flags ?? [],
    };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ...empty, error: "AI er upptekið — reyndu aftur eftir smá stund." };
    console.error("draftContractTerms", e);
    return { ...empty, error: "Tókst ekki að semja ákvæðin." };
  }
}
