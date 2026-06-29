// Content dictionaries ported from prototypes/vakto-heimasida.html (I18N/FEAT/FLOW/PRICE/FAQ).
export type Lang = "is" | "en";

export const I18N = {
  is: {
    nav_features: "Eiginleikar", nav_how: "Hvernig það virkar", nav_integrations: "Tengingar", nav_pricing: "Verð", nav_login: "Innskráning", nav_try: "Prófa frítt",
    hero_badge: "Vinnuafls-arðsemi fyrir íslensk fyrirtæki",
    hero_title: 'Lægri launakostnaður — <span class="g">án undirmönnunar</span>.',
    hero_sub: "VAKTO sjálfvirknivæðir vaktaplön, reiknar laun samkvæmt íslenskum kjarasamningum og sýnir launahlutfallið í rauntíma — áður en mánuðurinn er úti.",
    hero_cta1: "Prófa ókeypis", hero_cta2: "Bóka kynningu", hero_note: "Engin kreditkortakrafa · Uppsetning á einum degi · Frítt fyrir lítil teymi",
    m_dashboard: "Mælaborð", m_schedule: "Vaktaplan", m_time: "Tímaskráning", m_pay: "Launakeyrslur", m_perf: "Frammistaða",
    m_planned: "Áætlaðir tímar", m_actual: "Rauntímar", m_laborcost: "Launakostn.", m_laborpct: "Laun%",
    m_revtoday: "Velta í dag", m_laborpct2: "Launahlutfall", m_target: "markmið 30%", m_cost: "Launakostnaður", m_staffing: "Mönnun núna",
    trust_label: "Hannað sérstaklega fyrir veitingageirann, verslanir, verktaka og keðjur",
    feat_eyebrow: "Eiginleikar", feat_title: "Allt sem þú þarft til að stýra vinnuafli", feat_sub: "Frá vaktaplani til launakeyrslu — eitt öflugt og fallegt kerfi fyrir alla.",
    flow_title: "Vaktaplan → Mæting → Laun → Arðsemi", flow_sub: "Heildaryfirlit yfir reksturinn — frá skipulagi til launaseðils.",
    int_title: "Óaðfinnanleg tenging við núverandi kerfi", int_sub: "Launakerfi, bókhald og sölukerfi (POS) — allt á einum stað.",
    verd_title: "Einfalt og gagnsætt verðmódel", verd_sub: "Greiðið aðeins per starfsmann. Frítt fyrir lítil teymi. Engin faldar greiðslur.",
    faq_title: "Algengar spurningar",
    cta_title: "Sjáðu launahlutfallið í rauntíma — strax.", cta_sub: "Bókaðu 20 mínútna kynningu og við sýnum þér hversu mikið VAKTO getur sparað þér í launakostnað.", cta_btn1: "Bóka kynningu", cta_btn2: "Prófa frítt",
    foot_about: "Hámarkaðu arðsemi vinnuaflsins. Vaktaplön, mætingarstjórnun, launavinnsla og rekstrargreining á einum stað.",
    foot_product: "Vara", foot_company: "Fyrirtæki", foot_legal: "Lögfræði",
    foot_about_link: "Um okkur", foot_blog: "Blogg", foot_contact: "Hafa samband", foot_privacy: "Persónuvernd", foot_terms: "Skilmálar", foot_cookies: "Vafrakökur",
    foot_made: "Hannað og þróað á Íslandi",
    a_back: "Til baka á vefinn", a_name: "Nafn", a_company: "Fyrirtæki", a_email: "Netfang", a_pw: "Lykilorð", a_or: "eða", a_google: "Halda áfram með Google", a_microsoft: "Halda áfram með Microsoft", a_eid: "Rafræn skilríki", a_panel_eyebrow: "VINNUAFLS-ARÐSEMI FYRIR FYRIRTÆKI", a_panel_t: "Vaktaplan, mæting, laun og arðsemi.", a_panel_s: "VAKTO smíðar vaktaplanið, reiknar launin og sýnir raunverulega framlegð í rauntíma.", a_f1: "Launakostnaður sem % af veltu í rauntíma", a_f2: "Íslensk launalógík — kjarasamningar & staðgreiðsla", a_f3: "Vaktaplan, stimpilklukka og app á einum stað", a_panel_quote: "„VAKTO lækkaði launahlutfallið okkar um 4% á tveimur mánuðum.\"",
  },
  en: {
    nav_features: "Features", nav_how: "How it works", nav_integrations: "Integrations", nav_pricing: "Pricing", nav_login: "Log in", nav_try: "Try free",
    hero_badge: "Workforce profitability for smart businesses",
    hero_title: 'Lower labor costs — <span class="g">without understaffing</span>.',
    hero_sub: "VAKTO automates scheduling, processes payroll using Icelandic union rules, and tracks labor cost against revenue in real time — before month-end.",
    hero_cta1: "Get started free", hero_cta2: "Book a demo", hero_note: "No credit card required · 24-hour setup · Free for small teams",
    m_dashboard: "Dashboard", m_schedule: "Schedule", m_time: "Time tracking", m_pay: "Payroll", m_perf: "Performance",
    m_planned: "Planned hours", m_actual: "Actual hours", m_laborcost: "Labor cost", m_laborpct: "Labor%",
    m_revtoday: "Revenue today", m_laborpct2: "Labor ratio", m_target: "target 30%", m_cost: "Labor cost", m_staffing: "Staffing now",
    trust_label: "Built specifically for restaurants, retail, contractors, and chains",
    feat_eyebrow: "Features", feat_title: "Everything you need to run your workforce", feat_sub: "From smart scheduling to automated payroll — one unified platform for your team.",
    flow_title: "Schedule → Attendance → Pay → Profit", flow_sub: "The complete operations cycle — from planning to payslip.",
    int_title: "Connects with the tools you already use", int_sub: "Seamlessly integrates with your payroll, accounting, and POS systems.",
    verd_title: "Predictable pricing that scales with you", verd_sub: "Priced per employee. Free for small teams. Absolutely no hidden fees.",
    faq_title: "Frequently asked questions",
    cta_title: "See labor as a percentage of revenue — instantly.", cta_sub: "Book a 20-minute demo and see exactly how much VAKTO can shave off your labor costs.", cta_btn1: "Book a demo", cta_btn2: "Try free",
    foot_about: "Maximize workforce profitability. Schedule, attendance, payroll, and real-time business intelligence in one place.",
    foot_product: "Product", foot_company: "Company", foot_legal: "Legal",
    foot_about_link: "About us", foot_blog: "Blog", foot_contact: "Contact us", foot_privacy: "Privacy policy", foot_terms: "Terms of service", foot_cookies: "Cookie settings",
    foot_made: "Crafted in Iceland",
    a_back: "Back to website", a_name: "Name", a_company: "Company", a_email: "Email address", a_pw: "Password", a_or: "or", a_google: "Continue with Google", a_microsoft: "Continue with Microsoft", a_eid: "Electronic ID (Auðkenni)", a_panel_eyebrow: "WORKFORCE PROFITABILITY FOR BUSINESSES", a_panel_t: "Scheduling, attendance, payroll, profit.", a_panel_s: "VAKTO builds schedules, automates pay rules, and delivers live profitability insights.", a_f1: "Real-time labor cost as a % of revenue", a_f2: "Icelandic payroll compliance — union rules & tax withholding", a_f3: "Schedules, time clock, and employee app in one place", a_panel_quote: '"VAKTO cut our labor ratio by 4% in just two months."',
  },
} as const;

