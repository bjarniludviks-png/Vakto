// Kjarasamningasafn VAKTO — lýsing á hverju afbrigði (stéttarfélag × grein × dagvinna/vaktavinna) á mannamáli,
// heimild (lokaskjal samnings á sa.is), orlofsþrep og staða: hvort tölurnar hafa verið bornar saman við
// samningstextann. Launavélin les AÐEINS `UNION_PRESETS[preset]` (payrules.ts) — þetta skjal útskýrir hana.
// Hreint — vefur og þjónn (AI-spurningar nota sama efni).
//
// Lesið úr lokaskjölum SA 2024–2028 (gilda 1.2.2024–1.2.2028) 11. nóv. 2026. „Óstaðfest“ = talan er ekki
// í samningstextanum eða VAKTO einfaldar regluna; slíkt er talið upp í `unverified` og sýnt í viðmótinu.

import { UNION_PRESETS, type CustomRules } from "@/lib/payrules";

export type AgreementStatus = "verified" | "partial" | "unverified";
export type OrlofStep = { days: number; pct: number; when: string };
export type OrlofGroup = { group?: string; steps: OrlofStep[]; ref: string };
export type Agreement = {
  id: string;
  /** Lykill í UNION_PRESETS — það sem launavélin reiknar eftir. */
  preset: string;
  /** Stéttarfélag/samband (hópun í safninu). */
  union: string;
  /** Félagið sem sett er á starfsmann án félags þegar reglan er notuð. */
  unionName: string;
  sector: string;
  title: string;
  kind: "dagvinna" | "vaktavinna";
  status: AgreementStatus;
  /** Fyrir hverja reglan er — ein setning. */
  who: string;
  hours: string;
  validity: string;
  /** Önnur atriði á mannamáli (útkall, hvíld, neysluhlé …) með grein. */
  points: { label: string; text: string; ref?: string }[];
  orlof: OrlofGroup[];
  /** Hvað er EKKI staðfest eða einfaldað í útreikningi. */
  unverified: string[];
  source: { label: string; url: string };
  /** Eldri staðall VAKTO — er í notkun hjá starfsfólki og helst óbreyttur, en nýrri afbrigði eru nákvæmari. */
  legacy?: boolean;
};

const BASE = "https://samtok-atvinnulifsins.cdn.prismic.io/samtok-atvinnulifsins/";
const SRC = {
  efling: { label: "Kjarasamningur SA og Eflingar 2024–2028 (lokaskjal)", url: `${BASE}aEGvLrh8WN-LVq19_KjarasamningurSAogEfling2024-2028-lokaskjal-vef%C3%BAtg%C3%A1fa.pdf` },
  eflingHotel: { label: "Hótel- og veitingahúsasamningur SA og Eflingar 2024–2028 (lokaskjal)", url: `${BASE}aEGu3rh8WN-LVq1N_Hotelogveitinagh%C3%BAsasamningurSAogEfling2024-2028lokaskjal-vef%C3%BAtg%C3%A1fa.pdf` },
  sgs: { label: "Kjarasamningur SA og SGS 2024–2028 (lokaskjal)", url: `${BASE}ZxY5XoF3NbkBXw8H_KjarasamningurSAogSGS2024-2028-lokaskjal-vef%C3%BAtg%C3%A1fa.pdf` },
  sgsGreid: { label: "Greiðasölusamningur SA og SGS 2024–2028 (lokaskjal)", url: `${BASE}aMwWxGGNHVfTPXrB_Grei%C3%B0as%C3%B6lusamningurSAogSGS2024-2028lokaskjal.pdf` },
  matvis: { label: "Kjarasamningur MATVÍS og SA 2024–2028 (lokaskjal)", url: `${BASE}aZXiD8FoBIGEghwf_KjarasamningurMATVI%CC%81SogSA2024-2028lokaskjal.pdf` },
  rsi: { label: "Kjarasamningur SA og RSÍ 2024–2028 (lokaskjal)", url: `${BASE}aj6Iu1bRV8_Qf6wt_KjarasamningurSAogRS%C3%8D2024-2028lokaskjal.pdf` },
  samidn: { label: "Kjarasamningur SA og Samiðnar 2024–2028 (lokaskjal)", url: `${BASE}aNPSSJ5xUNkB1Dby_KjarasamningurSAogSami%C3%B0n2024-2028Lokaskjal.pdf` },
  vr: { label: "Kjarasamningur SA og VR/LÍV 2024–2028", url: `${BASE}ZxYu1IF3NbkBXw06_KjarasamningurSAogVR-L%C3%8DV2024-2028vef%C3%BAtg%C3%A1fa.pdf` },
};
const VALID = "1.2.2024 – 1.2.2028";

