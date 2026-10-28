// Útlit skjala fyrirtækis (companies.branding, 0098): einn ljós litatónn í haus ráðningarsamninga og
// launaseðla + eigið merki. Fáir valkostir af ásettu ráði — allir tónar eru prófaðir með texta skjalanna.
// Hreint — notað í vafra (niðurhal) og á þjóni (rafræn undirritun).
import type { jsPDF } from "jspdf";
import { drawVaktoLogo } from "@/lib/pdf-logo";

type RGB = [number, number, number];
export type ToneKey = "warm" | "red" | "blue" | "green" | "purple" | "gray";
export type PdfTone = { bg: RGB; mut: RGB; note: RGB };

export const TONES: Record<ToneKey, PdfTone & { label: string; css: string }> = {
  warm:   { label: "Ljósgult",      css: "#fbf6f0", bg: [251, 246, 240], mut: [138, 122, 104], note: [253, 245, 236] },
  red:    { label: "Ljósrautt",     css: "#fcedeb", bg: [252, 237, 235], mut: [150, 96, 90],   note: [253, 243, 241] },
  blue:   { label: "Ljósblátt",     css: "#edf3fb", bg: [237, 243, 251], mut: [86, 108, 138],  note: [243, 247, 252] },
  green:  { label: "Ljósgrænt",     css: "#ecf6f0", bg: [236, 246, 240], mut: [80, 120, 96],   note: [243, 249, 245] },
  purple: { label: "Ljósfjólublátt", css: "#f3effb", bg: [243, 239, 251], mut: [110, 96, 140], note: [247, 244, 252] },
  gray:   { label: "Ljósgrátt",     css: "#f2f3f5", bg: [242, 243, 245], mut: [106, 110, 118], note: [246, 247, 248] },
};
export const TONE_KEYS = Object.keys(TONES) as ToneKey[];
export const isTone = (k: unknown): k is ToneKey => typeof k === "string" && k in TONES;

/** Það sem PDF-smiðirnir fá: tónn + merkið sem data-URL (PNG/JPEG) eða ekkert (VAKTO-merkið). */
export type PdfBrand = { tone: ToneKey; logo: string | null; company?: string };
export const DEFAULT_BRAND: PdfBrand = { tone: "warm", logo: null };

export function pdfTone(b?: PdfBrand | null): PdfTone {
  return TONES[b && isTone(b.tone) ? b.tone : "warm"];
}

/**
 * Merki efst í haus: eigið merki fyrirtækisins (passað í 150 × 26 pt kassa) eða VAKTO-merkið.
 * `baseline` = sama grunnlína og VAKTO-orðmerkið notar. Skilar breiddinni.
 */
export function drawHeaderLogo(doc: jsPDF, b: PdfBrand | null | undefined, x: number, baseline: number): number {
  if (b?.logo) {
    try {
      const p = doc.getImageProperties(b.logo);
      const maxW = 150, maxH = 26;
      const s = Math.min(maxW / p.width, maxH / p.height);
      const w = p.width * s, h = p.height * s;
      doc.addImage(b.logo, p.fileType, x, baseline + 4 - h, w, h, undefined, "FAST");
      return w;
    } catch {
      /* ógilt merki — falla á VAKTO-merkið */
    }
  }
  return drawVaktoLogo(doc, x, baseline, 17);
}
