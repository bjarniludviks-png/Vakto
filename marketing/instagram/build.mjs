import pkg from "/Users/bjarniludviksson/vakto/node_modules/playwright/index.js";
import fs from "node:fs";
const { chromium } = pkg;
const R = "/Users/bjarniludviksson/vakto-live";
const OUT = `${R}/marketing/instagram`;

const CSS = `
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Bold.otf");font-weight:700}
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Semibold.otf");font-weight:600}
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Medium.otf");font-weight:500}
*{margin:0;box-sizing:border-box}
body{width:1080px;height:1350px;overflow:hidden;font-family:GS,system-ui;position:relative}
.dark{background:#0B0B0F;color:#fff}
.cream{background:#FBF7F1;color:#16161A}
.glow{position:absolute;border-radius:50%;filter:blur(10px)}
.pad{position:absolute;inset:0;padding:86px 78px;display:flex;flex-direction:column}
.eyebrow{font-weight:600;font-size:27px;letter-spacing:.17em;text-transform:uppercase}
h1{font-weight:700;letter-spacing:-.035em;line-height:1.04}
.sub{font-weight:500;line-height:1.45}
.lockup{display:flex;align-items:flex-end;gap:14px}
.mark{display:flex;align-items:flex-end;gap:6px}
.word{font-weight:700;font-size:40px;letter-spacing:-.02em;line-height:.88}
.mark i{display:block;width:15px;border-radius:5px}
.foot{margin-top:auto;display:flex;align-items:center;justify-content:space-between}
.url{font-weight:600;font-size:26px;letter-spacing:.02em}
.phone{position:absolute;width:780px;left:150px;top:640px}
.phone img.frame{display:block;width:100%}
.ui{position:absolute;left:2.9%;right:2.7%;top:.7%;bottom:1%;border-radius:13%/6.3%;overflow:hidden;background:#fff}
.ui img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.isl{position:absolute;top:1.2%;left:50%;transform:translateX(-50%);width:30%;height:3.9%;border-radius:999px;background:#0b0b0d;z-index:3}
.ui img{position:absolute;left:0;right:0;top:5.8%;height:94.2%;width:100%;object-fit:cover;object-position:top}
.status{position:absolute;left:0;right:0;top:0;height:7.2%;background:#fff;z-index:2;display:flex;align-items:center;justify-content:space-between;padding:0 6.2% 2.2% 7%;color:#0b0b0d}
.status .t{font-family:-apple-system,"SF Pro Text","Helvetica Neue",sans-serif;font-weight:600;font-size:35px;letter-spacing:-.01em;font-variant-numeric:tabular-nums}
.status .ic{display:flex;align-items:center;gap:12px;transform:scale(1.35);transform-origin:right center}
.status svg{display:block}
.rows{display:flex;flex-direction:column;gap:30px;margin-top:54px}
.row{display:flex;gap:20px;align-items:flex-start}
.tick{flex:0 0 auto;width:44px;height:44px;border-radius:14px;display:flex;align-items:center;justify-content:center;font-weight:700;font-size:24px}
.rowt{font-weight:600;font-size:36px;line-height:1.3}
.rowt small{display:block;font-weight:500;font-size:28px;line-height:1.4;margin-top:4px}
.big{font-weight:700;letter-spacing:-.04em;line-height:.95}
`;

const mark = (light) => `<div class="lockup">
  <div class="mark">
    <i style="height:26px;background:#F59331"></i>
    <i style="height:40px;background:#E9700F"></i>
    <i style="height:54px;background:${light ? "#CF5F0C" : "#E9700F"}"></i>
  </div>
  <span class="word" style="color:${light ? "#16161A" : "#fff"}">VAKTO</span>
</div>`;

const foot = (light) => `<div class="foot">${mark(light)}<div class="url" style="color:${light ? "#6F6F7B" : "rgba(255,255,255,.66)"}">vakto.is</div></div>`;

