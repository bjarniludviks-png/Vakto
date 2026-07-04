// Content dictionaries ported from prototypes/vakto-heimasida.html (I18N/FEAT/FLOW/PRICE/FAQ).
export type Lang = "is" | "en";

export const I18N = {
  is: {
    nav_features: "Eiginleikar", nav_how: "Hvernig það virkar", nav_integrations: "Tengingar", nav_pricing: "Verð", nav_login: "Innskráning", nav_try: "Byrja",
    hero_badge: "Vöktun, tímaskráning & vinnuafls-arðsemi á einum stað",
    hero_title: 'Einfaldasta vakta- og tímaskráningarkerfið — <span class="g">sem allir elska</span>.',
    hero_sub: "Geggjað einfalt vaktaplan og tímaskráning, mælaborð með launahlutfalli í rauntíma tengt sölukerfinu, mannaflagreining, starfsmannaapp með skírteini, bein tenging við bókhaldið, greiningar, skýrslur og spjall. Fyrir stjórnendur, vaktstjóra og starfsfólk.",
    hero_cta1: "Byrja núna", hero_cta2: "Bóka kynningu", hero_note: "14 daga prufa · Uppsetning samdægurs · Hættu hvenær sem er",
    m_dashboard: "Mælaborð", m_schedule: "Vaktaplan", m_time: "Tímaskráning", m_pay: "Launakeyrslur", m_perf: "Frammistaða",
    m_planned: "Áætlaðir tímar", m_actual: "Rauntímar", m_laborcost: "Launakostn.", m_laborpct: "Laun%",
    m_revtoday: "Velta í dag", m_laborpct2: "Launahlutfall", m_target: "markmið 30%", m_cost: "Launakostnaður", m_staffing: "Mönnun núna",
    trust_label: "Hannað sérstaklega fyrir veitingageirann, verslanir, verktaka og keðjur",
    feat_eyebrow: "Eiginleikar", feat_title: "Besta kerfið fyrir stjórnendur, vaktstjóra og starfsfólk", feat_sub: "Frá vaktaplani til launakeyrslu — eitt öflugt, einfalt og fallegt kerfi sem allir elska.",
    show_eyebrow: "VAKTO í verki", show_title: "Sjáðu kerfið í verki", show_sub: "Frá rauntíma launahlutfalli til AI-vaktaplans, starfsmannaskírteinis og innra spjalls — allt á einum stað.",
    show1_t: "Launahlutfall í rauntíma", show1_s: "Sjáðu laun sem % af veltu áður en mánuðurinn er úti — litakóðað eftir markmiði.",
    show2_t: "AI-vaktaplan á sekúndum", show2_s: "Lýstu markmiði og VAKTO raðar vöktum, lágmarkar yfirvinnu og heldur mönnun réttri.",
    show3_t: "Starfsmannaskírteini í símann", show3_s: "Stafrænt skírteini með QR — beint í Apple og Google Wallet.",
    show4_t: "Innra spjall fyrirtækis", show4_s: "Rásir og grúppur fyrir allt teymið — ekkert sér-spjallforrit.",
    flow_title: "Vaktaplan → Mæting → Laun → Arðsemi", flow_sub: "Heildaryfirlit yfir reksturinn — frá skipulagi til launaseðils.",
    int_title: "Óaðfinnanleg tenging við núverandi kerfi", int_sub: "Launakerfi, bókhald og sölukerfi (POS) — allt á einum stað.",
    verd_title: "Eitt fast verð — allt innifalið", verd_sub: "9.990 kr á mánuði með VSK, 5 notendur innifaldir og 990 kr fyrir hvern til viðbótar. Ekkert falið, engin binding.",
    faq_title: "Algengar spurningar",
    cta_title: "Sjáðu launahlutfallið í rauntíma — strax.", cta_sub: "Bókaðu 20 mínútna kynningu og við sýnum þér hversu mikið VAKTO getur sparað þér í launakostnað.", cta_btn1: "Bóka kynningu", cta_btn2: "Byrja núna",
    foot_about: "Hámarkaðu arðsemi vinnuaflsins. Vaktaplön, mætingarstjórnun, launavinnsla og rekstrargreining á einum stað.",
    foot_product: "Vara", foot_company: "Fyrirtæki", foot_legal: "Lögfræði",
    foot_about_link: "Um okkur", foot_blog: "Blogg", foot_contact: "Hafa samband", foot_privacy: "Persónuvernd", foot_terms: "Skilmálar", foot_cookies: "Vafrakökur",
    foot_made: "Hannað og þróað á Íslandi",
    a_back: "Til baka á vefinn", a_name: "Nafn", a_company: "Fyrirtæki", a_email: "Netfang", a_pw: "Lykilorð", a_or: "eða", a_google: "Halda áfram með Google", a_microsoft: "Halda áfram með Microsoft", a_eid: "Rafræn skilríki", a_panel_eyebrow: "VINNUAFLS-ARÐSEMI FYRIR FYRIRTÆKI", a_panel_t: "Vaktaplan, mæting, laun og arðsemi.", a_panel_s: "VAKTO smíðar vaktaplanið, reiknar launin og sýnir raunverulega framlegð í rauntíma.", a_f1: "Launakostnaður sem % af veltu í rauntíma", a_f2: "Íslensk launalógík — kjarasamningar & staðgreiðsla", a_f3: "Vaktaplan, stimpilklukka og app á einum stað", a_panel_quote: "„VAKTO lækkaði launahlutfallið okkar um 4% á tveimur mánuðum.\"",
  },
  en: {
    nav_features: "Features", nav_how: "How it works", nav_integrations: "Integrations", nav_pricing: "Pricing", nav_login: "Log in", nav_try: "Get started",
    hero_badge: "Scheduling, time tracking & workforce profitability in one",
    hero_title: 'The simplest scheduling & time-tracking system — <span class="g">everyone loves it</span>.',
    hero_sub: "Effortless scheduling and time tracking, a dashboard with real-time labor % linked to your POS, staffing insights, an employee app with a digital ID card, direct accounting integration, analytics, reports and chat. For managers, supervisors and staff.",
    hero_cta1: "Get started", hero_cta2: "Book a demo", hero_note: "14-day trial · Same-day setup · Cancel anytime",
    m_dashboard: "Dashboard", m_schedule: "Schedule", m_time: "Time tracking", m_pay: "Payroll", m_perf: "Performance",
    m_planned: "Planned hours", m_actual: "Actual hours", m_laborcost: "Labor cost", m_laborpct: "Labor%",
    m_revtoday: "Revenue today", m_laborpct2: "Labor ratio", m_target: "target 30%", m_cost: "Labor cost", m_staffing: "Staffing now",
    trust_label: "Built specifically for restaurants, retail, contractors, and chains",
    feat_eyebrow: "Features", feat_title: "The best system for managers, supervisors and staff", feat_sub: "From scheduling to payroll — one powerful, simple and beautiful platform everyone loves.",
    show_eyebrow: "VAKTO in action", show_title: "See the platform in action", show_sub: "From real-time labor % to AI scheduling, staff ID cards and built-in team chat — all in one place.",
    show1_t: "Real-time labor %", show1_s: "See labor as a % of revenue before month-end — color-coded against your target.",
    show2_t: "AI scheduling in seconds", show2_s: "Describe your goal and VAKTO builds the roster, cuts overtime and keeps staffing right.",
    show3_t: "Staff ID card on the phone", show3_s: "A digital QR card — straight into Apple and Google Wallet.",
    show4_t: "Built-in team chat", show4_s: "Channels and groups for the whole team — no separate chat app.",
    flow_title: "Schedule → Attendance → Pay → Profit", flow_sub: "The complete operations cycle — from planning to payslip.",
    int_title: "Connects with the tools you already use", int_sub: "Seamlessly integrates with your payroll, accounting, and POS systems.",
    verd_title: "One flat price — everything included", verd_sub: "9,990 ISK/month incl. VAT, 5 users included and 990 ISK for each additional. Nothing hidden, no lock-in.",
    faq_title: "Frequently asked questions",
    cta_title: "See labor as a percentage of revenue — instantly.", cta_sub: "Book a 20-minute demo and see exactly how much VAKTO can shave off your labor costs.", cta_btn1: "Book a demo", cta_btn2: "Get started",
    foot_about: "Maximize workforce profitability. Schedule, attendance, payroll, and real-time business intelligence in one place.",
    foot_product: "Product", foot_company: "Company", foot_legal: "Legal",
    foot_about_link: "About us", foot_blog: "Blog", foot_contact: "Contact us", foot_privacy: "Privacy policy", foot_terms: "Terms of service", foot_cookies: "Cookie settings",
    foot_made: "Crafted in Iceland",
    a_back: "Back to website", a_name: "Name", a_company: "Company", a_email: "Email address", a_pw: "Password", a_or: "or", a_google: "Continue with Google", a_microsoft: "Continue with Microsoft", a_eid: "Electronic ID (Auðkenni)", a_panel_eyebrow: "WORKFORCE PROFITABILITY FOR BUSINESSES", a_panel_t: "Scheduling, attendance, payroll, profit.", a_panel_s: "VAKTO builds schedules, automates pay rules, and delivers live profitability insights.", a_f1: "Real-time labor cost as a % of revenue", a_f2: "Icelandic payroll compliance — union rules & tax withholding", a_f3: "Schedules, time clock, and employee app in one place", a_panel_quote: '"VAKTO cut our labor ratio by 4% in just two months."',
  },
} as const;

