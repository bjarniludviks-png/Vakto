// Tekur alvöru skjámyndir af kerfinu (dökkt þema) fyrir heimasíðuna.
//   node scripts/shots-homepage.mjs [preview-url]
// Notar staging-lyklana í .env.local (service role → magic link) og demo-fyrirtækið.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const out = "public/showcase/2026";
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

async function link(email, next) {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email });
  if (error) throw new Error(error.message);
  return `${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=${encodeURIComponent(next)}`;
}
// Sýna síðustu heilu vikuna (með stimplunum) í stað þeirrar sem er að byrja.
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(); const dow = (today.getUTCDay() + 6) % 7;
const lastMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dow - 7));
const lastSun = new Date(lastMon.getTime() + 6 * 86400000);
const FROM = iso(lastMon), TO = iso(lastSun);
async function ctx(browser, opts, theme) {
  const c = await browser.newContext({ locale: "is-IS", ...opts });
  await c.addInitScript(({ th, from, to }) => { try {
    localStorage.setItem("vakto-theme", th); localStorage.setItem("vakto-lang", "is");
    localStorage.setItem("vakto-dash-period", "custom"); localStorage.setItem("vakto-dash-from", from); localStorage.setItem("vakto-dash-to", to);
    localStorage.setItem("vakto:period:timaskraning", JSON.stringify({ preset: "custom", from, to }));
    localStorage.setItem("vakto-onb-hidden", "1");
  } catch {} }, { th: theme, from: FROM, to: TO });
  return c;
}
async function settle(page, ms = 3500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
  await page.addStyleTag({ content: ".toast,[class*='toast'],[class*='cookie']{display:none!important} *{caret-color:transparent!important}" }).catch(() => {});
}

const browser = await chromium.launch();
// ---- eigandi: skjáborð, dökkt
const owner = await ctx(browser, { viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 }, "dark");
const p = await owner.newPage();
await p.goto(await link(env.DEMO_LOGIN_EMAIL, "/maelabord"), { waitUntil: "domcontentloaded" });
await settle(p, 6000);
const pages = [["maelabord", "/maelabord"], ["vaktaplan", "/vaktaplan"], ["timafravik", "/timaskraning"], ["launakeyrslur", "/launakeyrslur"], ["starfsfolk", "/starfsfolk"], ["skyrslur", "/skyrslur"], ["spjall", "/spjall"], ["frettaveita", "/frettaveita"], ["innsyn", "/innsyn"]];
for (const [name, path] of pages) {
  await p.goto(base + path, { waitUntil: "domcontentloaded" });
  await settle(p, name === "maelabord" ? 7000 : 4000);
  await p.screenshot({ path: `${out}/${name}.jpg`, type: "jpeg", quality: 82 });
  console.log("✓", name, p.url());
}
await owner.close();

// ---- starfsmaður: sími (iPhone 15 stærð), dökkt þema eins og heimasíðan
const emp = await ctx(browser, { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }, "dark");
const m = await emp.newPage();
// Dalya á vakt á meðan myndin er tekin (opin stimplun sett inn og fjarlægð aftur)
const dalya = (await admin.from("employees").select("id, company_id").eq("user_id", "098aa6ce-c452-4a9a-88c8-235951540288").single()).data;
const punchIn = new Date(Date.now() - (4 * 3600 + 36 * 60 + 12) * 1000).toISOString();
const { data: openPunch } = await admin.from("punches").insert({ company_id: dalya.company_id, employee_id: dalya.id, clock_in: punchIn, source: "app" }).select("id").single();
await m.goto(await link("demo.dalya.r@vakto.is", "/mitt-svaedi"), { waitUntil: "domcontentloaded" });
await settle(m, 5000);
await m.screenshot({ path: `${out}/phone-mitt.png` });
console.log("✓ phone-mitt", m.url());
const btn = m.getByRole("button", { name: /Skírteini/ }).first();
if (await btn.count()) {
  await btn.click(); await m.waitForTimeout(1500);
  await m.screenshot({ path: `${out}/phone-skirteini.png` });
  console.log("✓ phone-skirteini");
} else console.log("✗ Skírteini-hnappur fannst ekki");
await emp.close();
if (openPunch) await admin.from("punches").delete().eq("id", openPunch.id);
await browser.close();
