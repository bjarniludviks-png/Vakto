// Launareglur (vél) fyrir afbrigði kjarasamninga í Kjarasamningasafninu. Hreint gagnasafn — vefur og app
// (mobile/src/lib/agreement-presets.ts er AFRIT, breyttu báðum saman). Lýsing, heimildir og staða
// (staðfest/að hluta/óstaðfest) hvers afbrigðis eru í src/lib/agreements.ts.
//
// Lesið úr lokaskjölum samninga SA 2024–2028 á sa.is 11. nóv. 2026. Prósentur eru álag ofan á
// dagvinnutímakaup; „% af mánaðarlaunum á klst.“ er umreiknað: álag = % × deilitala − 100 %.
// Lyklarnir eru heiti sem birtast í vali og geymast í employees.union_agreement / pay_rule.agreement —
// ALDREI breyta heiti eða tölum lykils sem er í notkun (laun starfsfólks myndu breytast). Ný útgáfa = nýr lykill.

import type { CustomRules } from "@/lib/payrules";

/** Vikumörk sem virka ekki — yfirvinna ræðst þá eingöngu af mánaðarmörkum (otMonthly). */
const NO_WEEKLY = 1000;
const ALL_DAYS = [0, 1, 2, 3, 4, 5, 6];
/** RSÍ og Samiðn: yfirvinna 2 yfir 40 klst., 39,5 frá 1.1.2025 og 39 frá 1.1.2027. */
const IDN_STEPS = [{ from: "2025-01-01", weekly: 39.5 }, { from: "2027-01-01", weekly: 39 }];

