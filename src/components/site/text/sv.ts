// Svenska texter för den öppna webbplatsen (/sv). Ärlighet först: lön beräknas i dag enligt isländska
// kollektivavtal, Payday och DK är isländska system och priserna är i isländska kronor (ISK).
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

const m = (n: number) => fmtMoney("sv", n);

export const home: HomeText = {
  skip: "Hoppa till innehållet",
  h1a: "Passen, lönerna och överblicken.", h1b: "På ett ställe.",
  lede: "Schema, stämpelklocka, lönekörning och anställningsavtal. Plus lönekostnaden som andel av omsättningen, i realtid.",
  try: "Testa gratis", see: "Se systemet",
  demo: "Testa demon", demoBusy: "Öppnar demon…", demoErr: "Demon är inte tillgänglig just nu – försök igen senare.",
  heroAlt: "VAKTO:s översikt: lön som andel av omsättningen, arbetade timmar och avvikelser",
  videoAlt: "Video: VAKTO i användning. Översikt, ett pass som dras mellan anställda i schemat, tidrapportering och lönekörning.",
  cap1b: "Lön i % av omsättningen.", cap1: " En siffra som visar om passet lönar sig.",
  cap2b: "Grönt, gult eller rött.", cap2: " Räknas fram ur stämplingarna direkt, inte i slutet av månaden.",
  featH: "Allt som passet behöver.",
  dragAlt: "Veckans schema: ett pass dras från en anställd till en annan",
  t1h: "Schemat klart på en kvart.", t1p: "Dra pass, kopiera förra veckan eller be AI:n om ett schema som passar omsättningsprognosen. Lönekostnaden räknas medan du jobbar.",
  t2h: "Stämpla i mobilen.", t2p: "Eller på en surfplatta vid entrén. Platsen bekräftas om du vill.", t2alt: "VAKTO-appen: på pass sedan 05:38, stämpla ut",
  t3h: "Avvikelser i kronor.", t3p: "Vem kom sent, vem gick tidigt och vad det kostade.", t3alt: "Tidrapportering med avvikelser",
  t4h: "Lön enligt kollektivavtal.", t4p: "OB, övertid och tillägg räknas ut enligt isländska avtal, direkt till Payday eller DK (Island). Svenska kollektivavtal och lönesystem är på väg.", t4alt: "Månadens lönekörning",
  t5h: "Surfplatta vid entrén.", t5p: "Personalen trycker på sitt namn och slår in sin kod, eller skannar personalkortet i mobilen. Alla ser vem som jobbar, och stämplingen går rakt in i tidrapporten.", t5alt: "Stämpelklockan på en surfplatta: all personal och vem som är på pass",
  t6h: "Chatt för hela gänget.", t6p: "Kanaler per avdelning och plats. Ingen Messenger-grupp med gammal personal kvar i.", t6alt: "Chattkanaler i VAKTO-appen",
  darkH: "Snyggt i dagsljus. Även på nattpasset.", darkP: "Systemet följer enhetens inställning. Dra för att jämföra.",
  cmpAria: "Jämför ljust och mörkt", cmpLight: "Schemat i ljust läge", cmpDark: "Schemat i mörkt läge",
  appAlt: "Appen i mörkt läge: på pass", appH: "Personalen får appen.",
  storePlay: "Ladda ned på Google Play", storeApple: "Hämta i App Store", storeSoon: "",
  appP: "Passen, stämpling, beräknad lön, semestersaldo, ledighet och passbyten. Plus chatt och nyhetsflöde för hela gänget.",
  appTicks: ["iPhone och Android", "Isländska, engelska, polska och vietnamesiska", "En notis när schemat ändras"],
  feedAlt: "Nyhetsflödet i appen",
  showH: "Lär känna VAKTO.", showRole: "bildspel", slideRole: "bild", of: "av", slideN: "Bild", pause: "Pausa", play: "Spela",
  slides: [
    { t: "Rapporter som spelar roll.", d: "Lön i % av omsättningen per månad, kostnad per avdelning, övertid, sjukfrånvaro och närvaro. Ladda ned i Excel eller PDF, eller be VAKTO AI om rapporten.", alt: "Insikter i VAKTO: lönen 31,1 % av omsättningen i oktober, omsättning 19,3 milj. ISK och lönekostnad 6,0 milj. ISK" },
    { t: "Passen i fickan.", d: "Personalen ser sitt schema, söker lediga pass och erbjuder pass att byta. Chatten finns på samma ställe.", alt: "Veckans pass i appen", alt2: "Chattkanaler i appen" },
    { t: "Ett nyhetsflöde för arbetsplatsen.", d: "Ny meny, ändrade öppettider, en bild från köket. Fäst det viktiga överst så att det inte försvinner.", alt: "Nyhetsflödet i appen" },
    { t: "En lönespecifikation som håller.", d: "Grundlön, OB och övertid specificerat. Även när månaden blev noll timmar och den anställda behöver ett intyg.", alt: "Lönespecifikation från VAKTO" },
  ],
  hey: {
    eyebrow: "VAKTO AI", h: "Hej VAKTO, …", lede: "Säg vad som behöver göras, som till en arbetsledare. VAKTO AI läser dina data, svarar med dina siffror och förbereder ändringen.",
    pre: "Hej VAKTO,",
    groups: [
      { h: "Schema", items: [
        { q: "gör nästa veckas schema för köket. Alla får minst två lediga dagar och det är alltid tre på pass.", a: "Lägger upp veckan för köket: tre på pass varje dag och alla har minst två lediga dagar. Andra avdelningar lämnas som de är." },
        { q: "lägg ut lediga pass varje dag nästa vecka mellan 17 och 23.", a: "Skapar sju lediga pass. Personalen får en notis och söker i appen." },
        { q: "godkänn Annas ledighetsansökan.", a: "Hittar ansökan, visar dagarna och godkänner. Anna får en notis." },
      ] },
      { h: "Personal", items: [
        { q: "vem har inte dykt upp i dag?", a: "Visar vilka på dagens schema som inte har stämplat in, och hur sena de är." },
        { q: "Jón glömde stämpla ut. Sätt utstämpling kl. 23:00.", a: "Sätter Jóns utstämpling kl. 23:00 och tidrapporten blir rätt." },
        { q: "skicka anställningsavtalet till Pétur Karlsson igen.", a: "Skickar signeringsbegäran till Péturs e-post igen." },
      ] },
      { h: "Siffror", items: [
        { q: "varför var lön i % högre i september än i augusti?", a: "Jämför månaderna: omsättning, timmar, övertid och OB, och pekar ut de viktigaste orsakerna." },
        { q: "vem jobbade mest övertid den här månaden?", a: "Rangordnar personalen efter övertidstimmar och vad de kostade." },
        { q: "säg till om någon går över 180 timmar den här månaden.", a: "Lägger upp en bevakning: du får ett mejl vid 90 % och igen om någon går över, schemat inräknat." },
        { q: "skicka mig en övertidsrapport varje måndag.", a: "Förra veckans rapport landar i inkorgen kl. 8 på måndagar, med en Excel-fil." },
      ] },
    ],
    confirmB: "Inget ändras utan dig.", confirm: " VAKTO AI frågar alltid innan något ändras. Du ser förslaget och trycker på Bekräfta.",
    who: "För chefer och arbetsledare. Från 25 frågor i månaden, beroende på plan.",
    videoAlt: "Video: VAKTO AI lägger upp ett schema för köket och chefen bekräftar förslaget.",
    shotAlt: "Förslag från VAKTO AI: Moon flyttas till lördagens kvällspass, lönekostnaden oförändrad på 27,4 %",
  },
  visit: {
    h: "Boka en demo online.", p: "Vi visar VAKTO i ett videomöte för dig och dina chefer, och svarar på frågor om hur det fungerar i Sverige. Gratis och utan förpliktelser.",
    name: "Namn", company: "Företag", contact: "Telefon eller e-post", message: "Meddelande (valfritt)", messagePh: "T.ex. vilken tid som passar, antal anställda eller ställen",
    send: "Boka en demo", sending: "Skickar…", okH: "Tack, vi har fått din förfrågan.", ok: "Vi hör av oss snart för att hitta en tid.",
    err: "Det gick inte att skicka – mejla hallo@vakto.is.", bot: "Ett ögonblick, robotskyddet laddas.",
  },
  conH: "Ett avtal på en minut, signerat på nästa.",
  conP: "VAKTO fyller i anställningsavtalet med den anställdas uppgifter, enligt den isländska arbetsmarknadsmyndighetens mall. Båda signerar i mobilen och får en signerad kopia via mejl. Svenska avtalsmallar är på väg.",
  conTicks: ["Följer den isländska mallen, på isländska och engelska", "Signering med kod via mejl, eller isländsk e-legitimation", "Dokumentets fingeravtryck och signeringslogg medföljer", "Lönespecar och tidrapporter i samma stil"],
  conAlt: "Första sidan av ett anställningsavtal: Kaffi Krónan anställer Ha Vu", stamp: "Signerat elektroniskt",
  passLbl: "ANSTÄLLD", passRole: "ROLL", passRoleV: "Servitör", passKt: "ID-NUMMER", passNo: "NR", passFoot: "VAKTO-4132-KK · skanna vid stämpelklockan",
  walH: "Personalkortet finns i mobilen.",
  walDone: "Klar",
  walP: "I Apple och Google Wallet, med foto, roll och QR-kod. Koden stämplar in på surfplattan vid entrén, ingen PIN behövs.",
  sisH: "Från samma verkstad.", sisP: "BGL Ventures, företaget bakom VAKTO, bygger också INVENTRA: ett affärssystem med AI som minskar svinnet hos producenter av färskvaror.", sisGo: "inventra.is",
  priceH: "Schemat är gratis.", amt: "0 ISK", per: "/mån",
  price1: "Gratis för schemaläggning.", price2: `Grunnur från ${m(getPlan("grunnur").base)}/mån.`,
  fine: "Exkl. moms. Priser i isländska kronor (ISK). Du betalar bara för dem som jobbade under månaden. 14 dagars gratis provperiod, ingen bindningstid.", seePrice: "Se priser",
};

