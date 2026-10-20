// VAKTO-merkið í viðmóti — sama og í hliðarstikunni kerfisins, alls staðar (vefur, kerfi, innskráning, kvittun …).
// Orðmerkið er útlína úr General Sans Bold (logo-geometry.ts), svo það lítur eins út hvort sem letrið er hlaðið eða ekki.
// Engir hooks → virkar bæði í Server og Client Components.
import type { CSSProperties } from "react";
import { LOGO_BOX, LOGO_GAP, MARK_BARS, MARK_VIEWBOX, WORDMARK_D, WORDMARK_WIDTH, barPaint, type LogoVariant } from "./logo-svg";

export type { LogoVariant };

type Common = { size?: number; variant?: LogoVariant; className?: string; style?: CSSProperties };

/** Súlurnar einar (`size` = hlið kassans, 26 í hliðarstikunni). */
export function VaktoMark({ size = 26, variant = "default", className, style, title }: Common & { title?: string }) {
  return (
    <svg className={className} width={size} height={size} viewBox={`0 0 ${MARK_VIEWBOX} ${MARK_VIEWBOX}`} fill="none"
      style={{ display: "block", flexShrink: 0, ...style }} role={title ? "img" : undefined} aria-label={title} aria-hidden={title ? undefined : true}>
      {MARK_BARS.map((b, i) => {
        const p = barPaint(variant, i); // föst hex-gildi: sumir fletir yfirskrifa --brand-2 (t.d. auth.css)
        return <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx={b.rx} fill={p.fill} fillOpacity={p.opacity < 1 ? p.opacity : undefined} />;
      })}
    </svg>
  );
}

/**
 * Allt merkið: súlur + „VAKTO“. `size` er hæð súlukassans (26 = hliðarstikan; orðmerkið fylgir í réttum hlutföllum).
 * default = dökkt orðmerki (fylgir `--ink`, líka í dark mode) · on-dark = hvítt orðmerki · white = allt hvítt.
 */
export function VaktoLogo({ size = 26, variant = "default", className, style, markOnly = false }: Common & { markOnly?: boolean }) {
  const s = size / LOGO_BOX;
  // default fylgir --ink (dark mode); dökkir fletir geta sett --vakto-logo-ink: #fff (t.d. .ah-nav.dk).
  const color = variant === "default" ? "var(--vakto-logo-ink, var(--ink, #1a1a1f))" : "#fff";
  return (
    <span className={`vakto-logo${className ? ` ${className}` : ""}`} role="img" aria-label="VAKTO" translate="no"
      style={{ display: "inline-flex", alignItems: "center", flexShrink: 0, lineHeight: 0, color, ...style }}>
      <VaktoMark size={size} variant={variant} className="vakto-logo-mark" />
      {!markOnly && (
        <svg className="vakto-logo-word" width={+(WORDMARK_WIDTH * s).toFixed(2)} height={size} viewBox={`0 0 ${WORDMARK_WIDTH} ${LOGO_BOX}`}
          style={{ display: "block", flexShrink: 0, marginLeft: +(LOGO_GAP * s).toFixed(2) }} aria-hidden="true">
          <path d={WORDMARK_D} fill="currentColor" />
        </svg>
      )}
    </span>
  );
}
