// Skarpar skjámyndir (2×) af kerfinu í LJÓSU og DÖKKU þema fyrir nýju forsíðuna (/forsida).
//   node scripts/shots-forsida.mjs [preview-url]
// Notar staging-lyklana í .env.local (service role → magic link) og demo-fyrirtækið.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
async function link(email, next) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  return `${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(); const dow = (today.getUTCDay() + 6) % 7;
const lastMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dow - 7));
const FROM = iso(lastMon), TO = iso(new Date(lastMon.getTime() + 6 * 86400000));
async function settle(page, ms = 3500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
  await page.addStyleTag({ content: ".toast,[class*='toast'],[class*='cookie'],.chat-fab,.support-fab{display:none!important} *{caret-color:transparent!important}" }).catch(() => {});
}
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const out = `public/showcase/forsida/${theme}`; fs.mkdirSync(out, { recursive: true });
  const c = await browser.newContext({ locale: "is-IS", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 });
  await c.addInitScript(({ th, from, to }) => { try {
    localStorage.setItem("vakto-theme", th); localStorage.setItem("vakto-lang", "is");
    localStorage.setItem("vakto-dash-period", "custom"); localStorage.setItem("vakto-dash-from", from); localStorage.setItem("vakto-dash-to", to);
    localStorage.setItem("vakto:period:timaskraning", JSON.stringify({ preset: "custom", from, to }));
    localStorage.setItem("vakto-onb-hidden", "1");
    localStorage.setItem("vakto-rail", "1"); // hliðarvalmynd lokuð, aðeins íkon
  } catch {} }, { th: theme, from: FROM, to: TO });
  const p = await c.newPage();
  await p.goto(await link(env.DEMO_LOGIN_EMAIL, "/maelabord"), { waitUntil: "domcontentloaded" });
  await settle(p, 6000);
  const ONLY = process.env.ONLY?.split(",");
  for (const [name, path] of [["maelabord", "/maelabord"], ["vaktaplan", "/vaktaplan"], ["timaskraning", "/timaskraning"], ["launakeyrslur", "/launakeyrslur"], ["innsyn", "/innsyn"], ["spjall", "/spjall"]].filter(([n]) => !ONLY || ONLY.includes(n))) {
    await p.goto(base + path, { waitUntil: "domcontentloaded" });
    await settle(p, name === "maelabord" ? 7000 : 4500);
    if (name === "launakeyrslur") { await p.getByRole("tab", { name: "Síðasti mánuður" }).click().catch(() => {}); await settle(p, 4000); }
    await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 84 });
    console.log("✓", theme, name);
  }
  await c.close();
  if (process.env.ONLY) continue;
  // sími
  const m = await browser.newContext({ locale: "is-IS", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true });
  await m.addInitScript(({ th }) => { try { localStorage.setItem("vakto-theme", th); localStorage.setItem("vakto-lang", "is"); localStorage.setItem("vakto-welcome-v1", "1"); } catch {} }, { th: theme });
  const mp = await m.newPage();
  await mp.goto(await link("demo.dalya.r@vakto.is", "/mitt-svaedi"), { waitUntil: "domcontentloaded" });
  await settle(mp, 5000);
  await mp.screenshot({ path: `${out}/phone-mitt.png` });
  await mp.goto(base + "/frettaveita", { waitUntil: "domcontentloaded" }); await settle(mp, 4000);
  await mp.screenshot({ path: `${out}/phone-frettir.png` });
  console.log("✓", theme, "phone");
  await m.close();
}
await browser.close();