export const FEAT: Record<Lang, [string, string][]> = {
  is: [
    ["Snjallvaktaplan (AI)", "Dag-, viku- og mánaðarsýn. Gervigreind stendur vaktina og hámarkar mönnun út frá veltuspá með einum smelli."],
    ["Stimpilklukka & snertiskjár", "Innistimplun með PIN, ljósmynd eða GPS. Rauntímamæting sem skilar sér beint í samþykktar tímaskýrslur."],
    ["Launahlutfall í rauntíma", "Sjáðu launakostnað á móti veltu jafnóðum með litakóðun — sérstaða VAKTO sem enginn annar býður upp á."],
    ["Sjálfvirk íslensk launalógík", "Kjarasamningar, vaktaálög, staðgreiðsla, tryggingagjald og orlofsreikningur — allt uppfært per starfsmann."],
    ["Öflugt starfsmannaapp", "Vaktir, rafrænir launaseðlar, tímabanki, vaktaskipti og leyfisbeiðnir — beint í vasann."],
    ["Sérsniðin aðgangsstýring", "Ólík hlutverk fyrir eigendur, stjórnendur og starfsfólk. Fullkominn verktaka-aðgangur líka í boði."],
  ],
  en: [
    ["AI-powered scheduling", "Day, week, and month views. AI suggests optimal staffing based on revenue and demand — drag-and-drop, publish in clicks."],
    ["Time clock & kiosk", "Clock in/out via PIN, photo, or GPS tracking. Live attendance monitoring with instant manager approval for payroll."],
    ["Labor as % of revenue", "Monitor labor cost against sales in real time with visual alerts — the VAKTO signature advantage."],
    ["Full Icelandic compliance", "Union agreements, shift premiums, withholding tax, insurance levy, pension, and holiday pay — automated per employee."],
    ["Intuitive employee app", "Shifts, digital payslips, time banks, shift swaps, availability, and time-off requests — all on their phone."],
    ["Granular role permissions", "Tailored access levels for owners, managers, and employees. Specialized contractor access included."],
  ],
};

