// Tekur upp stutt myndband af VAKTO AI fyrir „Hey VAKTO"-kaflann á forsíðunni (alvöru kerfi, demo-fyrirtækið á staging).
//   node scripts/video-forsida-ai.mjs [preview-url]          → public/showcase/forsida/video/ai.mp4 + ai.jpg (plakat)
//   LANG_SITE=en node scripts/video-forsida-ai.mjs [url]     → ai-en.mp4 + ai-en.jpg
// Krefst: .env.local á staging (DEMO_LOGIN_EMAIL + service role), preview með ANTHROPIC_API_KEY, ffmpeg (FFMPEG=…).
// Atburðarás: Vaktaplan → VAKTO AI opnað → beiðnin slegin inn → tillagan birtist → „Staðfesta" → „Gert".
// Biðin eftir svari líkansins er klippt út (aðeins stuttur „Hugsa…"-bútur sést). ATH: staðfestingin birtir
// planið í alvöru í demo-fyrirtækinu á staging (næsta vika, aðeins eldhúsið).
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("aptpckmrqepvcqhgkjoo")) throw new Error("aðeins staging");
const base = (process.argv[2] ?? "https://vakto-git-dev-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
const LANG = process.env.LANG_SITE === "en" ? "en" : "is";
const SUFFIX = LANG === "en" ? "-en" : "";
const PROMPT = process.env.PROMPT ?? (LANG === "en"
  ? "Make next week's schedule for the kitchen. Everyone gets two days off and there are always three on shift."
  : "Gerðu vaktaplan fyrir næstu viku í eldhúsinu. Allir fá tvo frídaga og alltaf þrír á vakt.");
const OUT = "public/showcase/forsida/video";
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "vakto-ai-vid-"));
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: env.DEMO_LOGIN_EMAIL });

const W = 1440, H = 900, DSF = 1.5;
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: LANG === "en" ? "en-GB" : "is-IS", viewport: { width: W, height: H }, deviceScaleFactor: DSF });
await ctx.addInitScript((lang) => {
  try { localStorage.setItem("vakto-theme", "light"); localStorage.setItem("vakto-lang", lang); localStorage.setItem("vakto-rail", "1"); localStorage.setItem("vakto-onb-hidden", "1"); } catch {}
  const mk = () => {
    if (document.getElementById("__fc")) return;
    const c = document.createElement("div"); c.id = "__fc";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.5 3-1.3-2.8-6.4h6.1z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-100px,-100px)", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.35))", transformOrigin: "5px 3px", transition: "scale .12s" });
    document.documentElement.appendChild(c);
    const style = document.createElement("style");
    style.textContent = ".toast,[class*='cookie'],.chat-fab,.support-fab{display:none!important} *{cursor:none!important}";
    document.documentElement.appendChild(style);
  };
  window.__fcMove = (x, y) => { mk(); document.getElementById("__fc").style.transform = `translate(${x - 5}px,${y - 3}px)`; };
  window.__fcPress = (on) => { mk(); document.getElementById("__fc").style.scale = on ? ".85" : "1"; };
}, LANG);

const page = await ctx.newPage();
let cur = { x: 900, y: 420 };
const sleep = (ms) => page.waitForTimeout(ms);
const ease = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
async function moveTo(x, y, ms = 700) {
  const n = Math.max(8, Math.round(ms / 16)); const a = { ...cur };
  for (let i = 1; i <= n; i++) {
    const t = ease(i / n); const px = a.x + (x - a.x) * t, py = a.y + (y - a.y) * t;
    await page.mouse.move(px, py); await page.evaluate(([X, Y]) => window.__fcMove(X, Y), [px, py]); await sleep(16);
  }
  cur = { x, y };
}
async function clickOn(loc, ms = 650) {
  const b = await loc.boundingBox(); if (!b) throw new Error("fann ekki hnapp");
  await moveTo(b.x + b.width / 2, b.y + b.height / 2, ms);
  await page.evaluate(() => window.__fcPress(true)); await sleep(110);
  await loc.click(); await page.evaluate(() => window.__fcPress(false));
}

