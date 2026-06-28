// Content dictionaries ported from prototypes/vakto-heimasida.html (I18N/FEAT/FLOW/PRICE/FAQ).
export type Lang = "is" | "en";

export const I18N = {
  is: {
    nav_features: "Eiginleikar", nav_how: "Hvernig það virkar", nav_integrations: "Tengingar", nav_pricing: "Verð", nav_login: "Innskráning", nav_try: "Prófa frítt",
    hero_badge: "Vinnuafls-arðsemi fyrir íslensk fyrirtæki",
    hero_title: 'Lægri launakostnaður — <span class="g">án undirmönnunar</span>.',
    hero_sub: "VAKTO gerir vaktaplanið, reiknar launin eftir íslenskum kjarasamningum og sýnir launakostnað sem hlutfall af veltu í rauntíma — áður en mánuðurinn er búinn.",
    hero_cta1: "Prófa frítt", hero_cta2: "Bóka kynningu", hero_note: "Engin kreditkort · uppsetning á einum degi · lítil teymi frítt",
    m_dashboard: "Mælaborð", m_schedule: "Vaktaplan", m_time: "Tímaskráning", m_pay: "Launakeyrslur", m_perf: "Frammistaða",
    m_planned: "Tímar (plan)", m_actual: "Raun", m_laborcost: "Launakostn.", m_laborpct: "Laun%",
    m_revtoday: "Velta í dag", m_laborpct2: "Laun af tekjum", m_target: "markmið 30%", m_cost: "Launakostnaður", m_staffing: "Mönnun núna",
    trust_label: "Gert fyrir veitingar, verslun, verktaka og keðjur",
    feat_eyebrow: "Eiginleikar", feat_title: "Allt sem þú þarft til að stýra vinnuafli", feat_sub: "Frá vaktaplani til launakeyrslu — eitt fallegt kerfi fyrir alla.",
    flow_title: "Vaktaplan → Mæting → Laun → Arðsemi", flow_sub: "Heildarmyndin af vinnunni — frá plani í launaseðil.",
    int_title: "Tengist því sem þú notar nú þegar", int_sub: "Launakerfi, bókhald og veltu/sölukerfi — allt á einum stað.",
    verd_title: "Einfalt verð sem vex með þér", verd_sub: "Greitt per starfsmann. Lítil teymi frítt. Engar faldar greiðslur.",
    faq_title: "Algengar spurningar",
    cta_title: "Sjáðu launin sem hlutfall af veltu — strax.", cta_sub: "Bókaðu 20 mínútna kynningu og við sýnum þér hvað VAKTO myndi spara í launakostnaði.", cta_btn1: "Bóka kynningu", cta_btn2: "Prófa frítt",
    foot_about: "Vinnuafls-arðsemi fyrir íslensk fyrirtæki. Vaktaplan, mæting, laun og arðsemi á einum stað.",
    foot_product: "Vara", foot_company: "Fyrirtæki", foot_legal: "Lögfræði",
    foot_about_link: "Um okkur", foot_blog: "Blogg", foot_contact: "Hafa samband", foot_privacy: "Persónuvernd", foot_terms: "Skilmálar", foot_cookies: "Vafrakökur",
    foot_made: "Hannað á Íslandi",
    a_back: "Til baka á vefinn", a_name: "Nafn", a_company: "Fyrirtæki", a_email: "Netfang", a_pw: "Lykilorð", a_or: "eða", a_google: "Halda áfram með Google", a_microsoft: "Halda áfram með Microsoft", a_eid: "Rafræn skilríki (Auðkenni)", a_panel_eyebrow: "VINNUAFLS-ARÐSEMI FYRIR FYRIRTÆKI", a_panel_t: "Vaktaplan, mæting, laun, arðsemi.", a_panel_s: "VAKTO gerir vaktaplanið, reiknar launin og sýnir arðsemina í rauntíma.", a_f1: "Laun sem % af veltu í rauntíma", a_f2: "Íslensk launalógík — kjarasamningar & staðgreiðsla", a_f3: "Vaktaplan, stimpilklukka og app á einum stað", a_panel_quote: "„VAKTO lækkaði launahlutfallið okkar um 4% á tveimur mánuðum.\"",
  },
  en: {
    nav_features: "Features", nav_how: "How it works", nav_integrations: "Integrations", nav_pricing: "Pricing", nav_login: "Log in", nav_try: "Try free",
    hero_badge: "Workforce profitability for businesses",
    hero_title: 'Lower labor cost — <span class="g">without understaffing</span>.',
    hero_sub: "VAKTO builds the schedule, calculates pay under Icelandic union agreements, and shows labor cost as a share of revenue in real time — before the month is over.",
    hero_cta1: "Try free", hero_cta2: "Book a demo", hero_note: "No credit card · set up in one day · free for small teams",
    m_dashboard: "Dashboard", m_schedule: "Schedule", m_time: "Time tracking", m_pay: "Payroll", m_perf: "Performance",
    m_planned: "Hours (plan)", m_actual: "Actual", m_laborcost: "Labor cost", m_laborpct: "Labor%",
    m_revtoday: "Revenue today", m_laborpct2: "Labor of revenue", m_target: "target 30%", m_cost: "Labor cost", m_staffing: "Staffing now",
    trust_label: "Built for restaurants, retail, contractors and chains",
    feat_eyebrow: "Features", feat_title: "Everything you need to run your workforce", feat_sub: "From schedule to payroll — one beautiful system for everyone.",
    flow_title: "Schedule → Attendance → Pay → Profit", flow_sub: "The full picture of work — from plan to payslip.",
    int_title: "Connects to what you already use", int_sub: "Payroll, accounting and revenue/POS systems — all in one place.",
    verd_title: "Simple pricing that grows with you", verd_sub: "Priced per employee. Free for small teams. No hidden fees.",
    faq_title: "Frequently asked questions",
    cta_title: "See labor as a share of revenue — instantly.", cta_sub: "Book a 20-minute demo and we will show you what VAKTO would save you in labor cost.", cta_btn1: "Book a demo", cta_btn2: "Try free",
    foot_about: "Workforce profitability for businesses. Schedule, attendance, pay and profit in one place.",
    foot_product: "Product", foot_company: "Company", foot_legal: "Legal",
    foot_about_link: "About us", foot_blog: "Blog", foot_contact: "Contact", foot_privacy: "Privacy", foot_terms: "Terms", foot_cookies: "Cookies",
    foot_made: "Designed in Iceland",
    a_back: "Back to site", a_name: "Name", a_company: "Company", a_email: "Email", a_pw: "Password", a_or: "or", a_google: "Continue with Google", a_microsoft: "Continue with Microsoft", a_eid: "Electronic ID (Auðkenni)", a_panel_eyebrow: "WORKFORCE PROFITABILITY FOR BUSINESSES", a_panel_t: "Schedule, attendance, pay, profit.", a_panel_s: "VAKTO builds the schedule, calculates pay and shows profitability in real time.", a_f1: "Labor as a share of revenue, in real time", a_f2: "Icelandic payroll logic — union agreements & withholding", a_f3: "Schedule, time clock and app in one place", a_panel_quote: '"VAKTO cut our labor ratio by 4% in two months."',
  },
} as const;