export const AGREEMENT_PRESETS: Record<string, CustomRules> = {
  // ---- Efling / SGS — almennur (aðal)kjarasamningur, dagvinna (gr. 1.4, 1.6.1–1.6.2, 2.1–2.3) ----
  // Utan dagvinnu, um helgar og á frídögum er yfirvinna (+80 %), stórhátíðir +138,3 %.
  "Efling – almennur, dagvinna": { eve: 80, weekend: 80, night: 80, overtime: 80, holiday: 138.3, dayStart: 8, dayEnd: 17, nightEnd: 8 },
  "SGS – aðalkjarasamningur, dagvinna": { eve: 80, weekend: 80, night: 80, overtime: 80, holiday: 138.3, dayStart: 8, dayEnd: 17, nightEnd: 8 },

  // ---- Hótel- og veitingahús (Efling) / greiðasala (SGS): deilitala 172 → yfirvinna +78,6 %, stórhátíð +136,5 % ----
  "Efling – hótel og veitingar, dagvinna": { eve: 78.6, weekend: 78.6, night: 78.6, overtime: 78.6, holiday: 136.5, dayStart: 8, dayEnd: 17, nightEnd: 8 },
  "SGS – veitingar og hótel, dagvinna": { eve: 78.6, weekend: 78.6, night: 78.6, overtime: 78.6, holiday: 136.5, dayStart: 8, dayEnd: 17, nightEnd: 8 },
  // Vaktavinna 40 klst. = staðallinn „Efling – veitingar/SGS“ (gr. 3.2.1–3.2.4). 38 klst.: eingöngu kvöld-/næturvaktir
  // fimm daga vikunnar innan 17–08 (gr. 3.1.1) — sömu álög, yfirvinna yfir 38 klst.
  "Efling – hótel og veitingar, vaktavinna 38 klst": { eve: 33, weekend: 45, night: 45, overtime: 78.6, holiday: 90, otWeekly: 38 },
  "SGS – veitingar og hótel, vaktavinna 38 klst": { eve: 33, weekend: 45, night: 45, overtime: 78.6, holiday: 90, otWeekly: 38 },
  // Efling eingöngu: skemmtistaðir, krár og dansstaðir — 55 % kl. 00–05 aðfaranætur laugardags og sunnudags (gr. 3.2.1).
  "Efling – skemmtistaðir, vaktavinna 40 klst": {
    eve: 33, weekend: 45, night: 45, overtime: 78.6, holiday: 90,
    bands: [{ label: "Næturálag skemmtistaða", days: [6, 0], from: "00:00", to: "05:00", pct: 55 }],
  },

  // ---- Matvís (deilitala 156): yfirvinna 1 = +56 % (umfram 36 virkar klst.), yfirvinna 2 = +79,4 % (yfir 40 klst. og 00–06) ----
  "Matvís – dagvinna": {
    eve: 0, weekend: 0, night: 0, overtime: 79.4, holiday: 114.5, dayStart: 7, dayEnd: 18, nightEnd: 0,
    ot1Weekly: 36, ot1Pct: 56,
    bands: [{ label: "Yfirvinna 2 (00–06)", days: ALL_DAYS, from: "00:00", to: "06:00", pct: 79.4 }],
  },
  "Matvís – almenn vaktavinna": { eve: 33, weekend: 45, night: 45, overtime: 79.4, holiday: 90, fridagur: 45, ot1Weekly: 36, ot1Pct: 56 },
  // Matreiðslu- og framreiðslumenn í vaktavinnu (gr. 1.9.1): 31 % virka daga 17–24 og um helgar 08–24, 45 % 00–08.
  // Grunnkaupið er 2 % hærra — slá þarf inn hækkaðan taxta á starfsmanninn.
  "Matvís – matreiðsla og framreiðsla, vaktavinna": {
    eve: 31, weekend: 31, night: 45, overtime: 79.4, holiday: 90, fridagur: 45, ot1Weekly: 36, ot1Pct: 56,
    bands: [{ label: "Næturálag um helgar", days: [6, 0], from: "00:00", to: "08:00", pct: 45 }],
  },

  // ---- RSÍ (rafiðnaðarmenn, deilitala 156) ----
  // Dagvinna 36 virkar klst. innan 07–18; yfirvinna utan dagvinnu og um helgar (Y1 56 %), Y2 79,4 % yfir vikumörkum og 00–06.
  "RSÍ – dagvinna": {
    eve: 56, weekend: 56, night: 56, overtime: 79.4, holiday: 114.5, dayStart: 7, dayEnd: 18, nightEnd: 7,
    ot1Weekly: 36, ot1Pct: 56, otSteps: IDN_STEPS,
    bands: [{ label: "Yfirvinna 2 (00–06)", days: ALL_DAYS, from: "00:00", to: "06:00", pct: 79.4 }],
  },
  // Vaktavinna (gr. 2.7): 30 % virka daga 16–24, 55 % laugardaga og sunnudaga, 60 % 00–08.
  "RSÍ – vaktavinna": { eve: 30, weekend: 55, night: 60, overtime: 79.4, holiday: 55, dayStart: 8, dayEnd: 16, nightEnd: 8, otWeekly: 36 },

  // ---- Samiðn (byggiðn og almenn iðnaðarstörf, deilitala 156) — sama uppbygging og RSÍ dagvinna ----
  "Samiðn – dagvinna": {
    eve: 56, weekend: 56, night: 56, overtime: 79.4, holiday: 114.5, dayStart: 7, dayEnd: 18, nightEnd: 7,
    ot1Weekly: 36, ot1Pct: 56, otSteps: IDN_STEPS,
    bands: [{ label: "Yfirvinna 2 (00–06)", days: ALL_DAYS, from: "00:00", to: "06:00", pct: 79.4 }],
  },

  // ---- VR / LÍV: eftirvinna/næturvinna upp að mánaðarmörkum, yfirvinna yfir þeim ----
  // Afgreiðslufólk í verslun (deilitala 167,94): eftirvinna 38,3 %, næturvinna 00–07 48,2 %, yfirvinna 74,4 % yfir
  // 167,94 klst./mán., stórhátíð 130,9 % — frídagur verslunarmanna er stórhátíðardagur (gr. 2.3.2).
  "VR – afgreiðsla í verslun": { eve: 38.3, weekend: 38.3, night: 48.2, overtime: 74.4, holiday: 130.9, nightEnd: 7, dayStart: 9, dayEnd: 18, verslStor: true, otWeekly: NO_WEEKLY, otMonthly: 167.94 },
  // Skrifstofu- og sölufólk (deilitala 159,27): 39,4 / 49,3 / 65,4 % / stórhátíð 119 %. Dagvinna 09–17 (óstaðfest).
  "VR – skrifstofu- og sölufólk": { eve: 39.4, weekend: 39.4, night: 49.3, overtime: 65.4, holiday: 119, nightEnd: 7, dayStart: 9, dayEnd: 17, verslStor: true, otWeekly: NO_WEEKLY, otMonthly: 159.27 },
};
