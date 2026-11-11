// Dansk tekst til den åbne hjemmeside (/da). Ærlig om, hvad der virker i dag: lønberegning følger islandske
// overenskomster, Payday og DK er islandske systemer, og priser er i ISK. Dansk løn er på vej.
import type { HomeText } from "../home-text";
import type { PricingText } from "../pricing-text";
import type { AboutText } from "../about-client";
import type { VerkText } from "../verk-text";
import type { TengText } from "../teng-text";
import type { NavText } from "../site-nav";
import type { FootText } from "../ah-footer";
import type { ConsentText } from "../analytics";
import type { MetaText } from "../site-meta";
import { fmtMoney } from "../i18n";
import { AI_PACK, getPlan } from "@/lib/plans";

const m = (n: number) => fmtMoney("da", n);

export const home: HomeText = {
  skip: "Gå til indhold",
  h1a: "Vagterne, lønnen og overblikket.", h1b: "Samlet ét sted.",
  lede: "Vagtplan, stempelur, lønkørsel og ansættelseskontrakter. Og lønudgiften som andel af omsætningen, i realtid.",
  try: "Prøv gratis", see: "Se systemet",
  demo: "Prøv demoen", demoBusy: "Åbner demo…", demoErr: "Demoen er ikke tilgængelig lige nu — prøv igen senere.",
  heroAlt: "VAKTOs dashboard: løn som andel af omsætningen, arbejdede timer og afvigelser",
  videoAlt: "Video: VAKTO i brug. Dashboard, en vagt der trækkes mellem medarbejdere i vagtplanen, tidsregistrering og lønkørsel.",
  cap1b: "Løn i % af omsætningen.", cap1: " Ét tal, der fortæller, om vagten kan betale sig.",
  cap2b: "Grøn, gul eller rød.", cap2: " Beregnet ud fra stemplingerne løbende, ikke ved månedens udgang.",
  featH: "Alt, hvad vagten har brug for.",
  dragAlt: "Ugens vagtplan: en vagt trækkes fra én medarbejder til en anden",
  t1h: "En vagtplan på et kvarter.", t1p: "Træk vagter rundt, kopier sidste uge, eller bed AI om en plan, der passer til omsætningsprognosen. Lønudgiften regnes ud undervejs.",
  t2h: "Stempl ind på telefonen.", t2p: "Eller på en tablet ved indgangen. Med bekræftet placering, hvis du vil.", t2alt: "VAKTO-appen: på vagt siden 05:38, stempl ud",
  t3h: "Afvigelser i kroner og øre.", t3p: "Hvem kom for sent, hvem gik tidligt, og hvad det kostede.", t3alt: "Tidsregistrering med afvigelser",
  t4h: "Løn efter overenskomst.", t4p: "Tillæg, overarbejde og ekstra betaling beregnes efter islandske overenskomster og sendes direkte til Payday eller DK (Island). Danske overenskomster er på vej.", t4alt: "Månedens lønkørsel",
  t5h: "En tablet ved indgangen.", t5p: "Medarbejderne trykker på deres navn og taster deres egen kode, eller scanner ID-kortet fra telefonen. Alle kan se, hvem der er på vagt, og stemplingen går direkte i tidsregistreringen.", t5alt: "Stempeluret på en tablet: alle medarbejdere og hvem der er på vagt",
  t6h: "Chat til hele holdet.", t6p: "Kanaler pr. afdeling og sted. Ingen Messenger-gruppe med tidligere ansatte.", t6alt: "Chatkanaler i VAKTO-appen",
  darkH: "Smuk i dagslys. Også på nattevagten.", darkP: "VAKTO følger enhedens indstilling. Træk for at sammenligne.",
  cmpAria: "Sammenlign lyst og mørkt tema", cmpLight: "Vagtplan i lyst tema", cmpDark: "Vagtplan i mørkt tema",
  appAlt: "Appen i mørkt tema: på vagt", appH: "Medarbejderne får appen.",
  storePlay: "Hent den på Google Play", storeApple: "Hent i App Store", storeSoon: "",
  appP: "Deres vagter, stempling, forventet løn, feriesaldo, fri og vagtbytte. Plus chat og nyhedsfeed til hele holdet.",
  appTicks: ["iPhone og Android", "Islandsk, engelsk, polsk og vietnamesisk", "Besked, når planen ændres"],
  feedAlt: "Nyhedsfeed i appen",
  showH: "Lær VAKTO at kende.", showRole: "diasshow", slideRole: "dias", of: "af", slideN: "Dias", pause: "Sæt på pause", play: "Afspil",
  slides: [
    { t: "Rapporter, der betyder noget.", d: "Løn i % af omsætningen pr. måned, udgift pr. afdeling, overarbejde, sygdom og fremmøde. Hent som Excel eller PDF, eller bed VAKTO AI om rapporten.", alt: "Indsigt i VAKTO: løn på 31,1 % af omsætningen i oktober, omsætning 19,3 mio. ISK og lønudgift 6,0 mio. ISK" },
    { t: "Vagterne i lommen.", d: "Medarbejderne ser deres plan, søger ledige vagter og tilbyder vagter til bytte. Chatten er samme sted.", alt: "Ugens vagter i appen", alt2: "Chatkanaler i appen" },
    { t: "Et nyhedsfeed til arbejdspladsen.", d: "Nyt menukort, ændrede åbningstider, et billede fra køkkenet. Fastgør det vigtige øverst, så det ikke forsvinder.", alt: "Nyhedsfeedet i appen" },
    { t: "En lønseddel, der holder.", d: "Grundløn, tillæg og overarbejde specificeret. Også når måneden gav nul timer, og medarbejderen har brug for dokumentation.", alt: "Lønseddel fra VAKTO" },
  ],
  hey: {
    eyebrow: "VAKTO AI", h: "Hej VAKTO, …", lede: "Sig, hvad der skal gøres, som du ville sige det til en vagtleder. VAKTO AI læser dine data, svarer med dine tal og forbereder ændringen.",
    pre: "Hej VAKTO,",
    groups: [
      { h: "Vagtplan", items: [
        { q: "lav næste uges vagtplan for køkkenet. Alle får mindst to fridage, og der er altid tre på vagt.", a: "Sætter køkkenets uge op: tre på vagt hver dag, og alle har mindst to fridage. Andre afdelinger forbliver uændrede." },
        { q: "opret ledige vagter hver dag i næste uge fra 17 til 23.", a: "Opretter syv ledige vagter. Medarbejderne får besked og søger i appen." },
        { q: "godkend Annas ønske om fri.", a: "Finder anmodningen, viser dagene og godkender den. Anna får besked." },
      ] },
      { h: "Medarbejdere", items: [
        { q: "hvem er ikke mødt i dag?", a: "Viser, hvem på dagens plan der ikke har stemplet ind, og hvor forsinkede de er." },
        { q: "Jón glemte at stemple ud. Sæt hans udstempling til kl. 23.00.", a: "Sætter Jóns udstempling til kl. 23.00, og tidsregistreringen er rettet." },
        { q: "send ansættelseskontrakten til Pétur Karlsson igen.", a: "Sender underskriftsanmodningen til Péturs e-mail igen." },
      ] },
      { h: "Tal", items: [
        { q: "hvorfor var lønprocenten højere i september end i august?", a: "Sammenligner månederne: omsætning, timer, overarbejde og tillæg, og nævner de vigtigste årsager." },
        { q: "hvem havde mest overarbejde i denne måned?", a: "Rangerer medarbejderne efter overarbejdstimer og hvad de kostede." },
        { q: "giv mig besked, hvis nogen kommer over 180 timer i denne måned.", a: "Opretter en overvågning: du får en mail ved 90 % og igen, hvis nogen går over, også ud fra planen." },
        { q: "send mig en overarbejdsrapport hver mandag.", a: "Sidste uges rapport lander i din indbakke kl. 8 om mandagen, med en Excel-fil." },
      ] },
    ],
    confirmB: "Intet ændres uden dig.", confirm: " VAKTO AI spørger altid, før den ændrer noget. Du ser forslaget og trykker på Bekræft.",
    who: "Til ejere og vagtledere. Fra 25 spørgsmål om måneden, afhængigt af abonnement.",
    videoAlt: "Video: VAKTO AI laver en vagtplan for køkkenet, og lederen bekræfter forslaget.",
    shotAlt: "Forslag fra VAKTO AI: Moon flyttes til lørdagens aftenvagt, lønudgiften uændret på 27,4 %",
  },
  visit: {
    h: "Få en online demo.", p: "Vi viser dig VAKTO på et videomøde og svarer på dine spørgsmål. Gratis og helt uforpligtende.",
    name: "Navn", company: "Virksomhed", contact: "Telefon eller e-mail", message: "Besked (valgfri)", messagePh: "F.eks. hvornår det passer, antal medarbejdere eller steder",
    send: "Book en demo", sending: "Sender…", okH: "Tak, vi har modtaget din anmodning.", ok: "Vi kontakter dig snart for at finde et tidspunkt.",
    err: "Kunne ikke sende — skriv til hallo@vakto.is.", bot: "Et øjeblik, bot-beskyttelsen indlæses.",
  },
  conH: "En kontrakt på et minut, underskrevet på det næste.",
  conP: "VAKTO udfylder ansættelseskontrakten ud fra medarbejderens oplysninger, efter den islandske arbejdsdirektorats skabelon. Begge parter skriver under på telefonen og får en underskrevet kopi på mail. Danske skabeloner er på vej.",
  conTicks: ["Følger den islandske standardkontrakt, på islandsk og engelsk", "Underskrift med kode på mail, eller med islandsk elektronisk ID", "Dokumentets fingeraftryk og underskriftslog følger med", "Lønsedler og timesedler i samme stil"],
  conAlt: "Første side af en ansættelseskontrakt: Kaffi Krónan ansætter Ha Vu", stamp: "Underskrevet elektronisk",
  passLbl: "MEDARBEJDER", passRole: "STILLING", passRoleV: "Tjener", passKt: "ID-NUMMER", passNo: "NR.", passFoot: "VAKTO-4132-KK · scan ved stempeluret",
  walH: "Medarbejderkortet bor på telefonen.",
  walDone: "Færdig",
  walP: "I Apple og Google Wallet, med billede, stilling og QR-kode. Koden stempler ind på tabletten ved indgangen, uden PIN-kode.",
  sisH: "Fra samme værksted.", sisP: "BGL Ventures, virksomheden bag VAKTO, laver også INVENTRA: et driftssystem med AI, der mindsker madspild hos producenter af friske fødevarer.", sisGo: "inventra.is",
  priceH: "Vagtplanen er gratis.", amt: "0 ISK", per: "/md.",
  price1: "Gratis til vagtplanlægning.", price2: `Grunnur fra ${m(getPlan("grunnur").base)}/md.`,
  fine: "Ekskl. moms. Priser i islandske kroner (ISK). Du betaler kun for dem, der arbejdede i måneden. 14 dages gratis prøve, ingen binding.", seePrice: "Se priser",
};