export const FEAT: Record<Lang, [string, string][]> = {
  is: [
    ["Einfalt vaktaplan", "Dag-, viku- og mánaðarsýn. Dragðu vaktir, afritaðu heila viku og birtu með einum smelli. Gervigreind stingur upp á mönnun."],
    ["Tímaskráning & Kiosk", "Stimplun með PIN, ljósmynd eða GPS í appinu eða á sameiginlegri spjaldtölvu. Rauntímamæting beint í samþykktar tímaskýrslur."],
    ["Launahlutfall í rauntíma", "Tengdu sölukerfið (Inventra, Dineout, SalesCloud) og sjáðu launakostnað á móti veltu jafnóðum — sérstaða VAKTO."],
    ["Mannaflagreining", "Sjáðu nákvæmlega hvaða daga þú ert of- eða undirmönnuð og hvenær borgar sig að hafa fleiri eða færri á vakt."],
    ["Starfsmannaapp + skírteini", "Starfsfólk sér vaktir og tíma, sendir beiðnir, stimplar sig og fær sitt eigið stafræna starfsmannaskírteini í símann."],
    ["Bókhald, greiningar & spjall", "Bein tenging við bókhaldið (Payday, DK) fyrir launakeyrslu, öflug greiningartól, skýrslur og innra spjall — allt á einum stað."],
  ],
  en: [
    ["Effortless scheduling", "Day, week, and month views. Drag shifts, copy a whole week, and publish in one click. AI suggests optimal staffing."],
    ["Time tracking & Kiosk", "Clock in via PIN, photo, or GPS — in the app or on a shared tablet. Live attendance straight into approved timesheets."],
    ["Real-time labor %", "Connect your POS (Inventra, Dineout, SalesCloud) and watch labor cost against revenue live — the VAKTO advantage."],
    ["Staffing insights", "See exactly which days you're over- or under-staffed and when it pays to have more or fewer people on shift."],
    ["Employee app + ID card", "Staff see shifts and hours, send requests, clock in, and get their own digital staff ID card in their phone."],
    ["Accounting, analytics & chat", "Direct accounting integration (Payday, DK) for payroll, powerful analytics, reports, and built-in chat — all in one place."],
  ],
};

