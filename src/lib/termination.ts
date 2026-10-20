// Starfslok / Ljúka ráðningu (migration 0088) — hreinar týpur, tillaga að uppsagnarfresti og
// texti bréfsins. Öruggt í Client Components. VAKTO skráir það sem vinnuveitandinn velur;
// þetta er EKKI lögfræðiráðgjöf og tillagan er alltaf breytanleg.

export type TerminationReason = "employee_resigned" | "employer_terminated" | "mutual" | "fixed_term_end" | "summary_dismissal" | "other";
export type NoticeUnit = "none" | "days" | "weeks" | "months";
export type DocumentMode = "sign" | "send" | "upload" | "none";
export type ShiftAction = "keep" | "unassign" | "delete";

export const REASONS: TerminationReason[] = ["employee_resigned", "employer_terminated", "mutual", "fixed_term_end", "summary_dismissal", "other"];
export const ACCESS_MONTHS = [0, 3, 12, 24] as const;

/** Heiti í viðmóti (lykill í DICT, sjá termination-dict.ts). */
export const REASON_LABEL: Record<TerminationReason, string> = {
  employee_resigned: "Starfsmaður sagði upp",
  employer_terminated: "Fyrirtækið sagði upp",
  mutual: "Gagnkvæmt samkomulag",
  fixed_term_end: "Tímabundinn samningur rann út",
  summary_dismissal: "Riftun",
  other: "Annað",
};

/** Stutt heiti í borða/pillu („Hættir 31.10.2026 · Uppsögn starfsmanns“). */
export const REASON_SHORT: Record<TerminationReason, string> = {
  employee_resigned: "Uppsögn starfsmanns",
  employer_terminated: "Uppsögn fyrirtækis",
  mutual: "Samkomulag",
  fixed_term_end: "Tímabundinn samningur",
  summary_dismissal: "Riftun",
  other: "Annað",
};

/** Ástæður þar sem innri athugasemd er skylda. */
export const NOTE_REQUIRED: TerminationReason[] = ["summary_dismissal", "other"];

export const isReason = (v: unknown): v is TerminationReason => typeof v === "string" && (REASONS as string[]).includes(v);

