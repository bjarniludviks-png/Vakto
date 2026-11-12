// Norsk (bokmål) tekst for nettstedet (/no). Ærlig om hva som finnes i dag: lønn etter islandske
// tariffavtaler, islandske lønnssystemer (Payday, DK), priser kun i ISK. Norske lønnsregler kommer.
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

const m = (n: number) => fmtMoney("nb", n);

export const home: HomeText = {
  skip: "Gå til innholdet",
  h1a: "Vaktene, lønnen og oversikten.", h1b: "På ett sted.",
  lede: "Vaktplan, stemplingsur, lønnskjøring og arbeidsavtaler. Og lønnskostnad som andel av omsetningen, i sanntid.",
  try: "Prøv gratis", see: "Se systemet",
  demo: "Prøv demo", demoBusy: "Åpner demo …", demoErr: "Demoen er ikke tilgjengelig akkurat nå. Prøv igjen senere.",
  heroAlt: "VAKTO-dashbordet: lønn som andel av omsetning, arbeidstimer og avvik",
  videoAlt: "Video: VAKTO i bruk. Dashbord, en vakt dras mellom ansatte i vaktplanen, timeregistrering og lønnskjøring.",
  cap1b: "Lønn som % av omsetning.", cap1: " Ett tall som viser om vakten lønner seg.",
  cap2b: "Grønt, gult eller rødt.", cap2: " Regnet ut fra stemplingene underveis, ikke ved månedsslutt.",
  featH: "Alt vakten trenger.",
  dragAlt: "Ukens vaktplan: en vakt dras fra én ansatt til en annen",
  t1h: "Vaktplan på et kvarter.", t1p: "Dra vakter rundt, kopier forrige uke eller be AI om en plan som passer omsetningsprognosen. Lønnskostnaden oppdateres mens du jobber.",
  t2h: "Stempling på mobilen.", t2p: "Eller på et nettbrett ved inngangen. Med stedsbekreftelse hvis du vil.", t2alt: "VAKTO-appen: på vakt siden 05:38, stemple ut",
  t3h: "Avvik i kroner og øre.", t3p: "Hvem kom for sent, hvem gikk tidligere, og hva det kostet.", t3alt: "Timeregistrering med avvik",
  t4h: "Lønn etter tariffavtalen.", t4p: "Tillegg, overtid og bonuser regnes ut etter islandske tariffavtaler, og går rett til Payday eller DK (Island). Norske tariffavtaler og lønnssystemer kommer snart.", t4alt: "Månedens lønnskjøring",
  t5h: "Nettbrett ved inngangen.", t5p: "De ansatte trykker på navnet sitt og taster inn sin kode, eller skanner ID-kortet fra mobilen. Alle ser hvem som er på vakt, og stemplingen går rett inn i timelisten.", t5alt: "Stemplingsuret på et nettbrett: alle ansatte og hvem som er på vakt",
  t6h: "Chat for hele gjengen.", t6p: "Kanaler per avdeling og sted. Ingen Messenger-gruppe med tidligere ansatte.", t6alt: "Chatkanaler i VAKTO-appen",
  darkH: "Vakkert i dagslys. Også på nattevakten.", darkP: "Systemet følger innstillingen på enheten. Dra for å sammenligne.",
  cmpAria: "Sammenlign lyst og mørkt", cmpLight: "Vaktplan i lyst tema", cmpDark: "Vaktplan i mørkt tema",
  appAlt: "Appen i mørkt tema: på vakt", appH: "De ansatte får appen.",
  storePlay: "Last ned på Google Play", storeApple: "Last ned i App Store", storeSoon: "",
  appP: "Vaktene, stempling, beregnet lønn, feriesaldo, fri og vaktbytter. Og chat og nyhetsfeed for hele gjengen.",
  appTicks: ["iPhone og Android", "Islandsk, engelsk, polsk og vietnamesisk", "Varsel når planen endres"],
  feedAlt: "Nyhetsfeed i appen",
  showH: "Bli kjent med VAKTO.", showRole: "lysbildefremvisning", slideRole: "lysbilde", of: "av", slideN: "Lysbilde", pause: "Pause", play: "Spill av",
  slides: [
    { t: "Rapporter som betyr noe.", d: "Lønn i % av omsetning per måned, kostnad per avdeling, overtid, sykefravær og oppmøte. Last ned i Excel eller PDF, eller be VAKTO AI om rapporten.", alt: "Innsikt i VAKTO: lønn 31,1 % av omsetningen i oktober, omsetning 19,3 mill. ISK og lønnskostnad 6,0 mill. ISK" },
    { t: "Vaktene i lomma.", d: "De ansatte ser planen sin, søker på ledige vakter og tilbyr vakter til bytte. Chatten er på samme sted.", alt: "Ukens vakter i appen", alt2: "Chatkanaler i appen" },
    { t: "Nyhetsfeed for arbeidsplassen.", d: "Ny meny, endrede åpningstider, et bilde fra kjøkkenet. Fest det viktige øverst så det ikke forsvinner.", alt: "Nyhetsfeeden i appen" },
    { t: "En lønnsslipp som holder.", d: "Dagtid, tillegg og overtid spesifisert. Også når måneden hadde null timer og den ansatte trenger dokumentasjon.", alt: "Lønnsslipp fra VAKTO" },
  ],
  hey: {
    eyebrow: "VAKTO AI", h: "Hei VAKTO, …", lede: "Si hva som må gjøres, slik du ville sagt det til en vaktleder. VAKTO AI leser dine data, svarer med dine tall og forbereder endringen.",
    pre: "Hei VAKTO,",
    groups: [
      { h: "Vaktplan", items: [
        { q: "lag vaktplan for kjøkkenet neste uke. Alle får minst to fridager, og det er alltid tre på vakt.", a: "Setter opp uka for kjøkkenet: tre på vakt hver dag og minst to fridager for alle. Andre avdelinger forblir uendret." },
        { q: "legg ut ledige vakter hver dag neste uke mellom 17 og 23.", a: "Oppretter sju ledige vakter. De ansatte får varsel og søker i appen." },
        { q: "godkjenn fri-søknaden til Anna.", a: "Finner søknaden, viser dagene og godkjenner. Anna får varsel." },
      ] },
      { h: "Ansatte", items: [
        { q: "hvem har ikke møtt opp i dag?", a: "Viser hvem på dagens plan som ikke har stemplet inn, og hvor sent de er." },
        { q: "Jón glemte å stemple ut. Sett utstempling kl. 23:00.", a: "Setter Jóns utstempling til kl. 23:00, og timelisten er i orden." },
        { q: "send arbeidsavtalen til Pétur Karlsson på nytt.", a: "Sender signeringsforespørselen til Péturs e-post igjen." },
      ] },
      { h: "Tall", items: [
        { q: "hvorfor var lønn % høyere i september enn i august?", a: "Sammenligner månedene: omsetning, timer, overtid og tillegg, og peker på de viktigste årsakene." },
        { q: "hvem jobbet mest overtid denne måneden?", a: "Rangerer de ansatte etter overtidstimer og hva de kostet." },
        { q: "si fra hvis noen går over 180 timer denne måneden.", a: "Setter opp et varsel: du får e-post ved 90 % og igjen hvis noen går over, planen inkludert." },
        { q: "send meg en overtidsrapport hver mandag.", a: "Forrige ukes rapport kommer i innboksen kl. 8 hver mandag, med Excel-fil." },
      ] },
    ],
    confirmB: "Ingenting endres uten deg.", confirm: " VAKTO AI spør alltid før noe endres. Du ser forslaget og trykker Bekreft.",
    who: "For eiere og vaktledere. Fra 25 spørsmål i måneden, avhengig av plan.",
    videoAlt: "Video: VAKTO AI setter opp vaktplan for kjøkkenet, og lederen bekrefter forslaget.",
    shotAlt: "Forslag fra VAKTO AI: Moon flyttes til kveldsvakt lørdag, lønnskostnad uendret på 27,4 %",
  },
  visit: {
    h: "Få en demo på video.", p: "Vi viser deg VAKTO i et kort videomøte og svarer på spørsmålene dine. Gratis og uforpliktende.",
    name: "Navn", company: "Bedrift", contact: "Telefon eller e-post", message: "Melding (valgfritt)", messagePh: "F.eks. når det passer, antall ansatte eller lokasjoner",
    send: "Be om demo", sending: "Sender …", okH: "Takk, vi har fått forespørselen.", ok: "Vi tar kontakt snart for å finne et tidspunkt.",
    err: "Kunne ikke sende. Send e-post til hallo@vakto.is.", bot: "Et øyeblikk, robotsjekken lastes.",
  },
  conH: "Avtale på ett minutt, signert på det neste.",
  conP: "VAKTO fyller ut arbeidsavtalen fra den ansattes opplysninger, etter det islandske arbeidsdirektoratets mal. Begge signerer på mobilen og får en signert kopi på e-post. Norske avtalemaler kommer snart.",
  conTicks: ["Følger islandsk standardmal, på islandsk og engelsk", "Signering med kode på e-post, eller islandsk elektronisk ID", "Dokumentets fingeravtrykk og signeringslogg følger med", "Lønnsslipper og timelister i samme stil"],
  conAlt: "Første side av en arbeidsavtale: Kaffi Krónan ansetter Ha Vu", stamp: "Signert elektronisk",
  passLbl: "ANSATT", passRole: "STILLING", passRoleV: "Servitør", passKt: "ID-NUMMER", passNo: "NR.", passFoot: "VAKTO-4132-KK · skann ved stemplingsuret",
  walH: "ID-kortet ligger på mobilen.",
  walDone: "Ferdig",
  walP: "I Apple og Google Wallet, med bilde, stilling og QR-kode. Koden stempler inn på nettbrettet ved inngangen, uten PIN.",
  sisH: "Fra samme verksted.", sisP: "BGL Ventures, selskapet bak VAKTO, lager også INVENTRA: et driftssystem med AI som reduserer svinn hos produsenter av ferskvarer.", sisGo: "inventra.is",
  priceH: "Vaktplanen er gratis.", amt: "0 ISK", per: "/mnd.",
  price1: "Gratis for vaktplan.", price2: `Grunnur fra ${m(getPlan("grunnur").base)}/mnd.`,
  fine: "Ekskl. mva. Priser i islandske kroner (ISK). Du betaler bare for dem som jobbet i måneden. 14 dagers gratis prøveperiode, ingen binding.", seePrice: "Se priser",
};

