"use client";

// Verðsíðan /verd (IS/EN, texti í pricing-text.ts). Allar tölur koma úr src/lib/plans.ts (sama skrá
// og reikningagerðin les), svo síðan, reiknivélin og reikningarnir geta aldrei farið úr takti.
import { useMemo, useState } from "react";
import AhFooter from "./ah-footer";
import SiteNav from "./site-nav";
import { useSiteLang, type SiteLang } from "./lang";
import { Glow } from "./home-client";
import { PRICING_TEXT } from "./pricing-text";
import { nf } from "@/lib/format";
import {
  AI_PACK, ANNUAL_DISCOUNT, ESIGN_PRICE, PLANS, QUOTE_ABOVE_EMPLOYEES,
  annualMonthly, cheapestPlan, planCost, type Plan,
} from "@/lib/plans";

const HOT = "voxtur";
const EMP_MAX = QUOTE_ABOVE_EMPLOYEES;
const AI_MAX = 500;

/** Þúsundaskil eftir tungumáli: 9.990 / 9,990. */
const num = (lang: SiteLang, n: number) => (lang === "en" ? nf(n).replace(/\./g, ",") : nf(n));
const moneyFor = (lang: SiteLang) => (n: number) => (lang === "en" ? `ISK ${num(lang, n)}` : `${num(lang, n)} kr`);

/** Fyrsti starfsmannafjöldi þar sem leiðin `id` verður ódýrust (án AI). */
function crossover(id: Plan["id"]) {
  for (let n = 1; n <= EMP_MAX; n++) if (cheapestPlan(n).plan.id === id) return n;
  return EMP_MAX;
}

const Check = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>;
const Dash = () => <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7 12h10" /></svg>;

