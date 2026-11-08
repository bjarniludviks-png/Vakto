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
const LANG = process.env.LANG_SITE === "en" ? "en" : "is"; // LANG_SITE=en → enskar myndir
const OUT = LANG === "en" ? "public/showcase/forsida/en" : "public/showcase/forsida";
const admin = createClient(URL_, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const anon = createClient(URL_, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } });
const EMAIL = "demo.dalya.r@vakto.is";
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: EMAIL });
const { data: auth, error } = await anon.auth.verifyOtp({ token_hash: link.properties.hashed_token, type: "magiclink" });
if (error) throw error;
const storageKey = `sb-${new URL(URL_).hostname.split(".")[0]}-auth-token`;
const emp = (await admin.from("employees").select("id, company_id").eq("user_id", auth.user.id).single()).data;
// Föst klukka (14:56 í dag) svo kveðjan, „síðan …“ og vaktin passi alltaf saman, óháð hvenær skriftan er keyrð.
const NOW = new Date(new Date().toISOString().slice(0, 10) + "T14:56:06Z");
const clockIn = new Date(NOW.getTime() - (4 * 3600 + 36 * 60) * 1000).toISOString();
const { data: punch } = await admin.from("punches").insert({ company_id: emp.company_id, employee_id: emp.id, clock_in: clockIn, source: "app" }).select("id").single();
const SHOTS = (process.env.SHOTS ?? "heim:/,vaktir:/vaktir,frettir:/frettir,spjall:/spjall,skirteini:/skirteini").split(",").map((s) => s.split(":"));
// Á iPhone notar appið NativeTabs (Liquid Glass á iOS 26), en vefútgáfan teiknar flata stiku.
// Hér er flata stikan falin og fljótandi glerstika teiknuð í staðinn svo myndin líti út eins og í símanum.
async function glassTabs(p, name, theme) {
  const labels = LANG === "en" ? ["Home", "Shifts", "Chat", "News", "Me"] : ["Heim", "Vaktir", "Spjall", "Fréttir", "Ég"];
  const active = { heim: 0, vaktir: 1, spjall: 2, frettir: 3 }[name] ?? -1;
  await p.evaluate(({ labels, active, dark }) => {
    const H = innerHeight;
    const bar = [...document.querySelectorAll("div")].find((el) => {
      const r = el.getBoundingClientRect();
      return r.top > H * 0.82 && r.height < 130 && r.width >= innerWidth - 1 && labels.every((l) => el.innerText.includes(l));
    });
    if (!bar) return;
    const badge = (bar.innerText.match(/\b(\d{1,3})\b/) || [])[1];
    bar.style.display = "none";
    const I = {
      0: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
      1: '<path d="M8 2v4"/><path d="M16 2v4"/><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M3 10h18"/>',
      2: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
      3: '<path d="M15 18h-5"/><path d="M18 14h-8"/><path d="M4 22h16a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2H8a2 2 0 0 0-2 2v16a2 2 0 0 1-4 0v-9a2 2 0 0 1 2-2h2"/><rect width="8" height="4" x="10" y="6" rx="1"/>',
      4: '<circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/>',
    };
    const ink = dark ? "#f2f2f5" : "#1c1c1f", tint = "#e9700f";
    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div style="position:fixed;left:16px;right:16px;bottom:22px;height:64px;border-radius:32px;z-index:99999;
        background:${dark ? "rgba(38,38,44,.58)" : "rgba(255,255,255,.62)"};
        backdrop-filter:blur(14px) saturate(190%);-webkit-backdrop-filter:blur(14px) saturate(190%);
        border:.5px solid ${dark ? "rgba(255,255,255,.16)" : "rgba(255,255,255,.9)"};
        box-shadow:inset 0 1px 1px ${dark ? "rgba(255,255,255,.12)" : "rgba(255,255,255,.95)"},inset 0 -1px 1px ${dark ? "rgba(0,0,0,.25)" : "rgba(0,0,0,.04)"},0 8px 28px rgba(0,0,0,${dark ? ".45" : ".14"}),0 1px 3px rgba(0,0,0,${dark ? ".3" : ".08"});
        display:flex;align-items:center;padding:0 5px;font-family:-apple-system,'SF Pro Text',system-ui,sans-serif">
        ${labels.map((l, i) => `
          <div style="flex:1;height:54px;border-radius:27px;position:relative;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;
            ${i === active ? `background:${dark ? "rgba(255,255,255,.12)" : "rgba(0,0,0,.065)"};` : ""}color:${i === active ? tint : ink}">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${i === active ? 2.3 : 1.9}" stroke-linecap="round" stroke-linejoin="round">${I[i]}</svg>
            <span style="font-size:10px;font-weight:${i === active ? 600 : 500};letter-spacing:.1px">${l}</span>
            ${i === 2 && badge ? `<span style="position:absolute;top:3px;left:50%;margin-left:5px;min-width:18px;height:18px;padding:0 5px;box-sizing:border-box;border-radius:9px;background:#ff3b30;color:#fff;font-size:11px;font-weight:600;line-height:18px;text-align:center">${badge}</span>` : ""}
          </div>`).join("")}
      </div>
      <div style="position:fixed;left:50%;bottom:8px;width:136px;height:5px;margin-left:-68px;border-radius:3px;z-index:99999;background:${dark ? "#fff" : "#000"}"></div>`;
    document.body.appendChild(wrap);
  }, { labels, active, dark: theme === "dark" });
  await p.waitForTimeout(400);
}

const browser = await chromium.launch();
try {
  for (const theme of ["light", "dark"]) {
    const c = await browser.newContext({ locale: LANG === "en" ? "en-GB" : "is-IS", viewport: { width: 402, height: 874 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, colorScheme: theme });
    await c.addInitScript(({ k, v, lg }) => { try { localStorage.setItem(k, v); localStorage.setItem("@vakto-lang", lg); } catch {} }, { k: storageKey, v: JSON.stringify(auth.session), lg: LANG });
    await c.clock.install({ time: NOW });
    const p = await c.newPage();
    for (const [name, route] of SHOTS) {
      await p.goto(APP + route, { waitUntil: "networkidle" }).catch(() => {});
      await p.waitForTimeout(4500);
      await glassTabs(p, name, theme);
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
