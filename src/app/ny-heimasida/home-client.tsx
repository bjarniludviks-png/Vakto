"use client";

// Apple-leg forsíða VAKTO (tilraun). Allt efni er alvöru: skjámyndir úr kerfinu (demo-fyrirtækið,
// ljóst og dökkt þema, scripts/shots-forsida.mjs), alvöru ráðningarsamningur úr contract-pdf og
// starfsmannaskírteinið eins og það lítur út í Wallet. Hreyfing: einn rAF-skrunhlustari sem setur
// transform/opacity beint á einingar (engin layout-eiginleikar), IntersectionObserver fyrir birtingu,
// og allt slökkt með prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";

const SHOT = "/showcase/forsida";
const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (p: number, a: number, b: number) => clamp((p - a) / (b - a));
const ease = (t: number) => 1 - Math.pow(1 - t, 3);

/** Framvinda (0→1). "sticky": hve langt er skrunað í gegnum háan kafla með sticky-innihaldi.
 *  "view": kaflinn kemur inn neðst (0), er á miðjum skjá (~0,5) og fer út efst (1). */
function useScrub(cb: (p: number, el: HTMLElement) => void, mode: "sticky" | "view" = "sticky") {
  const ref = useRef<HTMLDivElement | null>(null);
  const cbRef = useRef(cb);
  useEffect(() => { cbRef.current = cb; });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return; // kyrrstætt upphafsútlit
    let raf = 0;
    const run = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const p = mode === "view" ? clamp((vh - r.top) / (vh + r.height)) : total > 0 ? clamp(-r.top / total) : clamp(1 - r.top / vh);
      cbRef.current(p, el);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", on, { passive: true });
    window.addEventListener("resize", on);
    return () => { window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [mode]);
  return ref;
}

/** Birtist mjúklega þegar einingin kemur inn á skjáinn (einu sinni). */
function Reveal({ children, delay = 0, className = "", as: Tag = "div" }: { children: ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" }) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -12% 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    <Tag ref={ref as any} className={`ah-rv${on ? " on" : ""} ${className}`} style={{ transitionDelay: `${delay}ms` } as CSSProperties}>
      {children}
    </Tag>
  );
}

function Logo() {
  return (
    <span className="ah-logo">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.3" /><rect x="10" y="8" width="4" height="12" rx="1.3" /><rect x="17" y="4" width="4" height="16" rx="1.3" /></svg>
      VAKTO
    </span>
  );
}

