# SHARED-LANDING — „miðnætursól“ landing-síðan (VAKTO ⇄ INVENTRA)

Uppbygging og afritanleg mynstur VAKTO-heimasíðunnar (`src/app/ny/ny-client.tsx`
+ `ny.css`) — gerð almenn fyrir systkina-öpp. **Allir brand-litir leiða af EINNI
breytu `--brand`** (gegnum `color-mix`); INVENTRA setur grænt þar og öll
auróran, glóðirnar og hnapparnir fylgja. Engir VAKTO-textar — bara stíll,
uppröðun og íhlutir.

**Design-DNA:** djúpsvartur bakgrunnur (`#060607`), gler-fletir (glass morphism,
`backdrop-filter`), brand-lituð „miðnætursólar“-sjóndeildarhringur með stjörnuhimni
í hero, mjúkar upprisu-hreyfingar (fade-up) á öllu efni, `General Sans`-letur
(skiptu út ef INVENTRA notar annað), ALLT hreyft með transform/opacity (GPU-vænt)
og allt virðir `prefers-reduced-motion`.

---

## 0) Kaflaröðin (ofan frá og niður)

| # | Kafli | id | Uppröðun |
|---|-------|----|----------|
| 1 | **Nav** — fljótandi gler-pilla | — | fixed efst-miðja: logo · hlekkir · [tungumál, Innskráning, CTA]; hamborgari ≤900px |
| 2 | **Hero** — miðnætursólin | — | miðjað: pilla → H1 (2 línur) → undirtexti → 2 CTA → skjámynd rís úr sjóndeildarhringnum |
| 3 | **Treyst-borði** — viðskiptavinalógó | — | uppercase-lína + óendanlegt marquee með fade-brúnum |
| 4 | **Yfirlýsing + atvinnugreina-pláneta** | — | stór setning vinstra megin (brand-em), glans-hnöttur hægra megin sem flettir greinum |
| 5 | **Eiginleikar (bento)** | `#eiginleikar` | 2 dálka grid; fyrsta kort `big` (full breidd, mynd hægri), síðasta `wide` (full breidd, mynd vinstri); hvert kort = mini-visual + texti |
| 6 | **Svona virkar það (skref)** | `#skref` | 3 jafnbreiða kort: 01/02/03 mono-númer → H3 → texti |
| 7 | **Skjámynda-sýning** | `#kerfid` | láréttur scroll-snap slider m. örvum + punktum |
| 8 | **Ummæli (voices)** | — | eitt stórt featured-kort (mynd + tilvitnun) + 2×1 grid minni korta |
| 9 | **App-kynning** *(valfrjáls)* | — | texti + punktalisti vinstra megin, svífandi síma-mockup hægra megin |
| 10 | **Verð** | `#verd` | EITT miðjað kort með glóð: upphæð → hakalisti → CTA → smáletur |
| 11 | **Loka-CTA** | — | H2 + 2 hnappar, miðjað |
| 12 | **FAQ** *(viðbót — sjá §9)* | `#faq` | gler-accordion í sama stíl |
| 13 | **Footer** | — | aurora-þoka efst, 5 dálka grid, botnalína, RISASTÓRT gegnsætt vörumerki neðst |

---

## 1) Tókar — brand-liturinn er EIN breyta

Rót-klasinn (`.ny`) skilgreinir allt; síðan er dökk óháð dark-mode appsins.
**INVENTRA breytir bara `--brand`** (t.d. `#1f9d6b`) og öllu hinu er leitt af því.
`--accent` er kaldi bláminn í kosmíkinni — má halda eða stilla.

```css
.ny{
  /* ============ EINA breytan sem systkina-app skiptir um ============ */
  --brand:#e9700f;

  /* leidd af --brand — EKKI breyta */
  --brand2:color-mix(in srgb, var(--brand) 72%, #ffd9a0);   /* ljósari tónn */
  --brand-deep:color-mix(in srgb, var(--brand) 82%, black);
  --glow:color-mix(in srgb, var(--brand) 55%, transparent);

  /* kaldi mótleikurinn í aurórunni (má vera kyrr milli appa) */
  --accent:#6096eb;

  /* fastir dökkir tónar */
  --ink:#f4f2ee;--dim:rgba(244,242,238,.62);--dim2:rgba(244,242,238,.38);
  --bg:#060607;--panel:rgba(255,255,255,.04);--line:rgba(255,255,255,.09);
  --good:#2ec27e;
  --ease:cubic-bezier(.23,1,.32,1);

  font-family:'General Sans',-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,sans-serif;
  background:var(--bg);color:var(--ink);letter-spacing:-.011em;line-height:1.55;
  min-height:100dvh;overflow-x:clip}
.ny a{color:inherit;text-decoration:none}
.ny :focus-visible{outline:2px solid var(--brand2);outline-offset:3px;border-radius:6px}
.ny h1,.ny h2,.ny h3{font-weight:600;letter-spacing:-.035em;line-height:1.05}
```

Hjálpar-fall í hausnum á þér: alls staðar þar sem VAKTO-css-ið hafði
`rgba(233,112,15,.X)` notar þessi útgáfa `color-mix(in srgb, var(--brand) X%, transparent)`
— og `rgba(245,147,49,.X)` → `color-mix(in srgb, var(--brand2) X%, transparent)`.

---

## 2) Hreyfingar-grunnur (fyrsta hleðsla + scroll-reveal)

