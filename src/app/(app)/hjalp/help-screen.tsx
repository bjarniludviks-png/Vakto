"use client";

import { useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";

type L = { is: string; en: string };
const tx = (lang: string, v: L) => (lang === "en" ? v.en : v.is);
const ic = (d: string) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>;

type Guide = { id: string; icon: React.ReactNode; title: L; intro: L; img: string; steps: L[] };

const GUIDES: Guide[] = [
  {
    id: "byrja", icon: ic("M5 12h14|M13 6l6 6-6 6"), img: "/help/start.png",
    title: { is: "Fyrstu skrefin", en: "Getting started" },
    intro: { is: "Nýtt fyrirtæki er tilbúið á nokkrum mínútum. Mælaborðið leiðir þig í gegnum fjögur skref — smelltu á skref til að hoppa beint þangað.", en: "A new company is ready in minutes. The dashboard walks you through four steps — click a step to jump straight there." },
    steps: [
      { is: "1 · Fyrirtæki & staðir: skráðu starfsstöð (t.d. „Laugavegur“). Bættu svo við deildum og stöðum í Stillingar → Fyrirtæki ef þú vilt flokka fólkið.", en: "1 · Company & locations: add a workplace (e.g. \"Laugavegur\"). Then add departments and positions in Settings → Company if you want to group people." },
      { is: "2 · Starfsfólk: „Nýr starfsmaður“ eða „Flytja inn (Excel)“. Veldu hlutverk (starfsmaður / vaktstjóri / stjórnandi) — starfsmaður fær boð í pósti og sitt eigið Mitt svæði.", en: "2 · Staff: \"New employee\" or \"Import (Excel)\". Pick a role (employee / manager / owner) — the employee gets an email invite and their own My area." },
      { is: "3 · Vaktaplan: dragðu vaktir í reitina og smelltu „Gefa út vaktaplan“. Fjórar vaktategundir (dag-, morgun-, kvöld- og helgarvakt) eru tilbúnar — breyttu þeim undir „Skilgreindar vaktategundir“.", en: "3 · Schedule: drag shifts into cells and click \"Publish schedule\". Four shift types (day, morning, evening, weekend) are ready — edit them under \"Shift types\"." },
      { is: "4 · Velta: skráðu veltu handvirkt, settu meðalveltu per vikudag eða láttu sölukerfið senda hana með API-lykli. Þá sýnir mælaborðið laun sem % af veltu.", en: "4 · Revenue: enter it manually, set an average per weekday, or let your POS send it via an API key. The dashboard then shows labor as a % of revenue." },
      { is: "Stimpilklukka: starfsfólk stimplar sig í símanum (Mitt svæði) eða á spjaldtölvu með kiosk-slóðinni. Samþykktir tímar fara beint í launakeyrslu.", en: "Time clock: staff clock in on their phone (My area) or on a tablet via the kiosk link. Approved hours flow straight into payroll." },
    ],
  },
  {
    id: "maelabord", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/dashboard.png",
    title: { is: "Mælaborðið", en: "The dashboard" },
    intro: { is: "Mælaborðið gefur þér rauntíma-yfirsýn: unnar stundir, launakostnað, yfirvinnu, álag og laun sem % af veltu.", en: "The dashboard gives you a real-time overview: hours worked, labor cost, overtime, premiums and labor as a % of revenue." },
    steps: [
      { is: "Veldu tímabil efst (Í dag / Vika / Mánuður / Sérsnið) — allar tölur fylgja valinu og valið helst milli síðna.", en: "Pick a period at the top (Today / Week / Month / Custom) — all figures follow it and the choice persists across pages." },
      { is: "„Laun af tekjum“-hringurinn sýnir launakostnað ÷ veltu. Grænt er gott, rautt hátt. Undir honum sést veltan og hvort hún er handvirk, áætluð eða úr sölukerfi.", en: "The labor-% ring shows labor cost ÷ revenue. Green is good, red is high. Below it you see the revenue and whether it's manual, estimated or from your POS." },
      { is: "Yfirvinna og álag birtast bæði í klukkustundum og krónum. Yfirvinnan er reiknuð eftir raunreglum (t.d. yfir 40 klst/viku), ekki bara frávik.", en: "Overtime and premiums show in both hours and krónur. Overtime uses the real rules (e.g. over 40 hrs/week), not just deviation." },
      { is: "Línuritið sýnir alltaf síðustu 7 daga — áætlað vs raun. Farðu með músina yfir punkt til að sjá nákvæmar tölur.", en: "The line chart always shows the last 7 days — planned vs actual. Hover a point for exact numbers." },
      { is: "Smelltu á „Sérsníða“ til að fela spjöld sem þú vilt ekki sjá (✕) og sýna þau aftur (+). Val vistast sjálfkrafa.", en: "Click \"Customize\" to hide cards you don't want (✕) and show them again (+). Saved automatically." },
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
    title: { is: "Skýrslur & útflutningur", en: "Reports & export" },
    intro: { is: "Sæktu tímaskýrslur í Excel eða PDF — með samþykktum og ósamþykktum tímum aðgreindum.", en: "Export time reports to Excel or PDF — with approved and pending hours separated." },
    steps: [
      { is: "Veldu tímabil (Dagur / Vika / Mánuður / Sérsniðið) og deild ef við á.", en: "Choose a period (Day / Week / Month / Custom) and a department if needed." },
      { is: "Smelltu „Excel“ fyrir .xlsx eða „PDF“ fyrir prentvæna skýrslu. Skráin hleðst niður strax.", en: "Click \"Excel\" for .xlsx or \"PDF\" for a print-ready report. The file downloads immediately." },
      { is: "Í skýrslunni er hver færsla merkt: grænt = samþykkt, rautt = bíður. Neðst er samtala samþykktra og óafgreiddra tíma.", en: "In the report each entry is marked: green = approved, red = pending. The bottom totals approved vs pending hours." },
    ],
  },
  {
    id: "mitt-svaedi", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/myarea.png",
    title: { is: "Mitt svæði (starfsmenn)", en: "My area (staff)" },
    intro: { is: "Þarna stimpla starfsmenn sig inn/út, sjá vaktir og laun, senda beiðnir og opna stafrænt skírteini.", en: "Here staff clock in/out, see shifts and pay, send requests and open a digital ID card." },
    steps: [
      { is: "Stimpla inn/út með einum smelli efst. Tíminn telur í rauntíma á meðan vaktin stendur.", en: "Clock in/out with one tap at the top. The timer counts live while on shift." },
      { is: "Valmyndin vinstra megin: Yfirlit, Mínar vaktir, Laun, Réttindi og Prófíll.", en: "The left menu: Overview, My shifts, Pay, Rights and Profile." },
      { is: "Sendu beiðnir — frí, vaktaskipti, laust framboð eða leiðréttingu á tíma — og fylgstu með stöðu.", en: "Send requests — leave, shift swaps, availability or a time correction — and track their status." },
      { is: "„Skírteini“ opnar stafrænt starfsmannaskírteini. (Apple/Google Wallet er á leiðinni.)", en: "\"ID card\" opens the digital staff ID. (Apple/Google Wallet is coming.)" },
    ],
  },
  {
    id: "stillingar", icon: ic("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"), img: "/help/settings.png",
    title: { is: "Stillingar & tengingar", en: "Settings & integrations" },
    intro: { is: "Staðir, stöður, notendaboð, veltuskráning og kiosk-slóð — allt á einum stað.", en: "Locations, positions, user invites, revenue entry and the kiosk link — all in one place." },
    steps: [
      { is: "Bættu við stöðum og stöðum (positions) og bjóddu notendum með hlutverki (stjórnandi / vaktstjóri / starfsmaður / verktaki).", en: "Add locations and positions, and invite users with a role (owner / manager / employee / contractor)." },
      { is: "Veltuskráning: „Skrá veltu handvirkt“ fyrir daginn/tímabilið, eða „Meðalvelta per vikudag“ svo kerfið áætli laun% þegar engin rauntala er til. Raunvelta tekur alltaf fram yfir áætlun.", en: "Revenue: \"Enter revenue manually\" for a day/period, or \"Average revenue per weekday\" so the system estimates labor% when no actual figure exists. Actual revenue always wins over the estimate." },
      { is: "Samþættingar: búðu til API-lykil og sölukerfið þitt sendir veltuna sjálfkrafa — sjá leiðbeiningar undir „Samþættingar & API“.", en: "Integrations: create an API key and your POS sends revenue automatically — see \"Integrations & API\"." },
      { is: "„Kiosk-stimpilklukka“: afritaðu slóðina og opnaðu á spjaldtölvu á staðnum.", en: "\"Kiosk time clock\": copy the link and open it on a tablet at the workplace." },
      { is: "Áskrift: undir „Áskrift“ sérðu verð, fjölda notenda, skráða kortið, reikninga og getur skipt um kort eða sagt upp.", en: "Subscription: under \"Subscription\" you see the price, user count, the card on file, invoices, and can change the card or cancel." },
    ],
  },
  {
    id: "samthaettingar", icon: ic("M21 2l-9.6 9.6|M15.5 7.5l3 3L22 7l-3-3z|M11.4 11.6a5 5 0 1 0 1 1z"), img: "/help/tengingar.png",
    title: { is: "Samþættingar & API", en: "Integrations & API" },
    intro: { is: "VAKTO tengist öðrum kerfum með opnu API fyrir veltu og með útflutningi í launakerfi. Engin sérsmíði þarf í VAKTO — sölukerfið þitt (eða millilag eins og Zapier/Make) sendir veltuna með einni HTTP-beiðni.", en: "VAKTO connects to other systems via an open revenue API and payroll exports. Nothing custom is needed on VAKTO's side — your POS (or a middleware like Zapier/Make) sends revenue with a single HTTP request." },
    steps: [
      { is: "Stillingar → Samþættingar → „+ Ný tenging“. Nefndu tenginguna (t.d. „Kassinn“) og afritaðu lykilinn — hann birtist aðeins einu sinni.", en: "Settings → Integrations → \"+ New integration\". Name it (e.g. \"POS\") and copy the key — it is shown only once." },
      { is: "Sölukerfið sendir POST á https://www.vakto.is/api/v1/revenue með hausnum „Authorization: Bearer <lykill>“ og JSON: { \"date\": \"2026-09-22\", \"amount\": 214500, \"location\": \"Laugavegur\" }. Upphæð í heilum krónum; date og location eru valfrjáls (í dag / fyrsta starfsstöð).", en: "Your POS POSTs to https://www.vakto.is/api/v1/revenue with the header \"Authorization: Bearer <key>\" and JSON: { \"date\": \"2026-09-22\", \"amount\": 214500, \"location\": \"Laugavegur\" }. Amount in whole ISK; date and location are optional (today / first location)." },
      { is: "Hver sending bætir við einni veltufærslu — sendu eina á dag (t.d. við dagsuppgjör) svo veltan tvískráist ekki. Á Samþættingar-síðunni sérðu hvenær lykillinn var síðast notaður.", en: "Each call adds one revenue row — send once per day (e.g. at closing) so revenue isn't double-counted. The Integrations page shows when the key was last used." },
      { is: "Kassakerfi sem ekki kann að senda HTTP-beiðnir? Notaðu Zapier/Make, eða skráðu veltuna handvirkt / sem meðalveltu per vikudag. Sendu okkur línu á hjalp@vakto.is — við hjálpum við uppsetninguna.", en: "A POS that can't send HTTP requests? Use Zapier/Make, or enter revenue manually / as a weekday average. Email hjalp@vakto.is — we'll help with the setup." },
      { is: "Launakerfi: Launakeyrslur → „Flytja í Payday“ gefur Excel-skjal sem Payday les inn beint; DK-snið og almennt Excel/CSV eru líka í boði. Engin API-tenging er við Payday/DK — þú hleður skjalinu upp þar.", en: "Payroll systems: Payroll → \"Export to Payday\" produces an Excel file Payday imports directly; DK format and plain Excel/CSV are also available. There is no live API link to Payday/DK — you upload the file there." },
    ],
  },
  {
    id: "askrift", icon: ic("M2 7h20v12H2z|M2 11h20|M6 15h4"), img: "/help/askrift.png",
    title: { is: "Áskrift & greiðslur", en: "Subscription & billing" },
    intro: { is: "Ein áskrift: 5.990 kr/mán með 5 notendum, +590 kr fyrir hvern notanda umfram (án VSK). 14 daga frí prufa — kortið er skráð við nýskráningu en ekkert dregið fyrr en prufan er búin.", en: "One plan: 5,990 ISK/month incl. 5 users, +590 ISK per extra user (ex. VAT). 14-day free trial — the card is registered at signup but nothing is charged until the trial ends." },
    steps: [
      { is: "Stillingar → Áskrift sýnir stöðu (prufa / virk), fjölda notenda, kortið á skrá og reikninga með kvittunum.", en: "Settings → Subscription shows status (trial / active), user count, the card on file and invoices with receipts." },
      { is: "Mánaðargjaldið er tekið af kortinu á gjalddaga (sama mánaðardag og prufan endaði) og kvittun send í pósti. Notendafjöldi miðast við virka notendur á gjalddaga.", en: "The monthly fee is charged on the billing day (same day of month the trial ended) and a receipt emailed. The user count is the active users on the billing day." },
      { is: "Kortið er geymt hjá Straumi (Kvika) — VAKTO sér aldrei kortanúmerið. „Skipta um kort“ opnar örugga greiðslusíðu Straums.", en: "The card is stored with Straumur (Kvika) — VAKTO never sees the card number. \"Change card\" opens Straumur's secure payment page." },
      { is: "Mistakist greiðsla færðu póst og kerfið reynir aftur næstu daga; eftir 14 daga lokast aðgangur þar til kort er uppfært. Engin binding — „Segja upp áskrift“ hvenær sem er.", en: "If a payment fails you get an email and the system retries over the next days; after 14 days access is paused until the card is updated. No lock-in — \"Cancel subscription\" any time." },
    ],
  },
  {
    id: "homescreen", icon: ic("M12 2 3 9h2v11h5v-6h4v6h5V9h2z"), img: "/help/mitt-svaedi.png",
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
    id: "kiosk", icon: ic("M4 3h16v14H4z|M8 21h8M12 17v4"), img: "/help/kiosk.png",
    title: { is: "Kiosk stimpilklukka", en: "Kiosk time clock" },
    intro: { is: "Sameiginleg stimpilklukka á spjaldtölvu — starfsmenn stimpla sig með 4-stafa PIN, engin innskráning.", en: "A shared time clock on a tablet — staff clock in with a 4-digit PIN, no login." },
    steps: [
      { is: "Í Stillingum → Tengingar, afritaðu kiosk-slóðina og opnaðu hana á spjaldtölvu vinnustaðarins.", en: "In Settings → Integrations, copy the kiosk link and open it on the workplace tablet." },
      { is: "Starfsmaður smellir á nafnið sitt og slær inn PIN = síðustu 4 tölur í kennitölu. Stimplar inn og út með sama kóða.", en: "An employee taps their name and enters a PIN = the last 4 digits of their kennitala. Same code clocks in and out." },
      { is: "Veldu tungumál (IS/EN) efst í hægra horni — valið vistast á tækinu.", en: "Pick a language (IS/EN) at the top right — the choice is saved on the device." },
    ],
  },
];

const FAQ: { q: L; a: L }[] = [
  { q: { is: "Hvað er „laun af tekjum“ (laun%)?", en: "What is labor % of revenue?" }, a: { is: "Launakostnaður (með launatengdum gjöldum) deilt með veltu. Lægra er betra — VAKTO litakóðar það á mælaborðinu.", en: "Labor cost (incl. on-costs) divided by revenue. Lower is better — VAKTO color-codes it on the dashboard." } },
  { q: { is: "Hver sér hvað?", en: "Who sees what?" }, a: { is: "Stjórnandi sér allt; vaktstjóri sér vaktir/tíma/starfsfólk/skýrslur; starfsmaður og verktaki sjá sitt svæði og spjall. Þú stýrir nánar per starfsmann á Vinna-flipanum.", en: "Owner sees everything; manager sees scheduling/time/staff/reports; employee and contractor see their own area and chat. You fine-tune per employee on the Work tab." } },
  { q: { is: "Virkar AI-vaktaplanið?", en: "Does AI scheduling work?" }, a: { is: "Já — „Gervigreind (AI) bestun“ býr til tillögu sem þú samþykkir áður en hún birtist.", en: "Yes — \"AI optimize\" proposes a plan you approve before it's published." } },
  { q: { is: "Get ég séð laun% án bókhaldstengingar?", en: "Can I see labor% without an accounting link?" }, a: { is: "Já — skráðu veltu handvirkt, eða settu inn meðalveltu per vikudag í Stillingum, þá áætlar kerfið laun%.", en: "Yes — enter revenue manually, or set an average revenue per weekday in Settings, and the system estimates labor%." } },
  { q: { is: "Hvaða kerfum get ég tengt VAKTO við?", en: "Which systems can VAKTO connect to?" }, a: { is: "Hvaða sölukerfi sem getur sent HTTP-beiðni (eða gegnum Zapier/Make) getur sent veltu á opna API-ið okkar með API-lykli. Laun flytjast í Payday (Excel) og DK (CSV). Sjá „Samþættingar & API“.", en: "Any POS that can send an HTTP request (or via Zapier/Make) can push revenue to our open API with an API key. Payroll exports to Payday (Excel) and DK (CSV). See \"Integrations & API\"." } },
  { q: { is: "Hvað kostar VAKTO og hvenær er dregið af kortinu?", en: "What does VAKTO cost and when is the card charged?" }, a: { is: "5.990 kr/mán með 5 notendum, +590 kr á hvern notanda umfram (án VSK). Fyrstu 14 dagarnir eru fríir; fyrsta gjaldið er tekið þegar prufan er búin og svo mánaðarlega. Engin binding.", en: "5,990 ISK/month incl. 5 users, +590 ISK per extra user (ex. VAT). The first 14 days are free; the first charge comes when the trial ends, then monthly. No lock-in." } },
  { q: { is: "Hvernig fær starfsfólkið aðgang?", en: "How do staff get access?" }, a: { is: "Þegar þú skráir starfsmann með netfangi fær hann boð í pósti, býr til lykilorð og lendir í Mitt svæði. Best er að setja vakto.is á heimaskjá símans — þá virka push-tilkynningar.", en: "When you add an employee with an email they get an invite, set a password and land in My area. Adding vakto.is to the phone's home screen enables push notifications." } },
];

export default function HelpScreen() {
  const { lang } = useLang();
  const [active, setActive] = useState(GUIDES[0].id);
  const [q, setQ] = useState("");
  const norm = (sr: string) => sr.toLowerCase();
  const list = q ? GUIDES.filter((g) => norm(tx(lang, g.title) + tx(lang, g.intro) + g.steps.map((s) => tx(lang, s)).join(" ")).includes(norm(q))) : GUIDES;
  const g = GUIDES.find((x) => x.id === active) ?? GUIDES[0];

  return (
    <>
      <PageHeader title="Hjálp" subtitle={lang === "en" ? "Step-by-step guides with screenshots" : "Leiðbeiningar með skjáskotum, skref fyrir skref"} />
      <div className="emp-layout">
        <aside className="emp-side">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={lang === "en" ? "Search help…" : "Leita í hjálp…"}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 11px", font: "inherit", fontSize: 13, background: "var(--panel)", color: "var(--ink)" }} />
          <select className="emp-navsel" value={active} onChange={(e) => setActive(e.target.value)}>
            {GUIDES.map((guide) => (
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
              <div className="help-shot">
                <Image src={g.img} alt={tx(lang, g.title)} width={1280} height={800} style={{ width: "100%", height: "auto" }} />
              </div>
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
              {FAQ.map((f, i) => (
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
              <div className="it">
                <div className="ic good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
                <div className="tx"><b>{tx(lang, { is: "Spjall við aðstoð", en: "Live chat" })}</b><span>{tx(lang, { is: "neðst í hægra horni", en: "bottom-right corner" })}</span></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
