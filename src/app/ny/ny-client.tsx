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
  if (b.img) {
    return <img className="ny-wm-img" src={b.img} alt={b.name} title={b.name} loading="lazy" />;
  }
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

/* ---------- the industry planet: a glassy sphere cycling through the
   businesses VAKTO is built for (the reference's rotating orb, VAKTO-ised) */

const INDUSTRIES: { name: string; icon: React.ReactNode }[] = [
  { name: "Veitingastaðir", icon: <path d="M7 3v7a2 2 0 0 0 2 2v9M9 3v5M5 3v5M17 3c-1.7 1.2-2.5 3.4-2.5 6v4H17m0-10v18" /> },
  { name: "Kaffihús", icon: <><path d="M4 9h12v6a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5Z" /><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M7 5.5c0-1 .8-1 .8-2M11 5.5c0-1 .8-1 .8-2" /></> },
  { name: "Verslanir", icon: <><path d="M4 8l1.5-4h13L20 8M4 8v11a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1V8M4 8h16" /><path d="M9 12a3 3 0 0 0 6 0" /></> },
  { name: "Hótel & gisting", icon: <><path d="M3 20V6M3 16h18v4M3 12h18v-2a3 3 0 0 0-3-3h-8v5" /><circle cx="6.5" cy="9.5" r="1.5" /></> },
  { name: "Bakarí", icon: <><path d="M6 12a6 6 0 0 1 12 0v7H6Z" /><path d="M9 12v3M12 11v4M15 12v3" /></> },
  { name: "Keðjur & útibú", icon: <><path d="M3 21h18M5 21V7l5-4v18M14 21V11l5-3v13" /><path d="M8 9h.01M8 13h.01M8 17h.01" /></> },
];

function IndustryOrb() {
  const [i, setI] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((v) => (v + 1) % INDUSTRIES.length), 2400);
    return () => clearInterval(id);
  }, []);
  const ind = INDUSTRIES[i];
  return (
    <div className="ny-planet" aria-label={`Byggt fyrir: ${INDUSTRIES.map((x) => x.name).join(", ")}`}>
      <span className="ny-planet-swirl" aria-hidden="true" />
      <span className="ny-planet-shine" aria-hidden="true" />
      <div className="ny-planet-face" key={i}>
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ind.icon}</svg>
        <span>{ind.name}</span>
      </div>
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
  { k: "klukka", title: "Stimpilklukka & app", desc: "PIN, GPS eða QR-skírteini. Mætingin rennur beint í samþykktar tímaskýrslur.", visual: "pulse" },
  { k: "skirteini", title: "Starfsmannaskírteini í símann", desc: "Hver starfsmaður fær stafrænt skírteini í Apple og Google Wallet, með mynd, stöðu og QR-kóða sem stimplar inn og út á kioskinum.", visual: "card" },
  { k: "laun", title: "Laun eftir kjarasamningum", desc: "Dagvinna, álög, yfirvinna og uppbætur reiknast sjálfkrafa eftir Eflingu, VR eða þínum reglum, beint í Payday eða DK.", visual: "rows" },
  { k: "app", wide: true, title: "Appið sem starfsfólkið elskar", desc: "Vaktirnar, launin og réttindin í símanum, vaktaskipti og frí með einum smelli, og innbyggt spjall fyrir allt teymið. Ekkert sér-spjallforrit, engir miðar á kaffistofunni. Starfsfólkið veit alltaf hvað er næst og þú losnar við skilaboðaflóðið.", visual: "chat" },
];

const STEPS = [
  { n: "01", title: "Stofnaðu aðgang", desc: "Skráðu fyrirtækið, bættu við starfsfólki og veldu kjarasamninga. Uppsetning tekur korter, ekki viku." },
  { n: "02", title: "Láttu AI raða vöktunum", desc: "Lýstu vikunni og AI stillir upp mönnun eftir álagi og reglum. Þú fínstillir, samþykkir og birtir. Starfsfólkið fær planið og skírteinið beint í símann." },
  { n: "03", title: "Sjáðu kostnaðinn fyrirfram", desc: "Launakostnaðurinn birtist áður en þú birtir planið og frávikin berast saman dag frá degi. Ekkert uppgjörsstress um mánaðamót." },
];