```css
/* fyrsta hleðsla: efni rís með stigvaxandi delay (sett inline á hvert stak) */
@keyframes nyin{from{opacity:0;transform:translateY(18px)}to{opacity:1;transform:none}}
.ny-hin{opacity:0;animation:nyin .85s var(--ease) forwards}
/* hero-skjámyndin rís lengra og hægar */
@keyframes nyshot{from{opacity:0;transform:translateY(70px)}to{opacity:1;transform:none}}
.ny-shot.ny-hin{animation:nyshot 1.15s var(--ease) forwards}
/* scroll-reveal (parað við <Rise>) */
.ny-rise{opacity:0;transform:translateY(22px);transition:opacity .7s var(--ease),transform .7s var(--ease)}
.ny-rise.in{opacity:1;transform:none}
@media(prefers-reduced-motion:reduce){
  .ny-hin,.ny-shot.ny-hin{animation:none;opacity:1}
  .ny-rise{opacity:1;transform:none;transition:none}
}
```

```tsx
/** Mjúk upprisa við innkomu í viewport; reduced-motion birtir strax. */
function Rise({ children, delay = 0, className = "" }: {
  children: React.ReactNode; delay?: number; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.15, rootMargin: "0px 0px -6% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`ny-rise${seen ? " in" : ""}${className ? ` ${className}` : ""}`}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}
```

Notkun: hvert section-innihald vafið í `<Rise>`; kort í grid-um fá
`delay={(i % 2) * 80}` (eða `i * 90` í röðum) svo þau tifi inn.

---

## 3) IS/EN i18n-uppbyggingin

Allir textar búa í EINU `T`-objecti; ekkert i18n-framework:

```tsx
type Lang = "is" | "en";

const T: Record<Lang, {
  nav: [string, string, string];
  login: string; start: string;
  pill: string; h1: [string, string]; sub: string; ctaSee: string;
  trust: string;
  st1: string; stEm: string; st2: string;          // yfirlýsing: fyrir-em-eftir
  industries: string[];
  featHead: string; featSub: string;
  features: { title: string; desc: string }[];
  stepsHead: string; steps: { title: string; desc: string }[];
  showHead: string; showSub: string; slides: { title: string; desc: string }[];
  voicesHead: string; voicesSub: string;
  voices: { quote: string; role: string }[];
  priceHead: string; priceSub: string; priceAmt: string; priceUnit: string;
  priceItems: string[]; priceFine: string;
  ctaEnd: string; ctaDemo: string;
  footBlurb: string; /* … footer-dálkar eins og hentar … */
}> = { is: { /* … */ }, en: { /* … */ } };

// inni í síðu-componentinum:
const [lang, setLang] = useState<Lang>("is");
useEffect(() => {
  try { if (localStorage.getItem("app-lang") === "en") setLang("en"); } catch {}
}, []);
const t = T[lang];
const q = lang === "en" ? "?lang=en" : "";     // hengt á /login og /nyskraning hlekki
function toggleLang() {
  const next: Lang = lang === "is" ? "en" : "is";
  setLang(next);
  try { localStorage.setItem("app-lang", next); } catch {}
}
```

Tungumála-hnötturinn (í nav og mobile-menu):

```tsx
<button className="ny-lang" onClick={toggleLang}>
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round"><circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.6 3.8 5.7 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.7-3.8-9S9.5 5.6 12 3Z"/></svg>
  {lang === "is" ? "EN" : "IS"}
</button>
```

```css
.ny-lang{display:inline-flex;align-items:center;gap:6px;font:inherit;font-size:12.5px;font-weight:600;letter-spacing:.04em;
  color:var(--dim);background:none;border:1px solid var(--line);border-radius:999px;padding:8px 13px;cursor:pointer;transition:color .15s,background .15s}
.ny-lang svg{width:15px;height:15px}
@media(hover:hover) and (pointer:fine){.ny-lang:hover{color:var(--ink);background:rgba(255,255,255,.06)}}
```

VAKTO notar sama localStorage-lykil og app-skelin svo valið fylgir notandanum
inn í appið — gerðu slíkt hið sama (`inventra-lang`).

---

## 4) Hnappar (notaðir alls staðar)

```css
.ny-btn{display:inline-flex;align-items:center;gap:8px;font-weight:600;font-size:14.5px;border-radius:12px;padding:11px 20px;cursor:pointer;border:1px solid transparent;transition:transform 160ms var(--ease),background 160ms ease,box-shadow 160ms ease;white-space:nowrap}
.ny-btn:active{transform:scale(.97)}
.ny-btn.lg{padding:14px 26px;font-size:15.5px;border-radius:13px}
.ny-btn.ghost{background:rgba(255,255,255,.05);border-color:var(--line);color:var(--ink)}
/* GLOW = aðal-CTA: dökkt gler með brand-glóandi ramma */
.ny-btn.glow{position:relative;background:linear-gradient(180deg,#1c1c1f,#0c0c0e);color:#fff;
  border-color:color-mix(in srgb, var(--brand2) 55%, transparent);
  box-shadow:0 0 22px -4px var(--glow),inset 0 1px 0 rgba(255,255,255,.14)}
@media(hover:hover) and (pointer:fine){
  .ny-btn.ghost:hover{background:rgba(255,255,255,.09);transform:translateY(-1px)}
  .ny-btn.glow:hover{box-shadow:0 0 34px -4px var(--glow),inset 0 1px 0 rgba(255,255,255,.18);transform:translateY(-1px)}
}
```

---

## 5) Kafli fyrir kafla

### 5.1 Nav — fljótandi gler-pilla