export const FEAT: Record<Lang, [string, string][]> = {
  is: [
    ["Vaktaplan með AI", "Dag-, viku- og mánaðarplan. AI stingur upp á bestu mönnun út frá veltu og eftirspurn — drag-drop og birt með einum smelli."],
    ["Stimpilklukka & kiosk", "Stimpla inn/út með PIN-kóða, mynd eða GPS. Rauntíma mæting og samþykkt tíma fyrir launakeyrslu."],
    ["Laun sem % af veltu", "Sjáðu launakostnað á móti veltu í rauntíma, litakóðað — undirskrift VAKTO sem enginn annar hefur."],
    ["Íslensk launalógík", "Kjarasamningar, álög, staðgreiðsla, tryggingagjald, lífeyrir og orlof reiknað rétt — per starfsmann."],
    ["Starfsmannaapp", "Vaktir, launaseðill, tímabanki, vaktaskipti, framboð og frí — allt í símanum."],
    ["Þrjú hlutverk", "Eigandi, stjórnandi og starfsmaður — hver með sína sýn og réttan aðgang. Verktaka-aðgangur líka."],
  ],
  en: [
    ["AI scheduling", "Day, week and month plans. AI suggests the best staffing from revenue and demand — drag-drop, published in one click."],
    ["Time clock & kiosk", "Clock in/out with a PIN, photo or GPS. Real-time attendance and time approval for payroll."],
    ["Labor as % of revenue", "See labor cost against revenue in real time, color-coded — the VAKTO signature no one else has."],
    ["Icelandic payroll logic", "Union agreements, premiums, withholding, insurance levy, pension and holiday pay calculated correctly — per employee."],
    ["Employee app", "Shifts, payslip, time bank, shift swaps, availability and leave — all in the phone."],
    ["Three roles", "Owner, manager and employee — each with their own view and the right access. Contractor access too."],
  ],
};

export const FLOW: Record<Lang, [string, string][]> = {
  is: [["Vaktaplan", "Gerðu planið með AI-tillögum og birtu með einum smelli."], ["Mæting", "Starfsfólk stimplar inn/út; raun vs plan uppfærist strax."], ["Laun", "Kjarasamningar reiknast sjálfkrafa; sendu beint í Payday."], ["Arðsemi", "Sjáðu laun sem % af veltu og berðu saman tímabil."]],
  en: [["Schedule", "Build the plan with AI suggestions and publish in one click."], ["Attendance", "Staff clock in/out; actual vs plan updates instantly."], ["Pay", "Union agreements calculated automatically; send straight to Payday."], ["Profit", "See labor as % of revenue and compare periods."]],
};

