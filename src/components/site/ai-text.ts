// Textar markaðssíðunnar /ai (VAKTO AI). Sama mynstur og home-text.ts: einn hlutur per tungumál,
// svo da/sv/nb bætist við sem nýr lykill. AÐEINS það sem VAKTO AI gerir í raun:
// verkfærin í src/lib/ai/assistant-tools.ts (stjórnendur), employee-ai.server.ts (starfsfólk),
// agreement.ts (kjarasamningar), api/mcp (tengd forrit). Verð og fjöldi spurninga koma úr src/lib/plans.ts.

export type AiPageText = {
  hero: { eyebrow: string; h1a: string; h1b: string; lede: string; cta: string; cta2: string; note: (q: number) => string };
  mock: { bar: string; q: string; intro: string; rows: [string, string][]; ask: string; prop: string; confirm: string; done: string; foot: string };
  how: { eyebrow: string; h: string; hs: string; cols: { h: string; p: string; ex: string[] }[] };
  plan: { eyebrow: string; h: string; hs: string; p: string; ticks: string[]; note: string; mockH: string; mockRows: [string, string][]; mockFoot: string };
  guide: { eyebrow: string; h: string; hs: string; p: string; q1: string; a1: string[]; q2: string; a2: string; prop: string };
  staff: { eyebrow: string; h: string; hs: string; p: string; ex: { q: string; a: string }[]; note: string };
  pay: { eyebrow: string; h: string; hs: string; p: string; ticks: string[] };
  mcp: { eyebrow: string; h: string; hs: string; p: string; ticks: string[]; steps: string[] };
  safe: { eyebrow: string; h: string; items: { h: string; p: string }[] };
  price: { eyebrow: string; h: string; p: string; perMonth: string; questions: string; none: string; schedule: string; pack: (price: string, q: number) => string; staff: string; link: string };
  faq: { h: string; items: [string, string][] };
  final: { h1: string; h2: string; cta: string };
};