export const pricing: PricingText = {
  metaTitle: "VAKTO: Priser",
  metaDesc: "Vaktplanen er gratis for opptil 5 ansatte. Grunnur fra 9 990 ISK i måneden med lønn, app og stemplingsur. Åpne priser, ingen binding.",
  skip: "Gå til innholdet",
  eyebrow: "Priser",
  h1a: "Vaktplanen er gratis.", h1b: "Lønnen regner seg selv.",
  lede: "Start gratis. Velg plan etter størrelse, og betal bare for dem som jobbet i måneden. Ingen binding, ingen skjulte gebyrer.",
  localNote: "Prisene er i islandske kroner (ISK). Driver du i Norge? Kontakt oss for pris i NOK.",
  billing: "Betalingsperiode", monthly: "Månedlig", yearly: "Årlig", save: "−15%",
  perMo: "ISK/mnd.", vat: "Ekskl. mva.",
  yearlyNote: (mm, n) => `Betales årlig: ${mm(n)} i året`,
  popular: "Mest populær",
  aiLine: (q) => `VAKTO AI, ${q} spørsmål i måneden`,
  plans: {
    free: {
      name: "Gratis", for: "For de aller minste stedene. Bare vaktplanen.",
      inc: (_mm, n) => `Opptil ${n} ansatte · 1 sted · på nett`,
      btn: "Start gratis", href: "/nyskraning?plan=free",
      f: [["Vaktplan på nett", 1], ["Del planen som PDF eller lenke", 1], ["Vakter på e-post", 1], ["App for de ansatte", 0], ["Stemplingsur", 0], ["Chat, forespørsler og nyhetsfeed", 0], ["Lønn og avtaler", 0], ["VAKTO AI", 0]],
    },
    grunnur: {
      name: "Grunnur", for: "Kafeer, bakerier og små butikker.",
      inc: (mm, n, x) => `${n} ansatte inkludert · +${mm(x)} per ekstra`,
      btn: "Prøv gratis i 14 dager", href: "/nyskraning?plan=grunnur",
      f: [["Alt i Gratis, og:", 2], ["App for de ansatte", 1], ["Stemplingsur på mobil og nettbrett", 1], ["Chat, forespørsler og nyhetsfeed", 1], ["Lønnskjøring, lønnsslipper og Payday (Island)", 1], ["Avtaler med e-signering", 1], ["Lønn % av omsetning og rapporter", 1]],
    },
    voxtur: {
      name: "Vöxtur", for: "Restauranter og butikker med flere vakter.",
      inc: (mm, n, x) => `${n} ansatte inkludert · +${mm(x)} per ekstra`,
      btn: "Prøv gratis i 14 dager", href: "/nyskraning?plan=voxtur",
      f: [["Alt i Grunnur, og:", 2], ["Flere steder og avdelinger", 1], ["AI setter opp vaktplanen", 1], ["Varsler og rapporter på e-post", 1], ["Arbeidsoversikt og avslutning av ansettelse", 1]],
    },
    rekstur: {
      name: "Rekstur", for: "Hoteller, kjeder og større arbeidsplasser.",
      inc: (mm, n, x) => `${n} ansatte inkludert · +${mm(x)} per ekstra`,
      btn: "Snakk med oss", href: "mailto:hallo@vakto.is?subject=VAKTO%20Rekstur",
      f: [["Alt i Vöxtur, og:", 2], ["Prioritert support", 1], ["Hjelp med oppstart", 1], ["Egne lønnsregler", 1], ["Fast kontaktperson hos VAKTO", 1]],
    },
  },
  under: [
    "Aktiv ansatt = hadde vakt eller stemplet inn i løpet av måneden. Du betaler ikke for dem som ikke jobbet.",
    "14 dagers gratis prøveperiode på Vöxtur. Ingen binding. Ikke noe kort for Gratis.",
  ],
  quote: (n) => `Mer enn ${n} ansatte?`, quoteGo: "Vi gir deg et tilbud",

  calcH: "Hva koster VAKTO for deg?", calcP: "Dra i glidebryterne og se hvilken plan som passer og hva den koster i måneden.",
  empL: "Aktive ansatte i måneden", aiL: "Spørsmål til VAKTO AI i måneden",
  aiHint: "De fleste kafeer og restauranter spør VAKTO AI 10–40 ganger i måneden.",
  yourPlan: "Den billigste planen for deg", perMonth: "i måneden ekskl. mva.", perEmp: (s) => `${s} per ansatt`,
  rowBase: (name, yearly) => `${name}${yearly ? " (betales årlig)" : ""}`,
  rowExtra: (n, mm, x) => `${n} ekstra ansatte × ${mm(x)}`,
  rowAi: (n) => `${n} × ${AI_PACK.questions} AI-spørsmål`,
  freeNote: "Gratis holder: opptil 5 ansatte og ingen VAKTO AI.",
  overQuote: (n) => `Over ${n} ansatte gir vi deg et tilbud. Tallet viser listepris.`,
  crossH: "Når lønner det seg å gå opp?",
  cross: (a, b) => `Fra omtrent ${a} ansatte er Vöxtur billigere enn Grunnur, og fra omtrent ${b} er Rekstur billigere enn Vöxtur.`,

  addH: "Betal bare for det du bruker.", addP: "Ingen overraskelser på fakturaen. Du bestemmer selv hva som legges til.",
  adds: {
    emp: { h: "Flere ansatte", p: (mm, lo) => `fra ${mm(lo)}`, d: "per aktiv ansatt utover det planen inkluderer. Sommervikarer koster ingenting de månedene de ikke jobber." },
    ai: { h: "Mer VAKTO AI", p: (mm, x) => mm(x), d: (q) => `for hver ${q} ekstra spørsmål. Bare hvis en leder slår på tillegget, med et månedlig tak de setter selv.` },
    sign: { h: "Elektronisk ID", p: (mm, x) => mm(x), d: "per signatur med islandsk elektronisk ID. Signering med kode på e-post er alltid inkludert." },
    year: { h: "Årlig betaling", p: () => "−15%", d: "på grunnpris og pris per ansatt når du betaler for hele året på forskudd." },
  },

  cmpH: "Dette følger med hver plan.", cmpHint: "Sveip sidelengs for å se alle planene.",
  yes: "Inkludert", no: "Ikke inkludert",
  cmp: [
    { g: "Pris", rows: "price" as const },
    { g: "Vakter og tid", rows: [
      ["Vaktplan på nett", 1, 1, 1, 1],
      ["Del planen som PDF eller lenke", 1, 1, 1, 1],
      ["Vakter på e-post", 1, 1, 1, 1],
      ["App for de ansatte (islandsk, engelsk, polsk, vietnamesisk)", 0, 1, 1, 1],
      ["Stemplingsur på mobil og nettbrett", 0, 1, 1, 1],
      ["Flere steder og avdelinger", 0, 0, 1, 1],
      ["AI setter opp vaktplanen", 0, 0, 1, 1],
    ] },
    { g: "Lønn og avtaler", rows: [
      ["Lønnskjøring etter islandske tariffavtaler (norske kommer snart)", 0, 1, 1, 1],
      ["Lønnsslipper og kobling til Payday (Island)", 0, 1, 1, 1],
      ["Arbeidsavtaler med e-signering", 0, 1, 1, 1],
      ["Arbeidsoversikt og avslutning av ansettelse", 0, 0, 1, 1],
      ["Egne lønnsregler", 0, 0, 0, 1],
    ] },
    { g: "Kommunikasjon og innsikt", rows: [
      ["Chat, forespørsler og nyhetsfeed", 0, 1, 1, 1],
      ["Lønn % av omsetning og rapporter", 0, 1, 1, 1],
      ["Varsler og rapporter på e-post", 0, 0, 1, 1],
    ] },
    { g: "Support", rows: [
      ["Hjelp i chat og på e-post", 1, 1, 1, 1],
      ["Prioritert support", 0, 0, 0, 1],
      ["Hjelp med oppstart", 0, 0, 0, 1],
      ["Fast kontaktperson hos VAKTO", 0, 0, 0, 1],
    ] },
  ],
  cmpBase: "Grunnpris i måneden", cmpInc: "Ansatte inkludert", cmpExtra: "Per ekstra ansatt", cmpAi: "VAKTO AI, spørsmål i måneden",
  cmpMax: (n) => `opptil ${n}`, cmpFree: "0 ISK", cmpNone: "Ikke mulig",

  faqH: "Vanlige spørsmål.",
  faq: (mm) => [
    ["Hva regnes som en aktiv ansatt?", "En ansatt som hadde vakt eller stemplet inn i løpet av måneden. Registrerte ansatte som ikke jobber, f.eks. sommervikarer om vinteren, koster ingenting de månedene."],
    ["Kan jeg bytte plan?", "Ja, når som helst under Innstillinger, opp eller ned. Hvis dere blir flere, sier VAKTO fra når neste plan blir billigere."],
    ["Hva skjer når AI-spørsmålene er brukt opp?", `VAKTO AI hviler til neste måned. Alt annet i systemet fungerer som før. En leder kan slå på et tillegg, ${mm(AI_PACK.price)} for hver ${AI_PACK.questions} spørsmål, og sette et månedlig tak så fakturaen aldri overrasker.`],
    ["Er det binding?", "Nei. Du sier opp under Innstillinger, og abonnementet gjelder ut betalt periode. Årlig betaling gir 15 % rabatt."],
    ["Følger lønnskjøringen tariffavtalene?", "Ja, de islandske. Tillegg, overtid, feriepenger og bonuser regnes etter hver ansatts islandske tariffavtale, og timene går rett til Payday eller ut i Excel og DK. Norske tariffavtaler og lønnssystemer er på vei."],
    ["Er Gratis virkelig gratis?", "Ja. For opptil 5 ansatte på ett sted, uten tidsbegrensning og uten kort. Du får vaktplanen på nett, kan dele den som PDF eller lenke, og de ansatte får vaktene på e-post. App, stemplingsur og lønn følger med fra Grunnur."],
    ["Kan jeg få pris i NOK?", "Prisene våre er i islandske kroner i dag. Kontakt oss på hallo@vakto.is, så finner vi en løsning for norske bedrifter."],
    ["Hvordan fungerer prøveperioden?", "I 14 dager får du alt i Vöxtur, gratis. Når prøveperioden er over, velger du plan, eller går over til Gratis hvis det holder."],
  ],

  endH: "Start gratis i dag.", endP: "Ikke noe kort. Sett opp den første vaktplanen på ti minutter.", endBtn: "Opprett konto",
  endOr: "Spørsmål om pris? ", fine: "Alle priser er i islandske kroner (ISK), per måned og ekskl. mva. Kontakt oss for pris i NOK.",
};

