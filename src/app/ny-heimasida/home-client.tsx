"use client";

// Apple-leg forsíða VAKTO (tilraun). Allt efni er alvöru: skjámyndir úr kerfinu (demo-fyrirtækið,
// ljóst og dökkt þema, scripts/shots-forsida.mjs), alvöru ráðningarsamningur úr contract-pdf og
// starfsmannaskírteinið eins og það lítur út í Wallet. Hreyfing: einn rAF-skrunhlustari sem setur
// transform/opacity beint á einingar (engin layout-eiginleikar), IntersectionObserver fyrir birtingu,
// og allt slökkt með prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import HomeChat from "../ny/home-chat";
import AhFooter from "./ah-footer";

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
    let raf = 0, live = false;
    const run = () => {
      raf = 0;
      const r = el.getBoundingClientRect();
      const vh = window.innerHeight;
      const total = r.height - vh;
      const p = mode === "view" ? clamp((vh - r.top) / (vh + r.height)) : total > 0 ? clamp(-r.top / total) : clamp(1 - r.top / vh);
      cbRef.current(p, el);
    };
    const on = () => { if (!raf) raf = requestAnimationFrame(run); };
    // Skrunhlustari aðeins virkur á meðan kaflinn er á skjánum; rAF-samræmt; skrifar transform/opacity beint (engin React-state).
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !live) { live = true; window.addEventListener("scroll", on, { passive: true }); window.addEventListener("resize", on); on(); }
      else if (!e.isIntersecting && live) { live = false; window.removeEventListener("scroll", on); window.removeEventListener("resize", on); run(); }
    });
    io.observe(el);
    run();
    return () => { io.disconnect(); window.removeEventListener("scroll", on); window.removeEventListener("resize", on); cancelAnimationFrame(raf); };
  }, [mode]);
  return ref;
}

