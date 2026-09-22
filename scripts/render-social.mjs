// Renderar Facebook-myndirnar:  node scripts/render-social.mjs [base-url]
import { chromium } from "playwright";
const base = (process.argv[2] ?? "http://localhost:3011").replace(/\/$/, "");
// Headed + GPU: headless software raster tiles the big blur/shadow layers into visible squares.
const b = await chromium.launch({ headless: false, channel: "chrome", args: ["--window-position=4000,4000", "--hide-scrollbars"] }).catch(() => chromium.launch({ headless: false, args: ["--window-position=4000,4000", "--hide-scrollbars"] }));
for (const [path, w, h, out] of [["/og/fb-cover", 1640, 624, "public/social/fb-cover.png"], ["/og/fb-profile", 1080, 1080, "public/social/fb-profile.png"]]) {
  const p = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
  await p.goto(base + path, { waitUntil: "networkidle" });
  await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(2500);
  await p.screenshot({ path: out, clip: { x: 0, y: 0, width: w, height: h } });
  console.log("✓", out); await p.close();
}
await b.close();