```tsx
<nav className="ny-nav">
  <a className="ny-logo" href="/"><Logo w={24} />INVENTRA</a>
  <div className="ny-links">
    <a href="#eiginleikar">…</a><a href="#skref">…</a><a href="#verd">…</a>
  </div>
  <div className="ny-navcta">{langBtn}
    <a className="ny-btn ghost" href="/login">…</a>
    <a className="ny-btn glow" href="/nyskraning">…</a>
  </div>
  {/* hamborgari + .ny-menu dropdown ≤900px — sjá CSS */}
</nav>
```

```css
@keyframes nynav{from{opacity:0;transform:translate(-50%,-16px)}to{opacity:1;transform:translate(-50%,0)}}
.ny-nav{position:fixed;top:18px;left:50%;transform:translateX(-50%);z-index:60;display:flex;align-items:center;gap:26px;
  background:rgba(12,12,14,.55);border:1px solid var(--line);border-radius:999px;padding:9px 12px 9px 20px;
  backdrop-filter:blur(18px) saturate(150%);box-shadow:0 10px 40px -12px rgba(0,0,0,.7);width:min(880px,calc(100% - 32px));
  animation:nynav .7s var(--ease) .2s both}
.ny-logo{display:flex;align-items:center;gap:9px;font-weight:700;font-size:16.5px;letter-spacing:1px}
.ny-links{display:flex;gap:22px;margin:0 auto}
.ny-links a{font-size:14px;color:var(--dim);font-weight:500;transition:color .15s}
.ny-navcta{display:flex;gap:8px;align-items:center}
/* hamborgari (2 strik → X) + gler-dropdown */
.ny-burger{display:none;width:40px;height:40px;flex-shrink:0;background:none;border:0;cursor:pointer;position:relative;padding:0}
.ny-burger i{position:absolute;left:10px;right:10px;height:2px;border-radius:2px;background:var(--ink);transition:transform .25s var(--ease),top .25s var(--ease)}
.ny-burger i:first-child{top:15px}.ny-burger i:last-child{top:23px}
.ny-burger.open i:first-child{top:19px;transform:rotate(45deg)}
.ny-burger.open i:last-child{top:19px;transform:rotate(-45deg)}
@keyframes nymenu{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:none}}
.ny-menu{position:absolute;top:calc(100% + 10px);left:0;right:0;display:flex;flex-direction:column;gap:4px;
  background:rgba(12,12,14,.92);border:1px solid var(--line);border-radius:20px;padding:14px;
  backdrop-filter:blur(18px) saturate(150%);box-shadow:0 18px 50px -12px rgba(0,0,0,.8);animation:nymenu .3s var(--ease) both}
.ny-menu>a:not(.ny-btn){font-size:15px;font-weight:500;color:var(--ink);padding:11px 10px;border-radius:10px}
.ny-menu-sep{height:1px;background:var(--line);margin:6px 0}
.ny-menu .ny-btn{justify-content:center}
```

### 5.2 Hero — miðnætursólin

Uppröðun (allt miðjað, hvert stak `.ny-hin` með vaxandi `animationDelay`
350→900ms): gler-pilla → H1 í tveimur línum → undirtexti → tveir CTA →
skjámynd sem rís úr glóðinni og fjarar út að neðan (mask).

```tsx
<header className="ny-hero">
  <div className="ny-aurora" aria-hidden="true">
    <Starfield layer={1} /><Starfield layer={2} />
    <i className="a1" /><i className="a2" /><i className="a3" />
    <span className="ny-rays r1" /><span className="ny-rays r2" /><span className="ny-rays r3" />
    <span className="ny-horizon" /><span className="ny-underglow" />
  </div>
  <div className="ny-hero-in">
    <span className="ny-pill ny-hin" style={{ animationDelay: "350ms" }}>{t.pill}</span>
    <h1 className="ny-hin" style={{ animationDelay: "480ms" }}>{t.h1[0]}<br />{t.h1[1]}</h1>
    <p className="ny-sub ny-hin" style={{ animationDelay: "620ms" }}>{t.sub}</p>
    <div className="ny-ctas ny-hin" style={{ animationDelay: "760ms" }}>
      <a className="ny-btn glow lg" href="/nyskraning">{t.start}</a>
      <a className="ny-btn ghost lg" href="#eiginleikar">{t.ctaSee}</a>
    </div>
    <div className="ny-shot ny-hin" style={{ animationDelay: "900ms" }}>
      <img src="/skjamynd.png" alt="…" />
    </div>
  </div>
</header>
```