// ---------- orlofsþrep (orlofsárið sem hefst 1.5.2026, áunnið frá 1.5.2025) ----------
const ORLOF_SGS: OrlofGroup = {
  ref: "gr. 4.1.1–4.1.2 (greiðasala gr. 6.1)",
  steps: [
    { days: 24, pct: 10.17, when: "Lágmarksorlof" },
    { days: 25, pct: 10.64, when: "22 ára og 6 mánuðir í sama fyrirtæki" },
    { days: 28, pct: 12.07, when: "5 ár í sama fyrirtæki" },
    { days: 30, pct: 13.04, when: "10 ár í sama fyrirtæki" },
  ],
};
const ORLOF_VR: OrlofGroup = {
  ref: "gr. 4.1 og 4.3",
  steps: [
    { days: 24, pct: 10.17, when: "Lágmarksorlof" },
    { days: 25, pct: 10.64, when: "6 mánuðir í sama fyrirtæki og 22 ára (eða 6 mán. eftir framhaldsskólapróf)" },
    { days: 26, pct: 11.11, when: "5 ár í starfsgrein" },
    { days: 28, pct: 12.07, when: "4 ár í sama fyrirtæki eða 10 ár í starfsgrein" },
    { days: 30, pct: 13.04, when: "6 ár í sama fyrirtæki" },
  ],
};
const ORLOF_MATVIS: OrlofGroup[] = [
  { group: "Faglærðir (viðurkennt fagnám)", ref: "gr. 4.1.1–4.1.2", steps: [
    { days: 25, pct: 10.64, when: "Lágmark faglærðra (frá 1.5.2024)" },
    { days: 27, pct: 11.59, when: "3 ár í starfsgrein" },
    { days: 29, pct: 12.55, when: "3 ár hjá sama vinnuveitanda" },
    { days: 30, pct: 13.04, when: "5 ár samfellt í sama fyrirtæki" },
  ] },
  { group: "Ófaglærðir", ref: "gr. 4.1.1", steps: [
    { days: 24, pct: 10.17, when: "Lágmarksorlof" },
    { days: 25, pct: 10.64, when: "2 ár í starfsgrein" },
  ] },
];
const ORLOF_IDN = (ref: string, faglaerdir: string): OrlofGroup[] => [
  { group: faglaerdir, ref, steps: [
    { days: 25, pct: 10.64, when: "Lágmark (frá 1.5.2024)" },
    { days: 28, pct: 12.07, when: "3 ár í sama fyrirtæki eða 5 ár í starfsgrein" },
    { days: 30, pct: 13.04, when: "5 ár í sama fyrirtæki" },
  ] },
  { group: "Ófaglærðir", ref, steps: [{ days: 24, pct: 10.17, when: "Lágmarksorlof" }] },
];

const P = {
  rest: { label: "Hvíld", text: "11 klst. samfelld hvíld á sólarhring. Ef hvíld er stytt myndast frítökuréttur: 1½ klst. í dagvinnu fyrir hverja klst. sem vantar." },
  restIdn: { label: "Hvíld", text: "11 klst. samfelld hvíld á sólarhring; frávik veita frítökurétt (margfeldi ekki staðfest í VAKTO)." },
  callout4: { label: "Útkall", text: "Minnst 4 klst. ef kallað er út eftir að yfirvinnutímabil er hafið, nema dagvinna hefjist innan 2 klst." },
};