export const about: AboutText = {
  h1: "Jeg lagde systemet jeg selv manglet.", by: "Bjarni Lúðvíksson, grunnlegger av VAKTO", alt: "Bjarni Lúðvíksson, grunnlegger av VAKTO",
  lead1: "Jeg har drevet virksomhet på mange områder: restauranter, et produksjonskjøkken, reiseliv og gjestehus. I all den driften fant jeg aldri et ordentlig system som passet og var enkelt å bruke, både for meg og for de ansatte.",
  lead2: "VAKTO er svaret på det som irriterte meg i årevis.",
  painsAria: "Dette løser VAKTO",
  pains: [
    ["Arbeidsavtaler ble borte.", "Nå lages avtalen fra den ansattes opplysninger, begge signerer elektronisk, og den signerte kopien ligger på ett sted."],
    ["ID-kortene ble glemt.", "Det er ikke bra når tilsynet kommer på besøk. Nå har alle kortet på mobilen, i Apple og Google Wallet."],
    ["Rutiner og HACCP nådde ikke alle.", "Nå ligger de i lomma til alle ansatte, lett å finne og lese."],
    ["Overtiden dukket opp ved månedsslutt.", "Nå ser jeg lønn som andel av omsetningen og avvik med ett blikk, og den reelle kostnaden i sanntid når planen ikke følges."],
    ["Tariffavtaler og vilkår tok tid.", "Nå hjelper AI med å finne riktig tariffavtale og skrive vilkår profesjonelt. De går rett inn i arbeidsavtalen, som signeres elektronisk."],
  ],
  quote: "«Altfor ofte oppdaget jeg all overtiden til de ansatte først da måneden skulle gjøres opp. Det er historie nå.»",
  ctaH: "Prøv VAKTO i din bedrift.", ctaP: "14 dager gratis, ingen binding. Eller send meg en linje på ", try: "Prøv gratis",
};