function Logo() {
  return (
    <span className="ah-logo" translate="no">
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
      if (a.current) { a.current.style.transform = `translate3d(${-30 * p + 8 * w}vw, ${10 * p}vh, 0) scale(${0.7 + p * 1.1})`; a.current.style.opacity = String(0.35 + p * 0.3); }
      if (b.current) { b.current.style.transform = `translate3d(${20 * p - 10 * w}vw, ${-15 * p}vh, 0) scale(${0.4 + p * 1.4})`; b.current.style.opacity = String(clamp(p * 1.6) * 0.7); }
      if (c.current) { c.current.style.transform = `translate3d(${12 * w}vw, 0, 0) scale(${0.6 + seg(p, 0.6, 1) * 1.2})`; c.current.style.opacity = String(seg(p, 0.55, 1) * 0.6); }
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

export function MacFrame({ src, alt, url, children, imgRef, priority = false }: { src: string; alt: string; url: string; children?: ReactNode; imgRef?: React.Ref<HTMLImageElement>; priority?: boolean }) {
  return (
    <div className="ah-mac">
      <div className="ah-mac-bar">
        <span className="ah-dots"><i /><i /><i /></span>
        <span className="ah-url" aria-hidden="true">{url}</span>
      </div>
      <div className="ah-mac-view">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img ref={imgRef} src={src} alt={alt} width={2880} height={1800} draggable={false} decoding="async" loading={priority ? "eager" : "lazy"} fetchPriority={priority ? "high" : "auto"} />
        {children}
      </div>
    </div>
  );
}

/** Teljari ofan á símamyndinni (alvöru app, opin stimplun): heldur áfram að tikka eins og í appinu. */
function LiveClock() {
  const el = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const start = Date.now() - (4 * 3600 + 36 * 60 + 6) * 1000;
    const tick = () => {
      const s = Math.floor((Date.now() - start) / 1000);
      if (el.current) el.current.textContent = `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
    };
    tick();
    const id = window.setInterval(tick, 1000);
    return () => window.clearInterval(id);
  }, []);
  return <span className="ah-live" aria-hidden="true"><span ref={el}>4:36:06</span></span>;
}

export function Phone({ src, alt, className = "", dark = false, live = false }: { src: string; alt: string; className?: string; dark?: boolean; live?: boolean }) {
  return (
    <div className={`ah-phone${dark ? " ah-phone-dk" : ""} ${className}`}>
      <div className="ah-phone-in">
        <div className="ah-scr">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} width={1170} height={2532} loading="lazy" decoding="async" draggable={false} />
          {live && <LiveClock />}
        </div>
      </div>
      <span className="ah-island" aria-hidden="true" />
    </div>
  );
}

/** Vaktaplanið í Mac-glugga: músin tekur kvöldvakt Dalyu á fimmtudegi og dregur hana á Jón.
 *  Vaktin sem dregin er og tóma reiturinn eru klipptir úr sömu skjámynd (ekkert teiknað upp á nýtt). */
function PlanDrag() {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = box.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => el.classList.toggle("run", e.isIntersecting), { threshold: 0.35 });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const src = `${SHOT}/light/vaktaplan.jpg`;
  return (
    <div className="ah-mac ah-mac-tile" ref={box}>
      <div className="ah-mac-bar">
        <span className="ah-dots"><i /><i /><i /></span>
        <span className="ah-url" aria-hidden="true">vakto.is/vaktaplan</span>
      </div>
      <div className="ah-mac-view">
        <div className="ah-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt="Vaktaplan vikunnar: vakt dregin á milli starfsmanna" width={2880} height={1800} loading="lazy" decoding="async" draggable={false} />
          <div className="ah-dg-hole" style={{ backgroundImage: `url(${src})` }} aria-hidden="true" />
          <div className="ah-dg" aria-hidden="true">
            <div className="ah-dg-chip" style={{ backgroundImage: `url(${src})` }} />
            <svg className="ah-cursor" viewBox="0 0 24 24"><path d="M5 2.5v17.2l4.3-4.1 2.8 6.5 3-1.3-2.8-6.4h6.1z" /></svg>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ---------- 1. Hetja + aðdráttur inn í mælaborðið ---------- */

function HeroZoom() {
  const frame = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const cap1 = useRef<HTMLDivElement>(null), cap2 = useRef<HTMLDivElement>(null), ring = useRef<HTMLDivElement>(null), head = useRef<HTMLDivElement>(null);
  // Upphafsfærsla gluggans: rétt fyrir neðan hnappana, óháð skjástærð (mælt einu sinni per skjástærð).
  const shift = useRef({ key: "", px: 0 });
  const startShift = () => {
    const key = `${window.innerWidth}x${window.innerHeight}`;
    if (shift.current.key !== key && head.current && frame.current) {
      const headBottom = head.current.offsetTop + head.current.offsetHeight;
      const f = frame.current;
      shift.current = { key, px: Math.max(0, headBottom + 44 - (f.offsetTop + f.offsetHeight * 0.09)) };
    }
    return shift.current.px;
  };
  const ref = useScrub((p) => {
    const offset = startShift(); // útlitslestur fyrst, öll skrif á eftir (ekkert þvingað endurútlit)
    const a = ease(seg(p, 0, 0.3)), z = ease(seg(p, 0.32, 0.72));
    if (head.current) { head.current.style.opacity = String(1 - seg(p, 0.05, 0.25)); head.current.style.transform = `translate3d(0, ${-60 * seg(p, 0, 0.3)}px, 0)`; }
    if (frame.current) frame.current.style.transform = `translate3d(0, ${(1 - a) * offset}px, 0) scale(${0.82 + a * 0.18})`;
    if (img.current) img.current.style.transform = `scale(${1 + z * 2.1})`;
    if (ring.current) ring.current.style.opacity = String(seg(p, 0.6, 0.72) * (1 - seg(p, 0.94, 1)));
    if (cap1.current) { const o = seg(p, 0.5, 0.6) * (1 - seg(p, 0.76, 0.82)); cap1.current.style.opacity = String(o); cap1.current.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`; }
    if (cap2.current) { const o = seg(p, 0.8, 0.88); cap2.current.style.opacity = String(o); cap2.current.style.transform = `translate3d(0, ${(1 - o) * 18}px, 0)`; }
  });
  return (
    <section className="ah-hero" ref={ref}>
      <div className="ah-sticky">
        <div className="ah-hero-head" ref={head}>
          <h1>Vaktin, launin og yfirsýnin.<br /><span>Á einum stað.</span></h1>
          <p className="ah-lede">Vaktaplan, stimpilklukka, launakeyrsla og ráðningarsamningar. Og launakostnaður sem hlutfall af veltu, í rauntíma.</p>
          <div className="ah-ctas">
            <a className="ah-btn" href="/ny-heimasida/prufa">Prófa frítt</a>
            <a className="ah-link" href="#kerfid">Sjá kerfið</a>
          </div>
        </div>
        <div className="ah-hero-frame" ref={frame}>
          <MacFrame src={`${SHOT}/light/maelabord.jpg`} alt="Mælaborð VAKTO: laun sem hlutfall af veltu, unnir tímar og frávik" url="vakto.is/maelabord" imgRef={img} priority>
            <div className="ah-ring-hl" ref={ring} aria-hidden="true" />
          </MacFrame>
          <div className="ah-zcap" ref={cap1}><b>Laun sem % af veltu.</b> Ein tala sem segir hvort vaktin borgar sig.</div>
          <div className="ah-zcap" ref={cap2}><b>Grænt, gult eða rautt.</b> Reiknað úr stimplunum jafnóðum, ekki í lok mánaðar.</div>
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
      <img src={src} alt={alt} width={2880} height={1800} loading="lazy" decoding="async" style={{ objectPosition: pos, transform: `scale(${zoom})`, transformOrigin: pos } as CSSProperties} />
    </div>
  );
}