export const pricing: PricingText = {
  metaTitle: "VAKTO: Priser",
  metaDesc: "Vagtplanen er gratis for op til 5 medarbejdere. Grunnur fra 9.990 ISK om måneden med løn, app og stempelur. Åbne priser, ingen binding.",
  skip: "Gå til indhold",
  eyebrow: "Priser",
  h1a: "Vagtplanen er gratis.", h1b: "Lønnen regner sig selv ud.",
  lede: "Start gratis. Vælg et abonnement efter størrelse, og betal kun for dem, der arbejdede i måneden. Ingen binding, ingen skjulte gebyrer.",
  localNote: "Priserne er i islandske kroner (ISK). Vi har endnu ikke faste priser i DKK — skriv til os, så finder vi en pris til din virksomhed.",
  billing: "Betalingsperiode", monthly: "Månedligt", yearly: "Årligt", save: "−15%",
  perMo: "ISK/md.", vat: "Ekskl. moms",
  yearlyNote: (mm, n) => `Betales årligt: ${mm(n)} om året`,
  popular: "Mest populær",
  aiLine: (q) => `VAKTO AI, ${q} spørgsmål om måneden`,
  plans: {
    free: {
      name: "Gratis", for: "Til de allermindste steder. Kun vagtplanen.",
      inc: (_mm, n) => `Op til ${n} medarbejdere · 1 sted · på nettet`,
      btn: "Start gratis", href: "/nyskraning?plan=free",
      f: [["Vagtplan på nettet", 1], ["Del planen som PDF eller link", 1], ["Vagter på mail", 1], ["App til medarbejderne", 0], ["Stempelur", 0], ["Chat, anmodninger og nyhedsfeed", 0], ["Løn og kontrakter", 0], ["VAKTO AI", 0]],
    },
    grunnur: {
      name: "Grunnur", for: "Caféer, bagerier og små butikker.",
      inc: (mm, n, x) => `${n} medarbejdere inkluderet · +${mm(x)} pr. ekstra`,
      btn: "Prøv gratis i 14 dage", href: "/nyskraning?plan=grunnur",
      f: [["Alt i Gratis, plus:", 2], ["App til medarbejderne", 1], ["Stempelur på telefon og tablet", 1], ["Chat, anmodninger og nyhedsfeed", 1], ["Lønkørsel og lønsedler (islandsk løn)", 1], ["Kontrakter med e-underskrift", 1], ["Løn i % af omsætning og rapporter", 1]],
    },
    voxtur: {
      name: "Vöxtur", for: "Restauranter og butikker med flere vagter.",
      inc: (mm, n, x) => `${n} medarbejdere inkluderet · +${mm(x)} pr. ekstra`,
      btn: "Prøv gratis i 14 dage", href: "/nyskraning?plan=voxtur",
      f: [["Alt i Grunnur, plus:", 2], ["Flere steder og afdelinger", 1], ["AI lægger vagtplanen", 1], ["Overvågning og rapporter på mail", 1], ["Arbejdsoversigter og fratrædelser", 1]],
    },
    rekstur: {
      name: "Rekstur", for: "Hoteller, kæder og større arbejdspladser.",
      inc: (mm, n, x) => `${n} medarbejdere inkluderet · +${mm(x)} pr. ekstra`,
      btn: "Tal med os", href: "mailto:hallo@vakto.is?subject=VAKTO%20Rekstur",
      f: [["Alt i Vöxtur, plus:", 2], ["Prioriteret support", 1], ["Hjælp til opstart", 1], ["Tilpassede lønregler", 1], ["Fast kontaktperson hos VAKTO", 1]],
    },
  },
  under: [
    "Aktiv medarbejder = var på vagt eller stemplede ind i løbet af måneden. Du betaler ikke for dem, der ikke arbejdede.",
    "14 dages gratis prøve på Vöxtur. Ingen binding. Intet kort til Gratis.",
  ],
  quote: (n) => `Mere end ${n} medarbejdere?`, quoteGo: "Vi giver dig et tilbud",

  calcH: "Hvad koster VAKTO for dig?", calcP: "Træk i skyderne, og se hvilket abonnement der passer, og hvad det koster om måneden.",
  empL: "Aktive medarbejdere i måneden", aiL: "Spørgsmål til VAKTO AI om måneden",
  aiHint: "De fleste caféer og restauranter spørger VAKTO AI 10–40 gange om måneden.",
  yourPlan: "Det billigste abonnement for dig", perMonth: "om måneden ekskl. moms", perEmp: (s) => `${s} pr. medarbejder`,
  rowBase: (name, yearly) => `${name}${yearly ? " (betales årligt)" : ""}`,
  rowExtra: (n, mm, x) => `${n} ekstra medarb. × ${mm(x)}`,
  rowAi: (n) => `${n} × ${AI_PACK.questions} AI-spørgsmål`,
  freeNote: "Gratis er nok: op til 5 medarbejdere og ingen VAKTO AI.",
  overQuote: (n) => `Over ${n} medarbejdere giver vi et tilbud. Tallet viser listeprisen.`,
  crossH: "Hvornår kan det betale sig at skifte op?",
  cross: (a, b) => `Fra omkring ${a} medarbejdere er Vöxtur billigere end Grunnur, og fra omkring ${b} er Rekstur billigere end Vöxtur.`,

  addH: "Betal kun for det, du bruger.", addP: "Ingen overraskelser på regningen. Du bestemmer selv, hvad der lægges til.",
  adds: {
    emp: { h: "Flere medarbejdere", p: (mm, lo) => `fra ${mm(lo)}`, d: "pr. aktiv medarbejder ud over det, abonnementet inkluderer. Sommerhjælp koster intet i de måneder, de ikke arbejder." },
    ai: { h: "Mere VAKTO AI", p: (mm, x) => mm(x), d: (q) => `for hver ${q} ekstra spørgsmål. Kun hvis en leder slår tilkøbet til, med et månedligt loft, som lederen selv sætter.` },
    sign: { h: "Elektronisk ID", p: (mm, x) => mm(x), d: "pr. underskrift med islandsk elektronisk ID. Underskrift med kode på mail er altid inkluderet." },
    year: { h: "Årlig betaling", p: () => "−15%", d: "på grundpris og pris pr. medarbejder, når du betaler for hele året på én gang." },
  },

  cmpH: "Det får du i hvert abonnement.", cmpHint: "Stryg til siden for at se alle abonnementer.",
  yes: "Inkluderet", no: "Ikke inkluderet",
  cmp: [
    { g: "Pris", rows: "price" as const },
    { g: "Vagter og tid", rows: [
      ["Vagtplan på nettet", 1, 1, 1, 1],
      ["Del planen som PDF eller link", 1, 1, 1, 1],
      ["Vagter på mail", 1, 1, 1, 1],
      ["App til medarbejderne (islandsk, engelsk, vietnamesisk)", 0, 1, 1, 1],
      ["Stempelur på telefon og tablet", 0, 1, 1, 1],
      ["Flere steder og afdelinger", 0, 0, 1, 1],
      ["AI lægger vagtplanen", 0, 0, 1, 1],
    ] },
    { g: "Løn og kontrakter", rows: [
      ["Lønkørsel efter islandsk overenskomst (dansk på vej)", 0, 1, 1, 1],
      ["Lønsedler og Payday-integration (Island)", 0, 1, 1, 1],
      ["Ansættelseskontrakter med e-underskrift", 0, 1, 1, 1],
      ["Arbejdsoversigter og fratrædelser", 0, 0, 1, 1],
      ["Tilpassede lønregler", 0, 0, 0, 1],
    ] },
    { g: "Kommunikation og indsigt", rows: [
      ["Chat, anmodninger og nyhedsfeed", 0, 1, 1, 1],
      ["Løn i % af omsætning og rapporter", 0, 1, 1, 1],
      ["Overvågning og rapporter på mail", 0, 0, 1, 1],
    ] },
    { g: "Support", rows: [
      ["Hjælp via chat og mail", 1, 1, 1, 1],
      ["Prioriteret support", 0, 0, 0, 1],
      ["Hjælp til opstart", 0, 0, 0, 1],
      ["Fast kontaktperson hos VAKTO", 0, 0, 0, 1],
    ] },
  ],
  cmpBase: "Grundpris om måneden", cmpInc: "Medarbejdere inkluderet", cmpExtra: "Hver ekstra medarbejder", cmpAi: "VAKTO AI, spørgsmål om måneden",
  cmpMax: (n) => `op til ${n}`, cmpFree: "0 ISK", cmpNone: "Ikke muligt",

  faqH: "Ofte stillede spørgsmål.",
  faq: (mm) => [
    ["Hvad tæller som en aktiv medarbejder?", "En medarbejder, der var på vagt eller stemplede ind i løbet af måneden. Registrerede medarbejdere, der ikke arbejder, f.eks. sommerhjælp om vinteren, koster intet i de måneder."],
    ["Kan jeg skifte abonnement?", "Ja, når som helst under Indstillinger, op eller ned. Hvis I bliver flere, fortæller VAKTO dig, når det næste abonnement bliver billigere."],
    ["Hvad sker der, når AI-spørgsmålene er brugt?", `VAKTO AI holder pause til næste måned. Alt andet i systemet virker som normalt. En leder kan slå et tilkøb til, ${mm(AI_PACK.price)} for hver ${AI_PACK.questions} spørgsmål, og sætte et månedligt loft, så regningen aldrig overrasker.`],
    ["Er der binding?", "Nej. Du opsiger under Indstillinger, og abonnementet løber til udgangen af den betalte periode. Årlig betaling giver 15 % rabat."],
    ["Kan VAKTO beregne dansk løn?", "Ikke endnu. Lønkørslen følger i dag islandske overenskomster, og timerne går til Payday eller DK (Island) eller ud i Excel. Danske overenskomster og lønsystemer er på vej. Vagtplan, stempelur, app, chat og løn i % af omsætningen virker allerede."],
    ["Er Gratis virkelig gratis?", "Ja. For op til 5 medarbejdere på ét sted, uden tidsbegrænsning og uden kort. Du får vagtplanen på nettet, kan dele den som PDF eller link, og medarbejderne får deres vagter på mail. App, stempelur og løn følger med fra Grunnur."],
    ["Hvorfor er priserne i ISK?", "VAKTO kommer fra Island, og vores prisliste er i islandske kroner. Vi har endnu ikke faste priser i DKK. Skriv til hallo@vakto.is, så giver vi dig en pris."],
    ["Hvordan fungerer prøveperioden?", "I 14 dage får du alt i Vöxtur gratis. Når prøven slutter, vælger du et abonnement, eller går over på Gratis, hvis det er nok."],
  ],

  endH: "Start gratis i dag.", endP: "Intet kort. Lav din første vagtplan på ti minutter.", endBtn: "Opret konto",
  endOr: "Spørgsmål om priser? ", fine: "Alle priser er i islandske kroner (ISK), pr. måned og ekskl. moms. Kontakt os for pris i DKK.",
};