// Tabbed feature showcase — [tab label, heading, description, screenshot path].
export type Showcase = { tab: string; title: string; desc: string; img: string };
export const SHOWCASE: Record<Lang, Showcase[]> = {
  is: [
    { tab: "Vaktaplan", title: "Vaktaplan á nokkrum sekúndum", desc: "Dragðu vaktir, afritaðu heila viku og birtu með einum smelli. Sjáðu tíma og áætlaðan launakostnað per starfsmann jafnóðum — og láttu gervigreind stinga upp á mönnun.", img: "/showcase/vaktaplan.png" },
    { tab: "Tímaskráning", title: "Mæting í rauntíma", desc: "Starfsfólk stimplar sig með appinu, GPS eða á sameiginlegri spjaldtölvu. Þú sérð hverjir eru á vakt núna, samþykkir tíma með einum smelli og allt rennur beint í launin.", img: "/showcase/timaskraning.png" },
    { tab: "Launakeyrsla", title: "Laun eftir íslenskum reglum", desc: "VAKTO reiknar dagvinnu, álög, yfirvinnu og uppbætur eftir kjarasamningum — og flytur beint í bókhaldið (Payday, DK). Engin handavinna, engar villur.", img: "/showcase/launakeyrsla.png" },
    { tab: "Mælaborð", title: "Rauntölur og frávik á einum stað", desc: "Áætlaðir tímar á móti unnum, launahlutfall af veltu og hvað frávikið er að kosta — allt lifandi eftir því sem stimplað er inn og út. Sérðu frávik frá plani áður en mánuðurinn er búinn.", img: "/showcase/maelabord.png" },
    { tab: "Skírteini", title: "Stafrænt starfsmannaskírteini", desc: "Hver starfsmaður fær skírteini í Apple Wallet og Google Wallet með mynd, stöðu og QR-kóða. Skannaðu kóðann á stimpilklukkunni til að stimpla inn eða út — engir PIN-kóðar, engin lyklaborð.", img: "/showcase/skirteini.png" },
  ],
  en: [
    { tab: "Scheduling", title: "Build a schedule in seconds", desc: "Drag shifts, copy a whole week, and publish in one click. See hours and estimated labor cost per employee live — and let AI suggest staffing.", img: "/showcase/en/vaktaplan.png" },
    { tab: "Time tracking", title: "Attendance in real time", desc: "Staff clock in via the app, GPS or a shared tablet. See who's on shift now, approve hours in one click, and everything flows straight into payroll.", img: "/showcase/en/timaskraning.png" },
    { tab: "Payroll", title: "Pay by Icelandic rules", desc: "VAKTO computes regular pay, premiums, overtime and bonuses per union agreements — and exports straight to accounting (Payday, DK). No manual work, no errors.", img: "/showcase/en/launakeyrsla.png" },
    { tab: "Dashboard", title: "Real numbers and deviations in one place", desc: "Planned vs. actual hours, labor as a % of revenue, and what the deviation is costing you — all live as staff clock in and out. Spot drift from plan before month-end.", img: "/showcase/en/maelabord.png" },
    { tab: "Staff ID", title: "Digital staff ID card", desc: "Every employee gets an ID card in Apple Wallet and Google Wallet with photo, role and a QR code. Scan it at the time clock to punch in or out — no PINs, no keypads.", img: "/showcase/en/skirteini.png" },
  ],
};
export const SHOWCASE_HEAD: Record<Lang, { eyebrow: string; title: string; sub: string }> = {
  is: { eyebrow: "Skoðaðu kerfið", title: "Sjáðu VAKTO í verki", sub: "Smelltu á flipana til að skoða hverja einingu." },
  en: { eyebrow: "See it in action", title: "See VAKTO at work", sub: "Click the tabs to explore each module." },
};