export default function PricingClient() {
  const lang = useSiteLang();
  const t = PRICING_TEXT[lang];
  const m = moneyFor(lang);
  const [yearly, setYearly] = useState(false);
  const [emp, setEmp] = useState(14);
  const [ai, setAi] = useState(20);
  const price = (n: number) => (yearly ? annualMonthly(n) : n);
  const [toVoxtur, toRekstur] = useMemo(() => [crossover("voxtur"), crossover("rekstur")], []);

  const best = cheapestPlan(emp, ai, yearly);
  const all = PLANS.map((p) => ({ p, c: planCost(p, emp, ai, yearly) }));
  const extras = PLANS.map((p) => p.extraPerEmployee).filter((x): x is number => x !== null);

  return (
    <div className="ah ah-verd">
      <a className="ah-skip" href="#efni">{t.skip}</a>
      <Glow />
      <SiteNav current="price" />
      <main id="efni">
        {/* ---------- Hetja ---------- */}
        <section className="vp-hero">
          <p className="ah-eyebrow">{t.eyebrow}</p>
          <h1>{t.h1a}<br /><span>{t.h1b}</span></h1>
          <p className="ah-lede">{t.lede}</p>
          <div className="vp-toggle" role="group" aria-label={t.billing}>
            <button type="button" aria-pressed={!yearly} onClick={() => setYearly(false)}>{t.monthly}</button>
            <button type="button" aria-pressed={yearly} onClick={() => setYearly(true)}>{t.yearly} <span className="vp-save">{t.save}</span></button>
          </div>
        </section>

        {/* ---------- Leiðirnar fjórar ---------- */}
        <section className="vp-plans" aria-label={t.eyebrow}>
          {PLANS.map((p) => {
            const c = t.plans[p.id];
            const hot = p.id === HOT;
            return (
              <article key={p.id} className={`vp-plan${hot ? " hot" : ""}`}>
                <h2>{c.name}{hot && <span className="vp-badge">{t.popular}</span>}</h2>
                <p className="vp-for">{c.for}</p>
                <div className="vp-amt"><b>{num(lang, price(p.base))}</b><span>{t.perMo}</span></div>
                <p className="vp-inc">{c.inc(m, p.included, price(p.extraPerEmployee ?? 0))}</p>
                <p className="vp-yr">{yearly && p.base > 0 ? t.yearlyNote(m, price(p.base) * 12) : t.vat}</p>
                <a className={`ah-btn vp-btn${hot ? "" : " vp-btn-2"}`} href={c.href}>{c.btn}</a>
                <ul className="vp-fl">
                  {c.f.map(([label, ok]) => ok === 2
                    ? <li key={label} className="vp-lead">{label}</li>
                    : <li key={label} className={ok ? "" : "x"}>{ok ? <Check /> : <Dash />}<span>{label}<span className="vp-sr">{ok ? "" : ` (${t.no})`}</span></span></li>)}
                  {p.aiQuestions > 0 && <li><Check /><span>{t.aiLine(p.aiQuestions)}</span></li>}
                </ul>
              </article>
            );
          })}
        </section>
        <div className="vp-under">
          {t.under.map((x) => <p key={x}>{x}</p>)}
          <p><b>{t.quote(QUOTE_ABOVE_EMPLOYEES)}</b> <a href="mailto:hallo@vakto.is?subject=VAKTO%20tilbo%C3%B0">{t.quoteGo} →</a></p>
        </div>

        {/* ---------- Reiknivél ---------- */}
        <section className="ah-sec vp-sec" aria-labelledby="vp-calc-h">
          <div className="ah-head">
            <h2 id="vp-calc-h">{t.calcH}</h2>
            <p className="ah-lede">{t.calcP}</p>
          </div>
          <div className="vp-calc">
            <div className="vp-box">
              <label className="vp-range">
                <span className="vp-rl">{t.empL}<output>{emp}{emp === EMP_MAX ? "+" : ""}</output></span>
                <input type="range" min={1} max={EMP_MAX} value={emp} onChange={(e) => setEmp(+e.target.value)} />
              </label>
              <label className="vp-range">
                <span className="vp-rl">{t.aiL}<output>{ai}</output></span>
                <input type="range" min={0} max={AI_MAX} step={5} value={ai} onChange={(e) => setAi(+e.target.value)} />
              </label>
              <p className="vp-hint">{t.aiHint}</p>
              <div className="vp-all">
                {all.map(({ p, c }) => (
                  <div key={p.id} className={`vp-all-row${c && p.id === best.plan.id ? " on" : ""}${c ? "" : " off"}`}>
                    <span>{t.plans[p.id].name}</span>
                    <span>{c ? m(c.total) : "—"}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="vp-res" aria-live="polite">
              <div className="vp-k">{t.yourPlan}</div>
              <div className="vp-res-plan">{t.plans[best.plan.id].name}</div>
              <div className="vp-res-tot">{m(best.total)}</div>
              <div className="vp-k">{t.perMonth}{emp > 1 && best.total > 0 ? ` · ${t.perEmp(m(best.total / emp))}` : ""}</div>
              <ul className="vp-res-list">
                <li><span>{t.rowBase(t.plans[best.plan.id].name, yearly)}</span><span>{m(best.base)}</span></li>
                {best.extraEmployees > 0 && <li><span>{t.rowExtra(best.extraEmployees, m, price(best.plan.extraPerEmployee ?? 0))}</span><span>{m(best.extra)}</span></li>}
                {best.aiPacks > 0 && <li><span>{t.rowAi(best.aiPacks)}</span><span>{m(best.ai)}</span></li>}
              </ul>
              {best.plan.id === "free" && <p className="vp-res-note">{t.freeNote}</p>}
              {emp >= EMP_MAX && <p className="vp-res-note">{t.overQuote(EMP_MAX)}</p>}
              <a className="ah-btn vp-res-btn" href={t.plans[best.plan.id].href}>{t.plans[best.plan.id].btn}</a>
            </div>
          </div>
          <p className="vp-cross"><b>{t.crossH}</b> {t.cross(toVoxtur, toRekstur)}</p>
        </section>

        {/* ---------- Viðbætur ---------- */}
        <section className="ah-sec vp-sec" aria-labelledby="vp-add-h">
          <div className="ah-head">
            <h2 id="vp-add-h">{t.addH}</h2>
            <p className="ah-lede">{t.addP}</p>
          </div>
          <div className="vp-adds">
            <div className="vp-add">
              <span className="vp-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5" /><path d="M18 8v6M15 11h6" /></svg></span>
              <h3>{t.adds.emp.h}</h3><div className="vp-add-p">{t.adds.emp.p(m, price(Math.min(...extras)))}</div><p>{t.adds.emp.d}</p>
            </div>
            <div className="vp-add">
              <span className="vp-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9.5l-4.7 1.8L12 16l-1.8-4.7L5.5 9.5l4.7-1.8z" /><path d="M19 15l.8 2.2L22 18l-2.2.8L19 21l-.8-2.2L16 18l2.2-.8z" /></svg></span>
              <h3>{t.adds.ai.h}</h3><div className="vp-add-p">{t.adds.ai.p(m, AI_PACK.price)}</div><p>{t.adds.ai.d(AI_PACK.questions)}</p>
            </div>
            <div className="vp-add">
              <span className="vp-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="3" width="16" height="18" rx="2.5" /><path d="M8 8h8M8 12h5" /><path d="M8 17c1.5-1.5 2.5 1 4-.5s2 .5 3.5 0" /></svg></span>
              <h3>{t.adds.sign.h}</h3><div className="vp-add-p">{t.adds.sign.p(m, ESIGN_PRICE)}</div><p>{t.adds.sign.d}</p>
            </div>
            <div className="vp-add">
              <span className="vp-ico"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3.5" y="5" width="17" height="15" rx="2.5" /><path d="M3.5 10h17M8 3v4M16 3v4" /></svg></span>
              <h3>{t.adds.year.h}</h3><div className="vp-add-p">−{Math.round(ANNUAL_DISCOUNT * 100)}%</div><p>{t.adds.year.d}</p>
            </div>
          </div>
        </section>

        {/* ---------- Samanburður ---------- */}
        <section className="ah-sec vp-sec" aria-labelledby="vp-cmp-h">
          <div className="ah-head">
            <h2 id="vp-cmp-h">{t.cmpH}</h2>
          </div>
          <p className="vp-cmp-hint">{t.cmpHint}</p>
          <div className="vp-cmp" role="region" aria-labelledby="vp-cmp-h" tabIndex={0}>
            <table>
              <thead>
                <tr><th scope="col"><span className="vp-sr">{t.cmpH}</span></th>{PLANS.map((p) => <th scope="col" key={p.id} className={p.id === HOT ? "hot" : ""}>{t.plans[p.id].name}</th>)}</tr>
              </thead>
              {t.cmp.map((grp) => (
                <tbody key={grp.g}>
                  <tr className="vp-grp"><th scope="colgroup" colSpan={5}>{grp.g}</th></tr>
                  {grp.rows === "price" ? (
                    <>
                      <tr><th scope="row">{t.cmpBase}</th>{PLANS.map((p) => <td key={p.id} className={p.id === HOT ? "hot" : ""}><b>{p.base ? m(price(p.base)) : t.cmpFree}</b></td>)}</tr>
                      <tr><th scope="row">{t.cmpInc}</th>{PLANS.map((p) => <td key={p.id} className={p.id === HOT ? "hot" : ""}><b>{p.extraPerEmployee === null ? t.cmpMax(p.included) : p.included}</b></td>)}</tr>
                      <tr><th scope="row">{t.cmpExtra}</th>{PLANS.map((p) => <td key={p.id} className={p.id === HOT ? "hot" : ""}>{p.extraPerEmployee === null ? <span className="vp-mut">{t.cmpNone}</span> : <b>{m(price(p.extraPerEmployee))}</b>}</td>)}</tr>
                      <tr><th scope="row">{t.cmpAi}</th>{PLANS.map((p) => <td key={p.id} className={p.id === HOT ? "hot" : ""}>{p.aiQuestions ? <b>{p.aiQuestions}</b> : <Cell v={0} t={t} />}</td>)}</tr>
                    </>
                  ) : grp.rows.map(([label, ...vals]) => (
                    <tr key={label}><th scope="row">{label}</th>{vals.map((v, i) => <td key={i} className={PLANS[i].id === HOT ? "hot" : ""}><Cell v={v} t={t} /></td>)}</tr>
                  ))}
                </tbody>
              ))}
            </table>
          </div>
        </section>

        {/* ---------- Spurningar ---------- */}
        <section className="ah-sec vp-sec" aria-labelledby="vp-faq-h">
          <div className="ah-head">
            <h2 id="vp-faq-h">{t.faqH}</h2>
          </div>
          <div className="vp-faq">
            {t.faq(m).map(([q, a], i) => (
              <details key={q} open={i === 0}>
                <summary>{q}</summary>
                <p>{a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ---------- Lokaákall ---------- */}
        <section className="vp-end">
          <h2>{t.endH}</h2>
          <p>{t.endP}</p>
          <a className="ah-btn ah-btn-lg" href="/nyskraning?plan=free">{t.endBtn}</a>
          <p className="vp-end-or">{t.endOr}<a href="mailto:hallo@vakto.is">hallo@vakto.is</a></p>
          <p className="vp-fine">{t.fine}</p>
        </section>
      </main>
      <AhFooter />
    </div>
  );
}

function Cell({ v, t }: { v: 0 | 1 | string; t: { yes: string; no: string } }) {
  if (v === 1) return <span className="vp-y" role="img" aria-label={t.yes}><Check /></span>;
  if (v === 0) return <span className="vp-n" role="img" aria-label={t.no}><Dash /></span>;
  return <b>{v}</b>;
}