export const about: AboutText = {
  h1: "Jeg byggede det system, jeg manglede.", by: "Bjarni Lúðvíksson, stifter af VAKTO", alt: "Bjarni Lúðvíksson, stifter af VAKTO",
  lead1: "Jeg har drevet virksomhed inden for mange områder: restauranter, et produktionskøkken, turisme og gæstehuse. I alle dem fandt jeg aldrig et ordentligt system, der passede og var nemt at bruge, både for mig og for medarbejderne.",
  lead2: "VAKTO er svaret på det, der irriterede mig i årevis.",
  painsAria: "Det løser VAKTO",
  pains: [
    ["Ansættelseskontrakter forsvandt.", "Nu bliver kontrakten lavet ud fra medarbejderens oplysninger, begge skriver under elektronisk, og den underskrevne kopi gemmes ét sted."],
    ["Medarbejderkort blev glemt.", "Det er ikke godt, når der kommer kontrol på besøg. Nu har alle kortet på telefonen, i Apple og Google Wallet."],
    ["Regler og HACCP nåede ikke ud til alle.", "Nu ligger de i lommen hos alle medarbejdere, nemme at finde og læse."],
    ["Overarbejdet dukkede op ved månedens udgang.", "Nu ser jeg løn som andel af omsætningen og afvigelser med det samme, og den reelle udgift i realtid, når planen ikke bliver fulgt."],
    ["Overenskomster og vilkår tog tid.", "Nu hjælper AI med at finde den rette (islandske) overenskomst og formulere vilkår professionelt. De går direkte ind i ansættelseskontrakten, som underskrives elektronisk."],
  ],
  quote: "„Alt for ofte opdagede jeg først alt overarbejdet, når måneden skulle gøres op. Det er slut nu.“",
  ctaH: "Prøv VAKTO i din virksomhed.", ctaP: "14 dage gratis, ingen binding. Eller skriv til mig på ", try: "Prøv gratis",
};