```css
.ny-hero{position:relative;padding:150px 24px 0;text-align:center;overflow:hidden}
.ny-hero-in{position:relative;z-index:2;max-width:1060px;margin:0 auto}
.ny-pill{display:inline-block;font-size:13px;font-weight:500;color:var(--dim);background:rgba(255,255,255,.05);border:1px solid var(--line);border-radius:999px;padding:7px 16px;backdrop-filter:blur(8px)}
.ny-hero h1{font-size:clamp(42px,6.4vw,84px);margin-top:26px;color:#fff;text-shadow:0 2px 40px rgba(0,0,0,.5)}
.ny-sub{font-size:18px;color:var(--dim);max-width:620px;margin:24px auto 0;line-height:1.65}
.ny-ctas{display:flex;gap:12px;justify-content:center;margin-top:34px;flex-wrap:wrap}

/* auróran: allt hreyfist bara með transform/opacity (GPU-vænt) */
.ny-aurora{position:absolute;inset:0;pointer-events:none;animation:nyignite 1.8s ease-out both}
@keyframes nyignite{from{opacity:0}to{opacity:1}}

/* stjörnuhiminn: tvö SVG-lög (parallax) með sjálfstæðu blikki */
.ny-stars{position:absolute;inset:-12% -12% 18% -12%;width:auto;height:auto;will-change:transform;
  mask-image:linear-gradient(to bottom,#000 58%,transparent 100%)}
.ny-stars.s1{animation:nystars1 140s linear infinite alternate,nytwinkle 6s ease-in-out infinite}
.ny-stars.s2{animation:nystars2 200s linear infinite alternate,nytwinkle 9s ease-in-out infinite 1.4s}
@keyframes nystars1{from{transform:translate3d(0,0,0)}to{transform:translate3d(-90px,40px,0)}}
@keyframes nystars2{from{transform:translate3d(0,0,0)}to{transform:translate3d(70px,-50px,0)}}
@keyframes nytwinkle{0%,100%{opacity:.5}50%{opacity:1}}

/* andandi glóðar-blettir sem reka til hliðar */
.ny-aurora i{position:absolute;border-radius:50%;filter:blur(70px);will-change:transform,opacity}
.ny-aurora .a1{left:50%;top:20%;width:1350px;height:760px;transform:translateX(-54%);
  background:radial-gradient(50% 50% at 50% 60%,color-mix(in srgb,var(--brand) 42%,transparent),transparent 70%);animation:nyaurA 11s ease-in-out infinite}
.ny-aurora .a2{left:50%;top:34%;width:820px;height:500px;transform:translateX(-92%);
  background:radial-gradient(50% 50% at 50% 50%,color-mix(in srgb,var(--brand2) 30%,transparent),transparent 70%);animation:nyaurB 14s ease-in-out infinite}
.ny-aurora .a3{left:50%;top:30%;width:880px;height:520px;transform:translateX(10%);
  background:radial-gradient(50% 50% at 50% 50%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 70%);animation:nyaurC 17s ease-in-out infinite}
@keyframes nyaurA{0%,100%{opacity:.85;transform:translateX(-54%)}50%{opacity:1;transform:translateX(-51%)}}
@keyframes nyaurB{0%,100%{opacity:.8;transform:translateX(-92%)}50%{opacity:1;transform:translateX(-86%)}}
@keyframes nyaurC{0%,100%{opacity:.75;transform:translateX(10%)}50%{opacity:1;transform:translateX(4%)}}

/* ljósgeislarnir: þrjú repeating-gradient lög á mismunandi hraða */
.ny-rays{position:absolute;top:-6%;height:900px;width:2200px;will-change:transform;
  mask-image:radial-gradient(50% 62% at 50% 74%,#000 22%,transparent 72%)}
.ny-rays.r1{left:42%;filter:blur(7px);
  background:repeating-linear-gradient(90deg,transparent 0 48px,color-mix(in srgb,var(--brand2) 18%,transparent) 48px 58px,transparent 58px 128px,color-mix(in srgb,var(--brand) 13%,transparent) 128px 140px,transparent 140px 176px,color-mix(in srgb,var(--accent) 8%,transparent) 176px 184px,transparent 184px 230px);
  animation:nydrift1 23s ease-in-out infinite alternate}
.ny-rays.r2{left:50%;filter:blur(3px);
  background:repeating-linear-gradient(90deg,transparent 0 82px,rgba(255,244,230,.1) 82px 87px,transparent 87px 150px,color-mix(in srgb,var(--accent) 8%,transparent) 150px 155px,transparent 155px 205px);
  animation:nydrift2 31s ease-in-out infinite alternate}
.ny-rays.r3{left:58%;filter:blur(8px);
  background:repeating-linear-gradient(90deg,transparent 0 64px,color-mix(in srgb,var(--accent) 17%,transparent) 64px 74px,transparent 74px 130px,color-mix(in srgb,var(--accent) 10%,transparent) 130px 138px,transparent 138px 170px);
  animation:nydrift3 41s ease-in-out infinite alternate}
@keyframes nydrift1{from{transform:translateX(-53%)}to{transform:translateX(-47%)}}
@keyframes nydrift2{from{transform:translateX(-47%)}to{transform:translateX(-53%)}}
@keyframes nydrift3{from{transform:translateX(-52%)}to{transform:translateX(-48%)}}

/* sjóndeildarhringurinn: risastór svartur hringur með brand-glóandi efri brún */
.ny-horizon{position:absolute;left:50%;top:565px;width:2600px;height:2600px;transform:translateX(-50%);border-radius:50%;
  background:var(--bg);
  box-shadow:0 -3px 24px color-mix(in srgb,var(--brand2) 60%,white 25%),
    0 -18px 90px 6px color-mix(in srgb,var(--brand) 60%,transparent),
    0 -60px 220px 30px color-mix(in srgb,var(--brand) 32%,transparent),
    inset 0 6px 22px color-mix(in srgb,var(--brand2) 40%,white 10%),
    inset 0 34px 110px -12px color-mix(in srgb,var(--brand) 40%,transparent),
    inset 0 90px 240px -30px color-mix(in srgb,var(--brand) 18%,transparent);
  border-top:1px solid color-mix(in srgb,var(--brand2) 55%,white 35%)}
/* mjúk birta niður fyrir línuna, bak við skjámyndina */
.ny-underglow{position:absolute;left:50%;top:600px;width:1500px;height:520px;transform:translateX(-50%);
  background:radial-gradient(50% 56% at 50% 0%,color-mix(in srgb,var(--brand) 26%,transparent),color-mix(in srgb,var(--accent) 7%,transparent) 55%,transparent 75%);
  filter:blur(34px);animation:nyaur 9s ease-in-out infinite}
@keyframes nyaur{0%,100%{opacity:.85}50%{opacity:1}}

/* hero-skjámyndin ríður sjóndeildarhringnum, fjarar út að neðan */
.ny-shot{position:relative;z-index:2;max-width:960px;margin:64px auto 0}
.ny-shot img{display:block;width:100%;height:auto;border-radius:16px 16px 0 0;border:1px solid rgba(255,255,255,.14);border-bottom:0;
  box-shadow:0 -20px 80px -20px color-mix(in srgb,var(--brand) 35%,transparent),0 40px 120px -30px rgba(0,0,0,.8);
  mask-image:linear-gradient(to bottom,#000 55%,transparent 98%)}
```

