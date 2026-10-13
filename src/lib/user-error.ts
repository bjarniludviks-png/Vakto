// Villutexti sem má birta notanda. Okkar eigin villur (íslenskur texti) fara
// óbreyttar í gegn; tæknitexti frá gagnagrunni, neti eða keyrsluumhverfi er
// skráður í log og skipt út fyrir skiljanleg skilaboð.

const GENERIC = "Eitthvað fór úrskeiðis — reyndu aftur.";

const KNOWN: [RegExp, string][] = [
  [/duplicate key|already exists|unique constraint/i, "Þetta er þegar skráð."],
  [/already (been )?registered/i, "Netfangið er þegar skráð."],
  [/row-level security|permission denied|not authorized|JWT|insufficient.privilege/i, "Þú hefur ekki heimild til þessa."],
  [/foreign key/i, "Ekki hægt — aðrar færslur vísa í þetta."],
  [/fetch failed|network|ECONN|ETIMEDOUT|timed? ?out|socket hang up/i, "Náði ekki sambandi — reyndu aftur."],
  [/payload too large|exceeded the maximum|too large/i, "Skráin er of stór."],
];

const TECHNICAL = /\b(relation|column|schema|violates|constraint|syntax error|null value|invalid input|PGRST\d*|undefined|is not a function|cannot read|unexpected token|JSON|bucket|mime type|operator does not exist)\b/i;

function messageOf(e: unknown): string {
  if (typeof e === "string") return e;
  if (e && typeof e === "object" && "message" in e && typeof (e as { message: unknown }).message === "string") return (e as { message: string }).message;
  return "";
}

/** Enskur/tæknilegur texti: þekkt tækniorð, eða þrjú+ orð án íslenskra stafa. */
function looksTechnical(m: string): boolean {
  if (KNOWN.some(([re]) => re.test(m)) || TECHNICAL.test(m)) return true;
  return !/[áðéíóúýþæöÁÐÉÍÓÚÝÞÆÖ]/.test(m) && m.trim().split(/\s+/).length >= 3;
}

export function userError(e: unknown, fallback: string = GENERIC): string {
  const m = messageOf(e).trim();
  if (!m) return fallback;
  if (!looksTechnical(m)) return m;
  console.error("[villa]", m);
  return KNOWN.find(([re]) => re.test(m))?.[1] ?? fallback;
}