export const pricing: PricingText = {
  metaTitle: "VAKTO: Priser",
  metaDesc: `Schemat är gratis för upp till 5 anställda. Grunnur från ${m(getPlan("grunnur").base)} i månaden med lön, app och stämpelklocka. Öppna priser i ISK, ingen bindningstid.`,
  skip: "Hoppa till innehållet",
  eyebrow: "Priser",
  h1a: "Schemat är gratis.", h1b: "Lönen räknar sig själv.",
  lede: "Börja gratis. Välj plan efter storlek och betala bara för dem som jobbade under månaden. Ingen bindningstid, inga dolda avgifter.",
  localNote: "Priserna är i isländska kronor (ISK). Vi har inga priser i SEK ännu – hör av dig så tar vi fram ett pris för ditt företag.",
  billing: "Betalningsperiod", monthly: "Månadsvis", yearly: "Årsvis", save: "−15%",
  perMo: "ISK/mån", vat: "Exkl. moms",
  yearlyNote: (mm, n) => `Betalas årsvis: ${mm(n)} per år`,
  popular: "Populärast",
  aiLine: (q) => `VAKTO AI, ${q} frågor i månaden`,
  plans: {
    free: {
      name: "Gratis", for: "För de allra minsta ställena. Bara schemat.",
      inc: (_m, n) => `Upp till ${n} anställda · 1 ställe · på webben`,
      btn: "Börja gratis", href: "/nyskraning?plan=free",
      f: [["Schema på webben", 1], ["Dela schemat som PDF eller länk", 1], ["Pass via mejl", 1], ["App för personalen", 0], ["Stämpelklocka", 0], ["Chatt, förfrågningar och nyhetsflöde", 0], ["Lön och avtal", 0], ["VAKTO AI", 0]],
    },
    grunnur: {
      name: "Grunnur", for: "Kaféer, bagerier och små butiker.",
      inc: (mm, n, x) => `${n} anställda ingår · +${mm(x)} per extra`,
      btn: "Testa gratis i 14 dagar", href: "/nyskraning?plan=grunnur",
      f: [["Allt i Gratis, plus:", 2], ["App för personalen", 1], ["Stämpelklocka i mobil och surfplatta", 1], ["Chatt, förfrågningar och nyhetsflöde", 1], ["Lönekörning, lönespecar och Payday (Island)", 1], ["Avtal med e-signering", 1], ["Lön i % av omsättningen och rapporter", 1]],
    },
    voxtur: {
      name: "Vöxtur", for: "Restauranger och butiker med fler pass.",
      inc: (mm, n, x) => `${n} anställda ingår · +${mm(x)} per extra`,
      btn: "Testa gratis i 14 dagar", href: "/nyskraning?plan=voxtur",
      f: [["Allt i Grunnur, plus:", 2], ["Fler ställen och avdelningar", 1], ["AI lägger schemat", 1], ["Bevakningar och rapporter via mejl", 1], ["Arbetsintyg och avslut av anställning", 1]],
    },
    rekstur: {
      name: "Rekstur", for: "Hotell, kedjor och större arbetsplatser.",
      inc: (mm, n, x) => `${n} anställda ingår · +${mm(x)} per extra`,
      btn: "Prata med oss", href: "mailto:hallo@vakto.is?subject=VAKTO%20Rekstur",
      f: [["Allt i Vöxtur, plus:", 2], ["Prioriterad support", 1], ["Hjälp med uppstarten", 1], ["Egna lönereglar", 1], ["En fast kontaktperson på VAKTO", 1]],
    },
  },
  under: [
    "Aktiv anställd = hade ett pass eller stämplade in under månaden. Du betalar inte för dem som inte jobbade.",
    "14 dagars gratis provperiod på Vöxtur. Ingen bindningstid. Inget kort för Gratis.",
  ],
  quote: (n) => `Fler än ${n} anställda?`, quoteGo: "Vi tar fram en offert",

  calcH: "Vad kostar VAKTO för dig?", calcP: "Dra i reglagen och se vilken plan som passar och vad den kostar i månaden.",
  empL: "Aktiva anställda under månaden", aiL: "Frågor till VAKTO AI i månaden",
  aiHint: "De flesta kaféer och restauranger frågar VAKTO AI 10–40 gånger i månaden.",
  yourPlan: "Billigaste planen för dig", perMonth: "i månaden exkl. moms", perEmp: (s) => `${s} per anställd`,
  rowBase: (name, yearly) => `${name}${yearly ? " (betalas årsvis)" : ""}`,
  rowExtra: (n, mm, x) => `${n} extra anställda × ${mm(x)}`,
  rowAi: (n) => `${n} × ${AI_PACK.questions} AI-frågor`,
  freeNote: "Gratis räcker: upp till 5 anställda och ingen VAKTO AI.",
  overQuote: (n) => `Över ${n} anställda tar vi fram en offert. Siffran visar listpriset.`,
  crossH: "När lönar det sig att gå upp en nivå?",
  cross: (a, b) => `Från ungefär ${a} anställda är Vöxtur billigare än Grunnur, och från ungefär ${b} är Rekstur billigare än Vöxtur.`,

  addH: "Betala bara för det du använder.", addP: "Inga överraskningar på fakturan. Du bestämmer själv vad som läggs till.",
  adds: {
    emp: { h: "Fler anställda", p: (mm, lo) => `från ${mm(lo)}`, d: "per aktiv anställd utöver det som ingår i planen. Sommarpersonal kostar ingenting de månader de inte jobbar." },
    ai: { h: "Mer VAKTO AI", p: (mm, x) => mm(x), d: (q) => `för varje ${q} extra frågor. Bara om en chef slår på tillägget, med ett månadstak som hen själv sätter.` },
    sign: { h: "E-legitimation", p: (mm, x) => mm(x), d: "per signatur med isländsk e-legitimation. Signering med kod via mejl ingår alltid." },
    year: { h: "Årsbetalning", p: () => "−15%", d: "på grundpriset och priset per anställd om du betalar för hela året i förväg." },
  },

  cmpH: "Vad som ingår i varje plan.", cmpHint: "Svep i sidled för att se alla planer.",
  yes: "Ingår", no: "Ingår inte",
  cmp: [
    { g: "Pris", rows: "price" as const },
    { g: "Pass och tid", rows: [
      ["Schema på webben", 1, 1, 1, 1],
      ["Dela schemat som PDF eller länk", 1, 1, 1, 1],
      ["Pass via mejl", 1, 1, 1, 1],
      ["App för personalen (isländska, engelska, vietnamesiska)", 0, 1, 1, 1],
      ["Stämpelklocka i mobil och surfplatta", 0, 1, 1, 1],
      ["Fler ställen och avdelningar", 0, 0, 1, 1],
      ["AI lägger schemat", 0, 0, 1, 1],
    ] },
    { g: "Lön och avtal", rows: [
      ["Lönekörning enligt isländska kollektivavtal", 0, 1, 1, 1],
      ["Lönespecar och koppling till Payday (Island)", 0, 1, 1, 1],
      ["Anställningsavtal med e-signering", 0, 1, 1, 1],
      ["Arbetsintyg och avslut av anställning", 0, 0, 1, 1],
      ["Egna lönereglar", 0, 0, 0, 1],
    ] },
    { g: "Kommunikation och insikt", rows: [
      ["Chatt, förfrågningar och nyhetsflöde", 0, 1, 1, 1],
      ["Lön i % av omsättningen och rapporter", 0, 1, 1, 1],
      ["Bevakningar och rapporter via mejl", 0, 0, 1, 1],
    ] },
    { g: "Support", rows: [
      ["Hjälp via chatt och mejl", 1, 1, 1, 1],
      ["Prioriterad support", 0, 0, 0, 1],
      ["Hjälp med uppstarten", 0, 0, 0, 1],
      ["En fast kontaktperson på VAKTO", 0, 0, 0, 1],
    ] },
  ],
  cmpBase: "Grundpris i månaden", cmpInc: "Anställda som ingår", cmpExtra: "Varje extra anställd", cmpAi: "VAKTO AI, frågor i månaden",
  cmpMax: (n) => `upp till ${n}`, cmpFree: "0 ISK", cmpNone: "Inte möjligt",

  faqH: "Vanliga frågor.",
  faq: (mm) => [
    ["Vad räknas som en aktiv anställd?", "En anställd som hade ett pass eller stämplade in under månaden. Registrerad personal som inte jobbar, till exempel sommarpersonal på vintern, kostar ingenting de månaderna."],
    ["Fungerar lönekörningen med svenska kollektivavtal?", "Inte än. I dag räknar VAKTO lön enligt isländska kollektivavtal och kopplar till isländska lönesystem. Svenska avtal och lönesystem är på väg. Schema, stämpelklocka, chatt och tidrapporter fungerar redan, och tiderna kan exporteras till Excel."],
    ["Kan jag byta plan?", "Ja, när som helst under Inställningar, upp eller ned. Om ni blir fler säger VAKTO till när nästa plan blir billigare."],
    ["Vad händer när AI-frågorna tar slut?", `VAKTO AI vilar till nästa månadsskifte. Allt annat fungerar som vanligt. En chef kan slå på tillägget, ${mm(AI_PACK.price)} för varje ${AI_PACK.questions} frågor, och sätta ett månadstak så att fakturan aldrig överraskar.`],
    ["Finns det någon bindningstid?", "Nej. Du säger upp under Inställningar och abonnemanget gäller perioden ut. Årsbetalning ger 15 % rabatt."],
    ["Är Gratis verkligen gratis?", "Ja. För upp till 5 anställda på ett ställe, utan tidsgräns och utan kort. Du får schemat på webben, kan dela det som PDF eller länk och personalen får sina pass via mejl. App, stämpelklocka och lön ingår från Grunnur."],
    ["Varför är priserna i ISK?", "VAKTO kommer från Island och priserna sätts i isländska kronor. Vi har inga priser i SEK ännu. Hör av dig till hallo@vakto.is så tar vi fram ett pris för ditt företag."],
    ["Hur fungerar provperioden?", "I 14 dagar får du allt som ingår i Vöxtur, gratis. När perioden är slut väljer du plan, eller går över till Gratis om det räcker."],
  ],

  endH: "Börja gratis i dag.", endP: "Inget kort. Lägg upp ditt första schema på tio minuter.", endBtn: "Skapa konto",
  endOr: "Frågor om priser? ", fine: "Alla priser är i isländska kronor (ISK), per månad och exkl. moms. Priser i SEK på förfrågan.",
};

