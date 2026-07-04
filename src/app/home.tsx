"use client";

import { useState } from "react";
import {
  I18N, FEAT, FLOW, PRICE, FAQ, PUNIT, POP, PCTA, CUSTOM, FREE, SOON, SHOWCASE, SHOWCASE_HEAD,
  INTEGRATIONS, CUSTOMERS, type Brand, type Lang,
} from "./home-data";

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

const FeatIcon = () => (
  <svg className="ic" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="9" />
    <path d="M12 7v5l3 2" />
  </svg>
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
        <div className="wrap">
          <span className="eyebrow"><span className="dot" /><span>{t.hero_badge}</span></span>
          <h1 dangerouslySetInnerHTML={{ __html: t.hero_title }} />
          <p className="sub">{t.hero_sub}</p>
          <div className="hero-cta">
            <a className="btn btn-pri btn-lg" href={tryHref}>{t.hero_cta1}</a>
            <a className="btn btn-gho btn-lg" href="#">{t.hero_cta2}</a>
          </div>
          <p className="hero-note">{t.hero_note}</p>
          <div className="mockwrap"><div className="mock">
            <div className="mbar"><i /><i /><i /></div>
            <div className="app">
              <div className="side">
                <div className="br"><LogoSvg w={18} />VAKTO</div>
                <div className="ni on"><span className="di" /><span>{t.m_dashboard}</span></div>
                <div className="ni"><span className="di" /><span>{t.m_schedule}</span></div>
                <div className="ni"><span className="di" /><span>{t.m_time}</span></div>
                <div className="ni"><span className="di" /><span>{t.m_pay}</span></div>
                <div className="ni"><span className="di" /><span>{t.m_perf}</span></div>
              </div>
              <div className="appmain">
                <div className="aphero">
                  <div className="st"><div className="l">{t.m_planned}</div><div className="v">368</div></div>
                  <div className="st"><div className="l">{t.m_actual}</div><div className="v">374</div></div>
                  <div className="st"><div className="l">{t.m_laborcost}</div><div className="v">1,40 m</div></div>
                  <div className="st"><div className="l">{t.m_laborpct}</div><div className="v" style={{ color: "#f7a35a" }}>32,1%</div></div>
                </div>
                <div className="apk" style={{ marginTop: 14 }}>
                  <div className="c"><div className="l">{t.m_revtoday}</div><div className="v">612 þ</div><div className="d">+8,0%</div></div>
                  <div className="c"><div className="l">{t.m_laborpct2}</div><div className="v">32,1%</div><div className="d" style={{ color: "var(--warn)" }}>{t.m_target}</div></div>
                  <div className="c"><div className="l">{t.m_cost}</div><div className="v">198 þ</div></div>
                  <div className="c"><div className="l">{t.m_staffing}</div><div className="v">5 / 6</div></div>
                </div>
                <div className="spark">
                  {[62, 54, 70, 80, 96, 88, 58, 66, 74, 84, 92, 78].map((h, i) => (
                    <span key={i} style={{ height: `${h}%` }} />
                  ))}
                </div>
              </div>
            </div>
          </div></div>
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
        <div className="sh">
          <span className="eyebrow">{SHOWCASE_HEAD[lang].eyebrow}</span>
          <h2 style={{ marginTop: 14 }}>{SHOWCASE_HEAD[lang].title}</h2>
          <p>{SHOWCASE_HEAD[lang].sub}</p>
        </div>
        <div className="fshow">
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
            <div className="fshow-img">
              <img src={SHOWCASE[lang][showTab].img} alt={SHOWCASE[lang][showTab].title} loading="lazy" />
            </div>
          </div>
        </div>
      </div></section>

      <section className="sec" id="eiginleikar"><div className="wrap">
        <div className="sh">
          <span className="eyebrow">{t.feat_eyebrow}</span>
          <h2 style={{ marginTop: 14 }}>{t.feat_title}</h2>
          <p>{t.feat_sub}</p>
        </div>
        <div className="bento">
          {FEAT[lang].map((f, i) => (
            <div className="bcard" key={i}>
              <div className="bi"><FeatIcon /></div>
              <h3>{f[0]}</h3><p>{f[1]}</p>
            </div>
          ))}
        </div>
      </div></section>

      <section className="sec soft" id="ferli"><div className="wrap">
        <div className="sh"><h2>{t.flow_title}</h2><p>{t.flow_sub}</p></div>
        <div className="flow">
          {FLOW[lang].map((f, i) => (
            <div className="fstep" key={i}>
              <div className="n">{i + 1}</div><h3>{f[0]}</h3><p>{f[1]}</p>
            </div>
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
        <div className="sh"><h2 id="verd">{t.verd_title}</h2><p>{t.verd_sub}</p></div>
        <div className="price">
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
        </div>
      </div></section>

      <section className="sec"><div className="wrap">
        <div className="sh"><h2>{t.faq_title}</h2></div>
        <div className="faq">
          {FAQ[lang].map((f, i) => (
            <div className={`fitem${faqOpen === i ? " open" : ""}`} key={i} onClick={() => setFaqOpen(faqOpen === i ? null : i)}>
              <div className="q">{f[0]}<span className="pl">+</span></div>
              <div className="a">{f[1]}</div>
            </div>
          ))}
        </div>
      </div></section>

      <section className="cta"><div className="cta-box">
        <h2>{t.cta_title}</h2>
        <p>{t.cta_sub}</p>
        <div className="hero-cta" style={{ marginTop: 28 }}>
          <a className="btn btn-lg" style={{ background: "#fff", color: "var(--green)" }} href="#">{t.cta_btn1}</a>
          <a className="btn btn-lg" style={{ background: "rgba(255,255,255,.16)", color: "#fff", borderColor: "rgba(255,255,255,.32)" }} href={tryHref}>{t.cta_btn2}</a>
        </div>
      </div></section>

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