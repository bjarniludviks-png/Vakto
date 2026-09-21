"use client";

// The "miðnætursól" homepage — deep black with a glowing orange aurora horizon.
// Bilingual (IS/EN): all copy lives in T below, toggled by the nav globe and
// persisted in localStorage("vakto-lang") — the same key the app shell uses.
// Every screenshot on the page is a real capture of the app (scripts/shots-homepage.mjs).

import { useEffect, useRef, useState } from "react";
import { CUSTOMERS, type Brand } from "../home-data";
import HomeChat from "./home-chat";

type Lang = "is" | "en";

/* ---------- copy ---------- */

type Plan = { name: string; price: string; unit: string; desc: string; items: string[]; cta: string; badge?: string; priceY?: string; yearNote?: string };

const T: Record<Lang, {
  nav: [string, string, string];
  login: string; start: string;
  pill: string; h1: [string, string]; sub: string; ctaSee: string;
  shotAlt: string;
  tour: { title: string; desc: string }[];
  trust: string;
  st1: string; stEm: string; st2: string;
  industries: [string, string, string, string, string, string];
  basicsHead: string; basicsSub: string; basics: string[];
  featHead: string; featSub: string;
  features: { title: string; desc: string }[];
  gaugeTarget: string; devTag: string; pvaRows: [string, string, string][]; payRows: [string, string][];
  chat: [string, string, string];
  idLabel: string; idRole: string; signedTag: string; signedName: string;
  twoHead: string; twoSub: string;
  owner: { title: string; items: string[] };
  staff: { title: string; items: string[] };
  stepsHead: string;
  steps: { title: string; desc: string }[];
  showHead: string; showSub: string;
  slides: { title: string; desc: string }[];
  appBadge: string; appHead: string; appSub: string;
  appPoints: string[];
  phoneTabs: [string, string];
  priceHead: string; priceSub: string;
  billMonthly: string; billYearly: string; billSave: string;
  planFree: Plan; planPro: Plan;
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
    nav: ["Eiginleikar", "Skjámyndir", "Verð"],
    login: "Innskráning", start: "Byrja frítt",
    pill: "Vaktaplan · stimpilklukka · laun · laun% af veltu",
    h1: ["Eitt einfaldasta vaktakerfið sem til er.", "Með meiru en hin."],
    sub: "Allt sem hin kerfin gera — vaktaplan, stimpilklukka, beiðnir — og það sem þau gera ekki: laun sem hlutfall af veltu í rauntíma, frávik sem sýna hvað þau kosta, launaútreikningur eftir kjarasamningi, skírteini, spjall og ráðningarsamningar. Einfaldara líf fyrir atvinnurekandann og starfsfólkið.",
    ctaSee: "Sjá hvernig",
    shotAlt: "VAKTO — alvöru skjámyndir úr kerfinu",
    tour: [
      { title: "Mælaborð", desc: "Laun% af veltu, tímar og kostnaður — í rauntíma." },
      { title: "Vaktaplan", desc: "Vikan á nokkrum mínútum, kostnaðurinn sést áður en þú birtir." },
      { title: "Tímaskráning", desc: "Áætlað á móti raun — og frávikin merkt um leið." },
      { title: "Launakeyrslur", desc: "Reiknað eftir kjarasamningi, beint í Payday eða DK." },
      { title: "Spjall", desc: "Rásir per deild og stað, bein skilaboð, myndir og viðbrögð." },
      { title: "Fréttaveita", desc: "Tilkynningar sem allir sjá — með athugasemdum og svörum." },
      { title: "Innsýn", desc: "Velta, launakostnaður og laun% mánuð fyrir mánuð." },
    ],
    trust: "Vinnustaðir um allt Ísland keyra á VAKTO",
    st1: "Vaktaplan er ekki vandamálið. Að vita hvað það kostar er það. VAKTO sýnir þér launin sem hlutfall af veltu ",
    stEm: "áður en mánuðurinn er búinn",
    st2: " — og starfsfólkið fær app sem það nennir að nota.",
    industries: ["Veitingastaðir", "Kaffihús", "Verslanir", "Hótel & gisting", "Bakarí", "Keðjur & útibú"],
    basicsHead: "Allt sem þú átt að venjast.",
    basicsSub: "Grunnurinn sem hvert vaktakerfi þarf — og hann er einfaldari hér en annars staðar.",
    basics: [
      "Vaktaplan með drag & drop",
      "Stimpilklukka — sími og kiosk með PIN eða QR",
      "Frí- og leyfisbeiðnir",
      "Vaktaskipti og opnar vaktir",
      "Launaútreikningur og launakeyrslur",
      "Skýrslur í Excel og PDF",
      "Starfsfólk lesið inn úr Excel",
      "Útflutningur í Payday og DK",
      "Íslenska og enska",
    ],
    featHead: "…og það sem hin gera ekki.",
    featSub: "Þetta er ástæðan fyrir því að fólk skiptir yfir í VAKTO.",
    features: [
      { title: "Laun sem % af veltu — í rauntíma", desc: "Skráðu veltuna eða tengdu sölukerfið og sjáðu launahlutfallið um leið og stimplað er inn. Grænt þegar þú ert á markmiði, gult þegar það nálgast, rautt áður en það verður dýrt." },
      { title: "Frávik og hvað þau kosta", desc: "Of seint, fór fyrr, yfirvinna, gleymd útstimplun. Merkt um leið og það gerist — með krónutölu, ekki bara mínútum." },
      { title: "Áætlun á móti raun", desc: "Áætlaðir tímar á móti stimpluðum, per dag og per starfsmann. Starfsmaðurinn sér sitt líka." },
      { title: "Laun eftir kjarasamningi", desc: "Dagvinna, álög, yfirvinna, uppbætur, staðgreiðsla og tryggingagjald — reiknað rétt og flutt beint í Payday eða DK." },
      { title: "Starfsmannaskírteini í símanum", desc: "Mynd, staða, deild og QR-kóði sem stimplar inn á kiosknum. Fer í Apple Wallet og Google Wallet." },
      { title: "Ráðningarsamningar undirritaðir í appinu", desc: "Samningurinn verður til úr starfsmannagögnunum, starfsmaðurinn les og samþykkir rafrænt í símanum. Enginn pappír, ekkert prentað." },
      { title: "Spjall og fréttaveita innbyggð", desc: "Messenger-legt spjall með rásum per deild og stað, beinum skilaboðum, myndum og viðbrögðum — og fréttaveita þar sem tilkynningar ná til allra. Ekkert Slack, engin Facebook-grúppa." },
    ],
    gaugeTarget: "MARKMIÐ 30%", devTag: "kostar 4.350 kr",
    pvaRows: [["Mán", "8,0", "8,4"], ["Þri", "8,0", "7,6"], ["Mið", "8,0", "9,1"]],
    payRows: [["Dagvinna", "146,0 klst"], ["Kvöldálag 33%", "22,0 klst"], ["Yfirvinna", "2,3 klst"]],
    chat: ["Getur einhver tekið laugardaginn?", "Ég tek hana!", "Vaktaskipti samþykkt"],
    idLabel: "STARFSMANNASKÍRTEINI", idRole: "Þjónn · Salur", signedTag: "Undirritað rafrænt", signedName: "Ráðningarsamningur · Dalya R.",
    twoHead: "Einfaldara fyrir báða.",
    twoSub: "Atvinnurekandinn sér reksturinn. Starfsfólkið sér sitt. Enginn þarf að spyrja.",
    owner: { title: "Fyrir atvinnurekandann", items: [
      "Vaktaplan sem sýnir kostnaðinn áður en þú birtir",
      "Laun% af veltu, í dag og þessa viku",
      "Frávik með krónutölu — samþykkt í einu",
      "Launakeyrsla á nokkrum mínútum, beint í Payday",
      "Skýrslur, innsýn og samanburður milli mánaða",
      "Ráðningarsamningar og skjöl á einum stað",
    ] },
    staff: { title: "Fyrir starfsfólkið", items: [
      "Vaktirnar og næsta vakt í símanum",
      "Stimpla inn og út með einni snertingu",
      "Launin áætluð jafnóðum — og áætlun á móti raun",
      "Fríbeiðnir, vaktaskipti og opnar vaktir",
      "Spjall og fréttir frá vinnustaðnum",
      "Skírteinið og ráðningarsamningurinn í appinu",
    ] },
    stepsHead: "Þrjú skref. Korter. Búið.",
    steps: [
      { title: "Stofnaðu aðgang", desc: "Fyrirtækið, fólkið (lesið inn úr Excel) og kjarasamningarnir — inn á korteri. Ekkert kort." },
      { title: "Raðaðu vikunni", desc: "Dragðu vaktir á sinn stað — eða láttu AI stinga upp á plani og samþykktu. Planið lendir í símum starfsfólksins." },
      { title: "Sjáðu kostnaðinn fyrirfram", desc: "Launakostnaðurinn birtist áður en þú birtir planið, laun% um leið og veltan er skráð. Mánaðamótin verða bara dagsetning." },
    ],
    showHead: "Sjáðu kerfið í alvöru",
    showSub: "Alvöru skjámyndir úr VAKTO — flettu á milli.",
    slides: [
      { title: "Mælaborð", desc: "Laun% af veltu, tímar, kostnaður og frávik á einum skjá." },
      { title: "Vaktaplan", desc: "Full vika á nokkrum mínútum — kostnaðurinn sést áður en þú birtir." },
      { title: "Tímaskráning", desc: "Áætlað á móti raun, per starfsmann — frávikin merkt." },
      { title: "Launakeyrslur", desc: "Reiknað eftir kjarasamningi — Payday, DK eða Excel." },
      { title: "Starfsfólk", desc: "Launaprófílar, kjarasamningar, skjöl og samningar." },
      { title: "Innsýn", desc: "Velta, launakostnaður og laun% mánuð fyrir mánuð." },
      { title: "Spjall", desc: "Rásir, bein skilaboð, myndir og viðbrögð — eins og Messenger." },
      { title: "Fréttaveita", desc: "Tilkynningar með viðbrögðum, athugasemdum og svörum." },
    ],
    appBadge: "Í vasanum",
    appHead: "Appið sem fylgir fólkinu heim",
    appSub: "Starfsmaðurinn sér bara það sem skiptir hann máli — og þú sleppur við tuttugu skilaboð á dag.",
    appPoints: [
      "Stimpla inn og út — ein snerting",
      "Vaktirnar og næsta vakt",
      "Launin áætluð jafnóðum, áætlun á móti raun",
      "Beiðnir: frí, vaktaskipti, opnar vaktir",
      "Spjall og fréttir í rauntíma",
      "Skírteinið í Apple og Google Wallet",
      "Ráðningarsamningur undirritaður rafrænt",
    ],
    phoneTabs: ["Mitt svæði", "Skírteinið"],
    priceHead: "Byrjaðu frítt. Uppfærðu þegar þú vilt sjá reksturinn.",
    priceSub: "Frítt fyrir litla staði. Pro þegar þú vilt sjá launin á móti veltunni.",
    billMonthly: "Mánaðarlega", billYearly: "Árlega", billSave: "15% afsláttur",
    planFree: {
      name: "Frítt", price: "0", unit: "kr · allt að 10 notendur",
      desc: "Grunnurinn sem allir þurfa — án kostnaðar.",
      items: ["Vaktaplan með drag & drop", "Stimpilklukka — sími og kiosk", "Frí- og leyfisbeiðnir", "Vaktaskipti og opnar vaktir", "Spjall og fréttaveita"],
      cta: "Byrja frítt",
    },
    planPro: {
      name: "Pro", badge: "Vinsælast",
      price: "590", priceY: "500", unit: "kr/notanda/mán", yearNote: "greitt árlega",
      desc: "Allt sem hin kerfin gera ekki.",
      items: ["Laun sem % af veltu í rauntíma", "Frávik með krónutölu", "Launaútreikningur eftir kjarasamningi", "Ráðningarsamningar og rafræn undirritun", "Skírteini í Apple og Google Wallet", "Skýrslur, innsýn og útflutningur í Payday og DK", "Ótakmarkaður fjöldi notenda"],
      cta: "Prófa Pro frítt í 14 daga",
    },
    priceFine: "Verð án VSK. 14 daga frí prufa á Pro, ekkert kort. Keðjur með marga staði: hafðu samband.",
    ctaEnd: "Sjáðu hvað vaktin kostar — áður en hún klárast.",
    ctaDemo: "Hafa samband",
    footBlurb: "Eitt einfaldasta vaktakerfið sem til er: vaktaplan, stimpilklukka, laun — og launin sem % af veltu í rauntíma. Hannað fyrir íslenska vinnustaði.",
    footProduct: "Vara", footHow: "Svona virkar það", footPrice: "Verð",
    footCompany: "Fyrirtækið", footContact: "Hafa samband", footKiosk: "Stimpilklukka",
    footLegal: "Lögfræði", footPrivacy: "Persónuvernd", footTerms: "Skilmálar", footCookies: "Vafrakökur",
    footFollow: "Fylgdu okkur",
    footCopy: "© 2026 VAKTO ehf.", footMade: "Hannað og þróað á Íslandi",
  },
  en: {
    nav: ["Features", "Screenshots", "Pricing"],
    login: "Sign in", start: "Start free",
    pill: "Scheduling · time clock · payroll · labor % of revenue",
    h1: ["One of the simplest scheduling systems out there.", "With more than the rest."],
    sub: "Everything the other systems do — scheduling, a time clock, requests — and what they don't: labor as a share of revenue in real time, deviations that show what they cost, payroll by union agreement, ID cards, chat and employment contracts. A simpler life for the owner and the team.",
    ctaSee: "See how",
    shotAlt: "VAKTO — real screenshots from the app",
    tour: [
      { title: "Dashboard", desc: "Labor % of revenue, hours and cost — in real time." },
      { title: "Schedule", desc: "A week in minutes; the cost shows before you publish." },
      { title: "Time tracking", desc: "Planned vs actual — deviations flagged as they happen." },
      { title: "Payroll", desc: "Calculated by union agreement, straight into Payday or DK." },
      { title: "Chat", desc: "Channels per department and site, DMs, photos and reactions." },
      { title: "News feed", desc: "Announcements everyone sees — with comments and replies." },
      { title: "Insights", desc: "Revenue, labor cost and labor % month by month." },
    ],
    trust: "Workplaces across Iceland run on VAKTO",
    st1: "The schedule isn't the problem. Knowing what it costs is. VAKTO shows you labor as a share of revenue ",
    stEm: "before the month is over",
    st2: " — and your team gets an app they actually want to use.",
    industries: ["Restaurants", "Cafés", "Retail", "Hotels & stays", "Bakeries", "Chains & branches"],
    basicsHead: "Everything you're used to.",
    basicsSub: "The foundation every scheduling system needs — simpler here than anywhere else.",
    basics: [
      "Drag & drop scheduling",
      "Time clock — phone and kiosk with PIN or QR",
      "Time-off and leave requests",
      "Shift swaps and open shifts",
      "Payroll calculation and pay runs",
      "Reports in Excel and PDF",
      "Import staff from Excel",
      "Export to Payday and DK",
      "Icelandic and English",
    ],
    featHead: "…and what the others don't do.",
    featSub: "This is why people switch to VAKTO.",
    features: [
      { title: "Labor as % of revenue — in real time", desc: "Enter revenue or connect your POS and see the labor ratio the moment someone clocks in. Green on target, amber when it's close, red before it gets expensive." },
      { title: "Deviations and what they cost", desc: "Late, left early, overtime, forgot to clock out. Flagged the moment it happens — in króna, not just minutes." },
      { title: "Planned vs actual", desc: "Scheduled hours against clocked hours, per day and per person. Your team sees theirs too." },
      { title: "Payroll by union agreement", desc: "Base pay, premiums, overtime, bonuses, withholding and insurance levy — calculated correctly and exported straight to Payday or DK." },
      { title: "Employee ID on the phone", desc: "Photo, role, department and a QR code that clocks in at the kiosk. Goes into Apple Wallet and Google Wallet." },
      { title: "Employment contracts signed in the app", desc: "The contract is generated from the employee's data; they read and accept it electronically on their phone. No paper, nothing printed." },
      { title: "Chat and news feed built in", desc: "Messenger-style chat with channels per department and site, DMs, photos and reactions — and a news feed where announcements reach everyone. No Slack, no Facebook group." },
    ],
    gaugeTarget: "TARGET 30%", devTag: "costs 4,350 ISK",
    pvaRows: [["Mon", "8.0", "8.4"], ["Tue", "8.0", "7.6"], ["Wed", "8.0", "9.1"]],
    payRows: [["Base hours", "146.0 h"], ["Evening +33%", "22.0 h"], ["Overtime", "2.3 h"]],
    chat: ["Can anyone take Saturday?", "I got it!", "Swap approved"],
    idLabel: "EMPLOYEE ID", idRole: "Server · Floor", signedTag: "Signed electronically", signedName: "Employment contract · Dalya R.",
    twoHead: "Simpler for both.",
    twoSub: "The owner sees the business. The team sees their own. Nobody has to ask.",
    owner: { title: "For the owner", items: [
      "A schedule that shows the cost before you publish",
      "Labor % of revenue, today and this week",
      "Deviations in króna — approved in one go",
      "Payroll in minutes, straight into Payday",
      "Reports, insights and month-to-month comparison",
      "Contracts and documents in one place",
    ] },
    staff: { title: "For the team", items: [
      "Shifts and what's next, on the phone",
      "Clock in and out with one tap",
      "Pay estimated as you go — planned vs actual",
      "Time off, swaps and open shifts",
      "Chat and news from work",
      "ID card and employment contract in the app",
    ] },
    stepsHead: "Three steps. Fifteen minutes. Done.",
    steps: [
      { title: "Create your account", desc: "Your company, your people (imported from Excel) and your agreements — set up in fifteen minutes. No card." },
      { title: "Build your week", desc: "Drag shifts into place — or let AI suggest a plan and approve it. The schedule lands on your team's phones." },
      { title: "See the cost up front", desc: "Labor cost shows before you publish, labor % the moment revenue is entered. Month-end becomes just a date." },
    ],
    showHead: "See the real thing",
    showSub: "Actual screenshots from VAKTO — swipe through.",
    slides: [
      { title: "Dashboard", desc: "Labor % of revenue, hours, cost and deviations on one screen." },
      { title: "Schedule", desc: "A full week in minutes — see the cost before you publish." },
      { title: "Time tracking", desc: "Planned vs actual per person — deviations flagged." },
      { title: "Payroll", desc: "Calculated by union agreement — Payday, DK or Excel." },
      { title: "People", desc: "Pay profiles, agreements, documents and contracts." },
      { title: "Insights", desc: "Revenue, labor cost and labor % month by month." },
      { title: "Chat", desc: "Channels, DMs, photos and reactions — like Messenger." },
      { title: "News feed", desc: "Announcements with reactions, comments and replies." },
    ],
    appBadge: "In your pocket",
    appHead: "The app that goes home with your people",
    appSub: "Your team sees only what matters to them — and you skip twenty messages a day.",
    appPoints: [
      "Clock in and out — one tap",
      "Shifts and what's next",
      "Pay estimated as you go, planned vs actual",
      "Requests: time off, swaps, open shifts",
      "Chat and news in real time",
      "ID in Apple and Google Wallet",
      "Employment contract signed electronically",
    ],
    phoneTabs: ["My area", "ID card"],
    priceHead: "Start free. Upgrade when you want to see the business.",
    priceSub: "Free for small places. Pro when you want labor against revenue.",
    billMonthly: "Monthly", billYearly: "Yearly", billSave: "15% off",
    planFree: {
      name: "Free", price: "0", unit: "ISK · up to 10 users",
      desc: "The foundation everyone needs — at no cost.",
      items: ["Drag & drop scheduling", "Time clock — phone and kiosk", "Time-off and leave requests", "Shift swaps and open shifts", "Chat and news feed"],
      cta: "Start free",
    },
    planPro: {
      name: "Pro", badge: "Most popular",
      price: "590", priceY: "500", unit: "ISK/user/mo", yearNote: "billed yearly",
      desc: "Everything the others don't do.",
      items: ["Labor as % of revenue in real time", "Deviations in króna", "Payroll by union agreement", "Employment contracts and e-signing", "ID in Apple and Google Wallet", "Reports, insights and export to Payday and DK", "Unlimited users"],
      cta: "Try Pro free for 14 days",
    },
    priceFine: "Prices excl. VAT. 14-day free trial of Pro, no card. Chains with many sites: get in touch.",
    ctaEnd: "See what the shift costs — before it's over.",
    ctaDemo: "Contact us",
    footBlurb: "One of the simplest scheduling systems out there: shifts, a time clock, payroll — and labor as % of revenue in real time. Built for Icelandic workplaces.",
    footProduct: "Product", footHow: "How it works", footPrice: "Pricing",
    footCompany: "Company", footContact: "Contact", footKiosk: "Time clock",
    footLegal: "Legal", footPrivacy: "Privacy", footTerms: "Terms", footCookies: "Cookies",
    footFollow: "Follow us",
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

const Check = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12.5l4 4 10-10" /></svg>
);

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