Starfield-componentinn (seeded random svo SSR/klient stemmi — jittered grid,
engir klumpar):

```tsx
function mulberry32(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function Starfield({ layer }: { layer: 1 | 2 }) {
  const rnd = mulberry32(layer === 1 ? 0x5747a1 : 0x36c9d3);
  const cols = 16, rows = 9, cw = 1600 / cols, ch = 900 / rows;
  const colors = ["255,255,255", "255,244,230", "214,228,255"];
  const stars = [];
  for (let gy = 0; gy < rows; gy++) for (let gx = 0; gx < cols; gx++) {
    const keep = rnd() < (layer === 1 ? 0.62 : 0.5);
    const x = gx * cw + cw * (0.08 + rnd() * 0.84);
    const y = gy * ch + ch * (0.08 + rnd() * 0.84);
    const r = 0.5 + rnd() * (layer === 1 ? 1.0 : 0.8);
    const c = colors[Math.floor(rnd() * colors.length)];
    const o = 0.35 + rnd() * 0.55;
    if (!keep) continue;
    stars.push(<circle key={`${gx}-${gy}`} cx={x.toFixed(1)} cy={y.toFixed(1)} r={r.toFixed(2)} fill={`rgba(${c},${o.toFixed(2)})`} />);
  }
  return <svg className={`ny-stars s${layer}`} viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice" aria-hidden="true">{stars}</svg>;
}
```

### 5.3 Treyst-borði (marquee)

Tvö eins sett í spori sem rennur um -50% → óendanlegt; fade á brúnum með mask;
pásar á hover.

```tsx
<section className="ny-trust">
  <Rise>
    <p>{t.trust}</p>
    <div className="ny-wall"><div className="ny-wall-track">
      <div className="ny-wall-set">{logos}</div>
      <div className="ny-wall-set" aria-hidden="true">{logos}</div>
    </div></div>
  </Rise>
</section>
```

```css
.ny-trust{padding:36px 24px 8px;text-align:center}
.ny-trust p{font-size:12px;letter-spacing:.14em;text-transform:uppercase;color:var(--dim2);font-weight:500;margin-bottom:22px}
.ny-wall{overflow:hidden;max-width:900px;margin:0 auto;
  mask-image:linear-gradient(90deg,transparent,#000 16%,#000 84%,transparent)}
.ny-wall-track{display:flex;width:max-content;animation:nywall 28s linear infinite;will-change:transform}
.ny-wall-set{display:flex;align-items:center;gap:72px;padding-right:72px}
@keyframes nywall{to{transform:translateX(-50%)}}
@media(hover:hover) and (pointer:fine){.ny-wall:hover .ny-wall-track{animation-play-state:paused}}
.ny-wm{display:inline-flex;font-size:20px;line-height:1;color:rgba(244,242,238,.42);transition:color .2s;white-space:nowrap}
.ny-wm-img{height:46px;width:auto;object-fit:contain;opacity:.6;transition:opacity .2s,transform .2s}
```

### 5.4 Yfirlýsing + pláneta

Stór setning (brand-litað `em`) + glans-hnöttur sem flettir í gegnum
atvinnugreinar (íkon + heiti skiptast á 2,4s fresti með `nyface`-inn-animation).

```css
.ny-state{padding:120px 24px 40px}
.ny-state-grid{display:flex;align-items:center;gap:56px;max-width:1000px;margin:0 auto}
.ny-statement{font-size:clamp(21px,2.6vw,30px);font-weight:500;letter-spacing:-.02em;line-height:1.45;color:var(--ink)}
.ny-statement em{font-style:normal;color:var(--brand2)}
.ny-planet{position:relative;flex:0 0 auto;width:220px;height:220px;border-radius:50%;overflow:hidden;
  background:radial-gradient(130% 130% at 30% 22%,color-mix(in srgb,var(--accent) 80%,white) 0%,color-mix(in srgb,var(--accent) 55%,black) 36%,#181b2b 56%,var(--brand-deep) 80%,var(--brand2) 102%);
  box-shadow:0 0 90px -12px var(--glow),0 0 70px -24px color-mix(in srgb,var(--accent) 50%,transparent),inset 0 2px 18px rgba(255,255,255,.28),inset 0 -22px 60px rgba(0,0,0,.6);
  animation:nyfloat 7s ease-in-out infinite}
.ny-planet-swirl{position:absolute;inset:-42%;background:conic-gradient(from 0deg,color-mix(in srgb,var(--accent) 40%,transparent),color-mix(in srgb,var(--brand) 44%,transparent),rgba(14,16,26,.25),color-mix(in srgb,var(--accent) 40%,transparent));filter:blur(26px);animation:nyspin 20s linear infinite}
@keyframes nyspin{to{transform:rotate(360deg)}}
.ny-planet-shine{position:absolute;inset:0;border-radius:50%;background:radial-gradient(58% 42% at 32% 20%,rgba(255,255,255,.42),transparent 62%)}
.ny-planet-face{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:11px;color:#fff;animation:nyface .55s var(--ease)}
@keyframes nyface{from{opacity:0;transform:scale(.9) translateY(8px)}to{opacity:1;transform:none}}
@keyframes nyfloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-12px)}}
```

