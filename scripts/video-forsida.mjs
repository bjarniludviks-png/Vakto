// Tekur upp stutt myndband af VAKTO í notkun fyrir hetjuna á forsíðunni (alvöru kerfi, demo-fyrirtækið á staging).
//   node scripts/video-forsida.mjs [preview-url]   → public/showcase/forsida/video/hero.mp4 + hero.jpg (plakat)
// Krefst ffmpeg (FFMPEG=/slóð/á/ffmpeg eða í PATH). Músin er teiknuð inn í síðuna (headless sýnir enga mús)
// og vaktin sem er dregin fær „draug" sem fylgir músinni; sjálf færslan er alvöru drag-and-drop sem vistast,
// og er dregin til baka eftir upptöku.
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { spawnSync } from "child_process";
import fs from "fs";
import path from "path";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
if (!env.NEXT_PUBLIC_SUPABASE_URL.includes("aptpckmrqepvcqhgkjoo")) throw new Error("aðeins staging");
const base = (process.argv[2] ?? "https://vakto-git-live-fixes-bjarniludviks-5304s-projects.vercel.app").replace(/\/$/, "");
const FFMPEG = process.env.FFMPEG ?? "ffmpeg";
// LANG=en → ensk útgáfa (hero-en.mp4) fyrir ensku forsíðuna.
const LANG = process.env.LANG_SITE === "en" ? "en" : "is";
const SUFFIX = LANG === "en" ? "-en" : "";
const OUT = "public/showcase/forsida/video";
const TMP = fs.mkdtempSync(path.join(process.env.TMPDIR ?? "/tmp", "vakto-vid-"));
fs.mkdirSync(OUT, { recursive: true });

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: link } = await admin.auth.admin.generateLink({ type: "magiclink", email: env.DEMO_LOGIN_EMAIL });
const iso = (d) => d.toISOString().slice(0, 10);
const today = new Date(); const dow = (today.getUTCDay() + 6) % 7;
const lastMon = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() - dow - 7));
const FROM = iso(lastMon), TO = iso(new Date(lastMon.getTime() + 6 * 86400000));

const W = 1440, H = 900, DSF = 1.5;
const browser = await chromium.launch();
const ctx = await browser.newContext({ locale: LANG === "en" ? "en-GB" : "is-IS", viewport: { width: W, height: H }, deviceScaleFactor: DSF });
await ctx.addInitScript(({ from, to, lang }) => {
  try {
    localStorage.setItem("vakto-theme", "light"); localStorage.setItem("vakto-lang", lang); localStorage.setItem("vakto-rail", "1");
    localStorage.setItem("vakto-onb-hidden", "1");
    localStorage.setItem("vakto-dash-period", "custom"); localStorage.setItem("vakto-dash-from", from); localStorage.setItem("vakto-dash-to", to);
    localStorage.setItem("vakto:period:timaskraning", JSON.stringify({ preset: "custom", from, to }));
  } catch {}
  // Músin (macOS-ör) og draugur fyrir drag
  const mk = () => {
    if (document.getElementById("__fc")) return;
    const c = document.createElement("div"); c.id = "__fc";
    c.innerHTML = '<svg width="26" height="26" viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.5 3-1.3-2.8-6.4h6.1z" fill="#111" stroke="#fff" stroke-width="1.5" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: "fixed", left: "0", top: "0", zIndex: "2147483647", pointerEvents: "none", transform: "translate(-100px,-100px)", filter: "drop-shadow(0 1px 1.5px rgba(0,0,0,.35))", transformOrigin: "5px 3px", transition: "scale .12s" });
    document.documentElement.appendChild(c);
    const style = document.createElement("style");
    style.textContent = ".toast,[class*='toast'],[class*='cookie'],.chat-fab,.support-fab{display:none!important} *{caret-color:transparent!important;cursor:none!important}";
    document.documentElement.appendChild(style);
  };
  window.__fcMove = (x, y) => { mk(); document.getElementById("__fc").style.transform = `translate(${x - 5}px,${y - 3}px)`; const g = document.getElementById("__ghost"); if (g) g.style.transform = `translate(${x - g.__dx}px,${y - g.__dy}px) rotate(-1.5deg) scale(1.05)`; };
  window.__fcPress = (on) => { mk(); document.getElementById("__fc").style.scale = on ? ".85" : "1"; };
  window.__ghost = (sel, x, y) => {
    const src = document.querySelector(sel); if (!src) return;
    const r = src.getBoundingClientRect(); const g = src.cloneNode(true); g.id = "__ghost"; g.__dx = x - r.left; g.__dy = y - r.top;
    Object.assign(g.style, { position: "fixed", left: "0", top: "0", width: r.width + "px", height: r.height + "px", margin: "0", zIndex: "2147483646", pointerEvents: "none", boxShadow: "0 12px 26px rgba(40,25,10,.28)", transform: `translate(${r.left}px,${r.top}px)` });
    document.documentElement.appendChild(g); src.style.opacity = ".25";
  };
  window.__ghostEnd = () => { document.getElementById("__ghost")?.remove(); };
}, { from: FROM, to: TO, lang: LANG });

