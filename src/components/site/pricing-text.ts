// Allur texti verðsíðunnar (/verd) á íslensku og ensku. Tölurnar sjálfar koma úr src/lib/plans.ts
// og eru settar inn í textann með föllum (m = krónur á tungumáli síðunnar, t.d. „9.990 kr“ / „ISK 9,990“).
import type { SiteLang } from "./lang";
import { AI_PACK, type TeamPlanId } from "@/lib/plans";

type Money = (n: number) => string;
/** Lína undir verði leiðar: (krónur, innifaldir starfsmenn, verð á hvern umfram). */
type Inc = (m: Money, included: number, extra: number) => string;
/** Lína í lista leiðar: [texti, 1 = fylgir | 0 = fylgir ekki | 2 = millifyrirsögn]. */
type Feat = [string, 0 | 1 | 2];
/** Gildi í samanburðartöflu: 1 = já, 0 = nei, texti = birt eins og er. */
type Cell = 0 | 1 | string;

const is = {
  metaTitle: "VAKTO: Verð",
  metaDesc: "Vaktaplanið er frítt fyrir allt að 5 starfsmenn. Grunnur frá 9.990 kr á mánuði með launum, appi og stimpilklukku. Öll verð opin, engin binding.",
  skip: "Fara beint í efni",
  eyebrow: "Verð",
  h1a: "Vaktaplanið er frítt.", h1b: "Launin reiknast sjálf.",
  lede: "Byrjaðu frítt. Veldu leið eftir stærð og borgaðu aðeins fyrir þá sem unnu í mánuðinum. Engin binding, engin falin gjöld.",
  billing: "Greiðslutímabil", monthly: "Mánaðarlega", yearly: "Árlega", save: "−15%",
  perMo: "kr/mán", vat: "Án VSK",
  yearlyNote: (m: Money, n: number) => `Greitt árlega: ${m(n)} á ári`,
  popular: "Vinsælast",
  aiLine: (q: number) => `VAKTO AI, ${q} spurningar á mánuði`,
  plans: {
    free: {
      name: "Frítt", for: "Fyrir allra minnstu staðina. Bara vaktaplanið.",
      inc: ((_m, n) => `Allt að ${n} starfsmenn · 1 staður · á vefnum`) as Inc,
      btn: "Byrja frítt", href: "/nyskraning?plan=free",
      f: [["Vaktaplan á vefnum", 1], ["Deila plani sem PDF eða hlekk", 1], ["Vaktir í tölvupósti", 1], ["App fyrir starfsfólk", 0], ["Stimpilklukka", 0], ["Spjall, beiðnir og fréttaveita", 0], ["Laun og samningar", 0], ["VAKTO AI", 0]] as Feat[],
    },
    grunnur: {
      name: "Grunnur", for: "Kaffihús, bakarí og litlar verslanir.",
      inc: ((m, n, x) => `${n} starfsmenn innifaldir · +${m(x)} á hvern umfram`) as Inc,
      btn: "Prófa frítt í 14 daga", href: "/nyskraning?plan=grunnur",
      f: [["Allt í Fríu, og:", 2], ["App fyrir starfsfólk", 1], ["Stimpilklukka í síma og spjaldtölvu", 1], ["Spjall, beiðnir og fréttaveita", 1], ["Launakeyrsla, launaseðlar og Payday", 1], ["Samningar með undirritun", 1], ["Laun % af veltu og skýrslur", 1]] as Feat[],
    },
    voxtur: {
      name: "Vöxtur", for: "Veitingastaðir og verslanir með fleiri vaktir.",
      inc: ((m, n, x) => `${n} starfsmenn innifaldir · +${m(x)} á hvern umfram`) as Inc,
      btn: "Prófa frítt í 14 daga", href: "/nyskraning?plan=voxtur",
      f: [["Allt í Grunni, og:", 2], ["Fleiri staðir og deildir", 1], ["AI setur upp vaktaplanið", 1], ["Vaktarar og skýrslur í pósti", 1], ["Vinnuyfirlit og starfslok", 1]] as Feat[],
    },
    rekstur: {
      name: "Rekstur", for: "Hótel, keðjur og stærri vinnustaðir.",
      inc: ((m, n, x) => `${n} starfsmenn innifaldir · +${m(x)} á hvern umfram`) as Inc,
      btn: "Tala við okkur", href: "mailto:hallo@vakto.is?subject=VAKTO%20Rekstur",
      f: [["Allt í Vexti, og:", 2], ["Forgangsþjónusta", 1], ["Aðstoð við innleiðingu", 1], ["Sérsniðnar launareglur", 1], ["Sami tengiliður hjá VAKTO", 1]] as Feat[],
    },
  } satisfies Record<TeamPlanId, unknown>,
  under: [
    "Virkur starfsmaður = var á vakt eða stimplaði sig inn í mánuðinum. Þú borgar ekki fyrir þá sem unnu ekki.",
    "14 daga frí prufa á Vexti. Engin binding. Ekkert kort fyrir Frítt.",
  ],
  quote: (n: number) => `Fleiri en ${n} starfsmenn?`, quoteGo: "Við gerum tilboð",

  calcH: "Hvað kostar VAKTO fyrir þig?", calcP: "Dragðu til og sjáðu hvaða leið hentar og hvað hún kostar á mánuði.",
  empL: "Virkir starfsmenn í mánuðinum", aiL: "Spurningar til VAKTO AI á mánuði",
  aiHint: "Flest kaffihús og veitingastaðir spyrja VAKTO AI 10–40 sinnum í mánuði.",
  yourPlan: "Ódýrasta leiðin fyrir þig", perMonth: "á mánuði án VSK", perEmp: (s: string) => `${s} á starfsmann`,
  rowBase: (name: string, yearly: boolean) => `${name}${yearly ? " (greitt árlega)" : ""}`,
  rowExtra: (n: number, m: Money, x: number) => `${n} starfsm. umfram × ${m(x)}`,
  rowAi: (n: number) => `${n} × ${AI_PACK.questions} AI-spurningar`,
  freeNote: "Frítt dugar: allt að 5 starfsmenn og ekkert VAKTO AI.",
  overQuote: (n: number) => `Yfir ${n} starfsmönnum gerum við tilboð. Talan sýnir verðið samkvæmt verðskrá.`,
  crossH: "Hvenær borgar sig að fara upp?",
  cross: (a: number, b: number) => `Vöxtur verður ódýrari en Grunnur þegar starfsmenn eru orðnir ${a}, og Rekstur ódýrari en Vöxtur þegar þeir eru orðnir ${b}.`,

  addH: "Borgaðu aðeins fyrir það sem þú notar.", addP: "Engar óvæntar færslur. Þú stjórnar sjálf(ur) hvað bætist við.",
  adds: {
    emp: { h: "Fleiri starfsmenn", p: (m: Money, lo: number) => `frá ${m(lo)}`, d: "á hvern virkan starfsmann umfram það sem fylgir leiðinni. Sumarstarfsfólk kostar ekkert þá mánuði sem það vinnur ekki." },
    ai: { h: "Meira VAKTO AI", p: (m: Money, x: number) => m(x), d: (q: number) => `fyrir hverjar ${q} spurningar umfram. Aðeins ef stjórnandi kveikir á viðbótinni, og hann setur sjálfur hámark á mánuði.` },
    sign: { h: "Rafræn skilríki", p: (m: Money, x: number) => m(x), d: "á hverja undirskrift með rafrænum skilríkjum. Undirritun með kóða í tölvupósti er alltaf innifalin." },
    year: { h: "Árgreiðsla", p: () => "−15%", d: "af grunnverði og verði á starfsmann ef greitt er fyrir árið í einu." },
  },

  cmpH: "Hvað fylgir hverri leið.", cmpHint: "Strjúktu til hliðar til að sjá allar leiðir.",
  yes: "Fylgir", no: "Fylgir ekki",
  cmp: [
    { g: "Verð", rows: "price" as const },
    { g: "Vaktir og tími", rows: [
      ["Vaktaplan á vefnum", 1, 1, 1, 1],
      ["Deila plani sem PDF eða hlekk", 1, 1, 1, 1],
      ["Vaktir í tölvupósti", 1, 1, 1, 1],
      ["App fyrir starfsfólk (íslenska, enska, víetnamska)", 0, 1, 1, 1],
      ["Stimpilklukka í síma og spjaldtölvu", 0, 1, 1, 1],
      ["Fleiri staðir og deildir", 0, 0, 1, 1],
      ["AI setur upp vaktaplanið", 0, 0, 1, 1],
    ] as [string, Cell, Cell, Cell, Cell][] },
    { g: "Laun og samningar", rows: [
      ["Launakeyrsla eftir kjarasamningi", 0, 1, 1, 1],
      ["Launaseðlar og tenging við Payday", 0, 1, 1, 1],
      ["Ráðningarsamningar með undirritun", 0, 1, 1, 1],
      ["Vinnuyfirlit og starfslok", 0, 0, 1, 1],
      ["Sérsniðnar launareglur", 0, 0, 0, 1],
    ] as [string, Cell, Cell, Cell, Cell][] },
    { g: "Samskipti og innsýn", rows: [
      ["Spjall, beiðnir og fréttaveita", 0, 1, 1, 1],
      ["Laun % af veltu og skýrslur", 0, 1, 1, 1],
      ["Vaktarar og skýrslur í pósti", 0, 0, 1, 1],
    ] as [string, Cell, Cell, Cell, Cell][] },
    { g: "Þjónusta", rows: [
      ["Hjálp í spjalli og tölvupósti", 1, 1, 1, 1],
      ["Forgangsþjónusta", 0, 0, 0, 1],
      ["Aðstoð við innleiðingu", 0, 0, 0, 1],
      ["Sami tengiliður hjá VAKTO", 0, 0, 0, 1],
    ] as [string, Cell, Cell, Cell, Cell][] },
  ],
  cmpBase: "Grunnverð á mánuði", cmpInc: "Starfsmenn innifaldir", cmpExtra: "Hver starfsmaður umfram", cmpAi: "VAKTO AI, spurningar á mánuði",
  cmpMax: (n: number) => `allt að ${n}`, cmpFree: "0 kr", cmpNone: "Ekki hægt",

  faqH: "Algengar spurningar.",
  faq: (m: Money) => [
    ["Hvað telst virkur starfsmaður?", "Starfsmaður sem var á vakt eða stimplaði sig inn í mánuðinum. Skráð starfsfólk sem vinnur ekki, t.d. sumarstarfsfólk yfir veturinn, kostar ekkert þá mánuði."],
    ["Get ég skipt um leið?", "Já, hvenær sem er í Stillingum, upp eða niður. Ef starfsfólkinu fjölgar segir VAKTO þér þegar næsta leið verður ódýrari."],
    ["Hvað gerist ef AI-spurningarnar klárast?", `VAKTO AI hvílir til næstu mánaðamóta. Allt annað í kerfinu virkar áfram. Stjórnandi getur kveikt á viðbót, ${m(AI_PACK.price)} fyrir hverjar ${AI_PACK.questions} spurningar, og sett hámark á mánuði svo reikningurinn komi aldrei á óvart.`],
    ["Er binding?", "Nei. Þú segir upp í Stillingum og áskriftin gildir út greitt tímabil. Árgreiðsla gefur 15% afslátt."],
    ["Fylgir launakeyrslan kjarasamningum?", "Já. Álag, yfirvinna, orlof og uppbætur eru reiknuð eftir kjarasamningi hvers starfsmanns, og tímarnir fara beint í Payday eða út í Excel og DK."],
    ["Er Frítt í alvöru frítt?", "Já. Fyrir allt að 5 starfsmenn á einum stað, án tímamarka og án korts. Þú færð vaktaplanið á vefnum, getur deilt því sem PDF eða hlekk og starfsfólkið fær vaktirnar í tölvupósti. App, stimpilklukka og laun fylgja frá Grunni."],
    ["Hvað gerist með núverandi áskrift?", "Núverandi viðskiptavinir halda eldra verði í 12 mánuði ef það er lægra. Við látum vita með fyrirvara áður en nokkuð breytist."],
    ["Hvernig virkar prufan?", "Í 14 daga færðu allt sem fylgir Vexti, frítt. Að prufunni lokinni velur þú leið, eða ferð á Frítt ef það dugar."],
  ] as [string, string][],

  endH: "Byrjaðu frítt í dag.", endP: "Ekkert kort. Settu upp fyrsta vaktaplanið á tíu mínútum.", endBtn: "Stofna aðgang",
  endOr: "Spurningar um verð? ", fine: "Öll verð eru í íslenskum krónum, á mánuði og án VSK.",
};

