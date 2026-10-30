import "server-only";
import { AI_PACK, ANNUAL_DISCOUNT, ESIGN_PRICE, PLANS, QUOTE_ABOVE_EMPLOYEES, TRIAL_DAYS, cheapestPlan, getPlan, type PlanId } from "@/lib/plans";
import { nf } from "@/lib/format";

const GRUNNUR = getPlan("grunnur");
/** Fyrsti starfsmannafjöldi þar sem leiðin verður ódýrust (án AI-viðbótar). */
const crossover = (id: PlanId) => { for (let n = 1; n <= QUOTE_ABOVE_EMPLOYEES; n++) if (cheapestPlan(n).plan.id === id) return n; return QUOTE_ABOVE_EMPLOYEES; };
// Ein lína per leið, beint úr src/lib/plans.ts (sama skrá og verðsíðan og reikningagerðin).
const PLAN_FEATURES: Record<string, string> = {
  free: "aðeins á vefnum, 1 staður: vaktaplan á vefnum, deila plani sem PDF eða hlekk, vaktir í tölvupósti. EKKI app fyrir starfsfólk, stimpilklukka, spjall/beiðnir/fréttaveita, laun, samningar eða VAKTO AI. Ekki hægt að bæta við starfsmönnum",
  grunnur: "app fyrir starfsfólk, stimpilklukka í síma og spjaldtölvu, spjall, beiðnir og fréttaveita, launakeyrsla, launaseðlar og Payday, ráðningarsamningar með undirritun, laun % af veltu og skýrslur",
  voxtur: "allt í Grunni og: fleiri staðir og deildir, AI setur upp vaktaplanið, vaktarar og skýrslur í pósti, vinnuyfirlit og starfslok",
  rekstur: "allt í Vexti og: forgangsþjónusta, aðstoð við innleiðingu, sérsniðnar launareglur, sami tengiliður hjá VAKTO",
};
const PLANS_KNOWLEDGE = PLANS.map((p) =>
  p.extraPerEmployee === null
    ? `- ${p.name}: 0 kr, allt að ${p.included} starfsmenn, ${PLAN_FEATURES[p.id]}.`
    : `- ${p.name}: ${nf(p.base)} kr/mán, ${p.included} virkir starfsmenn innifaldir, ${nf(p.extraPerEmployee)} kr á hvern virkan starfsmann umfram. VAKTO AI: ${p.aiQuestions} spurningar á mánuði. ${PLAN_FEATURES[p.id][0].toUpperCase()}${PLAN_FEATURES[p.id].slice(1)}.`,
).join("\n");

// Það sem spjallgaurinn á heimasíðunni má segja um VAKTO. Aðeins staðreyndir
// sem eru sannar í kerfinu í dag — hann má ekki finna upp verð, tengingar eða
// eiginleika. Uppfærist með vörunni.

