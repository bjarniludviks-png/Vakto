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
    intro: { is: "Nýtt fyrirtæki er tilbúið á nokkrum mínútum. Á mælaborðinu er gátlisti með sjö skrefum. Smelltu á skref til að fara beint þangað. Gátlistinn hverfur þegar allt er klárt.", en: "A new company is ready in minutes. The dashboard shows a seven-step checklist. Click a step to jump straight there. The checklist disappears once everything is done." },
    steps: [
      { is: "Fyrirtækið: skráðu kennitölu og heimilisfang í Stillingar → Fyrirtæki. Þau fara á samninga, launaseðla og skírteini.", en: "Company: add your ID number and address in Settings → Company. They appear on contracts, payslips and ID cards." },
      { is: "Starfsstöð: Stillingar → Staðir og teymi → „+ Ný starfsstöð“. Bættu líka við deildum og starfsheitum ef þú vilt flokka fólkið.", en: "Location: Settings → Locations and teams → \"+ New location\". Add departments and job titles too if you want to group people." },
      { is: "Starfsfólk: „+ Nýr starfsmaður“ opnar síðu með fimm hlutum: persónuupplýsingum, hlutverki, starfi, launum og skjölum. Aðeins nafn og laun eru nauðsynleg. Með netfangi fær starfsmaðurinn boð í appið.", en: "Staff: \"+ New employee\" opens a page with five parts: personal details, role, job, pay and documents. Only name and pay are required. With an email address the employee gets an app invite." },
      { is: "Kjarasamningur: veldu stéttarfélag (t.d. Eflingu eða VR) á hvern starfsmann svo álög, yfirvinna og orlof reiknist rétt.", en: "Collective agreement: pick a union (e.g. Efling or VR) for each employee so premiums, overtime and holiday pay are calculated correctly." },
      { is: "Vaktaplan: dragðu vaktir í reitina og smelltu „Gefa út vaktaplan“. Starfsfólkið fær planið í símann.", en: "Schedule: drag shifts into the cells and click \"Publish schedule\". Staff get the plan on their phone." },
      { is: "Stimplun: starfsfólk stimplar sig í appinu, eða þú setur upp stimpilklukku á spjaldtölvu í Stillingar → Staðir og teymi → Tæki á staðnum.", en: "Clocking in: staff clock in in the app, or you set up a tablet time clock in Settings → Locations and teams → Devices on site." },
      { is: "Velta: tengdu sölukerfi, skráðu veltu handvirkt eða áætlaðu hana út frá mánaðarveltu í Stillingar → Tengingar. Þá sérðu laun sem % af veltu.", en: "Revenue: connect your sales system, enter revenue manually or estimate it from monthly revenue in Settings → Integrations. Then you see labor as a % of revenue." },
    ],
  },
  {
    id: "maelabord", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/dashboard.png",
    title: { is: "Mælaborðið", en: "The dashboard" },
    intro: { is: "Mælaborðið svarar einni spurningu: hvernig gengur reksturinn? Stærsta talan er laun sem hlutfall af veltu.", en: "The dashboard answers one question: how is the business doing? The biggest number is labor as a share of revenue." },
    steps: [
      { is: "Veldu tímabil efst: Í dag, Vika, 30 dagar eða eigin dagsetningar. Allar tölur fylgja valinu.", en: "Pick a period at the top: Today, Week, 30 days or your own dates. Every figure follows the choice." },
      { is: "Laun % af veltu er grænt innan markmiðs, gult nálægt því og rautt yfir því. Markmiðið stillirðu í Stillingar → Reglur og laun. Til hliðar sérðu þróunina síðustu 8 vikur.", en: "Labor % of revenue is green within target, yellow near it and red above it. Set the target in Settings → Rules and pay. Beside it you see the trend for the last 8 weeks." },
      { is: "Heildarvinnustundir, launakostnaður og „Mættir á vakt núna“ sýna stöðuna miðað við planið. Frávik eru sýnd bæði í klukkustundum og krónum.", en: "Total hours, labor cost and \"On shift now\" show where you stand against the plan. Deviations are shown in both hours and krónur." },
      { is: "„Áætlað og unnið, dag fyrir dag“ ber planið saman við unna tíma. Farðu með músina yfir súlu til að sjá tölurnar.", en: "\"Planned vs worked, day by day\" compares the plan with hours worked. Hover a bar to see the numbers." },
      { is: "„Krefst athygli stjórnanda“ listar það sem þarf að afgreiða: fólk sem er ekki mætt, beiðnir og gleymdar útstimplanir.", en: "\"Needs attention\" lists what to handle: people who haven't shown up, requests and forgotten clock-outs." },
    ],
  },
  {
    id: "vaktaplan", icon: ic("M8 2v4M16 2v4|M3 9h18|M3 5h18v16H3z"), img: "/help/schedule.png",
    title: { is: "Vaktaplan", en: "Scheduling" },
    intro: { is: "Búðu til vaktaplanið með því að draga vaktir í reitina, eða láttu gervigreind gera tillögu. Kostnaðurinn reiknast á meðan.", en: "Build the schedule by dragging shifts into the cells, or let AI propose one. The cost is calculated as you go." },
    steps: [
      { is: "Hver lína er starfsmaður og hver dálkur dagur. Smelltu á auðan reit til að bæta við vakt, eða dragðu vakt á milli reita og starfsmanna.", en: "Each row is an employee and each column a day. Click an empty cell to add a shift, or drag a shift between cells and people." },
      { is: "„Afrita síðustu viku“ sparar tíma þegar vikurnar eru líkar. Vaktategundir (dagvakt, kvöldvakt o.fl.) stillirðu undir „Skilgreindar vaktategundir“.", en: "\"Copy last week\" saves time when weeks are similar. Set up shift types (day, evening etc.) under \"Shift types\"." },
      { is: "Efst sérðu heildartíma, launakostnað og laun % af veltuspá. Ef planið fer yfir launaáætlunina sérðu það strax í krónum, áður en þú birtir.", en: "At the top you see total hours, labor cost and labor % of forecast revenue. If the plan goes over budget you see it in krónur right away, before you publish." },
      { is: "„Gervigreind (AI) bestun“ gerir tillögu út frá mönnunarþörf og veltuspá. Þú ferð yfir hana og samþykkir áður en nokkuð breytist.", en: "\"AI optimize\" proposes a plan from staffing needs and the revenue forecast. You review and approve it before anything changes." },
      { is: "Smelltu „Gefa út vaktaplan“ þegar planið er klárt. Starfsfólkið sér vaktirnar sínar í appinu og fær tilkynningu.", en: "Click \"Publish schedule\" when it's ready. Staff see their shifts in the app and get a notification." },
    ],
  },
  {
    id: "timaskraning", icon: ic("M12 7v5l3 2|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z"), img: "/help/time.png",
    title: { is: "Tímaskráning & samþykki", en: "Time & approvals" },
    intro: { is: "Hér sérðu hverjir eru á vakt, hvað var unnið miðað við planið og hvað frávikin kosta.", en: "See who's on shift, what was worked against the plan and what the deviations cost." },
    steps: [
      { is: "„Á vakt núna“ sýnir opnar stimplanir. Þú getur leiðrétt tíma eða stimplað starfsmann út ef hann gleymdi því. Stimplun sem hefur verið opin í meira en 12 klst. er merkt sérstaklega.", en: "\"On shift now\" shows open punches. You can correct a time or clock someone out if they forgot. A punch open for more than 12 hours is flagged." },
      { is: "„Plan og unnið per starfsmann“ sýnir plan, unna tíma, frávik og kostnað frávika, með samtölu neðst. Starfsfólk án skráningar á tímabilinu er falið þar til þú smellir á „Sýna“.", en: "\"Planned and worked per employee\" shows plan, hours worked, deviation and its cost, with a total at the bottom. Staff without entries in the period are hidden until you click \"Show\"." },
      { is: "Hakaðu við starfsmenn og smelltu „Samþykkja valda“, eða smelltu á starfsmann til að fara yfir hverja stimplun. Aðeins samþykktir tímar fara í launin.", en: "Tick employees and click \"Approve selected\", or click someone to review each punch. Only approved hours go into payroll." },
      { is: "Leiðréttingabeiðnir frá starfsfólki birtast fyrir ofan listann. Samþykktu þær eða hafnaðu.", en: "Correction requests from staff appear above the list. Approve or reject them." },
      { is: "„Stimpla inn starfsmann“ skráir stimplun handvirkt, t.d. ef síminn var rafmagnslaus.", en: "\"Clock in employee\" records a punch manually, e.g. if a phone ran out of battery." },
    ],
  },
  {
    id: "starfsfolk", icon: ic("M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8|M5 21c0-3.9 3.1-7 7-7s7 3.1 7 7"), img: "/help/staff.png",
    title: { is: "Starfsfólk & launasnið", en: "Staff & pay profiles" },
    intro: { is: "Hver starfsmaður hefur sitt spjald með launum, vinnu, fríi, samningum, skjölum og persónuupplýsingum.", en: "Each employee has a profile with pay, work, leave, contracts, documents and personal details." },
    steps: [
      { is: "„+ Nýr starfsmaður“ opnar síðu þar sem þú fyllir út persónuupplýsingar, hlutverk, starf, laun og skjöl. „Flytja inn (Excel)“ les marga inn í einu.", en: "\"+ New employee\" opens a page for personal details, role, job, pay and documents. \"Import (Excel)\" adds many at once." },
      { is: "Hlutverkið ræður aðgangi: starfsmaður fær appið, vaktstjóri sér líka vaktaplan, tímaskráningu og starfsfólk, og stjórnandi sér allt. Verktaki sendir reikning og er hvorki með stéttarfélag, lífeyrissjóð né orlof.", en: "The role decides access: an employee gets the app, a manager also sees scheduling, time and staff, and an admin sees everything. A contractor sends invoices and has no union, pension fund or holiday pay." },
      { is: "Á Laun-flipanum stillirðu taxta, starfshlutfall og kjarasamning. Álög og yfirvinna koma úr samningnum, eða þú velur „Eigin reglur“ og smíðar þínar eigin.", en: "On the Pay tab you set the rate, employment ratio and agreement. Premiums and overtime come from the agreement, or you choose \"Custom rules\" and build your own." },
      { is: "Desember- og orlofsuppbót greiðast sjálfkrafa í réttum mánuði. Hlunnindum, t.d. ökutækjastyrk, bætirðu við neðst.", en: "December and holiday bonuses are paid automatically in the right month. Add benefits, e.g. a vehicle allowance, at the bottom." },
      { is: "„Vista“ neðst geymir breytingar á öllum flipum í einu.", en: "\"Save\" at the bottom stores changes on every tab at once." },
    ],
  },
  {
    id: "samningar", icon: ic("M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z|M14 3v6h6|M8 15l2 2 4-4"), img: "/help/contracts.png",
    title: { is: "Ráðningar- og verksamningar", en: "Employment & contractor agreements" },
    intro: { is: "VAKTO býr samninginn til úr upplýsingum sem þegar eru skráðar og starfsmaðurinn undirritar hann rafrænt.", en: "VAKTO builds the contract from details you've already entered, and the employee signs it electronically." },
    steps: [
      { is: "Opnaðu starfsmann → Samningar → „+ Ráðningarsamningur úr gögnum“, eða „+ Verksamningur“ fyrir verktaka. Ráðningarsamningurinn fylgir formi Vinnumálastofnunar.", en: "Open an employee → Contracts → \"+ Employment contract from data\", or \"+ Contractor agreement\" for a contractor. The employment contract follows the Directorate of Labour's form." },
      { is: "Reitir sem vantar eru merktir. Fylltu þá út áður en þú sendir. Sérákvæði fyrirtækisins úr Stillingar → Reglur og laun bætast við sjálfkrafa.", en: "Missing fields are marked. Fill them in before sending. Your company's special terms from Settings → Rules and pay are added automatically." },
      { is: "„Undirrita & senda“: þú undirritar fyrst og svo fær starfsmaðurinn tölvupóst og undirritar með kóða, eða með rafrænum skilríkjum ef það er virkt.", en: "\"Sign & send\": you sign first, then the employee gets an email and signs with a code, or with an electronic ID if enabled." },
      { is: "Undirritaður samningur vistast sem PDF í skjalasafni starfsmannsins og afrit fer til beggja.", en: "The signed contract is saved as a PDF in the employee's documents and a copy goes to both of you." },
    ],
  },
  {
    id: "launakeyrslur", icon: ic("M12 1v22|M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"), img: "/help/payroll.png",
    title: { is: "Launakeyrslur", en: "Payroll" },
    intro: { is: "VAKTO reiknar launin úr samþykktum tímum eftir kjarasamningi og flytur þau út í launakerfið þitt.", en: "VAKTO calculates pay from approved hours under the collective agreement and exports it to your payroll system." },
    steps: [
      { is: "Veldu mánuð efst. Stóra talan er heildarlaunakostnaður með launatengdum gjöldum. Til hliðar sést hvað starfsfólkið fær útborgað.", en: "Pick a month at the top. The big number is total labor cost including on-costs. Beside it you see what staff are paid out." },
      { is: "Smelltu á starfsmann til að sjá launaseðilinn með sundurliðun. „Sækja alla seðla“ sækir þá alla í einu.", en: "Click an employee to see their payslip with a breakdown. \"Download all payslips\" gets them all at once." },
      { is: "„Læsa og keyra laun“ vistar launakeyrsluna. Gerðu það þegar allir tímar mánaðarins hafa verið samþykktir.", en: "\"Lock and run payroll\" saves the payroll run. Do it once all hours for the month are approved." },
      { is: "Gagnaútflutningur: „Flytja“ býr til tímaskrá sem Payday les inn. DK og Excel eru líka í boði.", en: "Export: \"Export\" creates a timesheet file Payday imports. DK and Excel are available too." },
      { is: "Aðeins samþykktir tímar reiknast, svo samþykktu þá fyrst í Tímaskráningu.", en: "Only approved hours count, so approve them in Time first." },
    ],
  },
  {
    id: "skyrslur", icon: ic("M4 20V10M10 20V4M16 20v-8M20 20H2"), img: "/help/reports.png",
    title: { is: "Innsýn & skýrslur", en: "Insights & reports" },
    intro: { is: "Innsýn sýnir hvernig reksturinn þróast og geymir allar skýrslur til niðurhals.", en: "Insights shows how the business is trending and holds every report for download." },
    steps: [
      { is: "„Rekstur & framlegð“: laun % af veltu per mánuð, samanburður milli tímabila, launakostnaður eftir deild og ábendingar.", en: "\"Operations & margin\": labor % of revenue per month, period comparison, labor cost by department and suggestions." },
      { is: "„Tímar & mæting“: plan á móti unnum tímum, tímabanki starfsfólks og fjarvistir.", en: "\"Hours & attendance\": plan vs hours worked, staff time bank and absences." },
      { is: "Skýrslusafnið: veldu deild eða starfsmann og smelltu á skýrslu til að sækja hana í Excel eða PDF.", en: "Report library: pick a department or employee and click a report to download it as Excel or PDF." },
      { is: "AI greining: spurðu um gögnin á mannamáli, t.d. „hvar er yfirvinnan að myndast?“, og fáðu svar með töflu eða grafi.", en: "AI analysis: ask about your data in plain language, e.g. \"where is overtime building up?\", and get an answer with a table or chart." },
    ],
  },
  {
    id: "mitt-svaedi", icon: ic("M3 12l9-9 9 9|M5 10v10h14V10"), img: "/help/myarea.png",
    title: { is: "Mitt svæði (starfsmenn)", en: "My area (staff)" },
    intro: { is: "Starfsfólk notar VAKTO-appið eða Mitt svæði í vafranum til að stimpla sig, sjá vaktir og laun og senda beiðnir.", en: "Staff use the VAKTO app or My area in the browser to clock in, see shifts and pay, and send requests." },
    steps: [
      { is: "„Stimpla mig inn“ þegar vaktin byrjar og „Stimpla mig út“ í lokin. Tíminn telur á meðan.", en: "\"Clock in\" when the shift starts and \"Clock out\" at the end. The timer runs in between." },
      { is: "Planið sýnir vaktir vikunnar, bæði eigin vaktir og teymisins, og lausar vaktir sem hægt er að sækja um.", en: "The plan shows the week's shifts, your own and the team's, plus open shifts you can apply for." },
      { is: "Sendu beiðni um frí, vaktaskipti eða leiðréttingu á tíma. Vaktstjórinn samþykkir með einum smelli.", en: "Send a request for leave, a shift swap or a time correction. The manager approves with one click." },
      { is: "Launamat, orlofsstaða, tímabanki, launaseðlar og skjöl fyrirtækisins eru öll á einum stað.", en: "Pay estimate, holiday balance, time bank, payslips and company documents are all in one place." },
    ],
  },
  {
    id: "spjall", icon: ic("M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"), img: "/help/chat.png",
    title: { is: "Spjall & fréttaveita", en: "Chat & news feed" },
    intro: { is: "Samskipti vinnustaðarins á einum stað, í sama appi og vaktirnar. Enginn þarf að gefa upp símanúmerið sitt.", en: "Workplace communication in one place, in the same app as the shifts. Nobody has to share their phone number." },
    steps: [
      { is: "Rás er fyrir allt starfsfólkið og fyrir hverja deild og starfsstöð. Þú getur líka stofnað hóp eða sent einkaskilaboð.", en: "There's a channel for all staff and one for each department and location. You can also create a group or send a direct message." },
      { is: "Svaraðu skilaboðum í þræði, bregstu við þeim og sendu myndir. Ólesin skilaboð eru merkt.", en: "Reply in threads, react to messages and send pictures. Unread messages are marked." },
      { is: "Fréttaveitan er fyrir tilkynningar. Festar færslur birtast efst og starfsfólk getur líkað við og skrifað athugasemdir.", en: "The news feed is for announcements. Pinned posts appear at the top and staff can like and comment." },
      { is: "Hverjir mega birta í fréttaveitunni stillirðu í Stillingar → Fyrirtæki.", en: "Choose who can post in the feed in Settings → Company." },
    ],
  },
  {
    id: "stillingar", icon: ic("M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z|M19 12a7 7 0 0 0-.1-1l2-1.6-2-3.4-2.4 1a7 7 0 0 0-1.7-1L14.5 2h-4l-.3 2.5a7 7 0 0 0-1.7 1l-2.4-1-2 3.4L5 11a7 7 0 0 0 0 2l-2 1.6 2 3.4 2.4-1a7 7 0 0 0 1.7 1l.3 2.5h4l.3-2.5a7 7 0 0 0 1.7-1l2.4 1 2-3.4-2-1.6a7 7 0 0 0 .1-1z"), img: "/help/settings.png",
    title: { is: "Stillingar", en: "Settings" },
    intro: { is: "Stillingarnar skiptast í sex flipa.", en: "Settings are split into six tabs." },
    steps: [
      { is: "Fyrirtæki: nafn, kennitala og heimilisfang, skjalasafn fyrirtækisins (t.d. starfsmannahandbók) og hverjir mega birta í fréttaveitu.", en: "Company: name, ID number and address, company documents (e.g. the staff handbook) and who can post in the feed." },
      { is: "Staðir og teymi: starfsstöðvar, starfsheiti og deildir, staðsetning við stimplun, kiosk-stimpilklukka og push-tilkynningar.", en: "Locations and teams: locations, job titles and departments, location check at clock-in, the kiosk time clock and push notifications." },
      { is: "Reglur og laun: laun % markmið, reglusniðmát, hámark í fríi sama dag, launatímabil og sérákvæði í ráðningarsamninga.", en: "Rules and pay: labor % target, rule templates, max on leave the same day, pay periods and special contract terms." },
      { is: "Tengingar: hvaðan veltan kemur, sölukerfi eins og Shopify og WooCommerce, og útflutningur í Payday og DK.", en: "Integrations: where revenue comes from, sales systems like Shopify and WooCommerce, and exports to Payday and DK." },
      { is: "Notendur og Áskrift: bjóða notendum, sjá verð, kort og reikninga.", en: "Users and Subscription: invite users, see price, card and invoices." },
    ],
  },
  {
    id: "samthaettingar", icon: ic("M21 2l-9.6 9.6|M15.5 7.5l3 3L22 7l-3-3z|M11.4 11.6a5 5 0 1 0 1 1z"), img: "/help/tengingar.png",
    title: { is: "Tengingar & API", en: "Integrations & API" },
    intro: { is: "Laun % þarf veltutölur. Þær geta komið sjálfkrafa úr kerfinu sem þú notar, eða þú slærð þær inn sjálf(ur).", en: "Labor % needs revenue figures. They can come automatically from the system you use, or you enter them yourself." },
    steps: [
      { is: "Stillingar → Tengingar → „Hvaðan kemur veltan þín?“: úr kerfi, handvirkt eða áætluð út frá mánaðarveltu. Raunvelta gildir alltaf fram yfir áætlun.", en: "Settings → Integrations → \"Where does your revenue come from?\": from a system, entered manually or estimated from monthly revenue. Actual revenue always wins over an estimate." },
      { is: "Shopify og WooCommerce: smelltu „Tengja“ og fylgdu skrefunum. VAKTO sækir veltuna sjálfkrafa á hverjum degi.", en: "Shopify and WooCommerce: click \"Connect\" and follow the steps. VAKTO fetches revenue automatically every day." },
      { is: "Annað kerfi: hladdu upp CSV- eða Excel-skrá, notaðu Zapier/Make, eða sendu veltuna beint með API-lykli: POST á https://www.vakto.is/api/v1/revenue með „Authorization: Bearer <lykill>“ og JSON { \"date\": \"2026-09-22\", \"amount\": 214500, \"location\": \"Laugavegur\" }. Sendu eina færslu á dag.", en: "Another system: upload a CSV or Excel file, use Zapier/Make, or send revenue directly with an API key: POST to https://www.vakto.is/api/v1/revenue with \"Authorization: Bearer <key>\" and JSON { \"date\": \"2026-09-22\", \"amount\": 214500, \"location\": \"Laugavegur\" }. Send one entry per day." },
      { is: "Kerfi sem eru ekki komin, t.d. Noona og Dineout: smelltu „Láta mig vita“ og við látum vita þegar tengingin er tilbúin.", en: "Systems not available yet, such as Noona and Dineout: click \"Notify me\" and we'll tell you when the connection is ready." },
      { is: "Launakerfi: Launakeyrslur → Gagnaútflutningur gefur skrá sem Payday les inn. DK og Excel eru líka í boði. Þú hleður skránni upp í launakerfinu.", en: "Payroll systems: Payroll → Export gives a file Payday imports. DK and Excel are available too. You upload the file in your payroll system." },
    ],
  },
  {
    id: "askrift", icon: ic("M2 7h20v12H2z|M2 11h20|M6 15h4"), img: "/help/askrift.png",
    title: { is: "Áskrift & greiðslur", en: "Subscription & billing" },
    intro: { is: "Ein áskrift: 9.990 kr/mán með 5 virkum starfsmönnum, +1.490 kr fyrir hvern virkan starfsmann umfram (án VSK). Virkur = átti vakt eða stimplaði sig í mánuðinum. 14 daga frí prufa — kortið er skráð við nýskráningu en ekkert dregið fyrr en prufan er búin.", en: "One plan: 9,990 ISK/month incl. 5 active employees, +1,490 ISK per extra active employee (ex. VAT). Active = had a shift or clocked in that month. 14-day free trial — the card is registered at signup but nothing is charged until the trial ends." },
    steps: [
      { is: "Stillingar → Áskrift sýnir stöðu (prufa / virk), fjölda notenda, kortið á skrá og reikninga með kvittunum.", en: "Settings → Subscription shows status (trial / active), user count, the card on file and invoices with receipts." },
      { is: "Mánaðargjaldið er tekið af kortinu á gjalddaga (sama mánaðardag og prufan endaði) og kvittun send í pósti. Virkir starfsmenn umfram fimm eru taldir eftir á fyrir mánuðinn sem lauk.", en: "The monthly fee is charged on the billing day (same day of month the trial ended) and a receipt emailed. Active employees beyond five are counted afterwards for the month that ended." },
      { is: "Kortið er geymt hjá Straumi (Kvika) — VAKTO sér aldrei kortanúmerið. „Skipta um kort“ opnar örugga greiðslusíðu Straums.", en: "The card is stored with Straumur (Kvika) — VAKTO never sees the card number. \"Change card\" opens Straumur's secure payment page." },
      { is: "Mistakist greiðsla færðu póst og kerfið reynir aftur næstu daga; eftir 14 daga lokast aðgangur þar til kort er uppfært. Engin binding — „Segja upp áskrift“ hvenær sem er.", en: "If a payment fails you get an email and the system retries over the next days; after 14 days access is paused until the card is updated. No lock-in — \"Cancel subscription\" any time." },
    ],
  },
  {
    id: "homescreen", icon: ic("M12 2 3 9h2v11h5v-6h4v6h5V9h2z"), img: "/help/homescreen.png",
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
      { is: "Í Stillingar → Staðir og teymi → Tæki á staðnum, smelltu á „Kiosk-stimpilklukka“ til að afrita slóðina og opnaðu hana á spjaldtölvu vinnustaðarins.", en: "In Settings → Locations and teams → Devices on site, click \"Kiosk time clock\" to copy the link and open it on the workplace tablet." },
      { is: "Starfsmaður smellir á nafnið sitt og slær inn PIN = síðustu 4 tölur í kennitölu. Stimplar inn og út með sama kóða.", en: "An employee taps their name and enters a PIN = the last 4 digits of their kennitala. Same code clocks in and out." },
      { is: "Veldu tungumál (IS/EN) efst í hægra horni — valið vistast á tækinu.", en: "Pick a language (IS/EN) at the top right — the choice is saved on the device." },
    ],
  },
];

