// Býr til VAKTO-merkið úr General Sans Bold (orðmerkið sem útlínur) og öll kyrrstæð merki úr því.
//   npx jiti scripts/brand/generate-logo.mts
// Skrifar:
//   src/components/brand/logo-geometry.ts  (+ afrit í mobile/src/components/logo-geometry.ts)
//   public/brand/*.svg|png, public/wallet-icon.png, src/lib/wallet-assets.ts, src/app/icon.svg
// Fyrirmynd: `.brand b` í src/styles/app.css — 18px, 700, letter-spacing .04em, grunnlína 20px í 26px kassa
// (mælt í Chromium: orðið er 66,30px breitt m. aftasta bili, sama og hér).
import fs from "node:fs";
import path from "node:path";
import opentype from "opentype.js";
import sharp from "sharp";

const root = path.resolve(import.meta.dirname, "../..");
const out = (p: string) => path.join(root, p);
const write = (p: string, data: string | Buffer) => { fs.mkdirSync(path.dirname(out(p)), { recursive: true }); fs.writeFileSync(out(p), data); console.log("✓", p); };

// ---- 1. Orðmerkið úr letrinu ----
const FONT_SIZE = 18, TRACKING = 0.04 * FONT_SIZE, BASELINE = 20, BOX = 26, GAP = 9;
const buf = fs.readFileSync(out("mobile/assets/fonts/GeneralSans-Bold.otf"));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length));
const glyphs = font.stringToGlyphs("VAKTO");
const scale = FONT_SIZE / font.unitsPerEm;
const word = new opentype.Path();
let x = 0;
glyphs.forEach((g, i) => {
  word.extend(g.getPath(x, BASELINE, FONT_SIZE));
  x += g.advanceWidth! * scale;
  if (i < glyphs.length - 1) x += font.getKerningValue(g, glyphs[i + 1]) * scale + TRACKING;
});
const bb = word.getBoundingBox();
const r3 = (n: number) => +n.toFixed(3);
const geometry = `// SJÁLFVIRKT BÚIÐ TIL af scripts/brand/generate-logo.mts — ekki breyta með höndum.
// „VAKTO“ í General Sans Bold ${FONT_SIZE}px, letter-spacing .04em, sem útlínur í ${BOX}px háum kassa (grunnlína y=${BASELINE}).
export const LOGO_BOX = ${BOX};
export const LOGO_GAP = ${GAP};
export const WORDMARK_WIDTH = ${r3(x)};
export const WORDMARK_INK = { x0: ${r3(bb.x1)}, y0: ${r3(bb.y1)}, x1: ${r3(bb.x2)}, y1: ${r3(bb.y2)} };
export const WORDMARK_D = "${word.toPathData(3)}";
`;
write("src/components/brand/logo-geometry.ts", geometry);
write("mobile/src/components/logo-geometry.ts", geometry);

// ---- 2. Kyrrstæð merki ----
const L = await import("../../src/components/brand/logo-svg");
const png = (svg: string, w: number, h: number) =>
  sharp(Buffer.from(svg), { density: 72 * Math.ceil(Math.max(w / 20, h / 20)) }).resize(w, h, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).png({ compressionLevel: 9 }).toBuffer();

const logo = L.vaktoLogoSvg({ crop: true });
const logoWhite = L.vaktoLogoSvg({ crop: true, variant: "white" });
write("public/brand/vakto-logo.svg", logo);
write("public/brand/vakto-logo-white.svg", logoWhite);
write("public/brand/vakto-logo-on-dark.svg", L.vaktoLogoSvg({ crop: true, variant: "on-dark" }));
write("public/brand/vakto-mark.svg", L.vaktoLogoSvg({ markOnly: true, crop: true }));
write("public/brand/vakto-mark-white.svg", L.vaktoLogoSvg({ markOnly: true, crop: true, variant: "white" }));

// Tölvupóstur: @1x 24px hátt (blek), @2x 48px.
const inkW = L.LOGO_INK.x1 - L.LOGO_INK.x0, inkH = L.LOGO_INK.y1 - L.LOGO_INK.y0;
const W1 = Math.round((24 * inkW) / inkH);
console.log(`  email logo: ${W1}x24 (@2x ${W1 * 2}x48)`);
write("public/brand/vakto-logo.png", await png(logo, W1, 24));
write("public/brand/vakto-logo@2x.png", await png(logo, W1 * 2, 48));
write("public/brand/vakto-logo-white.png", await png(logoWhite, W1, 24));
write("public/brand/vakto-logo-white@2x.png", await png(logoWhite, W1 * 2, 48));
write("public/brand/vakto-mark.png", await png(L.vaktoLogoSvg({ markOnly: true }), 512, 512));

// Favicon: súlurnar einar, þrílitar, 1 eining spássía.
write("src/app/icon.svg", L.vaktoLogoSvg({ markOnly: true, crop: true, pad: 1 }) + "\n");

// Google Wallet (hringlaga merki á appelsínugulu korti): hvítur grunnur + þrílitar súlur, 660px.
const gw = L.vaktoLogoSvg({ markOnly: true, crop: true, pad: 9, background: "#ffffff" });
write("public/wallet-icon.png", await png(gw, 660, 660));

// Apple Wallet: icon = þrílitar súlur (lásskjár/tilkynningar), logo = hvíta merkið á appelsínugulum passa.
const icon = L.vaktoLogoSvg({ markOnly: true });
const passLogo = (s: number) => {
  const h = 24 * s, w = Math.round((h * inkW) / inkH), pad = 5 * s;
  return png(logoWhite, w, h).then((b) => sharp({ create: { width: w + pad * 2, height: 50 * s, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } } })
    .composite([{ input: b, left: pad, top: Math.round((50 * s - h) / 2) }]).png({ compressionLevel: 9 }).toBuffer());
};
const imgs: Record<string, Buffer> = {
  "icon.png": await png(icon, 29, 29), "icon@2x.png": await png(icon, 58, 58), "icon@3x.png": await png(icon, 87, 87),
  "logo.png": await passLogo(1), "logo@2x.png": await passLogo(2), "logo@3x.png": await passLogo(3),
};
write("src/lib/wallet-assets.ts",
  `// Myndir í Apple Wallet-skírteinið (icon er skylda, annars opnast passinn ekki).\n// SJÁLFVIRKT BÚIÐ TIL af scripts/brand/generate-logo.mts úr VAKTO-merkinu — ekki breyta með höndum.\nexport const PASS_IMAGES: Record<string, string> = {\n${Object.entries(imgs).map(([k, v]) => `  "${k}": "${v.toString("base64")}",`).join("\n")}\n};\n`);
