"use client";

// „Biðja um leiðréttingu“: breytanleg skilaboð til starfsmanns (beint spjall + tilkynning sem opnar
// leiðréttingarformið með deginum). Notað á síðu starfsmanns og í yfirferð frávika.

import { useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { askForCorrection } from "./actions";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };

export function AskCorrectionModal({ employeeId, first, date, detail, onClose, onSent }: { employeeId: string; first: string; date: string; detail: string; onClose: () => void; onSent?: () => void }) {
  const { t } = useLang();
  const [msg, setMsg] = useState(`${t("Hæ")} ${first}, ${t("það vantar réttan tíma fyrir")} ${niceISO(date)} (${detail}). ${t("Viltu senda leiðréttingu í VAKTO — Tímar → Biðja um leiðréttingu? Takk!")}`);
  const [busy, setBusy] = useState(false);
  async function send() {
    setBusy(true);
    const res = await askForCorrection({ employeeId, date, message: msg });
    setBusy(false);
    if (res.ok) { toast(t("Beiðni send — starfsmaðurinn fær tilkynningu og skilaboð")); onSent?.(); onClose(); } else toast(res.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Biðja um leiðréttingu")}</div><div className="muted" style={{ fontSize: 12 }}>{t("Fer sem skilaboð í spjalli og tilkynning sem opnar leiðréttingarformið")}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <textarea value={msg} onChange={(e) => setMsg(e.target.value)} rows={5} style={{ width: "100%", font: "inherit", padding: 12, borderRadius: 12, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", resize: "vertical" }} />
          <div style={{ display: "flex", gap: 9, marginTop: 10 }}>
            <button className="btn" disabled={busy || !msg.trim()} onClick={send}>{busy ? t("Sendi…") : t("Senda")}</button>
            <button className="btn ghost" disabled={busy} onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