export const about: AboutText = {
  h1: "Jag byggde systemet jag själv saknade.", by: "Bjarni Lúðvíksson, grundare av VAKTO", alt: "Bjarni Lúðvíksson, grundare av VAKTO",
  lead1: "Jag har drivit verksamhet inom många områden: restauranger, ett produktionskök, turism och gästhus. I inget av dem hittade jag ett riktigt system som passade och var enkelt att använda, både för mig och för personalen.",
  lead2: "VAKTO är svaret på det som irriterade mig i åratal.",
  painsAria: "Det VAKTO löser",
  pains: [
    ["Anställningsavtal försvann.", "Nu skapas avtalet ur den anställdas uppgifter, båda signerar elektroniskt och den signerade kopian sparas på ett ställe."],
    ["Personalkorten glömdes bort.", "Inte så bra när inspektörer dyker upp. Nu har alla kortet i mobilen, i Apple och Google Wallet."],
    ["Regler och HACCP nådde inte alla.", "Nu finns de i fickan hos all personal, lätta att hitta och läsa."],
    ["Övertiden syntes först vid månadsskiftet.", "Nu ser jag lönen som andel av omsättningen och avvikelser direkt, och den verkliga kostnaden i realtid när schemat inte följs."],
    ["Kollektivavtal och villkor tog tid.", "Nu hjälper AI till att hitta rätt isländskt kollektivavtal och formulera villkor professionellt. De går rakt in i anställningsavtalet, som signeras elektroniskt."],
  ],
  quote: "”Alldeles för ofta upptäckte jag all personalens övertid först när månaden skulle stängas. Det är historia nu.”",
  ctaH: "Testa VAKTO i din verksamhet.", ctaP: "14 dagar gratis, ingen bindningstid. Eller skicka mig en rad på ", try: "Testa gratis",
};