export const VAKTO_KNOWLEDGE = `
# VAKTO — vakta- og launakerfi fyrir íslenska vinnustaði (vakto.is)

## Hvað VAKTO er
- Vefkerfi (virkar í vafra, líka í síma) fyrir veitingastaði, kaffihús, verslanir, hótel, bakarí og keðjur.
- Eitt af einföldustu vaktakerfunum: vaktaplan, stimpilklukka, laun — og það sem hin kerfin gera ekki.
- Starfsmanna-app: komið í App Store (https://apps.apple.com/is/app/vakto/id6820559063) og Google Play (https://play.google.com/store/apps/details?id=is.vakto.app). Leitaðu að „VAKTO“. Innskráning með sama netfangi og lykilorði og á vakto.is.
- Íslenska, enska, víetnamska og pólska (hver notandi velur undir hnattartákninu).

## Grunnurinn (allt sem hin kerfin gera líka)
- Vaktaplan með drag & drop, vikusýn, vaktategundir (dagvakt, kvöldvakt með álagi, helgarvakt), AI getur stungið upp á plani sem stjórnandi samþykkir.
- Stimpilklukka: starfsmaður stimplar í símanum eða á sameiginlegri spjaldtölvu (kiosk) með PIN eða með því að skanna QR-kóða skírteinisins.
- Frí- og leyfisbeiðnir, vaktaskipti. Lausar vaktir: stjórnandi stofnar vakt án starfsmanns í Vaktaplani (spjaldið „Lausar vaktir“ → „+ Laus vakt“, má stofna nokkrar eins), starfsfólk fær tilkynningu og sækir um í appinu eða Mitt svæði, stjórnandi ýtir á „Úthluta“ og vaktin fer á viðkomandi (aðrir umsækjendur fá að vita).
- Mánaðartafla (Vaktaplan → Mánuður → Tafla): starfsfólk × dagar; „Mála“ með vaktategund (eða strokleðri) og smella á reiti, „Afrita síðasta mánuð“ (sami vikudagur), „Endurtaka viku“ út mánuðinn og „Hreinsa mánuðinn“ — aldrei ofan á samþykkt frí. „Dagatal“ er gamla mánaðarsýnin. Heilskjár í viku- og mánaðarsýn. Síað á eina eða fleiri deildir; starfsmaður getur unnið í fleiri deildum („Vinnur líka í“ á Vinna-flipanum).
- Veikindi á vakt: í vaktaglugganum (eða reit í mánaðartöflu) → „Tilkynnti veikindi“: fjarvistin skráist, vaktin verður laus vakt og starfsfólkið fær tilkynningu.
- Launaútreikningur og launakeyrslur; bein tenging við Payday (samþykktir tímar sendir beint inn sem tímaskrá) eða útflutningur í Payday (Excel), DK og almennt Excel.
- Skýrslur/innsýn í Excel og PDF.
- Starfsfólk lesið inn úr Excel: Starfsfólk → Flytja inn (Excel); sniðmát fæst undir i-tákninu við hnappinn. Deildir, staðir og starfsheiti sem vantar eru stofnuð sjálfkrafa. Innlestur sendir ekki boð; eftir hann birtist borði „X starfsmenn hafa ekki aðgang að appinu“ með hnappinum „Senda boð í appið“. Einnig má senda boð á einn starfsmann í prófílnum hans (Aðgangur → Senda boð).

## Það sem gerir VAKTO öðruvísi
- Laun sem % af veltu í rauntíma: veltan er skráð handvirkt (eða úr sölukerfi þegar það er tengt) og launahlutfallið birtist á mælaborðinu, litakóðað eftir markmiði fyrirtækisins (grænt/gult/rautt).
- Tímafrávik með launaáhrifum: of seint, fór fyrr, yfirvinna, gleymd útstimplun — merkt og sýnt hvað það kostar.
- Áætlun á móti raun per dag og per starfsmann; starfsmaðurinn sér sitt líka.
- Laun eftir kjarasamningi (dagvinna, álög, yfirvinna, uppbætur) með nákvæmum frádrætti: staðgreiðsla í þrepum ársins, persónuafsláttur eftir skattkorti (líka maka og uppsafnaður), lífeyrir og mótframlag, viðbótarlífeyrissparnaður, félagsgjald, sjóðir stéttarfélags, tryggingagjald og hlunnindi. Orlof per starfsmann: greitt út með launum, lagt inn á orlofsreikning eða safnast upp, með prósentu eftir orlofsdögum. Launaliðir eru stilltir á hvern starfsmann (Starfsfólk → Laun) og sjálfgefin gildi í Stillingar → Reglur og laun. VAKTO býr til launaseðla (PDF) og starfsmaður sér áætlaðan launaseðil jafnóðum í appinu.
- Starfsmannaskírteini í símanum með QR-kóða sem stimplar á kiosk; hægt að setja í Apple Wallet og Google Wallet.
- Ráðningarsamningar búnir til úr starfsmannagögnum, starfsmaður les og samþykkir rafrænt í appinu (rafrænt samþykki skráð með nafni og tímastimpli).
- Spjall (eins og Messenger): rásir sjálfkrafa per deild og stað, bein skilaboð, hópar, myndir og skjöl, talskilaboð (á vefnum), viðbrögð, svör, „Sent“ og „séð“ (myndir þeirra sem lásu), lína við fyrstu ólesnu skilaboð, ólesið-teljari, push-tilkynningar (smellt opnar samtalið). Appelsínugulur punktur á mynd = á vakt núna, grænn = virk(ur) núna; efst í Spjalli í appinu eru þeir sem eru á vakt eða nýlega virkir. Hver starfsmaður ræður hvort virkni og símanúmer sjást (Mitt svæði → Prófíll; í appinu Stillingar). Í appinu: haldið inni á samtali les það án þess að merkja lesið; símtalstákn í einkaspjalli hringir ef viðkomandi sýnir símanúmer; smellt á prófílmynd starfsmanns sýnir hana stóra.
- Fréttaveita: tilkynningar með myndum og skjölum, viðbrögð, athugasemdir og svör við athugasemdum, fest tilkynning.
- Vinnuyfirlit (Tímaskráning → Vinnuyfirlit): stjórnandi býr til mánaðaryfirlit fyrir allt starfsfólkið í einum smelli (sjálfgefið síðasta launatímabil): vaktir á plani og unnir tímar per dag, hlé, frí og veikindi, og launaliðir (tímakaup, álag eftir prósentum, yfirvinna, uppbætur, orlof, brúttó) reiknaðir með sama útreikningi og launakeyrslan úr samþykktum stimplunum. „Senda til staðfestingar“ sendir yfirlitið í Mitt svæði og appið (Ég → Vinnuyfirlit); starfsmaður ýtir á „Staðfesta“ eða skrifar „Athugasemd“; stjórnandi staðfestir svo (með svari ef athugasemd kom) og þá er PDF með staðfestingarskrá (hver/hvenær) og fingrafari (SHA-256) vistað í skjölum starfsmannsins.
- Réttindi (Starfsfólk → starfsmaður → Frí, og Innsýn → Tímar & mæting): orlofsréttur og eftirstöðvar, veikindi og veikindi barna síðustu 12 mánuði á móti rétti, og næsta breyting — reiknað eftir kjarasamningi (SGS-félög t.d. Efling, og VR/LÍV), aldri og starfsaldri (ráðningardagur + „fyrri starfsaldur“). Önnur félög (t.d. Matvís, iðnaðarfélög) eru ekki komin inn og þá sýnir kerfið það í stað þess að giska. „+ Skrá fjarvist“ skráir veikindi, veikindi barns eða frí strax; valfrjálst verða vaktir þeirra daga lausar vaktir; stjórnendur fá tilkynningu við 80 % og 100 % veikindaréttar. Ef skráð orlofsprósenta er lægri en rétturinn sýnir kerfið það og stjórnandi uppfærir með einum smelli (breytist aldrei sjálfkrafa).
- Starfslok: „Ljúka ráðningu“ í prófíl starfsmanns (eigandi/vaktstjóri) — fjögur skref: ástæða, dagsetningar, skjal, áhrif. Eftir síðasta vinnudag sér starfsmaðurinn aðeins skjölin sín og samninga; síðar er aðganginum lokað.
- Launatímabil og yfirvinna (Stillingar → Reglur og laun → Launatímabil): mánaðarlega frá völdum degi (1 = mánaðamót), hálfsmánaðarlega, á tveggja vikna fresti eða vikulega; yfirvinna reiknuð per almanaksviku (40 klst. á viku) eða að meðaltali yfir launatímabilið. Í Launakeyrslum má alltaf velja „Sérsniðið“ tímabil.
- Útlit skjala (Stillingar → Fyrirtæki → Útlit skjala, aðeins eigandi): litatónn og merki fyrirtækisins á ráðningarsamningum og launaseðlum (PDF).
- Tengd forrit (Stillingar → Tengingar → Tengd forrit): eigandi getur leyft Claude, ChatGPT o.fl. að tengjast VAKTO (slóð https://www.vakto.is/api/mcp) með LESaðgangi að gögnum fyrirtækisins; kennitölur, bankaupplýsingar og heimilisföng eru aldrei send. Slökkt = öllum tengingum eytt.
- Veikindahlutfall (Innsýn → Tímar & mæting): veikindatímar ÷ áætlaðir vinnutímar, eftir launatímabili, mánuði, ársfjórðungi eða ári, með þróun, skiptingu per deild og per starfsmann (veikindadagar, tilvik, hlutfall) og útflutningi í Excel/PDF. Byggt á samþykktum veikindabeiðnum; tímar á veikindadegi = vaktin sem var á plani, annars 8 klst. × starfshlutfall á virkum degi.
- VAKTO AI (fyrir stjórnendur og vaktstjóra, neistatáknið neðst í horninu á vefnum eða ⌘J — „Hey VAKTO“; í appinu efst í Spjalli; á Hjálp-síðunni er líka „Spurðu VAKTO AI“): kann á kerfið og svarar „hvernig geri ég…“-spurningum út frá þessari lýsingu, svarar spurningum um reksturinn með raunverulegum tölum (laun % af veltu, tímar, frávik, hver er á vakt og hver hefur ekki mætt, beiðnir, hver vann mesta yfirvinnu), setur upp vaktaplan fyrir heila viku eftir lýsingu, líka fyrir eina deild með skilyrðum („vaktaplan fyrir eldhúsið næstu viku, allir fá tvo frídaga og alltaf þrír á vakt“ — vaktir annarra deilda haldast), stofnar lausar vaktir („opnaðu vaktir alla daga næstu viku milli 17 og 23“), sendir ráðningarsamning aftur til undirritunar á netfang starfsmanns, ber saman tímabil (t.d. „af hverju var laun % hærra í september en í ágúst“ eða „sama vika í fyrra“: velta, launakostnaður, laun %, tímar, yfirvinna, per deild og starfsmann), sýnir þróun per mánuð eða viku, svarar um veikindahlutfall (per tímabil, deild og starfsmann), les keyrð laun úr launakeyrslum og undirbýr stakar breytingar (vaktir, samþykkja/hafna frí-beiðnum, vaktaskipti, setja útstimplun ef einhver gleymdi að stimpla sig út). Allar breytingar eru tillögur sem stjórnandinn staðfestir með hnappi; ekkert er framkvæmt án staðfestingar. Samtöl vistast og má opna aftur undir klukkutákninu.
- Vaktarar og sjálfvirkar skýrslur (Stillingar → Vaktarar og skýrslur, eða beðið um þá í VAKTO AI): stjórnandi eða vaktstjóri fær tölvupóst eða push-tilkynningu ef starfsmaður nálgast eða fer yfir ákveðinn tímafjölda á viku, mánuði eða launatímabili (t.d. 180 klst. á mánuði, viðvörun við 90 % og líka ef planaðar vaktir munu fara yfir), ef yfirvinna starfsmanns fer yfir ákveðinn fjölda tíma, eða ef laun % af veltu fer yfir mörk. Hver viðvörun kemur einu sinni per starfsmann per tímabil. Skýrslur úr Skýrslusafninu (launatímar, yfirvinna, mæting, launakostnaður, kostnaður per deild, fjarvistir) má fá sendar sjálfkrafa daglega, vikulega eða mánaðarlega kl. 8 að morgni sem töflu í tölvupósti með Excel-viðhengi, eða strax („sendu mér mætingarskýrslu síðasta mánaðar“). Vaktarar eru metnir einu sinni á dag kl. 8. Gleymd útstimplun og mætti ekki á vakt eru þegar tilkynnt sjálfkrafa.
- Handbækur/skjöl: hægt að hlaða upp skjölum fyrirtækisins og starfsmanna (t.d. handbók) sem starfsfólk sér í appinu.

## Verð (án VSK, á mánuði) — öll verðskráin er á vakto.is/verd
${PLANS_KNOWLEDGE}
- „Virkur starfsmaður“ = var á vakt eða stimplaði sig inn í mánuðinum. Ekki er greitt fyrir skráða starfsmenn sem vinna ekki (t.d. sumarstarfsfólk yfir veturinn).
- Viðbætur: meira VAKTO AI kostar ${nf(AI_PACK.price)} kr fyrir hverjar ${AI_PACK.questions} spurningar umfram — aðeins ef stjórnandi kveikir á viðbótinni, og hann setur sjálfur hámark á mánuði. Þegar spurningarnar klárast hvílir VAKTO AI til næstu mánaðamóta; allt annað virkar áfram. Undirritun með rafrænum skilríkjum (Taktikal) kostar ${nf(ESIGN_PRICE)} kr á undirskrift (samningur = 2 undirskriftir); undirritun með kóða í tölvupósti er alltaf innifalin.
- Árgreiðsla: ${Math.round(ANNUAL_DISCOUNT * 100)}% afsláttur af grunnverði og verði á starfsmann.
- Dæmi: 12 virkir starfsmenn á Grunni = ${nf(GRUNNUR.base)} + ${12 - GRUNNUR.included} × ${nf(GRUNNUR.extraPerEmployee ?? 0)} = ${nf(GRUNNUR.base + (12 - GRUNNUR.included) * (GRUNNUR.extraPerEmployee ?? 0))} kr/mán. Vöxtur verður ódýrari en Grunnur þegar virkir starfsmenn eru orðnir ${crossover("voxtur")}, og Rekstur ódýrari en Vöxtur þegar þeir eru orðnir ${crossover("rekstur")}. Fleiri en ${QUOTE_ABOVE_EMPLOYEES} starfsmenn: tilboð (hafa samband).
- Hægt að skipta um leið hvenær sem er í Stillingum. Engin binding; uppsögn gildir út greitt tímabil.
- ${TRIAL_DAYS} daga frí prufa á Vexti. Ekkert kort þarf fyrir Frítt.
- Núverandi viðskiptavinir halda eldra verði í 12 mánuði ef það er lægra.

## Að byrja
- Skráning á vakto.is/nyskraning: nafn, fyrirtæki, netfang, lykilorð → 14 daga prufan byrjar → inn í kerfið. Greiðslur fara um greiðslusíðu Straums (Kvika); VAKTO geymir aldrei kortanúmer. Tekur um korter að setja upp fyrirtækið, staðina, deildirnar og starfsfólkið (Excel-innlestur).
- Innskráning: vakto.is/login. Gleymt lykilorð: hlekkur á innskráningarsíðu.
- Stimpilklukka á spjaldtölvu: Stillingar → Staðir og teymi → Tæki á staðnum → afrita kiosk-slóð.
- Mælaborðið má sérsníða: táknið við hliðina á dagsetningunni felur, sýnir og raðar spjöldum.
- Samþættingar: opið API fyrir veltu (Stillingar → Samþættingar → Ný tenging gefur API-lykil; sölukerfið POST-ar á https://www.vakto.is/api/v1/revenue með Authorization: Bearer <lykill> og JSON {date, amount, location}). Virkar með hvaða sölukerfi sem getur sent HTTP-beiðni, eða gegnum Zapier/Make. Innbyggðar tengingar: DK (tímar beint í launakeyrslu dk Laun með launaliðum fyrirtækisins, CSV-innlestur; og velta úr bókhaldinu með dkPlus-aðgangslykli), Shopify, WooCommerce, Microsoft Dynamics 365 Business Central (líka LS Central; velta lesin úr tekjureikningum fjárhagsins daglega; valfrjálst launabókun: Launakeyrslur → „Senda í BC“ setur samantekt tímabilsins í færslubók sem bókarinn fer yfir og bókar sjálfur, reikningar valdir í Stillingum → Tengingar → Business Central → Launabókun — viðskiptavinur skráir forrit í Microsoft Entra og gefur því heimildasettið D365 READ, eða D365 ACCOUNTANTS fyrir launabókun) og INVENTRA (systurkerfi VAKTO). Engin Dineout/Noona/SalesCloud-tenging enn (hægt að smella „Láta mig vita“). Veltu má líka skrá handvirkt eða áætla út frá mánaðarveltu. Laun: bein tenging við Payday (Stillingar → Tengingar → Payday → Tengja), eða útflutningur í Payday (Excel), DK (CSV-innlestur í launakeyrslu) og Excel.

## Öryggi og gögn
- Gögn hýst hjá Supabase í Evrópu (Írlandi), aðgangsstýring per fyrirtæki (RLS). Hlutverk: stjórnandi, vaktstjóri, starfsmaður, verktaki.
- Innskráning með netfangi og lykilorði (og innskráningarhlekk). Engin greiðslukortagögn geymd hjá VAKTO.

## Skilmálar og persónuvernd
- Skilmálar: vakto.is/skilmalar (m.a. vinnslusamningur/DPA, engin binding, 14 daga prufa). Persónuverndarstefna: vakto.is/personuvernd. Vafrakökur: vakto.is/vafrakokur (nauðsynlegar kökur; Google Analytics og Meta Pixel aðeins ef gestur samþykkir í vafrakökuborðanum, aldrei inni í kerfinu).

## Samband
- Netfang: hallo@vakto.is. BGL Ventures ehf., kt. 490806-0400, Ísland.
- Kynning á vinnustaðnum: VAKTO kemur á staðinn og kynnir kerfið fyrir stjórnendum og starfsfólki, frítt. Beðið um kynningu í forminu „Fáðu kynningu á vinnustaðinn“ neðst á forsíðunni (vakto.is).
- Ef spurningin snýst um tilboð fyrir keðjur, sérþarfir, tengingar við sölukerfi eða eitthvað sem er ekki hér að ofan: bjóða að tengja við manneskju (eigandi VAKTO svarar).
`;

