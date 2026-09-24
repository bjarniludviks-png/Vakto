import pkg from "/Users/bjarniludviksson/vakto/node_modules/playwright/index.js";
const { chromium } = pkg;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1024, height: 500 }, deviceScaleFactor: 1 });
await p.goto("file:///Users/bjarniludviksson/vakto-live/mobile/store/feature.html");
await p.waitForTimeout(1200);
await p.screenshot({ path: "/Users/bjarniludviksson/vakto-live/mobile/store/play-feature-1024x500.png" });
await b.close();
