// VAKTO-merkið í jsPDF — sömu súlur og orðmerki (útlínur úr General Sans Bold) og í viðmótinu,
// teiknað sem vektor svo það sé eins í öllum PDF-skjölum óháð letri skjalsins.
import type { jsPDF } from "jspdf";
import { LOGO_BOX, LOGO_WIDTH, MARK_BARS, MARK_VIEWBOX, WORDMARK_D, LOGO_GAP, barPaint, wordFill, type LogoVariant } from "@/components/brand/logo-svg";

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];

/** Skiptir WORDMARK_D (M/L/C/Q/Z, algild hnit) í skipanir einu sinni. */
type Cmd = [string, ...number[]];
let parsed: Cmd[] | null = null;
function commands(): Cmd[] {
  if (parsed) return parsed;
  const out: Cmd[] = [];
  for (const m of WORDMARK_D.matchAll(/([MLCQZ])([^MLCQZ]*)/gi)) {
    const nums = (m[2].match(/-?\d*\.?\d+(?:e[-+]?\d+)?/gi) ?? []).map(Number);
    out.push([m[1].toUpperCase(), ...nums]);
  }
  return (parsed = out);
}

const BASELINE = 20; // grunnlína orðmerkisins í 26-kassanum

/**
 * Teiknar merkið. `x` = vinstri brún kassans, `baseline` = grunnlína orðmerkisins, `size` = hæð kassans
 * (í einingum skjalsins; 26 = hlutföll hliðarstikunnar). Skilar breiddinni sem fór í merkið.
 */
export function drawVaktoLogo(doc: jsPDF, x: number, baseline: number, size: number, o: { variant?: LogoVariant; markOnly?: boolean } = {}): number {
  const variant = o.variant ?? "default";
  const s = size / LOGO_BOX;
  const top = baseline - BASELINE * s;
  const ms = size / MARK_VIEWBOX;
  MARK_BARS.forEach((b, i) => {
    doc.setFillColor(...hex(barPaint(variant, i).fill));
    doc.roundedRect(x + b.x * ms, top + b.y * ms, b.w * ms, b.h * ms, b.rx * ms, b.rx * ms, "F");
  });
  if (o.markOnly) return size;
  const ox = x + (LOGO_BOX + LOGO_GAP) * s;
  const P = (px: number, py: number): [number, number] => [ox + px * s, top + py * s];
  let cx = 0, cy = 0;
  for (const [op, ...n] of commands()) {
    if (op === "M") { doc.moveTo(...P(n[0], n[1])); cx = n[0]; cy = n[1]; }
    else if (op === "L") { doc.lineTo(...P(n[0], n[1])); cx = n[0]; cy = n[1]; }
    else if (op === "C") { doc.curveTo(...P(n[0], n[1]), ...P(n[2], n[3]), ...P(n[4], n[5])); cx = n[4]; cy = n[5]; }
    else if (op === "Q") { // ferningsbeygja → teningsbeygja
      const c1 = P(cx + (2 / 3) * (n[0] - cx), cy + (2 / 3) * (n[1] - cy)), c2 = P(n[2] + (2 / 3) * (n[0] - n[2]), n[3] + (2 / 3) * (n[1] - n[3]));
      doc.curveTo(...c1, ...c2, ...P(n[2], n[3])); cx = n[2]; cy = n[3];
    } else if (op === "Z") doc.close();
  }
  doc.setFillColor(...hex(wordFill(variant)));
  doc.fill();
  return LOGO_WIDTH * s;
}
