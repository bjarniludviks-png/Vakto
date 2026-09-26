import pkg from "/Users/bjarniludviksson/vakto/node_modules/playwright/index.js";
import fs from "node:fs";
const { chromium } = pkg;
const R = "/Users/bjarniludviksson/vakto-live";
const OUT = `${R}/mobile/store/play`;
fs.mkdirSync(OUT, { recursive: true });

const SLIDES = [
  { key: "vaktir",    eyebrow: "VAKTAPLAN",    title: "Vikan þín,<br>litað eftir vakt" },
  { key: "heim",      eyebrow: "STIMPILKLUKKA", title: "Stimplaðu þig inn<br>í símanum" },
  { key: "laun",      eyebrow: "LAUN",         title: "Sjáðu launin<br>jafnóðum" },
  { key: "frettir",   eyebrow: "FRÉTTAVEITA",  title: "Fréttir frá<br>vinnustaðnum" },
  { key: "skirteini", eyebrow: "SKÍRTEINI",    title: "Skírteinið alltaf<br>í vasanum" },
];

const page = (s) => `
<style>
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Bold.otf");font-weight:700}
@font-face{font-family:GS;src:url("file://${R}/mobile/assets/fonts/GeneralSans-Semibold.otf");font-weight:600}
*{margin:0;box-sizing:border-box}
body{width:1170px;height:2532px;overflow:hidden;font-family:GS,system-ui;
  background:#fbf8f4;position:relative}
.glow{position:absolute;width:1500px;height:1500px;left:-280px;top:-560px;border-radius:50%;
  background:radial-gradient(50% 50% at 50% 50%,rgba(233,112,15,.22),rgba(233,112,15,0) 70%)}
.glow2{position:absolute;width:1100px;height:1100px;right:-380px;top:1250px;border-radius:50%;
  background:radial-gradient(50% 50% at 50% 50%,rgba(245,147,49,.16),rgba(245,147,49,0) 70%)}
.cap{position:absolute;left:0;right:0;top:150px;text-align:center;padding:0 80px}
.eyebrow{font-weight:600;font-size:34px;letter-spacing:.16em;color:#cf5f0c}
h1{font-weight:700;font-size:96px;line-height:1.08;letter-spacing:-.035em;color:#16161a;margin-top:26px}
.phone{position:absolute;width:900px;left:135px;top:640px}
.phone .frame{display:block;width:100%}
.ui{position:absolute;left:2.72%;right:2.54%;top:.70%;bottom:.79%;border-radius:18%/8.1%;overflow:hidden;background:#fff}
.ui img{display:block;width:100%;height:100%;object-fit:cover;object-position:top}
.isl{position:absolute;top:2.1%;left:50%;transform:translateX(-50%);width:23%;height:1.9%;border-radius:999px;background:#0b0b0d;z-index:2}
</style>
<div class="glow"></div><div class="glow2"></div>
<div class="cap"><div class="eyebrow">${s.eyebrow}</div><h1>${s.title}</h1></div>
<div class="phone">
  <img class="frame" src="file://${R}/public/app/phone-frame.png">
  <div class="ui"><img src="file://${R}/mobile/store/light/${s.key}.png"><span class="isl"></span></div>
</div>`;

const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1170, height: 2532 }, deviceScaleFactor: 1 });
for (const s of SLIDES) {
  fs.writeFileSync("/tmp/mk.html", page(s));
  await p.goto("file:///tmp/mk.html");
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${s.key}.png` });
  console.log("✓", s.key);
}
await b.close();