export const contractors: VerkText = {
  eyebrow: "VAKTO Verk · vagter og opgaver",
  h1: ["Opgaven, timerne", "og godkendelsen.", "I én app."],
  lede: "Start tidtagningen på stedet, tag billeder og registrer materialer. Kunden godkender arbejdsrapporten med ét tryk, og diskussioner om timer hører fortiden til.",
  cta: "Prøv gratis i 14 dage",
  priceNote: (mm) => `${mm} om måneden · ingen binding`,
  phone: { top: "Opgaver", live: "Tidtagning i gang", job: "Badeværelse · Laugavegur 5", geo: "Bekræftet på stedet", stop: "Stop", month: "Denne måned", monthV: "86,5 t", open: "Åbne opgaver", jobs: [["Køkken, Kópavogur", "Anna Jónsdóttir · 12,0 t"], ["El-arbejde, Grafarholt", "Byggás ehf. · 31,5 t"]] },
  float1: ["Godkendt", "Anna Jónsdóttir · i dag 16.42"], float2: "3 billeder i rapporten",
  painQ: ["„Jeg arbejdede meget mere end det.“", "„Jeg betaler ikke for timer, jeg ikke så.“"],
  painP: "De fleste håndværkere kender samtalen. Timerne er i hovedet, kvitteringerne i handskerummet og billederne væk på telefonen. VAKTO Verk samler det hele, mens du arbejder, og kunden ser alt, før fakturaen sendes.",
  stepsEyebrow: "Sådan virker det", stepsH: ["Tre trin.", "Intet papirarbejde."],
  steps: [
    ["Start på stedet", "Åbn opgaven, og tryk på Start. Telefonen registrerer tiden og bekræfter placeringen."],
    ["Registrer, mens du arbejder", "Billeder, materialer, udlæg og kørsel går direkte på opgaven, på få sekunder."],
    ["Send til godkendelse", "Vælg en periode, og send et link. Kunden godkender, og du ved, at fakturaen bliver betalt."],
  ],
  apprEyebrow: "Det ser kunden", apprH: ["Gennemsigtighed, der", "skaber tillid."],
  apprLede: "Intet login, ingen app. Kunden åbner linket, ser hver tidsregistrering med bekræftelse på stedet, billederne, materialerne og beløbene — og godkender. Du ser godkendelsen i VAKTO med det samme.",
  apprTicks: ["Timer med bekræftelse på stedet", "Arbejde, materialer og moms specificeret", "Islandsk momsrefusion på arbejdsløn beregnet for husejeren (kun Island)", "Navn og tidspunkt for godkendelse registreret"],
  doc: {
    from: "Arbejdsrapport fra", company: "Jón Rafvirki ehf.", status: "Afventer godkendelse", title: "Badeværelse, Laugavegur 5", period: "1.–31. oktober",
    k: [["24,5 t", "Arbejde"], ["38 km", "Kørsel"], ["402.169 ISK", "I alt inkl. moms"]],
    rows: [["Arbejde (24,5 t × 9.500 ISK)", "232.750 ISK"], ["Materialer", "91.580 ISK"], ["Moms 24 %", "77.839 ISK"]],
    total: ["I alt", "402.169 ISK"], refund: ["Momsrefusion på arbejdsløn i bolig (Island): ca.", "19.551 ISK"],
    approve: "Godkend", fix: "Bed om en rettelse",
  },
  featEyebrow: "Alt, hvad en håndværker har brug for", featH: ["Bygget til arbejdet", "ude i marken."],
  features: [
    { t: "Tidtagning på stedet", p: "Tryk på Start, når du ankommer. Telefonen bekræfter, at du er på stedet, og kunden ser det i rapporten." },
    { t: "Billeder og noter", p: "Tag et før- og efterbillede. Billederne kommer automatisk med i arbejdsrapporten, uden at du skal lede i kamerarullen." },
    { t: "Godkendelse med ét tryk", p: "Kunden får et link, ser timer, materialer, billeder og beløb og godkender. Navn og tidspunkt registreres." },
    { t: "Materialer, udlæg og kørsel", p: "Registrer materialer og udlæg på opgaven og kilometer ved hver tidtagning. Alt lagt sammen for dig." },
    { t: "35 % momsrefusion beregnet", p: "Arbejde og materialer er adskilt i rapporten, så husejeren kan se, hvor meget moms af arbejdslønnen de får tilbage.", tag: "Kun Island" },
    { t: "Kunderne samlet ét sted", p: "Hver kunde med sine opgaver, tilbud, timer, faktureret og ubetalt, og noter. Du ser med det samme, hvad der mangler at blive faktureret." },
    { t: "Et team, når du vokser", p: "Tilføj en medarbejder eller underleverandør. Alle registrerer deres egne timer, du ser det hele og sender én rapport." },
    { t: "Tilbud og entrepriseaftaler", p: "Send et tilbud, som kunden accepterer som aftale med sit navn. Et accepteret tilbud bliver automatisk til en opgave." },
    { t: "Fakturaer i Payday", p: "Ét tryk: en faktura for opgaven oprettes i din Payday-konto, med arbejde og materialer specificeret, og sendes til kunden.", tag: "Kun Island" },
    { t: "VAKTO AI til dine opgaver", p: "Beskriv opgaven, og AI skriver et udkast til tilbud. Spørg „hvor meget arbejdede jeg for Jón i oktober?“ eller „hvad mangler jeg at fakturere?“." },
  ],
  priceEyebrow: "Pris", planName: "Verktaki", perMonth: "om måneden ekskl. moms",
  inc: (x) => `Én bruger inkluderet. Hver ekstra bruger ${x}.`,
  ticks: (ai) => ["Ubegrænset antal opgaver og kunder", "Tidtagning med bekræftelse på stedet", "Billeder, materialer, udlæg og kørsel", "Arbejdsrapporter og kundegodkendelse", "App til iPhone og Android, plus web", "Tilbud, kundeoversigt og fakturaer i Payday (Island)", `VAKTO AI, ${ai} spørgsmål om måneden`],
  fine: "Ingen binding. Driver du en virksomhed med vagtarbejde?", fineLink: "Se abonnementer for virksomheder",
  faqH: "Spørgsmål og svar",
  faq: [
    ["Hvem er VAKTO Verk til?", "Håndværkere, entreprenører og selvstændige, der arbejder på timeløn eller pr. opgave: elektrikere, tømrere, VVS'ere, malere, gartnere, rengøring, IT og rådgivning. Fra én person til et lille team."],
    ["Skal kunden oprette en konto?", "Nej. Kunden får et link på mail eller sms, åbner rapporten på telefonen og godkender eller beder om en rettelse."],
    ["Bliver min placering altid sporet?", "Nej. Placeringen læses kun, når du starter og stopper tidtagningen, for at bekræfte, at du var på stedet. Ingen løbende sporing."],
    ["Kan jeg også bruge det på computeren?", "Ja. Alt i appen findes også på vakto.is: opgaver, timer, materialer, billeder og rapporter."],
    ["Hvad hvis jeg ikke er momsregistreret?", "Rapporten beregner moms som standard. Indstillinger for dem under momsgrænsen er på vej. Kontakt os, så hjælper vi."],
    ["Virker det med dansk regnskabsprogram?", "Ikke endnu. Fakturering direkte fra VAKTO Verk går i dag til Payday (Island). Rapporter kan hentes, og danske integrationer er på vej."],
    ["Er der binding?", "Nej. 14 dages gratis prøve og derefter et månedligt abonnement, som du kan opsige når som helst."],
  ],
  finalH: ["Mindre papirarbejde.", "Flere godkendte fakturaer."], finalCta: "Start gratis",
};