function Features() {
  return (
    <section className="ah-sec" id="kerfid">
      <div className="ah-head">
        <h2>Allt sem vaktin þarf.</h2>
      </div>
      <div className="ah-bento">
        <div className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>Vaktaplan á korteri.</h3><p>Dragðu vaktir til, afritaðu síðustu viku eða biddu gervigreindina um plan sem passar veltuspánni. Launakostnaðurinn reiknast á meðan.</p></div>
          <PlanDrag />
        </div>
        <div className="ah-tile ah-tall ah-tile-warm">
          <div className="ah-tile-tx"><h3>Stimplað í símanum.</h3><p>Eða á spjaldtölvu við innganginn. Staðsetning staðfest ef þú vilt.</p></div>
          <div className="ah-tall-ph"><Phone live src={`${SHOT}/light/app-heim.png`} alt="VAKTO-appið: á vakt síðan 05:38, stimpla út" /></div>
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>Frávik með krónutölu.</h3><p>Hver mætti seint, hver fór fyrr og hvað það kostaði.</p></div>
          <Crop src={`${SHOT}/light/timaskraning.jpg`} alt="Tímaskráning með frávikum" pos="62% 12%" zoom={1.4} ratio="16 / 9" />
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>Laun eftir kjarasamningi.</h3><p>Álag, yfirvinna og uppbót reiknuð. Beint í Payday eða DK.</p></div>
          <Crop src={`${SHOT}/light/launakeyrslur.jpg`} alt="Launakeyrsla mánaðarins" pos="62% 12%" zoom={1.4} ratio="16 / 9" />
        </div>
        <div className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>Spjaldtölva við innganginn.</h3><p>Starfsfólk ýtir á nafnið sitt eða skannar skírteinið í símanum. Enginn PIN-kóði að gleyma og enginn stimplar fyrir annan.</p></div>
          <Crop src={`${SHOT}/light/kiosk.jpg`} alt="Stimpilklukkan á spjaldtölvu: allt starfsfólk og hver er á vakt" pos="50% 40%" zoom={1.12} ratio="16 / 8" />
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>Spjall fyrir hópinn.</h3><p>Rásir per deild og stað. Enginn Messenger-hópur með fyrrverandi starfsfólki.</p></div>
          <div className="ah-peek"><Phone src={`${SHOT}/light/app-spjall.png`} alt="Spjallrásir í VAKTO-appinu" /></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 3. Dökkt (samanburður ljóst / dökkt) ---------- */

function DarkCompare() {
  const box = useRef<HTMLDivElement>(null), layer = useRef<HTMLDivElement>(null), handle = useRef<HTMLDivElement>(null);
  const pos = useRef(50);
  const touched = useRef(false);
  const paint = (v: number) => {
    pos.current = clamp(v, 0, 100);
    if (layer.current) layer.current.style.clipPath = `inset(0 0 0 ${pos.current}%)`;
    if (handle.current) handle.current.style.left = `${pos.current}%`;
    box.current?.setAttribute("aria-valuenow", String(Math.round(pos.current)));
  };
  const ref = useScrub((p) => { if (!touched.current) paint(100 - ease(seg(p, 0.12, 0.4)) * 50); }, "view");
  const move = (clientX: number) => {
    const r = box.current?.getBoundingClientRect(); if (!r) return;
    touched.current = true;
    paint(((clientX - r.left) / r.width) * 100);
  };
  return (
    <section className="ah-dark" ref={ref}>
      <div className="ah-head">
        <h2>Fallegt í birtu. Líka á næturvaktinni.</h2>
        <p className="ah-lede">Kerfið fylgir stillingu tækisins. Dragðu til að bera saman.</p>
      </div>
      <div>
        <div
          className="ah-compare" ref={box}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX); }}
          role="slider" aria-label="Bera saman ljóst og dökkt" aria-valuemin={0} aria-valuemax={100} aria-valuenow={50} tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { touched.current = true; paint(pos.current + (e.key === "ArrowLeft" ? -5 : 5)); } }}
        >
          <MacFrame src={`${SHOT}/light/vaktaplan.jpg`} alt="Vaktaplan í ljósu þema" url="vakto.is/vaktaplan" />
          <div className="ah-compare-dark" ref={layer} style={{ clipPath: "inset(0 0 0 50%)" }}>
            <MacFrame src={`${SHOT}/dark/vaktaplan.jpg`} alt="Vaktaplan í dökku þema" url="vakto.is/vaktaplan" />
          </div>
          <div className="ah-handle" ref={handle} style={{ left: "50%" }} aria-hidden="true"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 7-5 5 5 5" /><path d="m15 7 5 5-5 5" /></svg></span></div>
        </div>
      </div>
      <div className="ah-dark-row">
        <div><Phone dark live src={`${SHOT}/dark/app-heim.png`} alt="Appið í dökku þema: á vakt" /></div>
        <div className="ah-dark-copy">
          <h3>Starfsfólkið fær appið.</h3>
          <p>Vaktirnar, stimplun, áætluð laun, orlofsstaða, frí og vaktaskipti. Og spjall og fréttaveita fyrir allan hópinn.</p>
          <ul className="ah-ticks">
            <li>iPhone og Android</li><li>Íslenska, enska og víetnamska</li><li>Tilkynning þegar planið breytist</li>
          </ul>
        </div>
        <div><Phone dark src={`${SHOT}/dark/app-frettir.png`} alt="Fréttaveita í appinu" className="ah-phone-lo" /></div>
      </div>
    </section>
  );
}