/* ---------- real screenshots ---------- */

const SHOT = (key: string) => `/showcase/2026/${key}.jpg`;

/** Hero: an automatic tour of the app. A cursor glides to the next sidebar
    item, "clicks", and the real screenshot of that page fades in — the
    positions are the sidebar links in the 1600×900 captures. */
const TOUR: { key: string; x: number; y: number }[] = [
  { key: "maelabord", x: 5.6, y: 15.2 },
  { key: "vaktaplan", x: 5.6, y: 19.8 },
  { key: "timafravik", x: 6.4, y: 24.4 },
  { key: "launakeyrslur", x: 6.5, y: 33.6 },
  { key: "spjall", x: 5.6, y: 70.4 },
  { key: "frettaveita", x: 5.8, y: 65.8 },
  { key: "innsyn", x: 4.9, y: 47.3 },
];

function HeroTour({ t }: { t: (typeof T)["is"] }) {
  const [idx, setIdx] = useState(0);
  const [target, setTarget] = useState(0);
  const [click, setClick] = useState(false);
  const [run, setRun] = useState(0);
  const paused = useRef(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let cur = idx;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const later = (fn: () => void, ms: number) => { timers.push(setTimeout(fn, ms)); };
    const step = () => {
      if (paused.current) { later(step, 1200); return; }
      const next = (cur + 1) % TOUR.length;
      setTarget(next);
      later(() => setClick(true), 950);
      later(() => { setClick(false); setIdx(next); cur = next; }, 1150);
      later(step, 4200);
    };
    later(step, 3200);
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [run]);
  const pick = (i: number) => { setIdx(i); setTarget(i); setRun((r) => r + 1); };
  const pos = TOUR[target];
  return (
    <div className="ny-tour-wrap">
      <div
        className="ny-tour"
        onMouseEnter={() => { paused.current = true; }}
        onMouseLeave={() => { paused.current = false; }}
      >
        {TOUR.map((s, i) => (
          <img key={s.key} src={SHOT(s.key)} alt={i === idx ? `${t.shotAlt} — ${t.tour[i].title}` : ""} className={`ny-tour-img${i === idx ? " on" : ""}`} loading={i === 0 ? "eager" : "lazy"} />
        ))}
        <span className={`ny-cursor${click ? " click" : ""}`} style={{ left: `${pos.x}%`, top: `${pos.y}%` }} aria-hidden="true">
          <svg viewBox="0 0 24 24"><path d="M5 3l14 8.5-6.2 1.6 3.6 6.6-2.6 1.4-3.6-6.6L5 19z" fill="#fff" stroke="#111" strokeWidth="1.4" strokeLinejoin="round" /></svg>
        </span>
      </div>
      <div className="ny-tour-tabs" role="tablist">
        {TOUR.map((s, i) => (
          <button key={s.key} role="tab" aria-selected={i === idx} className={i === idx ? "on" : ""} onClick={() => pick(i)}>{t.tour[i].title}</button>
        ))}
      </div>
      <p className="ny-tour-cap" aria-live="polite"><b>{t.tour[idx].title}</b> — {t.tour[idx].desc}</p>
    </div>
  );
}

