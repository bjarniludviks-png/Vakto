"use client";

// The "miðnætursól" homepage — deep black with a glowing orange aurora horizon.
// Bilingual (IS/EN): all copy lives in T below, toggled by the nav globe and
// persisted in localStorage("vakto-lang") — the same key the app shell uses.
//
// Positioning (sept. 2026): the page sells what Sling/Planday & co. do NOT have
// (labor % of revenue live, deviations with pay impact, contracts + e-sign in
// the app, Wallet IDs, Messenger chat, handbooks with read receipts, union pay
// rules) — the basics everyone has are a chip list further down.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { CUSTOMERS, type Brand } from "../home-data";

type Lang = "is" | "en";

/* Persisted language (localStorage "vakto-lang") as a tiny external store, so
   the first client render matches the server ("is") and no setState runs
   inside an effect. */
const LANG_KEY = "vakto-lang";
const langListeners = new Set<() => void>();
function readLang(): Lang {
  try { return localStorage.getItem(LANG_KEY) === "en" ? "en" : "is"; } catch { return "is"; }
}
function writeLang(next: Lang) {
  try { localStorage.setItem(LANG_KEY, next); } catch {}
  langListeners.forEach((fn) => fn());
}
function subscribeLang(fn: () => void) {
  langListeners.add(fn);
  window.addEventListener("storage", fn);
  return () => { langListeners.delete(fn); window.removeEventListener("storage", fn); };
}

type Plan = { name: string; price: string; unit: string; desc: string; items: string[]; cta: string };
type ProPlan = Omit<Plan, "price"> & { badge: string; priceM: string; priceY: string; yearNote: string };

/* ---------- copy ---------- */