/** Dökkur staðhæfingarpóstur. */
const statement = ({ eyebrow, title, sub, size = 108 }) => `
<body class="dark">
<div class="glow" style="width:1000px;height:1000px;left:-260px;top:-320px;background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.42),rgba(233,112,15,0) 70%)"></div>
<div class="glow" style="width:820px;height:820px;right:-300px;bottom:-330px;background:radial-gradient(50% 50% at 50% 50%,rgba(245,147,49,.24),rgba(245,147,49,0) 70%)"></div>
<div class="pad">
  <div style="margin-top:auto;margin-bottom:auto">
    <div class="eyebrow" style="color:#F59331">${eyebrow}</div>
    <h1 style="font-size:${size}px;margin-top:34px">${title}</h1>
    ${sub ? `<div class="sub" style="font-size:34px;color:#B9B9C4;margin-top:32px;max-width:20em">${sub}</div>` : ""}
  </div>
  ${foot(false)}
</div>
</body>`;

/** Ljós vörupóstur með síma. */
/** real=true: skjámynd tekin á alvöru iPhone, með stöðustiku og öllu — engin yfirlögn. */
const product = ({ eyebrow, title, screen, real = false }) => `
<body class="cream">
<div class="glow" style="width:1200px;height:1200px;left:-300px;top:-420px;background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.2),rgba(233,112,15,0) 70%)"></div>
<div class="pad" style="padding-bottom:0">
  <div style="display:flex;align-items:flex-end;justify-content:space-between">
    ${mark(true)}
    <div class="url" style="color:#6F6F7B">vakto.is</div>
  </div>
  <div class="eyebrow" style="color:#CF5F0C;margin-top:46px">${eyebrow}</div>
  <h1 style="font-size:82px;margin-top:24px;max-width:12em">${title}</h1>
</div>
<div class="phone">
  <img class="frame" src="file://${R}/public/app/phone-frame.png">
  <div class="ui">
    ${real ? `<img src="file://${R}/mobile/store/${screen}.png" style="top:0;height:100%">` : `<div class="status">
      <span class="t">14:28</span>
      <span class="ic">
        <svg width="26" height="18" viewBox="0 0 26 18"><rect x="0" y="12" width="4.4" height="6" rx="1.4" fill="#0b0b0d"/><rect x="6.6" y="8.5" width="4.4" height="9.5" rx="1.4" fill="#0b0b0d"/><rect x="13.2" y="4.6" width="4.4" height="13.4" rx="1.4" fill="#0b0b0d"/><rect x="19.8" y="0.6" width="4.4" height="17.4" rx="1.4" fill="#0b0b0d"/></svg>
        <svg width="24" height="18" viewBox="0 0 24 18"><path d="M12 15.6a1.9 1.9 0 1 0 0-3.8 1.9 1.9 0 0 0 0 3.8Z" fill="#0b0b0d"/><path d="M6.4 9.6a8.3 8.3 0 0 1 11.2 0" stroke="#0b0b0d" stroke-width="2.3" stroke-linecap="round" fill="none"/><path d="M2.6 5.6a14 14 0 0 1 18.8 0" stroke="#0b0b0d" stroke-width="2.3" stroke-linecap="round" fill="none"/></svg>
        <svg width="34" height="18" viewBox="0 0 34 18"><rect x="0.9" y="1.6" width="27" height="14.8" rx="4.4" stroke="#0b0b0d" stroke-opacity=".38" stroke-width="1.8" fill="none"/><rect x="3.1" y="3.8" width="20.4" height="10.4" rx="2.6" fill="#0b0b0d"/><path d="M30.2 6.4c1.7.7 1.7 4.5 0 5.2V6.4Z" fill="#0b0b0d" fill-opacity=".38"/></svg>
      </span>
    </div>
    <img src="file://${R}/mobile/store/light/${screen}.png"><span class="isl"></span>`}
  </div>
</div>
</body>`;

