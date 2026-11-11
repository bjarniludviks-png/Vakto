"use client";

// Markaðssíða VAKTO AI (/ai). Textar í components/site/ai-text.ts (IS/EN), verð úr lib/plans.ts.
import { useState } from "react";
import AhFooter from "@/components/site/ah-footer";
import SiteNav from "@/components/site/site-nav";
import { Glow } from "@/components/site/home-client";
import { useLangSync } from "@/components/site/lang";
import { AI_TEXT } from "@/components/site/ai-text";
import { AI_PACK, PLANS, getPlan } from "@/lib/plans";
import { FEATURE_MIN } from "@/lib/plan-features";
import { nf } from "@/lib/format";

function Spark({ className = "ai-spark" }: { className?: string }) {
  // Sama neistatákn og VAKTO AI-hnappurinn í kerfinu.
  return <svg className={className} viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>;
}
const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 12.5 4 4 8-9" /></svg>;
const ICONS = [
  <path key="a" d="M4 20V10M10 20V4M16 20v-8M20 20H2" />,
  <path key="b" d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />,
  <path key="c" d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.9 1.9 0 0 0 3.4 0" />,
];

/** Spjall-sýnishorn í hetjunni: spurning, svar með tölum og tillaga sem hægt er að „staðfesta“. */
function ChatMock() {
  const t = AI_TEXT[useLangSync()].mock;
  const [done, setDone] = useState(false);
  return (
    <div className="ai-chat" role="img" aria-label={`${t.q} ${t.intro} ${t.prop}`}>
      <div className="ai-chat-bar"><span className="ai-badge"><Spark /></span><b>{t.bar}</b></div>
      <div className="ai-chat-body" aria-hidden="true">
        <p className="ai-q">{t.q}</p>
        <div className="ai-a">
          <p>{t.intro}</p>
          <ul>{t.rows.map(([n, d]) => <li key={n}><b>{n}</b><span>{d}</span></li>)}</ul>
          <p>{t.ask}</p>
        </div>
        <div className={`ai-act${done ? " done" : ""}`}>
          <span>{t.prop}</span>
          <button type="button" tabIndex={-1} onClick={() => setDone(true)} disabled={done}>{done ? <><Check />{t.done}</> : t.confirm}</button>
        </div>
      </div>
      <div className="ai-chat-foot">{t.foot}</div>
    </div>
  );
}