const T: Record<Lang, {
  nav: [string, string, string];
  login: string; start: string;
  pill: string; h1: [string, string]; sub: string; ctaSee: string;
  shotAlt: string;
  liveLabel: string; liveSuffix: string; liveNote: string;
  trust: string;
  st1: string; stEm: string; st2: string;
  industries: [string, string, string, string, string, string];
  featHead: string; featSub: string;
  features: { title: string; desc: string }[];
  gaugeTarget: string;
  chat: [string, string, string];
  idLabel: string; idRole: string;
  signedTag: string; readTag: string;
  basicsHead: string; basicsSub: string;
  basics: string[]; basicsMore: string;
  showHead: string; showSub: string;
  slides: { title: string; desc: string }[];
  appBadge: string; appHead: string; appSub: string;
  appPoints: string[];
  phNext: string; phSince: string; phClockOut: string;
  phRows: [string, string][];
  phSum: string; phSumRows: [string, string][];
  phLeave: string; phSwap: string;
  phoneTabs: [string, string];
  skRole: string; skRoleV: string; skNo: string; skScan: string;
  voicesHead: string; voicesSub: string;
  voices: { quote: string; role: string }[];
  priceHead: string; priceSub: string;
  billMonthly: string; billYearly: string; billSave: string;
  planFree: Plan; planPro: ProPlan;
  priceFine: string;
  ctaEnd: string; ctaDemo: string;
  footBlurb: string;
  footProduct: string;
  footCompany: string; footContact: string; footKiosk: string;
  footLegal: string; footPrivacy: string; footTerms: string; footCookies: string;
  footCopy: string; footMade: string;
}> = {
  is: {
    nav: ["Það sem hin gera ekki", "Grunnurinn", "Verð"],
    login: "Innskráning", start: "Prófa frítt í 14 daga",
    pill: "Vaktaplan · stimpilklukka · laun — og eitt sem enginn annar gerir",
    h1: ["Sjáðu launakostnaðinn sem % af veltu.", "Í rauntíma."],
    sub: "Allir eru með vaktaplan. VAKTO segir þér hvað planið kostar á móti veltunni á meðan vaktin er enn í gangi — grænt, gult eða rautt — og hjálpar þér að laga það áður en mánuðurinn er búinn.",
    ctaSee: "Sjáðu muninn",
    shotAlt: "VAKTO mælaborð — launakostnaður sem % af veltu í rauntíma",
    liveLabel: "Laun % af veltu", liveSuffix: "í rauntíma", liveNote: "Sýnidæmi",
    trust: "Vinnustaðir um allt Ísland keyra á VAKTO",
    st1: "Vaktaplan er ekki vandamálið. Launakostnaðurinn er það. VAKTO sýnir þér hann sem hlutfall af veltu, lifandi, ",
    stEm: "áður en mánuðurinn er búinn",
    st2: " — og starfsfólkið fær app sem það nennir að nota.",
    industries: ["Veitingastaðir", "Kaffihús", "Verslanir", "Hótel & gisting", "Bakarí", "Keðjur & útibú"],
    featHead: "Sjö hlutir sem vaktakerfin þín gera ekki.",
    featSub: "Sling, Planday og félagar eru með vaktaplan. Það erum við líka. Þetta er það sem gerir VAKTO öðruvísi.",
    features: [
      { title: "Laun sem % af veltu — í rauntíma", desc: "Ekki bara launakostnaður í krónum heldur hlutfall af veltunni, lifandi yfir daginn og litakóðað eftir markmiðinu þínu." },
      { title: "Tímafrávik í rauntíma með launaáhrifum", desc: "Of seint, fór fyrr, yfirvinna, gleymd útstimplun. Merkt um leið og það gerist og þú sérð strax hvað það kostar." },
      { title: "Ráðningarsamningar gerðir og undirritaðir í appinu", desc: "Samningurinn verður til úr starfsmannagögnunum, starfsmaðurinn les og samþykkir rafrænt í símanum. Enginn pappír." },
      { title: "Starfsmannaskírteini í Apple og Google Wallet", desc: "Mynd, staða, deild og QR-kóði. Skannað á stimpilklukkunni — inn og út án PIN-númera og plastkorta." },
      { title: "Innbyggt Messenger-spjall + fréttaveita", desc: "Rásir per stað og deild, bein skilaboð, myndir, viðbrögð og push í símann. Ekkert Slack, engin Facebook-grúppa." },
      { title: "Handbækur í appinu með lestrar-staðfestingu", desc: "Starfsmannahandbók, HACCP og verklag beint í símann. Starfsfólk staðfestir lestur og þú sérð hverjir eiga eftir." },
      { title: "Reiknireglur eftir kjarasamningi", desc: "Veldu stéttarfélag og álög, yfirvinna og uppbætur reiknast rétt sjálfkrafa. Sérreglur þegar þú þarft þær." },
    ],
    gaugeTarget: "MARKMIÐ 32%",
    chat: ["Getur einhver tekið laugardagsvaktina?", "Ég tek hana", "Vaktaskipti samþykkt"],
    idLabel: "STARFSMANNASKÍRTEINI", idRole: "Kokkur · Eldhús",
    signedTag: "Undirritað", readTag: "Lesið",
    basicsHead: "Auðvitað líka allt það klassíska.",
    basicsSub: "Þú missir ekkert af því sem þú ert vanur — þú færð bara miklu meira ofan á.",
    basics: [
      "Vaktaplan með drag & drop",
      "Stimpilklukka — app, GPS og kiosk",
      "Frí- og leyfisbeiðnir",
      "Vaktaskipti og opnar vaktir",
      "Launaútreikningur",
      "Skýrslur og útflutningur",
      "Excel-innlestur á starfsfólki",
      "Payday og DK",
    ],
    basicsMore: "…en miklu meira",
    showHead: "Svona lítur það út — engar teikningar.",
    showSub: "Skjámyndir teknar beint úr VAKTO í september 2026.",
    slides: [
      { title: "Mælaborð", desc: "Ein tala efst: laun % af veltu — í gær og þessi vika, litakóðuð." },
      { title: "Tímafrávik", desc: "Of seint, yfir áætlun, gleymd útstimplun — sía á frávik og samþykktu restina í einu." },
      { title: "Vaktaplan", desc: "Vikan á nokkrum mínútum — áætlaður launakostnaður áður en þú birtir." },
      { title: "Spjall", desc: "Vaktaskipti, innkaup og tilkynningar — í spjalli sem starfsfólkið opnar daglega." },
      { title: "Skírteini", desc: "QR-kóði sem stimplar inn á kiosknum — og fer í Apple eða Google Wallet." },
    ],
    appBadge: "Í prófun",
    appHead: "Appið sem starfsfólkið fær",
    appSub: "Starfsmaðurinn sér bara það sem skiptir hann máli — og þú sleppur við tuttugu skilaboð á dag.",
    appPoints: [
      "Stimpla inn og út — ein snerting",
      "Vaktirnar og næsta vakt",
      "Beiðnir: frí, skipti, opnar vaktir",
      "Spjall og fréttir í rauntíma",
      "Launin, réttindin og skírteinið",
    ],
    phNext: "Næsta vakt", phSince: "Á vakt síðan 08:01", phClockOut: "Stimpla út",
    phRows: [["Í dag · Fim 9. júlí", "08:00–16:00"], ["Fös 10. júlí", "10:00–18:00"], ["Lau 11. júlí", "12:00–20:00 · +45%"]],
    phSum: "Samantekt", phSumRows: [["Tímar vikunnar", "32,0 klst"], ["Næsta útborgun", "1. ágúst"]],
    phLeave: "Sækja um frí", phSwap: "Skipta á vakt",
    phoneTabs: ["Mitt svæði", "Skírteinið"],
    skRole: "Staða", skRoleV: "Kokkur", skNo: "Nr.", skScan: "Skannaðu á stimpilklukkunni",
    voicesHead: "Rekstrarfólk elskar VAKTO",
    voicesSub: "Og starfsfólkið líka. Það er allur galdurinn.",
    voices: [
      { quote: "Vaktaplanið sem tók tvo tíma á sunnudagskvöldum tekur núna fimm mínútur. AI raðar, ég samþykki og fólkið fær það beint í símann. Ég hef aldrei séð launakostnaðinn jafn skýrt og núna.", role: "Eigandi, kaffihús í Reykjavík" },
      { quote: "Starfsfólkið tók appinu samstundis. Vaktaskipti sem enduðu áður í tuttugu skilaboðum gerast núna með einum smelli — og ég sé frávikin samdægurs.", role: "Rekstrarstjóri veitingahúss" },
      { quote: "Við sáum strax hvaða dagar voru ofmannaðir. Launahlutfallið fór úr 36% í 31% á tveimur mánuðum.", role: "Verslunarstjóri" },
    ],
    priceHead: "Byrjaðu frítt. Uppfærðu þegar þú vilt sjá arðsemina.",
    priceSub: "Frítt fyrir litla staði. Pro þegar þú vilt sjá launin á móti veltunni.",
    billMonthly: "Mánaðarlega", billYearly: "Árlega", billSave: "15% afsláttur",
    planFree: {
      name: "Frítt", price: "0", unit: "kr · allt að 10 notendur",
      desc: "Grunnurinn sem allir þurfa — án kostnaðar.",
      items: [
        "Vaktaplan með drag & drop",
        "Stimpilklukka — app og kiosk",
        "Frí- og leyfisbeiðnir",
        "Vaktaskipti og opnar vaktir",
        "Spjall og fréttaveita",
      ],
      cta: "Byrja frítt",
    },
    planPro: {
      name: "Pro", badge: "Vinsælast",
      priceM: "590", priceY: "500", unit: "kr/notanda/mán", yearNote: "greitt árlega",
      desc: "Allt sem hin kerfin gera ekki.",
      items: [
        "Laun sem % af veltu í rauntíma",
        "Tímafrávik með launaáhrifum",
        "Launaútreikningur eftir kjarasamningi",
        "Ráðningarsamningar og rafræn undirritun",
        "Handbækur með lestrar-staðfestingu",
        "Skírteini í Apple og Google Wallet",
        "Skýrslur og útflutningur í Payday og DK",
        "Ótakmarkaður fjöldi notenda",
      ],
      cta: "Prófa Pro frítt í 14 daga",
    },
    priceFine: "Verð án VSK. 14 daga frí prufa, ekkert kort. Keðjur með marga staði: hafðu samband.",
    ctaEnd: "Sjáðu hvað vaktin kostar — áður en hún klárast.",
    ctaDemo: "Skoða demo",
    footBlurb: "Vaktaplan, stimpilklukka og laun — og launakostnaðurinn sem % af veltu í rauntíma. Hannað fyrir íslenska vinnustaði.",
    footProduct: "Vara",
    footCompany: "Fyrirtækið", footContact: "Hafa samband", footKiosk: "Stimpilklukka",
    footLegal: "Lögfræði", footPrivacy: "Persónuvernd", footTerms: "Skilmálar", footCookies: "Vafrakökur",
    footCopy: "© 2026 VAKTO ehf.", footMade: "Hannað og þróað á Íslandi",
  },
  en: {
    nav: ["What others don't do", "The basics", "Pricing"],
    login: "Sign in", start: "Try free for 14 days",
    pill: "Scheduling · time clock · payroll — and one thing nobody else does",
    h1: ["See labor cost as a % of revenue.", "In real time."],
    sub: "Everyone has scheduling. VAKTO tells you what the schedule costs against revenue while the shift is still running — green, amber or red — and helps you fix it before the month is over.",
    ctaSee: "See the difference",
    shotAlt: "VAKTO dashboard — labor cost as a % of revenue in real time",
    liveLabel: "Labor % of revenue", liveSuffix: "live", liveNote: "Illustration",
    trust: "Workplaces across Iceland run on VAKTO",
    st1: "The schedule isn't the problem. Labor cost is. VAKTO shows it to you as a share of revenue, live, ",
    stEm: "before the month is over",
    st2: " — and your staff get an app they actually want to use.",
    industries: ["Restaurants", "Cafés", "Retail", "Hotels & stays", "Bakeries", "Chains & branches"],
    featHead: "Seven things your scheduling tools don't do.",
    featSub: "Sling, Planday and friends have scheduling. So do we. This is what makes VAKTO different.",
    features: [
      { title: "Labor as a % of revenue — in real time", desc: "Not just labor cost in krónur but as a share of revenue, live through the day and color-coded against your target." },
      { title: "Time deviations in real time, with the pay impact", desc: "Late, left early, overtime, forgotten clock-out. Flagged the moment it happens, and you see right away what it costs." },
      { title: "Employment contracts created and signed in the app", desc: "The contract is generated from the employee's data; the employee reads and accepts it electronically on their phone. No paper." },
      { title: "Staff ID in Apple and Google Wallet", desc: "Photo, role, department and a QR code. Scanned at the time clock — in and out without PINs or plastic cards." },
      { title: "Built-in Messenger-style chat + news feed", desc: "Channels per location and department, direct messages, photos, reactions and push to the phone. No Slack, no Facebook group." },
      { title: "Handbooks in the app with read confirmation", desc: "Employee handbook, HACCP and procedures straight to the phone. Staff confirm they've read them and you see who still hasn't." },
      { title: "Pay rules per union agreement", desc: "Pick the union, and premiums, overtime and bonuses are calculated correctly, automatically. Custom rules when you need them." },
    ],
    gaugeTarget: "TARGET 32%",
    chat: ["Can anyone take Saturday's shift?", "I'll take it", "Swap approved"],
    idLabel: "EMPLOYEE ID", idRole: "Chef · Kitchen",
    signedTag: "Signed", readTag: "Read",
    basicsHead: "And of course, all the classics.",
    basicsSub: "You lose nothing you're used to — you just get a lot more on top.",
    basics: [
      "Drag & drop scheduling",
      "Time clock — app, GPS and kiosk",
      "Time-off and leave requests",
      "Shift swaps and open shifts",
      "Payroll calculation",
      "Reports and exports",
      "Excel import of staff",
      "Payday and DK",
    ],
    basicsMore: "…and much more",
    showHead: "This is what it looks like — no mockups.",
    showSub: "Screenshots taken straight from VAKTO in September 2026.",
    slides: [
      { title: "Dashboard", desc: "One number at the top: labor % of revenue — yesterday and this week, color-coded." },
      { title: "Time deviations", desc: "Late, over plan, forgotten clock-out — filter to the deviations and approve the rest in one go." },
      { title: "Scheduling", desc: "The week in a few minutes — estimated labor cost before you publish." },
      { title: "Chat", desc: "Swaps, purchases and announcements — in a chat your staff open every day." },
      { title: "ID card", desc: "A QR code that clocks in at the kiosk — and goes into Apple or Google Wallet." },
    ],
    appBadge: "In testing",
    appHead: "The app your staff get",
    appSub: "Employees see only what matters to them — and you skip twenty messages a day.",
    appPoints: [
      "Clock in and out — one tap",
      "Shifts and what's next",
      "Requests: time off, swaps, open shifts",
      "Chat and news in real time",
      "Pay, entitlements and the ID card",
    ],
    phNext: "Next shift", phSince: "On shift since 08:01", phClockOut: "Clock out",
    phRows: [["Today · Thu 9 July", "08:00–16:00"], ["Fri 10 July", "10:00–18:00"], ["Sat 11 July", "12:00–20:00 · +45%"]],
    phSum: "Summary", phSumRows: [["Hours this week", "32.0 h"], ["Next payday", "1 August"]],
    phLeave: "Request time off", phSwap: "Swap a shift",
    phoneTabs: ["My area", "ID card"],
    skRole: "Role", skRoleV: "Chef", skNo: "No.", skScan: "Scan at the time clock",
    voicesHead: "Owners love VAKTO",
    voicesSub: "So do their teams. That's the whole trick.",
    voices: [
      { quote: "The schedule that ate two hours of my Sunday nights now takes five minutes. AI drafts it, I approve, and it lands on everyone's phone. I've never seen my labor cost this clearly.", role: "Owner, café in Reykjavík" },
      { quote: "The team adopted the app instantly. Swaps that used to end in twenty messages now happen in one tap — and I see deviations the same day.", role: "Restaurant operations manager" },
      { quote: "We saw immediately which days were overstaffed. Our labor ratio went from 36% to 31% in two months.", role: "Store manager" },
    ],
    priceHead: "Start free. Upgrade when you want to see profitability.",
    priceSub: "Free for small places. Pro when you want to see labor against revenue.",
    billMonthly: "Monthly", billYearly: "Yearly", billSave: "15% off",
    planFree: {
      name: "Free", price: "0", unit: "ISK · up to 10 users",
      desc: "The basics everyone needs — at no cost.",
      items: [
        "Drag & drop scheduling",
        "Time clock — app and kiosk",
        "Time-off and leave requests",
        "Shift swaps and open shifts",
        "Chat and news feed",
      ],
      cta: "Start free",
    },
    planPro: {
      name: "Pro", badge: "Most popular",
      priceM: "590", priceY: "500", unit: "ISK/user/mo", yearNote: "billed yearly",
      desc: "Everything the other tools don't do.",
      items: [
        "Labor as a % of revenue in real time",
        "Time deviations with pay impact",
        "Payroll per union agreement",
        "Employment contracts and e-signature",
        "Handbooks with read confirmation",
        "ID in Apple and Google Wallet",
        "Reports and exports to Payday and DK",
        "Unlimited users",
      ],
      cta: "Try Pro free for 14 days",
    },
    priceFine: "Prices excl. VAT. 14-day free trial, no card. Chains with many locations: get in touch.",
    ctaEnd: "See what the shift costs — before it's over.",
    ctaDemo: "View demo",
    footBlurb: "Scheduling, a time clock and payroll — and labor cost as a % of revenue in real time. Built for Icelandic workplaces.",
    footProduct: "Product",
    footCompany: "Company", footContact: "Contact", footKiosk: "Time clock",
    footLegal: "Legal", footPrivacy: "Privacy", footTerms: "Terms", footCookies: "Cookies",
    footCopy: "© 2026 VAKTO ehf.", footMade: "Designed and built in Iceland",
  },
};