/** Appelsínugulur bjarmi í bakgrunni: daufur efst, fyllir síðuna og færist til þegar skrunað er. */
function Glow() {
  const a = useRef<HTMLDivElement>(null), b = useRef<HTMLDivElement>(null), c = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const run = () => {
      raf = 0;
      const max = document.documentElement.scrollHeight - window.innerHeight;
      const p = max > 0 ? window.scrollY / max : 0;
      const w = Math.sin(p * Math.PI * 3);
      if (a.current) { a.current.style.transform = `translate3d(${-30 * p + 8 * w}vw, ${10 * p}vh, 0) scale(${0.7 + p * 1.1})`; a.current.style.opacity = String(0.35 + p * 0.45); }
      if (b.current) { b.current.style.transform = `translate3d(${20 * p - 10 * w}vw, ${-15 * p}vh, 0) scale(${0.4 + p * 1.4})`; b.current.style.opacity = String(clamp(p * 1.6) * 0.7); }
      if (c.current) { c.current.style.transform = `translate3d(${12 * w}vw, 0, 0) scale(${0.6 + seg(p, 0.6, 1) * 1.2})`; c.current.style.opacity = String(seg(p, 0.55, 1) * 0.85); }
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    run();
    window.addEventListener("scroll", on, { passive: true });
    return () => { window.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  return (
    <div className="ah-glow" aria-hidden="true">
      <div ref={a} className="ah-blob ah-b1" />
      <div ref={b} className="ah-blob ah-b2" />
      <div ref={c} className="ah-blob ah-b3" />
    </div>
  );
}

function MacFrame({ src, alt, url, children, imgRef }: { src: string; alt: string; url: string; children?: ReactNode; imgRef?: React.Ref<HTMLImageElement> }) {
  return (
    <div className="ah-mac">
      <div className="ah-mac-bar">
        <span className="ah-dots"><i /><i /><i /></span>
        <span className="ah-url">{url}</span>
      </div>
      <div className="ah-mac-view">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt={alt} decoding="async" />
        {children}
      </div>
    </div>
  );
}

function Phone({ src, alt, className = "", dark = false }: { src: string; alt: string; className?: string; dark?: boolean }) {
  return (
    <div className={`ah-phone${dark ? " ah-phone-dk" : ""} ${className}`}>
      <div className="ah-phone-in">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} loading="lazy" decoding="async" />
      </div>
      <span className="ah-island" aria-hidden="true" />
    </div>
  );
}

/* ---------- 1. Hetja + aðdráttur inn í mælaborðið ---------- */

function HeroZoom() {
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const cap1 = useRef<HTMLDivElement>(null), cap2 = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), head = useRef<HTMLDivElement>(null);
  const ref = useScrub((p) => {
    const a = ease(seg(p, 0, 0.3)), z = ease(seg(p, 0.32, 0.72));
    if (head.current) { head.current.style.opacity = String(1 - seg(p, 0.05, 0.25)); head.current.style.transform = `translate3d(0, ${-60 * seg(p, 0, 0.3)}px, 0)`; }
    if (frame.current) frame.current.style.transform = `translate3d(0, ${(1 - a) * 34}vh, 0) scale(${0.82 + a * 0.18})`;
    if (img.current) img.current.style.transform = `scale(${1 + z * 2.1})`;
    if (ring.current) ring.current.style.opacity = String(seg(p, 0.6, 0.72) * (1 - seg(p, 0.94, 1)));
    if (cap1.current) { const o = seg(p, 0.5, 0.6) * (1 - seg(p, 0.76, 0.82)); cap1.current.style.opacity = String(o); cap1.current.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`; }
    if (cap2.current) { const o = seg(p, 0.8, 0.88); cap2.current.style.opacity = String(o); cap2.current.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`; }
  });
  return (
    <section className="ah-hero" ref={ref}>
      <div className="ah-sticky">
        <div className="ah-hero-head" ref={head}>
          <p className="ah-eyebrow">VAKTO</p>
          <h1>Vaktin, launin og yfirsýnin.<br /><span>Á einum stað.</span></h1>
          <p className="ah-lede">Vaktaplan, stimpilklukka, launakeyrsla og ráðningarsamningar — og launakostnaður sem hlutfall af veltu, í rauntíma.</p>
          <div className="ah-ctas">
            <a className="ah-btn" href="/nyskraning">Prófa frítt í 14 daga</a>
            <a className="ah-link" href="#kerfid">Sjá kerfið <span aria-hidden="true">↓</span></a>
          </div>
        </div>
        <div className="ah-hero-frame" ref={frame}>
          <MacFrame src={`${SHOT}/light/maelabord.jpg`} alt="Mælaborð VAKTO: laun sem hlutfall af veltu, unnir tímar og frávik" url="vakto.is/maelabord" imgRef={img}>
            <div className="ah-ring-hl" ref={ring} aria-hidden="true" />
          </MacFrame>
          <div className="ah-zcap" ref={cap1}><b>Laun sem % af veltu.</b> Ein tala sem segir hvort vaktin borgar sig.</div>
          <div className="ah-zcap" ref={cap2}><b>Grænt, gult eða rautt.</b> Reiknað úr stimplunum jafnóðum — ekki í lok mánaðar.</div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 2. Eiginleikar (bento með alvöru skjámyndum) ---------- */

function Crop({ src, pos, ratio = "16 / 10", zoom = 1.6, alt }: { src: string; pos: string; ratio?: string; zoom?: number; alt: string }) {
  return (
    <div className="ah-crop" style={{ aspectRatio: ratio } as CSSProperties}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} loading="lazy" decoding="async" style={{ objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos } as CSSProperties} />
    </div>
  );
}

function Features() {
  return (
    <section className="ah-sec" id="kerfid">
      <Reveal className="ah-head">
        <p className="ah-eyebrow">Kerfið</p>
        <h2>Allt sem vaktin þarf.<br /><span>Ekkert sem hún þarf ekki.</span></h2>
      </Reveal>
      <div className="ah-bento">
        <Reveal className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>Vaktaplan á korteri.</h3><p>Dragðu vaktir til, afritaðu síðustu viku eða biddu gervigreindina um plan sem passar veltuspánni. Launakostnaðurinn reiknast á meðan.</p></div>
          <Crop src={`${SHOT}/light/vaktaplan.jpg`} alt="Vaktaplan vikunnar" pos="62% 38%" zoom={1.45} ratio="16 / 8" />
        </Reveal>
        <Reveal className="ah-tile ah-tall" delay={80}>
          <div className="ah-tile-tx"><h3>Stimplað í símanum.</h3><p>Eða á spjaldtölvu við innganginn. Staðsetning staðfest ef þú vilt.</p></div>
          <Phone src={`${SHOT}/light/phone-mitt.png`} alt="Mitt svæði í appinu: stimpla mig inn" />
        </Reveal>
        <Reveal className="ah-tile">
          <div className="ah-tile-tx"><h3>Frávik með krónutölu.</h3><p>Hver mætti seint, hver fór fyrr — og hvað það kostaði.</p></div>
          <Crop src={`${SHOT}/light/timaskraning.jpg`} alt="Tímaskráning með frávikum" pos="66% 36%" zoom={1.55} />
        </Reveal>
        <Reveal className="ah-tile" delay={80}>
          <div className="ah-tile-tx"><h3>Laun eftir kjarasamningi.</h3><p>Álag, yfirvinna og uppbót reiknuð — beint í Payday eða DK.</p></div>
          <Crop src={`${SHOT}/light/launakeyrslur.jpg`} alt="Launakeyrsla mánaðarins" pos="52% 32%" zoom={1.55} />
        </Reveal>
        <Reveal className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>Innsýn sem skiptir máli.</h3><p>Velta, launakostnaður og laun % mánuð fyrir mánuð. Engar skýrslur til að setja saman — þær eru þegar til.</p></div>
          <Crop src={`${SHOT}/light/innsyn.jpg`} alt="Innsýn: velta og launakostnaður" pos="62% 60%" zoom={1.35} ratio="16 / 8" />
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 3. Dökkt (samanburður ljóst / dökkt) ---------- */

function DarkCompare() {
  const box = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState(50);
  const touched = useRef(false);
  const ref = useScrub((p) => { if (!touched.current) setPos(Math.round(100 - ease(seg(p, 0.12, 0.4)) * 50)); }, "view");
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    touched.current = true;
    setPos(clamp(((clientX - r.left) / r.width) * 100, 0, 100));
  };
  return (
    <section className="ah-dark" ref={ref}>
      <Reveal className="ah-head">
        <p className="ah-eyebrow">Ljóst og dökkt</p>
        <h2>Fallegt í birtu.<br /><span>Líka á næturvaktinni.</span></h2>
        <p className="ah-lede">Kerfið fylgir stillingu tækisins. Dragðu til að bera saman.</p>
      </Reveal>
      <Reveal>
        <div
          className="ah-compare" ref={box}
          onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture?.(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => { if (e.buttons) move(e.clientX); }}
          role="slider" aria-label="Bera saman ljóst og dökkt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowLeft") { touched.current = true; setPos((v) => clamp(v - 5, 0, 100)); } if (e.key === "ArrowRight") { touched.current = true; setPos((v) => clamp(v + 5, 0, 100)); } }}
        >
          <MacFrame src={`${SHOT}/light/vaktaplan.jpg`} alt="Vaktaplan í ljósu þema" url="vakto.is/vaktaplan" />
          <div className="ah-compare-dark" style={{ clipPath: `inset(0 0 0 ${pos}%)` }}>
            <MacFrame src={`${SHOT}/dark/vaktaplan.jpg`} alt="Vaktaplan í dökku þema" url="vakto.is/vaktaplan" />
          </div>
          <div className="ah-handle" style={{ left: `${pos}%` }} aria-hidden="true"><span>‹ ›</span></div>
        </div>
      </Reveal>
      <div className="ah-dark-row">
        <Reveal><Phone dark src={`${SHOT}/dark/phone-mitt.png`} alt="Appið í dökku þema" /></Reveal>
        <Reveal delay={100} className="ah-dark-copy">
          <h3>Starfsfólkið fær appið.</h3>
          <p>Vaktirnar, stimplun, áætluð laun, orlofsstaða, frí og vaktaskipti — og spjall og fréttaveita fyrir allan hópinn.</p>
          <ul className="ah-ticks">
            <li>iPhone og Android</li><li>Íslenska, enska og víetnamska</li><li>Tilkynning þegar planið breytist</li>
          </ul>
        </Reveal>
        <Reveal delay={200}><Phone dark src={`${SHOT}/dark/phone-frettir.png`} alt="Fréttaveita í appinu" className="ah-phone-lo" /></Reveal>
      </div>
    </section>
  );
}