const FAQ: { q: L; a: L }[] = [
  { q: { is: "Hvað er „laun af tekjum“ (laun%)?", en: "What is labor % of revenue?" }, a: { is: "Launakostnaður (með launatengdum gjöldum) deilt með veltu. Lægra er betra — VAKTO litakóðar það á mælaborðinu.", en: "Labor cost (incl. on-costs) divided by revenue. Lower is better — VAKTO color-codes it on the dashboard." } },
  { q: { is: "Hver sér hvað?", en: "Who sees what?" }, a: { is: "Stjórnandi sér allt; vaktstjóri sér vaktir/tíma/starfsfólk/skýrslur; starfsmaður og verktaki sjá sitt svæði og spjall. Þú stýrir nánar per starfsmann á Vinna-flipanum.", en: "Owner sees everything; manager sees scheduling/time/staff/reports; employee and contractor see their own area and chat. You fine-tune per employee on the Work tab." } },
  { q: { is: "Virkar AI-vaktaplanið?", en: "Does AI scheduling work?" }, a: { is: "Já — „Gervigreind (AI) bestun“ býr til tillögu sem þú samþykkir áður en hún birtist.", en: "Yes — \"AI optimize\" proposes a plan you approve before it's published." } },
  { q: { is: "Get ég séð laun% án bókhaldstengingar?", en: "Can I see labor% without an accounting link?" }, a: { is: "Já — skráðu veltu handvirkt, eða áætlaðu hana út frá mánaðarveltu í Stillingar → Tengingar, þá áætlar kerfið laun%.", en: "Yes — enter revenue manually, or estimate it from monthly revenue in Settings → Integrations, and the system estimates labor%." } },
  { q: { is: "Hvaða kerfum get ég tengt VAKTO við?", en: "Which systems can VAKTO connect to?" }, a: { is: "Hvaða sölukerfi sem getur sent HTTP-beiðni (eða gegnum Zapier/Make) getur sent veltu á opna API-ið okkar með API-lykli. Shopify og WooCommerce tengjast með nokkrum smellum. Laun flytjast í Payday og DK. Sjá „Tengingar & API“.", en: "Any POS that can send an HTTP request (or via Zapier/Make) can push revenue to our open API with an API key. Shopify and WooCommerce connect in a few clicks. Payroll exports to Payday and DK. See \"Integrations & API\"." } },
  { q: { is: "Hvað kostar VAKTO og hvenær er dregið af kortinu?", en: "What does VAKTO cost and when is the card charged?" }, a: { is: "9.990 kr/mán með 5 virkum starfsmönnum, +1.490 kr á hvern virkan starfsmann umfram (án VSK) — virkur = átti vakt eða stimplaði sig í mánuðinum. Undirritun með rafrænum skilríkjum er valkvæð: 490 kr á undirskrift. Fyrstu 14 dagarnir eru fríir; fyrsta gjaldið er tekið þegar prufan er búin og svo mánaðarlega. Engin binding.", en: "9,990 ISK/month incl. 5 active employees, +1,490 ISK per extra active employee (ex. VAT) — active = had a shift or clocked in that month. Signing with electronic ID is optional: 490 ISK per signature. The first 14 days are free; the first charge comes when the trial ends, then monthly. No lock-in." } },
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
