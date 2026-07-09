"use client";

// The "miðnætursól" homepage — deep black with a glowing orange aurora horizon.
// Bilingual (IS/EN): all copy lives in T below, toggled by the nav globe and
// persisted in localStorage("vakto-lang") — the same key the app shell uses.

import { useEffect, useRef, useState } from "react";
import { CUSTOMERS, type Brand } from "../home-data";

type Lang = "is" | "en";

/* ---------- copy (VAKTO-TEXTAR-NYR.md) ---------- */

const T: Record<Lang, {
  nav: [string, string, string];
  login: string; start: string;
  pill: string; h1: [string, string]; sub: string; ctaSee: string;
  shotAlt: string;
  trust: string;
  st1: string; stEm: string; st2: string;
  industries: [string, string, string, string, string, string];
  featHead: string; featSub: string;
  features: { title: string; desc: string }[];
  gaugeTarget: string;
  chat: [string, string, string];
  idLabel: string; idRole: string;
  stepsHead: string;
  steps: { title: string; desc: string }[];
  showHead: string; showSub: string;
  slides: { title: string; desc: string }[];
  appBadge: string; appHead: string; appSub: string;
  appPoints: string[];
  phNext: string; phShift: string; phClockIn: string; phWallet: string; phNotif: string;
  voicesHead: string; voicesSub: string;
  voices: { quote: string; role: string }[];
  priceHead: string; priceSub: string; priceAmt: string; priceUnit: string;
  priceItems: [string, string, string, string];
  priceFine: string;
  ctaEnd: string; ctaDemo: string;
  footBlurb: string;
  footProduct: string; footHow: string; footPrice: string;
  footCompany: string; footContact: string; footKiosk: string;
  footLegal: string; footPrivacy: string; footTerms: string; footCookies: string;
  footFollow: string;
  footCopy: string; footMade: string;
}> = {
  is: {
    nav: ["Eiginleikar", "Svona virkar það", "Verð"],
    login: "Innskráning", start: "Byrja frítt",
    pill: "Framtíð vaktavinnu · knúin af AI",
    h1: ["Vaktaplanið gerir sig sjálft.", "Launin líka."],
    sub: "AI raðar vöktunum á sekúndum. Launakostnaðurinn birtist áður en vikan byrjar. Starfsfólkið fær allt í símann. Segðu bless við Excel.",
    ctaSee: "Sjá hvernig",
    shotAlt: "VAKTO mælaborð í dökkri stillingu — launahlutfall í rauntíma",
    trust: "Vinnustaðir um allt Ísland keyra á VAKTO",
    st1: "Vaktaplan á ekki að taka sunnudagskvöldið þitt. VAKTO raðar með AI, sýnir þér kostnaðinn ",
    stEm: "áður en þú birtir",
    st2: " og lætur þig vita um leið og eitthvað víkur frá. Þú rekur staðinn — ekki Excel-skjalið.",
    industries: ["Veitingastaðir", "Kaffihús", "Verslanir", "Hótel & gisting", "Bakarí", "Keðjur & útibú"],
    featHead: "Allt á einum stað. Loksins.",
    featSub: "Frá fyrsta plani að greiddum launum — eitt fallegt kerfi sem fólkið þitt elskar að nota.",
    features: [
      { title: "Sjáðu reksturinn í rauntíma", desc: "Laun sem hlutfall af veltu, lifandi yfir daginn. Grænt þegar þú ert á markmiði, rautt áður en það verður dýrt. Betri ákvarðanir á meðan þær eru enn ódýrar." },
      { title: "Vaktaplan á sekúndum", desc: "Lýstu vikunni og AI stillir upp mönnuninni. Dragðu, fínstilltu, birtu — búið." },
      { title: "Mæting sem skráir sig sjálf", desc: "PIN, GPS eða QR-skírteini — inn og út á sekúndu. Yfirvinnan birtist í rauntíma, ekki eftir mánuð." },
      { title: "Skírteinið býr í veskinu", desc: "Stafrænt starfsmannaskírteini í Apple Wallet og Google Wallet — mynd, staða og QR-kóði sem stimplar inn og út. Plast heyrir sögunni til." },
      { title: "Laun á sjálfstýringu", desc: "Dagvinna, álög, yfirvinna og uppbætur — rétt eftir kjarasamningum, beint í Payday eða DK. Núll handavinna." },
      { title: "Appið sem starfsfólkið elskar", desc: "Vaktir, laun, vaktaskipti, fríbeiðnir og spjall — allt í símanum. Ein tilkynning í stað tuttugu skilaboða. Fólkið þitt veit alltaf hvað er næst og miðarnir á kaffistofunni heyra sögunni til." },
    ],
    gaugeTarget: "MARKMIÐ 30%",
    chat: ["Getur einhver tekið laugardaginn?", "Ég tek hana!", "Vaktaskipti samþykkt ✓"],
    idLabel: "STARFSMANNASKÍRTEINI", idRole: "Kokkur · Eldhús",
    stepsHead: "Þrjú skref. Korter. Búið.",
    steps: [
      { title: "Stofnaðu aðgang", desc: "Fyrirtækið, fólkið og kjarasamningarnir — inn á korteri, ekki viku." },
      { title: "Láttu AI sjá um planið", desc: "Lýstu vikunni og AI raðar eftir álagi og reglum. Þú samþykkir — og planið lendir í símum starfsfólksins, með skírteini og öllu." },
      { title: "Sjáðu kostnaðinn fyrirfram", desc: "Launakostnaðurinn birtist áður en þú birtir planið og frávikin dag frá degi. Mánaðamótin verða bara dagsetning." },
    ],
    showHead: "Sjáðu kerfið í alvöru",
    showSub: "Alvöru skjámyndir úr VAKTO — flettu á milli.",
    slides: [
      { title: "Mælaborð", desc: "Reksturinn í rauntíma: tímar, kostnaður og laun% á einum skjá." },
      { title: "Vaktaplan", desc: "Full vika á sekúndum með AI — kostnaðurinn sést áður en þú birtir." },
      { title: "Tímaskráning", desc: "Áætlað vs raun, yfirvinna og frávik — lifandi yfir daginn." },
      { title: "Starfsfólk", desc: "Prófílar, réttindi, skjöl og skírteini á einum stað." },
      { title: "Skýrslur", desc: "Tímar, kostnaður og samanburður — sótt sem Excel eða PDF." },
      { title: "Stimpilklukka", desc: "Sameiginleg spjaldtölva á staðnum — inn og út með einni snertingu." },
    ],
    appBadge: "Væntanlegt",
    appHead: "Appið sem fylgir fólkinu heim",
    appSub: "VAKTO appið er á leiðinni — allt sem starfsfólkið þarf, í vasanum.",
    appPoints: [
      "Vaktirnar og næsta vakt",
      "Stimpla inn og út",
      "Skírteinið í Apple Wallet og Google Wallet",
      "Fríbeiðnir og vaktaskipti",
      "Tilkynningar um leið og eitthvað breytist",
    ],
    phNext: "Næsta vakt", phShift: "Fim 9. júlí · 08:00–16:00", phClockIn: "Stimpla inn",
    phWallet: "Skírteini · Apple Wallet", phNotif: "Vaktaskipti samþykkt ✓",
    voicesHead: "Rekstrarfólk elskar VAKTO",
    voicesSub: "Og starfsfólkið líka. Það er allur galdurinn.",
    voices: [
      { quote: "Vaktaplanið sem tók tvo tíma á sunnudagskvöldum tekur núna fimm mínútur. AI raðar, ég samþykki og fólkið fær það beint í símann. Ég hef aldrei séð launakostnaðinn jafn skýrt og núna.", role: "Eigandi, kaffihús í Reykjavík" },
      { quote: "Starfsfólkið tók appinu samstundis. Vaktaskipti sem enduðu áður í tuttugu skilaboðum gerast núna með einum smelli — og ég sé frávikin samdægurs.", role: "Rekstrarstjóri veitingahúss" },
      { quote: "Við sáum strax hvaða dagar voru ofmannaðir. Launahlutfallið fór úr 36% í 31% á tveimur mánuðum.", role: "Verslunarstjóri" },
    ],
    priceHead: "Eitt verð. Allt innifalið.",
    priceSub: "Engin þrep. Ekkert falið. Engin binding.",
    priceAmt: "9.990", priceUnit: "kr/mán · VSK innifalið",
    priceItems: [
      "5 notendur innifaldir — +990 kr á notanda umfram",
      "AI-vaktaplan, stimpilklukka og laun% í rauntíma",
      "App, skírteini, spjall og skýrslur",
      "Payday, DK og sölukerfin þín",
    ],
    priceFine: "14 daga frí prufa. Ekkert kort.",
    ctaEnd: "Reksturinn þinn. Í rauntíma. Frá og með deginum í dag.",
    ctaDemo: "Bóka kynningu",
    footBlurb: "Framtíð vinnustaða: AI-vaktaplan, laun á sjálfstýringu og reksturinn í rauntíma — í einu fallegu kerfi.",
    footProduct: "Vara", footHow: "Svona virkar það", footPrice: "Verð",
    footCompany: "Fyrirtækið", footContact: "Hafa samband", footKiosk: "Stimpilklukka",
    footLegal: "Lögfræði", footPrivacy: "Persónuvernd", footTerms: "Skilmálar", footCookies: "Vafrakökur",
    footFollow: "Fylgdu okkur",
    footCopy: "© 2026 VAKTO ehf.", footMade: "Hannað og þróað á Íslandi",
  },
  en: {
    nav: ["Features", "How it works", "Pricing"],
    login: "Sign in", start: "Start free",
    pill: "The future of shift work · powered by AI",
    h1: ["Schedules that build themselves.", "Payroll that follows."],
    sub: "AI builds your schedule in seconds. Labor costs appear before the week begins. Your team gets everything on their phone. Say goodbye to spreadsheets.",
    ctaSee: "See how",
    shotAlt: "VAKTO dashboard in dark mode — labor ratio in real time",
    trust: "Workplaces across Iceland run on VAKTO",
    st1: "A schedule shouldn't cost you your Sunday night. VAKTO plans with AI, shows you the cost ",
    stEm: "before you publish",
    st2: " and tells you the moment something drifts. You run the place — not the spreadsheet.",
    industries: ["Restaurants", "Cafés", "Retail", "Hotels & stays", "Bakeries", "Chains & branches"],
    featHead: "Everything in one place. Finally.",
    featSub: "From the first schedule to paid salaries — one beautiful platform your people love to use.",
    features: [
      { title: "See your business in real time", desc: "Labor as a share of revenue, live through the day. Green when you're on target, red before it gets expensive. Better decisions while they're still cheap." },
      { title: "Schedules in seconds", desc: "Describe your week and AI drafts the staffing. Drag, tweak, publish — done." },
      { title: "Attendance that tracks itself", desc: "PIN, GPS or QR badge — in and out in a second. Overtime shows up in real time, not next month." },
      { title: "An ID that lives in the wallet", desc: "A digital employee ID in Apple Wallet and Google Wallet — photo, role and a QR code that clocks in and out. Plastic is history." },
      { title: "Payroll on autopilot", desc: "Base pay, premiums, overtime and bonuses — correct per union agreements, straight into Payday or DK. Zero manual work." },
      { title: "The app your team loves", desc: "Shifts, pay, swaps, time off and chat — all on their phone. One notification instead of twenty messages. Your people always know what's next, and the break-room notes are history." },
    ],
    gaugeTarget: "TARGET 30%",
    chat: ["Can anyone take Saturday?", "I got it!", "Swap approved ✓"],
    idLabel: "EMPLOYEE ID", idRole: "Chef · Kitchen",
    stepsHead: "Three steps. Fifteen minutes. Done.",
    steps: [
      { title: "Create your account", desc: "Your company, your people, your agreements — set up in fifteen minutes, not a week." },
      { title: "Let AI do the planning", desc: "Describe your week and AI staffs it by demand and rules. You approve — and the schedule lands on your team's phones, badge included." },
      { title: "See the cost up front", desc: "Labor cost shows before you publish, and deviations day by day. Month-end becomes just a date." },
    ],
    showHead: "See the real thing",
    showSub: "Actual screenshots from VAKTO — swipe through.",
    slides: [
      { title: "Dashboard", desc: "Your business in real time: hours, cost and labor % on one screen." },
      { title: "Scheduling", desc: "A full week in seconds with AI — see the cost before you publish." },
      { title: "Time tracking", desc: "Planned vs actual, overtime and deviations — live through the day." },
      { title: "People", desc: "Profiles, entitlements, documents and IDs in one place." },
      { title: "Reports", desc: "Hours, cost and comparisons — exported as Excel or PDF." },
      { title: "Time clock", desc: "A shared tablet on site — in and out with one tap." },
    ],
    appBadge: "Coming soon",
    appHead: "The app that goes home with your people",
    appSub: "The VAKTO app is on its way — everything your team needs, in their pocket.",
    appPoints: [
      "Shifts and what's next",
      "Clock in and out",
      "ID in Apple Wallet and Google Wallet",
      "Time off and shift swaps",
      "Notifications the moment anything changes",
    ],
    phNext: "Next shift", phShift: "Thu 9 July · 08:00–16:00", phClockIn: "Clock in",
    phWallet: "ID · Apple Wallet", phNotif: "Swap approved ✓",
    voicesHead: "Owners love VAKTO",
    voicesSub: "So do their teams. That's the whole trick.",
    voices: [
      { quote: "The schedule that ate two hours of my Sunday nights now takes five minutes. AI drafts it, I approve, and it lands on everyone's phone. I've never seen my labor cost this clearly.", role: "Owner, café in Reykjavík" },
      { quote: "The team adopted the app instantly. Swaps that used to end in twenty messages now happen in one tap — and I see deviations the same day.", role: "Restaurant operations manager" },
      { quote: "We saw immediately which days were overstaffed. Our labor ratio went from 36% to 31% in two months.", role: "Store manager" },
    ],
    priceHead: "One price. Everything included.",
    priceSub: "No tiers. No fine print. No lock-in.",
    priceAmt: "9,990", priceUnit: "ISK/mo · VAT included",
    priceItems: [
      "5 users included — +990 ISK per extra user",
      "AI scheduling, time clock and real-time labor %",
      "App, digital IDs, chat and reports",
      "Payday, DK and your POS systems",
    ],
    priceFine: "14-day free trial. No card.",
    ctaEnd: "Your business. In real time. Starting today.",
    ctaDemo: "Book a demo",
    footBlurb: "The future of workforce management: AI scheduling, payroll on autopilot and your business in real time — in one beautiful platform.",
    footProduct: "Product", footHow: "How it works", footPrice: "Pricing",
    footCompany: "Company", footContact: "Contact", footKiosk: "Time clock",
    footLegal: "Legal", footPrivacy: "Privacy", footTerms: "Terms", footCookies: "Cookies",
    footFollow: "Follow us",
    footCopy: "© 2026 VAKTO ehf.", footMade: "Designed and built in Iceland",
  },
};

