// Kortamerki fyrir áskriftarsíðu og kvittanir. Straumur skilar tegund sem kóða (VI, MC …).

export type CardBrandId = "visa" | "mastercard" | "amex" | "other";

export function brandOf(code: string | null | undefined): CardBrandId {
  const c = (code ?? "").toUpperCase();
  if (c === "VI" || c.startsWith("VISA")) return "visa";
  if (c === "MC" || c.startsWith("MASTER") || c === "MAESTRO") return "mastercard";
  if (c === "AMEX" || c === "AX") return "amex";
  return "other";
}

export function brandName(code: string | null | undefined): string {
  return { visa: "Visa", mastercard: "Mastercard", amex: "American Express", other: code || "Kort" }[brandOf(code)];
}

/** Merki kortategundar. `onDark` = hvítt Visa-letur á dökkum grunni. */
export function CardBrandLogo({ code, height = 22, onDark = false }: { code: string | null | undefined; height?: number; onDark?: boolean }) {
  const b = brandOf(code);
  if (b === "mastercard") {
    return (
      <svg height={height} viewBox="0 0 48 30" role="img" aria-label="Mastercard">
        <circle cx="17" cy="15" r="13" fill="#eb001b" />
        <circle cx="31" cy="15" r="13" fill="#f79e1b" />
        <path d="M24 4.2a13 13 0 0 1 0 21.6 13 13 0 0 1 0-21.6z" fill="#ff5f00" />
      </svg>
    );
  }
  if (b === "visa") {
    return (
      <svg height={height} viewBox="0 0 64 22" role="img" aria-label="Visa">
        <text x="0" y="19" fontFamily="Arial, Helvetica, sans-serif" fontSize="23" fontWeight="900" fontStyle="italic"
          letterSpacing="-0.5" fill={onDark ? "#fff" : "#1a1f71"}>VISA</text>
      </svg>
    );
  }
  return (
    <svg height={height} viewBox="0 0 36 24" role="img" aria-label={brandName(code)}>
      <rect x="1" y="1" width="34" height="22" rx="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <rect x="1" y="7" width="34" height="4" fill="currentColor" />
    </svg>
  );
}
