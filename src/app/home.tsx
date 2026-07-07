"use client";

import { useEffect, useRef, useState } from "react";
import {
  I18N, FEAT, FLOW, PRICE, FAQ, PUNIT, POP, PCTA, CUSTOM, FREE, SOON, SHOWCASE, SHOWCASE_HEAD,
  INTEGRATIONS, CUSTOMERS, HERO2, SIM_EVENTS, type Brand, type Lang,
} from "./home-data";

/* ---------- live day simulation (hero signature) ----------
   One business day (07:30–23:30) plays out on a loop: revenue accumulates
   through lunch/dinner peaks, staff punch in and out, and laun% breathes
   between red (expensive morning prep) and green (busy service). Numbers are
   deterministic functions of sim-time so SSR and client agree, and
   prefers-reduced-motion freezes the day at 13:37. */

const DAY_START = 450;  // 07:30
const DAY_END = 1410;   // 23:30
const FROZEN_AT = 817;  // 13:37 snapshot for reduced motion / first paint

// [fromMin, revenue kr/min, staff on shift]
const DAY_PHASES: [number, number, number][] = [
  [450, 350, 2],    // opening prep: costs, little revenue
  [600, 900, 3],    // morning
  [660, 1900, 5],   // pre-lunch
  [715, 4100, 6],   // lunch rush
  [810, 1600, 4],   // afternoon
  [1000, 2300, 7],  // early evening
  [1080, 4400, 7],  // dinner rush
  [1260, 1400, 3],  // late evening
  [1350, 500, 2],   // closing
];
const STAFF_COST_PER_MIN = 99; // ≈5.940 kr/klst incl. burden per person

function simAt(min: number): { revenue: number; cost: number; staff: number } {
  let revenue = 0, cost = 0, staff = DAY_PHASES[0][2];
  for (let i = 0; i < DAY_PHASES.length; i++) {
    const [from, rate, s] = DAY_PHASES[i];
    const to = i + 1 < DAY_PHASES.length ? DAY_PHASES[i + 1][0] : DAY_END;
    if (min <= from) break;
    const span = Math.min(min, to) - from;
    revenue += span * rate;
    cost += span * s * STAFF_COST_PER_MIN;
    if (min > from) staff = s;
  }
  return { revenue, cost, staff };
}

const knr = (n: number) => Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ".");
const hhmm = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(Math.floor(min % 60)).padStart(2, "0")}`;

/** Scroll-reveal wrapper: heavy fade-up as the element enters the viewport.
 * IntersectionObserver only (no scroll listeners); reduced motion skips it. */
function Reveal({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setSeen(true); return; }
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([e]) => { if (e.isIntersecting) { setSeen(true); io.disconnect(); } },
      { threshold: 0.16, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div ref={ref} className={`rv${seen ? " in" : ""}${className ? ` ${className}` : ""}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

function LiveSim({ lang }: { lang: Lang }) {
  const h = HERO2[lang];
  const [min, setMin] = useState(FROZEN_AT);
  const raf = useRef<number | null>(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let last = performance.now();
    let cur = FROZEN_AT;
    const tick = (now: number) => {
      // ~34s per simulated day: 28.5 sim-minutes per real second.
      cur += ((now - last) / 1000) * 28.5;
      last = now;
      if (cur >= DAY_END) cur = DAY_START;
      setMin(cur);
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => { if (raf.current) cancelAnimationFrame(raf.current); };
  }, []);

  const { revenue, cost, staff } = simAt(min);
  const pct = revenue > 0 ? (cost / revenue) * 100 : 0;
  const state = pct <= 30 ? "good" : pct <= 36 ? "warn" : "bad";
  const events = SIM_EVENTS[lang];
  const evt = [...events].reverse().find((e) => e[0] <= min) ?? events[0];
  const gauge = Math.min(100, (pct / 60) * 100); // 0–60% scale

  return (
    <div className="sim" role="img" aria-label={`${h.pct} ${pct.toFixed(1)}%`}>
      <div className="sim-head">
        <span className="sim-day">{h.panel_head}</span>
        <span className="sim-clock">{hhmm(min)}</span>
      </div>
      <div className="sim-stats">
        <div className="sim-stat">
          <span className="sl">{h.velta}</span>
          <span className="sv">{knr(revenue)} <em>kr</em></span>
        </div>
        <div className="sim-stat">
          <span className="sl">{h.laun}</span>
          <span className="sv">{knr(cost)} <em>kr</em></span>
        </div>
        <div className="sim-stat">
          <span className="sl">{h.onshift}</span>
          <span className="sv">{staff}</span>
        </div>
      </div>
      <div className={`sim-pct ${state}`}>
        <div className="sp-top">
          <span className="sl">{h.pct}</span>
          <span className="sl target">{h.target}</span>
        </div>
        <div className="sp-num">{pct.toFixed(1).replace(".", ",")}<em>%</em></div>
        <div className="sp-bar">
          <i style={{ width: `${gauge}%` }} />
          <b style={{ left: `${(30 / 60) * 100}%` }} />
        </div>
      </div>
      <div className="sim-ticker"><span className="tick-dot" />{evt[1]}</div>
      <div className="sim-note">{h.panel_note}</div>
    </div>
  );
}

