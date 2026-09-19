"use client";

import { useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";

type L = { is: string; en: string };
const tx = (lang: string, v: L) => (lang === "en" ? v.en : v.is);
const ic = (d: string) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>;

type Guide = { id: string; icon: React.ReactNode; title: L; intro: L; img?: string; steps: L[]; staff?: boolean };

const GUIDES: Guide[] = [
  {
    id: "maelabord", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/dashboard.png",
    title: { is: "Mælaborðið", en: "The dashboard" },
    intro: { is: "Mælaborðið gefur þér rauntíma-yfirsýn: unnar stundir, launakostnað, yfirvinnu, álag og laun sem % af veltu.", en: "The dashboard gives you a real-time overview: hours worked, labor cost, overtime, premiums and labor as a % of revenue." },
    steps: [
      { is: "Veldu tímabil efst (Í dag / Vika / Mánuður / Sérsnið) — allar tölur fylgja valinu og valið helst milli síðna.", en: "Pick a period at the top (Today / Week / Month / Custom) — all figures follow it and the choice persists across pages." },
      { is: "„Laun af tekjum“-hringurinn sýnir launakostnað ÷ veltu. Grænt er gott, rautt hátt. Undir honum sést veltan og hvort hún er handvirk eða úr Inventra.", en: "The labor-% ring shows labor cost ÷ revenue. Green is good, red is high. Below it you see the revenue and whether it's manual or from Inventra." },
      { is: "Yfirvinna og álag birtast bæði í klukkustundum og krónum. Yfirvinnan er reiknuð eftir raunreglum (t.d. yfir 40 klst/viku), ekki bara frávik.", en: "Overtime and premiums show in both hours and krónur. Overtime uses the real rules (e.g. over 40 hrs/week), not just deviation." },
      { is: "Línuritið sýnir alltaf síðustu 7 daga — áætlað vs raun. Farðu með músina yfir punkt til að sjá nákvæmar tölur.", en: "The line chart always shows the last 7 days — planned vs actual. Hover a point for exact numbers." },
    ],
  },
  {
    id: "vaktaplan", icon: ic("M8 2v4M16 2v4|M3 9h18|M3 5h18v16H3z"), img: "/help/schedule.png",
    title: { is: "Vaktaplan", en: "Scheduling" },
    intro: { is: "Búðu til vaktaplan með því að draga vaktir í reitina — eða láttu gervigreind gera tillögu.", en: "Build the schedule by dragging shifts into cells — or let AI propose one." },
    steps: [
      { is: "Veldu viku/dag/mánuð efst og deild ef við á. Hver lína er starfsmaður, hver dálkur dagur.", en: "Choose week/day/month at the top and a department if needed. Each row is an employee, each column a day." },
      { is: "Smelltu á reit til að bæta við vakt, eða dragðu vakt milli reita. Þú getur breytt upphafi/lokum og gerð vaktar.", en: "Click a cell to add a shift, or drag a shift between cells. You can edit start/end and the shift type." },
      { is: "„Gervigreind (AI) bestun“ býr til tillögu að plani út frá mönnunarþörf. Þú yfirferð og samþykkir áður en það birtist.", en: "\"AI optimize\" proposes a plan from your staffing needs. You review and approve before it's published." },
      { is: "Þegar planið er tilbúið, smelltu „Gefa út vaktaplan“ — þá sjá starfsmenn vaktirnar sínar í Mitt svæði.", en: "When ready, click \"Publish schedule\" — staff then see their shifts in My area." },
      { is: "Efst sérðu heildartíma, launakostnað og mönnun fyrir tímabilið sem þú horfir á.", en: "At the top you see total hours, labor cost and staffing for the visible period." },
    ],
  },
  {
    id: "timaskraning", icon: ic("M12 7v5l3 2|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"), img: "/help/time.png",
    title: { is: "Tímaskráning & samþykki", en: "Time & approvals" },
    intro: { is: "Hér sérðu hverjir eru á vakt núna, samþykkir unna tíma og afgreiðir leiðréttingabeiðnir.", en: "See who's on shift now, approve worked hours and handle correction requests." },
    steps: [
      { is: "„Á vakt núna“ sýnir opnar stimplanir í rauntíma. Þú getur sett útstimplun handvirkt ef einhver gleymdi.", en: "\"On shift now\" shows open punches live. You can set a clock-out manually if someone forgot." },
      { is: "Samþykktu tíma með „Samþykkja“ per línu, eða „Samþykkja allt“. Aðeins samþykktir tímar fara í launakeyrslu.", en: "Approve hours per row with \"Approve\", or \"Approve all\". Only approved hours flow into payroll." },
      { is: "Smelltu á starfsmann til að opna heila tímaskrá hans — þar geturðu breytt eða eytt stökum stimplunum með sögu.", en: "Click an employee to open their full timesheet — edit or delete individual punches with history." },
      { is: "Leiðréttingabeiðnir frá starfsfólki birtast neðst; samþykktu eða hafnaðu þeim.", en: "Correction requests from staff appear at the bottom; approve or reject them." },
    ],
  },
  {
    id: "starfsfolk", icon: ic("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"), img: "/help/staff.png",
    title: { is: "Starfsfólk & launasnið", en: "Staff & pay profiles" },
    intro: { is: "Hver starfsmaður geymir eigin launasnið — taxta, kjarasamning, álög, uppbætur, hlunnindi og aðgang.", en: "Each employee holds their own pay profile — rate, union, premiums, bonuses, benefits and access." },
    steps: [
      { is: "„Nýr starfsmaður“ til að bæta við, eða „Flytja inn (Excel)“ fyrir marga í einu. Smelltu á starfsmann til að opna prófílinn hans.", en: "\"New employee\" to add one, or \"Import (Excel)\" for many at once. Click an employee to open their profile." },
      { is: "Á Laun-flipanum stillirðu taxta, starfshlutfall og kjarasamning. Álög og yfirvinna koma sjálfkrafa úr samningnum.", en: "On the Pay tab set the rate, employment ratio and union. Premiums and overtime come from the agreement automatically." },
      { is: "Veldu „Eigin reglur“ til að smíða sérreglur: yfirvinna eftir X klst/viku eða Y klst/mánuði, og sérálög á tilteknum tímabilum (t.d. kvöld +33%).", en: "Choose \"Custom rules\" to build your own: overtime after X hrs/week or Y hrs/month, and custom premiums for time windows (e.g. evenings +33%)." },
      { is: "Desember- og orlofsuppbót birtast eftir kjarasamningi og greiðast sjálfkrafa í réttum mánuði. Bættu við hlunnindum (t.d. ökutækjastyrk) neðst.", en: "December & holiday bonuses show per agreement and pay automatically in the right month. Add benefits (e.g. vehicle allowance) below." },
      { is: "Á Vinna-flipanum stýrirðu aðgangi starfsmanns að Mitt svæði — hvað hann má sjá og gera.", en: "On the Work tab you control the employee's access to My area — what they can see and do." },
    ],
  },
  {
    id: "launakeyrslur", icon: ic("M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"), img: "/help/payroll.png",
    title: { is: "Launakeyrslur", en: "Payroll" },
    intro: { is: "VAKTO reiknar laun eftir íslenskum kjarasamningum út frá samþykktum tímum og flytur út í Payday.", en: "VAKTO computes pay per Icelandic agreements from approved hours and exports to Payday." },
    steps: [
      { is: "Smelltu „Keyra launakeyrslu“ — VAKTO reiknar dagvinnu, álög, yfirvinnu, uppbætur, staðgreiðslu, lífeyri og félagsgjald.", en: "Click \"Run payroll\" — VAKTO computes regular pay, premiums, overtime, bonuses, withholding, pension and union dues." },
      { is: "Smelltu á línu til að sjá launaseðil starfsmanns með sundurliðun.", en: "Click a row to see the employee's payslip with a full breakdown." },
      { is: "„Flytja í Payday“ býr til CSV sem Payday les beint (staðgreiðsluskil o.fl. eru þar).", en: "\"Export to Payday\" produces a CSV Payday reads directly (withholding filing etc.)." },
      { is: "Aðeins samþykktir tímar reiknast — passaðu að samþykkja tíma í Tímaskráningu fyrst.", en: "Only approved hours are counted — make sure to approve hours in Time first." },
    ],
  },
  {
    id: "skyrslur", icon: ic("M4 20V10M10 20V4M16 20v-8M20 20H2"), img: "/help/reports.png",
    title: { is: "Innsýn & skýrslur", en: "Insights & reports" },
    intro: { is: "Innsýn sýnir rekstur og framlegð (eigandi) og tíma & mætingu — og þrjár skýrslur sem þú sækir í Excel eða PDF.", en: "Insights shows operations & margin (owner) and time & attendance — plus three reports you download as Excel or PDF." },
    steps: [
      { is: "Veldu tímabil efst á flipanum — allar tölur og skýrslur fylgja því.", en: "Pick a period at the top of the tab — every figure and report follows it." },
      { is: "Skýrslusafnið hefur þrjár skýrslur: Arðsemi (laun % af veltu), Launakostnaður per starfsmaður og Mæting & frávik. Síaðu eftir deild eða starfsmanni og smelltu til að sækja.", en: "The report library has three reports: Profitability (labor % of revenue), Labor cost per employee and Attendance & deviations. Filter by department or employee and click to download." },
      { is: "„Excel“ / „PDF“ efst sækir tímaskýrslu tímabilsins með samþykktum og óafgreiddum tímum aðgreindum.", en: "\"Excel\" / \"PDF\" at the top downloads the period's time report with approved and pending hours separated." },
    ],
  },
  {
    id: "mitt-svaedi", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/myarea.png",
    title: { is: "Mitt svæði — stimpla inn/út", en: "My area — clock in/out" }, staff: true,
    intro: { is: "Þarna stimpla starfsmenn sig inn/út, sjá vaktir og laun, senda beiðnir og opna stafrænt skírteini.", en: "Here staff clock in/out, see shifts and pay, send requests and open a digital ID card." },
    steps: [
      { is: "Stimpla inn/út með einum smelli efst. Tíminn telur í rauntíma á meðan vaktin stendur.", en: "Clock in/out with one tap at the top. The timer counts live while on shift." },
      { is: "Gleymdirðu að stimpla út? Sendu leiðréttingarbeiðni — stjórnandinn samþykkir og tíminn lagast.", en: "Forgot to clock out? Send a correction request — your manager approves it and the time is fixed." },
      { is: "Launamat mánaðarins og réttindi (orlof, tímabanki) sjást á sama stað. Launaseðlar sækjast þar líka.", en: "The month's pay estimate and entitlements (leave, time bank) are in the same place. Payslips download there too." },
      { is: "„Skírteini“ opnar stafrænt starfsmannaskírteini sem þú sýnir á vinnustaðnum.", en: "\"ID card\" opens the digital staff ID you show at work." },
    ],
  },
  {
    id: "vaktir", icon: ic("M8 2v4M16 2v4|M3 9h18|M3 5h18v16H3z"), staff: true,
    title: { is: "Mínar vaktir & beiðnir", en: "My shifts & requests" },
    intro: { is: "Sjáðu vaktirnar þínar viku fyrir viku, sæktu um lausar vaktir og sendu beiðnir um frí, vaktaskipti eða framboð.", en: "See your shifts week by week, apply for open shifts and send requests for leave, shift swaps or availability." },
    steps: [
      { is: "Næsta vakt birtist efst; flettu milli vikna með örvunum. Nýtt vaktaplan kemur sem tilkynning þegar það er gefið út.", en: "Your next shift is at the top; flip between weeks with the arrows. A new schedule arrives as a notification when published." },
      { is: "„Lausar vaktir“ sýnir vaktir sem vantar fólk í — smelltu „Sækja um“ og stjórnandinn staðfestir.", en: "\"Open shifts\" lists shifts that need people — tap \"Apply\" and your manager confirms." },
      { is: "Beiðnir: frí (dagsetningar + ástæða), vaktaskipti (veldu vakt og samstarfsmann) eða framboð (hvenær þú getur unnið). Staða beiðnar sést í listanum.", en: "Requests: leave (dates + reason), shift swap (pick the shift and a colleague) or availability (when you can work). Each request shows its status in the list." },
    ],
  },
  {
    id: "spjall", icon: ic("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), staff: true,
    title: { is: "Spjall & fréttaveita", en: "Chat & news feed" },
    intro: { is: "Spjallið er fyrir samskipti við samstarfsfólk og stjórnendur; fréttaveitan fyrir tilkynningar frá fyrirtækinu.", en: "Chat is for talking with colleagues and managers; the news feed is for company announcements." },
    steps: [
      { is: "„Almennt“ er rás fyrir allt fyrirtækið. Búðu til hópa eða skrifaðu beint á einn samstarfsmann með fólk-leitinni.", en: "\"General\" is the company-wide channel. Create groups or message one colleague directly via the people search." },
      { is: "Svaraðu í þráð, bregstu við skilaboðum og eyddu eigin skilaboðum með hover-aðgerðunum á bólunni.", en: "Reply in a thread, react to messages and delete your own messages with the hover actions on the bubble." },
      { is: "Fréttaveitan sýnir tilkynningar, afmæli og fréttir — bregstu við eða skrifaðu athugasemd.", en: "The news feed shows announcements, birthdays and news — react or leave a comment." },
    ],
  },
  {
    id: "stillingar", icon: ic("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"), img: "/help/settings.png",
    title: { is: "Stillingar & tengingar", en: "Settings & integrations" },
    intro: { is: "Staðir, stöður, notendaboð, veltuskráning og kiosk-slóð — allt á einum stað.", en: "Locations, positions, user invites, revenue entry and the kiosk link — all in one place." },
    steps: [
      { is: "Bættu við stöðum og stöðum (positions) og bjóddu notendum með hlutverki (stjórnandi / vaktstjóri / starfsmaður / verktaki).", en: "Add locations and positions, and invite users with a role (owner / manager / employee / contractor)." },
      { is: "Velta: búðu til API-lykil undir Tengingar og láttu sölukerfið senda veltuna — eða „Skrá veltu handvirkt“ / „Meðalvelta per vikudag“ til að áætla laun%.", en: "Revenue: create an API key under Integrations and let your POS send revenue — or \"Enter revenue manually\" / \"Average revenue per weekday\" to estimate labor%." },
      { is: "„Kiosk-stimpilklukka“: afritaðu slóðina og opnaðu á spjaldtölvu á staðnum.", en: "\"Kiosk time clock\": copy the link and open it on a tablet at the workplace." },
    ],
  },
  {
    id: "homescreen", icon: ic("M12 2 3 9h2v11h5v-6h4v6h5V9h2z"), staff: true,
    title: { is: "VAKTO á heimaskjáinn + tilkynningar", en: "VAKTO on your home screen + notifications" },
    intro: {
      is: "Settu vakto.is á heimaskjá símans — þá er VAKTO eins og app með push-tilkynningum: ný skilaboð, nýtt vaktaplan, svör við beiðnum.",
      en: "Add vakto.is to your phone's home screen — VAKTO then works like an app with push notifications: new messages, new schedules, request updates.",
    },
    steps: [
      { is: "iPhone (Safari): opnaðu vakto.is → ýttu á Deila-hnappinn (ferningur með ör upp) → „Add to Home Screen“ / „Bæta á heimaskjá“ → Add.", en: "iPhone (Safari): open vakto.is → tap Share (square with arrow) → \"Add to Home Screen\" → Add." },
      { is: "Android (Chrome): opnaðu vakto.is → ⋮ valmyndin → „Add to Home screen“ / „Setja á heimaskjá“ → Add.", en: "Android (Chrome): open vakto.is → the ⋮ menu → \"Add to Home screen\" → Add." },
      { is: "MIKILVÆGT á iPhone: opnaðu VAKTO alltaf með nýja íkoninum á heimaskjánum (ekki inni í Safari) — annars leyfir Apple ekki tilkynningar.", en: "IMPORTANT on iPhone: always open VAKTO from the new home-screen icon (not inside Safari) — otherwise Apple blocks notifications." },
      { is: "Kveiktu á tilkynningum: opnaðu appið af heimaskjánum → Mitt svæði → „Virkja tilkynningar“ → Leyfa. Búið — nú færðu push um skilaboð, nýtt vaktaplan og svör við beiðnum.", en: "Turn on notifications: open the app from the home screen → My area → \"Enable notifications\" → Allow. Done — you'll get pushes for messages, new schedules and request updates." },
    ],
  },
  {
    id: "kiosk", icon: ic("M4 3h16v14H4z|M8 21h8M12 17v4"), img: "/help/kiosk.png", staff: true,
    title: { is: "Kiosk stimpilklukka", en: "Kiosk time clock" },
    intro: { is: "Sameiginleg stimpilklukka á spjaldtölvu — starfsmenn stimpla sig með 4-stafa PIN, engin innskráning.", en: "A shared time clock on a tablet — staff clock in with a 4-digit PIN, no login." },
    steps: [
      { is: "Í Stillingum → Tengingar, afritaðu kiosk-slóðina og opnaðu hana á spjaldtölvu vinnustaðarins.", en: "In Settings → Integrations, copy the kiosk link and open it on the workplace tablet." },
      { is: "Starfsmaður smellir á nafnið sitt og slær inn PIN = síðustu 4 tölur í kennitölu. Stimplar inn og út með sama kóða.", en: "An employee taps their name and enters a PIN = the last 4 digits of their kennitala. Same code clocks in and out." },
      { is: "Veldu tungumál (IS/EN) efst í hægra horni — valið vistast á tækinu.", en: "Pick a language (IS/EN) at the top right — the choice is saved on the device." },
    ],
  },
];

const FAQ: { q: L; a: L; staff?: boolean }[] = [
  { q: { is: "Hvað er „laun af tekjum“ (laun%)?", en: "What is labor % of revenue?" }, a: { is: "Launakostnaður (með launatengdum gjöldum) deilt með veltu. Lægra er betra — VAKTO litakóðar það á mælaborðinu.", en: "Labor cost (incl. on-costs) divided by revenue. Lower is better — VAKTO color-codes it on the dashboard." } },
  { q: { is: "Hver sér hvað?", en: "Who sees what?" }, staff: true, a: { is: "Stjórnandi sér allt; vaktstjóri sér vaktir/tíma/starfsfólk/skýrslur; starfsmaður og verktaki sjá sitt svæði og spjall. Þú stýrir nánar per starfsmann á Vinna-flipanum.", en: "Owner sees everything; manager sees scheduling/time/staff/reports; employee and contractor see their own area and chat. You fine-tune per employee on the Work tab." } },
  { q: { is: "Get ég séð laun% án bókhaldstengingar?", en: "Can I see labor% without an accounting link?" }, a: { is: "Já — skráðu veltu handvirkt, eða settu inn meðalveltu per vikudag í Stillingum, þá áætlar kerfið laun%.", en: "Yes — enter revenue manually, or set an average revenue per weekday in Settings, and the system estimates labor%." } },
  { q: { is: "Ég gleymdi að stimpla út — hvað geri ég?", en: "I forgot to clock out — what do I do?" }, staff: true, a: { is: "Sendu leiðréttingarbeiðni í Mitt svæði með réttum tíma; stjórnandinn samþykkir og tíminn lagast.", en: "Send a correction request from My area with the right time; your manager approves it and the entry is fixed." } },
];

export default function HelpScreen({ role = "owner" }: { role?: string }) {
  const { lang } = useLang();
  // Employees and contractors only see the guides they can act on.
  const staffOnly = role === "employee" || role === "contractor";
  const guides = staffOnly ? GUIDES.filter((g) => g.staff) : GUIDES;
  const faq = staffOnly ? FAQ.filter((f) => f.staff) : FAQ;
  const [active, setActive] = useState(guides[0].id);
  const [q, setQ] = useState("");
  const norm = (sr: string) => sr.toLowerCase();
  const list = q ? guides.filter((g) => norm(tx(lang, g.title) + tx(lang, g.intro) + g.steps.map((s) => tx(lang, s)).join(" ")).includes(norm(q))) : guides;
  const g = guides.find((x) => x.id === active) ?? guides[0];

  return (
    <>
      <PageHeader title="Hjálp" subtitle={lang === "en" ? "Step-by-step guides with screenshots" : "Leiðbeiningar með skjáskotum, skref fyrir skref"} />
      <div className="emp-layout">
        <aside className="emp-side">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "en" ? "Search help…" : "Leita í hjálp…"}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 11px", font: "inherit", fontSize: 13, background: "var(--panel)", color: "var(--ink)" }} />
          <select className="emp-navsel" value={active} onChange={(e) => setActive(e.target.value)}>
            {guides.map((guide) => (
              <option key={guide.id} value={guide.id}>{tx(lang, guide.title)}</option>
            ))}
          </select>
          <nav className="emp-nav">
            {list.map((guide) => (
              <button key={guide.id} className={`emp-navi${guide.id === active ? " on" : ""}`} onClick={() => setActive(guide.id)}>{guide.icon}<span>{tx(lang, guide.title)}</span></button>
            ))}
            {!list.length && <div className="muted" style={{ fontSize: 12.5, padding: "8px 12px" }}>{lang === "en" ? "No matches." : "Ekkert fannst."}</div>}
          </nav>
        </aside>

        <main className="emp-main" style={{ maxWidth: 780 }}>
          <div className="card">
            <div className="cb">
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>{tx(lang, g.title)}</h2>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "6px 0 0" }}>{tx(lang, g.intro)}</p>
              {g.img && (
                <div className="help-shot">
                  <Image src={g.img} alt={tx(lang, g.title)} width={1280} height={800} style={{ width: "100%", height: "auto" }} />
                </div>
              )}
              <ol className="help-steps">
                {g.steps.map((s, i) => (
                  <li key={i}><span className="n">{i + 1}</span><span>{tx(lang, s)}</span></li>
                ))}
              </ol>
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ch"><div className="ct">{tx(lang, { is: "Algengar spurningar", en: "FAQ" })}</div></div>
            <div className="cb">
              {faq.map((f, i) => (
                <details key={i} style={{ borderBottom: "1px solid var(--line2)", padding: "12px 0" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>{tx(lang, f.q)}</summary>
                  <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{tx(lang, f.a)}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ch"><div className="ct">{tx(lang, { is: "Þarftu meiri aðstoð?", en: "Need more help?" })}</div></div>
            <div className="cb att">
              <a className="it rowlink" href="mailto:hjalp@vakto.is">
                <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div>
                <div className="tx"><b>hjalp@vakto.is</b><span>{tx(lang, { is: "sendu okkur línu — við svörum samdægurs", en: "email us — same-day reply" })}</span></div>
              </a>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