const en: typeof is = {
  metaTitle: "VAKTO: Pricing",
  metaDesc: "The schedule is free for up to 5 employees. Grunnur from ISK 9,990 a month with payroll, the app and the time clock. Open pricing, no commitment.",
  skip: "Skip to content",
  eyebrow: "Pricing",
  h1a: "The schedule is free.", h1b: "Payroll runs itself.",
  lede: "Start free. Pick a plan by size and only pay for the people who worked that month. No commitment, no hidden fees.",
  billing: "Billing period", monthly: "Monthly", yearly: "Yearly", save: "−15%",
  perMo: "ISK/mo", vat: "Excl. VAT",
  yearlyNote: (m: Money, n: number) => `Billed yearly: ${m(n)} a year`,
  popular: "Most popular",
  aiLine: (q: number) => `VAKTO AI, ${q} questions a month`,
  plans: {
    free: {
      name: "Free", for: "For the very smallest places. Just the schedule.",
      inc: ((_m, n) => `Up to ${n} employees · 1 location · web only`) as Inc,
      btn: "Start free", href: "/nyskraning?plan=free",
      f: [["Schedule on the web", 1], ["Share the schedule as PDF or link", 1], ["Shifts by email", 1], ["App for staff", 0], ["Time clock", 0], ["Chat, requests and news feed", 0], ["Payroll and contracts", 0], ["VAKTO AI", 0]],
    },
    grunnur: {
      name: "Grunnur", for: "Cafés, bakeries and small shops.",
      inc: ((m, n, x) => `${n} employees included · +${m(x)} per extra`) as Inc,
      btn: "Try free for 14 days", href: "/nyskraning?plan=grunnur",
      f: [["Everything in Free, plus:", 2], ["App for staff", 1], ["Time clock on phone and tablet", 1], ["Chat, requests and news feed", 1], ["Payroll, payslips and Payday", 1], ["Contracts with e-signing", 1], ["Labor % of revenue and reports", 1]],
    },
    voxtur: {
      name: "Vöxtur", for: "Restaurants and shops with more shifts.",
      inc: ((m, n, x) => `${n} employees included · +${m(x)} per extra`) as Inc,
      btn: "Try free for 14 days", href: "/nyskraning?plan=voxtur",
      f: [["Everything in Grunnur, plus:", 2], ["More locations and departments", 1], ["AI builds the schedule", 1], ["Alerts and reports by email", 1], ["Work summaries and offboarding", 1]],
    },
    rekstur: {
      name: "Rekstur", for: "Hotels, chains and larger workplaces.",
      inc: ((m, n, x) => `${n} employees included · +${m(x)} per extra`) as Inc,
      btn: "Talk to us", href: "mailto:hallo@vakto.is?subject=VAKTO%20Rekstur",
      f: [["Everything in Vöxtur, plus:", 2], ["Priority support", 1], ["Help getting set up", 1], ["Custom pay rules", 1], ["One named contact at VAKTO", 1]],
    },
  },
  under: [
    "Active employee = was on a shift or clocked in during the month. You don't pay for people who didn't work.",
    "14-day free trial of Vöxtur. No commitment. No card for Free.",
  ],
  quote: (n: number) => `More than ${n} employees?`, quoteGo: "We'll make you an offer",

  calcH: "What will VAKTO cost you?", calcP: "Drag the sliders to see which plan fits and what it costs a month.",
  empL: "Active employees in the month", aiL: "Questions to VAKTO AI a month",
  aiHint: "Most cafés and restaurants ask VAKTO AI 10–40 times a month.",
  yourPlan: "Your cheapest plan", perMonth: "a month, excl. VAT", perEmp: (s: string) => `${s} per employee`,
  rowBase: (name: string, yearly: boolean) => `${name}${yearly ? " (billed yearly)" : ""}`,
  rowExtra: (n: number, m: Money, x: number) => `${n} extra employees × ${m(x)}`,
  rowAi: (n: number) => `${n} × ${AI_PACK.questions} AI questions`,
  freeNote: "Free is enough: up to 5 employees and no VAKTO AI.",
  overQuote: (n: number) => `Above ${n} employees we make you an offer. The figure shows the list price.`,
  crossH: "When does it pay to move up?",
  cross: (a: number, b: number) => `From about ${a} employees Vöxtur is cheaper than Grunnur, and from about ${b} Rekstur is cheaper than Vöxtur.`,

  addH: "Only pay for what you use.", addP: "No surprise charges. You decide what gets added.",
  adds: {
    emp: { h: "More employees", p: (m: Money, lo: number) => `from ${m(lo)}`, d: "per active employee above what the plan includes. Summer staff cost nothing in the months they don't work." },
    ai: { h: "More VAKTO AI", p: (m: Money, x: number) => m(x), d: (q: number) => `for every ${q} extra questions. Only if a manager turns the add-on on, with a monthly cap they set.` },
    sign: { h: "Electronic ID", p: (m: Money, x: number) => m(x), d: "per signature with electronic ID. Signing with an emailed code is always included." },
    year: { h: "Pay yearly", p: () => "−15%", d: "off the base price and per-employee price when you pay for the year up front." },
  },

  cmpH: "What each plan includes.", cmpHint: "Swipe sideways to see every plan.",
  yes: "Included", no: "Not included",
  cmp: [
    { g: "Price", rows: "price" as const },
    { g: "Shifts and time", rows: [
      ["Schedule on the web", 1, 1, 1, 1],
      ["Share the schedule as PDF or link", 1, 1, 1, 1],
      ["Shifts by email", 1, 1, 1, 1],
      ["App for staff (Icelandic, English, Vietnamese)", 0, 1, 1, 1],
      ["Time clock on phone and tablet", 0, 1, 1, 1],
      ["More locations and departments", 0, 0, 1, 1],
      ["AI builds the schedule", 0, 0, 1, 1],
    ] },
    { g: "Payroll and contracts", rows: [
      ["Payroll by union agreement", 0, 1, 1, 1],
      ["Payslips and Payday integration", 0, 1, 1, 1],
      ["Employment contracts with e-signing", 0, 1, 1, 1],
      ["Work summaries and offboarding", 0, 0, 1, 1],
      ["Custom pay rules", 0, 0, 0, 1],
    ] },
    { g: "Communication and insight", rows: [
      ["Chat, requests and news feed", 0, 1, 1, 1],
      ["Labor % of revenue and reports", 0, 1, 1, 1],
      ["Alerts and reports by email", 0, 0, 1, 1],
    ] },
    { g: "Support", rows: [
      ["Help by chat and email", 1, 1, 1, 1],
      ["Priority support", 0, 0, 0, 1],
      ["Help getting set up", 0, 0, 0, 1],
      ["One named contact at VAKTO", 0, 0, 0, 1],
    ] },
  ],
  cmpBase: "Base price a month", cmpInc: "Employees included", cmpExtra: "Each extra employee", cmpAi: "VAKTO AI questions a month",
  cmpMax: (n: number) => `up to ${n}`, cmpFree: "ISK 0", cmpNone: "Not possible",

  faqH: "Frequently asked questions.",
  faq: (m: Money) => [
    ["What counts as an active employee?", "An employee who was on a shift or clocked in during the month. Registered staff who don't work, like summer staff in winter, cost nothing in those months."],
    ["Can I switch plans?", "Yes, any time in Settings, up or down. If your team grows, VAKTO tells you when the next plan becomes cheaper."],
    ["What happens when the AI questions run out?", `VAKTO AI rests until the start of next month. Everything else keeps working. A manager can turn on the add-on, ${m(AI_PACK.price)} for every ${AI_PACK.questions} questions, and set a monthly cap so the bill is never a surprise.`],
    ["Is there a commitment?", "No. You cancel in Settings and the subscription runs to the end of the paid period. Paying yearly gives 15% off."],
    ["Does payroll follow Icelandic union agreements?", "Yes. Premiums, overtime, holiday pay and bonuses are calculated by each employee's agreement, and the hours go straight to Payday or out to Excel and DK."],
    ["Is Free really free?", "Yes. For up to 5 employees at one location, with no time limit and no card. You get the schedule on the web, can share it as PDF or link, and staff get their shifts by email. The app, time clock and payroll come with Grunnur."],
    ["What happens to my current subscription?", "Existing customers keep their old price for 12 months if it is lower. We'll let you know well in advance before anything changes."],
    ["How does the trial work?", "For 14 days you get everything in Vöxtur, free. When the trial ends you pick a plan, or move to Free if that's enough."],
  ],

  endH: "Start free today.", endP: "No card. Set up your first schedule in ten minutes.", endBtn: "Create account",
  endOr: "Questions about pricing? ", fine: "All prices are in Icelandic krónur, per month, excl. VAT.",
};

export const PRICING_TEXT: Record<SiteLang, typeof is> = { is, en };