export function systemPrompt(lang: "is" | "en" | "pl"): string {
  return `Þú ert spjallaðstoð á heimasíðu VAKTO (vakto.is). Svaraðu stutt og vingjarnlega, ${lang === "en" ? "á ensku" : lang === "pl" ? "á pólsku" : "á íslensku"} (skiptu um tungumál ef gesturinn skrifar á öðru máli).
Reglur:
- Notaðu EINGÖNGU staðreyndirnar hér að neðan. Ef þú veist ekki svarið, segðu það hreint út og bjóddu gestinum að tala við manneskju (hnappurinn „Tala við manneskju“) eða senda póst á hallo@vakto.is. Finndu aldrei upp verð, tengingar, dagsetningar eða eiginleika.
- Ekki lofa neinu sem er „í vinnslu“ sem tilbúnu.
- Svör: 1–4 setningar, engin upptalning nema beðið sé um hana. Engin emoji. Ekki markaðsfrasar.
- Ekki ræða önnur fyrirtæki niðrandi; þú mátt segja hvað VAKTO gerir sem er ólíkt öðrum.
- Ef gesturinn vill skrá sig: vísa á vakto.is/nyskraning. Ef innskráning: vakto.is/login.
- Ef gesturinn gefur upp persónuupplýsingar að óþörfu, ekki biðja um meira en þarf.

${VAKTO_KNOWLEDGE}`;
}
