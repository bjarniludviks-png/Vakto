// VAKTO-merkið — EINA skilgreiningin (súlurnar + orðmerkið). Allt annað (React-hluturinn, PNG/SVG í
// public/brand, Wallet, tölvupóstur, PDF, OG/íkonar, mobile) er leitt af þessu + logo-geometry.ts.
// Fyrirmyndin er hliðarstikan í kerfinu: 26px súlur, 9px bil, „VAKTO“ í General Sans Bold 18px, .04em.
import { LOGO_BOX, LOGO_GAP, WORDMARK_D, WORDMARK_INK, WORDMARK_WIDTH } from "./logo-geometry";

export { LOGO_BOX, LOGO_GAP, WORDMARK_D, WORDMARK_WIDTH };

export const BRAND_HEX = { brand2: "#f59331", brand: "#e9700f", brandDeep: "#cf5f0c", ink: "#1a1a1f", white: "#ffffff" } as const;

/** Súlurnar þrjár í 28×28 viewBox (sama og `Logo` í hliðarstikunni). */
export const MARK_VIEWBOX = 28;
export const MARK_BARS = [
  { x: 3, y: 15, w: 5.4, h: 10, rx: 1.6 },
  { x: 11.3, y: 9, w: 5.4, h: 16, rx: 1.6 },
  { x: 19.6, y: 3, w: 5.4, h: 22, rx: 1.6 },
] as const;

/**
 * default  — þrílitar súlur + dökkt orðmerki (ljós bakgrunnur)
 * on-dark  — þrílitar súlur + hvítt orðmerki (dökkur bakgrunnur)
 * white    — allt hvítt, súlurnar í þremur ógagnsæisþrepum (á appelsínugulum bakgrunni)
 */
export type LogoVariant = "default" | "on-dark" | "white";

const TONES = [BRAND_HEX.brand2, BRAND_HEX.brand, BRAND_HEX.brandDeep] as const;
export const WHITE_BAR_OPACITY = [0.7, 0.85, 1] as const;

/** Litur og ógagnsæi súlu i (0–2). Alltaf föst hex-gildi — merkið fylgir ekki staðbundnum --brand-breytum. */
export function barPaint(variant: LogoVariant, i: number): { fill: string; opacity: number } {
  if (variant === "white") return { fill: BRAND_HEX.white, opacity: WHITE_BAR_OPACITY[i] };
  return { fill: TONES[i], opacity: 1 };
}

export function wordFill(variant: LogoVariant): string {
  return variant === "default" ? BRAND_HEX.ink : BRAND_HEX.white;
}

/** Breidd alls merkisins (súlur + bil + orðmerki) í sömu einingum og LOGO_BOX. */
export const LOGO_WIDTH = LOGO_BOX + LOGO_GAP + WORDMARK_WIDTH;

const MS = LOGO_BOX / MARK_VIEWBOX; // kvarði súlnanna inn í 26-kassann
/** Blekmörk (sýnilegur hluti) í lockup-hnitum. */
export const LOGO_INK = {
  x0: MARK_BARS[0].x * MS,
  y0: Math.min(MARK_BARS[2].y * MS, WORDMARK_INK.y0),
  x1: LOGO_BOX + LOGO_GAP + WORDMARK_INK.x1,
  y1: Math.max((MARK_BARS[0].y + MARK_BARS[0].h) * MS, WORDMARK_INK.y1),
};
export const MARK_INK = { x0: MARK_BARS[0].x, y0: MARK_BARS[2].y, x1: MARK_BARS[2].x + MARK_BARS[2].w, y1: MARK_BARS[2].y + MARK_BARS[2].h };

const r = (n: number) => +n.toFixed(3);

function barsMarkup(variant: LogoVariant, scale: number, dx = 0, dy = 0): string {
  return MARK_BARS.map((b, i) => {
    const p = barPaint(variant, i);
    return `<rect x="${r(dx + b.x * scale)}" y="${r(dy + b.y * scale)}" width="${r(b.w * scale)}" height="${r(b.h * scale)}" rx="${r(b.rx * scale)}" fill="${p.fill}"${p.opacity < 1 ? ` fill-opacity="${p.opacity}"` : ""}/>`;
  }).join("");
}

export type LogoSvgOptions = {
  variant?: LogoVariant;
  /** Aðeins súlurnar. */
  markOnly?: boolean;
  /** Skera að bleki (engin innbyggð spássía). Annars sama kassi og í viðmótinu. */
  crop?: boolean;
  /** Auka spássía (í lockup-einingum) utan um — eftir að skorið er. */
  pad?: number;
  /** Bakgrunnslitur (sjálfgefið gegnsætt). */
  background?: string;
  /** Rúnnuð horn bakgrunns (í lockup-einingum). */
  radius?: number;
};

/** SVG-strengur af merkinu (hex-litir, orðmerkið sem útlínur — engin leturgerð þarf). */
export function vaktoLogoSvg(o: LogoSvgOptions = {}): string {
  const variant = o.variant ?? "default";
  const pad = o.pad ?? 0;
  let x0: number, y0: number, x1: number, y1: number;
  if (o.markOnly) ({ x0, y0, x1, y1 } = o.crop ? MARK_INK : { x0: 0, y0: 0, x1: MARK_VIEWBOX, y1: MARK_VIEWBOX });
  else ({ x0, y0, x1, y1 } = o.crop ? LOGO_INK : { x0: 0, y0: 0, x1: LOGO_WIDTH, y1: LOGO_BOX });
  x0 -= pad; y0 -= pad; x1 += pad; y1 += pad;
  const w = r(x1 - x0), h = r(y1 - y0);
  const bg = o.background ? `<rect x="${r(x0)}" y="${r(y0)}" width="${w}" height="${h}"${o.radius ? ` rx="${o.radius}"` : ""} fill="${o.background}"/>` : "";
  const body = o.markOnly
    ? barsMarkup(variant, 1)
    : barsMarkup(variant, MS) + `<path transform="translate(${LOGO_BOX + LOGO_GAP} 0)" fill="${wordFill(variant)}" d="${WORDMARK_D}"/>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${r(x0)} ${r(y0)} ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="VAKTO">${bg}${body}</svg>`;
}

/** data:-slóð (fyrir <img> í ImageResponse/satori). */
export function vaktoLogoDataUri(o: LogoSvgOptions = {}): string {
  return `data:image/svg+xml;base64,${Buffer.from(vaktoLogoSvg(o)).toString("base64")}`;
}
