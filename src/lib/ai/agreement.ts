import "server-only";

// AI les kjarasamning (PDF eða texta) og fyllir út reglusniðmát (RuleSet) — með
// orðréttri tilvitnun og staðsetningu (bls./grein) fyrir HVERT gildi, svo
// stjórnandi geti borið hvert gildi saman við samninginn áður en hann vistar.
// Ekkert er vistað hér: UI sýnir tillöguna og aðeins „Vista sniðmát“ gildir.
//
// Líkan: claude-opus-4-8 eins og restin af VAKTO (sjá src/lib/ai/schedule.ts).
// Citations-fídus API-sins er ósamrýmanlegur structured outputs, svo tilvitnanir
// koma í `sources` í skemanu og UI merkir þær sem „til yfirferðar“.

import Anthropic from "@anthropic-ai/sdk";
import type { RuleSet } from "@/lib/rules";
import { strictSchema, stripUnset } from "./schema";

export type AgreementSource = { field: string; value: string; quote: string; location: string };
export type AgreementResult = {
  ok: boolean;
  live: boolean;
  name: string;
  explanation: string;
  rules: RuleSet;
  sources: AgreementSource[];
  missing: string[];
  error?: string;
};

const obj = (properties: Record<string, unknown>, required: string[] = []) =>
  ({ type: "object", properties, required, additionalProperties: false });
const num = { type: "number" };
const str = { type: "string" };

const SCHEMA = obj({
  name: { type: "string", description: "Stutt heiti sniðmáts, t.d. „Efling — SA, veitingahús 2024–2028“" },
  explanation: { type: "string", description: "2–4 setningar á íslensku: hvaða samningur, gildistími, fyrir hvaða störf, og hvað stjórnandi þarf að staðfesta" },
  rules: obj({
    overtime: obj({ afterHoursPerDay: num, afterHoursPerWeek: num, afterHoursPerMonth: num, pct: num }),
    night: obj({ from: str, to: str, pct: num }),
    weekend: obj({ pct: num }),
    holiday: obj({ pct: num }),
    premiums: { type: "array", items: obj({ label: str, pct: num, from: str, to: str, days: { type: "array", items: { type: "integer" } } }, ["label", "pct"]) },
    breaks: obj({ minutesPer6h: num, paid: { type: "boolean" } }),
    rest: obj({ minHoursBetweenShifts: num, maxConsecutiveDays: num }),
    vacation: obj({ daysPerYear: num, accrualPct: num }),
    sick: obj({ daysPerYear: num, paidPct: num }),
    wage: obj({
      monthly: { type: "number", description: "Mánaðarlaun (kr) úr launatöflu fyrir hlutverkið/starfsaldur" },
      dayRate: { type: "number", description: "Dagvinnukaup (kr/klst) úr launatöflu" },
      overtimeRate: { type: "number", description: "Yfirvinnukaup (kr/klst) úr launatöflu, eða reiknað eftir formúlu samningsins" },
      scale: { type: "string", description: "Launaflokkur og þrep, t.d. „Lfl. 5, þrep 2“" },
    }),
    notes: str,
  }),
  sources: {
    type: "array",
    description: "EIN færsla fyrir hvert gildi sem sett var í rules",
    items: obj({
      field: { type: "string", description: "Slóð gildisins, t.d. overtime.pct eða premiums:Kvöldálag" },
      value: { type: "string", description: "Gildið eins og það var sett, t.d. „80“ eða „17:00–24:00, 33%“" },
      quote: { type: "string", description: "ORÐRÉTT tilvitnun úr samningnum sem gildið byggir á (hámark ~200 stafir)" },
      location: { type: "string", description: "Hvar í samningnum, t.d. „bls. 12, gr. 2.3.1“" },
    }, ["field", "value", "quote", "location"]),
  },
  missing: { type: "array", items: str, description: "Atriði sem samningurinn tilgreinir EKKI og þarf að fylla inn handvirkt" },
}, ["name", "explanation", "rules", "sources", "missing"]);

