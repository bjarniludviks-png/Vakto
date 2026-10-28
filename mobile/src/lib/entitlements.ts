// AFRIT af src/lib/entitlements.ts (vefurinn) — breyttu báðum saman.
// Réttindi starfsmanns skv. kjarasamningi: orlofsdagar/-prósenta, veikindaréttur og veikindi barna.
// Hreinn útreikningur (vefur + app). Hver regla vísar í grein samningsins sem hún kemur úr.
//
// Lesið 27. okt. 2026:
//  • SGS og SA 2024–2028 (aðalkjarasamningur, gildir líka um greiðasölusamninginn — hótel/veitingar):
//    gr. 4.1.1–4.1.2 orlof, gr. 8.1 laun í veikindum, gr. 8.5.1 veikindi barna.
//    Efling og SA: sömu greinar og SGS (ekki lesið sérstaklega — Efling lokar á niðurhal skjalsins).
//  • VR/LÍV og SA (vr.is → Orlofsréttur, Veikindaréttur): orlof frá orlofsárinu 1.5.2025, veikindi, veikindi barna.
// Félög sem ekki eru hér (Matvís, iðnaðarmenn, opinberir) fá ENGA ágiskun — UI segir að réttindi vanti.
//
// Einföldun sem UI tekur fram: starfsaldur = frá ráðningardegi (hire_date) hjá þessu fyrirtæki. Áunninn réttur
// frá fyrri vinnuveitanda (t.d. 10 ár í starfsgrein, flutningur veikindaréttar) er ekki þekktur kerfinu.

export type RightsFamily = "sa-sgs" | "sa-vr";

export type AgreementInfo = { family: RightsFamily; name: string; source: string; url: string };

export const AGREEMENTS: Record<RightsFamily, AgreementInfo> = {
  "sa-sgs": {
    family: "sa-sgs",
    name: "SGS / Efling og SA 2024–2028",
    source: "Kjarasamningur SGS og SA 2024–2028, gr. 4.1, 8.1 og 8.5",
    url: "https://www.sgs.is/kjaramal/almennur-vinnumarkadur/kjarasamningar/adalkjarasamningur-sgs-og-sa/",
  },
  "sa-vr": {
    family: "sa-vr",
    name: "VR / LÍV og SA 2024–2028",
    source: "VR: Orlofsréttur og Veikindaréttur (vr.is), kjarasamningur VR og SA",
    url: "https://www.vr.is/kjaramal/orlofsrettur/",
  },
};

const SGS_UNIONS = [
  "efling", "sgs", "afl", "eining-iðja", "framsýn", "báran", "drífandi", "aldan", "verkalýðsfélag akraness",
  "verkalýðsfélag vestfirðinga", "verkalýðsfélag suðurlands", "hlíf", "stéttarfélag vesturlands", "starfsgreina",
  // Önnur aðildarfélög SGS
  "verkalýðs- og sjómannafélag keflavíkur", "vsfk", "verkalýðs- og sjómannafélag sandgerðis", "verkalýðsfélag grindavíkur",
  "verkalýðsfélag þórshafnar", "stéttarfélagið samstaða", "verkalýðsfélagið hvöt", "verkalýðsfélag snæfellinga",
];
const VR_UNIONS = ["vr", "félag verslunar- og skrifstofufólks", "lív", "landssamband íslenskra verzlunarmanna"];

/** Réttindaflokkur út frá stéttarfélagi starfsmanns; null = ekki komið inn (engin ágiskun). */
export function familyFor(union: string | null | undefined): RightsFamily | null {
  const u = (union ?? "").trim().toLowerCase();
  if (!u) return null;
  if (VR_UNIONS.some((x) => u === x || u.startsWith(x + " ") || u.startsWith(x))) return "sa-vr";
  if (SGS_UNIONS.some((x) => u.includes(x))) return "sa-sgs";
  return null;
}

// ---------- dagsetningar ----------
const pad = (n: number) => String(n).padStart(2, "0");
export const isoDate = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (s: string) => new Date(`${s.slice(0, 10)}T12:00:00`);
/** Dagsetning N mánuðum (og/eða árum) eftir `from`. */
export function addMonths(from: string, months: number): string {
  const d = parse(from);
  const day = d.getDate();
  d.setDate(1); d.setMonth(d.getMonth() + months);
  d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
  return isoDate(d);
}
/** Heilir mánuðir frá `from` til `to` (unnir mánuðir). */
export function monthsBetween(from: string, to: string): number {
  if (!from || !to || to < from) return 0;
  const a = parse(from), b = parse(to);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m--;
  return Math.max(0, m);
}