/** A brand on the logo wall: real asset if `img` is set, else a styled wordmark. */
function BrandLogo({ b }: { b: Brand }) {
  if (b.img) {
    return <img className="brandlogo-img" src={b.img} alt={b.name} loading="lazy" />;
  }
  const wm = b.wm ?? {};
  const name = wm.case === "upper" ? b.name.toUpperCase() : wm.case === "lower" ? b.name.toLowerCase() : b.name;
  return (
    <span
      className="brandlogo-wm"
      style={{
        fontWeight: wm.weight ?? 700,
        letterSpacing: wm.spacing,
        fontFamily: wm.family === "serif" ? "Georgia, 'Times New Roman', serif" : undefined,
      }}
    >
      {name}
      {wm.accent && <i className="brandlogo-dot" style={{ background: wm.accent }} />}
    </span>
  );
}

function LogoSvg({ w = 26 }: { w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
      <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
      <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
    </svg>
  );
}

const Chk = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="#e9700f" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

// One line icon per feature card: schedule, time clock, labor%, staffing, app+ID, integrations.
const FEAT_ICONS = [
  <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></>,
  <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
  <><path d="M4 19V5M4 19h16" /><path d="M8 16v-5M12 16V8M16 16v-3" /></>,
  <><circle cx="9" cy="8" r="3.2" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 6.5a3 3 0 0 1 0 5.8M19.5 20a4.8 4.8 0 0 0-3-4.4" /></>,
  <><rect x="7" y="2.5" width="10" height="19" rx="2.5" /><path d="M11 18.5h2" /></>,
  <><path d="M8 12h8M12 8v8" /><circle cx="12" cy="12" r="9" /></>,
];
const FeatIcon = ({ i = 0 }: { i?: number }) => (
  <svg className="ic" viewBox="0 0 24 24">{FEAT_ICONS[i % FEAT_ICONS.length]}</svg>
);