export const contractors: VerkText = {
  eyebrow: "VAKTO Verk · pass och uppdrag",
  h1: ["Jobbet, timmarna", "och godkännandet.", "I en app."],
  lede: "Starta tidtagningen på plats, ta bilder och registrera material. Kunden godkänner arbetsrapporten med ett tryck, och bråken om timmarna är ett minne blott.",
  cta: "Testa gratis i 14 dagar",
  priceNote: (mm) => `${mm} i månaden · ingen bindningstid`,
  phone: { top: "Jobb", live: "Tidtagning pågår", job: "Badrum · Laugavegur 5", geo: "Bekräftad på plats", stop: "Stoppa", month: "Den här månaden", monthV: "86,5 h", open: "Öppna jobb", jobs: [["Kök, Kópavogur", "Anna Jónsdóttir · 12,0 h"], ["Elinstallation, Grafarholt", "Byggás ehf. · 31,5 h"]] },
  float1: ["Godkänd", "Anna Jónsdóttir · i dag 16:42"], float2: "3 bilder i rapporten",
  painQ: ["”Jag jobbade mycket mer än så.”", "”Jag betalar inte för timmar jag inte har sett.”"],
  painP: "De flesta hantverkare känner igen samtalet. Timmarna sitter i huvudet, kvittona i handskfacket och bilderna är borta någonstans i mobilen. VAKTO Verk samlar ihop allt medan du jobbar, och kunden ser allt innan fakturan går iväg.",
  stepsEyebrow: "Så funkar det", stepsH: ["Tre steg.", "Inget pappersarbete."],
  steps: [
    ["Starta på plats", "Öppna jobbet och tryck på Starta. Mobilen registrerar tiden och bekräftar platsen."],
    ["Registrera medan du jobbar", "Bilder, material, utlägg och körsträcka hamnar direkt på jobbet, på några sekunder."],
    ["Skicka för godkännande", "Välj period och skicka en länk. Kunden godkänner och du vet att fakturan blir betald."],
  ],
  apprEyebrow: "Det kunden ser", apprH: ["Öppenhet som", "bygger förtroende."],
  apprLede: "Ingen inloggning, ingen app. Kunden öppnar länken, ser varje tidregistrering med bekräftelse på plats, bilderna, materialet och beloppen – och godkänner. Du ser godkännandet i VAKTO direkt.",
  apprTicks: ["Timmar med bekräftelse på plats", "Arbete, material och moms specificerat", "Isländsk momsåterbetalning på arbete beräknad åt husägaren", "Namn och tid för godkännandet registreras"],
  doc: {
    from: "Arbetsrapport från", company: "Jón Rafvirki ehf.", status: "Väntar på godkännande", title: "Badrum, Laugavegur 5", period: "1–31 oktober",
    k: [["24,5 h", "Arbete"], ["38 km", "Körning"], ["402 169 ISK", "Totalt inkl. moms"]],
    rows: [["Arbete (24,5 h × 9 500 ISK)", "232 750 ISK"], ["Material", "91 580 ISK"], ["Moms 24 %", "77 839 ISK"]],
    total: ["Totalt", "402 169 ISK"], refund: ["Momsåterbetalning på arbete i bostad (Island): cirka", "19 551 ISK"],
    approve: "Godkänn", fix: "Be om ändring",
  },
  featEyebrow: "Allt en hantverkare behöver", featH: ["Byggt för arbete", "ute på plats."],
  features: [
    { t: "Tidtagning på plats", p: "Tryck på Starta när du kommer fram. Mobilen bekräftar att du är på plats, och kunden ser det i rapporten." },
    { t: "Bilder och anteckningar", p: "Ta en bild före och efter. Bilderna hamnar i arbetsrapporten automatiskt, inget letande i kamerarullen." },
    { t: "Godkännande med ett tryck", p: "Kunden får en länk, ser timmar, material, bilder och belopp, och godkänner. Namn och tid registreras." },
    { t: "Material, utlägg och körning", p: "Registrera material och utlägg på jobbet och kilometer vid varje tidtagning. Allt summeras åt dig." },
    { t: "35 % momsåterbetalning beräknad", p: "Arbete och material särredovisas i rapporten, så att husägaren ser hur mycket moms på arbetet som betalas tillbaka.", tag: "Endast Island" },
    { t: "Kunderna på ett ställe", p: "Varje kund med sina jobb, offerter, timmar, fakturerat och obetalt, och anteckningar. Du ser direkt vad som återstår att fakturera." },
    { t: "Ett team när du växer", p: "Lägg till en anställd eller underentreprenör. Alla registrerar sina timmar, du ser allt och skickar en rapport." },
    { t: "Offerter och arbetsavtal", p: "Skicka en offert som kunden godkänner som avtal med sitt namn. En godkänd offert blir automatiskt ett jobb." },
    { t: "Fakturor i Payday", p: "Ett tryck: en faktura för jobbet skapas i ditt Payday-konto, med arbete och material specificerat, och skickas till kunden.", tag: "Endast Island" },
    { t: "VAKTO AI för dina jobb", p: "Beskriv jobbet så skriver AI:n ett utkast till offert. Fråga ”hur mycket jobbade jag åt Jón i oktober?” eller ”vad har jag kvar att fakturera?”." },
  ],
  priceEyebrow: "Pris", planName: "Verktaki", perMonth: "i månaden exkl. moms",
  inc: (x) => `En användare ingår. Varje extra användare ${x}.`,
  ticks: (ai) => ["Obegränsat med jobb och kunder", "Tidtagning med bekräftelse på plats", "Bilder, material, utlägg och körning", "Arbetsrapporter och kundens godkännande", "App för iPhone och Android, plus webben", "Offerter, kundöversikt och fakturor i Payday (Island)", `VAKTO AI, ${ai} frågor i månaden`],
  fine: "Ingen bindningstid. Driver du ett företag med skiftarbete?", fineLink: "Se planer för företag",
  faqH: "Frågor och svar",
  faq: [
    ["Vem är VAKTO Verk för?", "Hantverkare, entreprenörer och enskilda firmor som tar betalt per timme eller per jobb: elektriker, snickare, rörmokare, målare, trädgård, städ, IT och konsulter. Från en person till ett litet team."],
    ["Behöver kunden ett konto?", "Nej. Kunden får en länk via mejl eller sms, öppnar rapporten i mobilen och godkänner eller ber om en ändring."],
    ["Spåras min position hela tiden?", "Nej. Platsen läses bara när du startar och stoppar tidtagningen, för att bekräfta att du var på plats. Ingen löpande spårning."],
    ["Kan jag använda det på datorn också?", "Ja. Allt i appen finns också på vakto.is: jobb, timmar, material, bilder och rapporter."],
    ["Fungerar momsen för Sverige?", "Rapporten räknar i dag med isländsk moms och priserna är i ISK. Svenska momssatser och SEK är inte på plats än. Hör av dig om du vill vara med tidigt."],
    ["Fungerar det med Payday?", "Ja, på Island. Koppla Payday under Inställningar och skapa en faktura för ett jobb med ett tryck. Fakturan skapas i ditt Payday-konto och mejlas till kunden. Svenska fakturasystem är inte kopplade än."],
    ["Finns det någon bindningstid?", "Nej. 14 dagars gratis provperiod och sedan ett månadsabonnemang som du kan säga upp när som helst."],
  ],
  finalH: ["Mindre pappersarbete.", "Fler godkända fakturor."], finalCta: "Börja gratis",
};