/** Fæðingardagur úr kennitölu (DDMMÁÁ-RRVÖ, síðasti stafur = öld: 9 → 1900, 0 → 2000, 8 → 1800). */
export function birthDateFromKennitala(kt: string | null | undefined): string | null {
  const d = (kt ?? "").replace(/\D/g, "");
  if (d.length !== 10) return null;
  const day = Number(d.slice(0, 2)), mon = Number(d.slice(2, 4)), yy = Number(d.slice(4, 6)), c = d[9];
  // Kennitölur fyrirtækja byrja á 41–71 (dagur + 40) — ekki fæðingardagur.
  if (day < 1 || day > 31 || mon < 1 || mon > 12) return null;
  const century = c === "9" ? 1900 : c === "0" ? 2000 : c === "8" ? 1800 : null;
  if (!century) return null;
  return `${century + yy}-${pad(mon)}-${pad(day)}`;
}

// ---------- orlof ----------
export type OrlofTier = { days: number; pct: number; reason: string; ref: string };
export type OrlofRight = { now: OrlofTier; next: (OrlofTier & { from: string }) | null; family: RightsFamily };

/** Orlofsréttur á dagsetningu `asOf` (orlof sem ávinnst þá). `birth` = fæðingardagur (22 ára reglan). */
export function orlofRight(input: { family: RightsFamily; hireDate: string | null; birth: string | null; asOf?: string }): OrlofRight {
  const asOf = input.asOf ?? isoDate(new Date());
  const tiers = orlofTiers(input.family, input.hireDate, input.birth);
  const reached = tiers.filter((t) => t.from <= asOf);
  const now = reached.length ? reached[reached.length - 1] : tiers[0];
  const next = tiers.find((t) => t.from > asOf && t.days > now.days) ?? null;
  const strip = (t: (typeof tiers)[number]): OrlofTier => ({ days: t.days, pct: t.pct, reason: t.reason, ref: t.ref });
  return { now: strip(now), next: next ? { ...strip(next), from: next.from } : null, family: input.family };
}

function orlofTiers(family: RightsFamily, hire: string | null, birth: string | null): (OrlofTier & { from: string })[] {
  const base = { days: 24, pct: 10.17, reason: "Lágmarksorlof", from: "0000-01-01" };
  const out: (OrlofTier & { from: string })[] = [];
  const later = (...ds: (string | null)[]) => (ds.some((d) => !d) ? null : ds.reduce((a, b) => (a! > b! ? a : b)));
  if (family === "sa-sgs") {
    out.push({ ...base, ref: "SGS gr. 4.1.1" });
    // 22 ára + 6 mánuðir í sama fyrirtæki → 25 dagar (gildir frá 1.5.2024).
    const age22 = birth ? addMonths(birth, 22 * 12) : null;
    const t25 = later(hire ? addMonths(hire, 6) : null, age22, "2024-05-01");
    if (t25) out.push({ days: 25, pct: 10.64, reason: "22 ára og 6 mánuðir í sama fyrirtæki", ref: "SGS gr. 4.1.1", from: t25 });
    // 5 ár í sama fyrirtæki → 28 dagar (ávinnsla frá 1.5.2025); 10 ár → 30 dagar.
    if (hire) out.push({ days: 28, pct: 12.07, reason: "5 ár í sama fyrirtæki", ref: "SGS gr. 4.1.2", from: later(addMonths(hire, 60), "2025-05-01")! });
    if (hire) out.push({ days: 30, pct: 13.04, reason: "10 ár í sama fyrirtæki", ref: "SGS gr. 4.1.2", from: later(addMonths(hire, 120), "2025-05-01")! });
  } else {
    out.push({ ...base, ref: "VR/SA" });
    // 6 mánuðir í sama fyrirtæki og 22 ára (eða framhaldsskólapróf — kerfið veit það ekki) → 25 dagar.
    const age22 = birth ? addMonths(birth, 22 * 12) : null;
    const t25 = later(hire ? addMonths(hire, 6) : null, age22);
    if (t25) out.push({ days: 25, pct: 10.64, reason: "6 mánuðir í sama fyrirtæki og 22 ára", ref: "VR/SA", from: t25 });
    if (hire) out.push({ days: 28, pct: 12.07, reason: "4 ár í sama fyrirtæki", ref: "VR/SA", from: addMonths(hire, 48) });
    if (hire) out.push({ days: 30, pct: 13.04, reason: "6 ár í sama fyrirtæki", ref: "VR/SA", from: addMonths(hire, 72) });
  }
  return out.sort((a, b) => a.from.localeCompare(b.from) || a.days - b.days);
}

