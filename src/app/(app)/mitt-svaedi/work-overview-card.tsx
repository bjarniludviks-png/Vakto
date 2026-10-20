"use client";

// Mitt svæði — vinnuyfirlitin mín: skoða, staðfesta eða gera athugasemd; sækja PDF þegar lokið.
// Sést aðeins ef yfirlit er til (og ekkert ef 0084 hefur ekki verið keyrð).

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { AsyncButton } from "@/components/app/async-button";
import { WorkOverviewView, WoStatusPill } from "@/components/app/work-overview-view";
import { dec1 } from "@/lib/format";
import type { WoRow } from "@/lib/work-overview";
import { getMyWorkOverviews, respondToWorkOverview, workOverviewPdfUrl } from "../timaskraning/vinnuyfirlit/actions";

const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}.${m}.${y}`; };

export function WorkOverviewCard() {
  const { t } = useLang();
  const [rows, setRows] = useState<WoRow[]>([]);
  const [open, setOpen] = useState<WoRow | null>(null);
  const load = () => getMyWorkOverviews().then((r) => setRows(r.rows)).catch(() => {});
  useEffect(() => { load(); }, []);
  if (!rows.length) return null;
  const waiting = rows.filter((r) => r.status === "sent").length;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch"><div>
        <div className="ct">{t("Vinnuyfirlit")}</div>
        <div className="cs">{waiting ? `${waiting} ${t("bíður staðfestingar þinnar")}` : t("tímar og launaliðir hvers tímabils")}</div>
      </div></div>
      <div className="cb att">
        {rows.slice(0, 6).map((r) => (
          <div className="it rowlink" key={r.id} onClick={() => setOpen(r)}>
            <div className={`ic ${r.status === "sent" ? "warn" : "info"}`}><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M14 3H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z" /><path d="M14 3v6h6M9 14l2 2 4-4" /></svg></div>
            <div className="tx"><b>{niceISO(r.from)} – {niceISO(r.to)}</b><span>{dec1(r.snapshot.totals.worked)} {t("klst unnið")}</span></div>
            <WoStatusPill status={r.status} />
          </div>
        ))}
      </div>
      {open && <MyOverviewModal row={open} onClose={() => setOpen(null)} onDone={() => { setOpen(null); load(); }} />}
    </div>
  );
}

function MyOverviewModal({ row, onClose, onDone }: { row: WoRow; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [flag, setFlag] = useState(false);
  const [note, setNote] = useState("");
  async function respond(approve: boolean) {
    const r = await respondToWorkOverview(row.id, approve, note);
    if (!r.ok) { toast(r.error ?? t("Villa"), "error"); return; }
    toast(approve ? t("Takk — yfirlitið er staðfest") : t("Athugasemd send til stjórnanda"));
    onDone();
  }
  async function pdf() {
    const r = await workOverviewPdfUrl(row.id);
    if (r.ok && r.url) window.open(r.url, "_blank"); else toast(r.error ?? t("Villa"), "error");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal wo-modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Vinnuyfirlit")}</div><div className="muted" style={{ fontSize: 12 }}>{niceISO(row.from)} – {niceISO(row.to)} · <WoStatusPill status={row.status} /></div></div>
          <button className="x" aria-label={t("Loka")} onClick={onClose}><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 6l12 12M18 6L6 18" /></svg></button>
        </div>
        <div className="mb">
          {row.status === "sent" && <p className="muted" style={{ fontSize: 12.5, marginTop: 0 }}>{t("Farðu yfir dagana og tímana. Ef allt passar, staðfestu. Annars skrifaðu athugasemd og stjórnandi fer yfir hana.")}</p>}
          {row.employeeComment && <div className="wo-note"><b>{t("Athugasemdin þín")}</b><p>„{row.employeeComment}“</p></div>}
          <WorkOverviewView row={row} />
          {row.status === "sent" && flag && (
            <div className="field" style={{ marginTop: 14 }}>
              <label>{t("Athugasemd")}</label>
              <textarea className="lf-ta" rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("T.d. vantar vakt 14.10. kl. 17–22")} />
            </div>
          )}
          <div style={{ display: "flex", gap: 9, marginTop: 16, flexWrap: "wrap" }}>
            {row.status === "sent" && !flag && <AsyncButton className="btn" onClick={() => respond(true)}>{t("Staðfesta")}</AsyncButton>}
            {row.status === "sent" && !flag && <button className="btn ghost" onClick={() => setFlag(true)}>{t("Athugasemd")}</button>}
            {row.status === "sent" && flag && <AsyncButton className="btn" disabled={!note.trim()} onClick={() => respond(false)}>{t("Senda athugasemd")}</AsyncButton>}
            {row.status === "final" && <AsyncButton className="btn" onClick={pdf}>{t("Sækja PDF")}</AsyncButton>}
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