const page = await ctx.newPage();
let cur = { x: 1010, y: 300 };
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
async function click(x, y, ms) { await moveTo(x, y, ms); await page.evaluate(() => window.__fcPress(true)); await sleep(110); await page.mouse.click(x, y); await page.evaluate(() => window.__fcPress(false)); }
const center = async (loc) => { const b = await loc.boundingBox(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; };
async function settle(ms = 2500) { await page.waitForLoadState("networkidle").catch(() => {}); await sleep(ms); await page.evaluate(([X, Y]) => window.__fcMove(X, Y), [cur.x, cur.y]); }

// Upptaka: CDP-screencast; rammar aðeins vistaðir á meðan `rec` er satt (hleðslur klipptar út)
const cdp = await ctx.newCDPSession(page);
const frames = []; let rec = false; let lastTs = 0; let tAcc = 0;
cdp.on("Page.screencastFrame", async (f) => {
  cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
  const ts = f.metadata.timestamp;
  if (rec) { const dt = lastTs ? Math.min(ts - lastTs, 0.1) : 0; tAcc += dt; frames.push({ t: tAcc, data: f.data }); }
  lastTs = ts;
});
const startRec = () => { rec = true; };
const stopRec = () => { rec = false; };
// Halda rammaflæði gangandi þó ekkert breytist (screencast sendir aðeins við breytingu)
const keepAlive = setInterval(() => { page.evaluate(() => { const c = document.getElementById("__fc"); if (c) c.style.opacity = c.style.opacity === "0.999" ? "1" : "0.999"; }).catch(() => {}); }, 33);

await page.goto(`${base}/auth/callback?token_hash=${link.properties.hashed_token}&type=magiclink&next=/maelabord`, { waitUntil: "domcontentloaded" });
await settle(6000);
await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: W * DSF, maxHeight: H * DSF, everyNthFrame: 1 });
await page.evaluate(([X, Y]) => window.__fcMove(X, Y), [cur.x, cur.y]);
await sleep(300);

// 1) Mælaborð
startRec();
const hz = await page.locator(".db2-hz").first().boundingBox().catch(() => null);
if (hz) {
  await moveTo(hz.x + hz.width * 0.12, hz.y + hz.height * 0.55, 450);
  await moveTo(hz.x + hz.width * 0.55, hz.y + hz.height * 0.5, 900);
  await moveTo(hz.x + hz.width * 0.95, hz.y + hz.height * 0.5, 700); await sleep(350);
} else { await moveTo(560, 470, 700); await sleep(500); }
const navTo = async (href) => { const l = page.locator(`aside a[href="${href}"]`).first(); const c = await center(l); await click(c.x, c.y, 600); stopRec(); await settle(3500); startRec(); };
// 2) Vaktaplan + drag
await navTo("/vaktaplan");
await sleep(250);
const cells = await page.evaluate(() => {
  const rows = [...document.querySelectorAll("table tr")];
  const find = (name) => rows.find((r) => (r.querySelector("td,th")?.textContent ?? "").includes(name));
  const a0 = find("Dalya");
  const col = a0 ? [...a0.querySelectorAll("td")].findIndex((td) => td.classList.contains("tod")) : -1; // dálkur dagsins (FIM)
  const pick = (r) => { const tds = r.querySelectorAll("td"); return tds[col] ?? null; };
  const a = a0, b = find("Jón");
  const sa = a && pick(a)?.querySelector(".shift"), tb = b && pick(b);
  if (!sa || !tb) return null;
  sa.setAttribute("data-rec", "src"); tb.setAttribute("data-rec", "dst");
  const ra = sa.getBoundingClientRect(), rb = tb.getBoundingClientRect();
  return { sx: ra.left + ra.width / 2, sy: ra.top + ra.height / 2, dx: rb.left + rb.width / 2, dy: rb.top + rb.height / 2, col };
});
if (!cells) throw new Error("fann ekki Dalya/Jón í vaktaplaninu");
await moveTo(cells.sx, cells.sy, 750); await sleep(150);
await page.evaluate(() => window.__fcPress(true));
await page.evaluate(([x, y]) => window.__ghost('[data-rec="src"]', x, y), [cells.sx, cells.sy]);
await sleep(200);
await moveTo(cells.dx, cells.dy, 950); await sleep(150);
await page.evaluate(() => window.__fcPress(false));
await page.dragAndDrop('[data-rec="src"]', '[data-rec="dst"]').catch((e) => console.log("drag:", e.message));
await page.evaluate(() => window.__ghostEnd());
await page.mouse.move(cells.dx, cells.dy);
await sleep(1300);
await moveTo(cells.dx + 260, cells.dy - 330, 650); await sleep(500);
// 3) Tímaskráning
await navTo("/timaskraning");
const dev = await page.locator(".db2-devline").first().boundingBox().catch(() => null);
if (dev) { await moveTo(dev.x + dev.width / 2, dev.y + dev.height / 2, 600); await sleep(700); }
await moveTo(900, 560, 600); await sleep(900);
// 4) Launakeyrslur
await navTo("/launakeyrslur");
const last = page.getByRole("tab", { name: /Síðasti mánuður|Last month|Previous month/ });
if (await last.count()) { const c = await center(last); await click(c.x, c.y, 600); await sleep(1700); }
await moveTo(700, 330, 600); await sleep(800);
// 5) aftur á mælaborð (lykkja)
await navTo("/maelabord");
await sleep(700);
stopRec();
clearInterval(keepAlive);
await cdp.send("Page.stopScreencast");