export const FLOW: Record<Lang, [string, string][]> = {
  is: [["Vaktaplan", "Settu upp skipulagið með AI-tillögum og birtu með einum smelli."], ["Mæting", "Starfsfólk stimplar sig inn og út; rauntölur vs. áætlun uppfærast samstundis."], ["Laun", "Kjarasamningar og álög reiknast sjálfkrafa; sendu beint í Payday."], ["Arðsemi", "Fylgstu með launahlutfallinu lifandi og berðu saman tímabil á einfaldan hátt."]],
  en: [["Schedule", "Build the schedule with smart AI recommendations and publish instantly."], ["Attendance", "Staff clock in/out; actual vs. planned data updates in real time."], ["Pay", "Union rules and premiums compile automatically; export straight to Payday."], ["Profit", "Track labor as a % of revenue dynamically and compare business periods."]],
};

// ---------------------------------------------------------------------------
// Brand logos (integration partners + customers).
// Drop a real logo file into /public/logos/<slug>.svg (or .png) and set `img`
// to that path — the wall then renders the real asset. Until then a tasteful
// typographic wordmark is shown, styled per brand via `wm`.
// ---------------------------------------------------------------------------
export type Brand = {
  name: string;
  slug: string;
  img?: string;               // e.g. "/logos/payday.svg" once the real file is added
  wm?: {
    case?: "lower" | "upper"; // force casing of the wordmark
    weight?: number;          // font-weight
    spacing?: string;         // letter-spacing
    family?: "sans" | "serif";
    accent?: string;          // small dot after the name (brand colour cue)
  };
};