### 5.5 Eiginleikar — bento-grid gler-korta

Section-haus er samnýtt mynstur allra kafla:

```css
.ny-sec{padding:110px 24px}
.ny-head{text-align:center;max-width:640px;margin:0 auto 56px}
.ny-head h2{font-size:clamp(30px,4vw,46px);color:#fff}
.ny-head p{font-size:17px;color:var(--dim);margin-top:14px}
```

Bento-ið: 2 dálkar; layout-mynstur `[{big},{},{},{},{},{wide}]` — fyrsta kortið
`big` (full breidd, visual hægra megin, texti stærri), síðasta `wide` (full
breidd, visual vinstra megin). Hvert kort: dökkt visual-svið efst með brand-glóð
(`::before`), svo H3 + málsgrein.

```css
.ny-cards{display:grid;grid-template-columns:repeat(2,1fr);gap:18px;max-width:1060px;margin:0 auto}
.ny-card{position:relative;overflow:hidden;background:linear-gradient(180deg,rgba(255,255,255,.055),rgba(255,255,255,.02));
  border:1px solid var(--line);border-radius:20px;padding:28px;box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ny-card.big{grid-column:1/-1;display:grid;grid-template-columns:1.1fr .9fr;gap:30px;align-items:center}
.ny-card.big .ny-card-vis{order:2}
.ny-card.wide{grid-column:1/-1;display:grid;grid-template-columns:.9fr 1.1fr;gap:30px;align-items:center}
.ny-card.wide .ny-card-vis{height:170px}
.ny-card h3{font-size:19px;color:#fff;margin-top:18px}
.ny-card.big h3{margin-top:0;font-size:24px}
.ny-card.wide h3{margin-top:0;font-size:22px}
.ny-card p{font-size:14.5px;color:var(--dim);margin-top:9px;line-height:1.6;max-width:52ch}
.ny-card-vis{position:relative;height:130px;border-radius:14px;background:rgba(0,0,0,.35);border:1px solid rgba(255,255,255,.07);display:flex;align-items:center;justify-content:center;overflow:hidden}
.ny-card.big .ny-card-vis{height:230px}
.ny-card-vis::before{content:"";position:absolute;inset:-40%;background:radial-gradient(40% 40% at 65% 30%,color-mix(in srgb,var(--brand) 30%,transparent),transparent 70%);filter:blur(20px)}
```

Mini-visual dæmi (endurnýtanleg mynstur — settu eigin gögn):

```css
/* hringmælir (conic-gradient + mono-tala) */
.ny-gring{position:relative;width:132px;height:132px;border-radius:50%;background:conic-gradient(var(--good) 0 28.4%,rgba(255,255,255,.12) 28.4% 100%);display:flex;align-items:center;justify-content:center;box-shadow:0 0 42px -8px rgba(46,194,126,.5)}
.ny-gring::after{content:"";position:absolute;width:98px;height:98px;border-radius:50%;background:#101012}
.ny-gring span{position:relative;z-index:1;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-weight:700;font-size:21px;color:var(--good)}
/* punkta-grid (t.d. vaktavika/lagerstaða) */
.ny-minigrid{display:grid;grid-template-columns:repeat(7,16px);gap:5px}
.ny-minigrid i{width:16px;height:16px;border-radius:4px;background:rgba(255,255,255,.08)}
.ny-minigrid i.on{background:var(--brand)}
/* gradient-súlur (línur með dofnandi brand-gradient) */
.ny-rows{display:flex;flex-direction:column;gap:10px;width:64%}
.ny-rows i{height:9px;border-radius:5px;background:linear-gradient(90deg,color-mix(in srgb,var(--brand2) 80%,transparent),color-mix(in srgb,var(--brand2) 15%,transparent))}
/* púls-klukka (tveir hringir sem anda út) */
@keyframes nyping{0%{transform:scale(.92);opacity:.9}100%{transform:scale(1.18);opacity:0}}
.ny-clock .ring{position:absolute;inset:0;border-radius:50%;border:1px solid color-mix(in srgb,var(--brand) 50%,transparent);animation:nyping 2.4s var(--ease) infinite}
```

### 5.6 Skref (01/02/03)

```css
.ny-steps{display:grid;grid-template-columns:repeat(3,1fr);gap:18px;max-width:1060px;margin:0 auto}
.ny-step{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid var(--line);border-radius:20px;padding:30px 28px}
.ny-step .n{font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:13px;color:var(--brand2);letter-spacing:.1em}
.ny-step h3{font-size:19px;color:#fff;margin-top:14px}
.ny-step p{font-size:14.5px;color:var(--dim);margin-top:9px;line-height:1.6}
```

### 5.7 Skjámynda-slider

Láréttur `scroll-snap` með 84%-breiðum slides, örvum (faldar á mobile) og
punktum sem fylgja scrolli.