// ---------- veikindi ----------
/** Mánuður af veikindarétti í vinnudögum (260 / 12) — til að bera saman við skráða veikindadaga. */
export const WORKDAYS_PER_MONTH = 260 / 12;

export type SickPart = { months: number; pay: "staðgengilslaun" | "fullt dagvinnukaup" | "dagvinnulaun" };
export type SickRight = {
  family: RightsFamily;
  /** Heildarréttur á 12 mánaða tímabili í vinnudögum. */
  days: number;
  /** Á fyrsta ári: 2 dagar per unninn mánuð; annars mánuðir. */
  label: string;
  parts: SickPart[];
  ref: string;
  next: { from: string; label: string } | null;
};

export function sickRight(input: { family: RightsFamily; hireDate: string | null; asOf?: string }): SickRight {
  const asOf = input.asOf ?? isoDate(new Date());
  const hire = input.hireDate;
  const months = hire ? monthsBetween(hire, asOf) : 0;
  const fam = input.family;
  type Tier = { afterYears: number; parts: SickPart[] };
  const tiers: Tier[] = fam === "sa-sgs" ? [
    { afterYears: 1, parts: [{ months: 1, pay: "staðgengilslaun" }] },
    { afterYears: 2, parts: [{ months: 1, pay: "staðgengilslaun" }, { months: 1, pay: "dagvinnulaun" }] },
    { afterYears: 3, parts: [{ months: 1, pay: "staðgengilslaun" }, { months: 2, pay: "dagvinnulaun" }] },
    { afterYears: 5, parts: [{ months: 1, pay: "staðgengilslaun" }, { months: 1, pay: "fullt dagvinnukaup" }, { months: 2, pay: "dagvinnulaun" }] },
  ] : [
    // VR: tveir mánuðir eftir 1 ár, fjórir eftir 5 ár, sex eftir 10 ár (á hverju 12 mánaða tímabili).
    { afterYears: 1, parts: [{ months: 2, pay: "staðgengilslaun" }] },
    { afterYears: 5, parts: [{ months: 4, pay: "staðgengilslaun" }] },
    { afterYears: 10, parts: [{ months: 6, pay: "staðgengilslaun" }] },
  ];
  const ref = fam === "sa-sgs" ? "SGS gr. 8.1" : "VR/SA";
  const total = (p: SickPart[]) => p.reduce((a, x) => a + x.months, 0);
  const mlabel = (n: number) => `${n} ${n === 1 ? "mánuður" : "mánuðir"}`;
  const reached = tiers.filter((t) => months >= t.afterYears * 12);
  const cur = reached[reached.length - 1];
  const nextTier = tiers.find((t) => months < t.afterYears * 12);
  const next = hire && nextTier ? { from: addMonths(hire, nextTier.afterYears * 12), label: mlabel(total(nextTier.parts)) } : null;
  if (!cur) {
    // Fyrsta starfsár: 2 dagar fyrir hvern unninn mánuð.
    const d = 2 * months;
    return { family: fam, days: d, label: `${d} dagar (2 á hvern unninn mánuð)`, parts: [], ref, next };
  }
  const m = total(cur.parts);
  return { family: fam, days: Math.round(m * WORKDAYS_PER_MONTH), label: mlabel(m), parts: cur.parts, ref, next };
}

/** Veikindi barna: fyrstu 6 mánuði 2 dagar per unninn mánuð, svo 12 dagar á hverju 12 mánaða tímabili (SGS gr. 8.5.1, VR). */
export function childSickRight(input: { hireDate: string | null; asOf?: string }): { days: number; label: string; ref: string } {
  const asOf = input.asOf ?? isoDate(new Date());
  const months = input.hireDate ? monthsBetween(input.hireDate, asOf) : 0;
  if (months < 6) return { days: 2 * months, label: `${2 * months} dagar (2 á hvern unninn mánuð fyrstu 6 mánuði)`, ref: "SGS gr. 8.5.1 / VR" };
  return { days: 12, label: "12 dagar á hverju 12 mánaða tímabili", ref: "SGS gr. 8.5.1 / VR" };
}

/** Vinnudagar (mán–fös) í bilinu [from, to] sem lenda innan [winFrom, winTo]. */
export function workdaysIn(from: string, to: string, winFrom: string, winTo: string): number {
  const a = from < winFrom ? winFrom : from, b = to > winTo ? winTo : to;
  if (b < a) return 0;
  let n = 0;
  const d = parse(a), end = parse(b);
  while (d <= end) { const wd = d.getDay(); if (wd !== 0 && wd !== 6) n++; d.setDate(d.getDate() + 1); }
  return n;
}
