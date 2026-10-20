"use client";

// Forsíða: „Hey VAKTO" (dæmi um hvað VAKTO AI gerir í raun — sjá assistant-tools.ts) og
// „Fáðu kynningu á vinnustaðinn" (beiðni í tölvupósti, /api/kynning).
// Myndbandið (public/showcase/forsida/video/ai[-en].mp4, scripts/video-forsida-ai.mjs) birtist ef skráin er til;
// annars skjámynd af AI-tillögu (light/ai.jpg, scripts/shots-forsida-ai.mjs).

import { useEffect, useRef, useState, type FormEvent } from "react";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/turnstile";
import { useSiteLang } from "./lang";
import { HOME_TEXT } from "./home-text";

const SHOT = "/showcase/forsida";
const VIDEO = `${SHOT}/video`;

function Spark() {
  // Sama neistatákn og VAKTO AI-hnappurinn í kerfinu.
  return <svg className="ah-spark" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l1.8 4.7L18.5 9l-4.7 1.8L12 15.5l-1.8-4.7L5.5 9l4.7-1.3Z" /><path d="M18.5 15l.8 2 2 .8-2 .8-.8 2-.8-2-2-.8 2-.8Z" /></svg>;
}

/** Spilar aðeins þegar skráin er til og myndbandið sést; annars skjámynd af tillögu VAKTO AI. */
function AiVideo({ alt, shotAlt }: { alt: string; shotAlt: string }) {
  const lang = useSiteLang();
  const src = `${VIDEO}/ai${lang === "en" ? "-en" : ""}`;
  const [found, setFound] = useState<string | null>(null); // slóðin sem reyndist til
  const ok = found === src;
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    let live = true;
    fetch(`${src}.mp4`, { method: "HEAD" }).then((r) => { if (live && r.ok && (r.headers.get("content-type") ?? "").startsWith("video")) setFound(src); }).catch(() => {});
    return () => { live = false; };
  }, [src]);
  useEffect(() => {
    const el = v.current; if (!el || !ok) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { el.pause(); el.controls = true; return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) el.play().catch(() => {}); else el.pause(); }, { threshold: 0.25 });
    io.observe(el);
    return () => io.disconnect();
  }, [ok]);
  if (!ok) return (
    <div className="ah-hey-shot">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={`${SHOT}${lang === "en" ? "/en" : ""}/light/ai.jpg`} alt={shotAlt} width={1209} height={1656} loading="lazy" decoding="async" draggable={false} />
    </div>
  );
  return (
    <div className="ah-hey-vid">
      <div className="ah-mac">
        <div className="ah-mac-bar"><span className="ah-dots"><i /><i /><i /></span><span className="ah-url" aria-hidden="true">vakto.is/vaktaplan</span></div>
        <div className="ah-mac-view">
          <video ref={v} src={`${src}.mp4`} poster={`${src}.jpg`} muted loop playsInline preload="metadata" aria-label={alt} width={1920} height={1200} />
        </div>
      </div>
    </div>
  );
}

export function HeyVakto() {
  const t = HOME_TEXT[useSiteLang()].hey;
  return (
    <section className="ah-sec ah-hey" id="vakto-ai">
      <div className="ah-head">
        <p className="ah-eyebrow ah-hey-eb"><Spark />{t.eyebrow}</p>
        <h2>{t.h}</h2>
        <p className="ah-lede">{t.lede}</p>
      </div>
      <AiVideo alt={t.videoAlt} shotAlt={t.shotAlt} />
      <div className="ah-hey-grid">
        {t.groups.map((g) => (
          <div className="ah-hey-col" key={g.h}>
            <h3>{g.h}</h3>
            <ul>
              {g.items.map((it) => (
                <li key={it.q}>
                  <p className="ah-hey-q"><span>{t.pre}</span> {it.q}</p>
                  <p className="ah-hey-a"><Spark />{it.a}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="ah-hey-foot">
        <p className="ah-hey-ok">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z" /><path d="M8.8 12.2l2.2 2.2 4.2-4.4" /></svg>
          <span><b>{t.confirmB}</b>{t.confirm}</span>
        </p>
        <p className="ah-hey-who">{t.who}</p>
      </div>
    </section>
  );
}

export function VisitRequest() {
  const lang = useSiteLang();
  const t = HOME_TEXT[lang].visit;
  const [f, setF] = useState({ name: "", company: "", contact: "", message: "", website: "" });
  const [token, setToken] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const set = (k: keyof typeof f) => (e: { target: { value: string } }) => setF((x) => ({ ...x, [k]: e.target.value }));
  async function submit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    if (TURNSTILE_SITE_KEY && !token) { setErr(t.bot); return; }
    setBusy(true);
    try {
      const r = await fetch("/api/kynning", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...f, token, lang }) });
      const j = (await r.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (j.ok) setDone(true); else setErr(j.error ?? t.err);
    } catch { setErr(t.err); }
    setBusy(false);
  }
  return (
    <section className="ah-sec ah-visit" id="kynning-a-stadnum">
      <div className="ah-visit-card">
        <div className="ah-visit-tx">
          <h2>{t.h}</h2>
          <p className="ah-lede">{t.p}</p>
        </div>
        {done ? (
          <div className="ah-visit-ok" role="status">
            <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9.5" /><path d="M7.8 12.3l2.9 2.9 5.5-5.6" /></svg>
            <div><b>{t.okH}</b><p>{t.ok}</p></div>
          </div>
        ) : (
          <form className="ah-visit-f" onSubmit={submit}>
            <label><span>{t.name}</span><input value={f.name} onChange={set("name")} autoComplete="name" required maxLength={120} /></label>
            <label><span>{t.company}</span><input value={f.company} onChange={set("company")} autoComplete="organization" required maxLength={160} /></label>
            <label className="ah-visit-w"><span>{t.contact}</span><input value={f.contact} onChange={set("contact")} autoComplete="email" inputMode="email" required maxLength={160} /></label>
            <label className="ah-visit-w"><span>{t.message}</span><textarea value={f.message} onChange={set("message")} rows={3} maxLength={2000} placeholder={t.messagePh} /></label>
            <input className="ah-visit-hp" tabIndex={-1} autoComplete="off" aria-hidden="true" value={f.website} onChange={set("website")} name="website" />
            <div className="ah-visit-w"><Turnstile onToken={setToken} /></div>
            {err && <p className="ah-visit-err ah-visit-w" role="alert">{err}</p>}
            <div className="ah-visit-w"><button className="ah-btn" type="submit" disabled={busy}>{busy ? t.sending : t.send}</button></div>
          </form>
        )}
      </div>
    </section>
  );
}
