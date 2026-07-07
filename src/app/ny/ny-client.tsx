"use client";

// Candidate homepage: "miðnætursól" — deep black with a glowing orange aurora
// horizon (the VAKTO take on the owner's cosmic reference). All classes are
// ny-prefixed so this route never collides with the live homepage styles.

import { useEffect, useRef, useState } from "react";
import { CUSTOMERS, type Brand } from "../home-data";

/* ---------- shared bits ---------- */

function Logo({ w = 26 }: { w?: number }) {
  return (
    <svg width={w} height={w} viewBox="0 0 28 28" fill="none">
      <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
      <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
      <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
    </svg>
  );
}

function BrandWm({ b }: { b: Brand }) {
  const wm = b.wm ?? {};
  const name = wm.case === "upper" ? b.name.toUpperCase() : wm.case === "lower" ? b.name.toLowerCase() : b.name;
  return (
    <span className="ny-wm" style={{ fontWeight: wm.weight ?? 700, letterSpacing: wm.spacing, fontFamily: wm.family === "serif" ? "Georgia, serif" : undefined }}>
      {name}
    </span>
  );
}

/** Gentle fade-up on viewport entry. Reduced motion renders instantly. */
function Rise({ children, delay = 0, className = "" }: { children: React.ReactNode; delay?: number; className?: string }) {
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
    <div ref={ref} className={`ny-rise${seen ? " in" : ""}${className ? ` ${className}` : ""}`} style={delay ? { transitionDelay: `${delay}ms` } : undefined}>
      {children}
    </div>
  );
}

/* ---------- content (IS preview) ---------- */

const FEATURES = [
  {
    k: "launa",
    big: true,
    title: "Launahlutfall í rauntíma",
    desc: "Tengdu sölukerfið og sjáðu laun sem % af veltu á meðan dagurinn gerist. Litakóðað eftir markmiðinu þínu, uppfært við hverja stimplun og hverja sölu.",
    visual: "gauge",
  },
  { k: "plan", title: "Vaktaplan á sekúndum", desc: "Dragðu vaktir, afritaðu viku og birtu með einum smelli. AI stingur upp á mönnun.", visual: "grid" },
  { k: "klukka", title: "Stimpilklukka & app", desc: "PIN, GPS eða QR-skírteini í Apple Wallet. Mætingin rennur beint í samþykktar tímaskýrslur.", visual: "pulse" },
  { k: "laun", wide: true, title: "Laun eftir kjarasamningum", desc: "Dagvinna, álög, yfirvinna og uppbætur reiknast sjálfkrafa eftir Eflingu, VR eða þínum eigin reglum, og flytjast beint í Payday eða DK. Engin handavinna, engar villur.", visual: "rows" },
];

const STEPS = [
  { n: "01", title: "Stofnaðu aðgang", desc: "Skráðu fyrirtækið, bættu við starfsfólki og veldu kjarasamninga. Uppsetning tekur korter, ekki viku." },
  { n: "02", title: "Birtu fyrsta vaktaplanið", desc: "Dragðu vaktir í grid-ið eða láttu AI raða. Starfsfólkið fær planið og skírteinið beint í símann." },
  { n: "03", title: "Horfðu á launahlutfallið", desc: "Stimplanir og velta streyma inn og mælaborðið sýnir laun% af veltu í rauntíma. Ekkert uppgjörsstress." },
];

