import "server-only";

// AI les kjarasamning (PDF eða texta) og fyllir út reglusniðmát (RuleSet) — með
// orðréttri tilvitnun og staðsetningu (bls./grein) fyrir HVERT gildi, svo
// stjórnandi geti borið hvert gildi saman við samninginn áður en hann vistar.
// Ekkert er vistað hér: UI sýnir tillöguna og aðeins „Vista sniðmát“ gildir.
//
// Líkan: modelFor("analysis") (src/lib/ai/models.ts).
// Citations-fídus API-sins er ósamrýmanlegur structured outputs, svo tilvitnanir
// koma í `sources` í skemanu og UI merkir þær sem „til yfirferðar“.

import Anthropic from "@anthropic-ai/sdk";
import { modelFor } from "@/lib/ai/models";
import type { RuleSet } from "@/lib/rules";
import type { CustomRules } from "@/lib/payrules";
import { strictSchema, stripUnset } from "./schema";
import { recordAiUsage } from "@/lib/ai/usage.server";

export type AgreementSource = { field: string; value: string; quote: string; location: string };
export type AgreementResult = {
  ok: boolean;
  live: boolean;
  name: string;
  explanation: string;
  rules: RuleSet;
  sources: AgreementSource[];
  missing: string[];
  /** Nákvæm launaregla (form launavélarinnar) — DRÖG sem stjórnandi yfirfer í ritlinum. */
  engine?: CustomRules;
  /** Orlofsþrep úr samningnum. */
  orlof?: { days: number; pct: number; condition: string }[];
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
  engine: obj({
    dayStart: { type: "integer", description: "Klukkustund sem dagvinna hefst virka daga (t.d. 8)" },
    dayEnd: { type: "integer", description: "Klukkustund sem dagvinnu lýkur virka daga (t.d. 17)" },
    nightEnd: { type: "integer", description: "Klukkustund sem næturálag virka daga endar (t.d. 8 ef 00–08)" },
    eve: { type: "number", description: "% álag virka daga utan dagvinnu (kvöld). Í dagvinnusamningi: yfirvinnu-/eftirvinnu-% sem greitt er utan dagvinnu" },
    night: { type: "number", description: "% álag virka daga 00:00–nightEnd" },
    weekend: { type: "number", description: "% álag laugardaga og sunnudaga" },
    fridagur: { type: "number", description: "% álag á almennum frídögum EF það er annað en helgarálag" },
    holiday: { type: "number", description: "% álag á stórhátíðardögum" },
    overtime: { type: "number", description: "% yfirvinnuálag (yfirvinna 2 ef þrepin eru tvö) ofan á dagvinnutímakaup — umreiknað: % af mánaðarlaunum × deilitala − 100" },
    otWeekly: { type: "number", description: "Klst. á viku sem yfirvinna (2) tekur við" },
    otMonthly: { type: "number", description: "Klst. á mánuði sem yfirvinna tekur við, ef samningurinn miðar við mánuð" },
    ot1Weekly: { type: "number", description: "Klst. á viku sem lægra yfirvinnuþrep (yfirvinna 1) tekur við" },
    ot1Pct: { type: "number", description: "% yfirvinna 1" },
    graceMin: { type: "number", description: "Svigrúm í mínútum við upphaf/lok dagvinnu ef samningurinn tilgreinir" },
    restHours: { type: "number", description: "Lágmarkshvíld milli vakta í klst." },
    bands: { type: "array", description: "Álög sem passa ekki í reitina að ofan (t.d. 55 % kl. 00–05 aðfaranótt lau/sun). days: 0=sun … 6=lau", items: obj({ label: str, days: { type: "array", items: { type: "integer" } }, from: str, to: str, pct: num }, ["label", "days", "from", "to", "pct"]) },
  }),
  orlof: { type: "array", description: "Orlofsþrep: dagar, orlofs-% og skilyrði (starfsaldur, aldur, fagnám)", items: obj({ days: num, pct: num, condition: str }, ["days", "pct", "condition"]) },
  sources: {
    type: "array",
    description: "EIN færsla fyrir hvert gildi sem sett var í rules og engine",
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
- "engine" er sama regla á formi launavélarinnar: dagvinnugluggi virka daga, % álag eftir tíma, yfirvinnumörk og -% (umreiknað í álag ofan á dagvinnutímakaup með deilitölu samningsins), stórhátíðarálag. Fylltu það út ef samningurinn leyfir — sama regla um tilvitnanir (field t.d. "engine.eve").
- Ef samningurinn hefur bæði dagvinnu- og vaktavinnureglur, notaðu þá sem á við hlutverkið og nefndu hina í "notes".
- Skrifaðu explanation og notes á íslensku. Þetta er tillaga sem stjórnandi yfirfer — ekki lögfræðiráðgjöf.`;

/** AI-drög → launaregla. Vantar grunngildi = 0 (stjórnandi sér það í ritlinum og „missing“). */
function toEngine(e: Partial<CustomRules> | undefined): CustomRules | undefined {
  if (!e) return undefined;
  const n = (v: unknown) => (typeof v === "number" && Number.isFinite(v) && v >= 0 ? v : undefined);
  const h = (v: unknown) => { const x = n(v); return x != null && x <= 24 ? Math.round(x) : undefined; };
  const okTime = (t: unknown) => typeof t === "string" && /^\d{1,2}:\d{2}$/.test(t);
  const bands = (e.bands ?? []).filter((b) => b && okTime(b.from) && okTime(b.to) && n(b.pct) != null)
    .map((b) => ({ label: String(b.label || "Álag").slice(0, 60), days: (b.days ?? []).filter((d) => d >= 0 && d <= 6), from: b.from, to: b.to, pct: b.pct }))
    .filter((b) => b.days.length);
  const out: CustomRules = {
    eve: n(e.eve) ?? 0, night: n(e.night) ?? n(e.eve) ?? 0, weekend: n(e.weekend) ?? 0, holiday: n(e.holiday) ?? 0, overtime: n(e.overtime) ?? 0,
    dayStart: h(e.dayStart), dayEnd: h(e.dayEnd), nightEnd: h(e.nightEnd), fridagur: n(e.fridagur),
    otWeekly: n(e.otWeekly), otMonthly: n(e.otMonthly), ot1Weekly: n(e.ot1Weekly), ot1Pct: n(e.ot1Pct),
    graceMin: n(e.graceMin), restHours: n(e.restHours), ...(bands.length ? { bands } : {}),
  };
  for (const k of Object.keys(out) as (keyof CustomRules)[]) if (out[k] === undefined) delete out[k];
  return out;
}

export async function readAgreement(input: { pdfBase64?: string; text?: string; hint?: string }, opts: { demo?: boolean } = {}): Promise<AgreementResult> {
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
      model: modelFor("analysis", opts),
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
    await recordAiUsage({ model: msg.model, usage: msg.usage, feature: "agreement" });
    if (msg.stop_reason === "refusal") return { ...empty, error: "AI hafnaði að lesa skjalið." };
    if (msg.stop_reason === "max_tokens") return { ...empty, error: "Samningurinn var of langur til að klára — prófaðu að hlaða upp aðeins viðeigandi köflum." };
    const block = msg.content.find((b) => b.type === "text");
    if (!block || block.type !== "text") return { ...empty, error: "Ekkert svar frá AI" };
    const p = stripUnset(JSON.parse(block.text)) as Omit<AgreementResult, "ok" | "live">;
    return { ok: true, live: true, name: p.name, explanation: p.explanation, rules: p.rules ?? {}, sources: p.sources ?? [], missing: p.missing ?? [], engine: toEngine(p.engine as Partial<CustomRules> | undefined), orlof: p.orlof ?? [] };
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
