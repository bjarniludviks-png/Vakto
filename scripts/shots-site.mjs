// Skjámyndir af heimasíðunni sjálfri (til að yfirfara):  node scripts/shots-site.mjs [url] [outdir]
import { chromium } from "playwright";
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const out = process.argv[3] ?? "/tmp";
const browser = await chromium.launch();
for (const [name, vp] of [["site-desktop", { width: 1440, height: 900 }], ["site-mobile", { width: 390, height: 844 }]]) {
  const c = await browser.newContext({ viewport: vp, deviceScaleFactor: 1, reducedMotion: "no-preference" });
  const p = await c.newPage();
  await p.goto(base + "/", { waitUntil: "networkidle" });
  await p.waitForTimeout(2500);
  // láta öll Rise-svæði birtast
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise((r) => setTimeout(r, 120)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70, fullPage: true });
  console.log("✓", name);
  await c.close();
}
// login + nýskráning
const c = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const p = await c.newPage();
for (const [name, path] of [["site-login", "/login"], ["site-signup", "/nyskraning"]]) {
  await p.goto(base + path, { waitUntil: "networkidle" }); await p.waitForTimeout(800);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 70 }); console.log("✓", name);
}
await browser.close();