// What VAKTO connects to — payroll, POS and accounting.
export const INTEGRATIONS: Brand[] = [
  { name: "Payday",     slug: "payday",     wm: { case: "lower", weight: 700, accent: "#6c4bf4" } },
  { name: "dk",         slug: "dk",         wm: { case: "lower", weight: 800, spacing: ".02em", accent: "#00a3ad" } },
  { name: "Dineout",    slug: "dineout",    wm: { case: "lower", weight: 700, accent: "#e2483b" } },
  { name: "SalesCloud", slug: "salescloud", wm: { weight: 700, accent: "#2e7cf6" } },
  { name: "INVENTRA",   slug: "inventra",   wm: { case: "upper", weight: 700, spacing: ".08em" } },
  { name: "Uniconta",   slug: "uniconta",   wm: { weight: 700, accent: "#0e9f6e" } },
];

// Businesses running on VAKTO (shown in the trust strip).
export const CUSTOMERS: Brand[] = [
  { name: "Beint úr sjó", slug: "beint-ur-sjo", wm: { family: "serif", weight: 600 } },
  { name: "Njótum",       slug: "njotum",       wm: { weight: 700, spacing: ".02em" } },
  { name: "Thai Keflavík", slug: "thai-keflavik", wm: { weight: 700 } },
  { name: "RVK Asian",    slug: "rvk-asian",    wm: { case: "upper", weight: 800, spacing: ".04em" } },
];

export type Plan = { name: string; price: string; desc: string; unit?: string; features: string[]; pop: boolean; soon?: boolean };
export const PRICE: Record<Lang, Plan[]> = {
  is: [
    { name: "VAKTO", price: "9.990", unit: "kr/mán · VSK innifalið", desc: "Allt innifalið — 5 notendur", features: [
      "5 notendur innifaldir",
      "+990 kr per notanda umfram",
      "Vaktaplan, tímaskráning & Kiosk",
      "Mælaborð með laun% í rauntíma",
      "Starfsmannaapp + stafrænt skírteini",
      "Spjall, skýrslur & greiningar",
      "Tenging við bókhald (Payday, DK)",
      "Margar starfsstöðvar & félög — flakk á milli",
      "Engin binding — hættu hvenær sem er",
    ], pop: true },
  ],
  en: [
    { name: "VAKTO", price: "9,990", unit: "ISK/mo · VAT included", desc: "Everything included — 5 users", features: [
      "5 users included",
      "+990 ISK per extra user",
      "Scheduling, time tracking & Kiosk",
      "Dashboard with real-time labor %",
      "Employee app + digital ID card",
      "Chat, reports & analytics",
      "Accounting integration (Payday, DK)",
      "Multiple locations & companies — switch freely",
      "No lock-in — cancel anytime",
    ], pop: true },
  ],
};
export const SOON: Record<Lang, string> = { is: "Væntanlegt", en: "Coming soon" };