```css
.ny-show{position:relative;max-width:1060px;margin:0 auto}
.ny-show-track{display:flex;gap:20px;overflow-x:auto;scroll-snap-type:x mandatory;padding:6px 8% 10px;scrollbar-width:none}
.ny-show-track::-webkit-scrollbar{display:none}
.ny-slide{flex:0 0 84%;scroll-snap-align:center;margin:0}
.ny-slide img{display:block;width:100%;height:auto;border-radius:14px;border:1px solid rgba(255,255,255,.13);
  box-shadow:0 30px 90px -30px rgba(0,0,0,.85),0 0 46px -16px color-mix(in srgb,var(--brand) 35%,transparent);background:#0a0a0d}
.ny-slide figcaption{display:flex;flex-direction:column;gap:3px;margin-top:14px;text-align:center}
.ny-show-arr{position:absolute;top:38%;z-index:3;width:42px;height:42px;border-radius:50%;cursor:pointer;
  display:flex;align-items:center;justify-content:center;color:var(--ink);
  background:rgba(16,16,18,.75);border:1px solid var(--line);backdrop-filter:blur(10px)}
.ny-show-arr.l{left:10px}.ny-show-arr.r{right:10px}
.ny-show-dots{display:flex;gap:7px;justify-content:center;margin-top:16px}
.ny-show-dots i{width:6px;height:6px;border-radius:50%;background:rgba(255,255,255,.18);transition:background .2s,transform .2s}
.ny-show-dots i.on{background:var(--brand2);transform:scale(1.25)}
```

### 5.8 Ummæli (voices)

Eitt featured-kort (mynd 340px vinstri + tilvitnun) og svo 2-dálka grid.

```css
.ny-voice-main{display:grid;grid-template-columns:340px 1fr;gap:36px;align-items:stretch;max-width:1000px;margin:0 auto 18px;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));border:1px solid var(--line);border-radius:22px;padding:22px;
  box-shadow:inset 0 1px 0 rgba(255,255,255,.08)}
.ny-voice-main img{width:100%;height:100%;min-height:300px;object-fit:cover;border-radius:14px}
.ny-voice-main blockquote{font-size:clamp(17px,1.9vw,22px);font-weight:500;letter-spacing:-.015em;line-height:1.5;color:#fff;margin:0}
.ny-voice-grid{display:grid;grid-template-columns:1fr 1fr;gap:18px;max-width:1000px;margin:0 auto}
.ny-voice{background:linear-gradient(180deg,rgba(255,255,255,.04),rgba(255,255,255,.015));border:1px solid var(--line);border-radius:18px;padding:26px}
.ny-voice blockquote{font-size:15px;line-height:1.6;color:var(--ink);margin:0}
.ny-voice .who{display:flex;gap:12px;align-items:center;margin-top:20px}
.ny-voice .who img{width:44px;height:44px;border-radius:50%;object-fit:cover}
```

### 5.9 Verð — eitt glóandi kort

```css
.ny-price{position:relative;overflow:hidden;max-width:520px;margin:0 auto;text-align:center;
  background:linear-gradient(180deg,rgba(255,255,255,.05),rgba(255,255,255,.02));
  border:1px solid color-mix(in srgb,var(--brand2) 35%,transparent);border-radius:24px;padding:44px 36px 36px;
  box-shadow:0 0 60px -18px var(--glow),inset 0 1px 0 rgba(255,255,255,.09)}
.ny-price-glow{position:absolute;left:50%;top:-130px;width:420px;height:260px;transform:translateX(-50%);
  background:radial-gradient(50% 50% at 50% 50%,color-mix(in srgb,var(--brand) 40%,transparent),transparent 70%);filter:blur(30px);pointer-events:none}
.ny-amt{position:relative;font-family:ui-monospace,'SF Mono',Menlo,monospace;font-size:52px;font-weight:700;color:#fff;letter-spacing:-.02em}
.ny-amt small{font-family:inherit;font-size:14px;font-weight:500;color:var(--dim)}
.ny-price ul{list-style:none;margin:26px 0 30px;padding:0;display:flex;flex-direction:column;gap:12px;text-align:left}
.ny-price li{position:relative;font-size:14.5px;color:var(--ink);padding-left:26px}
.ny-price li::before{content:"";position:absolute;left:0;top:7px;width:7px;height:7px;border-radius:50%;background:var(--brand2);box-shadow:0 0 10px var(--glow)}
.ny-fine{display:block;margin-top:14px;font-size:12.5px;color:var(--dim2)}
```

### 5.10 Loka-CTA + footer með risavörumerki

```css
.ny-cta{padding:120px 24px 90px;text-align:center}
.ny-cta h2{font-size:clamp(28px,3.6vw,44px);color:#fff;max-width:720px;margin:0 auto 34px}
.ny-foot{position:relative;border-top:1px solid var(--line);padding:64px 24px 0;overflow:hidden}
/* aurora-þoka yfir efri brún footersins */
.ny-foot-aurora{position:absolute;left:50%;top:-160px;width:1900px;height:320px;transform:translateX(-50%);pointer-events:none;
  background:
    radial-gradient(34% 70% at 26% 50%,color-mix(in srgb,var(--brand) 28%,transparent),transparent 70%),
    radial-gradient(30% 64% at 55% 40%,color-mix(in srgb,var(--brand2) 14%,transparent),transparent 70%),
    radial-gradient(32% 70% at 76% 50%,color-mix(in srgb,var(--accent) 24%,transparent),transparent 70%);
  filter:blur(42px)}
.ny-foot-grid{position:relative;display:grid;grid-template-columns:1.6fr 1fr 1fr 1fr 1fr;gap:36px;max-width:1060px;margin:0 auto 44px}
.ny-foot-brand p{font-size:13.5px;color:var(--dim2);line-height:1.6;margin-top:14px;max-width:30ch}
.ny-foot-col h4{font-size:14px;font-weight:600;color:#fff;margin:0 0 14px}
.ny-foot-col a{display:block;font-size:13.5px;color:var(--dim);margin-bottom:10px}
.ny-foot-bot{position:relative;display:flex;justify-content:space-between;gap:14px;max-width:1060px;margin:0 auto 8px;padding-top:20px;border-top:1px solid var(--line);font-size:12.5px;color:var(--dim2);flex-wrap:wrap}
/* RISASTÓRA gegnsæja vörumerkið neðst — gradient-klippt texti */
.ny-mark{font-size:clamp(120px,22vw,330px);font-weight:700;letter-spacing:-.02em;line-height:.72;text-align:center;
  background:linear-gradient(180deg,rgba(255,255,255,.16),rgba(255,255,255,.015) 78%);
  -webkit-background-clip:text;background-clip:text;color:transparent;
  transform:translateY(14%);user-select:none;pointer-events:none}
```

