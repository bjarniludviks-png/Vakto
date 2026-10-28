"use client";

import { useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { registerAbsence } from "../starfsfolk/rights-actions";

/** „Hringdi sig inn veikan“: einn smellur skráir veikindi (eða veikindi barns) þennan dag, vaktin verður laus vakt
 *  sem aðrir geta sótt um og stjórnendur fá viðvörun ef veikindarétturinn er að klárast (registerAbsence). */
export function SickOnShift({ employeeId, name, dateISO, onDone }: { employeeId: string; name: string; dateISO: string; onDone: () => void }) {
  const { t: tr } = useLang();
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [free, setFree] = useState(true);
  async function go(type: "veikindi" | "veikindi_barns") {
    setBusy(true);
    const r = await registerAbsence({ employeeId, type, from: dateISO, to: dateISO, freeShifts: free, note: tr("Skráð af vaktaplani") });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? tr("Tókst ekki")); return; }
    toast(r.warning ? `${tr("Veikindi skráð")}. ${r.warning}` : tr("Veikindi skráð"));
    if (free) onDone();
  }
  if (!open) return (
    <button type="button" className="btn ghost sm" style={{ marginBottom: 8 }} onClick={() => setOpen(true)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M12 21s-7-4.4-9.3-9A5 5 0 0 1 12 6a5 5 0 0 1 9.3 6c-2.3 4.6-9.3 9-9.3 9z" /><path d="M12 10v5M9.5 12.5h5" /></svg>
      {tr("Tilkynnti veikindi")}
    </button>
  );
  return (
    <div style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", marginBottom: 10 }}>
      <div style={{ fontWeight: 650, fontSize: 13, marginBottom: 6 }}>{name} {tr("tilkynnti veikindi")}</div>
      <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 12.5, marginBottom: 8, cursor: "pointer" }}>
        <input type="checkbox" checked={free} onChange={(e) => setFree(e.target.checked)} style={{ accentColor: "var(--brand)" }} />
        {tr("Gera vaktina lausa svo aðrir geti sótt um hana")}
      </label>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button type="button" className="btn sm" disabled={busy} onClick={() => go("veikindi")}>{tr("Skrá veikindi")}</button>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => go("veikindi_barns")}>{tr("Veikindi barns")}</button>
        <button type="button" className="btn ghost sm" disabled={busy} onClick={() => setOpen(false)}>{tr("Hætta við")}</button>
      </div>
      <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0" }}>{tr("Telst á móti veikindarétti skv. kjarasamningi. Sést á spjaldi starfsmanns → Frí og í Innsýn.")}</p>
    </div>
  );
}