/* ---------- shared bits ---------- */

function Logo({ w = 26 }: { w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
      <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
      <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
    </svg>
  );
}

function BrandWm({ b }: { b: Brand }) {
  if (b.img) {
    return (
      <img
        className="ny-wm-img"
        src={b.img}
        alt={b.name}
        title={b.name}
        loading="lazy"
        style={b.scale ? { height: `${Math.round(46 * b.scale)}px` } : undefined}
      />
    );
  }
  const wm = b.wm ?? {};
  const name = wm.case === "upper" ? b.name.toUpperCase() : wm.case === "lower" ? b.name.toLowerCase() : b.name;
  return (
    <span className="ny-wm" style={{ fontWeight: wm.weight ?? 700, letterSpacing: wm.spacing, fontFamily: wm.family === "serif" ? "Georgia, serif" : undefined }}>
      {name}
    </span>
  );
}

/** Gentle fade-up on viewport entry. Reduced motion renders instantly. */
function Rise({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ny-rise${seen ? " in" : ""}${className ? ` ${className}` : ""}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/* ---------- the industry planet: a glassy sphere cycling through the
   businesses VAKTO is built for ---------- */

const INDUSTRY_ICONS: React.ReactNode[] = [
  <path key="0" d="M7 3v7a2 2 0 0 0 2 2v9M9 3v5M5 3v5M17 3c-1.7 1.2-2.5 3.4-2.5 6v4H17m0-10v18" />,
  <g key="1"><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 5.5c0-1 .8-1 .8-2M11 5.5c0-1 .8-1 .8-2" /></g>,
  <g key="2"><path d="M4 8l1.5-4h13L20 8M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M4 8h16" /><path d="M9 12a3 3 0 0 0 6 0" /></g>,
  <g key="3"><path d="M3 20V6M3 16h18v4M3 12h18v-2a3 3 0 0 0-3-3h-8v5" /><circle cx="6.5" cy="9.5" r="1.5" /></g>,
  <g key="4"><path d="M6 12a6 6 0 0 1 12 0v7H6Z" /><path d="M9 12v3M12 11v4M15 12v3" /></g>,
  <g key="5"><path d="M3 21h18M5 21V7l5-4v18M14 21V11l5-3v13" /><path d="M8 9h.01M8 13h.01M8 17h.01" /></g>,
];

function IndustryOrb({ names }: { names: string[] }) {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % INDUSTRY_ICONS.length), 2400);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="ny-planet" aria-label={names.join(", ")}>
      <span className="ny-planet-swirl" aria-hidden="true" />
      <span className="ny-planet-shine" aria-hidden="true" />
      <div className="ny-planet-face" key={i}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{INDUSTRY_ICONS[i]}</svg>
        <span>{names[i]}</span>
      </div>
    </div>
  );
}