export const contractors: VerkText = {
  eyebrow: "VAKTO Verk · vakter og oppdrag",
  h1: ["Jobben, timene", "og godkjenningen.", "I én app."],
  lede: "Start tidtakingen på arbeidsstedet, ta bilder og registrer materialer. Kunden godkjenner arbeidsrapporten med ett trykk, og krangel om timer er historie.",
  cta: "Prøv gratis i 14 dager",
  priceNote: (mm) => `${mm} i måneden · ingen binding`,
  phone: { top: "Oppdrag", live: "Tidtaking pågår", job: "Bad · Laugavegur 5", geo: "Bekreftet på stedet", stop: "Stopp", month: "Denne måneden", monthV: "86,5 t", open: "Åpne oppdrag", jobs: [["Kjøkken, Kópavogur", "Anna Jónsdóttir · 12,0 t"], ["Elektrisk, Grafarholt", "Byggás ehf. · 31,5 t"]] },
  float1: ["Godkjent", "Anna Jónsdóttir · i dag 16:42"], float2: "3 bilder i rapporten",
  painQ: ["«Jeg jobbet mye mer enn det der.»", "«Jeg betaler ikke for timer jeg ikke har sett.»"],
  painP: "De fleste håndverkere kjenner den samtalen. Timene er i hodet, kvitteringene i hanskerommet og bildene borte på mobilen. VAKTO Verk samler alt mens du jobber, og kunden ser alt før fakturaen går ut.",
  stepsEyebrow: "Slik fungerer det", stepsH: ["Tre steg.", "Ingen papirarbeid."],
  steps: [
    ["Start på stedet", "Åpne oppdraget og trykk Start. Mobilen registrerer tiden og bekrefter hvor du er."],
    ["Registrer mens du jobber", "Bilder, materialer, utlegg og kjøring går rett på oppdraget, på sekunder."],
    ["Send til godkjenning", "Velg periode og send en lenke. Kunden godkjenner, og du vet at fakturaen blir betalt."],
  ],
  apprEyebrow: "Dette ser kunden", apprH: ["Åpenhet som", "bygger tillit."],
  apprLede: "Ingen innlogging, ingen app. Kunden åpner lenken, ser hver timeregistrering med bekreftelse fra arbeidsstedet, bildene, materialene og beløpene, og godkjenner. Du ser godkjenningen i VAKTO med en gang.",
  apprTicks: ["Timer med bekreftelse fra arbeidsstedet", "Arbeid, materialer og mva. spesifisert", "Islandsk mva.-refusjon på arbeid beregnet for huseieren (kun Island)", "Navn og tidspunkt for godkjenning registrert"],
  doc: {
    from: "Arbeidsrapport fra", company: "Jón Rafvirki ehf.", status: "Venter på godkjenning", title: "Bad, Laugavegur 5", period: "1.–31. oktober",
    k: [["24,5 t", "Arbeid"], ["38 km", "Kjøring"], ["402 169 ISK", "Totalt inkl. mva."]],
    rows: [["Arbeid (24,5 t × 9 500 ISK)", "232 750 ISK"], ["Materialer", "91 580 ISK"], ["Merverdiavgift 24 % (Island)", "77 839 ISK"]],
    total: ["Totalt", "402 169 ISK"], refund: ["Refusjon av mva. på arbeid i bolig (Island): ca.", "19 551 ISK"],
    approve: "Godkjenn", fix: "Be om endring",
  },
  featEyebrow: "Alt en håndverker trenger", featH: ["Laget for arbeid", "ute i felten."],
  features: [
    { t: "Tidtaking på arbeidsstedet", p: "Trykk Start når du kommer. Mobilen bekrefter at du er på stedet, og kunden ser det i rapporten." },
    { t: "Bilder og notater", p: "Ta bilde før og etter. Bildene havner automatisk i arbeidsrapporten, uten leting i bildegalleriet." },
    { t: "Godkjenning med ett trykk", p: "Kunden får en lenke, ser timer, materialer, bilder og beløp, og godkjenner. Navn og tidspunkt registreres." },
    { t: "Materialer, utlegg og kjøring", p: "Registrer materialer og utlegg på oppdraget, og kilometer ved hver tidtaking. Alt summert for deg." },
    { t: "35 % mva.-refusjon beregnet", p: "Arbeid og materialer skilles i rapporten, så huseieren ser hvor mye mva. på arbeid de får tilbake.", tag: "Kun Island" },
    { t: "Kundene på ett sted", p: "Hver kunde med sine oppdrag, tilbud, timer, fakturert og ubetalt, og notater. Du ser med en gang hva som gjenstår å fakturere." },
    { t: "Team når du vokser", p: "Legg til en ansatt eller underleverandør. Alle registrerer sine timer, du ser alt og sender én rapport." },
    { t: "Tilbud og arbeidsavtaler", p: "Send et tilbud som kunden aksepterer som avtale med navnet sitt. Et akseptert tilbud blir automatisk et oppdrag." },
    { t: "Fakturaer i Payday", p: "Ett trykk: en faktura for oppdraget opprettes i Payday hos deg, med arbeid og materialer spesifisert, og sendes til kunden.", tag: "Kun Island" },
    { t: "VAKTO AI for oppdragene", p: "Beskriv jobben, så skriver AI et utkast til tilbud. Spør «hvor mye jobbet jeg for Jón i oktober?» eller «hva gjenstår å fakturere?»." },
  ],
  priceEyebrow: "Pris", planName: "Verktaki", perMonth: "i måneden ekskl. mva.",
  inc: (x) => `Én bruker inkludert. Hver ekstra bruker ${x}.`,
  ticks: (ai) => ["Ubegrenset med oppdrag og kunder", "Tidtaking med bekreftelse fra arbeidsstedet", "Bilder, materialer, utlegg og kjøring", "Arbeidsrapporter og godkjenning fra kunden", "App for iPhone og Android, og nett", "Tilbud, kundeoversikt og fakturaer i Payday (Island)", `VAKTO AI, ${ai} spørsmål i måneden`],
  fine: "Ingen binding. Driver du en bedrift med vaktarbeid?", fineLink: "Se planer for bedrifter",
  faqH: "Spørsmål og svar",
  faq: [
    ["Hvem er VAKTO Verk for?", "Håndverkere, entreprenører og enkeltpersonforetak som jobber på timepris eller per oppdrag: elektrikere, snekkere, rørleggere, malere, gartnere, renhold, IT og rådgivning. Fra én person til et lite team."],
    ["Må kunden opprette en konto?", "Nei. Kunden får en lenke på e-post eller melding, åpner rapporten på mobilen og godkjenner eller ber om endring."],
    ["Spores posisjonen hele tiden?", "Nei. Posisjonen leses bare når du starter og stopper tidtakingen, for å bekrefte at du var på arbeidsstedet. Ingen kontinuerlig sporing."],
    ["Kan jeg bruke det på datamaskinen også?", "Ja. Alt i appen finnes også på vakto.is: oppdrag, timer, materialer, bilder og rapporter."],
    ["Hva om jeg ikke er mva.-registrert?", "Rapporten beregner mva. som standard, etter islandske satser i dag. Innstillinger for dem under omsetningsgrensen og norske satser er på vei. Ta kontakt, så hjelper vi deg."],
    ["Fungerer det med Payday?", "Ja, på Island. Koble til Payday under Innstillinger og lag faktura for et oppdrag med ett trykk. Fakturaen opprettes i Payday hos deg og sendes på e-post til kunden. Norske regnskapssystemer støttes ikke ennå."],
    ["Er det binding?", "Nei. 14 dagers gratis prøveperiode, og deretter et månedlig abonnement du kan si opp når som helst."],
  ],
  finalH: ["Mindre papirarbeid.", "Flere godkjente fakturaer."], finalCta: "Start gratis",
};

