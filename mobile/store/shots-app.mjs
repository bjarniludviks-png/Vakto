import pkg from "/Users/bjarniludviksson/vakto/node_modules/playwright/index.js";
const { chromium } = pkg;
const OUT = "/Users/bjarniludviksson/vakto-live/mobile/store/light";
const BASE = "http://localhost:8095";
const b = await chromium.launch();
const ctx = await b.newContext({
  viewport: { width: 390, height: 844 }, deviceScaleFactor: 3,
  isMobile: true, hasTouch: true, colorScheme: "light", locale: "is-IS",
});
const p = await ctx.newPage();
const shot = async (name) => { await p.waitForTimeout(1400); await p.screenshot({ path: `${OUT}/${name}.png` }); console.log("✓", name); };

await p.goto(BASE, { waitUntil: "networkidle" });
await p.waitForTimeout(3500);
// innskráning
const email = p.getByPlaceholder("netfang@fyrirtaeki.is");
if (await email.count()) {
  await email.fill(process.env.D_EMAIL);
  await p.getByPlaceholder("••••••••").fill(process.env.D_PASS);
  await p.getByText("Skrá inn", { exact: true }).click();
  await p.waitForTimeout(6000);
}
await shot("heim");
await p.goto(`${BASE}/vaktir`, { waitUntil: "networkidle" }); await shot("vaktir");
await p.goto(`${BASE}/frettir`, { waitUntil: "networkidle" }); await shot("frettir");
await p.goto(`${BASE}/laun`, { waitUntil: "networkidle" }); await shot("laun");
await p.goto(`${BASE}/skirteini`, { waitUntil: "networkidle" }); await shot("skirteini");
await b.close();