/* ---------- shared bits ---------- */

/* Seeded PRNG so the starfield is identical on server and client (no hydration
   mismatch) but looks genuinely random — no tiling, so no accidental rows. */
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* Jittered-grid sampling: one candidate star per cell, randomly offset within
   it — evenly spread without clumps or straight lines. */
function Starfield({ layer }: { layer: 1 | 2 }) {
  const rnd = mulberry32(layer === 1 ? 0x5747a1 : 0x36c9d3);
  const cols = 16, rows = 9, cw = 1600 / cols, ch = 900 / rows;
  const colors = ["255,255,255", "255,244,230", "214,228,255"];
  const stars = [];
  for (let gy = 0; gy < rows; gy++) {
    for (let gx = 0; gx < cols; gx++) {
      const keep = rnd() < (layer === 1 ? 0.62 : 0.5);
      const x = gx * cw + cw * (0.08 + rnd() * 0.84);
      const y = gy * ch + ch * (0.08 + rnd() * 0.84);
      const r = 0.5 + rnd() * (layer === 1 ? 1.0 : 0.8);
      const c = colors[Math.floor(rnd() * colors.length)];
      const o = 0.35 + rnd() * 0.55;
      if (!keep) continue;
      stars.push(<circle key={`${gx}-${gy}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill={`rgba(${c},${o.toFixed(2)})`} />);
    }
  }
  return (
    <svg className={`ny-stars s${layer}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      {stars}
    </svg>
  );
}

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
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.classList.add("in"); return; }
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

/** Small check icon used in visual tags/badges (line icon, no emoji). */
function Check({ sw = 2.2 }: { sw?: number }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4 4 10-10" /></svg>
  );
}

/* ---------- the live labor-% pill floating over the hero screenshot ----------
   Renders 31,6 on the server and the first client paint (no hydration
   mismatch); only after mount does it drift gently between 29,8 and 32,4. */
const LIVE_START = 31.6, LIVE_MIN = 29.8, LIVE_MAX = 32.4;

function LivePill({ label, suffix, note, lang }: { label: string; suffix: string; note: string; lang: Lang }) {
  const [v, setV] = useState(LIVE_START);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      setV((cur) => {
        const step = (Math.random() - 0.5) * 0.7;
        const next = Math.min(LIVE_MAX, Math.max(LIVE_MIN, cur + step));
        return Math.round(next * 10) / 10;
      });
    }, 2500);
    return () => clearInterval(id);
  }, []);
  const num = v.toFixed(1);
  const shown = lang === "is" ? num.replace(".", ",") : num;
  return (
    <div className="ny-livewrap">
      <span className="ny-livepill" aria-live="off">
        <i className="dot" aria-hidden="true" />
        <span className="lbl">{label}</span>
        <span className="sep" aria-hidden="true">·</span>
        <b>{shown} %</b>
        <span className="sep" aria-hidden="true">·</span>
        <span className="lbl">{suffix}</span>
      </span>
      <small className="ny-livenote">{note}</small>
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

/* ---------- product showcase (real screenshots, sept. 2026) ---------- */

// One set of screenshots (taken from the IS product) is used for both languages.
const SLIDE_KEYS = ["maelabord", "timafravik", "vaktaplan", "spjall", "skirteini"];
const slideImg = (key: string) => `/showcase/2026/${key}.jpg`;

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
              <figure className="ny-slide" key={SLIDE_KEYS[i]}>
                <img src={slideImg(SLIDE_KEYS[i])} alt={s.title} loading="lazy" />
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

/** Pseudo-QR for the badge preview — deterministic pattern with real-looking
    finder squares in three corners, no actual payload. */
function MiniQr() {
  const n = 13;
  const rnd = mulberry32(0x51c0de);
  const inFinder = (r: number, c: number) => {
    const zones: [number, number][] = [[0, 0], [0, n - 5], [n - 5, 0]];
    for (const [zr, zc] of zones) {
      const lr = r - zr, lc = c - zc;
      if (lr >= 0 && lr < 5 && lc >= 0 && lc < 5) {
        return lr === 0 || lr === 4 || lc === 0 || lc === 4 || (lr === 2 && lc === 2) ? "on" : "off";
      }
    }
    return null;
  };
  const cells: boolean[] = [];
  for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) {
    const f = inFinder(r, c);
    cells.push(f ? f === "on" : rnd() < 0.44);
  }
  return <span className="sk-qr">{cells.map((v, i) => <i key={i} className={v ? "on" : ""} />)}</span>;
}