const PROMPT = `Þú lest íslenskan kjarasamning (eða sambærilegan samning) og dregur út vinnureglur fyrir launa- og vaktakerfi.

Reglur:
- Settu AÐEINS gildi sem standa í skjalinu. Giskaðu aldrei og fylltu ekki í eyður út frá almennri þekkingu — það sem vantar fer í "missing".
- Fyrir HVERT gildi sem þú setur í rules skaltu bæta við færslu í "sources" með orðréttri tilvitnun og staðsetningu (blaðsíða og grein). Tilvitnunin verður að vera nákvæmlega eins og í skjalinu.
- Prósentur sem tölur (33 fyrir 33%). Tímar sem HH:MM. Vikudagar í premiums.days: 0=mán … 6=sun.
- Öll álög (kvöld, nótt, helgar, stórhátíðir, bakvaktir o.s.frv.) fara í "premiums" með heiti, %, og tímabili/dögum ef samningurinn tilgreinir það. Settu líka night/weekend/holiday ef samningurinn skilgreinir þau skýrt.
- Ef samningurinn hefur mismunandi reglur eftir starfi eða starfsaldri, notaðu þær sem eiga við hlutverkið hér að neðan og nefndu hin afbrigðin í "notes".
- Laun (wage): lestu mánaðarlaun, dagvinnukaup og yfirvinnukaup úr launatöflu samningsins fyrir hlutverkið og starfsaldurinn, og launaflokk/þrep. Ef launatafla fylgir ekki eða hlutverkið er óljóst, slepptu wage og nefndu það í "missing". Hvert launagildi þarf tilvitnun í sources eins og önnur gildi. Taktu fram í explanation frá hvaða dagsetningu launataflan gildir.
- Skrifaðu explanation og notes á íslensku. Þetta er tillaga sem stjórnandi yfirfer — ekki lögfræðiráðgjöf.`;

export async function readAgreement(input: { pdfBase64?: string; text?: string; hint?: string }): Promise<AgreementResult> {
  const empty: AgreementResult = { ok: false, live: false, name: "", explanation: "", rules: {}, sources: [], missing: [] };
  if (!process.env.ANTHROPIC_API_KEY) {
    return { ...empty, error: "AI er ekki virkt — ANTHROPIC_API_KEY vantar. Settu reglurnar inn handvirkt eða notaðu sniðmát." };
  }
  if (!input.pdfBase64 && !input.text?.trim()) return { ...empty, error: "Ekkert skjal" };

  const doc: Anthropic.ContentBlockParam = input.pdfBase64
    ? { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.pdfBase64 }, title: "Kjarasamningur" }
    : { type: "document", source: { type: "text", media_type: "text/plain", data: input.text! }, title: "Kjarasamningur" };

  try {
    const client = new Anthropic();
    const stream = client.messages.stream({
      model: "claude-opus-4-8",
      max_tokens: 32000,
      thinking: { type: "adaptive" },
      output_config: { effort: "high", format: { type: "json_schema", schema: strictSchema(SCHEMA) } },
      system: PROMPT,
      messages: [{
        role: "user",
        content: [
          doc,
          { type: "text", text: `Hlutverk / samhengi: ${input.hint?.trim() || "almennt starfsfólk"}\n\nDragðu reglurnar út úr samningnum hér að ofan.` },
        ],
      }],
    });
    const msg = await stream.finalMessage();
    if (msg.stop_reason === "refusal") return { ...empty, error: "AI hafnaði að lesa skjalið." };
    if (msg.stop_reason === "max_tokens") return { ...empty, error: "Samningurinn var of langur til að klára — prófaðu að hlaða upp aðeins viðeigandi köflum." };
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { ...empty, error: "Ekkert svar frá AI" };
    const p = stripUnset(JSON.parse(block.text)) as Omit<AgreementResult, "ok" | "live">;
    return { ok: true, live: true, name: p.name, explanation: p.explanation, rules: p.rules ?? {}, sources: p.sources ?? [], missing: p.missing ?? [] };
  } catch (e) {
    if (e instanceof Anthropic.RateLimitError) return { ...empty, error: "AI er upptekið — reyndu aftur eftir smá stund." };
    if (e instanceof Anthropic.BadRequestError) {
      console.error("readAgreement bad request", e.message);
      return { ...empty, error: "Skjalið var ekki hægt að lesa (of stórt eða ógilt PDF)." };
    }
    console.error("readAgreement", e);
    return { ...empty, error: "Tókst ekki að lesa samninginn." };
  }
}