/** Ljós listapóstur. */
const list = ({ eyebrow, title, rows }) => `
<body class="cream">
<div class="glow" style="width:1000px;height:1000px;right:-320px;top:-300px;background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.22),rgba(233,112,15,0) 70%)"></div>
<div class="pad">
  <div style="margin-top:auto;margin-bottom:auto">
  <div class="eyebrow" style="color:#CF5F0C">${eyebrow}</div>
  <h1 style="font-size:82px;margin-top:26px;max-width:11em">${title}</h1>
  <div class="rows">
    ${rows.map((r) => `<div class="row">
      <div class="tick" style="background:#FDEEDD;color:#CF5F0C">✓</div>
      <div class="rowt">${r.t}<small style="color:#6F6F7B">${r.s}</small></div>
    </div>`).join("")}
  </div>
  </div>
  ${foot(true)}
</div>
</body>`;

/** Verðpóstur. */
const price = () => `
<body class="dark">
<div class="glow" style="width:1100px;height:1100px;left:-220px;bottom:-380px;background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.4),rgba(233,112,15,0) 70%)"></div>
<div class="pad">
  <div class="eyebrow" style="color:#F59331">Eitt verð, allt innifalið</div>
  <div style="margin-top:auto;margin-bottom:auto">
    <div class="big" style="font-size:210px">5.990<span style="font-size:74px;letter-spacing:-.02em"> kr</span></div>
    <div class="sub" style="font-size:38px;color:#fff;margin-top:14px">á mánuði, 5 notendur innifaldir</div>
    <div class="sub" style="font-size:30px;color:#B9B9C4;margin-top:10px">590 kr á hvern notanda umfram. Verð án VSK.</div>
    <div style="display:flex;gap:12px;margin-top:40px;flex-wrap:wrap">
      ${["Vaktaplan", "Stimpilklukka", "Launakeyrsla", "Spjall", "Appið"].map((t) => `<span style="font-weight:500;font-size:27px;color:#FFD9B5;border:1px solid rgba(245,147,49,.45);background:rgba(233,112,15,.14);border-radius:999px;padding:12px 26px">${t}</span>`).join("")}
    </div>
  </div>
  ${foot(false)}
</div>
</body>`;

const POSTS = [
  { file: "1-vaktin", html: statement({
      eyebrow: "Launakostnaður",
      title: "Veistu hvað<br>vaktin í kvöld<br>kostar þig?",
      sub: "VAKTO sýnir launin sem hlutfall af veltu, jafnóðum og vaktin líður.",
      size: 104 }) },
  { file: "2-vaktaplan", html: product({
      eyebrow: "Vaktaplan",
      title: "Starfsfólkið sér vaktirnar sínar í símanum",
      screen: "vaktir" }) },
  { file: "3-laun", html: product({
      eyebrow: "Laun",
      title: "„Hvað fæ ég útborgað?“ — svarið er í appinu",
      screen: "laun" }) },
  { file: "4-kjarasamningur", html: list({
      eyebrow: "Kjarasamningar",
      title: "Álagið reiknast sjálfkrafa",
      rows: [
        { t: "Kvöld-, helgar- og stórhátíðarálag", s: "eftir Eflingu, VR, Matvís eða ykkar eigin reglum" },
        { t: "Yfirvinna og hvíldartími", s: "reiknað úr stimplunum, ekki úr minni" },
        { t: "Orlof og uppbætur", s: "fylgja með í launakeyrslunni" },
      ] }) },
  { file: "5-verd", html: price() },
  { file: "demo-alvoru-heim", html: product({
      eyebrow: "Heim",
      title: "Stimplaðu þig inn í símanum",
      screen: "real-heim", real: true }) },
  { file: "6-prufa", html: statement({
      eyebrow: "Byrjaðu í dag",
      title: "14 daga<br>frí prufa",
      sub: "Kortið er skráð við nýskráningu en ekkert dregið fyrr en prufan er búin. Uppsetning tekur um korter.",
      size: 124 }) },
];

fs.mkdirSync(OUT, { recursive: true });
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 }, deviceScaleFactor: 1 });
for (const post of POSTS) {
  fs.writeFileSync("/tmp/ig.html", `<style>${CSS}</style>${post.html}`);
  await p.goto("file:///tmp/ig.html");
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${post.file}.png` });
  console.log("✓", post.file);
}
await b.close();