/** The mobile app — real iPhone frame whose screen flips between a faithful
    Mitt svæði mini-replica and the employee ID card (tap or wait). */
function AppPreview({ t }: { t: (typeof T)["is"] }) {
  const [face, setFace] = useState(0);
  const manual = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => { if (!manual.current) setFace((f) => 1 - f); }, 5200);
    return () => clearInterval(id);
  }, []);
  const pick = (f: number) => { manual.current = true; setFace(f); };
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
                <Check />
                {pt}
              </li>
            ))}
          </ul>
        </div>
        <div className="ny-app-vis">
          <span className="ny-app-glow" aria-hidden="true" />
          <div className="ny-phone-real" onClick={() => pick(1 - face)} aria-hidden="true">
            <img className="frame" src="/app/phone-frame.png" alt="" width={551} height={1137} loading="lazy" />
            <div className="ny-phone-ui">
              <div className={`ny-flip${face === 1 ? " flipped" : ""}`}>

                {/* front: Mitt svæði as it actually looks in the app (light theme) */}
                <div className="ny-face front">
                  <span className="isl" />
                  <div className="mv-top"><Logo w={13} /><b>VAKTO</b><span className="av">MÍ</span></div>
                  <div className="mv-punch">
                    <small>{t.phSince}</small>
                    <b>04:36:12</b>
                    <span className="pbtn">{t.phClockOut}</span>
                  </div>
                  <div className="mv-mini">
                    <div className="mh">{t.phNext}</div>
                    {t.phRows.map(([d, h]) => (
                      <div className="mr" key={d}><span>{d}</span><b className={h.includes("+") ? "warn" : ""}>{h}</b></div>
                    ))}
                  </div>
                  <div className="mv-mini">
                    <div className="mh">{t.phSum}</div>
                    {t.phSumRows.map(([k, v]) => (
                      <div className="mr" key={k}><span>{k}</span><b>{v}</b></div>
                    ))}
                  </div>
                  <div className="mv-qa"><span>{t.phLeave}</span><span className="alt">{t.phSwap}</span></div>
                </div>

                {/* back: the staff ID card exactly like StaffCardModal renders it */}
                <div className="ny-face back">
                  <span className="isl" />
                  <div className="sk-card">
                    <div className="sk-top">
                      <span className="sk-brand"><svg width="13" height="13" viewBox="0 0 24 24" fill="none"><rect x="3" y="13" width="4" height="8" rx="1.2" fill="#fff" /><rect x="10" y="8" width="4" height="13" rx="1.2" fill="#fff" /><rect x="17" y="4" width="4" height="17" rx="1.2" fill="#fff" /></svg>VAKTO</span>
                      <span className="sk-co">Kaffi Krónan</span>
                    </div>
                    <span className="sk-av">MÍ</span>
                    <small className="sk-lbl">{t.idLabel}</small>
                    <b className="sk-nm">Mína Huong</b>
                    <div className="sk-flds">
                      <div><small>{t.skRole}</small><b>{t.skRoleV}</b></div>
                      <div><small>{t.skNo}</small><b>#4821</b></div>
                    </div>
                    <span className="sk-qrbox"><MiniQr /></span>
                    <span className="sk-ft">VAKTO-4821-KK · {t.skScan}</span>
                  </div>
                  <div className="sk-wallet">
                    <span className="apple"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.5zM14.2 6c.6-.8 1.1-1.9.9-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.3z" /></svg>Apple Wallet</span>
                    <span className="goog">Google Wallet</span>
                  </div>
                </div>

              </div>
            </div>
          </div>
          <div className="ny-phone-tabs">
            {t.phoneTabs.map((lbl, i) => (
              <button key={lbl} className={face === i ? "on" : ""} onClick={() => pick(i)}>{lbl}</button>
            ))}
          </div>
        </div>
      </Rise>
    </section>
  );
}

