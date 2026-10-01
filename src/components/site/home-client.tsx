"use client";

// Forsíða vakto.is (IS/EN, texti í home-text.ts). Allt efni er alvöru: skjámyndir úr kerfinu (demo-fyrirtækið,
// ljóst og dökkt þema, scripts/shots-forsida.mjs), alvöru ráðningarsamningur úr contract-pdf og
// starfsmannaskírteinið eins og það lítur út í Wallet. Hreyfing: einn rAF-skrunhlustari sem setur
// transform/opacity beint á einingar (engin layout-eiginleikar), IntersectionObserver fyrir birtingu,
// og allt slökkt með prefers-reduced-motion.

import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import HomeChat from "./home-chat";
import SiteNav from "./site-nav";
import { useSiteLang } from "./lang";
import { HOME_TEXT } from "./home-text";
import AhFooter from "./ah-footer";

const useT = () => HOME_TEXT[useSiteLang()];

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
  const t = useT();
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
          <img src={src} alt={t.dragAlt} width={2880} height={1800} loading="lazy" decoding="async" draggable={false} />
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

/* ---------- 1. Hetja: myndband af kerfinu í notkun, glugginn stækkar þegar skrunað er ---------- */

function HeroVideo() {
  const t = useT();
  const frame = useRef<HTMLDivElement>(null);
  const video = useRef<HTMLVideoElement>(null);
  const ref = useScrub((p) => {
    const g = ease(seg(p, 0.08, 0.5));
    if (frame.current) frame.current.style.transform = `scale(${0.86 + g * 0.16})`;
  }, "view");
  useEffect(() => {
    const v = video.current; if (!v) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { v.removeAttribute("autoplay"); v.pause(); v.controls = true; return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) v.play().catch(() => {}); else v.pause(); }, { threshold: 0.25 });
    io.observe(v);
    return () => io.disconnect();
  }, []);
  return (
    <section className="ah-hero2" ref={ref}>
      <div className="ah-hero-head2">
        <h1>{t.h1a}<br /><span>{t.h1b}</span></h1>
        <p className="ah-lede">{t.lede}</p>
        <div className="ah-ctas">
          <a className="ah-btn" href="/nyskraning">{t.try}</a>
          <a className="ah-link" href="#kerfid">{t.see}</a>
        </div>
      </div>
      <div className="ah-hero-frame2" ref={frame}>
        <div className="ah-mac">
          <div className="ah-mac-bar">
            <span className="ah-dots"><i /><i /><i /></span>
            <span className="ah-url" aria-hidden="true">vakto.is</span>
          </div>
          <div className="ah-mac-view">
            <video ref={video} src={`${SHOT}/video/hero.mp4`} poster={`${SHOT}/video/hero.jpg`} autoPlay muted loop playsInline preload="metadata" aria-label={t.videoAlt} width={1920} height={1200} />
          </div>
        </div>
      </div>
      <p className="ah-hero-cap"><b>{t.cap1b}</b>{t.cap1}</p>
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
  const t = useT();
  return (
    <section className="ah-sec" id="kerfid">
      <div className="ah-head">
        <h2>{t.featH}</h2>
      </div>
      <div className="ah-bento">
        <div className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>{t.t1h}</h3><p>{t.t1p}</p></div>
          <PlanDrag />
        </div>
        <div className="ah-tile ah-tall ah-tile-warm">
          <div className="ah-tile-tx"><h3>{t.t2h}</h3><p>{t.t2p}</p></div>
          <div className="ah-tall-ph"><Phone live src={`${SHOT}/light/app-heim.png`} alt={t.t2alt} /></div>
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>{t.t3h}</h3><p>{t.t3p}</p></div>
          <Crop src={`${SHOT}/light/timaskraning.jpg`} alt={t.t3alt} pos="62% 12%" zoom={1.4} ratio="16 / 9" />
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>{t.t4h}</h3><p>{t.t4p}</p></div>
          <Crop src={`${SHOT}/light/launakeyrslur.jpg`} alt={t.t4alt} pos="62% 12%" zoom={1.4} ratio="16 / 9" />
        </div>
        <div className="ah-tile ah-wide">
          <div className="ah-tile-tx"><h3>{t.t5h}</h3><p>{t.t5p}</p></div>
          <Crop src={`${SHOT}/light/kiosk.jpg`} alt={t.t5alt} pos="50% 40%" zoom={1.12} ratio="16 / 8" />
        </div>
        <div className="ah-tile">
          <div className="ah-tile-tx"><h3>{t.t6h}</h3><p>{t.t6p}</p></div>
          <div className="ah-peek"><Phone src={`${SHOT}/light/app-spjall.png`} alt={t.t6alt} /></div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 3. Dökkt (samanburður ljóst / dökkt) ---------- */

function DarkCompare() {
  const t = useT();
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
        <h2>{t.darkH}</h2>
        <p className="ah-lede">{t.darkP}</p>
      </div>
      <div>
        <div
          className="ah-compare" ref={box}
          onPointerDown={(e) => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); move(e.clientX); }}
          onPointerMove={(e) => { if (e.currentTarget.hasPointerCapture(e.pointerId)) move(e.clientX); }}
          role="slider" aria-label={t.cmpAria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={50} tabIndex={0}
          onKeyDown={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") { touched.current = true; paint(pos.current + (e.key === "ArrowLeft" ? -5 : 5)); } }}
        >
          <MacFrame src={`${SHOT}/light/vaktaplan.jpg`} alt={t.cmpLight} url="vakto.is/vaktaplan" />
          <div className="ah-compare-dark" ref={layer} style={{ clipPath: "inset(0 0 0 50%)" }}>
            <MacFrame src={`${SHOT}/dark/vaktaplan.jpg`} alt={t.cmpDark} url="vakto.is/vaktaplan" />
          </div>
          <div className="ah-handle" ref={handle} style={{ left: "50%" }} aria-hidden="true"><span><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m9 7-5 5 5 5" /><path d="m15 7 5 5-5 5" /></svg></span></div>
        </div>
      </div>
      <div className="ah-dark-row">
        <div><Phone dark live src={`${SHOT}/dark/app-heim.png`} alt={t.appAlt} /></div>
        <div className="ah-dark-copy">
          <h3>{t.appH}</h3>
          <p>{t.appP}</p>
          <ul className="ah-ticks">
            {t.appTicks.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
        <div><Phone dark src={`${SHOT}/dark/app-frettir.png`} alt={t.feedAlt} className="ah-phone-lo" /></div>
      </div>
    </section>
  );
}

/* ---------- 3b. Kynntu þér VAKTO (glærur sem fletta sjálfkrafa) ---------- */

type Slide = { t: string; d: string; v: ReactNode };
function slidesFor(t: ReturnType<typeof useT>): Slide[] {
  const [a, b, c, d] = t.slides;
  return [
    // eslint-disable-next-line @next/next/no-img-element
    { ...a, v: <div className="ah-sl-shot"><img src={`${SHOT}/light/ai.jpg`} alt={a.alt} width={1209} height={1656} loading="lazy" decoding="async" draggable={false} /></div> },
    { ...b, v: <div className="ah-sl-phones"><Phone src={`${SHOT}/light/app-vaktir.png`} alt={b.alt} /><Phone src={`${SHOT}/light/app-spjall.png`} alt={b.alt2 ?? ""} className="ah-sl-lo" /></div> },
    { ...c, v: <div className="ah-sl-phones"><Phone src={`${SHOT}/light/app-frettir.png`} alt={c.alt} /></div> },
    // eslint-disable-next-line @next/next/no-img-element
    { ...d, v: <div className="ah-sl-paper"><img src={`${SHOT}/skjol/launasedill.jpg`} alt={d.alt} width={1800} height={2545} loading="lazy" decoding="async" draggable={false} /></div> },
  ];
}
const SLIDE_MS = 6500;

function Showcase() {
  const t = useT();
  const SLIDES = slidesFor(t);
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
      setIdx(clamp(Math.round(el.scrollLeft / step), 0, t.slides.length - 1));
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
    <section className="ah-sec ah-show" id="kynning" aria-roledescription={t.showRole} aria-label={t.showH}>
      <div className="ah-head ah-head-l"><h2>{t.showH}</h2></div>
      <div className="ah-track" ref={track} onPointerDown={() => setPlaying(false)}>
        {SLIDES.map((s, i) => (
          <article className={`ah-slide${i === idx ? " on" : ""}`} key={s.t} aria-roledescription={t.slideRole} aria-label={`${i + 1} ${t.of} ${SLIDES.length}`}>
            <div className="ah-slide-tx"><h3>{s.t}</h3><p>{s.d}</p></div>
            <div className="ah-slide-v">{s.v}</div>
          </article>
        ))}
      </div>
      <div className="ah-ctrl">
        <div className="ah-dotbar">
          {SLIDES.map((s, i) => (
            <button key={s.t} className={`ah-dot${i === idx ? " on" : ""}`} onClick={() => { setPlaying(false); go(i); }} aria-label={`${t.slideN} ${i + 1}: ${s.t}`} aria-current={i === idx}>
              {i === idx && <i key={idx} style={{ animationDuration: `${SLIDE_MS}ms`, animationPlayState: run ? "running" : "paused" }} onAnimationEnd={() => go(idx + 1)} />}
            </button>
          ))}
        </div>
        <button className="ah-play" onClick={() => setPlaying((p) => !p)} aria-label={playing ? t.pause : t.play}>
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
  const t = useT();
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
          <h2>{t.conH}</h2>
          <p className="ah-lede">{t.conP}</p>
          <ul className="ah-ticks">
            {t.conTicks.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </div>
        <div className="ah-papers">
          <div className="ah-paper ah-paper-back" ref={back}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-2.jpg`} alt="" width={1800} height={2545} loading="lazy" decoding="async" />
          </div>
          <div className="ah-paper" ref={front}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`${SHOT}/skjol/samningur-1.jpg`} alt={t.conAlt} width={1800} height={2545} loading="lazy" decoding="async" />
            <div className="ah-stamp" ref={stamp}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.2 4.2L19 7" /></svg>{t.stamp}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

/* ---------- 5. Starfsmannaskírteini í Wallet ---------- */

function WalletCard() {
  const t = useT();
  const [qr, setQr] = useState("");
  useEffect(() => {
    import("qrcode").then((Q) => Q.toString("VAKTO-4132-KK", { type: "svg", margin: 0, color: { dark: "#16161a", light: "#ffffff" } })).then(setQr).catch(() => {});
  }, []);
  return (
    <div className="ah-pass">
      <div className="ah-pass-top"><Logo /><span className="ah-pass-co">KAFFI KRÓNAN EHF.<small>kt. 550101-2210</small></span></div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="ah-pass-av" src={`${SHOT}/skjol/passmynd.jpg`} alt="" width={360} height={360} loading="lazy" decoding="async" />
      <div className="ah-pass-lbl">{t.passLbl}</div>
      <div className="ah-pass-name">Dalya R.</div>
      <div className="ah-pass-grid">
        <div><span>{t.passRole}</span><b>{t.passRoleV}</b></div>
        <div><span>{t.passKt}</span><b>040399-3309</b></div>
        <div><span>{t.passNo}</span><b>#4132</b></div>
      </div>
      <div className="ah-pass-qr" dangerouslySetInnerHTML={{ __html: qr }} />
      <div className="ah-pass-foot">{t.passFoot}</div>
    </div>
  );
}

function Wallet() {
  const t = useT();
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
          <h2>{t.walH}</h2>
          <p className="ah-lede">{t.walP}</p>
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
  const t = useT();
  return (
    <section className="ah-sec ah-price" id="verd">
      <div className="ah-head">
        <h2>{t.priceH}</h2>
      </div>
      <div className="ah-price-card">
        <div className="ah-amt">{t.amt}<small>{t.per}</small></div>
        <p>{t.price1}<br />{t.price2}</p>
        <p className="ah-fine">{t.fine}</p>
        <a className="ah-btn ah-btn-lg" href="/nyskraning">{t.try}</a>
      </div>
    </section>
  );
}

export default function AppleHome() {
  const lang = useSiteLang();
  const t = HOME_TEXT[lang];
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
      <a className="ah-skip" href="#efni">{t.skip}</a>
      <div ref={top} className="ah-top-sentinel" aria-hidden="true" />
      <Glow />
      <SiteNav home scrolled={scrolled} dark={overDark} />
      <main id="efni">
        <HeroVideo />
        <Features />
        <Showcase />
        <DarkCompare />
        <Contract />
        <Wallet />
        <Pricing />
      </main>
      <AhFooter />
      <HomeChat key={lang} lang={lang} skin="ah" />
    </div>
  );
}