/* ---------- 3b. Kynntu þér VAKTO (glærur sem fletta sjálfkrafa) ---------- */

const SLIDES: { t: string; d: string; v: ReactNode }[] = [
  {
    t: "VAKTO AI.",
    d: "Skrifaðu hvað vikan þarf á venjulegri íslensku. VAKTO AI semur drög að vaktaplani sem þú ferð yfir og samþykkir, og les kjarasamninginn fyrir þig með tilvísun í hverja grein.",
    // eslint-disable-next-line @next/next/no-img-element
    v: <div className="ah-sl-shot"><img src={`${SHOT}/light/ai.jpg`} alt="Tillaga VAKTO AI: Moon færður á kvöldvakt á laugardag, launakostnaður óbreyttur 27,4%" width={1209} height={1656} loading="lazy" decoding="async" draggable={false} /></div>,
  },
  {
    t: "Vaktirnar í vasanum.",
    d: "Starfsfólk sér planið sitt, sækir um lausar vaktir og býður vaktir í skiptum. Spjallið er á sama stað.",
    v: <div className="ah-sl-phones"><Phone src={`${SHOT}/light/app-vaktir.png`} alt="Vaktir vikunnar í appinu" /><Phone src={`${SHOT}/light/app-spjall.png`} alt="Spjallrásir í appinu" className="ah-sl-lo" /></div>,
  },
  {
    t: "Fréttaveita fyrir vinnustaðinn.",
    d: "Nýr matseðill, breyttur opnunartími, mynd úr eldhúsinu. Festu það mikilvæga efst svo það týnist ekki.",
    v: <div className="ah-sl-phones"><Phone src={`${SHOT}/light/app-frettir.png`} alt="Fréttaveitan í appinu" /></div>,
  },
  {
    t: "Launaseðill sem stenst.",
    d: "Dagvinna, álag og yfirvinna sundurliðuð. Líka þegar mánuðurinn var 0 tímar og starfsmaðurinn þarf staðfestingu.",
    // eslint-disable-next-line @next/next/no-img-element
    v: <div className="ah-sl-paper"><img src={`${SHOT}/skjol/launasedill.jpg`} alt="Launaseðill úr VAKTO" width={1800} height={2545} loading="lazy" decoding="async" draggable={false} /></div>,
  },
];
const SLIDE_MS = 6500;