export const integrations: TengText = {
  eyebrow: "Integrationer",
  h1: ["Spiller sammen med de systemer,", "du allerede bruger."],
  lede: "Her er listen, som den ser ud i dag: de systemer, VAKTO rent faktisk forbinder til, hvilke data der flyttes, og hvordan du sætter dem op. Det, der stadig er på vej, er markeret som sådan.",
  regionNote: "Lønberegningen i VAKTO følger i dag islandske overenskomster, og lønintegrationerne nedenfor er islandske systemer. Løn efter danske overenskomster og danske lønsystemer er på vej.",
  jump: "Se alle integrationer",
  edgeEyebrow: "Mere end en eksport", edgeH: ["De fleste vagtsystemer eksporterer timer.", "VAKTO regner lønnen ud."],
  edgeP: "En forbindelse til lønsystemet er god, men det er kun sidste skridt. VAKTO klarer alt det, der kommer før, så det, der lander i lønsystemet, allerede er rigtigt.",
  edge: [
    ["Løn efter overenskomst", "Grundløn, overarbejde, tillæg, feriepenge og ekstra betaling beregnet ud fra stemplingerne, efter hver medarbejders (islandske) overenskomst."],
    ["Lønsedler", "Medarbejderne ser deres lønseddel og forventede løn i appen, specificeret."],
    ["Ansættelseskontrakter", "Kontrakten udfyldes ud fra medarbejderens oplysninger og underskrives elektronisk på telefonen."],
    ["Chat og nyhedsfeed", "Kanaler pr. afdeling og sted og nyheder til hele holdet, i samme app som vagterne."],
    ["VAKTO AI", "Lægger vagtplanen, svarer med dine tal og spørger altid, før den ændrer noget."],
  ],
  live: "Aktiv", soon: "På vej",
  outL: "Fra VAKTO", inL: "Ind i VAKTO", needL: "Du skal bruge", stepsL: "Sådan forbinder du",
  cats: {
    pay: { h: "Løn og regnskab", p: "VAKTO beregner lønnen. Lønsystemet står stadig for skat, indberetninger og udbetaling." },
    rev: { h: "Omsætning", p: "Løn som andel af omsætningen kræver omsætningstal. De kommer automatisk fra kassesystemet, webshoppen eller regnskabet." },
    docs: { h: "Kontrakter og underskrift", p: "Ansættelseskontrakter og fratrædelser underskrevet elektronisk, uden papir." },
    ai: { h: "AI og udviklere", p: "Forbind dine egne værktøjer, med nøgler du selv styrer." },
    staff: { h: "Til medarbejderne", p: "Vagterne og medarbejderkortet dér, hvor medarbejderne allerede er: på telefonen." },
  },
  items: {
    payday: {
      sub: "Løn og regnskab (Island)",
      d: "Godkendte timer går direkte ind i en lønkørsel i Payday som timeseddel, med ét klik. VAKTO Verk opretter også fakturaer i Payday.",
      out: ["Timer pr. medarbejder: grundløn, overarbejde og tillæg pr. procentsats", "Fakturaer for opgaver (VAKTO Verk)"],
      in: [],
      need: ["En Payday-konto med API-adgang (Client ID og Client Secret)", "Lønarter i Payday, der hedder det samme som i VAKTO (Dagvinna, Yfirvinna, Álag 33% …)"],
      steps: [
        "I Payday: Indstillinger → Virksomhed → API. Opret en adgang, og kald den VAKTO.",
        "I VAKTO: Indstillinger → Integrationer → Payday → Forbind. Indsæt Client ID og Client Secret.",
        "Under Lønkørsler vises nu „Send til Payday“. Periodens godkendte timer går ind som timeseddel.",
        "Hellere en fil? Lønkørsler → Eksporter → Payday giver en Excel-fil, som Payday kan indlæse.",
      ],
    },
    dk: {
      sub: "dk Laun og dkPlus (Island)",
      d: "Timerne går ind i en lønkørsel i dk Laun via CSV-import, fordelt på lønarter og afdelinger. Omsætningen kan komme automatisk fra regnskabet i dkPlus.",
      out: ["CSV til lønkørsel i dk Laun: personnummer, afdeling og timer pr. lønart"],
      in: ["Daglig omsætning fra regnskabets indtægtskonti (dkPlus, valgfrit)"],
      need: ["Lønartsnumre i dk Laun (grundløn, overarbejde, hvert tillæg)", "Afdelingsnumre, hvis du fordeler lønnen på afdelinger", "En adgangsnøgle til dkPlus, hvis omsætningen skal komme automatisk"],
      steps: [
        "I VAKTO: Indstillinger → Integrationer → DK → Opsæt. Indtast lønarts- og afdelingsnumre fra dk Laun.",
        "Lønkørsler → Eksporter → DK henter en CSV-fil for perioden.",
        "I dk Laun: åbn lønkørslen, og vælg indlæsning fra CSV-fil.",
        "Valgfrit: indsæt en adgangsnøgle fra dkPlus i samme vindue for at hente omsætningen dagligt.",
      ],
    },
    businesscentral: {
      sub: "Microsoft Dynamics 365 og LS Central",
      d: "Omsætningen hentes dagligt fra finansbogholderiet, og hver lønkørsel bogføres som én samlet postering i en kladde, som bogholderen selv bogfører.",
      out: ["Lønbogføring: løn, lønrelaterede udgifter, A-skat, pension, fagforening, arbejdsgiverafgift og feriepengeforpligtelse (efter islandske regler)"],
      in: ["Daglig omsætning fra finansbogholderiet"],
      need: ["Adgang til Azure (Microsoft Entra ID) for at registrere en app", "Rettighedssæt D365 READ (omsætning) eller D365 ACCOUNTANTS (omsætning og lønbogføring)"],
      steps: [
        "I Azure: App registrations → New registration, kald den VAKTO. Kopiér Application (client) ID og Directory (tenant) ID.",
        "API permissions → Dynamics 365 Business Central → API.ReadWrite.All → Grant admin consent. Opret en client secret.",
        "I Business Central: „Microsoft Entra Applications“ → Ny. Indtast Client ID, State: Enabled og rettighedssættet.",
        "I VAKTO: Indstillinger → Integrationer → Business Central → Forbind. Derefter „Lønbogføring“ for at vælge konti.",
      ],
    },
    excel: {
      sub: "Eksport og import",
      d: "Til lønsystemer, der ikke er på listen: lønkørsel, timesedler og rapporter kan eksporteres til Excel eller PDF, og omsætning kan indlæses fra en CSV-fil.",
      out: ["Lønkørsel og timer i Excel", "Rapporter i Excel og PDF"],
      in: ["Omsætning fra en CSV-fil (dato og beløb), f.eks. historik fra kassesystemet"],
      need: ["Intet. Inkluderet i alle abonnementer med løn"],
      steps: [
        "Lønkørsler → Eksporter → Excel.",
        "Omsætning: Indstillinger → Integrationer → Andet system? → Upload en fil.",
      ],
    },
    shopify: {
      sub: "Webshop",
      d: "Omsætning fra ordrer hentes automatisk hver dag, så løn i % af omsætningen altid er rigtig. VAKTO læser kun ordrer, aldrig kortoplysninger.",
      out: [],
      in: ["Daglig omsætning fra ordrer (90 dages historik ved første forbindelse)"],
      need: ["En Shopify-butik og ret til at oprette en app (read_orders)"],
      steps: [
        "I Shopify: Settings → Apps and sales channels → Develop apps → Create an app. Kald den VAKTO.",
        "Configure Admin API scopes: sæt flueben ved read_orders, og gem. Klik på Install app.",
        "I VAKTO: Indstillinger → Integrationer → Shopify → Forbind. Indsæt butikkens adresse og Admin API access token.",
      ],
    },
    woocommerce: {
      sub: "Webshop på WordPress",
      d: "Omsætning fra ordrer hentes dagligt med en nøgle, der kun har læseadgang.",
      out: [],
      in: ["Daglig omsætning fra ordrer (90 dages historik ved første forbindelse)"],
      need: ["Administratoradgang til WordPress"],
      steps: [
        "I WordPress: WooCommerce → Settings → Advanced → REST API → Add key.",
        "Kald nøglen VAKTO, vælg Permissions: Read, og klik på Generate API key.",
        "I VAKTO: Indstillinger → Integrationer → WooCommerce → Forbind. Indsæt adressen, Consumer key og Consumer secret.",
      ],
    },
    inventra: {
      sub: "Produktion og salg",
      d: "VAKTOs søstersystem til producenter af friske fødevarer. Salget går direkte ind som omsætning.",
      out: [],
      in: ["Omsætning fra INVENTRA"],
      need: ["En INVENTRA-konto og en nøgle fra VAKTO"],
      steps: [
        "I VAKTO: Indstillinger → Integrationer → INVENTRA → Opret nøgle.",
        "Indsæt nøglen i INVENTRA. Derefter kommer omsætningen ind automatisk.",
      ],
    },
    api: {
      sub: "Åbent API, Zapier og Make",
      d: "Bruger du et system, der ikke er på listen? Send omsætningen direkte til VAKTO med en nøgle, fra din egen kode eller via Webhooks i Zapier eller Make.",
      out: [],
      in: ["Omsætning pr. dag og sted (POST /api/v1/revenue)"],
      need: ["En API-nøgle fra VAKTO (kan tilbagekaldes når som helst)"],
      steps: [
        "I VAKTO: Indstillinger → Integrationer → Opret nøgle.",
        "Send POST til /api/v1/revenue med Authorization: Bearer og { date, amount, location }.",
        "I Zapier eller Make: brug „Webhooks“ med samme adresse og nøgle.",
      ],
    },
    esign: {
      sub: "Elektronisk underskrift",
      d: "Ansættelseskontrakter og fratrædelser underskrives på telefonen. Underskrift med kode på mail er altid inkluderet og virker for alle; kvalificeret underskrift med islandsk elektronisk ID går via Taktikal. MitID understøttes ikke endnu.",
      out: ["Kontrakt til underskrift"],
      in: ["Underskrevet kopi, dokumentets fingeraftryk og underskriftslog"],
      need: ["Intet til kode på mail", "Elektronisk ID: islandsk elektronisk ID hos begge parter"],
      steps: [
        "I VAKTO: Indstillinger → Regler og løn → Underskrift af kontrakter. Vælg kode på mail eller elektronisk ID (Taktikal).",
        "Send kontrakten fra medarbejderens profil. Begge skriver under og får den underskrevne kopi på mail.",
      ],
    },
    mcp: {
      sub: "Claude, ChatGPT og MCP",
      d: "Spørg om vagter, timer og lønprocent i din egen AI-app. Kun læseadgang: apps kan ikke ændre noget og får aldrig personnumre, bankkonti eller adresser.",
      out: ["Vagter, timer, omsætning og lønprocent (kun læsning)"],
      in: [],
      need: ["Claude, ChatGPT eller en anden app, der understøtter MCP-forbindelser", "Virksomhedens ejer slår forbundne apps til"],
      steps: [
        "I VAKTO: Indstillinger → Integrationer → Forbundne apps → Tillad AI-apps (ejer).",
        "Kopiér adressen, og tilføj den som connector i Claude eller ChatGPT.",
        "Log ind med VAKTO, og godkend adgangen. Du kan afbryde forbindelsen når som helst.",
      ],
    },
    wallet: {
      sub: "Apple Wallet og Google Wallet",
      d: "Medarbejderkortet med billede, stilling og QR-kode på telefonen. Koden stempler ind på tabletten ved indgangen.",
      out: ["Medarbejderkort i Wallet"],
      in: [],
      need: ["En iPhone eller Android-telefon"],
      steps: ["Medarbejderen åbner kortet i VAKTO-appen og trykker på „Føj til Wallet“."],
    },
    calendar: {
      sub: "Google, Apple og Outlook",
      d: "Vagterne vises i telefonens kalender og opdateres af sig selv, når planen ændres.",
      out: ["Medarbejderens vagter som kalenderabonnement (ICS)"],
      in: [],
      need: ["En kalender, der kan abonnere på en adresse"],
      steps: ["I VAKTO: Planen → Sæt vagter i kalenderen → Kopiér link.", "I kalenderen: tilføj en kalender „Fra URL“, og indsæt linket."],
    },
  },
  plannedH: "På vej.", plannedP: "Disse integrationer er under udvikling eller på vores liste. Ingen af dem er klar endnu, og vi markerer dem ikke som aktive, før de virker.",
  planned: {
    uniconta: { sub: "Regnskab", d: "Omsætning og lønbogføring." },
    h3: { name: "H3 Laun", sub: "Løn (Island)", d: "Timer direkte ind i lønkørslen." },
    m365: { name: "Microsoft 365 og Entra ID", sub: "Login", d: "Log ind med din arbejdskonto og brugere fra Entra ID." },
    noona: { sub: "Kassesystem og bookinger", d: "Omsætning fra kassen og bookinger til prognosen." },
    dineout: { sub: "Kassesystem og bookinger", d: "Omsætning og bookinger til vagtplanens prognose." },
    regla: { sub: "Regnskab (Island)", d: "Omsætning fra regnskabet." },
    fortnox: { sub: "Regnskab og løn", d: "Sverige og Norge." },
    nordic: { name: "Nordiske lønsystemer", sub: "Danmark, Sverige og Norge", d: "Løn efter nordiske overenskomster og forbindelser til lønsystemer dér. Vi prioriterer efter, hvad kunderne bruger." },
  },
  askH: "Bruger du et andet system?", askP: "Fortæl os hvilket. Det, flest beder om, kommer først i køen.", askBtn: "Skriv til os",
  endH: "Prøv VAKTO med dine systemer.", endP: "14 dages gratis prøve, ingen binding. De fleste forbindelser tager under et minut.", endBtn: "Prøv gratis", endPrice: "Se priser",
};