export const AGREEMENTS_LIB: Agreement[] = [
  // ---------- Efling ----------
  {
    id: "efling-dagvinna", preset: "Efling – almennur, dagvinna", union: "Efling", unionName: "Efling", sector: "Almennur samningur",
    title: "Almennur samningur — dagvinna", kind: "dagvinna", status: "verified",
    who: "Verkafólk í dagvinnu sem fellur undir aðalkjarasamning Eflingar og SA.",
    hours: "37 klst. 5 mín. virkar á viku (40 með kaffitímum), dagvinna 07:55–17:00 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna", text: "Öll vinna utan dagvinnu, um helgar og á frídögum er yfirvinna, +80 % (1,0385 % af mánaðarlaunum).", ref: "gr. 1.6.1, 2.2" },
      { label: "Stórhátíðir", text: "+138,3 % (1,375 % af mánaðarlaunum). Aðfangadagur og gamlársdagur frá kl. 12.", ref: "gr. 1.6.2, 2.3.1" },
      P.callout4, P.rest,
    ],
    orlof: [ORLOF_SGS],
    unverified: ["VAKTO miðar dagvinnu við heilar klst. (08–17) — samningurinn segir 07:55–17:00 eða 07:30–16:35."],
    source: SRC.efling,
  },
  {
    id: "efling-hotel-dagvinna", preset: "Efling – hótel og veitingar, dagvinna", union: "Efling", unionName: "Efling", sector: "Hótel og veitingahús",
    title: "Hótel og veitingar — dagvinna / föst laun", kind: "dagvinna", status: "verified",
    who: "Starfsfólk hótela og veitingahúsa í dagvinnu (Efling).",
    hours: "40 klst. á viku (37 klst. 5 mín. virkar), dagvinna 08–17 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna", text: "Utan dagvinnu, um helgar, á frídögum og yfir 40 klst./viku, +78,6 % (deilitala 172).", ref: "gr. 1.7.1, 2.2" },
      { label: "Stórhátíðir", text: "+136,5 %. Gamlárskvöld frá kl. 22 og nýársdag greiðist tvöföld yfirvinna (ekki reiknað sérstaklega í VAKTO).", ref: "gr. 1.7.2–1.7.3" },
      { label: "Útkall", text: "Minnst 4 klst., líka á bakvakt.", ref: "gr. 1.8" }, P.rest,
    ],
    orlof: [ORLOF_SGS],
    unverified: ["Tvöföld yfirvinna á gamlárskvöld frá kl. 22 og nýársdag er ekki reiknuð sjálfkrafa."],
    source: SRC.eflingHotel,
  },
  {
    id: "efling-hotel-vakt40", preset: "Efling – veitingar/SGS", union: "Efling", unionName: "Efling", sector: "Hótel og veitingahús",
    title: "Hótel og veitingar — vaktavinna 40 klst.", kind: "vaktavinna", status: "verified",
    who: "Vaktavinnufólk á hótelum og veitingahúsum (Efling).",
    hours: "40 klst. á viku að meðaltali, vaktir 3–12 klst.", validity: VALID,
    points: [
      { label: "Neysluhlé", text: "5 mín. fyrir hverja unna klst.", ref: "gr. 3.3.1" },
      { label: "Vetrarfrí", text: "12 dagar á ári, eða greitt 8 klst. fyrir hvern.", ref: "gr. 3.4.1" },
      { label: "Yfirvinna að meðaltali", text: "Stilltu „Yfirvinna reiknast → að meðaltali yfir launatímabilið“ til að jafna þungar og léttar vikur.", ref: "gr. 3.2.4" },
      P.rest,
    ],
    orlof: [ORLOF_SGS],
    unverified: [],
    source: SRC.eflingHotel,
  },
  {
    id: "efling-hotel-vakt38", preset: "Efling – hótel og veitingar, vaktavinna 38 klst", union: "Efling", unionName: "Efling", sector: "Hótel og veitingahús",
    title: "Hótel og veitingar — vaktavinna 38 klst. (kvöldvaktir)", kind: "vaktavinna", status: "verified",
    who: "Þau sem vinna eingöngu vaktir fimm daga vikunnar alfarið á tímabilinu 17:00–08:00.",
    hours: "38 klst. á viku; yfirvinna umfram 38 klst. að meðaltali.", validity: VALID,
    points: [{ label: "Sömu álög", text: "Álögin eru þau sömu og í 40 klst. vaktavinnu — aðeins yfirvinnumörkin breytast.", ref: "gr. 3.1.1, 3.2.4" }, P.rest],
    orlof: [ORLOF_SGS],
    unverified: ["Samningurinn tekur ekki fram hvort deilitala breytist við 38 klst. viku."],
    source: SRC.eflingHotel,
  },
  {
    id: "efling-skemmtistadir", preset: "Efling – skemmtistaðir, vaktavinna 40 klst", union: "Efling", unionName: "Efling", sector: "Hótel og veitingahús",
    title: "Skemmtistaðir, krár og dansstaðir — vaktavinna", kind: "vaktavinna", status: "verified",
    who: "Vaktavinnufólk á skemmtistöðum, krám og dansstöðum (Efling).",
    hours: "40 klst. á viku að meðaltali.", validity: VALID,
    points: [{ label: "Næturálag skemmtistaða", text: "55 % kl. 00–05 aðfaranætur laugardags og sunnudags; annars sömu álög og vaktavinna 40 klst.", ref: "gr. 3.2.1" }, P.rest],
    orlof: [ORLOF_SGS],
    unverified: [],
    source: SRC.eflingHotel,
  },
  {
    id: "efling-legacy", preset: "Efling", union: "Efling", unionName: "Efling", sector: "Almennur samningur",
    title: "Efling — vaktaálag (eldri staðall VAKTO)", kind: "vaktavinna", status: "partial", legacy: true,
    who: "Eldri staðall sem starfsfólk í VAKTO er þegar skráð á. Helst óbreyttur svo laun breytist ekki.",
    hours: "40 klst. á viku.", validity: VALID,
    points: [{ label: "Athugið", text: "Aðalkjarasamningurinn hefur ekki eitt vaktaálag — það fer eftir köflum (t.d. mötuneyti, ræsting, gæsla). Veljið nákvæmara afbrigði ef það á við." }],
    orlof: [ORLOF_SGS],
    unverified: ["33/45 % vaktaálag gildir aðeins í sumum köflum aðalkjarasamningsins."],
    source: SRC.efling,
  },

  // ---------- SGS ----------
  {
    id: "sgs-dagvinna", preset: "SGS – aðalkjarasamningur, dagvinna", union: "SGS", unionName: "SGS", sector: "Almennur samningur",
    title: "Aðalkjarasamningur — dagvinna", kind: "dagvinna", status: "verified",
    who: "Verkafólk í dagvinnu hjá aðildarfélögum SGS (VSFK, Eining-Iðja, AFL, Framsýn …).",
    hours: "37 klst. 5 mín. virkar á viku, dagvinna 07:55–17:00 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna", text: "Utan dagvinnu, um helgar og á frídögum, +80 %.", ref: "gr. 1.6.1, 2.2" },
      { label: "Stórhátíðir", text: "+138,3 %.", ref: "gr. 1.6.2, 2.3.1" },
      P.callout4, P.rest,
    ],
    orlof: [ORLOF_SGS],
    unverified: ["VAKTO miðar dagvinnu við heilar klst. (08–17)."],
    source: SRC.sgs,
  },
  {
    id: "sgs-greid-dagvinna", preset: "SGS – veitingar og hótel, dagvinna", union: "SGS", unionName: "SGS", sector: "Veitinga- og hótelstörf",
    title: "Veitinga- og hótelstörf — dagvinna", kind: "dagvinna", status: "verified",
    who: "Starfsfólk í greiðasölu (veitingar, hótel) í dagvinnu hjá aðildarfélögum SGS.",
    hours: "40 klst. á viku (37 klst. 5 mín. virkar), dagvinna 08–17.", validity: VALID,
    points: [
      { label: "Yfirvinna", text: "Utan dagvinnu, um helgar, á frídögum og yfir 40 klst., +78,6 %.", ref: "gr. 1.7.1, 2.2" },
      { label: "Stórhátíðir", text: "+136,5 %; tvöföld yfirvinna gamlárskvöld frá kl. 22 og nýársdag.", ref: "gr. 1.7.2–1.7.3" },
      { label: "Útkall", text: "Minnst 4 klst.", ref: "gr. 1.8" }, P.rest,
    ],
    orlof: [ORLOF_SGS],
    unverified: ["Tvöföld yfirvinna á gamlárskvöld frá kl. 22 og nýársdag er ekki reiknuð sjálfkrafa."],
    source: SRC.sgsGreid,
  },
  {
    id: "sgs-greid-vakt40", preset: "Efling – veitingar/SGS", union: "SGS", unionName: "SGS", sector: "Veitinga- og hótelstörf",
    title: "Veitinga- og hótelstörf — vaktavinna 40 klst.", kind: "vaktavinna", status: "verified",
    who: "Vaktavinnufólk í greiðasölu hjá aðildarfélögum SGS.",
    hours: "40 klst. á viku að meðaltali.", validity: VALID,
    points: [{ label: "Yfirvinna að meðaltali", text: "Yfirvinna er umfram 40 klst. á viku að meðaltali yfir vaktaskrána — stilltu það undir launatímabili.", ref: "gr. 3.2.4" }, P.rest],
    orlof: [ORLOF_SGS],
    unverified: [],
    source: SRC.sgsGreid,
  },
  {
    id: "sgs-greid-vakt38", preset: "SGS – veitingar og hótel, vaktavinna 38 klst", union: "SGS", unionName: "SGS", sector: "Veitinga- og hótelstörf",
    title: "Veitinga- og hótelstörf — vaktavinna kvöld 38 klst.", kind: "vaktavinna", status: "verified",
    who: "Þau sem vinna eingöngu vaktir fimm daga vikunnar innan 17:00–08:00.",
    hours: "38 klst. á viku; yfirvinna umfram 38 klst.", validity: VALID,
    points: [{ label: "Sömu álög", text: "Sömu álög og í 40 klst. vaktavinnu.", ref: "gr. 3.1.1, 3.2.4" }, P.rest],
    orlof: [ORLOF_SGS],
    unverified: [],
    source: SRC.sgsGreid,
  },

  // ---------- Matvís ----------
  {
    id: "matvis-dagvinna", preset: "Matvís – dagvinna", union: "Matvís", unionName: "Matvís", sector: "Matvæla- og veitingagreinar",
    title: "Dagvinna", kind: "dagvinna", status: "partial",
    who: "Matreiðslu-, framreiðslu-, kjötiðnaðar- og bakarafólk í dagvinnu.",
    hours: "36 virkar klst. á viku innan 07–18 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna 1", text: "+56 % fyrir vinnu umfram 36 virkar klst. upp að 40 klst. á viku.", ref: "gr. 1.7.1, 2.2.1" },
      { label: "Yfirvinna 2", text: "+79,4 % yfir 40 klst. á viku og öll vinna kl. 00–06.", ref: "gr. 1.7.1, 2.2.1" },
      { label: "Stórhátíðir", text: "+114,5 %.", ref: "gr. 1.8.1" },
      { label: "Útkall", text: "Minnst 4 klst.; útkall á bakvakt minnst 3 klst.", ref: "gr. 1.10.1, 2.4.9.4" },
      { label: "Hvíld", text: "11 klst. hvíld og mest 13 klst. vinna á sólarhring.", ref: "gr. 2.3.1" },
    ],
    orlof: ORLOF_MATVIS,
    unverified: ["Hvernig greitt er fyrir helgar- og helgidagavinnu innan 36 klst. er ekki reiknað sérstaklega — VAKTO greiðir dagvinnu nema yfirvinnumörk náist."],
    source: SRC.matvis,
  },
  {
    id: "matvis-vakt", preset: "Matvís – almenn vaktavinna", union: "Matvís", unionName: "Matvís", sector: "Matvæla- og veitingagreinar",
    title: "Almenn vaktavinna", kind: "vaktavinna", status: "partial",
    who: "Vaktavinnufólk í Matvís (annað en matreiðslu- og framreiðslumenn).",
    hours: "36 virkar klst. á viku (166,5 klst./mán. með neysluhléi), vaktir 4–12 klst.", validity: VALID,
    points: [
      { label: "Vetrarfrí", text: "12 dagar á ári, eða greitt 7,2 klst. fyrir hvern.", ref: "gr. 2.4.6–2.4.8" },
      { label: "Hvíld", text: "11 klst. hvíld og mest 13 klst. vinna á sólarhring.", ref: "gr. 2.3.1" },
    ],
    orlof: ORLOF_MATVIS,
    unverified: ["Samningurinn segir ekki hvort vinna umfram 100 % utan vaktaskrár greiðist sem yfirvinna 1 eða 2 — VAKTO notar 56 % frá 36 klst. og 79,4 % yfir 40 klst."],
    source: SRC.matvis,
  },
  {
    id: "matvis-matreidsla", preset: "Matvís – matreiðsla og framreiðsla, vaktavinna", union: "Matvís", unionName: "Matvís", sector: "Matvæla- og veitingagreinar",
    title: "Matreiðsla og framreiðsla — vaktavinna", kind: "vaktavinna", status: "partial",
    who: "Matreiðslu- og framreiðslumenn í vaktavinnu (sérákvæði frá 1.5.2024).",
    hours: "36 virkar klst. á viku.", validity: VALID,
    points: [
      { label: "Hærri grunnur", text: "Dagvinnukaup er 2 % hærra — skráðu hækkaðan taxta á starfsmanninn, álögin reiknast ofan á hann (dæmi samningsins: 3.498 → 3.568 kr → 4.674 kr með 31 %).", ref: "gr. 1.9.1" },
      { label: "Hvíld", text: "11 klst. hvíld og mest 13 klst. vinna á sólarhring.", ref: "gr. 2.3.1" },
    ],
    orlof: ORLOF_MATVIS,
    unverified: ["2 % hærri grunnur er ekki reiknaður sjálfkrafa — sláðu hann inn í taxtann.", "Yfirvinnuþrep í vaktavinnu (sjá almenna vaktavinnu)."],
    source: SRC.matvis,
  },
  {
    id: "matvis-legacy", preset: "Matvís", union: "Matvís", unionName: "Matvís", sector: "Matvæla- og veitingagreinar",
    title: "Matvís — vaktavinna (eldri staðall VAKTO)", kind: "vaktavinna", status: "partial", legacy: true,
    who: "Eldri staðall sem starfsfólk í VAKTO er þegar skráð á. Helst óbreyttur svo laun breytist ekki.",
    hours: "Yfirvinna yfir 40 klst. á viku.", validity: VALID,
    points: [{ label: "Athugið", text: "Reiknar ekki yfirvinnu 1 (56 % frá 36 klst.) — „Matvís – almenn vaktavinna“ gerir það." }],
    orlof: ORLOF_MATVIS,
    unverified: ["Yfirvinna 1 (36–40 klst.) er ekki reiknuð."],
    source: SRC.matvis,
  },

  // ---------- RSÍ ----------
  {
    id: "rsi-dagvinna", preset: "RSÍ – dagvinna", union: "RSÍ", unionName: "RSÍ", sector: "Rafiðnaður",
    title: "Rafiðnaðarmenn — dagvinna", kind: "dagvinna", status: "partial",
    who: "Rafiðnaðarmenn í dagvinnu hjá fyrirtækjum innan SA.",
    hours: "36 virkar klst. á viku innan 07–18 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna 1", text: "+56 % — fyrstu 4 klst. yfirvinnu á viku.", ref: "gr. 2.2.1" },
      { label: "Yfirvinna 2", text: "+79,4 % yfir 40 klst. á viku (39,5 frá 1.1.2025, 39 frá 1.1.2027) og öll vinna kl. 00–06.", ref: "gr. 2.2.1–2.2.2" },
      { label: "Stórhátíðir", text: "+114,5 %.", ref: "gr. 2.2.3, 2.9" },
      { label: "Útkall", text: "1 klst. + unninn tími, minnst 3 klst.; minnst 4 klst. kl. 00–06 og frá laugardegi kl. 17 til mánudags kl. 06.", ref: "gr. 2.3" },
      { label: "Hvíld", text: "11 klst. samfelld hvíld.", ref: "gr. 2.8.1" },
    ],
    orlof: ORLOF_IDN("gr. 4.1", "Iðnmenntaðir"),
    unverified: ["VAKTO greiðir 56 % fyrir vinnu utan dagvinnu þar til vikumörkum er náð, ekki nákvæmlega „fyrstu 4 klst.“.", "Dagvinnurammi 07–18 — ef ykkar dagvinna er t.d. 08–16, afritaðu regluna og stilltu."],
    source: SRC.rsi,
  },
  {
    id: "rsi-vakt", preset: "RSÍ – vaktavinna", union: "RSÍ", unionName: "RSÍ", sector: "Rafiðnaður",
    title: "Rafiðnaðarmenn — vaktavinna", kind: "vaktavinna", status: "partial",
    who: "Rafiðnaðarmenn í reglubundinni vaktavinnu.",
    hours: "36 virkar klst. á viku að meðaltali; neysluhlé 35 mín. á 8 klst. vakt.", validity: VALID,
    points: [
      { label: "Helgidagar", text: "Helgidagur á mán.–fös. gefur 7,2 dagvinnustundir aukalega (ekki reiknað sjálfkrafa).", ref: "gr. 2.7" },
      { label: "Hvíld", text: "11 klst. samfelld hvíld.", ref: "gr. 2.8.1" },
    ],
    orlof: ORLOF_IDN("gr. 4.1", "Iðnmenntaðir"),
    unverified: [
      "Stórhátíðarálag í vaktavinnu er ekki tilgreint — VAKTO notar helgarálagið 55 %.",
      "Hvort 55 % helgarálag eða 60 % næturálag gildir um helgarnætur er óljóst — VAKTO notar 55 %.",
      "Yfirvinnuprósenta í vaktavinnu — VAKTO notar 79,4 % yfir 36 klst.",
    ],
    source: SRC.rsi,
  },

  // ---------- Samiðn ----------
  {
    id: "samidn-dagvinna", preset: "Samiðn – dagvinna", union: "Samiðn", unionName: "Samiðn", sector: "Byggiðn og almenn iðnaðarstörf",
    title: "Byggiðn og almenn iðnaðarstörf — dagvinna", kind: "dagvinna", status: "partial",
    who: "Iðnaðarmenn í byggiðnum og almennum iðnaðarstörfum (Samiðn).",
    hours: "36 virkar klst. á viku innan 07–18 mán.–fös.", validity: VALID,
    points: [
      { label: "Yfirvinna 1 og 2", text: "+56 % og +79,4 % (yfir 40 → 39,5 frá 1.1.2025 → 39 frá 1.1.2027 klst. og kl. 00–06).", ref: "gr. 1.4.1, 2.2.1" },
      { label: "Stórhátíðir", text: "+114,5 %. Óunnir helgidagar mán.–fös. greiðast 7,2 klst.", ref: "gr. 1.4.2, 1.5.1" },
      { label: "Útkall", text: "1 klst. + unninn tími, minnst 3 klst.; 4,5 klst. á helgidögum.", ref: "gr. 1.8.1" },
      P.restIdn,
    ],
    orlof: ORLOF_IDN("gr. 4.1.2, 4.3", "Með sveinspróf"),
    unverified: ["Sama einföldun á yfirvinnu 1 og hjá RSÍ.", "Margfeldi frítökuréttar ekki staðfest."],
    source: SRC.samidn,
  },

  // ---------- VR ----------
  {
    id: "vr-verslun", preset: "VR – afgreiðsla í verslun", union: "VR", unionName: "VR", sector: "Verslun og skrifstofa",
    title: "Afgreiðslufólk í verslun", kind: "dagvinna", status: "verified",
    who: "Afgreiðslufólk í verslunum (VR/LÍV).",
    hours: "35 klst. 50 mín. virkar á viku, dagvinna 09–18 mán.–fös.", validity: VALID,
    points: [
      { label: "Helgarvinna", text: "Greiðist minnst 4 klst.", ref: "gr. 2.2.5" },
      { label: "Útkall", text: "Minnst 4 klst. á yfirvinnukaupi nema dagvinna hefjist innan 2 klst.", ref: "gr. 1.8" },
      P.rest,
    ],
    orlof: [ORLOF_VR],
    unverified: ["Yfirvinnumörkin 167,94 klst. eru talin yfir launatímabilið — miðað við mánaðarlegt tímabil."],
    source: SRC.vr,
  },
  {
    id: "vr-skrifstofa", preset: "VR – skrifstofu- og sölufólk", union: "VR", unionName: "VR", sector: "Verslun og skrifstofa",
    title: "Skrifstofu- og sölufólk", kind: "dagvinna", status: "partial",
    who: "Skrifstofu- og sölufólk (VR/LÍV).",
    hours: "35 klst. 30 mín. virkar á viku.", validity: VALID,
    points: [P.rest],
    orlof: [ORLOF_VR],
    unverified: ["Dagvinnuramminn (09–17) er ályktaður — samningurinn tilgreinir hann ekki beint (gr. 2.1.2)."],
    source: SRC.vr,
  },
  {
    id: "vr-legacy", preset: "VR", union: "VR", unionName: "VR", sector: "Verslun og skrifstofa",
    title: "VR — verslun (eldri staðall VAKTO)", kind: "dagvinna", status: "partial", legacy: true,
    who: "Eldri staðall sem starfsfólk í VAKTO er þegar skráð á. Helst óbreyttur svo laun breytist ekki.",
    hours: "Yfirvinna yfir 40 klst. á viku.", validity: VALID,
    points: [{ label: "Athugið", text: "Samningurinn miðar yfirvinnu við 167,94 klst. á mánuði — „VR – afgreiðsla í verslun“ gerir það." }],
    orlof: [ORLOF_VR], unverified: ["Yfirvinnumörk eru vikuleg (40 klst.) en ættu að vera mánaðarleg."],
    source: SRC.vr,
  },
  {
    id: "vr-skrifstofa-legacy", preset: "VR – skrifstofa", union: "VR", unionName: "VR", sector: "Verslun og skrifstofa",
    title: "VR — skrifstofa (eldri staðall VAKTO)", kind: "dagvinna", status: "partial", legacy: true,
    who: "Eldri staðall sem starfsfólk í VAKTO er þegar skráð á. Helst óbreyttur svo laun breytist ekki.",
    hours: "Yfirvinna yfir 40 klst. á viku.", validity: VALID,
    points: [{ label: "Athugið", text: "Samningurinn miðar yfirvinnu við 159,27 klst. á mánuði — „VR – skrifstofu- og sölufólk“ gerir það." }],
    orlof: [ORLOF_VR], unverified: ["Yfirvinnumörk eru vikuleg (40 klst.) en ættu að vera mánaðarleg; dagvinna 09–18."],
    source: SRC.vr,
  },
];

