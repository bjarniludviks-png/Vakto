"use client";

// Léttur prófíll samstarfsmanns úr spjallinu: mynd, nafn, starf, deild, „á vakt“/virkni, næstu vaktir,
// sími (ef viðkomandi leyfir) og hnappar. Engin laun, kennitala eða réttindi — þau eru aðeins hjá stjórnendum.

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { presenceLabel } from "@/lib/presence";
import { getCoworkerProfile, type CoworkerProfile } from "./presence-actions";

const DOW = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const ini = (n: string) => n.split(/\s+/).filter(Boolean).slice(0, 2).map((x) => x[0]).join("").toUpperCase();

export function ProfileModal({ userId, onClose, onMessage }: { userId: string; onClose: () => void; onMessage?: () => void }) {
  const { t } = useLang();
  const [p, setP] = useState<CoworkerProfile | null | undefined>(undefined);
  useEffect(() => { let live = true; getCoworkerProfile(userId).then((r) => { if (live) setP(r); }); return () => { live = false; }; }, [userId]);
  const st = presenceLabel(p?.status);
  return (
    <div className="mwrap show shift-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal shift-sheet cw-profile" role="dialog" aria-modal="true" aria-label={p?.name ?? t("Prófíll")}>
        <div className="mh"><div /><button className="x" onClick={onClose} aria-label={t("Loka")}>✕</button></div>
        <div className="mb">
          {p === undefined ? <p className="muted">{t("Hleð…")}</p> : p === null ? <p className="muted">{t("Prófíll fannst ekki.")}</p> : (
            <>
              <div className="cwp-head">
                <span className="cwp-av">
                  {p.photo
                    // eslint-disable-next-line @next/next/no-img-element
                    ? <img src={p.photo} alt="" />
                    : <span style={{ background: p.color ?? "var(--brand)" }}>{ini(p.name)}</span>}
                  {st.dot && <i className={`pr-dot ${st.tone}`} aria-hidden="true" />}
                </span>
                <div style={{ minWidth: 0 }}>
                  <div className="cwp-name">{p.name}</div>
                  <div className="muted" style={{ fontSize: 13 }}>{[p.title, p.department].filter(Boolean).join(" · ")}</div>
                  {st.text && <div className={`cwp-st ${st.tone}`}>{t(st.text)}</div>}
                </div>
              </div>
              <div className="sf-actions" style={{ marginTop: 14 }}>
                {onMessage && <button className="btn" type="button" onClick={onMessage}>{t("Senda skilaboð")}</button>}
                {p.phone && <a className="btn ghost" href={`tel:${p.phone.replace(/\s/g, "")}`}>{t("Hringja")} · {p.phone}</a>}
              </div>
              <div className="sf-lbl" style={{ marginTop: 16 }}>{t("Næstu vaktir")}</div>
              {p.shifts.length ? (
                <div className="cwp-shifts">
                  {p.shifts.map((s, i) => { const d = new Date(`${s.date}T12:00:00`); return (
                    <div key={i} className="cwp-shift"><b>{t(DOW[d.getDay()])} {d.getDate()}.{d.getMonth() + 1}.</b><span>{s.start}–{s.end}</span></div>
                  ); })}
                </div>
              ) : <p className="muted" style={{ fontSize: 13 }}>{t("Engar birtar vaktir á næstunni.")}</p>}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