export const nav: NavText = { product: "Systemet", contracts: "Kontrakter", integrations: "Integrationer", price: "Priser", about: "Om os", login: "Log ind", try: "Prøv gratis", open: "Åbn menu", close: "Luk menu" };

export const footer: FootText = {
  desc: "Vagtplan, stempelur, løn og ansættelseskontrakter. Og lønnen som andel af omsætningen i realtid. Udviklet i Island.",
  product: "Produkt", features: "Funktioner", showcase: "Lær VAKTO at kende", contracts: "Kontrakter", integrations: "Integrationer", price: "Priser", contractors: "Til håndværkere", try: "Prøv gratis",
  company: "Virksomheden", about: "Om os", contact: "Kontakt", login: "Log ind",
  legal: "Juridisk", privacy: "Privatliv", terms: "Vilkår", cookies: "Cookies",
  follow: "Følg os", copy: "© 2026 BGL Ventures ehf. · isl. reg.-nr. 490806-0400", made: "Designet og udviklet i Island",
};

export const consent: ConsentText = {
  text: "Vi bruger cookies til at måle, hvordan hjemmesiden bruges, og om vores annoncer virker (Google Analytics og Meta). Intet sættes, medmindre du tillader det.",
  more: "Læs mere", no: "Afvis", yes: "Tillad",
};

