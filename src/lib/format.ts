// Deterministic Icelandic number formatting — identical on server and client
// (avoids hydration mismatches from environment-dependent Intl locale data).

/** Group integer part with "." thousands separators: 2900 → "2.900". */
export function nf(n: number): string {
  const neg = n < 0;
  const s = Math.round(Math.abs(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return neg ? "-" + s : s;
}

/** Króna amount: 2900 → "2.900 kr". */
export function kr(n: number): string {
  return nf(n) + " kr";
}

/** One decimal with Icelandic comma: 11.64 → "11,6". lang "en" → "11.6". */
export function dec1(n: number, lang?: string): string {
  return lang === "en" ? n.toFixed(1) : n.toFixed(1).replace(".", ",");
}

/** Adaptive currency for KPIs: ≥1 m → "1,4 m.kr.", ≥1 þús → "740 þ.kr.",
 * else "820 kr". Keeps single-day figures readable (not "0,1 m.kr."). */
export function krCompact(n: number, lang?: string): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  // Enska: "1.4m ISK", "740k ISK", "820 ISK" (komma sem þúsundaskil).
  if (lang === "en") {
    if (abs >= 1_000_000) return `${sign}${dec1(abs / 1_000_000, "en")}m ISK`;
    if (abs >= 1_000) return `${sign}${nf(abs / 1_000).replace(/\./g, ",")}k ISK`;
    return `${sign}${Math.round(abs)} ISK`;
  }
  if (abs >= 1_000_000) return `${sign}${dec1(abs / 1_000_000)} m.kr.`;
  if (abs >= 1_000) return `${sign}${nf(abs / 1_000)} þ.kr.`;
  return `${sign}${nf(abs)} kr`;
}

const MON_SHORT: Record<string, string[]> = {
  is: ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
  pl: ["sty", "lut", "mar", "kwi", "maj", "cze", "lip", "sie", "wrz", "paź", "lis", "gru"],
};
/** Stutt mánaðarheiti úr "YYYY-MM": "2026-10" → "okt 26" / "Oct 26". vi fellur á ensku. */
export function monthShort(ym: string, lang = "is"): string {
  const [y, m] = ym.split("-").map(Number);
  return `${(MON_SHORT[lang] ?? MON_SHORT.en)[m - 1]} ${String(y).slice(2)}`;
}
