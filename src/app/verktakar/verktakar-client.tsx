"use client";

// Markaðssíða VAKTO Verk (verktakar og einyrkjar), á máli síðunnar (texti í components/site/verk-text.ts).
// Aðeins það sem er til í dag er kynnt sem tilbúið; það sem á aðeins við á Íslandi er merkt þannig á öðrum málum.
import { Fragment, useEffect, useState } from "react";
import AhFooter from "@/components/site/ah-footer";
import SiteNav from "@/components/site/site-nav";
import { Glow } from "@/components/site/home-client";
import { VERKTAKI_PLAN } from "@/lib/plans";
import { useSiteLang } from "@/components/site/lang";
import { PATHS, appHref, fmtMoney, fmtNum } from "@/components/site/i18n";
import { VERK_TEXT } from "@/components/site/verk-text";

function Clock() {
  const [s, setS] = useState(2 * 3600 + 17 * 60 + 41);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setS((x) => x + 1), 1000);
    return () => clearInterval(t);
  }, []);
  return <>{`${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`}</>;
}

const ICONS: React.ReactNode[] = [
  <path key={0} d="M12 21s7-6.2 7-12a7 7 0 1 0-14 0c0 5.8 7 12 7 12Z M12 11.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  <Fragment key={1}><rect x="3" y="6" width="18" height="14" rx="3" /><circle cx="12" cy="13" r="3.5" /><path d="M8 6l1.5-2h5L16 6" /></Fragment>,
  <Fragment key={2}><circle cx="12" cy="12" r="9" /><path d="m8 12.5 2.7 2.7L16.5 9.5" /></Fragment>,
  <Fragment key={3}><path d="M3 7h13v10H3zM16 10h3.5L21 12.5V17h-5" /><circle cx="7" cy="18" r="1.8" /><circle cx="17.5" cy="18" r="1.8" /></Fragment>,
  <Fragment key={4}><path d="M4 20 20 4" /><circle cx="7" cy="7" r="2.5" /><circle cx="17" cy="17" r="2.5" /></Fragment>,
  <Fragment key={5}><rect x="3" y="4" width="18" height="16" rx="2" /><circle cx="9" cy="10" r="2.4" /><path d="M5.5 16.5c.6-1.8 2-2.8 3.5-2.8s2.9 1 3.5 2.8M14 9h4M14 13h4" /></Fragment>,
  <Fragment key={6}><circle cx="9" cy="8" r="3.2" /><path d="M3 20c.6-3.4 3-5.5 6-5.5s5.4 2.1 6 5.5" /><circle cx="17" cy="9" r="2.6" /><path d="M16 14.6c2.6.2 4.4 2 5 5.4" /></Fragment>,
  <Fragment key={7}><path d="M7 3h7l5 5v13H7z" /><path d="M14 3v5h5M10 13h6M10 17h4" /></Fragment>,
  <Fragment key={8}><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></Fragment>,
  <path key={9} d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z M18 15l.9 2.1L21 18l-2.1.9L18 21l-.9-2.1L15 18l2.1-.9z" />,
];