// Upptaka: CDP-screencast; rammar aðeins vistaðir á meðan `rec` er satt (hleðsla og bið eftir líkaninu klippt út)
const cdp = await ctx.newCDPSession(page);
const frames = []; let rec = false; let lastTs = 0; let tAcc = 0;
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  const ts = f.metadata.timestamp;
  if (rec) { const dt = lastTs ? Math.min(ts - lastTs, 0.1) : 0; tAcc += dt; frames.push({ t: tAcc, data: f.data }); }
  lastTs = ts;
});
const keepAlive = setInterval(() => { page.evaluate(() => { const c = document.getElementById("__fc"); if (c) c.style.opacity = c.style.opacity === "0.999" ? "1" : "0.999"; }).catch(() => {}); }, 33);

await page.goto(`${base}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/vaktaplan`, { waitUntil: "domcontentloaded" });
await page.waitForLoadState("networkidle").catch(() => {}); await sleep(5000);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
await page.evaluate(([X, Y]) => window.__fcMove(X, Y), [cur.x, cur.y]);
await sleep(300);

rec = true;
// 1) Opna VAKTO AI
await sleep(600);
await clickOn(page.locator(".vai-fab").first(), 800);
await sleep(700);
// 2) Slá inn beiðnina (stafur fyrir staf) og senda
const ta = page.locator(".vai-in textarea");
await clickOn(ta, 500);
await ta.pressSequentially(PROMPT, { delay: 38 });
await sleep(400);
await page.keyboard.press("Enter");
await sleep(1600); // „Hugsa…" sést stutta stund
rec = false;
// 3) Bíða eftir tillögunni (ekki tekið upp)
await page.locator(".vai-act.pending").first().waitFor({ timeout: 240000 });
await sleep(800);
rec = true;
await sleep(500);
const list = page.locator(".vai-list");
await list.evaluate((el) => el.scrollTo({ top: el.scrollHeight, behavior: "smooth" }));
await sleep(2600); // tillagan lesin
// 4) Staðfesta
await clickOn(page.locator(".vai-act.pending button.btn:not(.ghost)").first(), 800);
rec = false;
await page.locator(".vai-ok").first().waitFor({ timeout: 120000 });
rec = true;
await sleep(2200);
rec = false;
clearInterval(keepAlive);
await cdp.send("Page.stopScreencast");
await browser.close();

// Rammar → mp4 (breytileg rammalengd → 30 fps)
console.log("rammar:", frames.length, "lengd:", frames.at(-1)?.t.toFixed(1), "s");
const lines = [];
frames.forEach((f, i) => {
  const fn = path.join(TMP, `f${String(i).padStart(5, "0")}.jpg`); fs.writeFileSync(fn, Buffer.from(f.data, "base64"));
  const d = i < frames.length - 1 ? Math.max(frames[i + 1].t - f.t, 0.001) : 0.5;
  lines.push(`file '${fn}'`, `duration ${d.toFixed(4)}`);
});
lines.push(`file '${path.join(TMP, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
fs.writeFileSync(path.join(TMP, "list.txt"), lines.join("\n"));
const run = (args) => { const r = spawnSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] }); if (r.status !== 0) { console.log(r.stderr.toString().slice(-1500)); throw new Error("ffmpeg"); } };
const mp4 = `${OUT}/ai${SUFFIX}.mp4`;
run(["-y", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "list.txt"), "-vf", "fps=30,scale=1920:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-movflags", "+faststart", "-an", mp4]);
// Plakat: rammi þegar tillagan sést (3 sek. fyrir lok)
run(["-y", "-sseof", "-3", "-i", mp4, "-frames:v", "1", "-q:v", "3", `${OUT}/ai${SUFFIX}.jpg`]);
console.log("komið:", mp4, (fs.statSync(mp4).size / 1e6).toFixed(2), "MB");
fs.rmSync(TMP, { recursive: true, force: true });