/* ---------- feature-card visuals (static mockups) ---------- */

const SLIDE_IMGS = [
  "/showcase/maelabord-dark.png",
  "/showcase/dark/vaktaplan.png",
  "/showcase/dark/timaskraning.png",
  "/showcase/dark/starfsfolk.png",
  "/showcase/dark/skyrslur.png",
  "/showcase/dark/kiosk.png",
];

/** Horizontal product showcase — scroll-snap slider with arrows + dots. */
function Showcase({ slides, head, sub }: { slides: { title: string; desc: string }[]; head: string; sub: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const go = (d: number) => {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>(".ny-slide");
    if (!slide) return;
    el.scrollBy({ left: d * (slide.offsetWidth + 20), behavior: "smooth" });
  };
  const onScroll = () => {
    const el = track.current;
    if (!el) return;
    const slide = el.querySelector<HTMLElement>(".ny-slide");
    if (!slide) return;
    setIdx(Math.min(slides.length - 1, Math.max(0, Math.round(el.scrollLeft / (slide.offsetWidth + 20)))));
  };
  return (
    <section className="ny-sec ny-showsec" id="kerfid">
      <Rise><div className="ny-head">
        <h2>{head}</h2>
        <p>{sub}</p>
      </div></Rise>
      <Rise delay={60}>
        <div className="ny-show">
          <button className="ny-show-arr l" aria-label="Fyrri" onClick={() => go(-1)} disabled={idx === 0}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M15 5l-7 7 7 7" /></svg>
          </button>
          <div className="ny-show-track" ref={track} onScroll={onScroll}>
            {slides.map((s, i) => (
              <figure className="ny-slide" key={i}>
                <img src={SLIDE_IMGS[i]} alt={s.title} loading="lazy" />
                <figcaption><b>{s.title}</b><span>{s.desc}</span></figcaption>
              </figure>
            ))}
          </div>
          <button className="ny-show-arr r" aria-label="Næsta" onClick={() => go(1)} disabled={idx === slides.length - 1}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
        <div className="ny-show-dots" aria-hidden="true">
          {slides.map((_, i) => <i key={i} className={i === idx ? "on" : ""} />)}
        </div>
      </Rise>
    </section>
  );
}

/** The future mobile app — CSS iPhone mockup with placeholder screens. */
function AppPreview({ t }: { t: (typeof T)["is"] }) {
  return (
    <section className="ny-sec ny-appsec">
      <Rise className="ny-app-grid">
        <div className="ny-app-txt">
          <span className="ny-app-badge">{t.appBadge}</span>
          <h2>{t.appHead}</h2>
          <p>{t.appSub}</p>
          <ul>
            {t.appPoints.map((pt) => (
              <li key={pt}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><path d="M5 12.5l4 4 10-10" /></svg>
                {pt}
              </li>
            ))}
          </ul>
        </div>
        <div className="ny-app-vis" aria-hidden="true">
          <span className="ny-app-glow" />
          <div className="ny-phone-real">
            <img className="frame" src="/app/phone-side.png" alt="" width={383} height={849} loading="lazy" />
            <div className="ny-phone-ui">
              <div className="ph-head"><Logo w={14} /><b>VAKTO</b><span className="av">MÍ</span></div>
              <div className="ph-card">
                <small>{t.phNext}</small>
                <b>{t.phShift}</b>
              </div>
              <button className="ph-clock">{t.phClockIn}</button>
              <div className="ph-wallet">
                <div className="wtop"><b>VAKTO</b><span /></div>
                <div className="wbot"><span className="wav">MÍ</span><i>{t.phWallet}</i></div>
              </div>
              <div className="ph-notif">
                <span className="dot" />{t.phNotif}
              </div>
            </div>
          </div>
        </div>
      </Rise>
    </section>
  );
}

const FEATURE_VISUALS = ["gauge", "grid", "pulse", "card", "rows", "chat"] as const;
const FEATURE_LAYOUT = [{ big: true }, {}, {}, {}, {}, { wide: true }] as const;

const VOICE_IMGS = ["/folk/gudrun.jpg", "/folk/stefan.jpg", "/folk/elisabet.jpg"];
const VOICE_NAMES = ["Guðrún Ósk", "Stefán Örn", "Elísabet Anna"];

export default function NyClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [lang, setLang] = useState<Lang>("is");
  useEffect(() => {
    try {
      const saved = localStorage.getItem("vakto-lang");
      if (saved === "en") setLang("en");
    } catch {}
  }, []);
  const t = T[lang];
  const q = lang === "en" ? "?lang=en" : "";
  function toggleLang() {
    const next: Lang = lang === "is" ? "en" : "is";
    setLang(next);
    try { localStorage.setItem("vakto-lang", next); } catch {}
  }
  const langBtn = (
    <button className="ny-lang" onClick={toggleLang} aria-label={lang === "is" ? "Switch to English" : "Skipta yfir á íslensku"}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z" /></svg>
      {lang === "is" ? "EN" : "IS"}
    </button>
  );

  return (
    <div className="ny">
      {/* floating glass pill nav */}
      <nav className="ny-nav">
        <a className="ny-logo" href="/"><Logo w={24} />VAKTO</a>
        <div className="ny-links">
          <a href="#eiginleikar">{t.nav[0]}</a>
          <a href="#skref">{t.nav[1]}</a>
          <a href="#verd">{t.nav[2]}</a>
        </div>
        <div className="ny-navcta">
          {langBtn}
          <a className="ny-btn ghost" href={`/login${q}`}>{t.login}</a>
          <a className="ny-btn glow" href={`/nyskraning${q}`}>{t.start}</a>
        </div>
        <button
          className={`ny-burger${menuOpen ? " open" : ""}`}
          aria-label={menuOpen ? "Loka valmynd" : "Opna valmynd"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          <i /><i />
        </button>
        {menuOpen && (
          <div className="ny-menu" onClick={() => setMenuOpen(false)}>
            <a href="#eiginleikar">{t.nav[0]}</a>
            <a href="#skref">{t.nav[1]}</a>
            <a href="#verd">{t.nav[2]}</a>
            <div className="ny-menu-sep" />
            <div onClick={(e) => e.stopPropagation()}>{langBtn}</div>
            <a className="ny-btn ghost" href={`/login${q}`}>{t.login}</a>
            <a className="ny-btn glow" href={`/nyskraning${q}`}>{t.start}</a>
          </div>
        )}
      </nav>

      {/* ---------- hero: the midnight-sun horizon ---------- */}
      <header className="ny-hero">
        <div className="ny-aurora" aria-hidden="true">
          <span className="ny-stars s1" />
          <span className="ny-stars s2" />
          <i className="a1" /><i className="a2" /><i className="a3" />
          <span className="ny-rays r1" />
          <span className="ny-rays r2" />
          <span className="ny-rays r3" />
          <span className="ny-horizon" />
          <span className="ny-underglow" />
        </div>
        <div className="ny-hero-in">
          <span className="ny-pill ny-hin" style={{ animationDelay: "350ms" }}>{t.pill}</span>
          <h1 className="ny-hin" style={{ animationDelay: "480ms" }}>
            {t.h1[0]}<br />{t.h1[1]}
          </h1>
          <p className="ny-sub ny-hin" style={{ animationDelay: "620ms" }}>{t.sub}</p>
          <div className="ny-ctas ny-hin" style={{ animationDelay: "760ms" }}>
            <a className="ny-btn glow lg" href={`/nyskraning${q}`}>{t.start}</a>
            <a className="ny-btn ghost lg" href="#eiginleikar">{t.ctaSee}</a>
          </div>
          <div className="ny-shot ny-hin" style={{ animationDelay: "900ms" }}>
            <img src="/showcase/maelabord-dark.png" alt={t.shotAlt} />
          </div>
        </div>
      </header>

      {/* customers */}
      <section className="ny-trust">
        <Rise>
          <p>{t.trust}</p>
          <div className="ny-wall">
            <div className="ny-wall-track">
              <div className="ny-wall-set">{CUSTOMERS.map((b) => <BrandWm key={b.slug} b={b} />)}</div>
              <div className="ny-wall-set" aria-hidden="true">{CUSTOMERS.map((b) => <BrandWm key={b.slug} b={b} />)}</div>
            </div>
          </div>
        </Rise>
      </section>

      {/* statement + industry planet */}
      <section className="ny-state">
        <Rise className="ny-state-grid">
          <p className="ny-statement">
            {t.st1}<em>{t.stEm}</em>{t.st2}
          </p>
          <IndustryOrb names={t.industries} />
        </Rise>
      </section>

      {/* ---------- features: glass cards with glow ---------- */}
      <section className="ny-sec" id="eiginleikar">
        <Rise><div className="ny-head">
          <h2>{t.featHead}</h2>
          <p>{t.featSub}</p>
        </div></Rise>
        <div className="ny-cards">
          {t.features.map((f, i) => {
            const visual = FEATURE_VISUALS[i];
            const layout = FEATURE_LAYOUT[i] as { big?: boolean; wide?: boolean };
            return (
              <Rise className={`ny-card${layout.big ? " big" : ""}${layout.wide ? " wide" : ""}`} delay={(i % 2) * 80} key={visual}>
                <div className="ny-card-vis" aria-hidden="true">
                  {visual === "gauge" && (
                    <div className="ny-gauge"><div className="ny-gring"><span>28,4%</span></div><small>{t.gaugeTarget}</small></div>
                  )}
                  {visual === "grid" && (
                    <div className="ny-minigrid">{Array.from({ length: 28 }, (_, j) => <i key={j} className={[3, 4, 9, 12, 17, 18, 24].includes(j) ? "on" : [6, 20, 26].includes(j) ? "eve" : ""} />)}</div>
                  )}
                  {visual === "pulse" && (
                    <div className="ny-clock"><span className="ring" /><span className="ring r2" /><b>08:02</b></div>
                  )}
                  {visual === "rows" && (
                    <div className="ny-rows"><i style={{ width: "72%" }} /><i style={{ width: "54%" }} /><i style={{ width: "84%" }} /><i style={{ width: "40%" }} /></div>
                  )}
                  {visual === "chat" && (
                    <div className="ny-chat">
                      <span className="bub them">{t.chat[0]}</span>
                      <span className="bub me">{t.chat[1]}</span>
                      <span className="bub tag">{t.chat[2]}</span>
                    </div>
                  )}
                  {visual === "card" && (
                    <div className="ny-idcard">
                      <div className="top"><b>VAKTO</b><span>{t.idLabel}</span></div>
                      <div className="body">
                        <span className="av">MÍ</span>
                        <div className="tx"><b>Mína Huong</b><span>{t.idRole}</span></div>
                        <span className="qr">{Array.from({ length: 25 }, (_, j) => <i key={j} className={[0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24].includes(j) ? "on" : ""} />)}</span>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ny-card-txt">
                  <h3>{f.title}</h3>
                  <p>{f.desc}</p>
                </div>
              </Rise>
            );
          })}
        </div>
      </section>

      {/* ---------- steps ---------- */}
      <section className="ny-sec" id="skref">
        <Rise><div className="ny-head">
          <h2>{t.stepsHead}</h2>
        </div></Rise>
        <div className="ny-steps">
          {t.steps.map((s, i) => (
            <Rise className="ny-step" delay={i * 90} key={i}>
              <span className="n">{`0${i + 1}`}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </Rise>
          ))}
        </div>
      </section>

      {/* product showcase — real screenshots in a slider */}
      <Showcase slides={t.slides} head={t.showHead} sub={t.showSub} />

      {/* voices: featured card + two smaller (photos generated for the preview) */}
      <section className="ny-sec ny-voices">
        <Rise><div className="ny-head">
          <h2>{t.voicesHead}</h2>
          <p>{t.voicesSub}</p>
        </div></Rise>
        <Rise delay={70}><div className="ny-voice-main">
          <img src={VOICE_IMGS[0]} alt={VOICE_NAMES[0]} loading="lazy" />
          <div className="vx">
            <blockquote>„{t.voices[0].quote}"</blockquote>
            <div className="who"><b>{VOICE_NAMES[0]}</b><span>{t.voices[0].role}</span></div>
          </div>
        </div></Rise>
        <div className="ny-voice-grid">
          {t.voices.slice(1).map((v, i) => (
            <Rise className="ny-voice" delay={i * 90} key={VOICE_NAMES[i + 1]}>
              <blockquote>„{v.quote}"</blockquote>
              <div className="who">
                <img src={VOICE_IMGS[i + 1]} alt={VOICE_NAMES[i + 1]} loading="lazy" />
                <div><b>{VOICE_NAMES[i + 1]}</b><span>{v.role}</span></div>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      {/* the future mobile app */}
      <AppPreview t={t} />

      {/* ---------- pricing ---------- */}
      <section className="ny-sec" id="verd">
        <Rise><div className="ny-head">
          <h2>{t.priceHead}</h2>
          <p>{t.priceSub}</p>
        </div></Rise>
        <Rise delay={80}><div className="ny-price">
          <div className="ny-price-glow" aria-hidden="true" />
          <div className="ny-amt">{t.priceAmt} <small>{t.priceUnit}</small></div>
          <ul>
            {t.priceItems.map((it) => <li key={it}>{it}</li>)}
          </ul>
          <a className="ny-btn glow lg" href={`/nyskraning${q}`}>{t.start}</a>
          <span className="ny-fine">{t.priceFine}</span>
        </div></Rise>
      </section>

      {/* CTA + giant wordmark footer */}
      <section className="ny-cta">
        <Rise>
          <h2>{t.ctaEnd}</h2>
          <div className="ny-ctas" style={{ justifyContent: "center" }}>
            <a className="ny-btn glow lg" href={`/nyskraning${q}`}>{t.start}</a>
            <a className="ny-btn ghost lg" href="mailto:hallo@vakto.is">{t.ctaDemo}</a>
          </div>
        </Rise>
      </section>

      <footer className="ny-foot">
        <span className="ny-foot-aurora" aria-hidden="true" />
        <div className="ny-foot-grid">
          <div className="ny-foot-brand">
            <a className="ny-logo" href="/"><Logo w={22} />VAKTO</a>
            <p>{t.footBlurb}</p>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footProduct}</h4>
            <a href="#eiginleikar">{t.nav[0]}</a>
            <a href="#skref">{t.footHow}</a>
            <a href="#verd">{t.footPrice}</a>
            <a href={`/nyskraning${q}`}>{t.start}</a>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footCompany}</h4>
            <a href="mailto:hallo@vakto.is">{t.footContact}</a>
            <a href={`/login${q}`}>{t.login}</a>
            <a href="/kiosk">{t.footKiosk}</a>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footLegal}</h4>
            <a href="#">{t.footPrivacy}</a>
            <a href="#">{t.footTerms}</a>
            <a href="#">{t.footCookies}</a>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footFollow}</h4>
            <a href="#">Instagram</a>
            <a href="#">Facebook</a>
            <a href="#">LinkedIn</a>
          </div>
        </div>
        <div className="ny-foot-bot">
          <span>{t.footCopy}</span>
          <span>{t.footMade}</span>
        </div>
        <div className="ny-mark" aria-hidden="true">VAKTO</div>
      </footer>
    </div>
  );
}