export const PUNIT: Record<Lang, string> = { is: "kr./notanda á mán", en: "ISK/user/mo" };
export const POP: Record<Lang, string> = { is: "Vinsælast", en: "Popular" };
export const PCTA: Record<Lang, string> = { is: "Velja áskrift", en: "Choose plan" };
export const CUSTOM: Record<Lang, string> = { is: "Sérsniðið", en: "Custom" };
export const FREE: Record<Lang, string> = { is: "Frítt", en: "Free" };

export const FAQ: Record<Lang, [string, string][]> = {
  is: [
    ["Hentar VAKTO bæði litlum og stórum rekstri?", "Algjörlega. VAKTO skalar hnökralaust frá 3 manna kaffihúsi upp í 1.000 manna fyrirtækjakeðju með margar starfsstöðvar — sömu gæði á grunni."],
    ["Reiknar kerfið íslenska kjarasamninga sjálfkrafa?", "Já — kerfið sér um vaktaálög, staðgreiðslu, tryggingagjald, lífeyrissjóði og orlof. Þú velur viðeigandi samning og reglurnar virkjast."],
    ["Geta starfsmenn stimplað sig inn í gegnum síma?", "Já, í appinu með GPS-staðfestingu, eða á sameiginlegri spjaldtölvu með persónulegum PIN-kóða til að tryggja öryggi og nákvæmni."],
    ["Tengist VAKTO við launakerfið mitt?", "Já, við bjóðum upp á beinar tengingar við Payday, DK, H3 og fleiri kerfi. Launakeyrslan fer beint í bókhaldið með einum smelli."],
    ["Er hægt að tengja veltu- og sölukerfi við VAKTO?", "Já, m.a. INVENTRA og helstu POS-sölukerfi. Þannig færðu launakostnaðinn sem hlutfall af veltu í rauntíma — einstök sérstaða VAKTO."],
    ["Á hvaða tungumálum er kerfið í boði?", "Kerfið er að fullu á bæði íslensku og ensku — hannað til að mæta þörfum fjölmenningarlegs vinnuafls á íslenskum markaði."],
  ],
  en: [
    ["Is VAKTO suitable for both small and large operations?", "Yes. VAKTO scales perfectly from a 3-person boutique cafe to a 1,000-person chain with multiple locations — powered by the same beautiful core."],
    ["Does it fully calculate Icelandic union agreements?", "Yes — handles shift premiums, tax withholding, insurance levy, pension, and holiday pay. Just select the contract per employee and rules apply instantly."],
    ["Can employees clock in on their mobile phones?", "Yes, via the mobile app (with GPS verification) or on a shared station via a secure personal PIN to ensure precise time tracking."],
    ["Does it integrate with my current payroll system?", "Yes — we integrate directly with Payday, DK, H3, and more. Your complete payroll data flows straight into accounting with a single click."],
    ["Can I sync my sales data or POS system?", "Yes, including INVENTRA and leading POS systems. This allows you to monitor labor cost as a share of revenue in real time — the VAKTO signature feature."],
    ["What languages are supported within the software?", "VAKTO features full native support for both Icelandic and English, perfectly tailoring to a diverse, modern workforce."],
  ],
};

export const AUTH = {
  is: { login: { title: "Velkomin(n) aftur", sub: "Skráðu þig inn til að halda áfram.", submit: "Skrá inn", switchq: "Ertu ekki með aðgang?", switcha: "Stofna aðgang" }, signup: { title: "Stofna aðgang", sub: "Byrjaðu með VAKTO á nokkrum mínútum.", submit: "Stofna aðgang", switchq: "Ertu nú þegar með aðgang?", switcha: "Skrá inn" } },
  en: { login: { title: "Welcome back", sub: "Sign in to your account.", submit: "Sign in", switchq: "Don't have an account yet?", switcha: "Create account" }, signup: { title: "Create your account", sub: "Get started with VAKTO today.", submit: "Register", switchq: "Already have an account?", switcha: "Sign in" } },
} as const;