/* ---------- pricing: Free + Pro, monthly/yearly toggle (15 % off yearly) ---------- */

function Pricing({ t, q }: { t: (typeof T)["is"]; q: string }) {
  const [yearly, setYearly] = useState(false);
  const pro = t.planPro;
  return (
    <section className="ny-sec" id="verd">
      <Rise><div className="ny-head">
        <h2>{t.priceHead}</h2>
        <p>{t.priceSub}</p>
      </div></Rise>
      <Rise delay={40}>
        <div className="ny-billing" role="group" aria-label={`${t.billMonthly} / ${t.billYearly}`}>
          <button className={yearly ? "" : "on"} onClick={() => setYearly(false)} aria-pressed={!yearly}>{t.billMonthly}</button>
          <button className={yearly ? "on" : ""} onClick={() => setYearly(true)} aria-pressed={yearly}>
            {t.billYearly}<span className="save">{t.billSave}</span>
          </button>
        </div>
      </Rise>
      <div className="ny-plans">
        <Rise className="ny-plan free" delay={80}>
          <span className="ny-plan-name">{t.planFree.name}</span>
          <div className="ny-amt">{t.planFree.price} <small>{t.planFree.unit}</small></div>
          <p className="ny-plan-desc">{t.planFree.desc}</p>
          <ul>
            {t.planFree.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
          <a className="ny-btn ghost lg" href={`/nyskraning${q}`}>{t.planFree.cta}</a>
        </Rise>
        <Rise className="ny-plan pro" delay={160}>
          <div className="ny-price-glow" aria-hidden="true" />
          <span className="ny-plan-badge">{pro.badge}</span>
          <span className="ny-plan-name">{pro.name}</span>
          <div className="ny-amt">
            {yearly ? pro.priceY : pro.priceM} <small>{pro.unit}{yearly ? ` · ${pro.yearNote}` : ""}</small>
          </div>
          <p className="ny-plan-desc">{pro.desc}</p>
          <ul>
            {pro.items.map((it) => <li key={it}>{it}</li>)}
          </ul>
          <a className="ny-btn glow lg" href={`/nyskraning${q}`}>{pro.cta}</a>
        </Rise>
      </div>
      <Rise delay={200}><span className="ny-fine ny-plans-fine">{t.priceFine}</span></Rise>
    </section>
  );
}

/* Seven cards: 1 = full-width "big", the rest in the 2-column grid. */
const FEATURE_VISUALS = ["gauge", "pulse", "rows", "card", "chat", "book", "grid"] as const;

const VOICE_IMGS = ["/folk/gudrun.jpg", "/folk/stefan.jpg", "/folk/elisabet.jpg"];
const VOICE_NAMES = ["Guðrún Ósk", "Stefán Örn", "Elísabet Anna"];

export default function NyClient() {
  const [menuOpen, setMenuOpen] = useState(false);
  const lang = useSyncExternalStore(subscribeLang, readLang, () => "is" as Lang);
  const t = T[lang];
  const q = lang === "en" ? "?lang=en" : "";
  function toggleLang() {
    writeLang(lang === "is" ? "en" : "is");
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
        <Link className="ny-logo" href="/"><Logo w={24} />VAKTO</Link>
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
          <Starfield layer={1} />
          <Starfield layer={2} />
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
            <img src={slideImg("maelabord")} alt={t.shotAlt} />
            <LivePill label={t.liveLabel} suffix={t.liveSuffix} note={t.liveNote} lang={lang} />
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

      {/* ---------- what the others don't do: glass cards with glow ---------- */}
      <section className="ny-sec" id="eiginleikar">
        <Rise><div className="ny-head">
          <h2>{t.featHead}</h2>
          <p>{t.featSub}</p>
        </div></Rise>
        <div className="ny-cards">
          {t.features.map((f, i) => {
            const visual = FEATURE_VISUALS[i];
            const big = i === 0;
            return (
              <Rise className={`ny-card${big ? " big" : ""}`} delay={(i % 2) * 80} key={visual}>
                <div className="ny-card-vis" aria-hidden="true">
                  {visual === "gauge" && (
                    <div className="ny-gauge"><div className="ny-gring"><span>31,6%</span></div><small>{t.gaugeTarget}</small></div>
                  )}
                  {visual === "grid" && (
                    <div className="ny-minigrid">{Array.from({ length: 28 }, (_, j) => <i key={j} className={[3, 4, 9, 12, 17, 18, 24].includes(j) ? "on" : [6, 20, 26].includes(j) ? "eve" : ""} />)}</div>
                  )}
                  {visual === "pulse" && (
                    <div className="ny-clock"><span className="ring" /><span className="ring r2" /><b>08:02</b></div>
                  )}
                  {visual === "rows" && (
                    <>
                      <div className="ny-rows"><i style={{ width: "72%" }} /><i style={{ width: "54%" }} /><i style={{ width: "84%" }} /><i style={{ width: "40%" }} /></div>
                      <span className="ny-vis-check"><Check sw={2.4} /></span>
                      <span className="ny-vis-tag">{t.signedTag}</span>
                    </>
                  )}
                  {visual === "book" && (
                    <>
                      <div className="ny-rows book"><i style={{ width: "80%" }} /><i style={{ width: "62%" }} /><i style={{ width: "70%" }} /><i style={{ width: "48%" }} /></div>
                      <span className="ny-vis-tag"><Check sw={2.6} />{t.readTag}</span>
                    </>
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

      {/* ---------- the basics everyone has (chips) ---------- */}
      <section className="ny-sec" id="skref">
        <Rise><div className="ny-head">
          <h2>{t.basicsHead}</h2>
          <p>{t.basicsSub}</p>
        </div></Rise>
        <Rise delay={60}>
          <ul className="ny-chips">
            {t.basics.map((b) => (
              <li className="ny-chip" key={b}><Check sw={2.4} />{b}</li>
            ))}
            <li className="ny-chip more">{t.basicsMore}</li>
          </ul>
        </Rise>
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
            <blockquote>„{t.voices[0].quote}&#8220;</blockquote>
            <div className="who"><b>{VOICE_NAMES[0]}</b><span>{t.voices[0].role}</span></div>
          </div>
        </div></Rise>
        <div className="ny-voice-grid">
          {t.voices.slice(1).map((v, i) => (
            <Rise className="ny-voice" delay={i * 90} key={VOICE_NAMES[i + 1]}>
              <blockquote>„{v.quote}&#8220;</blockquote>
              <div className="who">
                <img src={VOICE_IMGS[i + 1]} alt={VOICE_NAMES[i + 1]} loading="lazy" />
                <div><b>{VOICE_NAMES[i + 1]}</b><span>{v.role}</span></div>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      {/* the mobile app */}
      <AppPreview t={t} />

      {/* ---------- pricing ---------- */}
      <Pricing t={t} q={q} />

      {/* CTA + giant wordmark footer */}
      <section className="ny-cta">
        <Rise>
          <h2>{t.ctaEnd}</h2>
          <div className="ny-ctas" style={{ justifyContent: "center" }}>
            <a className="ny-btn glow lg" href={`/nyskraning${q}`}>{t.start}</a>
            <a className="ny-btn ghost lg" href={`/login${q}`}>{t.ctaDemo}</a>
          </div>
        </Rise>
      </section>

      <footer className="ny-foot">
        <span className="ny-foot-aurora" aria-hidden="true" />
        <div className="ny-foot-grid">
          <div className="ny-foot-brand">
            <Link className="ny-logo" href="/"><Logo w={22} />VAKTO</Link>
            <p>{t.footBlurb}</p>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footProduct}</h4>
            <a href="#eiginleikar">{t.nav[0]}</a>
            <a href="#skref">{t.nav[1]}</a>
            <a href="#verd">{t.nav[2]}</a>
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
            <a href="mailto:hallo@vakto.is">{t.footPrivacy}</a>
            <a href="mailto:hallo@vakto.is">{t.footTerms}</a>
            <a href="mailto:hallo@vakto.is">{t.footCookies}</a>
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