export const integrations: TengText = {
  eyebrow: "Integrasjoner",
  h1: ["Fungerer med systemene", "du allerede bruker."],
  lede: "Her er listen slik den er i dag: systemene VAKTO faktisk kobles til, hvilke data som flyter mellom dem og hvordan du kobler til. Det som fortsatt er under arbeid, er merket slik.",
  regionNote: "Lønnen i VAKTO følger islandske tariffavtaler i dag, og lønnsintegrasjonene nedenfor er islandske systemer. Lønn for Norge, Sverige og Danmark er på vei.",
  jump: "Se alle integrasjoner",
  edgeEyebrow: "Mer enn en eksport", edgeH: ["De fleste vaktsystemer eksporterer timer.", "VAKTO regner ut lønnen."],
  edgeP: "En kobling til lønnssystemet er bra, men det er bare siste steg. VAKTO tar seg av alt før det, så det som havner i lønnssystemet allerede er riktig.",
  edge: [
    ["Lønn etter tariffavtale", "Dagtid, overtid, tillegg, feriepenger og bonuser regnet ut fra stemplingene, etter hver ansatts avtale (islandske avtaler i dag)."],
    ["Lønnsslipper", "De ansatte ser lønnsslippen og beregnet lønn i appen, spesifisert."],
    ["Arbeidsavtaler", "Avtalen fylles ut fra den ansattes opplysninger og signeres elektronisk på mobilen."],
    ["Chat og nyhetsfeed", "Kanaler per avdeling og sted, og nyheter for hele gjengen, i samme app som vaktene."],
    ["VAKTO AI", "Setter opp vaktplanen, svarer med dine tall og spør alltid før noe endres."],
  ],
  live: "Aktiv", soon: "Kommer snart",
  outL: "Fra VAKTO", inL: "Inn i VAKTO", needL: "Du trenger", stepsL: "Slik kobler du til",
  cats: {
    pay: { h: "Lønn og regnskap", p: "VAKTO regner ut lønnen. Lønnssystemet tar seg fortsatt av skattetrekk, innrapportering og utbetaling." },
    rev: { h: "Omsetning", p: "Lønn som andel av omsetning krever omsetningstall. De kommer automatisk fra kassesystemet, nettbutikken eller regnskapet." },
    docs: { h: "Avtaler og signering", p: "Arbeidsavtaler og avslutning av ansettelse signert elektronisk, uten papir." },
    ai: { h: "AI og utviklere", p: "Koble til dine egne verktøy, med nøkler du kontrollerer." },
    staff: { h: "For de ansatte", p: "Vaktene og ID-kortet der de ansatte allerede er: på mobilen." },
  },
  items: {
    payday: {
      sub: "Lønn og regnskap (Island)",
      d: "Godkjente timer går rett inn i en lønnskjøring i Payday som timeliste, med ett klikk. VAKTO Verk lager også fakturaer i Payday.",
      out: ["Timer per ansatt: dagtid, overtid og tillegg etter prosent", "Fakturaer for oppdrag (VAKTO Verk)"],
      in: [],
      need: ["En Payday-konto med API-tilgang (Client ID og Client Secret)", "Lønnsarter i Payday med samme navn som i VAKTO (Dagvinna, Yfirvinna, Álag 33% …)"],
      steps: [
        "I Payday: Innstillinger → Selskap → API. Opprett en tilgang og kall den VAKTO.",
        "I VAKTO: Innstillinger → Integrasjoner → Payday → Koble til. Lim inn Client ID og Client Secret.",
        "Under Lønnskjøringer vises nå «Send til Payday». Periodens godkjente timer går inn som timeliste.",
        "Vil du heller ha en fil? Lønnskjøringer → Eksporter → Payday gir en Excel-fil som Payday kan lese inn.",
      ],
    },
    dk: {
      sub: "dk Laun og dkPlus (Island)",
      d: "Timene går inn i en lønnskjøring i dk Laun via CSV-import, fordelt på lønnsarter og avdelinger. Omsetningen kan komme automatisk fra regnskapet i dkPlus.",
      out: ["CSV for lønnskjøring i dk Laun: ID-nummer, avdeling og timer per lønnsart"],
      in: ["Daglig omsetning fra inntektskontoene i regnskapet (dkPlus, valgfritt)"],
      need: ["Lønnsartnumre i dk Laun (dagtid, overtid, hvert tillegg)", "Avdelingsnumre hvis du fordeler lønn på avdelinger", "En tilgangsnøkkel i dkPlus hvis omsetningen skal komme automatisk"],
      steps: [
        "I VAKTO: Innstillinger → Integrasjoner → DK → Sett opp. Legg inn lønnsart- og avdelingsnumre fra dk Laun.",
        "Lønnskjøringer → Eksporter → DK laster ned en CSV-fil for perioden.",
        "I dk Laun: åpne lønnskjøringen og velg «Les fra CSV-fil inn i lønnskjøring».",
        "Valgfritt: lim inn en tilgangsnøkkel fra dkPlus i samme vindu for å hente omsetningen daglig.",
      ],
    },
    businesscentral: {
      sub: "Microsoft Dynamics 365 og LS Central",
      d: "Omsetningen kommer daglig fra hovedboken, og hver lønnskjøring bokføres som én samlepost i en kladd, som regnskapsføreren bokfører selv.",
      out: ["Lønnsbokføring: lønn, arbeidsgiveravgift, skattetrekk, pensjon, fagforeningskontingent og feriepengegjeld (etter islandsk oppsett)"],
      in: ["Daglig omsetning fra hovedboken"],
      need: ["Tilgang til Azure (Microsoft Entra ID) for å registrere en app", "Tillatelsessett D365 READ (omsetning) eller D365 ACCOUNTANTS (omsetning og lønnsbokføring)"],
      steps: [
        "I Azure: App registrations → New registration, kall den VAKTO. Kopier Application (client) ID og Directory (tenant) ID.",
        "API permissions → Dynamics 365 Business Central → API.ReadWrite.All → Grant admin consent. Lag en client secret.",
        "I Business Central: «Microsoft Entra Applications» → New. Legg inn Client ID, State: Enabled og tillatelsessettet.",
        "I VAKTO: Innstillinger → Integrasjoner → Business Central → Koble til. Deretter «Lønnsbokføring» for å velge kontoene.",
      ],
    },
    excel: {
      sub: "Eksport og import",
      d: "For lønnssystemer som ikke står på listen: lønnskjøringen, timelister og rapporter eksporteres til Excel eller PDF, og omsetning kan leses inn fra en CSV-fil.",
      out: ["Lønnskjøring og timer i Excel", "Rapporter i Excel og PDF"],
      in: ["Omsetning fra en CSV-fil (dato og beløp), f.eks. historikk fra kassesystemet"],
      need: ["Ingenting. Inkludert i alle planer med lønn"],
      steps: [
        "Lønnskjøringer → Eksporter → Excel.",
        "Omsetning: Innstillinger → Integrasjoner → Annet system? → Last opp en fil.",
      ],
    },
    shopify: {
      sub: "Nettbutikk",
      d: "Omsetningen fra ordrer hentes automatisk hver dag, så lønn % av omsetning alltid stemmer. VAKTO leser bare ordrer, aldri kortopplysninger.",
      out: [],
      in: ["Daglig omsetning fra ordrer (90 dagers historikk ved første tilkobling)"],
      need: ["En Shopify-butikk og rettigheter til å lage en app (read_orders)"],
      steps: [
        "I Shopify: Settings → Apps and sales channels → Develop apps → Create an app. Kall den VAKTO.",
        "Configure Admin API scopes: huk av for read_orders og lagre. Klikk Install app.",
        "I VAKTO: Innstillinger → Integrasjoner → Shopify → Koble til. Lim inn butikkadressen og Admin API access token.",
      ],
    },
    woocommerce: {
      sub: "Nettbutikk på WordPress",
      d: "Omsetningen fra ordrer hentes daglig, med en nøkkel som bare har lesetilgang.",
      out: [],
      in: ["Daglig omsetning fra ordrer (90 dagers historikk ved første tilkobling)"],
      need: ["Administratortilgang til WordPress"],
      steps: [
        "I WordPress: WooCommerce → Settings → Advanced → REST API → Add key.",
        "Kall nøkkelen VAKTO, velg Permissions: Read og klikk Generate API key.",
        "I VAKTO: Innstillinger → Integrasjoner → WooCommerce → Koble til. Lim inn adressen, Consumer key og Consumer secret.",
      ],
    },
    inventra: {
      sub: "Produksjon og salg",
      d: "VAKTOs søstersystem for produsenter av ferskvarer. Salget går rett inn som omsetning.",
      out: [],
      in: ["Omsetning fra INVENTRA"],
      need: ["En INVENTRA-konto og en nøkkel fra VAKTO"],
      steps: [
        "I VAKTO: Innstillinger → Integrasjoner → INVENTRA → Lag nøkkel.",
        "Legg inn nøkkelen i INVENTRA. Deretter kommer omsetningen inn automatisk.",
      ],
    },
    api: {
      sub: "Åpent API, Zapier og Make",
      d: "Bruker du et system som ikke står på listen? Send omsetningen rett til VAKTO med en nøkkel, fra egen kode eller via Webhooks i Zapier eller Make.",
      out: [],
      in: ["Omsetning per dag og sted (POST /api/v1/revenue)"],
      need: ["En API-nøkkel fra VAKTO (du kan trekke den tilbake når som helst)"],
      steps: [
        "I VAKTO: Innstillinger → Integrasjoner → Lag nøkkel.",
        "Send POST til /api/v1/revenue med Authorization: Bearer og { date, amount, location }.",
        "I Zapier eller Make: bruk «Webhooks» med samme adresse og nøkkel.",
      ],
    },
    esign: {
      sub: "Elektronisk signering",
      d: "Arbeidsavtaler og avslutning av ansettelse signeres på mobilen. Signering med kode på e-post er alltid inkludert og fungerer for alle; kvalifisert signering med islandsk elektronisk ID går via Taktikal. BankID støttes ikke ennå.",
      out: ["Avtale til signering"],
      in: ["Signert kopi, dokumentets fingeravtrykk og signeringslogg"],
      need: ["Ingenting for kode på e-post", "Elektronisk ID: islandsk elektronisk ID hos begge parter"],
      steps: [
        "I VAKTO: Innstillinger → Regler og lønn → Signering av avtaler. Velg kode på e-post eller elektronisk ID (Taktikal).",
        "Send avtalen fra den ansattes profil. Begge signerer og får den signerte kopien på e-post.",
      ],
    },
    mcp: {
      sub: "Claude, ChatGPT og MCP",
      d: "Spør om vakter, timer og lønn % i din egen AI-app. Bare lesetilgang: appene kan ikke endre noe og får aldri ID-numre, bankkontoer eller adresser.",
      out: ["Vakter, timer, omsetning og lønn % (bare lesing)"],
      in: [],
      need: ["Claude, ChatGPT eller en annen app som støtter MCP-tilkoblinger", "Eieren av bedriften slår på tilkoblede apper"],
      steps: [
        "I VAKTO: Innstillinger → Integrasjoner → Tilkoblede apper → Tillat AI-apper (eier).",
        "Kopier adressen og legg den til som tilkobling (connector) i Claude eller ChatGPT.",
        "Logg inn med VAKTO og godkjenn tilgangen. Du kan koble fra når som helst.",
      ],
    },
    wallet: {
      sub: "Apple Wallet og Google Wallet",
      d: "ID-kortet med bilde, stilling og QR-kode på mobilen. Koden stempler inn på nettbrettet ved inngangen.",
      out: ["ID-kort i Wallet"],
      in: [],
      need: ["En iPhone eller Android-mobil"],
      steps: ["Den ansatte åpner ID-kortet i VAKTO-appen og trykker «Legg til i Wallet»."],
    },
    calendar: {
      sub: "Google, Apple og Outlook",
      d: "Vaktene vises i kalenderen på mobilen og oppdateres av seg selv når planen endres.",
      out: ["Den ansattes vakter som kalenderfeed (ICS)"],
      in: [],
      need: ["En kalender som kan abonnere på en adresse"],
      steps: ["I VAKTO: Planen → Legg vakter i kalenderen → Kopier lenke.", "I kalenderen: legg til en kalender «Fra URL» og lim inn lenken."],
    },
  },
  plannedH: "Kommer snart.", plannedP: "Disse integrasjonene er under arbeid eller på listen vår. Ingen av dem er klare ennå, og vi merker dem ikke som aktive før de fungerer.",
  planned: {
    uniconta: { sub: "Regnskap", d: "Omsetning og lønnsbokføring." },
    h3: { name: "H3 Laun", sub: "Lønn (Island)", d: "Timer rett inn i lønnskjøringen." },
    m365: { name: "Microsoft 365 og Entra ID", sub: "Innlogging", d: "Logg inn med jobbkontoen og hent brukere fra Entra ID." },
    noona: { sub: "Kassesystem og bookinger", d: "Omsetning fra kassen og bookinger for prognosen." },
    dineout: { sub: "Kassesystem og bookinger", d: "Omsetning og bookinger for vaktplanens prognose." },
    regla: { sub: "Regnskap (Island)", d: "Omsetning fra regnskapet." },
    fortnox: { sub: "Regnskap og lønn", d: "Sverige og Norge." },
    nordic: { name: "Nordiske lønnssystemer", sub: "Norge, Sverige og Danmark", d: "Lønn etter nordiske tariffavtaler og koblinger til lønnssystemer der. Vi prioriterer etter hva kundene bruker." },
  },
  askH: "Bruker du et annet system?", askP: "Fortell oss hvilket. Det flest spør om, havner først i køen.", askBtn: "Send oss en linje",
  endH: "Prøv VAKTO med dine systemer.", endP: "14 dagers gratis prøveperiode, ingen binding. De fleste koblinger tar under ett minutt.", endBtn: "Prøv gratis", endPrice: "Se priser",
};