function Showcase() {
  const track = useRef<HTMLDivElement>(null);
  const [idx, setIdx] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = track.current; if (!el) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches; // engin sjálfvirk flettun
    const io = new IntersectionObserver(([e]) => { if (reduced) setPlaying(false); setSeen(e.isIntersecting); }, { threshold: 0.4 });
    io.observe(el);
    let raf = 0;
    const on = () => { if (raf) return; raf = requestAnimationFrame(() => {
      raf = 0;
      const first = el.children[0] as HTMLElement | undefined, second = el.children[1] as HTMLElement | undefined;
      const step = first && second ? second.offsetLeft - first.offsetLeft : el.clientWidth;
      setIdx(clamp(Math.round(el.scrollLeft / step), 0, SLIDES.length - 1));
    }); };
    el.addEventListener("scroll", on, { passive: true });
    return () => { io.disconnect(); el.removeEventListener("scroll", on); cancelAnimationFrame(raf); };
  }, []);
  const go = (i: number) => {
    const el = track.current; if (!el) return;
    const n = (i + SLIDES.length) % SLIDES.length;
    const first = el.children[0] as HTMLElement, slide = el.children[n] as HTMLElement;
    el.scrollTo({ left: slide.offsetLeft - first.offsetLeft, behavior: "smooth" });
    setIdx(n);
  };
  const run = playing && seen;
  return (
    <section className="ah-sec ah-show" id="kynning" aria-roledescription="glærusýning" aria-label="Kynntu þér VAKTO">
      <div className="ah-head ah-head-l"><h2>Kynntu þér VAKTO.</h2></div>
      <div className="ah-track" ref={track} onPointerDown={() => setPlaying(false)}>
        {SLIDES.map((s, i) => (
          <article className={`ah-slide${i === idx ? " on" : ""}`} key={s.t} aria-roledescription="glæra" aria-label={`${i + 1} af ${SLIDES.length}`}>
            <div className="ah-slide-tx"><h3>{s.t}</h3><p>{s.d}</p></div>
            <div className="ah-slide-v">{s.v}</div>
          </article>
        ))}
      </div>
      <div className="ah-ctrl">
        <div className="ah-dotbar">
          {SLIDES.map((s, i) => (
            <button key={s.t} className={`ah-dot${i === idx ? " on" : ""}`} onClick={() => { setPlaying(false); go(i); }} aria-label={`Glæra ${i + 1}: ${s.t}`} aria-current={i === idx}>
              {i === idx && <i key={idx} style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: run ? "running" : "paused" }} onAnimationEnd={() => go(idx + 1)} />}
            </button>
          ))}
        </div>
        <button className="ah-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? "Gera hlé" : "Spila"}>
          {playing
            ? <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="6.5" y="5" width="3.6" height="14" rx="1" /><rect x="13.9" y="5" width="3.6" height="14" rx="1" /></svg>
            : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5.5v13l10.5-6.5z" /></svg>}
        </button>
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
    <section className="ah-sec ah-contract" id="samningar" ref={ref}>
      <div className="ah-split">
        <div className="ah-split-tx">
          <h2>Samningur á mínútu, undirritaður á annarri.</h2>
          <p className="ah-lede">VAKTO fyllir út ráðningarsamning úr gögnum starfsmannsins, eftir formi Vinnumálastofnunar. Báðir skrifa undir í símanum og fá undirritað eintak í pósti.</p>
          <ul className="ah-ticks">
            <li>Fylgir formi Vinnumálastofnunar, á íslensku og ensku</li>
            <li>Undirritun með kóða í pósti eða rafrænum skilríkjum</li>
            <li>Fingrafar skjals og undirritunarskrá fylgja</li>
            <li>Launaseðlar og tímaskrár í sama stíl</li>
          </ul>
        </div>
        <div className="ah-papers">
          <div className="ah-paper ah-paper-back" ref={back}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-2.jpg`} alt="" width={1800} height={2545} loading="lazy" decoding="async" />
          </div>
          <div className="ah-paper" ref={front}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-1.jpg`} alt="Fyrsta síða ráðningarsamnings: Kaffi Krónan ræður Ha Vu til starfa" width={1800} height={2545} loading="lazy" decoding="async" />
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
      <div className="ah-pass-top"><Logo /><span className="ah-pass-co">KAFFI KRÓNAN EHF.<small>kt. 550101-2210</small></span></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ah-pass-av" src={`${SHOT}/skjol/passmynd.jpg`} alt="" width={360} height={360} loading="lazy" decoding="async" />
      <div className="ah-pass-lbl">STARFSMAÐUR</div>
      <div className="ah-pass-name">Dalya R.</div>
      <div className="ah-pass-grid">
        <div><span>STAÐA</span><b>Þjónn</b></div>
        <div><span>KENNITALA</span><b>040399-3309</b></div>
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
        <div className="ah-split-tx">
          <h2>Starfsmannaskírteinið er í símanum.</h2>
          <p className="ah-lede">Í Apple og Google Wallet, með mynd, stöðu og QR-kóða. Kóðinn stimplar inn á spjaldtölvunni við innganginn, svo enginn þarf að muna PIN-kóða.</p>
          <div className="ah-badges" aria-hidden="true">
            <span className="ah-badge"><svg viewBox="0 0 24 24"><path d="M16.4 12.6c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.9-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.8-.4 6.9 1.1 9.1.8 1.1 1.7 2.3 2.8 2.3 1.1 0 1.6-.7 3-.7s1.8.7 3 .7 2-1.1 2.7-2.2c.9-1.3 1.2-2.5 1.2-2.6 0 0-2.3-.9-2.2-3.7zM14.2 5.8c.6-.8 1-1.8.9-2.8-.9 0-2 .6-2.6 1.4-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.3z" /></svg>Apple Wallet</span>
            <span className="ah-badge ah-badge-g">Google Wallet</span>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 6. Verð ---------- */