export default function Home() {
  const [lang, setLangState] = useState<Lang>("is");
  const [faqOpen, setFaqOpen] = useState<number | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [showTab, setShowTab] = useState(0);
  const t = I18N[lang];
  // Persist the choice so the login page and app shell open in the same language.
  const setLang = (l: Lang) => { setLangState(l); try { localStorage.setItem("vakto-lang", l); } catch {} };
  const loginHref = `/login?lang=${lang}`;
  const tryHref = lang === "en" ? "/nyskraning?lang=en" : "/nyskraning";

  return (
    <>
      <nav className="nav">
        <div className="nav-in">
          <div className="logo"><LogoSvg />VAKTO</div>
          <div className="nav-links">
            <a href="#eiginleikar">{t.nav_features}</a>
            <a href="#ferli">{t.nav_how}</a>
            <a href="#tengingar">{t.nav_integrations}</a>
            <a href="#verd">{t.nav_pricing}</a>
          </div>
          <div className="nav-cta">
            <div className="langtog">
              <button className={lang === "is" ? "on" : ""} onClick={() => setLang("is")}>IS</button>
              <button className={lang === "en" ? "on" : ""} onClick={() => setLang("en")}>EN</button>
            </div>
            <a className="btn btn-gho" href={loginHref}>{t.nav_login}</a>
            <a className="btn btn-pri" href={tryHref}>{t.nav_try}</a>
          </div>
          <button className="nav-burger" aria-label="Valmynd" onClick={() => setMenuOpen((o) => !o)}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen ? <path d="M6 6l12 12M18 6L6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
            </svg>
          </button>
        </div>
        {menuOpen && (
          <div className="nav-mobile">
            <a href="#eiginleikar" onClick={() => setMenuOpen(false)}>{t.nav_features}</a>
            <a href="#ferli" onClick={() => setMenuOpen(false)}>{t.nav_how}</a>
            <a href="#tengingar" onClick={() => setMenuOpen(false)}>{t.nav_integrations}</a>
            <a href="#verd" onClick={() => setMenuOpen(false)}>{t.nav_pricing}</a>
            <a className="btn btn-gho" href={loginHref}>{t.nav_login}</a>
            <a className="btn btn-pri" href={tryHref} onClick={() => setMenuOpen(false)}>{t.nav_try}</a>
          </div>
        )}
      </nav>

      <header className="hero">
        <div className="wrap hero-grid">
          <div className="hero-copy">
            <span className="mono-eyebrow hin" style={{ animationDelay: "0ms" }}>{HERO2[lang].eyebrow}</span>
            <h1 className="hero-h1 hin" style={{ animationDelay: "80ms" }}>
              {HERO2[lang].t1}
              <span className="h1-live">{HERO2[lang].t2}</span>
            </h1>
            <p className="sub hin" style={{ animationDelay: "160ms" }}>{HERO2[lang].sub}</p>
            <div className="hero-cta hin" style={{ animationDelay: "240ms" }}>
              <a className="btn btn-pri btn-lg" href={tryHref}>{t.hero_cta1}</a>
              <a className="btn btn-dark btn-lg" href="#">{t.hero_cta2}</a>
            </div>
          </div>
          <div className="shell shell-dark hin" style={{ animationDelay: "200ms" }}>
            <LiveSim lang={lang} />
          </div>
        </div>
      </header>

      <section className="trust"><div className="wrap">
        <p>{t.trust_label}</p>
        <div className="logos brandwall">
          {CUSTOMERS.map((b) => <BrandLogo key={b.slug} b={b} />)}
        </div>
      </div></section>

      {/* ---------- tabbed feature showcase (real screenshots) ---------- */}
      <section className="sec"><div className="wrap">
        <Reveal><div className="sh">
          <h2>{SHOWCASE_HEAD[lang].title}</h2>
          <p>{SHOWCASE_HEAD[lang].sub}</p>
        </div></Reveal>
        <Reveal delay={80}><div className="fshow">
          <div className="fshow-tabs">
            {SHOWCASE[lang].map((s, i) => (
              <button key={i} className={`fshow-tab${showTab === i ? " on" : ""}`} onClick={() => setShowTab(i)}>{s.tab}</button>
            ))}
          </div>
          <div className="fshow-body">
            <div className="fshow-txt">
              <h3>{SHOWCASE[lang][showTab].title}</h3>
              <p>{SHOWCASE[lang][showTab].desc}</p>
              <a className="btn btn-pri" href={tryHref}>{t.hero_cta1}</a>
            </div>
            <div className="shell">
              <div className="fshow-img">
                <img src={SHOWCASE[lang][showTab].img} alt={SHOWCASE[lang][showTab].title} loading="lazy" />
              </div>
            </div>
          </div>
        </div></Reveal>
      </div></section>

      <section className="sec" id="eiginleikar"><div className="wrap">
        <Reveal><div className="sh">
          <h2>{t.feat_title}</h2>
          <p>{t.feat_sub}</p>
        </div></Reveal>
        {/* Asymmetric bento: the signature laun% feature leads as a dark 2-col
            tile with a mini gauge; one tinted cell; accounting as a wide strip. */}
        <div className="bento2">
          <Reveal className="bcell dark span2" delay={0}>
            <div className="bc-in">
              <div className="bc-txt">
                <div className="bi"><FeatIcon i={2} /></div>
                <h3>{FEAT[lang][2][0]}</h3><p>{FEAT[lang][2][1]}</p>
              </div>
              <div className="bc-gauge" aria-hidden="true">
                <div className="gring"><span>28,4%</span></div>
                <div className="glab">{HERO2[lang].target}</div>
              </div>
            </div>
          </Reveal>
          <Reveal className="bcell" delay={70}>
            <div className="bi"><FeatIcon i={0} /></div>
            <h3>{FEAT[lang][0][0]}</h3><p>{FEAT[lang][0][1]}</p>
          </Reveal>
          <Reveal className="bcell" delay={0}>
            <div className="bi"><FeatIcon i={1} /></div>
            <h3>{FEAT[lang][1][0]}</h3><p>{FEAT[lang][1][1]}</p>
          </Reveal>
          <Reveal className="bcell tint" delay={70}>
            <div className="bi"><FeatIcon i={4} /></div>
            <h3>{FEAT[lang][4][0]}</h3><p>{FEAT[lang][4][1]}</p>
          </Reveal>
          <Reveal className="bcell" delay={140}>
            <div className="bi"><FeatIcon i={3} /></div>
            <h3>{FEAT[lang][3][0]}</h3><p>{FEAT[lang][3][1]}</p>
          </Reveal>
          <Reveal className="bcell wide" delay={0}>
            <div className="bi"><FeatIcon i={5} /></div>
            <div><h3>{FEAT[lang][5][0]}</h3><p>{FEAT[lang][5][1]}</p></div>
          </Reveal>
        </div>
      </div></section>

      <section className="sec soft" id="ferli"><div className="wrap">
        <Reveal><div className="sh"><h2>{t.flow_title}</h2><p>{t.flow_sub}</p></div></Reveal>
        <div className="flow">
          {FLOW[lang].map((f, i) => (
            <Reveal className="fstep" delay={i * 70} key={i}>
              <div className="n">{String(i + 1).padStart(2, "0")}</div><h3>{f[0]}</h3><p>{f[1]}</p>
            </Reveal>
          ))}
        </div>
      </div></section>

      <section className="sec" id="tengingar"><div className="wrap">
        <div className="sh"><h2>{t.int_title}</h2><p>{t.int_sub}</p></div>
        <div className="logos brandwall" style={{ gap: 48 }}>
          {INTEGRATIONS.map((b) => <BrandLogo key={b.slug} b={b} />)}
        </div>
      </div></section>

      <section className="sec soft"><div className="wrap">
        <Reveal><div className="sh"><h2 id="verd">{t.verd_title}</h2><p>{t.verd_sub}</p></div></Reveal>
        <Reveal delay={80}><div className="price">
          {PRICE[lang].map((p, i) => {
            const plain = p.price === CUSTOM[lang] || p.price === FREE[lang];
            return (
              <div className={`plan${p.pop ? " pop" : ""}${p.soon ? " soon" : ""}`} key={i}>
                {p.pop && <span className="eyebrow" style={{ alignSelf: "flex-start", marginBottom: 10 }}>{POP[lang]}</span>}
                {p.soon && <span className="eyebrow" style={{ alignSelf: "flex-start", marginBottom: 10, background: "var(--line2, #eef0f4)", color: "var(--ink2, #5b6472)" }}>{SOON[lang]}</span>}
                <div className="pn">{p.name}</div>
                <div className="pd">{p.desc}</div>
                {p.soon ? (
                  <div className="amt" style={{ color: "var(--ink3, #8a93a3)" }}>{SOON[lang]}</div>
                ) : plain ? (
                  <div className="amt">{p.price}</div>
                ) : (
                  <div className="amt">{p.price} <small>{p.unit ?? PUNIT[lang]}</small></div>
                )}
                <ul>
                  {p.features.map((x, j) => (
                    <li key={j}><Chk />{x}</li>
                  ))}
                </ul>
                {p.soon ? (
                  <span className="btn btn-gho" style={{ marginTop: "auto", justifyContent: "center", opacity: .55, cursor: "default" }}>{SOON[lang]}</span>
                ) : (
                  <a className={`btn ${p.pop ? "btn-pri" : "btn-gho"}`} style={{ marginTop: "auto", justifyContent: "center" }} href={tryHref}>{PCTA[lang]}</a>
                )}
              </div>
            );
          })}
        </div></Reveal>
      </div></section>

      <section className="sec"><div className="wrap">
        <Reveal><div className="sh"><h2>{t.faq_title}</h2></div></Reveal>
        <div className="faq">
          {FAQ[lang].map((f, i) => (
            <div className={`fitem${faqOpen === i ? " open" : ""}`} key={i} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
              <div className="q">{f[0]}<span className="pl">+</span></div>
              <div className="a">{f[1]}</div>
            </div>
          ))}
        </div>
      </div></section>

      <section className="cta"><Reveal><div className="cta-box">
        <h2>{t.cta_title}</h2>
        <p>{t.cta_sub}</p>
        <div className="hero-cta cta-btns">
          <a className="btn btn-pri btn-lg" href="#">{t.cta_btn1}</a>
          <a className="btn btn-dark btn-lg" href={tryHref}>{t.cta_btn2}</a>
        </div>
      </div></Reveal></section>

      <footer className="foot"><div className="wrap">
        <div className="foot-grid">
          <div>
            <div className="logo" style={{ marginBottom: 12 }}><LogoSvg w={22} />VAKTO</div>
            <div style={{ fontSize: 13.5, color: "var(--muted)" }}>{t.foot_about}</div>
          </div>
          <div>
            <h4>{t.foot_product}</h4>
            <a href="#eiginleikar">{t.nav_features}</a>
            <a href="#tengingar">{t.nav_integrations}</a>
            <a href="#verd">{t.nav_pricing}</a>
          </div>
          <div>
            <h4>{t.foot_company}</h4>
            <a href="#">{t.foot_about_link}</a><a href="#">{t.foot_blog}</a><a href="#">{t.foot_contact}</a>
          </div>
          <div>
            <h4>{t.foot_legal}</h4>
            <a href="#">{t.foot_privacy}</a><a href="#">{t.foot_terms}</a><a href="#">{t.foot_cookies}</a>
          </div>
        </div>
        <div className="foot-bot"><span>© 2026 VAKTO ehf.</span><span>{t.foot_made}</span></div>
      </div></footer>

    </>
  );
}