export type Plan = { name: string; price: string; desc: string; features: string[]; pop: boolean };
export const PRICE: Record<Lang, Plan[]> = {
  is: [
    { name: "Frítt", price: "Frítt", desc: "Lítil teymi", features: ["Allt að 5 starfsmenn", "Vaktaplan & dagatal", "Stimpilklukka & app", "Grunnskýrslur"], pop: false },
    { name: "Pró", price: "990", desc: "Flest fyrirtæki", features: ["Ótakmarkað starfsfólk", "AI-vaktaplan", "Íslenskir kjarasamningar", "Laun sem % af veltu", "Launakeyrsla & tengingar"], pop: true },
    { name: "Verk", price: "1.290", desc: "Verktakar & iðnaður", features: ["Allt í Pró", "GPS-verkskráning", "Útselt vs kostnaður", "Reikningagerð"], pop: false },
    { name: "Enterprise", price: "Sérsniðið", desc: "Keðjur & sveitarfélög", features: ["Flóknir kjarasamningar", "SSO & audit", "Sérlausnir & API", "Tengiliður"], pop: false },
  ],
  en: [
    { name: "Free", price: "Free", desc: "Small teams", features: ["Up to 5 employees", "Schedule & calendar", "Time clock & app", "Basic reports"], pop: false },
    { name: "Pro", price: "990", desc: "Most businesses", features: ["Unlimited employees", "AI scheduling", "Icelandic union agreements", "Labor as % of revenue", "Payroll & integrations"], pop: true },
    { name: "Work", price: "1,290", desc: "Contractors & industry", features: ["Everything in Pro", "GPS job tracking", "Billable vs cost", "Invoicing"], pop: false },
    { name: "Enterprise", price: "Custom", desc: "Chains & municipalities", features: ["Complex agreements", "SSO & audit", "Custom & API", "Account manager"], pop: false },
  ],
};

export const PUNIT: Record<Lang, string> = { is: "kr./notanda á mán", en: "ISK/user/mo" };
export const POP: Record<Lang, string> = { is: "Vinsælast", en: "Popular" };
export const PCTA: Record<Lang, string> = { is: "Velja", en: "Choose" };
export const CUSTOM: Record<Lang, string> = { is: "Sérsniðið", en: "Custom" };
export const FREE: Record<Lang, string> = { is: "Frítt", en: "Free" };

export const FAQ: Record<Lang, [string, string][]> = {
  is: [
    ["Hentar þetta bæði litlum og stórum?", "Já. VAKTO skalar frá 3 manna kaffihúsi upp í 1.000 manna keðju með mörgum starfsstöðvum — sami fallegi grunnurinn."],
    ["Reiknar kerfið íslenska kjarasamninga?", "Já — álög, staðgreiðslu, tryggingagjald, lífeyri og orlof. Þú velur kjarasamning per starfsmann og reglurnar fyllast sjálfkrafa."],
    ["Geta starfsmenn stimplað sig í síma?", "Já, í appinu (með GPS) eða á sameiginlegri stimpilklukku með persónulegum PIN-kóða svo enginn stimpli óvart sem annar."],
    ["Tengist það launakerfinu mínu?", "Já — Payday, DK, H3 og fleiri. Launakeyrsla fer beint í bókhaldið með einum smelli."],
    ["Get ég tengt veltu eða sölukerfi?", "Já, m.a. INVENTRA og POS-kerfi. Þá sérðu laun sem hlutfall af veltu í rauntíma — undirskrift VAKTO."],
    ["Á hvaða tungumálum er kerfið?", "Íslensku og ensku, og fleiri tungumálum — hannað fyrir bæði íslenskan og alþjóðlegan markað."],
  ],
  en: [
    ["Does it fit both small and large?", "Yes. VAKTO scales from a 3-person cafe to a 1,000-person chain with many locations — the same beautiful core."],
    ["Does it calculate Icelandic union agreements?", "Yes — premiums, withholding, insurance levy, pension and holiday pay. You pick an agreement per employee and the rules fill in automatically."],
    ["Can employees clock in on their phone?", "Yes, in the app (with GPS) or on a shared time clock with a personal PIN so no one clocks in as someone else."],
    ["Does it connect to my payroll?", "Yes — Payday, DK, H3 and more. Payroll flows straight into your accounting in one click."],
    ["Can I connect revenue or a POS system?", "Yes, including INVENTRA and POS systems. Then you see labor as a share of revenue in real time — the VAKTO signature."],
    ["What languages is it in?", "Icelandic and English, with more languages — built for both the Icelandic and international markets."],
  ],
};

export const AUTH = {
  is: { login: { title: "Velkomin aftur", sub: "Skráðu þig inn til að halda áfram.", submit: "Skrá inn", switchq: "Ertu ekki með aðgang?", switcha: "Stofna aðgang" }, signup: { title: "Stofna aðgang", sub: "Byrjaðu með VAKTO á einum degi.", submit: "Stofna aðgang", switchq: "Ertu nú þegar með aðgang?", switcha: "Skrá inn" } },
  en: { login: { title: "Welcome back", sub: "Sign in to continue.", submit: "Sign in", switchq: "Don't have an account?", switcha: "Create account" }, signup: { title: "Create account", sub: "Get started with VAKTO in a day.", submit: "Create account", switchq: "Already have an account?", switcha: "Sign in" } },
} as const;