export const UNION_ORDER = ["Efling", "SGS", "VR", "Matvís", "RSÍ", "Samiðn"];

export function agreementById(id: string): Agreement | undefined {
  return AGREEMENTS_LIB.find((a) => a.id === id);
}
/** Afbrigðið sem lýsir staðli (UNION_PRESETS-lykli) — fyrsta sem ekki er eldra. */
export function agreementForPreset(preset: string): Agreement | undefined {
  return AGREEMENTS_LIB.find((a) => a.preset === preset && !a.legacy) ?? AGREEMENTS_LIB.find((a) => a.preset === preset);
}
export function rulesOf(a: Agreement): CustomRules {
  return UNION_PRESETS[a.preset];
}

// ---------- launareglur á mannamáli ----------
const DAY_SHORT = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const DAY_SHORT_EN = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const pc = (n: number) => `${String(Math.round(n * 100) / 100).replace(".", ",")} %`;
const hh = (h: number) => `${String(h).padStart(2, "0")}`;
const hrs = (n: number) => String(n).replace(".", ",");

export type PayLineDesc = { label: string; value: string; detail?: string };

/** Hvernig laun eru reiknuð eftir reglunni — línur á mannamáli (IS/EN). Sama vél og launakeyrslan les. */
export function describeRules(r: CustomRules, lang: "is" | "en" | string = "is"): PayLineDesc[] {
  const en = lang === "en";
  const T = (is: string, e: string) => (en ? e : is);
  const ds = r.dayStart ?? 8, de = r.dayEnd ?? 17, ne = r.nightEnd ?? 8;
  const out: PayLineDesc[] = [];
  out.push({ label: T("Dagvinna", "Day work"), value: `${hh(ds)}–${hh(de)}`, detail: T("mán.–fös., greitt á dagvinnutaxta", "Mon–Fri, paid at the day rate") });
  if (r.eve > 0) out.push({ label: T("Kvöld/utan dagvinnu", "Evenings/outside day work"), value: `+${pc(r.eve)}`, detail: `${T("virka daga", "weekdays")} ${r.night === r.eve || ne <= 0 ? (ds > 0 ? `00–${hh(ds)} ${T("og", "and")} ` : "") : ne < ds ? `${hh(ne)}–${hh(ds)} ${T("og", "and")} ` : ""}${hh(de)}–24` });
  if (r.night > 0 && ne > 0 && r.night !== r.eve) out.push({ label: T("Nætur", "Nights"), value: `+${pc(r.night)}`, detail: `${T("virka daga", "weekdays")} 00–${hh(ne)}` });
  if (r.weekend > 0) out.push({ label: T("Helgar", "Weekends"), value: `+${pc(r.weekend)}`, detail: r.fridagur != null ? T("laugardaga og sunnudaga", "Saturdays and Sundays") : T("laugardaga, sunnudaga og almenna frídaga", "Saturdays, Sundays and public holidays") });
  if (r.fridagur != null) out.push({ label: T("Almennir frídagar", "Public holidays"), value: `+${pc(r.fridagur)}`, detail: T("skírdagur, 1. maí, uppstigningardagur …", "Maundy Thursday, 1 May, Ascension …") });
  for (const b of r.bands ?? []) {
    const days = b.days.length === 7 ? T("alla daga", "every day") : b.days.map((d) => (en ? DAY_SHORT_EN : DAY_SHORT)[d]).join(", ");
    out.push({ label: b.label || T("Álag", "Premium"), value: `+${pc(b.pct)}`, detail: `${days} ${b.from}–${b.to}${b.key ? ` · ${b.key}` : ""}` });
  }
  out.push({ label: T("Stórhátíðir", "Major holidays"), value: `+${pc(r.holiday)}`, detail: T(`jól, páskar, 17. júní …${r.verslStor ? " og frídagur verslunarmanna" : ""}`, `Christmas, Easter, 17 June …${r.verslStor ? " and Commerce Day" : ""}`) });
  const weekly = r.otWeekly && r.otWeekly > 0 && r.otWeekly < 1000 ? r.otWeekly : r.otMonthly ? null : 40;
  const thr = [
    weekly != null ? T(`yfir ${hrs(weekly)} klst./viku`, `over ${hrs(weekly)} h/week`) : null,
    r.otMonthly ? T(`yfir ${hrs(r.otMonthly)} klst./mán.`, `over ${hrs(r.otMonthly)} h/month`) : null,
  ].filter(Boolean).join(T(" eða ", " or "));
  if (r.ot1Weekly && r.ot1Pct != null) out.push({ label: T("Yfirvinna 1", "Overtime 1"), value: `+${pc(r.ot1Pct)}`, detail: T(`frá ${hrs(r.ot1Weekly)} klst./viku`, `from ${hrs(r.ot1Weekly)} h/week`) });
  out.push({ label: r.ot1Weekly ? T("Yfirvinna 2", "Overtime 2") : T("Yfirvinna", "Overtime"), value: `+${pc(r.overtime)}`, detail: thr });
  for (const st of r.otSteps ?? []) out.push({ label: T("Ný yfirvinnumörk", "New overtime threshold"), value: `${hrs(st.weekly)} ${T("klst.", "h")}`, detail: `${T("frá", "from")} ${st.from.split("-").reverse().join(".")}` });
  if (r.graceMin) out.push({ label: T("Svigrúm", "Grace period"), value: `${r.graceMin} ${T("mín.", "min")}`, detail: T("stimplun nálægt upphafi/lokum dagvinnu færist á mörkin", "punches near day-work start/end snap to it") });
  return out;
}