export const nav: NavText = {
  product: "Systemet", contracts: "Avtaler", integrations: "Integrasjoner", price: "Priser", about: "Om oss",
  login: "Logg inn", try: "Prøv gratis", open: "Åpne meny", close: "Lukk meny",
};

export const footer: FootText = {
  desc: "Vaktplan, stemplingsur, lønn og arbeidsavtaler. Og lønn som andel av omsetningen i sanntid. Utviklet på Island, med lønn etter islandske tariffavtaler i dag.",
  product: "Produkt", features: "Funksjoner", showcase: "Bli kjent med VAKTO", contracts: "Avtaler", integrations: "Integrasjoner", price: "Priser", contractors: "For håndverkere", try: "Prøv gratis",
  company: "Selskapet", about: "Om oss", contact: "Kontakt oss", login: "Logg inn",
  legal: "Juridisk", privacy: "Personvern", terms: "Vilkår", cookies: "Informasjonskapsler",
  follow: "Følg oss", copy: "© 2026 BGL Ventures ehf. · org.nr. (Island) 490806-0400", made: "Designet og utviklet på Island",
};

export const consent: ConsentText = {
  text: "Vi bruker informasjonskapsler for å måle hvordan nettstedet brukes og om annonsene våre virker (Google Analytics og Meta). Ingenting settes uten at du tillater det.",
  more: "Mer informasjon", no: "Avslå", yes: "Tillat",
};

