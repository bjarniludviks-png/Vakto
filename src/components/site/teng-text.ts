// Texti síðunnar Tengingar (/tengingar). IS og EN hér; danska, sænska og norska í text/{da,sv,nb}.ts.
// ALLT hér á að vera satt: aðeins tengingar sem eru til í kóðanum (src/lib/integrations, payday.server.ts,
// bc-payroll.ts, dk-actions.ts, taktikal.server.ts, api/v1, api/mcp, api/cal, wallet) eru merktar „Virkt“.
// Skrefin lýsa raunverulegu viðmóti í Stillingum → Tengingar. Það sem er á leiðinni er merkt þannig.
import type { SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";

export type TengCat = "pay" | "rev" | "docs" | "ai" | "staff";
export type TengId = "payday" | "dk" | "businesscentral" | "excel" | "shopify" | "woocommerce" | "inventra" | "api" | "esign" | "mcp" | "wallet" | "calendar";
export type TengPlannedId = "uniconta" | "h3" | "m365" | "noona" | "dineout" | "regla" | "fortnox" | "nordic";

export type TengItem = {
  /** Undirfyrirsögn, t.d. „Laun og bókhald“. */
  sub: string;
  d: string;
  /** Gögn sem fara frá VAKTO / koma inn í VAKTO. */
  out: string[]; in: string[];
  need: string[];
  steps: string[];
};

export type TengText = {
  eyebrow: string; h1: [string, string]; lede: string;
  /** Athugasemd fyrir lönd utan Íslands (null á íslensku). */
  regionNote: string | null;
  jump: string;
  edgeEyebrow: string; edgeH: [string, string]; edgeP: string;
  edge: [string, string][];
  live: string; soon: string;
  outL: string; inL: string; needL: string; stepsL: string;
  cats: Record<TengCat, { h: string; p: string }>;
  items: Record<TengId, TengItem>;
  plannedH: string; plannedP: string;
  planned: Record<TengPlannedId, { name?: string; sub: string; d: string }>;
  askH: string; askP: string; askBtn: string;
  endH: string; endP: string; endBtn: string; endPrice: string;
};

const is: TengText = {
  eyebrow: "Tengingar",
  h1: ["Tengist kerfunum", "sem þú notar nú þegar."],
  lede: "Hér er listinn eins og hann er í dag: kerfin sem VAKTO tengist í alvöru, hvaða gögn fara á milli og hvernig þú tengir þau. Það sem er á leiðinni er merkt þannig.",
  regionNote: null,
  jump: "Sjá allar tengingar",
  edgeEyebrow: "Meira en útflutningur", edgeH: ["Flest vaktakerfi flytja út tíma.", "VAKTO reiknar launin."],
  edgeP: "Tenging við launakerfi er góð, en hún er bara síðasta skrefið. VAKTO sér um það sem gerist á undan, svo það sem fer í launakerfið er þegar rétt.",
  edge: [
    ["Laun eftir kjarasamningi", "Dagvinna, yfirvinna, álag, orlof og uppbætur reiknuð úr stimplunum, eftir samningi hvers starfsmanns."],
    ["Launaseðlar", "Starfsfólk sér launaseðilinn og áætluð laun í appinu, sundurliðað."],
    ["Ráðningarsamningar", "Samningur fylltur út úr gögnum starfsmannsins og undirritaður rafrænt í símanum."],
    ["Spjall og fréttaveita", "Rásir per deild og stað, og fréttir fyrir allan hópinn, í sama appi og vaktirnar."],
    ["VAKTO AI", "Setur upp vaktaplan, svarar með þínum tölum og spyr alltaf áður en hann breytir nokkru."],
  ],
  live: "Virkt", soon: "Á leiðinni",
  outL: "Frá VAKTO", inL: "Inn í VAKTO", needL: "Þú þarft", stepsL: "Svona tengirðu",
  cats: {
    pay: { h: "Laun og bókhald", p: "VAKTO reiknar launin. Launakerfið sér áfram um staðgreiðslu, skil og greiðslur." },
    rev: { h: "Velta", p: "Laun sem hlutfall af veltu þarf veltutölur. Þær koma sjálfkrafa úr kassanum, netversluninni eða bókhaldinu." },
    docs: { h: "Samningar og undirritun", p: "Ráðningarsamningar og starfslok undirrituð rafrænt, án pappírs." },
    ai: { h: "Gervigreind og forritarar", p: "Tengdu þín eigin tól, með lyklum sem þú stjórnar." },
    staff: { h: "Fyrir starfsfólkið", p: "Vaktirnar og skírteinið þar sem starfsfólkið er nú þegar: í símanum." },
  },
  items: {
    payday: {
      sub: "Laun og bókhald",
      d: "Samþykktir tímar fara beint inn í launakeyrslu í Payday sem tímaskrá, með einum smelli. VAKTO Verk býr líka til reikninga í Payday.",
      out: ["Tímar per starfsmann: dagvinna, yfirvinna og álag eftir prósentu", "Reikningar fyrir verk (VAKTO Verk)"],
      in: [],
      need: ["Payday-aðgang með API (Client ID og Client Secret)", "Launaliði í Payday sem heita eins og í VAKTO (Dagvinna, Yfirvinna, Álag 33% …)"],
      steps: [
        "Í Payday: Stillingar → Fyrirtæki → API. Búðu til aðgang og nefndu hann VAKTO.",
        "Í VAKTO: Stillingar → Tengingar → Payday → Tengja. Límdu inn Client ID og Client Secret.",
        "Í Launakeyrslum birtist „Senda í Payday“. Samþykktir tímar tímabilsins fara inn sem tímaskrá.",
        "Viltu frekar skrá? Launakeyrslur → Flytja út → Payday gefur Excel-skrá sem Payday les inn.",
      ],
    },
    dk: {
      sub: "dk Laun og dkPlus",
      d: "Tímarnir fara í launakeyrslu dk Laun með CSV-innlestri, skipt á launaliði og deildir. Veltan getur komið sjálfkrafa úr bókhaldinu í dkPlus.",
      out: ["CSV fyrir launakeyrslu dk Laun: kennitala, deild og tímar per launalið"],
      in: ["Daglega velta úr tekjureikningum bókhaldsins (dkPlus, valfrjálst)"],
      need: ["Númer launaliða í dk Laun (dagvinna, yfirvinna, hvert álag)", "Deildanúmer ef þú skiptir launum á deildir", "Aðgangslykil í dkPlus ef veltan á að koma sjálfkrafa"],
      steps: [
        "Í VAKTO: Stillingar → Tengingar → DK → Stilla. Settu inn númer launaliða og deilda úr dk Laun.",
        "Launakeyrslur → Flytja út → DK sækir CSV-skrá fyrir tímabilið.",
        "Í dk Laun: opnaðu launakeyrsluna og veldu „Lesa úr CSV-skrá inn í launakeyrslu“.",
        "Valfrjálst: límdu inn aðgangslykil úr dkPlus í sama glugga til að sækja veltuna daglega.",
      ],
    },
    businesscentral: {
      sub: "Microsoft Dynamics 365 og LS Central",
      d: "Veltan kemur daglega úr fjárhagnum og launakeyrslan er bókuð sem ein samantektarfærsla í færslubók, sem bókarinn bókar sjálfur.",
      out: ["Launabókun: laun, launatengd gjöld, staðgreiðsla, lífeyrissjóðir, stéttarfélög, tryggingagjald og orlofsskuld"],
      in: ["Daglega velta úr fjárhagnum"],
      need: ["Aðgang að Azure (Microsoft Entra ID) til að skrá forrit", "Heimildasett D365 READ (velta) eða D365 ACCOUNTANTS (velta og launabókun)"],
      steps: [
        "Í Azure: App registrations → New registration, nefndu það VAKTO. Afritaðu Application (client) ID og Directory (tenant) ID.",
        "API permissions → Dynamics 365 Business Central → API.ReadWrite.All → Grant admin consent. Búðu til client secret.",
        "Í Business Central: „Microsoft Entra Applications“ → New. Settu inn Client ID, State: Enabled og heimildasettið.",
        "Í VAKTO: Stillingar → Tengingar → Business Central → Tengja. Svo „Launabókun“ til að velja bókhaldslyklana.",
      ],
    },
    excel: {
      sub: "Útflutningur og innlestur",
      d: "Fyrir launakerfi sem eru ekki á listanum: launakeyrslan, tímaskrár og skýrslur fara út í Excel eða PDF, og velta kemur inn úr CSV-skrá.",
      out: ["Launakeyrsla og tímar í Excel", "Skýrslur í Excel og PDF"],
      in: ["Velta úr CSV-skrá (dagsetning og upphæð), t.d. saga úr kassakerfinu"],
      need: ["Ekkert. Innifalið í öllum leiðum með launum"],
      steps: [
        "Launakeyrslur → Flytja út → Excel.",
        "Velta: Stillingar → Tengingar → Annað kerfi? → Hlaða upp skrá.",
      ],
    },
    shopify: {
      sub: "Netverslun",
      d: "Velta úr pöntunum sótt sjálfkrafa á hverjum degi, svo laun % af veltu sé alltaf rétt. VAKTO les aðeins pantanir, aldrei kortaupplýsingar.",
      out: [],
      in: ["Daglega velta úr pöntunum (90 daga saga við fyrstu tengingu)"],
      need: ["Shopify-verslun og réttindi til að búa til app (read_orders)"],
      steps: [
        "Í Shopify: Settings → Apps and sales channels → Develop apps → Create an app. Nefndu það VAKTO.",
        "Configure Admin API scopes: hakaðu við read_orders og vistaðu. Smelltu á Install app.",
        "Í VAKTO: Stillingar → Tengingar → Shopify → Tengja. Límdu inn slóð verslunar og Admin API access token.",
      ],
    },
    woocommerce: {
      sub: "Netverslun á WordPress",
      d: "Velta úr pöntunum sótt daglega með lykli sem hefur aðeins lesaðgang.",
      out: [],
      in: ["Daglega velta úr pöntunum (90 daga saga við fyrstu tengingu)"],
      need: ["Stjórnandaaðgang að WordPress"],
      steps: [
        "Í WordPress: WooCommerce → Settings → Advanced → REST API → Add key.",
        "Nefndu lykilinn VAKTO, veldu Permissions: Read og smelltu á Generate API key.",
        "Í VAKTO: Stillingar → Tengingar → WooCommerce → Tengja. Límdu inn slóð, Consumer key og Consumer secret.",
      ],
    },
    inventra: {
      sub: "Framleiðsla og sala",
      d: "Systurkerfi VAKTO fyrir framleiðendur ferskvöru. Salan fer beint inn sem velta.",
      out: [],
      in: ["Velta úr INVENTRA"],
      need: ["INVENTRA-aðgang og lykil úr VAKTO"],
      steps: [
        "Í VAKTO: Stillingar → Tengingar → INVENTRA → Búa til lykil.",
        "Settu lykilinn inn í INVENTRA. Veltan kemur inn sjálfkrafa eftir það.",
      ],
    },
    api: {
      sub: "Opið API, Zapier og Make",
      d: "Ertu með kerfi sem er ekki á listanum? Sendu veltuna beint í VAKTO með lykli, úr eigin kóða eða gegnum Webhooks í Zapier eða Make.",
      out: [],
      in: ["Velta per dag og stað (POST /api/v1/revenue)"],
      need: ["API-lykil úr VAKTO (þú getur afturkallað hann hvenær sem er)"],
      steps: [
        "Í VAKTO: Stillingar → Tengingar → Búa til lykil.",
        "Sendu POST á /api/v1/revenue með Authorization: Bearer og { date, amount, location }.",
        "Í Zapier eða Make: notaðu „Webhooks“ með sömu slóð og lykli.",
      ],
    },
    esign: {
      sub: "Rafræn undirritun",
      d: "Ráðningarsamningar og starfslok undirrituð í símanum. Undirritun með kóða í tölvupósti er alltaf innifalin; fullgild undirritun með rafrænum skilríkjum fer í gegnum Taktikal.",
      out: ["Samningur til undirritunar"],
      in: ["Undirritað eintak, fingrafar skjals og undirritunarskrá"],
      need: ["Ekkert fyrir kóða í pósti", "Rafræn skilríki: íslensk rafræn skilríki hjá báðum aðilum"],
      steps: [
        "Í VAKTO: Stillingar → Reglur og laun → Undirritun samninga. Veldu kóða í tölvupósti eða rafræn skilríki (Taktikal).",
        "Sendu samninginn úr spjaldi starfsmannsins. Báðir undirrita og fá undirritað eintak í pósti.",
      ],
    },
    mcp: {
      sub: "Claude, ChatGPT og MCP",
      d: "Spurðu um vaktirnar, tímana og laun % í þínu eigin gervigreindarforriti. Aðeins lestur: forritin geta ekki breytt neinu og fá aldrei kennitölur, bankareikninga eða heimilisföng.",
      out: ["Vaktir, tímar, velta og laun % (aðeins lestur)"],
      in: [],
      need: ["Claude, ChatGPT eða annað forrit sem styður MCP-tengingar", "Eigandi fyrirtækisins kveikir á tengdum forritum"],
      steps: [
        "Í VAKTO: Stillingar → Tengingar → Tengd forrit → Leyfa gervigreindarforrit (eigandi).",
        "Afritaðu slóðina og bættu henni við sem tengingu (connector) í Claude eða ChatGPT.",
        "Skráðu þig inn með VAKTO og samþykktu aðganginn. Þú getur aftengt hvenær sem er.",
      ],
    },
    wallet: {
      sub: "Apple Wallet og Google Wallet",
      d: "Starfsmannaskírteinið með mynd, stöðu og QR-kóða í símanum. Kóðinn stimplar inn á spjaldtölvunni við innganginn.",
      out: ["Starfsmannaskírteini í Wallet"],
      in: [],
      need: ["iPhone eða Android-síma"],
      steps: ["Starfsmaðurinn opnar skírteinið í VAKTO-appinu og velur „Bæta í Wallet“."],
    },
    calendar: {
      sub: "Google, Apple og Outlook",
      d: "Vaktirnar birtast í dagatalinu í símanum og uppfærast sjálfar þegar planið breytist.",
      out: ["Vaktir starfsmanns sem dagatal (ICS)"],
      in: [],
      need: ["Dagatal sem getur gerst áskrifandi að slóð"],
      steps: ["Í VAKTO: Planið → Setja vaktir í dagatal → Afrita tengil.", "Í dagatalinu: bættu við dagatali „Frá vefslóð“ og límdu tengilinn."],
    },
  },
  plannedH: "Á leiðinni.", plannedP: "Þessar tengingar eru í vinnslu eða á listanum. Engin þeirra er tilbúin enn, og við merkjum þær ekki sem slíkar fyrr en þær virka.",
  planned: {
    uniconta: { sub: "Bókhald", d: "Velta og launabókun." },
    h3: { name: "H3 Laun", sub: "Laun", d: "Tímar beint í launakeyrslu." },
    m365: { name: "Microsoft 365 og Entra ID", sub: "Innskráning", d: "Innskráning með vinnuaðgangi og notendur úr Entra ID." },
    noona: { sub: "Kassakerfi og bókanir", d: "Velta úr kassanum og bókanir fyrir veltuspá." },
    dineout: { sub: "Kassakerfi og bókanir", d: "Velta og bókanir fyrir veltuspá vaktaplansins." },
    regla: { sub: "Bókhald", d: "Velta úr bókhaldinu." },
    fortnox: { sub: "Bókhald og laun", d: "Svíþjóð og Noregur." },
    nordic: { name: "Norræn launakerfi", sub: "Danmörk, Svíþjóð og Noregur", d: "Laun eftir norrænum kjarasamningum og tengingar við launakerfi þar. Við forgangsröðum eftir því hvað viðskiptavinir nota." },
  },
  askH: "Notarðu annað kerfi?", askP: "Segðu okkur hvaða kerfi það er. Það sem flestir biðja um fer fremst í röðina.", askBtn: "Senda okkur línu",
  endH: "Prófaðu VAKTO með þínum kerfum.", endP: "14 daga frí prufa, engin binding. Flestar tengingar taka innan við mínútu.", endBtn: "Prófa frítt", endPrice: "Sjá verð",
};

const en: TengText = {
  eyebrow: "Integrations",
  h1: ["Works with the systems", "you already use."],
  lede: "This is the list as it stands today: the systems VAKTO really connects to, what data moves between them and how to connect. Anything still in the works is marked as such.",
  regionNote: "Payroll in VAKTO follows Icelandic union agreements today, and the payroll integrations below are Icelandic systems. Payroll for Denmark, Sweden and Norway is on the way.",
  jump: "See all integrations",
  edgeEyebrow: "More than an export", edgeH: ["Most scheduling tools export hours.", "VAKTO calculates the pay."],
  edgeP: "A link to your payroll system is good, but it's only the last step. VAKTO handles everything before it, so what lands in payroll is already right.",
  edge: [
    ["Pay by union agreement", "Day rate, overtime, premiums, holiday pay and bonuses calculated from clock-ins, by each employee's agreement."],
    ["Payslips", "Staff see their payslip and estimated pay in the app, itemised."],
    ["Employment contracts", "The contract is filled in from the employee's details and signed electronically on the phone."],
    ["Chat and news feed", "Channels per department and location, plus news for the whole team, in the same app as the shifts."],
    ["VAKTO AI", "Builds the schedule, answers with your numbers and always asks before it changes anything."],
  ],
  live: "Live", soon: "Coming soon",
  outL: "From VAKTO", inL: "Into VAKTO", needL: "You need", stepsL: "How to connect",
  cats: {
    pay: { h: "Payroll and accounting", p: "VAKTO calculates the pay. Your payroll system still handles tax, filings and payments." },
    rev: { h: "Revenue", p: "Labor as a share of revenue needs revenue figures. They come in automatically from your POS, online store or accounts." },
    docs: { h: "Contracts and signing", p: "Employment contracts and offboarding signed electronically, no paper." },
    ai: { h: "AI and developers", p: "Connect your own tools, with keys you control." },
    staff: { h: "For your staff", p: "Shifts and the ID card where your staff already are: on their phone." },
  },
  items: {
    payday: {
      sub: "Payroll and accounting (Iceland)",
      d: "Approved hours go straight into a Payday pay run as a timesheet, with one click. VAKTO Verk also creates invoices in Payday.",
      out: ["Hours per employee: day rate, overtime and premiums by percentage", "Invoices for jobs (VAKTO Verk)"],
      in: [],
      need: ["A Payday account with API access (Client ID and Client Secret)", "Pay items in Payday named as in VAKTO (Dagvinna, Yfirvinna, Álag 33% …)"],
      steps: [
        "In Payday: Settings → Company → API. Create an application and name it VAKTO.",
        "In VAKTO: Settings → Integrations → Payday → Connect. Paste the Client ID and Client Secret.",
        "Payroll now shows “Send to Payday”. The period's approved hours go in as a timesheet.",
        "Prefer a file? Payroll → Export → Payday gives an Excel file Payday can import.",
      ],
    },
    dk: {
      sub: "dk Laun and dkPlus (Iceland)",
      d: "Hours go into a dk Laun pay run by CSV import, split by pay item and department. Revenue can come in automatically from your books in dkPlus.",
      out: ["CSV for a dk Laun pay run: ID number, department and hours per pay item"],
      in: ["Daily revenue from the income accounts in your books (dkPlus, optional)"],
      need: ["Pay item numbers in dk Laun (day rate, overtime, each premium)", "Department numbers if you split pay by department", "A dkPlus access token if revenue should come in automatically"],
      steps: [
        "In VAKTO: Settings → Integrations → DK → Set up. Enter the pay item and department numbers from dk Laun.",
        "Payroll → Export → DK downloads a CSV file for the period.",
        "In dk Laun: open the pay run and choose “Read from CSV file into pay run”.",
        "Optional: paste a dkPlus access token in the same window to fetch revenue daily.",
      ],
    },
    businesscentral: {
      sub: "Microsoft Dynamics 365 and LS Central",
      d: "Revenue comes in daily from the general ledger, and each pay run is posted as one summary entry to a journal, which your bookkeeper posts.",
      out: ["Payroll posting: wages, payroll taxes, withholding tax, pension funds, union fees, social security tax and holiday pay liability"],
      in: ["Daily revenue from the general ledger"],
      need: ["Access to Azure (Microsoft Entra ID) to register an app", "Permission set D365 READ (revenue) or D365 ACCOUNTANTS (revenue and payroll posting)"],
      steps: [
        "In Azure: App registrations → New registration, name it VAKTO. Copy the Application (client) ID and Directory (tenant) ID.",
        "API permissions → Dynamics 365 Business Central → API.ReadWrite.All → Grant admin consent. Create a client secret.",
        "In Business Central: “Microsoft Entra Applications” → New. Enter the Client ID, State: Enabled and the permission set.",
        "In VAKTO: Settings → Integrations → Business Central → Connect. Then “Payroll posting” to choose the accounts.",
      ],
    },
    excel: {
      sub: "Export and import",
      d: "For payroll systems not on the list: the pay run, timesheets and reports export to Excel or PDF, and revenue comes in from a CSV file.",
      out: ["Pay run and hours in Excel", "Reports in Excel and PDF"],
      in: ["Revenue from a CSV file (date and amount), e.g. history from your POS"],
      need: ["Nothing. Included in every plan with payroll"],
      steps: [
        "Payroll → Export → Excel.",
        "Revenue: Settings → Integrations → Another system? → Upload a file.",
      ],
    },
    shopify: {
      sub: "Online store",
      d: "Revenue from orders is fetched automatically every day, so labor % of revenue is always right. VAKTO only reads orders, never card details.",
      out: [],
      in: ["Daily revenue from orders (90 days of history on first connect)"],
      need: ["A Shopify store and permission to create an app (read_orders)"],
      steps: [
        "In Shopify: Settings → Apps and sales channels → Develop apps → Create an app. Name it VAKTO.",
        "Configure Admin API scopes: tick read_orders and save. Click Install app.",
        "In VAKTO: Settings → Integrations → Shopify → Connect. Paste the store address and the Admin API access token.",
      ],
    },
    woocommerce: {
      sub: "WordPress online store",
      d: "Revenue from orders fetched daily, with a key that only has read access.",
      out: [],
      in: ["Daily revenue from orders (90 days of history on first connect)"],
      need: ["Admin access to WordPress"],
      steps: [
        "In WordPress: WooCommerce → Settings → Advanced → REST API → Add key.",
        "Name the key VAKTO, choose Permissions: Read and click Generate API key.",
        "In VAKTO: Settings → Integrations → WooCommerce → Connect. Paste the URL, Consumer key and Consumer secret.",
      ],
    },
    inventra: {
      sub: "Production and sales",
      d: "VAKTO's sister system for fresh-food producers. Sales come straight in as revenue.",
      out: [],
      in: ["Revenue from INVENTRA"],
      need: ["An INVENTRA account and a key from VAKTO"],
      steps: [
        "In VAKTO: Settings → Integrations → INVENTRA → Create key.",
        "Add the key in INVENTRA. Revenue comes in automatically from then on.",
      ],
    },
    api: {
      sub: "Open API, Zapier and Make",
      d: "Using a system that isn't listed? Send revenue straight to VAKTO with a key, from your own code or through Webhooks in Zapier or Make.",
      out: [],
      in: ["Revenue per day and location (POST /api/v1/revenue)"],
      need: ["An API key from VAKTO (revoke it any time)"],
      steps: [
        "In VAKTO: Settings → Integrations → Create key.",
        "POST to /api/v1/revenue with Authorization: Bearer and { date, amount, location }.",
        "In Zapier or Make: use “Webhooks” with the same URL and key.",
      ],
    },
    esign: {
      sub: "Electronic signing",
      d: "Employment contracts and offboarding signed on the phone. Signing with an emailed code is always included; qualified signing with Icelandic electronic ID goes through Taktikal.",
      out: ["Contract for signing"],
      in: ["Signed copy, document fingerprint and signing log"],
      need: ["Nothing for the emailed code", "Electronic ID: Icelandic electronic ID for both parties"],
      steps: [
        "In VAKTO: Settings → Rules and pay → Contract signing. Choose emailed code or electronic ID (Taktikal).",
        "Send the contract from the employee's profile. Both sign and get the signed copy by email.",
      ],
    },
    mcp: {
      sub: "Claude, ChatGPT and MCP",
      d: "Ask about shifts, hours and labor % in your own AI app. Read-only: the apps can't change anything and never get ID numbers, bank accounts or addresses.",
      out: ["Shifts, hours, revenue and labor % (read-only)"],
      in: [],
      need: ["Claude, ChatGPT or another app that supports MCP connectors", "The company owner turns on connected apps"],
      steps: [
        "In VAKTO: Settings → Integrations → Connected apps → Allow AI apps (owner).",
        "Copy the URL and add it as a connector in Claude or ChatGPT.",
        "Sign in with VAKTO and approve access. Disconnect any time.",
      ],
    },
    wallet: {
      sub: "Apple Wallet and Google Wallet",
      d: "The employee ID card with photo, role and QR code on the phone. The code clocks in on the tablet by the entrance.",
      out: ["Employee ID card in Wallet"],
      in: [],
      need: ["An iPhone or Android phone"],
      steps: ["The employee opens the ID card in the VAKTO app and taps “Add to Wallet”."],
    },
    calendar: {
      sub: "Google, Apple and Outlook",
      d: "Shifts show up in the phone's calendar and update themselves when the schedule changes.",
      out: ["The employee's shifts as a calendar feed (ICS)"],
      in: [],
      need: ["A calendar that can subscribe to a URL"],
      steps: ["In VAKTO: Schedule → Add shifts to calendar → Copy link.", "In your calendar: add a calendar “From URL” and paste the link."],
    },
  },
  plannedH: "Coming soon.", plannedP: "These integrations are in progress or on our list. None of them is ready yet, and we won't mark them as live until they work.",
  planned: {
    uniconta: { sub: "Accounting", d: "Revenue and payroll posting." },
    h3: { name: "H3 Laun", sub: "Payroll (Iceland)", d: "Hours straight into a pay run." },
    m365: { name: "Microsoft 365 and Entra ID", sub: "Sign-in", d: "Sign in with your work account and users from Entra ID." },
    noona: { sub: "POS and bookings", d: "POS revenue and bookings for the forecast." },
    dineout: { sub: "POS and bookings", d: "Revenue and bookings for the schedule forecast." },
    regla: { sub: "Accounting (Iceland)", d: "Revenue from your books." },
    fortnox: { sub: "Accounting and payroll", d: "Sweden and Norway." },
    nordic: { name: "Nordic payroll", sub: "Denmark, Sweden and Norway", d: "Pay by Nordic collective agreements and links to payroll systems there. We prioritise by what customers use." },
  },
  askH: "Using another system?", askP: "Tell us which one. What most people ask for goes to the front of the queue.", askBtn: "Drop us a line",
  endH: "Try VAKTO with your systems.", endP: "14-day free trial, no commitment. Most connections take under a minute.", endBtn: "Try free", endPrice: "See pricing",
};

export const TENG_TEXT: Record<SiteLang, TengText> = { is, en, da: da.integrations, sv: sv.integrations, nb: nb.integrations };