export const integrations: TengText = {
  eyebrow: "Integrationer",
  h1: ["Fungerar med systemen", "du redan använder."],
  lede: "Så här ser listan ut i dag: systemen som VAKTO verkligen kopplar till, vilka data som flyttas och hur du kopplar dem. Det som fortfarande är på gång är märkt så.",
  regionNote: "Lönen i VAKTO följer i dag isländska kollektivavtal, och lönesystemen nedan är isländska. Lön för Sverige, Danmark och Norge är på väg. Schema, stämpelklocka, chatt och tidrapporter fungerar redan överallt.",
  jump: "Se alla integrationer",
  edgeEyebrow: "Mer än en export", edgeH: ["De flesta schemaverktyg exporterar timmar.", "VAKTO räknar ut lönen."],
  edgeP: "En koppling till lönesystemet är bra, men det är bara sista steget. VAKTO tar hand om allt före det, så att det som landar i lönen redan är rätt.",
  edge: [
    ["Lön enligt kollektivavtal", "Grundlön, övertid, OB, semesterersättning och tillägg räknas ur stämplingarna, enligt varje anställds avtal. I dag isländska avtal."],
    ["Lönespecifikationer", "Personalen ser sin lönespec och beräknad lön i appen, specificerat."],
    ["Anställningsavtal", "Avtalet fylls i med den anställdas uppgifter och signeras elektroniskt i mobilen."],
    ["Chatt och nyhetsflöde", "Kanaler per avdelning och plats, plus nyheter för hela gänget, i samma app som passen."],
    ["VAKTO AI", "Lägger schemat, svarar med dina siffror och frågar alltid innan något ändras."],
  ],
  live: "I drift", soon: "Kommer snart",
  outL: "Från VAKTO", inL: "In i VAKTO", needL: "Du behöver", stepsL: "Så kopplar du",
  cats: {
    pay: { h: "Lön och bokföring", p: "VAKTO räknar ut lönen. Lönesystemet sköter fortfarande skatt, deklarationer och utbetalningar." },
    rev: { h: "Omsättning", p: "Lön som andel av omsättningen kräver omsättningssiffror. De kommer in automatiskt från kassan, webbutiken eller bokföringen." },
    docs: { h: "Avtal och signering", p: "Anställningsavtal och avslut signeras elektroniskt, utan papper." },
    ai: { h: "AI och utvecklare", p: "Koppla dina egna verktyg, med nycklar som du styr över." },
    staff: { h: "För personalen", p: "Passen och personalkortet där personalen redan finns: i mobilen." },
  },
  items: {
    payday: {
      sub: "Lön och bokföring (Island)",
      d: "Godkända timmar går rakt in i en lönekörning i Payday som tidrapport, med ett klick. VAKTO Verk skapar också fakturor i Payday.",
      out: ["Timmar per anställd: grundlön, övertid och OB per procentsats", "Fakturor för jobb (VAKTO Verk)"],
      in: [],
      need: ["Ett Payday-konto med API-åtkomst (Client ID och Client Secret)", "Lönearter i Payday med samma namn som i VAKTO (Dagvinna, Yfirvinna, Álag 33% …)"],
      steps: [
        "I Payday: Inställningar → Företag → API. Skapa en åtkomst och döp den till VAKTO.",
        "I VAKTO: Inställningar → Integrationer → Payday → Koppla. Klistra in Client ID och Client Secret.",
        "Under Lönekörningar visas nu ”Skicka till Payday”. Periodens godkända timmar går in som tidrapport.",
        "Hellre en fil? Lönekörningar → Exportera → Payday ger en Excel-fil som Payday kan läsa in.",
      ],
    },
    dk: {
      sub: "dk Laun och dkPlus (Island)",
      d: "Timmarna går in i en lönekörning i dk Laun via CSV-import, uppdelade per löneart och avdelning. Omsättningen kan komma in automatiskt från bokföringen i dkPlus.",
      out: ["CSV för lönekörning i dk Laun: ID-nummer, avdelning och timmar per löneart"],
      in: ["Daglig omsättning från bokföringens intäktskonton (dkPlus, valfritt)"],
      need: ["Löneartsnummer i dk Laun (grundlön, övertid, varje OB-tillägg)", "Avdelningsnummer om du fördelar lönen på avdelningar", "En åtkomstnyckel i dkPlus om omsättningen ska komma in automatiskt"],
      steps: [
        "I VAKTO: Inställningar → Integrationer → DK → Ställ in. Fyll i löneart- och avdelningsnummer från dk Laun.",
        "Lönekörningar → Exportera → DK laddar ned en CSV-fil för perioden.",
        "I dk Laun: öppna lönekörningen och välj ”Läs från CSV-fil till lönekörning”.",
        "Valfritt: klistra in en åtkomstnyckel från dkPlus i samma fönster för att hämta omsättningen varje dag.",
      ],
    },
    businesscentral: {
      sub: "Microsoft Dynamics 365 och LS Central",
      d: "Omsättningen hämtas varje dag från huvudboken, och varje lönekörning bokförs som en sammanfattande verifikation i en journal, som din redovisningskonsult bokför.",
      out: ["Lönebokföring: löner, lönebikostnader, preliminärskatt, pensionsfonder, fackavgifter, socialavgifter och semesterlöneskuld"],
      in: ["Daglig omsättning från huvudboken"],
      need: ["Åtkomst till Azure (Microsoft Entra ID) för att registrera en app", "Behörighetsuppsättningen D365 READ (omsättning) eller D365 ACCOUNTANTS (omsättning och lönebokföring)"],
      steps: [
        "I Azure: App registrations → New registration, döp den till VAKTO. Kopiera Application (client) ID och Directory (tenant) ID.",
        "API permissions → Dynamics 365 Business Central → API.ReadWrite.All → Grant admin consent. Skapa en client secret.",
        "I Business Central: ”Microsoft Entra Applications” → New. Ange Client ID, State: Enabled och behörighetsuppsättningen.",
        "I VAKTO: Inställningar → Integrationer → Business Central → Koppla. Sedan ”Lönebokföring” för att välja konton.",
      ],
    },
    excel: {
      sub: "Export och import",
      d: "För lönesystem som inte finns på listan: lönekörningen, tidrapporter och rapporter exporteras till Excel eller PDF, och omsättningen kommer in från en CSV-fil.",
      out: ["Lönekörning och timmar i Excel", "Rapporter i Excel och PDF"],
      in: ["Omsättning från en CSV-fil (datum och belopp), t.ex. historik från kassan"],
      need: ["Ingenting. Ingår i alla planer med lön"],
      steps: [
        "Lönekörningar → Exportera → Excel.",
        "Omsättning: Inställningar → Integrationer → Annat system? → Ladda upp en fil.",
      ],
    },
    shopify: {
      sub: "Webbutik",
      d: "Omsättningen från ordrar hämtas automatiskt varje dag, så att lön i % av omsättningen alltid stämmer. VAKTO läser bara ordrar, aldrig kortuppgifter.",
      out: [],
      in: ["Daglig omsättning från ordrar (90 dagars historik vid första kopplingen)"],
      need: ["En Shopify-butik och behörighet att skapa en app (read_orders)"],
      steps: [
        "I Shopify: Settings → Apps and sales channels → Develop apps → Create an app. Döp den till VAKTO.",
        "Configure Admin API scopes: kryssa i read_orders och spara. Klicka på Install app.",
        "I VAKTO: Inställningar → Integrationer → Shopify → Koppla. Klistra in butikens adress och Admin API access token.",
      ],
    },
    woocommerce: {
      sub: "Webbutik på WordPress",
      d: "Omsättningen från ordrar hämtas varje dag, med en nyckel som bara har läsrättighet.",
      out: [],
      in: ["Daglig omsättning från ordrar (90 dagars historik vid första kopplingen)"],
      need: ["Administratörsåtkomst till WordPress"],
      steps: [
        "I WordPress: WooCommerce → Settings → Advanced → REST API → Add key.",
        "Döp nyckeln till VAKTO, välj Permissions: Read och klicka på Generate API key.",
        "I VAKTO: Inställningar → Integrationer → WooCommerce → Koppla. Klistra in adressen, Consumer key och Consumer secret.",
      ],
    },
    inventra: {
      sub: "Produktion och försäljning",
      d: "VAKTO:s systersystem för producenter av färskvaror. Försäljningen går rakt in som omsättning.",
      out: [],
      in: ["Omsättning från INVENTRA"],
      need: ["Ett INVENTRA-konto och en nyckel från VAKTO"],
      steps: [
        "I VAKTO: Inställningar → Integrationer → INVENTRA → Skapa nyckel.",
        "Lägg in nyckeln i INVENTRA. Därefter kommer omsättningen in automatiskt.",
      ],
    },
    api: {
      sub: "Öppet API, Zapier och Make",
      d: "Använder du ett system som inte finns på listan? Skicka omsättningen direkt till VAKTO med en nyckel, från din egen kod eller via Webhooks i Zapier eller Make.",
      out: [],
      in: ["Omsättning per dag och ställe (POST /api/v1/revenue)"],
      need: ["En API-nyckel från VAKTO (du kan återkalla den när som helst)"],
      steps: [
        "I VAKTO: Inställningar → Integrationer → Skapa nyckel.",
        "Skicka POST till /api/v1/revenue med Authorization: Bearer och { date, amount, location }.",
        "I Zapier eller Make: använd ”Webhooks” med samma adress och nyckel.",
      ],
    },
    esign: {
      sub: "Elektronisk signering",
      d: "Anställningsavtal och avslut signeras i mobilen. Signering med kod via mejl ingår alltid och fungerar för alla; kvalificerad signering med isländsk e-legitimation går via Taktikal. BankID stöds inte än.",
      out: ["Avtal för signering"],
      in: ["Signerad kopia, dokumentets fingeravtryck och signeringslogg"],
      need: ["Ingenting för kod via mejl", "E-legitimation: isländsk e-legitimation för båda parter"],
      steps: [
        "I VAKTO: Inställningar → Regler och lön → Signering av avtal. Välj kod via mejl eller e-legitimation (Taktikal).",
        "Skicka avtalet från den anställdas profil. Båda signerar och får den signerade kopian via mejl.",
      ],
    },
    mcp: {
      sub: "Claude, ChatGPT och MCP",
      d: "Fråga om pass, timmar och lön i % i din egen AI-app. Bara läsning: apparna kan inte ändra något och får aldrig personnummer, bankkonton eller adresser.",
      out: ["Pass, timmar, omsättning och lön i % (bara läsning)"],
      in: [],
      need: ["Claude, ChatGPT eller en annan app som stöder MCP-kopplingar", "Företagets ägare slår på kopplade appar"],
      steps: [
        "I VAKTO: Inställningar → Integrationer → Kopplade appar → Tillåt AI-appar (ägaren).",
        "Kopiera adressen och lägg till den som koppling (connector) i Claude eller ChatGPT.",
        "Logga in med VAKTO och godkänn åtkomsten. Du kan koppla från när som helst.",
      ],
    },
    wallet: {
      sub: "Apple Wallet och Google Wallet",
      d: "Personalkortet med foto, roll och QR-kod i mobilen. Koden stämplar in på surfplattan vid entrén.",
      out: ["Personalkort i Wallet"],
      in: [],
      need: ["En iPhone eller Android-telefon"],
      steps: ["Den anställda öppnar personalkortet i VAKTO-appen och trycker på ”Lägg till i Wallet”."],
    },
    calendar: {
      sub: "Google, Apple och Outlook",
      d: "Passen syns i mobilens kalender och uppdateras av sig själva när schemat ändras.",
      out: ["Den anställdas pass som kalenderflöde (ICS)"],
      in: [],
      need: ["En kalender som kan prenumerera på en adress"],
      steps: ["I VAKTO: Schemat → Lägg passen i kalendern → Kopiera länk.", "I kalendern: lägg till en kalender ”Från webbadress” och klistra in länken."],
    },
  },
  plannedH: "Kommer snart.", plannedP: "De här integrationerna är under arbete eller på vår lista. Ingen av dem är klar än, och vi märker dem inte som i drift förrän de fungerar.",
  planned: {
    uniconta: { sub: "Bokföring", d: "Omsättning och lönebokföring." },
    h3: { name: "H3 Laun", sub: "Lön (Island)", d: "Timmar direkt in i lönekörningen." },
    m365: { name: "Microsoft 365 och Entra ID", sub: "Inloggning", d: "Logga in med jobbkontot och hämta användare från Entra ID." },
    noona: { sub: "Kassa och bokningar", d: "Omsättning från kassan och bokningar för prognosen." },
    dineout: { sub: "Kassa och bokningar", d: "Omsättning och bokningar för schemats prognos." },
    regla: { sub: "Bokföring (Island)", d: "Omsättning från bokföringen." },
    fortnox: { sub: "Bokföring och lön", d: "Sverige och Norge." },
    nordic: { name: "Nordisk lön", sub: "Sverige, Danmark och Norge", d: "Lön enligt nordiska kollektivavtal och kopplingar till lönesystem där. Vi prioriterar efter vad kunderna använder." },
  },
  askH: "Använder du ett annat system?", askP: "Berätta vilket. Det som flest ber om hamnar först i kön.", askBtn: "Skicka oss en rad",
  endH: "Testa VAKTO med dina system.", endP: "14 dagars gratis provperiod, ingen bindningstid. De flesta kopplingar tar under en minut.", endBtn: "Testa gratis", endPrice: "Se priser",
};