export default function AiClient() {
  const lang = useLangSync();
  const t = AI_TEXT[lang];
  const grunnur = getPlan("grunnur");
  const paid = PLANS.filter((p) => p.base > 0);
  const scheduleFrom = PLANS.findIndex((p) => p.id === FEATURE_MIN.ai_schedule);
  return (
    <div className="ah ai-site">
      <Glow />
      <SiteNav current="ai" />
      <main id="efni">
        {/* ---------- hetja ---------- */}
        <section className="ai-hero">
          <div className="ai-hero-tx">
            <p className="ah-eyebrow ai-eb"><Spark />{t.hero.eyebrow}</p>
            <h1>{t.hero.h1a}<br /><span>{t.hero.h1b}</span></h1>
            <p className="ai-lede">{t.hero.lede}</p>
            <div className="ai-cta">
              <a className="ah-btn ah-btn-lg" href="/nyskraning">{t.hero.cta}</a>
              <a className="ah-link" href="#daemi">{t.hero.cta2}</a>
            </div>
            <p className="ai-note">{t.hero.note(grunnur.aiQuestions)}</p>
          </div>
          <ChatMock />
        </section>

        {/* ---------- spyrðu / biddu / láttu vita ---------- */}
        <section className="ah-sec ai-how" id="daemi">
          <div className="ah-head">
            <p className="ah-eyebrow">{t.how.eyebrow}</p>
            <h2>{t.how.h}<br /><span>{t.how.hs}</span></h2>
          </div>
          <div className="ai-cols">
            {t.how.cols.map((c, i) => (
              <article key={c.h}>
                <svg className="ai-ic" viewBox="0 0 24 24" aria-hidden="true">{ICONS[i]}</svg>
                <h3>{c.h}</h3>
                <p>{c.p}</p>
                <ul>{c.ex.map((e) => <li key={e}>{e}</li>)}</ul>
              </article>
            ))}
          </div>
        </section>

        {/* ---------- vaktaplan ---------- */}
        <section className="ah-sec ai-split">
          <div className="ai-split-tx">
            <p className="ah-eyebrow">{t.plan.eyebrow}</p>
            <h2>{t.plan.h}<br /><span>{t.plan.hs}</span></h2>
            <p className="ai-p">{t.plan.p}</p>
            <ul className="ai-ticks">{t.plan.ticks.map((x) => <li key={x}>{x}</li>)}</ul>
            <p className="ai-fine">{t.plan.note}</p>
          </div>
          <div className="ai-card ai-plan" aria-hidden="true">
            <div className="ai-card-h"><Spark />{t.plan.mockH}</div>
            <div className="ai-week">
              {[3, 3, 3, 3, 3, 3, 3].map((n, d) => <div key={d}>{Array.from({ length: n }, (_, k) => <i key={k} className={d === 4 && k === 2 ? "new" : ""} />)}</div>)}
            </div>
            <dl>{t.plan.mockRows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd>{v}</dd></div>)}</dl>
            <p className="ai-card-foot">{t.plan.mockFoot}</p>
          </div>
        </section>

        {/* ---------- leiðsögn + þjónustuver ---------- */}
        <section className="ah-sec ai-split ai-rev">
          <div className="ai-split-tx">
            <p className="ah-eyebrow">{t.guide.eyebrow}</p>
            <h2>{t.guide.h}<br /><span>{t.guide.hs}</span></h2>
            <p className="ai-p">{t.guide.p}</p>
          </div>
          <div className="ai-card ai-convo" aria-hidden="true">
            <p className="ai-q">{t.guide.q1}</p>
            <ol className="ai-steps">{t.guide.a1.map((s) => <li key={s}>{s}</li>)}</ol>
            <p className="ai-q">{t.guide.q2}</p>
            <p className="ai-a-line"><Spark />{t.guide.a2}</p>
            <div className="ai-act"><span>{t.guide.prop}</span><button type="button" tabIndex={-1}>{t.mock.confirm}</button></div>
          </div>
        </section>

        {/* ---------- starfsfólk (dökkt) ---------- */}
        <section className="ah-dark ai-staff">
          <div className="ah-head">
            <p className="ah-eyebrow">{t.staff.eyebrow}</p>
            <h2>{t.staff.h}<br /><span>{t.staff.hs}</span></h2>
            <p className="ah-lede">{t.staff.p}</p>
          </div>
          <div className="ai-staff-grid">
            {t.staff.ex.map((e) => (
              <div key={e.q} className="ai-bubble">
                <p className="ai-q">{e.q}</p>
                <p className="ai-a-line"><Spark />{e.a}</p>
              </div>
            ))}
          </div>
          <p className="ai-staff-note">{t.staff.note}</p>
        </section>

        {/* ---------- kjarasamningar ---------- */}
        <section className="ah-sec ai-split">
          <div className="ai-split-tx">
            <p className="ah-eyebrow">{t.pay.eyebrow}</p>
            <h2>{t.pay.h}<br /><span>{t.pay.hs}</span></h2>
            <p className="ai-p">{t.pay.p}</p>
          </div>
          <ul className="ai-ticks ai-ticks-card">{t.pay.ticks.map((x) => <li key={x}>{x}</li>)}</ul>
        </section>

        {/* ---------- tengd forrit (MCP) ---------- */}
        <section className="ah-sec ai-split ai-rev">
          <div className="ai-split-tx">
            <p className="ah-eyebrow">{t.mcp.eyebrow}</p>
            <h2>{t.mcp.h}<br /><span>{t.mcp.hs}</span></h2>
            <p className="ai-p">{t.mcp.p}</p>
            <ul className="ai-ticks">{t.mcp.ticks.map((x) => <li key={x}>{x}</li>)}</ul>
          </div>
          <div className="ai-card ai-mcp">
            <ol>{t.mcp.steps.map((s, i) => <li key={s}><b>{i + 1}</b><span>{s}</span></li>)}</ol>
          </div>
        </section>

        {/* ---------- öryggi ---------- */}
        <section className="ah-sec ai-safe">
          <div className="ah-head">
            <p className="ah-eyebrow">{t.safe.eyebrow}</p>
            <h2>{t.safe.h}</h2>
          </div>
          <div className="ai-safe-grid">
            {t.safe.items.map((s) => <article key={s.h}><h3>{s.h}</h3><p>{s.p}</p></article>)}
          </div>
        </section>

        {/* ---------- verð ---------- */}
        <section className="ah-sec ai-price">
          <div className="ah-head">
            <p className="ah-eyebrow">{t.price.eyebrow}</p>
            <h2>{t.price.h}</h2>
            <p className="ah-lede">{t.price.p}</p>
          </div>
          <div className="ai-plans">
            {paid.map((p) => (
              <div key={p.id} className="ai-plan-c">
                <h3>{p.name}</h3>
                <p className="ai-plan-p">{nf(p.base)} {t.price.perMonth}</p>
                <p className="ai-plan-q"><b>{nf(p.aiQuestions)}</b> {t.price.questions}</p>
                <p className={`ai-plan-s${PLANS.indexOf(p) >= scheduleFrom ? " on" : ""}`}>{PLANS.indexOf(p) >= scheduleFrom ? <Check /> : null}{t.price.schedule}{PLANS.indexOf(p) >= scheduleFrom ? "" : ` · ${t.price.none}`}</p>
              </div>
            ))}
          </div>
          <p className="ai-price-fine">{t.price.pack(nf(AI_PACK.price), AI_PACK.questions)} {t.price.staff} <a href="/verd">{t.price.link}</a></p>
        </section>

        {/* ---------- spurningar ---------- */}
        <section className="ah-sec ai-faq">
          <h2>{t.faq.h}</h2>
          <div className="ai-faq-l">
            {t.faq.items.map(([q, a]) => <details key={q}><summary>{q}</summary><p>{a}</p></details>)}
          </div>
        </section>

        <section className="ai-final">
          <h2>{t.final.h1}<br /><span>{t.final.h2}</span></h2>
          <a className="ah-btn ah-btn-lg" href="/nyskraning">{t.final.cta}</a>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}