export const FLOW: Record<Lang, [string, string][]> = {
  is: [["Vaktaplan", "Settu upp skipulagið með AI-tillögum og birtu með einum smelli."], ["Mæting", "Starfsfólk stimplar sig inn og út; rauntölur vs. áætlun uppfærast samstundis."], ["Laun", "Kjarasamningar og álög reiknast sjálfkrafa; sendu beint í Payday."], ["Arðsemi", "Fylgstu með launahlutfallinu lifandi og berðu saman tímabil á einfaldan hátt."]],
  en: [["Schedule", "Build the schedule with smart AI recommendations and publish instantly."], ["Attendance", "Staff clock in/out; actual vs. planned data updates in real time."], ["Pay", "Union rules and premiums compile automatically; export straight to Payday."], ["Profit", "Track labor as a % of revenue dynamically and compare business periods."]],
};

export type Plan = { name: string; price: string; desc: string; features: string[]; pop: boolean };
export const PRICE: Record<Lang, Plan[]> = {
  is: [
    { name: "Frítt", price: "0", desc: "Lítil teymi", features: ["Allt að 5 starfsmenn", "Vaktaplan & dagatal", "Stimpilklukka & app", "Grunnskýrslur"], pop: false },
    { name: "Pro", price: "990", desc: "Vinsælasta lausnin", features: ["Ótakmarkaður starfsmannafjöldi", "AI-drifið vaktaplan", "Íslenskir kjarasamningar", "Launahlutfall í rauntíma", "Sjálfvirk launakeyrsla & tengingar"], pop: true },
    { name: "Verk", price: "1.290", desc: "Verktakar & iðnaður", features: ["Allt innifalið í Pro", "GPS-verkskráning", "Útselt vs. kostnaður", "Snjallreikningagerð"], pop: false },
    { name: "Enterprise", price: "Sérsniðið", desc: "Keðjur & stærri fyrirtæki", features: ["Flóknar samningatengingar", "SSO & öryggisúttektir", "Sérlausnir & opið API", "Sérstakur tengiliður"], pop: false },
  ],
  en: [
    { name: "Free", price: "0", desc: "For micro teams", features: ["Up to 5 employees", "Schedule & calendar", "Time clock & mobile app", "Basic reporting"], pop: false },
    { name: "Pro", price: "990", desc: "For most businesses", features: ["Unlimited employees", "AI scheduling engine", "Icelandic union automation", "Real-time labor % tracking", "Payroll exports & integrations"], pop: true },
    { name: "Work", price: "1,290", desc: "Contractors & trade", features: ["Everything in Pro", "GPS job & site tracking", "Billable hours vs. cost", "Instant invoicing"], pop: false },
    { name: "Enterprise", price: "Custom", desc: "Chains & large operations", features: ["Complex union configurations", "SSO & advanced audit logs", "Custom workflows & API access", "Dedicated account manager"], pop: false },
  ],
};

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