export const legalNote = "Denne side findes kun på islandsk. Spørgsmål på dansk eller engelsk er velkomne på hallo@vakto.is.";

export const meta: MetaText = {
  home: { title: "VAKTO: vagtplan, stempelur, tidsregistrering og løn", desc: "Vagtplanlægning, stempelur og tidsregistrering til restauranter, caféer og butikker. Løn som andel af omsætningen i realtid, chat og app til medarbejderne. 14 dages gratis prøve." },
  price: { title: "VAKTO: Priser", desc: "Vagtplanen er gratis for op til 5 medarbejdere. Åbne priser i ISK, ingen binding. Kontakt os for pris i DKK." },
  contractors: { title: "VAKTO Verk: tidsregistrering, arbejdsrapporter og godkendelse for håndværkere", desc: "Tidtagning med placering på stedet, billeder, materialer og kørsel — og kunden godkender arbejdsrapporten med ét tryk. Til håndværkere og selvstændige." },
  about: { title: "VAKTO: Om os", desc: "VAKTO er bygget af en erhvervsdrivende, der aldrig fandt et enkelt system til vagter, løn og medarbejdere." },
  integrations: { title: "VAKTO: Integrationer med Payday, DK, Business Central, Shopify m.fl.", desc: "De systemer, VAKTO forbinder til i dag, hvilke data der flyttes, og hvordan du sætter dem op trin for trin. Danske lønsystemer er på vej." },
};