/* ---------- 4. Ráðningarsamningur (alvöru skjal) ---------- */

function Contract() {
  const back = useRef<HTMLDivElement>(null), front = useRef<HTMLDivElement>(null), stamp = useRef<HTMLDivElement>(null);
  const ref = useScrub((p) => {
    const t = ease(seg(p, 0.1, 0.55));
    if (back.current) back.current.style.transform = `translate3d(${-20 + t * 40}px, ${50 - t * 80}px, 0) rotate(${-8 + t * 4}deg)`;
    if (front.current) front.current.style.transform = `translate3d(0, ${70 - t * 90}px, 0) rotate(${3 - t * 3}deg)`;
    if (stamp.current) { const o = ease(seg(p, 0.42, 0.52)); stamp.current.style.opacity = String(o); stamp.current.style.transform = `scale(${1.3 - o * 0.3}) rotate(-6deg)`; }
  }, "view");
  return (
    <section className="ah-sec ah-contract" ref={ref}>
      <div className="ah-split">
        <Reveal className="ah-split-tx">
          <p className="ah-eyebrow">Ráðningarsamningar</p>
          <h2>Samningur á mínútu.<br /><span>Undirritaður á annarri.</span></h2>
          <p className="ah-lede">VAKTO fyllir út ráðningarsamning úr gögnum starfsmannsins, eftir formi Vinnumálastofnunar. Báðir skrifa undir í símanum og fá undirritað eintak í pósti.</p>
          <ul className="ah-ticks">
            <li>Fylgir formi Vinnumálastofnunar — íslenska og enska</li>
            <li>Undirritun með kóða í pósti eða rafrænum skilríkjum</li>
            <li>Fingrafar skjals og undirritunarskrá fylgja</li>
            <li>Launaseðlar og tímaskrár í sama stíl</li>
          </ul>
        </Reveal>
        <div className="ah-papers" aria-label="Ráðningarsamningur úr VAKTO">
          <div className="ah-paper ah-paper-back" ref={back}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-2.jpg`} alt="" loading="lazy" decoding="async" />
          </div>
          <div className="ah-paper" ref={front}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-1.jpg`} alt="Fyrsta síða ráðningarsamnings: Kaffi Krónan ræður Ha Vu til starfa" loading="lazy" decoding="async" />
            <div className="ah-stamp" ref={stamp}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>Undirritað rafrænt</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Starfsmannaskírteini í Wallet ---------- */

function WalletCard() {
  const [qr, setQr] = useState("");
  useEffect(() => {
    import("qrcode").then((Q) => Q.toString("VAKTO-4132-KK", { type: "svg", margin: 0, color: { dark: "#16161a", light: "#ffffff" } })).then(setQr).catch(() => {});
  }, []);
  return (
    <div className="ah-pass">
      <div className="ah-pass-sheen" aria-hidden="true" />
      <div className="ah-pass-top"><Logo /><span>KAFFI KRÓNAN</span></div>
      <div className="ah-pass-av">DA</div>
      <div className="ah-pass-lbl">STARFSMAÐUR</div>
      <div className="ah-pass-name">Dalya R.</div>
      <div className="ah-pass-grid">
        <div><span>STAÐA</span><b>Þjónn</b></div>
        <div><span>DEILD</span><b>Salur</b></div>
        <div><span>NR.</span><b>#4132</b></div>
      </div>
      <div className="ah-pass-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="ah-pass-foot">VAKTO-4132-KK · skannaðu á stimpilklukku</div>
    </div>
  );
}

function Wallet() {
  const card = useRef<HTMLDivElement>(null);
  const ref = useScrub((p) => {
    const t = ease(seg(p, 0.1, 0.48));
    if (card.current) card.current.style.transform = `perspective(1400px) rotateY(${(1 - t) * -32}deg) rotateX(${(1 - t) * 14}deg) translate3d(0, ${(1 - t) * 60}px, 0)`;
  }, "view");
  return (
    <section className="ah-sec ah-wallet" ref={ref}>
      <div className="ah-split ah-split-rev">
        <div className="ah-pass-wrap"><div ref={card}><WalletCard /></div></div>
        <Reveal className="ah-split-tx">
          <p className="ah-eyebrow">Starfsmannaskírteini</p>
          <h2>Skírteinið er í símanum.<br /><span>Í Apple og Google Wallet.</span></h2>
          <p className="ah-lede">Hver starfsmaður fær skírteini með mynd, stöðu og QR-kóða. Kóðinn stimplar inn á spjaldtölvunni við innganginn — enginn PIN-kóði til að gleyma.</p>
          <div className="ah-badges" aria-hidden="true">
            <span className="ah-badge"><svg viewBox="0 0 24 24"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.2c.9-1.3 1.2-2.5 1.2-2.6 0 0-2.3-.9-2.2-3.7zM14.2 5.8c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z" /></svg>Apple Wallet</span>
            <span className="ah-badge ah-badge-g">Google Wallet</span>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

/* ---------- 6. Verð ---------- */

function Pricing() {
  return (
    <section className="ah-sec ah-price" id="verd">
      <Reveal className="ah-head">
        <p className="ah-eyebrow">Verð</p>
        <h2>Eitt verð. Allt innifalið.</h2>
      </Reveal>
      <Reveal className="ah-price-card">
        <div className="ah-amt">9.990 kr<small>/mán</small></div>
        <p>5 virkir starfsmenn innifaldir · 1.490 kr á hvern virkan umfram</p>
        <p className="ah-fine">Án VSK. Þú borgar aðeins fyrir þá sem unnu í mánuðinum. 15% afsláttur ef greitt er árlega. 14 daga frí prufa, engin binding.</p>
        <a className="ah-btn ah-btn-lg" href="/nyskraning">Prófa frítt í 14 daga</a>
      </Reveal>
    </section>
  );
}

export default function AppleHome() {
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(false);
  useEffect(() => {
    const dark = document.querySelector(".ah-dark");
    if (!dark) return;
    const io = new IntersectionObserver(([e]) => setOverDark(e.isIntersecting), { rootMargin: "0px 0px -92% 0px" });
    io.observe(dark);
    return () => io.disconnect();
  }, []);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
    return () => window.removeEventListener("scroll", on);
  }, []);
  return (
    <div className="ah">
      <Glow />
      <nav className={`ah-nav${scrolled ? " sc" : ""}${overDark ? " dk" : ""}`}>
        <a href="/ny-heimasida" aria-label="VAKTO"><Logo /></a>
        <div className="ah-nav-links">
          <a href="#kerfid">Kerfið</a><a href="#samningar">Samningar</a><a href="#verd">Verð</a>
        </div>
        <div className="ah-nav-cta">
          <a href="/login" className="ah-nav-in">Innskráning</a>
          <a href="/nyskraning" className="ah-btn ah-btn-sm">Prófa frítt</a>
        </div>
      </nav>
      <main>
        <HeroZoom />
        <Features />
        <DarkCompare />
        <div id="samningar" />
        <Contract />
        <Wallet />
        <Pricing />
      </main>
      <footer className="ah-foot">
        <Logo />
        <div><a href="/skilmalar">Skilmálar</a><a href="/personuvernd">Persónuvernd</a><a href="/vafrakokur">Vafrakökur</a></div>
        <span>© 2026 VAKTO</span>
      </footer>
    </div>
  );
}