function Pricing() {
  return (
    <section className="ah-sec ah-price" id="verd">
      <div className="ah-head">
        <h2>Eitt verð. Allt innifalið.</h2>
      </div>
      <div className="ah-price-card">
        <div className="ah-amt">9.990 kr<small>/mán</small></div>
        <p>5 virkir starfsmenn innifaldir.<br />1.490 kr á hvern virkan starfsmann umfram.</p>
        <p className="ah-fine">Án VSK. Þú borgar aðeins fyrir þá sem unnu í mánuðinum. 15% afsláttur ef greitt er árlega. 14 daga frí prufa, engin binding.</p>
        <a className="ah-btn ah-btn-lg" href="/ny-heimasida/prufa">Prófa frítt</a>
      </div>
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
  const top = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = top.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting));
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div className="ah">
      <a className="ah-skip" href="#efni">Fara beint í efni</a>
      <div ref={top} className="ah-top-sentinel" aria-hidden="true" />
      <Glow />
      <nav className={`ah-nav${scrolled ? " sc" : ""}${overDark ? " dk" : ""}`}>
        <a href="/ny-heimasida" aria-label="VAKTO"><Logo /></a>
        <div className="ah-nav-links">
          <a href="#kerfid">Kerfið</a><a href="#samningar">Samningar</a><a href="#verd">Verð</a>
        </div>
        <div className="ah-nav-cta">
          <a href="/ny-heimasida/innskraning" className="ah-nav-in">Innskráning</a>
          <a href="/ny-heimasida/prufa" className="ah-btn ah-btn-sm">Prófa frítt</a>
        </div>
      </nav>
      <main id="efni">
        <HeroZoom />
        <Features />
        <Showcase />
        <DarkCompare />
        <Contract />
        <Wallet />
        <Pricing />
      </main>
      <AhFooter />
      <HomeChat lang="is" skin="ah" />
    </div>
  );
}