/* ---------------- dagsetningar (ISO YYYY-MM-DD, staðartími án tímabelta) ---------------- */

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const parse = (iso: string) => { const [y, m, d] = iso.split("-").map(Number); return new Date(y, m - 1, d); };
export const okIso = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(parse(v).getTime());
export function addDays(iso: string, n: number): string { const d = parse(iso); d.setDate(d.getDate() + n); return isoOf(d); }
/** Síðasti dagur mánaðarins `n` mánuðum eftir mánuð `iso` (uppsögn miðast við mánaðamót). */
export function endOfMonthPlus(iso: string, n: number): string { const d = parse(iso); return isoOf(new Date(d.getFullYear(), d.getMonth() + n + 1, 0)); }
export function addMonths(iso: string, n: number): string {
  const d = parse(iso);
  const day = d.getDate();
  const t = new Date(d.getFullYear(), d.getMonth() + n, 1);
  t.setDate(Math.min(day, new Date(t.getFullYear(), t.getMonth() + 1, 0).getDate()));
  return isoOf(t);
}
/** 31.10.2026 */
export function isDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}.${m}.${y}`;
}
function monthsBetween(fromIso: string, toIso: string): number {
  const a = parse(fromIso), b = parse(toIso);
  let m = (b.getFullYear() - a.getFullYear()) * 12 + (b.getMonth() - a.getMonth());
  if (b.getDate() < a.getDate()) m -= 1;
  return Math.max(0, m);
}

/* ---------------- uppsagnarfrestur ---------------- */

export type NoticeSuggestion = { value: number; unit: NoticeUnit; basis: string; tenureMonths: number | null };

/** Síðasti starfsdagur út frá tilkynningardegi og fresti. Mánuðir miðast við mánaðamót
 *  (frestur hefst um næstu mánaðamót), vikur/dagar telja frá tilkynningardegi. */
export function computeLastDay(noticeDate: string, value: number, unit: NoticeUnit): string {
  if (!okIso(noticeDate)) return noticeDate;
  const v = Math.max(0, Math.round(value || 0));
  if (unit === "months" && v > 0) return endOfMonthPlus(noticeDate, v);
  if (unit === "weeks" && v > 0) return addDays(noticeDate, v * 7);
  if (unit === "days" && v > 0) return addDays(noticeDate, v);
  return noticeDate;
}

const isVR = (u: string) => /^(VR|LÍV)\b/i.test(u) || /verslunar/i.test(u);

/**
 * Tillaga að uppsagnarfresti út frá starfstíma og ALMENNUM ákvæðum algengustu kjarasamninga
 * (gagnkvæmur frestur, miðast við mánaðamót). VAKTO geymir ekki uppsagnarákvæði einstakra
 * samninga, svo þetta er upphafspunktur — vinnuveitandinn staðfestir og breytir ef við á.
 *   * VR/LÍV–SA: reynslutími (fyrstu 3 mán.) 1 vika · eftir 3 mán. 1 mánuður · eftir 6 mán. 3 mánuðir.
 *   * SGS/Efling og aðrir (sjálfgefið): fyrstu 3 mán. 1 vika · eftir 3 mán. 1 mánuður ·
 *     eftir 2 ár 2 mánuðir · eftir 3 ár 3 mánuðir.
 * Riftun, samkomulag og tímabundinn samningur: enginn frestur (dagsetning valin).
 */
export function suggestNotice(reason: TerminationReason, union: string | null | undefined, hireDate: string | null | undefined, noticeDate: string): NoticeSuggestion {
  const tenure = hireDate && okIso(hireDate.slice(0, 10)) ? monthsBetween(hireDate.slice(0, 10), noticeDate) : null;
  if (reason === "summary_dismissal") return { value: 0, unit: "none", basis: "Riftun: enginn uppsagnarfrestur", tenureMonths: tenure };
  if (reason === "mutual") return { value: 0, unit: "none", basis: "Samkomulag: aðilar velja síðasta starfsdag", tenureMonths: tenure };
  if (reason === "fixed_term_end") return { value: 0, unit: "none", basis: "Tímabundinn samningur: síðasti dagur samningsins", tenureMonths: tenure };
  const u = union ?? "";
  const t = tenure ?? 0;
  const vr = isVR(u);
  let value = 1, unit: NoticeUnit = "weeks";
  if (vr) {
    if (t >= 6) { value = 3; unit = "months"; } else if (t >= 3) { value = 1; unit = "months"; }
  } else {
    if (t >= 36) { value = 3; unit = "months"; } else if (t >= 24) { value = 2; unit = "months"; } else if (t >= 3) { value = 1; unit = "months"; }
  }
  const scheme = vr ? "almenn ákvæði VR/LÍV–SA" : u && u !== "Eigin reglur" ? `almenn ákvæði SGS/Eflingar–SA (${u})` : "almenn ákvæði kjarasamninga SA";
  const ten = tenure == null ? "starfstími óþekktur (upphafsdag vantar)" : `starfstími ${tenure < 12 ? `${tenure} mán.` : `${Math.floor(tenure / 12)} ár${tenure % 12 ? ` og ${tenure % 12} mán.` : ""}`}`;
  return { value, unit, basis: `${ten} · ${scheme}`, tenureMonths: tenure };
}

export function noticeLabel(value: number, unit: NoticeUnit, en = false): string {
  if (unit === "none" || !value) return en ? "None" : "Enginn";
  if (en) return `${value} ${unit === "months" ? (value === 1 ? "month" : "months") : unit === "weeks" ? (value === 1 ? "week" : "weeks") : value === 1 ? "day" : "days"}`;
  return `${value} ${unit === "months" ? (value === 1 ? "mánuður" : "mánuðir") : unit === "weeks" ? (value === 1 ? "vika" : "vikur") : value === 1 ? "dagur" : "dagar"}`;
}

/** Fyrsti dagur sem vaktir eru teknar af: daginn eftir síðasta dag, eða upphaf lausnar undan vinnuskyldu. */
export function shiftCutoff(lastDay: string, gardenLeave: boolean, gardenFrom: string | null | undefined): string {
  const after = addDays(lastDay, 1);
  if (gardenLeave && gardenFrom && okIso(gardenFrom) && gardenFrom < after) return gardenFrom;
  return after;
}

/* ---------------- bréfið ---------------- */

export type LetterInput = {
  reason: TerminationReason;
  company: { name: string; kennitala?: string | null; address?: string | null };
  employee: { name: string; kennitala?: string | null; title?: string | null; address?: string | null };
  noticeDate: string;
  noticeValue: number;
  noticeUnit: NoticeUnit;
  lastDay: string;
  gardenLeave: boolean;
  gardenFrom?: string | null;
  signed: boolean; // undirritað rafrænt (a) eða aðeins sent (b)
};

const LETTER_TITLE: Record<TerminationReason, string> = {
  employee_resigned: "Staðfesting á uppsögn starfsmanns / Confirmation of resignation",
  employer_terminated: "Uppsagnarbréf / Notice of termination",
  mutual: "Samkomulag um starfslok / Agreement on end of employment",
  fixed_term_end: "Staðfesting starfsloka / Confirmation of end of employment",
  summary_dismissal: "Tilkynning um riftun ráðningarsamnings / Notice of summary dismissal",
  other: "Staðfesting starfsloka / Confirmation of end of employment",
};

/** Titill (íslenski hlutinn) — notaður sem contracts.title / skjalaheiti. */
export const letterTitleIs = (r: TerminationReason) => LETTER_TITLE[r].split(" / ")[0];

const kt = (v?: string | null) => { const d = (v ?? "").replace(/\D/g, ""); return d.length === 10 ? `${d.slice(0, 6)}-${d.slice(6)}` : ""; };

/** Texti bréfsins á sama sniði og ráðningarsamningar (# titill, ## kaflar, **heiti:** gildi) svo
 *  sama PDF-útlit og undirritunarferli (0058/Taktikal) virki óbreytt. Hlutlaust orðalag per ástæðu. */
export function buildLetter(i: LetterInput): string {
  const nd = isDate(i.noticeDate), ld = isDate(i.lastDay);
  const ktC = kt(i.company.kennitala), ktE = kt(i.employee.kennitala);
  const period = `${noticeLabel(i.noticeValue, i.noticeUnit)} / ${noticeLabel(i.noticeValue, i.noticeUnit, true)}`;
  const body: Record<TerminationReason, string> = {
    employee_resigned: `${i.company.name} staðfestir að hafa móttekið uppsögn ${i.employee.name} dags. ${nd}. Ráðningarsambandinu lýkur við lok síðasta starfsdags, ${ld}.\n_${i.company.name} confirms receipt of ${i.employee.name}'s resignation dated ${nd}. The employment ends at the close of the last working day, ${ld}._`,
    employer_terminated: `${i.company.name} segir hér með upp ráðningarsamningi ${i.employee.name} með uppsagnarfresti samkvæmt ráðningarsamningi og kjarasamningi. Uppsögnin miðast við ${nd} og síðasti starfsdagur er ${ld}.\n_${i.company.name} hereby gives ${i.employee.name} notice of termination of the contract of employment, with notice as provided by the employment contract and collective agreement. Notice is given on ${nd} and the last working day is ${ld}._`,
    mutual: `${i.company.name} og ${i.employee.name} hafa gert með sér samkomulag um að ráðningarsambandi þeirra ljúki. Síðasti starfsdagur er ${ld}.\n_${i.company.name} and ${i.employee.name} have agreed to end the employment relationship. The last working day is ${ld}._`,
    fixed_term_end: `Tímabundinn ráðningarsamningur ${i.employee.name} við ${i.company.name} rennur út ${ld} og ráðningarsambandinu lýkur þá.\n_${i.employee.name}'s fixed-term contract of employment with ${i.company.name} expires on ${ld}, and the employment ends then._`,
    summary_dismissal: `${i.company.name} riftir hér með ráðningarsamningi ${i.employee.name} frá og með ${ld}. Ráðningarsambandinu lýkur þann dag.\n_${i.company.name} hereby terminates ${i.employee.name}'s contract of employment with immediate effect from ${ld}. The employment ends on that day._`,
    other: `Ráðningarsambandi ${i.company.name} og ${i.employee.name} lýkur. Síðasti starfsdagur er ${ld}.\n_The employment relationship between ${i.company.name} and ${i.employee.name} ends. The last working day is ${ld}._`,
  };
  const duty = i.gardenLeave
    ? `Laus undan vinnuskyldu frá ${isDate(i.gardenFrom || i.noticeDate)} / Released from duty to work from ${isDate(i.gardenFrom || i.noticeDate)}`
    : "Vinnur út síðasta starfsdag / Works until the last working day";
  const sigNote = i.reason === "mutual"
    ? "Með undirritun sinni staðfesta báðir aðilar samkomulagið.\n_By signing, both parties confirm the agreement._"
    : "Undirritun starfsmanns staðfestir móttöku bréfsins.\n_The employee's signature confirms receipt of this letter._";
  const lines = [
    `# ${LETTER_TITLE[i.reason]}`,
    "",
    "## Aðilar / Parties",
    `**Vinnuveitandi / Employer:** ${i.company.name}${ktC ? ` (kt. ${ktC})` : ""}`,
    i.company.address ? `**Heimilisfang vinnuveitanda / Employer address:** ${i.company.address}` : "",
    `**Starfsmaður / Employee:** ${i.employee.name}${ktE ? ` (kt. ${ktE})` : ""}`,
    i.employee.title ? `**Starf / Position:** ${i.employee.title}` : "",
    "",
    "## Starfslok / End of employment",
    body[i.reason],
    `**Ástæða / Reason:** ${REASON_LABEL[i.reason]} / ${REASON_EN[i.reason]}`,
    `**Dagsetning tilkynningar / Notice date:** ${nd}`,
    `**Uppsagnarfrestur / Notice period:** ${period}`,
    `**Síðasti starfsdagur / Last working day:** ${ld}`,
    `**Vinnuskylda / Duty to work:** ${duty}`,
    "",
    "## Lokauppgjör / Final settlement",
    "Laun til og með síðasta starfsdegi, áunnið og ótekið orlof og annað sem kann að vera ógert upp er gert upp eigi síðar en við næstu reglulegu launagreiðslu eftir starfslok, nema aðilar semji um annað.",
    "_Pay up to and including the last working day, accrued untaken holiday pay and any other outstanding amounts are settled no later than the next regular payday after the employment ends, unless the parties agree otherwise._",
    "",
    i.signed ? "## Staðfesting / Confirmation" : "",
    i.signed ? sigNote : "",
    "",
    i.signed ? "_Undirritun / Signatures:_" : "",
  ];
  return lines.filter((l, idx, a) => !(l === "" && a[idx - 1] === "")).join("\n").trim() + "\n";
}

const REASON_EN: Record<TerminationReason, string> = {
  employee_resigned: "Employee resigned",
  employer_terminated: "Terminated by the employer",
  mutual: "Mutual agreement",
  fixed_term_end: "Fixed-term contract ended",
  summary_dismissal: "Summary dismissal",
  other: "Other",
};

/* ---------------- staða í viðmóti ---------------- */

/** Það sem listinn og prófíllinn þurfa (aldrei innri athugasemd). */
export type LeavingInfo = { id: string; reason: TerminationReason; lastDay: string; accessUntil: string; past: boolean };