// Draga vaktina til baka (ekki tekið upp)
await page.goto(base + "/vaktaplan", { waitUntil: "networkidle" }); await sleep(2500);
const back = await page.evaluate((col) => {
  const rows = [...document.querySelectorAll("table tr")];
  const find = (name) => rows.find((r) => (r.querySelector("td,th")?.textContent ?? "").includes(name));
  const a = find("Jón"), b = find("Dalya");
  const s = a?.querySelectorAll("td")[col]?.querySelector(".shift"), d = b?.querySelectorAll("td")[col];
  if (!s || !d) return false; s.setAttribute("data-rec", "src2"); d.setAttribute("data-rec", "dst2"); return true;
}, cells.col);
if (back) { await page.dragAndDrop('[data-rec="src2"]', '[data-rec="dst2"]').catch(() => {}); await sleep(2500); console.log("vakt færð til baka"); }
await browser.close();

// Rammar → mp4 (breytileg rammalengd → 30 fps)
console.log("rammar:", frames.length, "lengd:", frames.at(-1)?.t.toFixed(1), "s");
const list = [];
frames.forEach((f, i) => {
  const fn = path.join(TMP, `f${String(i).padStart(5, "0")}.jpg`); fs.writeFileSync(fn, Buffer.from(f.data, "base64"));
  const d = i < frames.length - 1 ? Math.max(frames[i + 1].t - f.t, 0.001) : 0.5;
  list.push(`file '${fn}'`, `duration ${d.toFixed(4)}`);
});
list.push(`file '${path.join(TMP, `f${String(frames.length - 1).padStart(5, "0")}.jpg`)}'`);
fs.writeFileSync(path.join(TMP, "list.txt"), list.join("\n"));
const run = (args) => { const r = spawnSync(FFMPEG, args, { stdio: ["ignore", "ignore", "pipe"] }); if (r.status !== 0) { console.log(r.stderr.toString().slice(-1500)); throw new Error("ffmpeg"); } };
run(["-y", "-f", "concat", "-safe", "0", "-i", path.join(TMP, "list.txt"), "-vf", "fps=30,scale=1920:-2:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-preset", "slow", "-crf", "24", "-profile:v", "high", "-movflags", "+faststart", "-an", `${OUT}/hero${SUFFIX}.mp4`]);
run(["-y", "-i", `${OUT}/hero${SUFFIX}.mp4`, "-frames:v", "1", "-q:v", "3", `${OUT}/hero${SUFFIX}.jpg`]);
console.log("komið:", `${OUT}/hero${SUFFIX}.mp4`, (fs.statSync(`${OUT}/hero${SUFFIX}.mp4`).size / 1e6).toFixed(2), "MB");
fs.rmSync(TMP, { recursive: true, force: true });