const SLIDE_KEYS = ["maelabord", "vaktaplan", "timafravik", "launakeyrslur", "starfsfolk", "innsyn", "spjall", "frettaveita"];

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
                <img src={SHOT(SLIDE_KEYS[i])} alt={s.title} loading="lazy" />
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

/** The employee app — a real iPhone frame whose screen flips between the actual
    Mitt svæði screen and the actual ID card (tap or wait). */
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
              <li key={pt}><Check />{pt}</li>
            ))}
          </ul>
        </div>
        <div className="ny-app-vis">
          <span className="ny-app-glow" aria-hidden="true" />
          <div className="ny-phone-real" onClick={() => pick(1 - face)} aria-hidden="true">
            <img className="frame" src="/app/phone-frame.png" alt="" width={551} height={1137} loading="lazy" />
            <div className="ny-phone-ui">
              <div className={`ny-flip${face === 1 ? " flipped" : ""}`}>
                <div className="ny-face front shot">
                  <span className="isl" />
                  <img src="/showcase/2026/phone-mitt.png" alt="" loading="lazy" />
                </div>
                <div className="ny-face back shot">
                  <span className="isl" />
                  <img src="/showcase/2026/phone-skirteini.png" alt="" loading="lazy" />
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

/* ---------- feature cards ---------- */

