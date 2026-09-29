"use client";

// Velkomin-kynning fyrir starfsmann: birtist einu sinni við fyrstu innskráningu í Mitt svæði
// (localStorage), þrjú stutt skref um það sem skiptir máli fyrsta daginn.

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";

const KEY = "vakto-welcome-v1";

const SLIDES = [
  { icon: "M12 7v5l3 2|M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z", title: "Stimplaðu þig inn", body: "Ýttu á „Stimpla mig inn“ þegar þú mætir og „Stimpla mig út“ þegar þú ferð. Þannig færðu rétt greitt fyrir hverja mínútu." },
  { icon: "M3 9h18|M8 3v4|M16 3v4|M5 5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z", title: "Vaktirnar þínar", body: "Undir „Planið“ sérðu þínar vaktir og hverjir vinna með þér. Þú getur sett vaktirnar í dagatal símans með einum smelli." },
  { icon: "M4 12h16|M14 6l6 6-6 6", title: "Frí og vaktaskipti", body: "Biddu um frí eða vaktaskipti hér í Mitt svæði. Þú sérð orlofsstöðuna þína og vaktstjórinn fær tilkynningu strax." },
];

export function WelcomeTour({ firstName }: { firstName?: string }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  useEffect(() => {
    try { if (!localStorage.getItem(KEY)) requestAnimationFrame(() => setOpen(true)); } catch { /* private mode */ }
  }, []);
  if (!open) return null;
  const close = () => { setOpen(false); try { localStorage.setItem(KEY, "1"); } catch { /* ignore */ } };
  const s = SLIDES[i];
  const last = i === SLIDES.length - 1;
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && close()}>
      <div className="mbg" onClick={close} />
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="welcome-title" style={{ maxWidth: 440 }}>
        <div className="mb" style={{ padding: "26px 26px 22px" }}>
          {i === 0 && <div style={{ fontSize: 13, color: "var(--ink3)", marginBottom: 14 }}>{t("Velkomin/n í VAKTO")}{firstName ? `, ${firstName}` : ""}</div>}
          <div style={{ width: 46, height: 46, borderRadius: 12, background: "var(--brand-soft)", color: "var(--brand)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 14 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              {s.icon.split("|").map((d) => <path key={d} d={d} />)}
            </svg>
          </div>
          <div id="welcome-title" style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-0.01em" }}>{t(s.title)}</div>
          <p style={{ fontSize: 14, lineHeight: 1.55, color: "var(--ink2)", margin: "8px 0 20px" }}>{t(s.body)}</p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 10 }}>
            <div style={{ display: "flex", gap: 6 }} aria-hidden="true">
              {SLIDES.map((_, j) => <span key={j} style={{ width: j === i ? 18 : 6, height: 6, borderRadius: 99, background: j === i ? "var(--brand)" : "var(--line)", transition: "width .2s ease" }} />)}
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {!last && <button type="button" className="btn ghost sm" onClick={close}>{t("Sleppa")}</button>}
              <button type="button" className="btn sm" onClick={() => (last ? close() : setI(i + 1))}>{last ? t("Byrja") : t("Næsta")}</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
