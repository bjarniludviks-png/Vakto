// Texti markaðssíðu VAKTO Verk (/verktakar). IS og EN hér; danska, sænska og norska í text/{da,sv,nb}.ts.
// Aðeins það sem er til í dag er kynnt sem tilbúið. Það sem á aðeins við á Íslandi (35 % endurgreiðsla vsk.,
// reikningar í Payday) er merkt þannig á öðrum málum.
import type { SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";

export type VerkText = {
  eyebrow: string; h1: [string, string, string]; lede: string; cta: string;
  /** „2.990 kr. á mánuði · engin binding“ — m = upphæð á máli síðunnar. */
  priceNote: (m: string) => string;
  phone: { top: string; live: string; job: string; geo: string; stop: string; month: string; monthV: string; open: string; jobs: [string, string][] };
  float1: [string, string]; float2: string;
  painQ: [string, string]; painP: string;
  stepsEyebrow: string; stepsH: [string, string]; steps: [string, string][];
  apprEyebrow: string; apprH: [string, string]; apprLede: string; apprTicks: string[];
  doc: { from: string; company: string; status: string; title: string; period: string; k: [string, string][]; rows: [string, string][]; total: [string, string]; refund: [string, string]; approve: string; fix: string };
  featEyebrow: string; featH: [string, string];
  /** Sama röð og táknin í verktakar-client.tsx (10 atriði). tag = stutt merki, t.d. „Aðeins á Íslandi“. */
  features: { t: string; p: string; tag?: string }[];
  priceEyebrow: string; planName: string; perMonth: string;
  inc: (extra: string) => string; ticks: (ai: number) => string[];
  fine: string; fineLink: string;
  faqH: string; faq: [string, string][];
  finalH: [string, string]; finalCta: string;
};

const is: VerkText = {
  eyebrow: "VAKTO Verk · vakt og verk",
  h1: ["Verkið, tíminn", "og samþykktin.", "Í einu appi."],
  lede: "Byrjaðu tímatöku á verkstaðnum, taktu myndir og skráðu efni. Viðskiptavinurinn samþykkir verkskýrsluna með einum smelli, og deilur um tímana heyra sögunni til.",
  cta: "Prófa frítt í 14 daga",
  priceNote: (m) => `${m}. á mánuði · engin binding`,
  phone: { top: "Verk", live: "Tímataka í gangi", job: "Baðherbergi · Laugavegi 5", geo: "Staðfest á verkstað", stop: "Stöðva", month: "Í mánuðinum", monthV: "86,5 klst.", open: "Opin verk", jobs: [["Eldhús, Kópavogi", "Anna Jónsdóttir · 12,0 klst."], ["Raflagnir, Grafarholti", "Byggás ehf. · 31,5 klst."]] },
  float1: ["Samþykkt", "Anna Jónsdóttir · í dag 16:42"], float2: "3 myndir í skýrslu",
  painQ: ["„Ég vann miklu meira en þetta.“", "„Ég borga ekki fyrir tíma sem ég sá ekki.“"],
  painP: "Flestir verktakar þekkja samtalið. Tímarnir eru í kollinum, kvittanirnar í hanskahólfinu og myndirnar týndar í símanum. VAKTO Verk safnar þessu saman á meðan þú vinnur, og viðskiptavinurinn sér allt áður en reikningurinn fer út.",
  stepsEyebrow: "Svona virkar þetta", stepsH: ["Þrjú skref.", "Engin pappírsvinna."],
  steps: [
    ["Byrjaðu á staðnum", "Opnaðu verkið og ýttu á Byrja. Síminn skráir tímann og staðfestir staðsetninguna."],
    ["Skráðu á meðan þú vinnur", "Myndir, efni, útlagður kostnaður og akstur fara beint á verkið, á nokkrum sekúndum."],
    ["Sendu til samþykktar", "Veldu tímabil og sendu hlekk. Viðskiptavinurinn samþykkir og þú veist að reikningurinn verður greiddur."],
  ],
  apprEyebrow: "Það sem viðskiptavinurinn sér", apprH: ["Gegnsæi sem", "byggir traust."],
  apprLede: "Engin innskráning, ekkert app. Viðskiptavinurinn opnar hlekkinn, sér hverja tímaskráningu með staðfestingu á verkstað, myndirnar, efnið og upphæðirnar — og samþykkir. Þú sérð samþykktina í VAKTO um leið.",
  apprTicks: ["Tímar með staðfestingu á verkstað", "Vinna, efni og vsk. sundurliðað", "Endurgreiðsla vsk. af vinnu reiknuð fyrir húseigandann", "Nafn og tími samþykktar skráð"],
  doc: {
    from: "Verkskýrsla frá", company: "Jón Rafvirki ehf.", status: "Bíður samþykktar", title: "Baðherbergi, Laugavegi 5", period: "1.–31. október",
    k: [["24,5 klst.", "Vinna"], ["38 km", "Akstur"], ["402.169 kr.", "Samtals m. vsk."]],
    rows: [["Vinna (24,5 klst. × 9.500 kr.)", "232.750 kr."], ["Efni", "91.580 kr."], ["Virðisaukaskattur 24 %", "77.839 kr."]],
    total: ["Samtals", "402.169 kr."], refund: ["Endurgreiðsla vsk. af vinnu á íbúðarhúsnæði: um", "19.551 kr."],
    approve: "Samþykkja", fix: "Biðja um lagfæringu",
  },
  featEyebrow: "Allt sem verktaki þarf", featH: ["Hannað fyrir vinnuna", "á vettvangi."],
  features: [
    { t: "Tímataka á verkstað", p: "Ýttu á Byrja þegar þú mætir. Síminn staðfestir að þú sért á staðnum og viðskiptavinurinn sér það í skýrslunni." },
    { t: "Myndir og athugasemdir", p: "Taktu mynd fyrir og eftir. Myndirnar fylgja verkskýrslunni sjálfkrafa, engin leit í myndasafninu." },
    { t: "Samþykkt með einum smelli", p: "Viðskiptavinurinn fær hlekk, sér tíma, efni, myndir og upphæðir og samþykkir. Nafn og tími eru skráð." },
    { t: "Efni, útlagt og akstur", p: "Skráðu efni og útlagðan kostnað á verkið og kílómetra við hverja tímatöku. Allt tekið saman fyrir þig." },
    { t: "35 % endurgreiðslan reiknuð", p: "Vinna og efni eru aðskilin í skýrslunni og húseigandinn sér hvað hann fær endurgreitt af vsk. af vinnu." },
    { t: "Viðskiptavinir á einum stað", p: "Hver viðskiptavinur með sín verk, tilboð, tíma, rukkað og ógreitt, og minnispunkta. Þú sérð strax hvað á eftir að rukka." },
    { t: "Teymi þegar þú stækkar", p: "Bættu við starfsmanni eða undirverktaka. Hver skráir sína tíma, þú sérð allt og sendir eina skýrslu." },
    { t: "Tilboð og verksamningar", p: "Sendu tilboð sem viðskiptavinurinn samþykkir sem verksamning með nafni sínu. Samþykkt tilboð verður sjálfkrafa að verki." },
    { t: "Reikningar í Payday", p: "Einn smellur: reikningur fyrir verkið verður til í Payday hjá þér, með vinnu og efni sundurliðað, og fer til viðskiptavinarins." },
    { t: "VAKTO AI fyrir verkin", p: "Lýstu verkinu og AI skrifar drög að tilboði. Spurðu „hvað vann ég mikið fyrir Jón í október?“ eða „hvað á ég eftir að rukka?“." },
  ],
  priceEyebrow: "Verð", planName: "Verktaki", perMonth: "kr. á mánuði án vsk.",
  inc: (x) => `Einn notandi innifalinn. Hver viðbótarnotandi ${x}.`,
  ticks: (ai) => ["Ótakmörkuð verk og viðskiptavinir", "Tímataka með staðfestingu á verkstað", "Myndir, efni, útlagt og akstur", "Verkskýrslur og samþykkt viðskiptavinar", "App fyrir iPhone og Android, og vefur", "Tilboð, viðskiptavinayfirlit og reikningar í Payday", `VAKTO AI, ${ai} spurningar á mánuði`],
  fine: "Engin binding. Rekur þú fyrirtæki með vaktavinnu?", fineLink: "Sjá leiðir fyrir fyrirtæki",
  faqH: "Spurt og svarað",
  faq: [
    ["Fyrir hverja er VAKTO Verk?", "Iðnaðarmenn, verktaka og einyrkja sem vinna á tímagjaldi eða í verkum: rafvirkja, smiði, pípara, málara, garðyrkju, þrif, tölvu- og ráðgjafarvinnu. Allt frá einum manni upp í lítið teymi."],
    ["Þarf viðskiptavinurinn að stofna aðgang?", "Nei. Hann fær hlekk í tölvupósti eða skilaboðum, opnar skýrsluna í símanum og samþykkir eða biður um lagfæringu."],
    ["Er staðsetningin alltaf rakin?", "Nei. Staðsetningin er aðeins lesin þegar þú byrjar og stöðvar tímatöku, til að staðfesta að þú hafir verið á verkstaðnum. Engin stöðug rakning."],
    ["Get ég notað þetta í tölvunni líka?", "Já. Allt sem er í appinu er líka á vakto.is: verk, tímar, efni, myndir og skýrslur."],
    ["Hvað ef ég er ekki með vsk-númer?", "Skýrslan reiknar vsk. sjálfgefið. Stillingar fyrir þá sem eru undir veltumörkum eru á leiðinni. Hafðu samband og við hjálpum þér."],
    ["Virkar þetta með Payday?", "Já. Tengdu Payday í Stillingum og búðu til reikning fyrir verk með einum smelli. Reikningurinn verður til í Payday hjá þér og fer í tölvupósti til viðskiptavinarins."],
    ["Er binding?", "Nei. 14 daga frí prufa og svo mánaðarleg áskrift sem þú getur sagt upp hvenær sem er."],
  ],
  finalH: ["Minni pappírsvinna.", "Fleiri samþykktir reikningar."], finalCta: "Byrja frítt",
};

const en: VerkText = {
  eyebrow: "VAKTO Verk · shifts and jobs",
  h1: ["The job, the hours", "and the sign-off.", "In one app."],
  lede: "Start the timer on site, take photos and log materials. Your customer approves the job report with one tap, and arguments about hours are a thing of the past.",
  cta: "Try free for 14 days",
  priceNote: (m) => `${m} a month · no commitment`,
  phone: { top: "Jobs", live: "Timer running", job: "Bathroom · Laugavegur 5", geo: "Verified on site", stop: "Stop", month: "This month", monthV: "86.5 h", open: "Open jobs", jobs: [["Kitchen, Kópavogur", "Anna Jónsdóttir · 12.0 h"], ["Wiring, Grafarholt", "Byggás ehf. · 31.5 h"]] },
  float1: ["Approved", "Anna Jónsdóttir · today 16:42"], float2: "3 photos in the report",
  painQ: ["“I worked a lot more than that.”", "“I'm not paying for hours I didn't see.”"],
  painP: "Most contractors know that conversation. The hours are in your head, the receipts in the glovebox and the photos lost on your phone. VAKTO Verk pulls it together while you work, and the customer sees everything before the invoice goes out.",
  stepsEyebrow: "How it works", stepsH: ["Three steps.", "No paperwork."],
  steps: [
    ["Start on site", "Open the job and tap Start. Your phone logs the time and confirms the location."],
    ["Log as you work", "Photos, materials, expenses and mileage go straight onto the job, in seconds."],
    ["Send for approval", "Pick a period and send a link. The customer approves, and you know the invoice will be paid."],
  ],
  apprEyebrow: "What your customer sees", apprH: ["Transparency that", "builds trust."],
  apprLede: "No login, no app. The customer opens the link, sees every time entry with on-site verification, the photos, materials and amounts — and approves. You see the approval in VAKTO straight away.",
  apprTicks: ["Hours with on-site verification", "Labour, materials and VAT itemised", "Icelandic VAT refund on labour calculated for the homeowner", "Name and time of approval recorded"],
  doc: {
    from: "Job report from", company: "Jón Rafvirki ehf.", status: "Awaiting approval", title: "Bathroom, Laugavegur 5", period: "1–31 October",
    k: [["24.5 h", "Labour"], ["38 km", "Mileage"], ["ISK 402,169", "Total incl. VAT"]],
    rows: [["Labour (24.5 h × ISK 9,500)", "ISK 232,750"], ["Materials", "ISK 91,580"], ["VAT 24%", "ISK 77,839"]],
    total: ["Total", "ISK 402,169"], refund: ["VAT refund on labour for residential property: about", "ISK 19,551"],
    approve: "Approve", fix: "Ask for a change",
  },
  featEyebrow: "Everything a contractor needs", featH: ["Built for work", "in the field."],
  features: [
    { t: "Time tracking on site", p: "Tap Start when you arrive. Your phone confirms you're on site, and the customer sees it in the report." },
    { t: "Photos and notes", p: "Take a before and after photo. The photos go into the job report automatically, no digging through your camera roll." },
    { t: "One-tap approval", p: "The customer gets a link, sees hours, materials, photos and amounts, and approves. Name and time are recorded." },
    { t: "Materials, expenses and mileage", p: "Log materials and expenses on the job and kilometres with each time entry. All added up for you." },
    { t: "35% VAT refund calculated", p: "Labour and materials are split in the report, so the homeowner sees how much VAT on labour they get back.", tag: "Iceland only" },
    { t: "Customers in one place", p: "Each customer with their jobs, quotes, hours, billed and unpaid, and notes. You see at once what's left to bill." },
    { t: "A team when you grow", p: "Add an employee or a subcontractor. Everyone logs their own hours, you see it all and send one report." },
    { t: "Quotes and job contracts", p: "Send a quote the customer accepts as a contract with their name. An accepted quote becomes a job automatically." },
    { t: "Invoices in Payday", p: "One tap: an invoice for the job is created in your Payday account, labour and materials itemised, and sent to the customer.", tag: "Iceland only" },
    { t: "VAKTO AI for your jobs", p: "Describe the job and the AI drafts a quote. Ask “how much did I work for Jón in October?” or “what's left to bill?”." },
  ],
  priceEyebrow: "Pricing", planName: "Verktaki", perMonth: "a month excl. VAT",
  inc: (x) => `One user included. Each extra user ${x}.`,
  ticks: (ai) => ["Unlimited jobs and customers", "Time tracking with on-site verification", "Photos, materials, expenses and mileage", "Job reports and customer approval", "App for iPhone and Android, plus the web", "Quotes, customer overview and Payday invoices (Iceland)", `VAKTO AI, ${ai} questions a month`],
  fine: "No commitment. Running a business with shift work?", fineLink: "See plans for companies",
  faqH: "Questions and answers",
  faq: [
    ["Who is VAKTO Verk for?", "Tradespeople, contractors and sole traders who bill by the hour or by the job: electricians, carpenters, plumbers, painters, gardeners, cleaners, IT and consulting. From one person to a small team."],
    ["Does the customer need an account?", "No. They get a link by email or message, open the report on their phone and approve or ask for a change."],
    ["Is my location always tracked?", "No. Location is only read when you start and stop the timer, to confirm you were on site. No continuous tracking."],
    ["Can I use it on my computer too?", "Yes. Everything in the app is also on vakto.is: jobs, hours, materials, photos and reports."],
    ["What if I'm not VAT registered?", "The report calculates VAT by default. Settings for those under the VAT threshold are on the way. Get in touch and we'll help."],
    ["Does it work with Payday?", "Yes, in Iceland. Connect Payday in Settings and create an invoice for a job with one tap. The invoice is created in your Payday account and emailed to the customer."],
    ["Is there a commitment?", "No. A 14-day free trial, then a monthly subscription you can cancel any time."],
  ],
  finalH: ["Less paperwork.", "More approved invoices."], finalCta: "Start free",
};

export const VERK_TEXT: Record<SiteLang, VerkText> = { is, en, da: da.contractors, sv: sv.contractors, nb: nb.contractors };