export const legalNote = "Denne siden finnes bare på islandsk. Spørsmål på norsk eller engelsk er velkomne på hallo@vakto.is.";

export const meta: MetaText = {
  home: { title: "VAKTO: vaktplan, timeregistrering, stemplingsur og lønn", desc: "Vaktplan, stemplingsur, timeregistrering og lønnskjøring i ett system, med lønn som andel av omsetningen i sanntid. Lønn etter islandske tariffavtaler i dag, norske er på vei. 14 dagers gratis prøveperiode." },
  price: { title: "VAKTO: Priser", desc: "Vaktplanen er gratis for opptil 5 ansatte. Grunnur fra 9 990 ISK i måneden med lønn, app og stemplingsur. Priser i ISK, kontakt oss for pris i NOK. Ingen binding." },
  contractors: { title: "VAKTO Verk: timeregistrering, arbeidsrapporter og godkjenning for håndverkere", desc: "Tidtaking med posisjon på arbeidsstedet, bilder, materialer og kjøring, og kunden godkjenner arbeidsrapporten med ett trykk. For håndverkere og enkeltpersonforetak." },
  about: { title: "VAKTO: Om oss", desc: "VAKTO er laget av en driver som aldri fant et enkelt system for vakter, lønn og ansatte." },
  integrations: { title: "VAKTO: Integrasjoner med Payday, DK, Business Central, Shopify og flere", desc: "Systemene VAKTO kobles til i dag, hvilke data som flyter og hvordan du kobler til, steg for steg. Nordiske lønnssystemer er på vei." },
};