export const nav: NavText = { product: "Systemet", contracts: "Avtal", integrations: "Integrationer", price: "Priser", about: "Om oss", login: "Logga in", try: "Testa gratis", open: "Öppna menyn", close: "Stäng menyn" };

export const footer: FootText = {
  desc: "Schema, stämpelklocka, lön och anställningsavtal. Plus lönen som andel av omsättningen i realtid. Byggt på Island.",
  product: "Produkt", features: "Funktioner", showcase: "Lär känna VAKTO", contracts: "Avtal", integrations: "Integrationer", price: "Priser", contractors: "För hantverkare", try: "Testa gratis",
  company: "Företaget", about: "Om oss", contact: "Kontakt", login: "Logga in",
  legal: "Juridik", privacy: "Integritet", terms: "Villkor", cookies: "Cookies",
  follow: "Följ oss", copy: "© 2026 BGL Ventures ehf. · org.nr 490806-0400 (Island)", made: "Designat och utvecklat på Island",
};

export const consent: ConsentText = {
  text: "Vi använder cookies för att mäta hur webbplatsen används och om våra annonser fungerar (Google Analytics och Meta). Inget sätts om du inte tillåter det.",
  more: "Mer info", no: "Avböj", yes: "Tillåt",
};

export const legalNote = "Den här sidan finns bara på isländska. Frågor på svenska eller engelska är välkomna till hallo@vakto.is.";

