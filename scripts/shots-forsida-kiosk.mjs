// Skjámynd af kiosk-stimpilklukkunni (iPad lárétt) fyrir /ny-heimasida. Staging, demo-fyrirtækið.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: co } = await admin.from("companies").select("kiosk_token").eq("id", "00000000-0000-0000-0000-0000000000c0").single();
const LANG = process.env.LANG_SITE === "en" ? "en" : "is"; // LANG_SITE=en → enskar myndir í public/showcase/forsida/en/
const ROOT = LANG === "en" ? "public/showcase/forsida/en" : "public/showcase/forsida";
import { mkdirSync } from "fs";
for (const t of ["light", "dark"]) mkdirSync(`${ROOT}/${t}`, { recursive: true });
const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  const c = await browser.newContext({ locale: LANG === "en" ? "en-GB" : "is-IS", viewport: { width: 1180, height: 820 }, deviceScaleFactor: 2, hasTouch: true, colorScheme: theme });
  await c.addInitScript(([th, lg]) => { try { localStorage.setItem("vakto-theme", th); localStorage.setItem("vakto-kiosk-lang", lg); } catch {} }, [theme, LANG]);
  const p = await c.newPage();
  await p.goto(`${base}/kiosk?k=${co.kiosk_token}`, { waitUntil: "networkidle" }).catch(() => {});
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `${ROOT}/${theme}/kiosk.jpg`, type: "jpeg", quality: 84 });
  await c.close();
}
await browser.close();
