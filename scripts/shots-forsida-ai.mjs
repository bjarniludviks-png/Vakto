// Skjámynd af VAKTO AI (vaktaplan-tillaga) fyrir /ny-heimasida. Alvöru kall í Claude á preview (staging).
// ai-2.jpg er svo klippt niður í glugga tillögunnar → light/ai.jpg (PIL-crop, x 29–71 %, y 4–96 %).
//   node scripts/shots-forsida-ai.mjs [preview-url]
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data } = await admin.auth.admin.generateLink({ type: "magiclink", email: env.DEMO_LOGIN_EMAIL });
const browser = await chromium.launch();
const c = await browser.newContext({ locale: "is-IS", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
await c.addInitScript(() => { try { localStorage.setItem("vakto-theme", "light"); localStorage.setItem("vakto-lang", "is"); localStorage.setItem("vakto-onb-hidden", "1"); } catch {} });
const p = await c.newPage();
await p.goto(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/vaktaplan`, { waitUntil: "domcontentloaded" });
await p.waitForLoadState("networkidle").catch(() => {}); await p.waitForTimeout(5000);
await p.addStyleTag({ content: ".toast,[class*='cookie'],.chat-fab,.support-fab{display:none!important} *{caret-color:transparent!important}" });
await p.getByRole("button", { name: /Gervigreind/ }).first().click();
await p.waitForTimeout(1500);
await p.screenshot({ path: "public/showcase/forsida/light/ai-1.jpg", type: "jpeg", quality: 84 });
console.log(await p.evaluate(() => [...document.querySelectorAll(".modal button, [role=dialog] button, textarea")].map((b) => b.tagName + ":" + (b.textContent || b.placeholder || "").trim().slice(0, 60)).join("\n")));
const ta = p.locator("textarea").first();
if (await ta.count()) await ta.fill(process.env.PROMPT ?? "Laugardagurinn verður stór, árshátíð í salnum. Bættu við fólki á kvöldvaktina og haltu laun undir 30% af veltu.");
const go = p.getByRole("button", { name: /Reikna tillögu/ }).first();
await go.click().catch((e) => console.log("no submit", e.message));
await p.waitForTimeout(Number(process.env.WAIT ?? 60000));
await p.screenshot({ path: "public/showcase/forsida/light/ai-2.jpg", type: "jpeg", quality: 84 });
await browser.close();