export const meta: MetaText = {
  home: { title: "VAKTO: schemaläggning, stämpelklocka, tidrapportering och lön", desc: "Schema, stämpelklocka och tidrapportering för restauranger, kaféer och butiker, med lönen som andel av omsättningen i realtid. Lön enligt isländska kollektivavtal i dag, svenska på väg. 14 dagars gratis provperiod." },
  price: { title: "VAKTO: Priser", desc: `Schemat är gratis för upp till 5 anställda. Grunnur från ${m(getPlan("grunnur").base)} i månaden. Priser i isländska kronor (ISK) – kontakta oss för pris i SEK. Ingen bindningstid.` },
  contractors: { title: "VAKTO Verk: tidrapportering, arbetsrapporter och godkännande för hantverkare", desc: "Tidtagning med plats, bilder, material och körning – och kunden godkänner arbetsrapporten med ett tryck. För hantverkare och enskilda firmor." },
  about: { title: "VAKTO: Om oss", desc: "VAKTO byggdes av en företagare som aldrig hittade ett enkelt system för schema, lön och personal." },
  integrations: { title: "VAKTO: Integrationer – vad som fungerar i dag", desc: "Systemen VAKTO kopplar till i dag, vilka data som flyttas och hur du kopplar dem, steg för steg. Ärligt märkt: det som är på väg står som på väg." },
};