export const AI_TEXT: Record<"is" | "en", AiPageText> = {
  is: {
    hero: {
      eyebrow: "VAKTO AI",
      h1a: "AI sem gerir hlutina.",
      h1b: "Ekki bara segir þér hvar takkinn er.",
      lede: "Spurðu um reksturinn og fáðu svar með þínum tölum. Biddu um breytingu og VAKTO AI undirbýr hana. Ekkert breytist fyrr en þú ýtir á Staðfesta.",
      cta: "Prófa frítt í 14 daga",
      cta2: "Sjá dæmi",
      note: (q) => `Innifalið frá Grunni · ${q} spurningar á mánuði`,
    },
    mock: {
      bar: "VAKTO AI",
      q: "Hver gleymdi að stimpla sig út í gær?",
      intro: "Tvær stimplanir eru enn opnar frá 10. nóvember:",
      rows: [["Jón Pétursson", "inn 16:02 · vakt til 23:00"], ["Moon Kim", "inn 17:30 · vakt til 22:00"]],
      ask: "Á ég að loka þeim á áætluðum lokum vaktanna?",
      prop: "Setja útstimplun hjá Jóni 10. nóv. kl. 23:00 og hjá Moon kl. 22:00",
      confirm: "Staðfesta",
      done: "Gert",
      foot: "Les þín gögn · spyr áður en breytt er",
    },
    how: {
      eyebrow: "Þrennt sem VAKTO AI gerir",
      h: "Spyrðu. Biddu.",
      hs: "Láttu vita.",
      cols: [
        { h: "Spyrðu um reksturinn", p: "Svör með tölum úr kerfinu, aldrei ágiskun. Laun sem hlutfall af veltu, tímar, yfirvinna, veikindi og keyrð laun.",
          ex: ["Hvernig var október miðað við september?", "Hver vann mesta yfirvinnu í mánuðinum?", "Hvert er veikindahlutfallið eftir deildum?", "Hverjir eru á vakt núna og hver hefur ekki mætt?"] },
        { h: "Biddu um breytingu", p: "VAKTO AI skoðar stöðuna og leggur fram tillögu. Þú sérð hana og ýtir á Staðfesta, eða sleppir því.",
          ex: ["Opnaðu vaktir alla daga næstu viku milli 17 og 23.", "Samþykktu fríbeiðnina hennar Önnu.", "Sendu ráðningarsamninginn aftur á Pétur.", "Skrifaðu tilboð í baðherbergi, 8 fm, flísar og lagnir."] },
        { h: "Láttu vita sjálfkrafa", p: "Vaktarar og skýrslur sem þú setur upp með einni setningu. Þær koma í tölvupósti eða sem tilkynning.",
          ex: ["Láttu mig vita ef einhver fer yfir 180 tíma í mánuðinum.", "Minntu mig ef laun % fer yfir 32 % í vikunni.", "Sendu mér yfirvinnuskýrslu alla mánudaga.", "Sendu mér mætingarskýrslu síðasta mánaðar."] },
      ],
    },
    plan: {
      eyebrow: "Vaktaplanið",
      h: "Heil vika eða mánuður",
      hs: "í einni tillögu.",
      p: "Segðu hvað skiptir máli, eins og við vaktstjóra: „allir fá tvo frídaga og alltaf þrír á vakt í eldhúsinu“. VAKTO AI setur upp planið og segir hvað gekk ekki upp.",
      ticks: [
        "Virðir samþykkt frí og óframboð starfsfólks",
        "Minnst 11 klst. hvíld milli vakta og ein vakt á dag",
        "Notar vaktategundir, mönnunarþörf og launamarkmið fyrirtækisins",
        "Lærir af síðustu 8 vikum: bætir við þar sem oft er unnið umfram plan",
        "Man fastar reglur, t.d. „Bach tekur bara morgunvaktir“",
      ],
      note: "AI-vaktaplan fylgir Vexti og Rekstri.",
      mockH: "Tillaga · Eldhús, vika 47",
      mockRows: [["Vaktir", "21 vakt hjá 6 starfsmönnum"], ["Tímar", "168 klst."], ["Frídagar", "allir með minnst tvo"], ["Laun % af veltu", "áætlað 28,9 %"]],
      mockFoot: "Bætti við manni á föstudagskvöldum 18–22. Þar var unnið að meðaltali 6 klst. umfram plan.",
    },
    guide: {
      eyebrow: "Kann á kerfið",
      h: "Hvar er þetta aftur?",
      hs: "Spurðu bara.",
      p: "VAKTO AI þekkir hverja valmynd og hvern hnapp og vísar á réttan stað, skref fyrir skref. Ef eitthvað virðist bilað tekur hann vandann saman og sendir beiðni til þjónustuvers VAKTO, með samtalinu, þegar þú staðfestir.",
      q1: "Hvernig bæti ég við starfsmanni?",
      a1: ["Starfsfólk → „+ Nýr starfsmaður“", "Nafn og laun eru nauðsynleg, annað valfrjálst", "Með netfangi fær starfsmaðurinn boð í appið"],
      q2: "Payday-tengingin hafnar launakeyrslunni.",
      a2: "Ég get ekki lagað það héðan. Viltu að ég sendi þjónustuverinu lýsingu á vandanum?",
      prop: "Senda beiðni til þjónustuvers VAKTO (samtalið fylgir)",
    },
    staff: {
      eyebrow: "Fyrir starfsfólkið",
      h: "Líka í appinu",
      hs: "hjá starfsfólkinu.",
      p: "Starfsfólk spyr um sínar vaktir og tíma og finnur hver getur tekið vakt. VAKTO AI sér aldrei laun, kennitölur eða ástæður annarra.",
      ex: [
        { q: "Hvenær er ég á vakt um helgina?", a: "Laugardagur 16. nóv. 17:00–23:00. Enga vakt á sunnudag." },
        { q: "Hver getur tekið laugardagsvaktina mína?", a: "Anna og Bach eru lausar og ná 11 klst. hvíld. Á ég að senda vaktstjóra beiðni um vaktaskipti?" },
        { q: "Hvað er ég búin að vinna marga tíma í mánuðinum?", a: "86,5 klst. í 12 stimplunum frá 1. nóvember." },
      ],
      note: "Spurningar starfsfólks teljast ekki með í spurningum fyrirtækisins.",
    },
    pay: {
      eyebrow: "Laun og kjarasamningar",
      h: "Les kjarasamninginn",
      hs: "svo þú þurfir þess ekki.",
      p: "Hladdu upp kjarasamningi sem PDF og VAKTO AI fyllir út launareglurnar: álag, yfirvinnu, uppbætur og launaflokka. Hvert gildi fylgir orðréttri tilvitnun og grein, svo þú berir saman áður en þú vistar.",
      ticks: [
        "Orðrétt tilvitnun og staðsetning (bls., grein) fyrir hvert gildi",
        "Segir hvað samningurinn tilgreinir ekki og þarf að fylla inn",
        "Flettir upp gildandi launatöflu á vef stéttarfélagsins, með heimild",
        "„Er Jón á réttum launum?“ ber laun hans saman við töfluna",
      ],
    },
    mcp: {
      eyebrow: "Tengd forrit",
      h: "Notaðu gögnin í Claude",
      hs: "eða ChatGPT.",
      p: "Viltu frekar spyrja í þínu eigin gervigreindarforriti? Tengdu VAKTO við Claude, ChatGPT eða önnur forrit sem styðja MCP, og spurðu um tíma, laun % og vaktaplan þar.",
      ticks: [
        "Aðeins lestur: forritin geta engu breytt",
        "Fá aldrei kennitölur, bankareikninga eða heimilisföng",
        "Eigandinn kveikir og slekkur, og sér hverjir hafa tengst",
      ],
      steps: ["Stillingar → Tengingar → Tengd forrit", "Afritaðu slóðina í forritið", "Skráðu þig inn með VAKTO og samþykktu"],
    },
    safe: {
      eyebrow: "Öryggi",
      h: "Ekkert breytist án þín.",
      items: [
        { h: "Spyr alltaf fyrst", p: "Hver breyting er tillaga með Staðfesta-hnappi. VAKTO AI segir aldrei að eitthvað sé gert fyrr en þú hefur staðfest." },
        { h: "Sér bara það sem þú mátt sjá", p: "VAKTO AI notar sama aðgang og þú. Vaktstjóri fær ekki svör um það sem aðeins stjórnandi sér, og starfsfólk sér bara sitt." },
        { h: "Allt skráð", p: "Staðfestar breytingar fara í aðgerðaskrá fyrirtækisins, merktar VAKTO AI." },
        { h: "Gögnin þín", p: "Gögn VAKTO eru hýst í Evrópu og aðgangi stýrt per fyrirtæki. VAKTO AI sækir aðeins það sem þarf til að svara hverju sinni." },
      ],
    },
    price: {
      eyebrow: "Verð",
      h: "Innifalið í áskriftinni.",
      p: "VAKTO AI fylgir öllum greiddum leiðum. Spurningar á mánuði eftir leið:",
      perMonth: "kr./mán.",
      questions: "spurningar",
      none: "ekki innifalið",
      schedule: "AI-vaktaplan",
      pack: (price, q) => `Þarftu fleiri? Viðbótarpakki: ${q} spurningar fyrir ${price} kr. Þú setur sjálfur hámark á mánuði.`,
      staff: "Spurningar starfsfólks í appinu teljast ekki með.",
      link: "Sjá allar leiðir",
    },
    faq: {
      h: "Spurt og svarað",
      items: [
        ["Getur VAKTO AI breytt einhverju án þess að ég viti?", "Nei. Allar breytingar eru tillögur sem þú staðfestir með hnappi. Fyrir það er ekkert sent, vistað eða birt."],
        ["Hvaðan koma tölurnar?", "Beint úr VAKTO: stimplanir, vaktaplan, velta, launakeyrslur og beiðnir. VAKTO AI giskar ekki á tölur; ef gögn vantar segir hann það."],
        ["Hvar finn ég VAKTO AI?", "Neðst í horninu á vefnum (eða ⌘J) og í appinu. Stjórnendur og vaktstjórar fá allt; starfsfólk fær sína útgáfu í appinu."],
        ["Á hvaða tungumálum virkar hann?", "Íslensku, ensku, pólsku og víetnömsku. Hann svarar á því máli sem þú skrifar á."],
        ["Hvað gerist þegar spurningarnar klárast?", "VAKTO AI hvílir til næstu mánaðamóta en allt annað í VAKTO virkar áfram. Þú getur líka bætt við pakka."],
        ["Kemur hann í stað bókarans eða launafulltrúans?", "Nei. Hann sparar tíma og finnur frávik, en taktu mikilvægar ákvarðanir um laun og samninga sjálfur."],
      ],
    },
    final: { h1: "Prófaðu að spyrja.", h2: "Með þínum gögnum.", cta: "Byrja frítt" },
  },
  en: {
    hero: {
      eyebrow: "VAKTO AI",
      h1a: "AI that gets things done.",
      h1b: "Not just tells you where the button is.",
      lede: "Ask about the business and get answers with your own numbers. Ask for a change and VAKTO AI prepares it. Nothing changes until you press Confirm.",
      cta: "Try free for 14 days",
      cta2: "See examples",
      note: (q) => `Included from Grunnur · ${q} questions a month`,
    },
    mock: {
      bar: "VAKTO AI",
      q: "Who forgot to clock out yesterday?",
      intro: "Two punches are still open from 10 November:",
      rows: [["Jón Pétursson", "in 16:02 · shift until 23:00"], ["Moon Kim", "in 17:30 · shift until 22:00"]],
      ask: "Shall I close them at the planned end of their shifts?",
      prop: "Set clock-out for Jón on 10 Nov at 23:00 and for Moon at 22:00",
      confirm: "Confirm",
      done: "Done",
      foot: "Reads your data · asks before changing anything",
    },
    how: {
      eyebrow: "Three things VAKTO AI does",
      h: "Ask. Request.",
      hs: "Get notified.",
      cols: [
        { h: "Ask about the business", p: "Answers with numbers from the system, never guesses. Labor as a share of revenue, hours, overtime, sick leave and payroll.",
          ex: ["How did October compare to September?", "Who worked the most overtime this month?", "What is the sick rate by department?", "Who is on shift now, and who hasn't shown up?"] },
        { h: "Ask for a change", p: "VAKTO AI checks the situation and makes a proposal. You see it and press Confirm, or skip it.",
          ex: ["Open shifts every day next week from 17 to 23.", "Approve Anna's time-off request.", "Resend the employment contract to Pétur.", "Write a quote for a bathroom, 8 m², tiles and plumbing."] },
        { h: "Get notified automatically", p: "Alerts and reports you set up in one sentence. They arrive by email or as a notification.",
          ex: ["Tell me if anyone goes over 180 hours this month.", "Alert me if labor % goes over 32% this week.", "Email me an overtime report every Monday.", "Email me last month's attendance report."] },
      ],
    },
    plan: {
      eyebrow: "Scheduling",
      h: "A full week or month",
      hs: "in one proposal.",
      p: "Say what matters, the way you would to a shift manager: \"everyone gets two days off and there are always three in the kitchen\". VAKTO AI builds the schedule and tells you what didn't work out.",
      ticks: [
        "Respects approved time off and staff unavailability",
        "At least 11 hours of rest between shifts, one shift a day",
        "Uses your shift types, staffing needs and labor target",
        "Learns from the last 8 weeks: adds cover where you regularly run over",
        "Remembers standing rules, e.g. \"Bach only does mornings\"",
      ],
      note: "AI scheduling is included in Vöxtur and Rekstur.",
      mockH: "Proposal · Kitchen, week 47",
      mockRows: [["Shifts", "21 shifts for 6 people"], ["Hours", "168 hrs"], ["Days off", "everyone has at least two"], ["Labor % of revenue", "est. 28.9%"]],
      mockFoot: "Added a person on Friday evenings 18–22. On average 6 hours were worked over plan there.",
    },
    guide: {
      eyebrow: "Knows the system",
      h: "Where was that again?",
      hs: "Just ask.",
      p: "VAKTO AI knows every menu and button and points you to the right place, step by step. If something seems broken, it sums up the problem and sends a request to VAKTO support, with the conversation, once you confirm.",
      q1: "How do I add an employee?",
      a1: ["Staff → \"+ New employee\"", "Only name and pay are required", "With an email, they get an app invite"],
      q2: "The Payday connection rejects the payroll run.",
      a2: "I can't fix that from here. Shall I send support a description of the problem?",
      prop: "Send a request to VAKTO support (conversation attached)",
    },
    staff: {
      eyebrow: "For your staff",
      h: "In the app, too",
      hs: "for your staff.",
      p: "Staff ask about their own shifts and hours and find who can cover a shift. VAKTO AI never sees other people's pay, ID numbers or reasons.",
      ex: [
        { q: "When am I working this weekend?", a: "Saturday 16 Nov 17:00–23:00. No shift on Sunday." },
        { q: "Who can take my Saturday shift?", a: "Anna and Bach are free and get 11 hours of rest. Shall I send your manager a swap request?" },
        { q: "How many hours have I worked this month?", a: "86.5 hours over 12 punches since 1 November." },
      ],
      note: "Staff questions don't count towards the company's questions.",
    },
    pay: {
      eyebrow: "Pay and agreements",
      h: "Reads the collective agreement",
      hs: "so you don't have to.",
      p: "Upload a collective agreement as a PDF and VAKTO AI fills in the pay rules: premiums, overtime, supplements and pay grades. Every value comes with a verbatim quote and clause, so you can check before you save.",
      ticks: [
        "Verbatim quote and location (page, clause) for every value",
        "Lists what the agreement doesn't specify, for you to fill in",
        "Looks up the current wage table on the union's website, with a source",
        "\"Is Jón paid correctly?\" compares his pay to the table",
      ],
    },
    mcp: {
      eyebrow: "Connected apps",
      h: "Use your data in Claude",
      hs: "or ChatGPT.",
      p: "Prefer asking in your own AI app? Connect VAKTO to Claude, ChatGPT or any app that supports MCP, and ask about hours, labor % and schedules there.",
      ticks: [
        "Read only: the apps can't change anything",
        "Never get ID numbers, bank accounts or addresses",
        "The owner turns it on and off, and sees who has connected",
      ],
      steps: ["Settings → Integrations → Connected apps", "Copy the URL into the app", "Sign in with VAKTO and approve"],
    },
    safe: {
      eyebrow: "Security",
      h: "Nothing changes without you.",
      items: [
        { h: "Always asks first", p: "Every change is a proposal with a Confirm button. VAKTO AI never says something is done before you have confirmed it." },
        { h: "Sees only what you can see", p: "VAKTO AI uses the same access as you. A shift manager gets no answers about what only the owner can see, and staff see only their own." },
        { h: "Everything is logged", p: "Confirmed changes go into the company's audit log, marked VAKTO AI." },
        { h: "Your data", p: "VAKTO data is hosted in Europe with access controlled per company. VAKTO AI fetches only what it needs to answer each question." },
      ],
    },
    price: {
      eyebrow: "Pricing",
      h: "Included in your plan.",
      p: "VAKTO AI comes with every paid plan. Questions per month by plan:",
      perMonth: "ISK/mo",
      questions: "questions",
      none: "not included",
      schedule: "AI scheduling",
      pack: (price, q) => `Need more? Add-on pack: ${q} questions for ${price} ISK. You set your own monthly cap.`,
      staff: "Staff questions in the app don't count.",
      link: "See all plans",
    },
    faq: {
      h: "Questions and answers",
      items: [
        ["Can VAKTO AI change anything without me knowing?", "No. Every change is a proposal you confirm with a button. Until then nothing is sent, saved or published."],
        ["Where do the numbers come from?", "Straight from VAKTO: punches, schedules, revenue, payroll runs and requests. VAKTO AI doesn't guess numbers; if data is missing, it says so."],
        ["Where do I find VAKTO AI?", "In the bottom corner on the web (or ⌘J) and in the app. Owners and managers get everything; staff get their own version in the app."],
        ["Which languages does it speak?", "Icelandic, English, Polish and Vietnamese. It answers in the language you write in."],
        ["What happens when the questions run out?", "VAKTO AI rests until the start of next month, and everything else in VAKTO keeps working. You can also add a pack."],
        ["Does it replace the bookkeeper or payroll officer?", "No. It saves time and finds discrepancies, but make important decisions about pay and agreements yourself."],
      ],
    },
    final: { h1: "Try asking.", h2: "With your own data.", cta: "Start free" },
  },
};