// Fictional example voices for the preview (photos generated with Higgsfield).
const VOICES = [
  {
    img: "/folk/gudrun.jpg",
    name: "Guðrún Ósk",
    role: "Eigandi, kaffihús í Reykjavík",
    quote: "Vaktaplanið sem tók mig tvo tíma á sunnudagskvöldum tekur núna fimm mínútur. AI raðar, ég samþykki og starfsfólkið fær það beint í símann. Ég hef aldrei haft jafn góða tilfinningu fyrir launakostnaðinum og núna.",
  },
  {
    img: "/folk/stefan.jpg",
    name: "Stefán Örn",
    role: "Rekstrarstjóri veitingahúss",
    quote: "Starfsfólkið tók appinu samstundis. Vaktaskipti sem áður enduðu í tuttugu skilaboðum gerast núna með einum smelli, og ég sé frávikin samdægurs.",
  },
  {
    img: "/folk/elisabet.jpg",
    name: "Elísabet Anna",
    role: "Verslunarstjóri",
    quote: "Við sáum strax hvaða dagar voru ofmannaðir. Launahlutfallið fór úr 36% í 31% á tveimur mánuðum.",
  },
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
          <span className="ny-stars s1" />
          <span className="ny-stars s2" />
          <i className="a1" /><i className="a2" /><i className="a3" />
          <span className="ny-rays r1" />
          <span className="ny-rays r2" />
          <span className="ny-rays r3" />
          <span className="ny-horizon" />
          <span className="ny-underglow" />
        </div>
        <div className="ny-hero-in">
          <span className="ny-pill ny-hin" style={{ animationDelay: "350ms" }}>Ný kynslóð vaktakerfis · knúið af AI</span>
          <h1 className="ny-hin" style={{ animationDelay: "480ms" }}>
            Vaktaplanið gerir sig sjálft.<br />Launin reikna sig líka.
          </h1>
          <p className="ny-sub ny-hin" style={{ animationDelay: "620ms" }}>
            VAKTO er bylting í vakta- og tímaskráningu: AI raðar vöktunum á sekúndum,
            kostnaðurinn er fyrirsjáanlegur áður en vikan byrjar og þú sérð frávikin
            dag frá degi, ekki um mánaðamót.
          </p>
          <div className="ny-ctas ny-hin" style={{ animationDelay: "760ms" }}>
            <a className="ny-btn glow lg" href="/nyskraning">Byrja núna</a>
            <a className="ny-btn ghost lg" href="#eiginleikar">Sjá eiginleika</a>
          </div>
          <div className="ny-shot ny-hin" style={{ animationDelay: "900ms" }}>
            <img src="/showcase/maelabord-dark.png" alt="VAKTO mælaborð í dökkri stillingu — launahlutfall í rauntíma" />
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

      {/* statement + industry planet */}
      <section className="ny-state">
        <Rise className="ny-state-grid">
          <p className="ny-statement">
            Að gera vaktaplan á ekki að vera flókið eða leiðinlegt.
            VAKTO raðar með AI, sýnir þér launakostnaðinn <em>áður en þú birtir planið</em> og
            ber frávikin saman dag frá degi. Þú stjórnar rekstrinum, ekki Excel-skjalinu.
          </p>
          <IndustryOrb />
        </Rise>
      </section>

      {/* ---------- features: glass cards with glow ---------- */}
      <section className="ny-sec" id="eiginleikar">
        <Rise><div className="ny-head">
          <h2>Það sem gerir VAKTO öðruvísi</h2>
          <p>Nútímavædd vakta- og tímaskráning: eitt kerfi frá plani að launaseðli, byggt fyrir íslenskan rekstur.</p>
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
                {f.visual === "chat" && (
                  <div className="ny-chat">
                    <span className="bub them">Getur einhver tekið laugardagsvaktina?</span>
                    <span className="bub me">Ég tek hana!</span>
                    <span className="bub tag">Vaktaskipti samþykkt ✓</span>
                  </div>
                )}
                {f.visual === "card" && (
                  <div className="ny-idcard">
                    <div className="top"><b>VAKTO</b><span>STARFSMANNASKÍRTEINI</span></div>
                    <div className="body">
                      <span className="av">MÍ</span>
                      <div className="tx"><b>Mína Huong</b><span>Kokkur · Eldhús</span></div>
                      <span className="qr">{Array.from({ length: 25 }, (_, j) => <i key={j} className={[0, 2, 3, 4, 6, 8, 10, 12, 14, 16, 18, 20, 21, 22, 24].includes(j) ? "on" : ""} />)}</span>
                    </div>
                  </div>
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

      {/* voices: featured card + two smaller (photos generated for the preview) */}
      <section className="ny-sec ny-voices">
        <Rise><div className="ny-head">
          <h2>Rekstrarfólk elskar VAKTO</h2>
          <p>Og starfsfólkið líka. Það er allur galdurinn.</p>
        </div></Rise>
        <Rise delay={70}><div className="ny-voice-main">
          <img src={VOICES[0].img} alt={VOICES[0].name} loading="lazy" />
          <div className="vx">
            <blockquote>„{VOICES[0].quote}"</blockquote>
            <div className="who"><b>{VOICES[0].name}</b><span>{VOICES[0].role}</span></div>
          </div>
        </div></Rise>
        <div className="ny-voice-grid">
          {VOICES.slice(1).map((v, i) => (
            <Rise className="ny-voice" delay={i * 90} key={v.name}>
              <blockquote>„{v.quote}"</blockquote>
              <div className="who">
                <img src={v.img} alt={v.name} loading="lazy" />
                <div><b>{v.name}</b><span>{v.role}</span></div>
              </div>
            </Rise>
          ))}
        </div>
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
        <span className="ny-foot-aurora" aria-hidden="true" />
        <div className="ny-foot-grid">
          <div className="ny-foot-brand">
            <a className="ny-logo" href="/"><Logo w={22} />VAKTO</a>
            <p>Bylting í vakta- og tímaskráningu. Vaktaplan með AI, laun eftir kjarasamningum og launahlutfall af veltu í rauntíma.</p>
          </div>
          <div className="ny-foot-col">
            <h4>Vara</h4>
            <a href="#eiginleikar">Eiginleikar</a>
            <a href="#skref">Hvernig það virkar</a>
            <a href="#verd">Verð</a>
            <a href="/nyskraning">Byrja núna</a>
          </div>
          <div className="ny-foot-col">
            <h4>Fyrirtækið</h4>
            <a href="mailto:hallo@vakto.is">Hafa samband</a>
            <a href="/login">Innskráning</a>
            <a href="/kiosk">Stimpilklukka</a>
          </div>
          <div className="ny-foot-col">
            <h4>Lögfræði</h4>
            <a href="#">Persónuvernd</a>
            <a href="#">Skilmálar</a>
            <a href="#">Vafrakökur</a>
          </div>
          <div className="ny-foot-col">
            <h4>Fylgdu okkur</h4>
            <a href="#">Instagram</a>
            <a href="#">Facebook</a>
            <a href="#">LinkedIn</a>
          </div>
        </div>
        <div className="ny-foot-bot">
          <span>© 2026 VAKTO ehf.</span>
          <span>Hannað og þróað á Íslandi</span>
        </div>
        <div className="ny-mark" aria-hidden="true">VAKTO</div>
      </footer>
    </div>
  );
}
