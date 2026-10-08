// App Store skjámyndir (6,3": 1206×2622, stærðin sem App Store Connect biður um). Stöðustika ofan við skjámyndina svo eyjan hylji ekkert.
import pkg from "/Users/bjarniludviksson/vakto/node_modules/playwright/index.js";
import fs from "node:fs";
const { chromium } = pkg;
const R = "/Users/bjarniludviksson/vakto-live";
const OUT = process.argv[2] || `${R}/mobile/store/ios`;
fs.mkdirSync(OUT, { recursive: true });
const SHOW = `${R}/public/showcase/forsida/light`;
const SLIDES = [
  { key: "1-heim", src: `${SHOW}/app-heim.png`, eyebrow: "STIMPILKLUKKA", title: "Stimplaðu þig inn<br>í símanum" },
  { key: "2-vaktir", src: `${SHOW}/app-vaktir.png`, eyebrow: "VAKTAPLAN", title: "Vikan þín,<br>litað eftir vakt" },
  { key: "3-laun", src: `${R}/mobile/store/light/laun.png`, eyebrow: "LAUN", title: "Sjáðu launin<br>jafnóðum" },
  { key: "4-spjall", src: `${SHOW}/app-spjall.png`, eyebrow: "SPJALL", title: "Spjallaðu við<br>vinnufélagana" },
  { key: "5-frettir", src: `${SHOW}/app-frettir.png`, eyebrow: "FRÉTTAVEITA", title: "Fréttir frá<br>vinnustaðnum" },
];
const W = 1206, H = 2622;
const Z = W / 1170;
const page = (s) => `
<style>
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Bold.otf");font-weight:700}
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Semibold.otf");font-weight:600}
*{margin:0;box-sizing:border-box}
html{background:#fbf8f4}
body{width:1170px;height:${Math.ceil(H / Z)}px;overflow:hidden;font-family:GS,system-ui;background:#fbf8f4;position:relative;zoom:${Z}}
.glow{position:absolute;width:1500px;height:1500px;left:-280px;top:-560px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.22),rgba(233,112,15,0) 70%)}
.glow2{position:absolute;width:1100px;height:1100px;right:-380px;top:1250px;border-radius:50%;background:radial-gradient(50% 50% at 50% 50%,rgba(245,147,49,.16),rgba(245,147,49,0) 70%)}
.cap{position:absolute;left:0;right:0;top:150px;text-align:center;padding:0 80px}
.eyebrow{font-weight:600;font-size:34px;letter-spacing:.16em;color:#cf5f0c}
h1{font-weight:700;font-size:96px;line-height:1.08;letter-spacing:-.035em;color:#16161a;margin-top:26px}
.phone{position:absolute;width:900px;left:135px;top:640px}
.phone .frame{display:block;width:100%}
.ui{position:absolute;left:2.72%;right:2.54%;top:.70%;bottom:.79%;border-radius:18%/8.1%;overflow:hidden;background:#fff}
.sb{height:118px;display:flex;justify-content:space-between;align-items:flex-end;padding:0 74px 16px 84px;font-weight:600;font-size:34px;color:#111;background:#fff}
.sb svg{display:block}
.ui img{display:block;width:100%}
.isl{position:absolute;top:2.1%;left:50%;transform:translateX(-50%);width:23%;height:1.9%;border-radius:999px;background:#0b0b0d;z-index:2}
</style>
<div class="glow"></div><div class="glow2"></div>
<div class="cap"><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1></div>
<div class="phone">
  <img class="frame" src="file://${R}/public/app/phone-frame.png">
  <div class="ui"><div class="sb"><span>9:41</span><span style="display:flex;gap:12px;align-items:center">
    <svg width="38" height="24" viewBox="0 0 22 14"><rect x="0" y="9" width="4" height="5" rx="1" fill="#111"/><rect x="6" y="6" width="4" height="8" rx="1" fill="#111"/><rect x="12" y="3" width="4" height="11" rx="1" fill="#111"/><rect x="18" y="0" width="4" height="14" rx="1" fill="#111"/></svg>
    <svg width="52" height="26" viewBox="0 0 30 15"><rect x=".75" y=".75" width="25" height="13.5" rx="4" fill="none" stroke="#111" stroke-opacity=".4" stroke-width="1.5"/><rect x="3" y="3" width="19" height="9" rx="2" fill="#111"/><rect x="27.5" y="5" width="2" height="5" rx="1" fill="#111" fill-opacity=".4"/></svg></span></div>
    <img src="file://${s.src}"><span class="isl"></span></div>
</div>`;
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
for (const s of SLIDES) {
  fs.writeFileSync(`${OUT}/_mk.html`, page(s));
  await p.goto(`file://${OUT}/_mk.html`);
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${s.key}.png` });
  console.log("✓", s.key);
}
fs.rmSync(`${OUT}/_mk.html`);
await b.close();