const FEATURE_VISUALS = ["gauge", "dev", "pva", "pay", "card", "signed", "chat"] as const;
const FEATURE_LAYOUT = [{ big: true }, {}, {}, {}, {}, { wide: true }, { wide: true }] as const;

function Pricing({ t, q }: { t: (typeof T)["is"]; q: string }) {
  const [yearly, setYearly] = useState(false);
  const pro = t.planPro;
  return (
    <section className="ny-sec" id="verd">
      <Rise><div className="ny-head">
        <h2>{t.priceHead}</h2>
        <p>{t.priceSub}</p>
      </div></Rise>
      <Rise delay={60}>
        <div className="ny-bill" role="group">
          <button className={!yearly ? "on" : ""} onClick={() => setYearly(false)}>{t.billMonthly}</button>
          <button className={yearly ? "on" : ""} onClick={() => setYearly(true)}>{t.billYearly} <em>{t.billSave}</em></button>
        </div>
        <div className="ny-plans">
          <div className="ny-plan">
            <h3>{t.planFree.name}</h3>
            <p className="pd">{t.planFree.desc}</p>
            <div className="ny-amt">{t.planFree.price} <small>{t.planFree.unit}</small></div>
            <ul>{t.planFree.items.map((it) => <li key={it}>{it}</li>)}</ul>
            <a className="ny-btn ghost lg" href={`/nyskraning?plan=free${q ? "&lang=en" : ""}`}>{t.planFree.cta}</a>
          </div>
          <div className="ny-plan pro">
            <div className="ny-price-glow" aria-hidden="true" />
            {pro.badge && <span className="ny-plan-badge">{pro.badge}</span>}
            <h3>{pro.name}</h3>
            <p className="pd">{pro.desc}</p>
            <div className="ny-amt">{yearly ? pro.priceY : pro.price} <small>{pro.unit}{yearly ? ` · ${pro.yearNote}` : ""}</small></div>
            <ul>{pro.items.map((it) => <li key={it}>{it}</li>)}</ul>
            <a className="ny-btn glow lg" href={`/nyskraning?plan=pro${q ? "&lang=en" : ""}`}>{pro.cta}</a>
          </div>
        </div>
        <span className="ny-fine" style={{ textAlign: "center" }}>{t.priceFine}</span>
      </Rise>
    </section>
  );
}

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
          <a href="#kerfid">{t.nav[1]}</a>
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
            <a href="#kerfid">{t.nav[1]}</a>
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
            <HeroTour t={t} />
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

      {/* ---------- the basics everyone has ---------- */}
      <section className="ny-sec ny-basicsec" id="eiginleikar">
        <Rise><div className="ny-head">
          <h2>{t.basicsHead}</h2>
          <p>{t.basicsSub}</p>
        </div></Rise>
        <Rise delay={60}>
          <ul className="ny-basics">
            {t.basics.map((b) => <li key={b}><Check />{b}</li>)}
          </ul>
        </Rise>
      </section>

      {/* ---------- what the others don't do: glass cards with glow ---------- */}
      <section className="ny-sec ny-featsec">
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
                    <div className="ny-gauge"><div className="ny-gring"><span>26,2%</span></div><small>{t.gaugeTarget}</small></div>
                  )}
                  {visual === "dev" && (
                    <div className="ny-dev">
                      <div className="ny-clock"><span className="ring" /><span className="ring r2" /><b>07:52</b></div>
                      <span className="ny-devtag">+52 min · {t.devTag}</span>
                    </div>
                  )}
                  {visual === "pva" && (
                    <div className="ny-pva">
                      {t.pvaRows.map(([d, a, b]) => {
                        const over = parseFloat(b.replace(",", ".")) > parseFloat(a.replace(",", "."));
                        return (
                          <div className="row" key={d}>
                            <span>{d}</span>
                            <i className="plan" style={{ width: "62%" }} />
                            <i className={over ? "real over" : "real"} style={{ width: `${Math.round(62 * parseFloat(b.replace(",", ".")) / 8)}%` }} />
                            <b className={over ? "over" : ""}>{b}</b>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  {visual === "pay" && (
                    <div className="ny-pay">
                      {t.payRows.map(([k, v]) => <div key={k}><span>{k}</span><b>{v}</b></div>)}
                      <div className="sum"><span>Payday</span><b>→</b></div>
                    </div>
                  )}
                  {visual === "card" && (
                    <div className="ny-idcard">
                      <div className="top"><b>VAKTO</b><span>{t.idLabel}</span></div>
                      <div className="body">
                        <span className="av">DA</span>
                        <div className="tx"><b>Dalya R.</b><span>{t.idRole}</span></div>
                        <span className="qr">{Array.from({ length: 25 }, (_, j) => <i key={j} className={[0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24].includes(j) ? "on" : ""} />)}</span>
                      </div>
                    </div>
                  )}
                  {visual === "signed" && (
                    <div className="ny-doc">
                      <div className="pg">
                        <i style={{ width: "70%" }} /><i style={{ width: "88%" }} /><i style={{ width: "58%" }} /><i style={{ width: "80%" }} /><i style={{ width: "40%" }} />
                        <span className="sig">Dalya R.</span>
                      </div>
                      <span className="tag"><Check />{t.signedTag}</span>
                      <small>{t.signedName}</small>
                    </div>
                  )}
                  {visual === "chat" && (
                    <div className="ny-chat">
                      <span className="bub them">{t.chat[0]}</span>
                      <span className="bub me">{t.chat[1]}</span>
                      <span className="bub tag">{t.chat[2]}</span>
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

      {/* ---------- simpler for both ---------- */}
      <section className="ny-sec ny-twosec">
        <Rise><div className="ny-head">
          <h2>{t.twoHead}</h2>
          <p>{t.twoSub}</p>
        </div></Rise>
        <div className="ny-two">
          {[t.owner, t.staff].map((col, i) => (
            <Rise className="ny-two-col" delay={i * 90} key={col.title}>
              <h3>{col.title}</h3>
              <ul>{col.items.map((it) => <li key={it}><Check />{it}</li>)}</ul>
            </Rise>
          ))}
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

      {/* the employee app */}
      <AppPreview t={t} />

      {/* ---------- pricing ---------- */}
      <Pricing t={t} q={q} />

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
            <a href="mailto:hallo@vakto.is?subject=Pers%C3%B3nuvernd">{t.footPrivacy}</a>
            <a href="mailto:hallo@vakto.is?subject=Skilm%C3%A1lar">{t.footTerms}</a>
            <a href="mailto:hallo@vakto.is?subject=Vafrak%C3%B6kur">{t.footCookies}</a>
          </div>
          <div className="ny-foot-col">
            <h4>{t.footFollow}</h4>
            <a href="https://www.instagram.com/vakto.is" target="_blank" rel="noreferrer">Instagram</a>
            <a href="https://www.facebook.com/vakto.is" target="_blank" rel="noreferrer">Facebook</a>
            <a href="https://www.linkedin.com/company/vakto" target="_blank" rel="noreferrer">LinkedIn</a>
          </div>
        </div>
        <div className="ny-foot-bot">
          <span>{t.footCopy}</span>
          <span>{t.footMade}</span>
        </div>
        <div className="ny-mark" aria-hidden="true">VAKTO</div>
      </footer>

      <HomeChat lang={lang} />
    </div>
  );
}
