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

/** One decimal with Icelandic comma: 11.64 → "11,6". */
export function dec1(n: number): string {
  return n.toFixed(1).replace(".", ",");
}

/** Adaptive currency for KPIs: ≥1 m → "1,4 m.kr.", ≥1 þús → "740 þ.kr.",
 * else "820 kr". Keeps single-day figures readable (not "0,1 m.kr."). */
export function krCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? "-" : "";
  if (abs >= 1_000_000) return `${sign}${dec1(abs / 1_000_000)} m.kr.`;
  if (abs >= 1_000) return `${sign}${nf(abs / 1_000)} þ.kr.`;
  return `${sign}${nf(abs)} kr`;
}