```tsx
<footer className="ny-foot">
  <span className="ny-foot-aurora" aria-hidden="true" />
  <div className="ny-foot-grid">
    <div className="ny-foot-brand"><a className="ny-logo" href="/">…</a><p>{t.footBlurb}</p></div>
    {/* 4× .ny-foot-col: Vara / Fyrirtækið / Lagalegt / Fylgdu okkur */}
  </div>
  <div className="ny-foot-bot"><span>© …</span><span>…</span></div>
  <div className="ny-mark" aria-hidden="true">INVENTRA</div>
</footer>
```

---

## 6) FAQ *(VAKTO-síðan hefur ekki FAQ — hér er mynstur í nákvæmlega sama stíl)*

Gler-accordion með sömu korta-formúlu og `.ny-step`:

```tsx
const [openFaq, setOpenFaq] = useState<number | null>(null);

<section className="ny-sec" id="faq">
  <Rise><div className="ny-head"><h2>{t.faqHead}</h2></div></Rise>
  <div className="ny-faq">
    {t.faqs.map((f, i) => (
      <Rise key={i} delay={i * 60}>
        <details className="ny-qa" open={openFaq === i}
          onClick={(e) => { e.preventDefault(); setOpenFaq(openFaq === i ? null : i); }}>
          <summary>{f.q}<span className="chev">⌄</span></summary>
          <p>{f.a}</p>
        </details>
      </Rise>
    ))}
  </div>
</section>
```

```css
.ny-faq{display:flex;flex-direction:column;gap:12px;max-width:720px;margin:0 auto}
.ny-qa{background:linear-gradient(180deg,rgba(255,255,255,.045),rgba(255,255,255,.015));border:1px solid var(--line);border-radius:16px;padding:0 22px}
.ny-qa summary{display:flex;justify-content:space-between;align-items:center;gap:14px;list-style:none;cursor:pointer;font-size:15.5px;font-weight:600;color:#fff;padding:18px 0}
.ny-qa summary::-webkit-details-marker{display:none}
.ny-qa .chev{color:var(--dim2);transition:transform .25s var(--ease)}
.ny-qa[open] .chev{transform:rotate(180deg)}
.ny-qa[open]{border-color:color-mix(in srgb,var(--brand2) 35%,transparent)}
.ny-qa p{font-size:14.5px;color:var(--dim);line-height:1.65;padding:0 0 18px;margin:0;max-width:60ch}
```

---

## 7) Responsive-brotpunktar

```css
@media(max-width:900px){
  .ny-links,.ny-navcta{display:none}
  .ny-burger{display:block;margin-left:auto}
  .ny-nav{gap:12px}
  .ny-cards{grid-template-columns:1fr}
  .ny-card.big,.ny-card.wide{grid-template-columns:1fr}
  .ny-card.big .ny-card-vis{order:0}
  .ny-state-grid{flex-direction:column-reverse;gap:36px;text-align:center}
  .ny-steps{grid-template-columns:1fr}
  .ny-sec{padding:80px 20px}
  .ny-voice-main,.ny-voice-grid{grid-template-columns:1fr}
  .ny-foot-grid{grid-template-columns:1fr 1fr}
  .ny-slide{flex-basis:92%}
  .ny-show-arr{display:none}
}
@media(max-width:560px){
  .ny-hero{padding-top:120px}
  .ny-horizon{top:640px}
  .ny-ctas .ny-btn{flex:1;justify-content:center}
}
```

---

## 8) Athugasemdir

- **Prefixið `ny-`** er handahófskennt (kom frá VAKTO `/ny` preview-route) —
  haltu því fyrir 1:1 samræmi við VAKTO-css-ið, eða skiptu út með search-replace.
- **`prefers-reduced-motion`**: hver einasta animation hér á sér
  `@media(prefers-reduced-motion:reduce){…animation:none…}` mótleik — ekki
  sleppa þeim (þær eru í ny.css á sömu línum og reglurnar sjálfar).
- **Seeded random** (mulberry32) í Starfield er skylda í Next.js — `Math.random()`
  myndi gefa hydration-mismatch milli SSR og klients.
- **Skuggamyndir**: hero-skjámyndin og slider-myndirnar eru venjulegar `<img>` —
  settu skjámyndir af INVENTRA í sömu hlutföll (~16:10, ≥1600px breiðar).
- **`color-mix`** þarf Safari 16.2+ / Chrome 111+. Ef eldri stuðningur skiptir
  máli: harðkóðaðu leiddu litina (þeir eru fáir: --brand2, --brand-deep, --glow).
- **VAKTO-frumritið** er í `src/app/ny/ny-client.tsx` + `src/app/ny/ny.css`
  (þar eru líka VAKTO-sértæku mini-visualarnir: skírteinis-kort, spjall-bólur,
  síma-mockup með flip — notaðu þau sem uppskrift ef INVENTRA vill hliðstæður).
