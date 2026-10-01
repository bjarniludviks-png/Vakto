// Símamyndir úr ALVÖRU appinu (mobile/, Expo web-útflutningur á staging) fyrir /ny-heimasida.
// 1) cd mobile && set -a && . ./.env.staging && set +a && npx expo export -p web --output-dir <dir>
// 2) þjóna <dir> á http://localhost:8099 (SPA-fallback)  3) node scripts/shots-forsida-app.mjs
// Setur tímabundið opna stimplun á Dalya R. (demo, staging) og eyðir henni á eftir.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import fs from "fs";
const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const URL_ = env.NEXT_PUBLIC_SUPABASE_URL;
if (!URL_.includes("aptpckmrqepvcqhgkjoo")) throw new Error("aðeins staging");
const APP = process.env.APP_URL ?? "http://localhost:8099";
const OUT = "public/showcase/forsida";
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const EMAIL = "demo.dalya.r@vakto.is";
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const { data: auth, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (error) throw error;
const storageKey = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
const emp = (await admin.from("employees").select("id, company_id").eq("user_id", auth.user.id).single()).data;
const clockIn = new Date(Date.now() - (4 * 3600 + 36 * 60) * 1000).toISOString();
const { data: punch } = await admin.from("punches").insert({ company_id: emp.company_id, employee_id: emp.id, clock_in: clockIn, source: "app" }).select("id").single();
const SHOTS = (process.env.SHOTS ?? "heim:/,vaktir:/vaktir,frettir:/frettir,spjall:/spjall,skirteini:/skirteini").split(",").map((s) => s.split(":"));
const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const c = await browser.newContext({ locale: "is-IS", viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: theme });
    await c.addInitScript(({ k, v }) => { try { localStorage.setItem(k, v); } catch {} }, { k: storageKey, v: JSON.stringify(auth.session) });
    const p = await c.newPage();
    for (const [name, route] of SHOTS) {
      await p.goto(APP + route, { waitUntil: "networkidle" }).catch(() => {});
      await p.waitForTimeout(4500);
      await p.screenshot({ path: `${OUT}/${theme}/app-${name}.png` });
      if (name === "heim") {
        const box = await p.evaluate(() => {
          const el = [...document.querySelectorAll("div")].find((n) => n.childElementCount === 0 && /^\d{1,2}:\d{2}(:\d{2})?$/.test((n.textContent || "").trim()));
          if (!el) return null; const r = el.getBoundingClientRect(); const cs = getComputedStyle(el);
          return { x: r.left / innerWidth, y: r.top / innerHeight, w: r.width / innerWidth, h: r.height / innerHeight, fs: parseFloat(cs.fontSize) / innerWidth, fw: cs.fontWeight, ls: cs.letterSpacing, color: cs.color, text: el.textContent };
        });
        console.log(theme, JSON.stringify(box));
      }
    }
    await c.close();
  }
} finally {
  if (punch) await admin.from("punches").delete().eq("id", punch.id);
  await browser.close();
}
