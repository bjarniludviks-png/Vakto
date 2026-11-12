"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { Spark } from "@/components/app/assistant-chat";

import { GUIDES, FAQ, AI_EXAMPLES, tx } from "@/lib/help-guides";
const ic = (d: string) => <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9">{d.split("|").map((p, i) => <path key={i} d={p} />)}</svg>;

/** Opnar VAKTO AI-gluggann (assistant-panel.tsx hlustar), valfrjálst með spurningu. */
const askAi = (q?: string) => window.dispatchEvent(new CustomEvent("vakto-ai:open", { detail: { q } }));

export default function HelpScreen() {
  const { lang } = useLang();
  // VAKTO AI er aðeins fyrir stjórnendur og vaktstjóra; glugginn merkir <html data-vakto-ai> þegar hann er til.
  const [hasAi, setHasAi] = useState(false);
  useEffect(() => { const t = setTimeout(() => setHasAi(document.documentElement.dataset.vaktoAi === "1"), 0); return () => clearTimeout(t); }, []);
  const [aiQ, setAiQ] = useState("");
  const [active, setActive] = useState(GUIDES[0].id);
  const [q, setQ] = useState("");
  const norm = (sr: string) => sr.toLowerCase();
  const list = q ? GUIDES.filter((g) => norm(tx(lang, g.title) + tx(lang, g.intro) + g.steps.map((s) => tx(lang, s)).join(" ")).includes(norm(q))) : GUIDES;
  const g = GUIDES.find((x) => x.id === active) ?? GUIDES[0];

  return (
    <>
      <PageHeader title="Hjálp" subtitle={tx(lang, { is: "Leiðbeiningar með skjáskotum, skref fyrir skref", en: "Step-by-step guides with screenshots", pl: "Instrukcje krok po kroku ze zrzutami ekranu" })} />
      <div className="emp-layout">
        <aside className="emp-side">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={tx(lang, { is: "Leita í hjálp…", en: "Search help…", pl: "Szukaj w pomocy…" })}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "8px 11px", font: "inherit", fontSize: 13, background: "var(--panel)", color: "var(--ink)" }} />
          <select className="emp-navsel" value={active} onChange={(e) => setActive(e.target.value)}>
            {GUIDES.map((guide) => (
              <option key={guide.id} value={guide.id}>{tx(lang, guide.title)}</option>
            ))}
          </select>
          <nav className="emp-nav">
            {list.map((guide) => (
              <button key={guide.id} className={`emp-navi${guide.id === active ? " on" : ""}`} onClick={() => setActive(guide.id)}>{ic(guide.icon)}<span>{tx(lang, guide.title)}</span></button>
            ))}
            {!list.length && <div className="muted" style={{ fontSize: 12.5, padding: "8px 12px" }}>{tx(lang, { is: "Ekkert fannst.", en: "No matches.", pl: "Brak wyników." })}</div>}
          </nav>
        </aside>

        <main className="emp-main" style={{ maxWidth: 780 }}>
          {hasAi && (
            <div className="card" style={{ marginBottom: 16, borderColor: "var(--brand-soft)" }}>
              <div className="cb">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span className="vai-badge"><Spark /></span>
                  <div>
                    <b style={{ fontSize: 15 }}>{tx(lang, { is: "Spurðu VAKTO AI", en: "Ask VAKTO AI", pl: "Zapytaj VAKTO AI" })}</b>
                    <div className="muted" style={{ fontSize: 13 }}>{tx(lang, { is: "Hann kann á kerfið og þekkir tölurnar ykkar. Spurðu hvernig á að gera hlutina eða biddu hann að gera þá.", en: "It knows the system and your numbers. Ask how to do things, or ask it to do them.", pl: "Zna system i Wasze liczby. Zapytaj, jak coś zrobić, albo poproś, żeby to zrobił." })}</div>
                  </div>
                </div>
                <form onSubmit={(e) => { e.preventDefault(); askAi(aiQ); setAiQ(""); }} style={{ display: "flex", gap: 8, marginTop: 12 }}>
                  <input value={aiQ} onChange={(e) => setAiQ(e.target.value)} placeholder={tx(lang, { is: "T.d. hvernig breyti ég launatímabilinu?", en: "E.g. how do I change the pay period?", pl: "Np. jak zmienić okres rozliczeniowy?" })}
                    style={{ flex: 1, minWidth: 0, border: "1px solid var(--line)", borderRadius: 10, padding: "9px 12px", font: "inherit", fontSize: 13.5, background: "var(--panel)", color: "var(--ink)" }} />
                  <button className="btn" type="submit">{tx(lang, { is: "Spyrja", en: "Ask", pl: "Zapytaj" })}</button>
                </form>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
                  {AI_EXAMPLES.map((ex, i) => <button key={i} type="button" className="btn ghost sm" onClick={() => askAi(tx(lang, ex))}>{tx(lang, ex)}</button>)}
                </div>
              </div>
            </div>
          )}
          <div className="card">
            <div className="cb">
              <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-.02em" }}>{tx(lang, g.title)}</h2>
              <p className="muted" style={{ fontSize: 14, lineHeight: 1.55, margin: "6px 0 0" }}>{tx(lang, g.intro)}</p>
              {g.img ? (
                <div className="help-shot">
                  <Image src={g.img} alt={tx(lang, g.title)} width={1280} height={800} style={{ width: "100%", height: "auto" }} />
                </div>
              ) : null}
              <ol className="help-steps">
                {g.steps.map((s, i) => (
                  <li key={i}><span className="n">{i + 1}</span><span>{tx(lang, s)}</span></li>
                ))}
              </ol>
              {hasAi && (
                <button type="button" className="btn ghost sm" style={{ marginTop: 14 }} onClick={() => askAi(tx(lang, { is: `Útskýrðu „${g.title.is}“ í VAKTO fyrir mér, skref fyrir skref.`, en: `Explain "${g.title.en}" in VAKTO to me, step by step.`, pl: `Wyjaśnij mi krok po kroku „${g.title.pl ?? g.title.en}” w VAKTO.` }))}>
                  <span className="vai-badge" style={{ width: 20, height: 20, borderRadius: 6 }}><Spark /></span>
                  {tx(lang, { is: "Spyrja VAKTO AI um þetta", en: "Ask VAKTO AI about this", pl: "Zapytaj VAKTO AI o to" })}
                </button>
              )}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ch"><div className="ct">{tx(lang, { is: "Algengar spurningar", en: "FAQ", pl: "Najczęstsze pytania" })}</div></div>
            <div className="cb">
              {FAQ.map((f, i) => (
                <details key={i} style={{ borderBottom: "1px solid var(--line2)", padding: "12px 0" }}>
                  <summary style={{ cursor: "pointer", fontWeight: 600, fontSize: 14 }}>{tx(lang, f.q)}</summary>
                  <p className="muted" style={{ fontSize: 13.5, marginTop: 8, lineHeight: 1.55 }}>{tx(lang, f.a)}</p>
                </details>
              ))}
            </div>
          </div>

          <div className="card" style={{ marginTop: 16 }}>
            <div className="ch"><div className="ct">{tx(lang, { is: "Þarftu meiri aðstoð?", en: "Need more help?", pl: "Potrzebujesz więcej pomocy?" })}</div></div>
            <div className="cb att">
              <a className="it rowlink" href="mailto:hjalp@vakto.is">
                <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m3 7 9 6 9-6" /></svg></div>
                <div className="tx"><b>hjalp@vakto.is</b><span>{tx(lang, { is: "sendu okkur línu — við svörum samdægurs", en: "email us — same-day reply", pl: "napisz do nas — odpowiadamy tego samego dnia" })}</span></div>
              </a>
              <div className="it">
                <div className="ic good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg></div>
                <div className="tx"><b>{tx(lang, { is: "Spjall við aðstoð", en: "Live chat", pl: "Czat z pomocą" })}</b><span>{tx(lang, { is: "neðst í hægra horni", en: "bottom-right corner", pl: "w prawym dolnym rogu" })}</span></div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </>
  );
}