export default function NyClient() {
  return (
    <div className="ny">
      {/* floating glass pill nav */}
      <nav className="ny-nav">
        <a className="ny-logo" href="/"><Logo w={24} />VAKTO</a>
        <div className="ny-links">
          <a href="#eiginleikar">Eiginleikar</a>
          <a href="#skref">Hvernig það virkar</a>
          <a href="#verd">Verð</a>
        </div>
        <div className="ny-navcta">
          <a className="ny-btn ghost" href="/login">Innskráning</a>
          <a className="ny-btn glow" href="/nyskraning">Byrja núna</a>
        </div>
      </nav>

      {/* ---------- hero: the midnight-sun horizon ---------- */}
      <header className="ny-hero">
        <div className="ny-aurora" aria-hidden="true">
          <span className="ny-stars" />
          <i className="a1" /><i className="a2" /><i className="a3" />
          <span className="ny-rays r1" />
          <span className="ny-rays r2" />
          <span className="ny-rays r3" />
          <span className="ny-horizon" />
        </div>
        <div className="ny-hero-in">
          <span className="ny-pill ny-hin" style={{ animationDelay: "350ms" }}>14 daga frí prufa · Uppsetning samdægurs</span>
          <h1 className="ny-hin" style={{ animationDelay: "480ms" }}>
            Vaktir, stimplun og laun.<br />Á sjálfstýringu.
          </h1>
          <p className="ny-sub ny-hin" style={{ animationDelay: "620ms" }}>
            VAKTO tengir vaktaplanið, stimpilklukkuna og sölukerfið og sýnir þér
            launahlutfall af veltu í rauntíma. Fyrir veitingastaði, verslanir og keðjur.
          </p>
          <div className="ny-ctas ny-hin" style={{ animationDelay: "760ms" }}>
            <a className="ny-btn glow lg" href="/nyskraning">Byrja núna</a>
            <a className="ny-btn ghost lg" href="#eiginleikar">Sjá eiginleika</a>
          </div>
          <div className="ny-shot ny-hin" style={{ animationDelay: "900ms" }}>
            <img src="/showcase/maelabord.png" alt="VAKTO mælaborð — launahlutfall í rauntíma" />
          </div>
        </div>
      </header>

      {/* customers */}
      <section className="ny-trust">
        <Rise>
          <p>Treyst af veitingastöðum og verslunum um allt land</p>
          <div className="ny-wall">{CUSTOMERS.map((b) => <BrandWm key={b.slug} b={b} />)}</div>
        </Rise>
      </section>

      {/* statement */}
      <section className="ny-state">
        <Rise className="ny-state-grid">
          <p className="ny-statement">
            Launakostnaður er stærsti kostnaðarliður veitingareksturs.
            Samt sjá flestir hann <em>þremur vikum of seint</em>, í bókhaldinu.
            VAKTO færir hann fram í rauntíma — svo þú getir brugðist við á meðan vaktin stendur.
          </p>
          <span className="ny-orb" aria-hidden="true" />
        </Rise>
      </section>

      {/* ---------- features: glass cards with glow ---------- */}
      <section className="ny-sec" id="eiginleikar">
        <Rise><div className="ny-head">
          <h2>Það sem gerir VAKTO öðruvísi</h2>
          <p>Eitt kerfi frá vaktaplani að launaseðli, byggt fyrir íslenskan rekstur.</p>
        </div></Rise>
        <div className="ny-cards">
          {FEATURES.map((f, i) => (
            <Rise className={`ny-card${f.big ? " big" : ""}${"wide" in f && f.wide ? " wide" : ""}`} delay={(i % 2) * 80} key={f.k}>
              <div className="ny-card-vis" aria-hidden="true">
                {f.visual === "gauge" && (
                  <div className="ny-gauge"><div className="ny-gring"><span>28,4%</span></div><small>MARKMIÐ 30%</small></div>
                )}
                {f.visual === "grid" && (
                  <div className="ny-minigrid">{Array.from({ length: 28 }, (_, j) => <i key={j} className={[3, 4, 9, 12, 17, 18, 24].includes(j) ? "on" : [6, 20, 26].includes(j) ? "eve" : ""} />)}</div>
                )}
                {f.visual === "pulse" && (
                  <div className="ny-clock"><span className="ring" /><span className="ring r2" /><b>08:02</b></div>
                )}
                {f.visual === "rows" && (
                  <div className="ny-rows"><i style={{ width: "72%" }} /><i style={{ width: "54%" }} /><i style={{ width: "84%" }} /><i style={{ width: "40%" }} /></div>
                )}
              </div>
              <div className="ny-card-txt">
                <h3>{f.title}</h3>
                <p>{f.desc}</p>
              </div>
            </Rise>
          ))}
        </div>
      </section>

      {/* ---------- steps ---------- */}
      <section className="ny-sec" id="skref">
        <Rise><div className="ny-head">
          <h2>Þrjú skref og þú ert í loftinu</h2>
        </div></Rise>
        <div className="ny-steps">
          {STEPS.map((s, i) => (
            <Rise className="ny-step" delay={i * 90} key={s.n}>
              <span className="n">{s.n}</span>
              <h3>{s.title}</h3>
              <p>{s.desc}</p>
            </Rise>
          ))}
        </div>
      </section>

      {/* quote */}
      <section className="ny-quote">
        <Rise>
          <blockquote>„VAKTO lækkaði launahlutfallið okkar um 4% á tveimur mánuðum."</blockquote>
          <cite>Eigandi veitingastaðar í Reykjavík</cite>
        </Rise>
      </section>

      {/* ---------- pricing ---------- */}
      <section className="ny-sec" id="verd">
        <Rise><div className="ny-head">
          <h2>Eitt verð. Allt innifalið.</h2>
          <p>Engin þrep, ekkert falið, engin binding.</p>
        </div></Rise>
        <Rise delay={80}><div className="ny-price">
          <div className="ny-price-glow" aria-hidden="true" />
          <div className="ny-amt">9.990 <small>kr/mán · VSK innifalið</small></div>
          <ul>
            <li>5 notendur innifaldir, +990 kr per notanda umfram</li>
            <li>Vaktaplan, stimpilklukka, launahlutfall í rauntíma</li>
            <li>Starfsmannaapp, skírteini, spjall og skýrslur</li>
            <li>Tenging við Payday, DK og sölukerfin</li>
          </ul>
          <a className="ny-btn glow lg" href="/nyskraning">Byrja núna</a>
          <span className="ny-fine">14 daga frí prufa. Ekkert kort.</span>
        </div></Rise>
      </section>

      {/* CTA + giant wordmark footer */}
      <section className="ny-cta">
        <Rise>
          <h2>Sjáðu launahlutfallið þitt í rauntíma. Strax í dag.</h2>
          <div className="ny-ctas" style={{ justifyContent: "center" }}>
            <a className="ny-btn glow lg" href="/nyskraning">Byrja núna</a>
            <a className="ny-btn ghost lg" href="mailto:hallo@vakto.is">Bóka kynningu</a>
          </div>
        </Rise>
      </section>

      <footer className="ny-foot">
        <div className="ny-foot-links">
          <a className="ny-logo" href="/"><Logo w={20} />VAKTO</a>
          <div>
            <a href="#eiginleikar">Eiginleikar</a>
            <a href="#verd">Verð</a>
            <a href="/login">Innskráning</a>
            <a href="mailto:hallo@vakto.is">Hafa samband</a>
          </div>
          <span>© 2026 VAKTO ehf. · Hannað og þróað á Íslandi</span>
        </div>
        <div className="ny-mark" aria-hidden="true">VAKTO</div>
      </footer>
    </div>
  );
}