export default function VerktakarClient() {
  const p = VERKTAKI_PLAN;
  const lang = useSiteLang();
  const t = VERK_TEXT[lang];
  const SIGNUP = appHref(lang, "/nyskraning?plan=verktaki");
  const money = (n: number) => fmtMoney(lang, n);
  return (
    <div className="ah vk-site">
      <Glow />
      <SiteNav current="contractors" />
      <main id="efni">
        {/* ---------- hetja ---------- */}
        <section className="vks-hero">
          <div className="vks-hero-tx">
            <p className="ah-eyebrow">{t.eyebrow}</p>
            <h1>{t.h1[0]}<br />{t.h1[1]}<br /><span>{t.h1[2]}</span></h1>
            <p className="vks-lede">{t.lede}</p>
            <div className="vks-cta">
              <a className="ah-btn ah-btn-lg" href={SIGNUP}>{t.cta}</a>
              <span className="vks-price-note">{t.priceNote(money(p.base))}</span>
            </div>
          </div>
          <div className="vks-stage" aria-hidden="true">
            <div className="vks-phone">
              <div className="vks-notch" />
              <div className="vks-screen">
                <div className="vks-app-top"><span>{t.phone.top}</span><b>+</b></div>
                <div className="vks-live">
                  <div className="vks-live-h"><i />{t.phone.live}</div>
                  <div className="vks-live-t"><Clock /></div>
                  <div className="vks-live-j">{t.phone.job}</div>
                  <div className="vks-live-geo">● {t.phone.geo}</div>
                  <div className="vks-live-b">{t.phone.stop}</div>
                </div>
                <div className="vks-kpi"><div><small>{t.phone.month}</small><b>{t.phone.monthV}</b></div><div><small>{t.phone.open}</small><b>4</b></div></div>
                {t.phone.jobs.map(([b, sm]) => <div key={b} className="vks-job"><b>{b}</b><small>{sm}</small></div>)}
              </div>
            </div>
            <div className="vks-float vks-f1"><b>{t.float1[0]}</b><span>{t.float1[1]}</span></div>
            <div className="vks-float vks-f2"><span className="vks-thumbs"><i /><i /><i /></span><span>{t.float2}</span></div>
          </div>
        </section>

        {/* ---------- vandinn ---------- */}
        <section className="vks-pain">
          <div className="vks-pain-in">
            <p className="vks-q">{t.painQ[0]}<br /><span>{t.painQ[1]}</span></p>
            <p className="vks-pain-p">{t.painP}</p>
          </div>
        </section>

        {/* ---------- skref ---------- */}
        <section className="ah-sec vks-steps">
          <p className="ah-eyebrow">{t.stepsEyebrow}</p>
          <h2>{t.stepsH[0]}<br /><span>{t.stepsH[1]}</span></h2>
          <ol>
            {t.steps.map(([h, x], i) => <li key={h}><b>{i + 1}</b><h3>{h}</h3><p>{x}</p></li>)}
          </ol>
        </section>

        {/* ---------- samþykktarsíðan ---------- */}
        <section className="ah-sec vks-approve">
          <div className="vks-approve-tx">
            <p className="ah-eyebrow">{t.apprEyebrow}</p>
            <h2>{t.apprH[0]}<br /><span>{t.apprH[1]}</span></h2>
            <p className="vks-lede">{t.apprLede}</p>
            <ul className="vks-ticks">
              {t.apprTicks.map((x) => <li key={x}>{x}</li>)}
            </ul>
          </div>
          <div className="vks-doc" aria-hidden="true">
            <div className="vks-doc-h"><div><small>{t.doc.from}</small><b>{t.doc.company}</b></div><span>{t.doc.status}</span></div>
            <div className="vks-doc-t">{t.doc.title}<small>{t.doc.period}</small></div>
            <div className="vks-doc-k">{t.doc.k.map(([b, sm]) => <div key={sm}><b>{b}</b><small>{sm}</small></div>)}</div>
            {t.doc.rows.map(([l, v]) => <div key={l} className="vks-doc-r"><span>{l}</span><b>{v}</b></div>)}
            <div className="vks-doc-r tot"><span>{t.doc.total[0]}</span><b>{t.doc.total[1]}</b></div>
            <div className="vks-doc-n">{t.doc.refund[0]} <b>{t.doc.refund[1]}</b></div>
            <div className="vks-doc-btns"><span className="ok">{t.doc.approve}</span><span>{t.doc.fix}</span></div>
          </div>
        </section>

        {/* ---------- eiginleikar ---------- */}
        <section className="ah-sec vks-feat">
          <p className="ah-eyebrow">{t.featEyebrow}</p>
          <h2>{t.featH[0]}<br /><span>{t.featH[1]}</span></h2>
          <div className="vks-grid">
            {t.features.map((f, i) => (
              <article key={f.t}>
                <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">{ICONS[i]}</svg>
                <h3>{f.t}{f.tag && <em>{f.tag}</em>}</h3>
                <p>{f.p}</p>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- verð ---------- */}
        <section className="ah-sec vks-pricing" id="verd">
          <div className="vks-pcard">
            <p className="ah-eyebrow">{t.priceEyebrow}</p>
            <h2 className="vks-pname">{t.planName}</h2>
            <div className="vks-pp"><b>{fmtNum(lang, p.base)}</b><span>{lang === "is" ? t.perMonth : `ISK ${t.perMonth}`}</span></div>
            <p className="vks-pinc">{t.inc(money(p.extraPerEmployee ?? 0))}</p>
            <ul className="vks-ticks">
              {t.ticks(p.aiQuestions).map((x) => <li key={x}>{x}</li>)}
            </ul>
            <a className="ah-btn ah-btn-lg" href={SIGNUP}>{t.cta}</a>
            <p className="vks-fine">{t.fine} <a href={PATHS[lang].price}>{t.fineLink}</a>.</p>
          </div>
        </section>

        {/* ---------- spurningar ---------- */}
        <section className="ah-sec vks-faq">
          <h2>{t.faqH}</h2>
          <div className="vks-faq-l">
            {t.faq.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="vks-final">
          <h2>{t.finalH[0]}<br /><span>{t.finalH[1]}</span></h2>
          <a className="ah-btn ah-btn-lg" href={SIGNUP}>{t.finalCta}</a>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
