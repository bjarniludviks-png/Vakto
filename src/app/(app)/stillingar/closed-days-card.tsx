"use client";

// Stillingar → Staðir → „Lokaðir dagar“ (0107): loka fyrirtækinu eða einum stað á dögum, t.d. jól og gamlársdag.

import { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { DateField } from "@/components/app/fields";
import { isDisplay } from "@/lib/rate-steps";
import type { ClosedDay } from "@/lib/closed-days";
import { listClosedDays, addClosedDays, deleteClosedDays } from "./closed-days-actions";

const FLD: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 8, padding: "6px 9px", font: "inherit", fontSize: 13, background: "var(--panel)" };

export function ClosedDaysCard({ locations }: { locations: { id?: string; name: string }[] }) {
  const { t } = useLang();
  const [days, setDays] = useState<ClosedDay[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [loc, setLoc] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => listClosedDays().then((r) => { setDays(r.days); setErr(r.ok ? null : (r.error ?? null)); }).catch(() => setDays([]));
  useEffect(() => { load(); }, []);
  const locs = locations.filter((l) => l.id);

  async function add() {
    if (!from) { toast(t("Veldu dagsetningu")); return; }
    setBusy(true);
    const r = await addClosedDays({ from, to: to || from, locationId: loc || null, label });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    toast(r.existing ? `${t("Lokað")} · ${r.existing} ${t("vaktir eru þegar á þessum dögum — fjarlægðu þær í vaktaplani ef þær eiga ekki að standa")}` : t("Lokað — ekki er hægt að setja vaktir á þessa daga"));
    setFrom(""); setTo(""); setLabel("");
    load();
  }
  async function remove(id: string) {
    const r = await deleteClosedDays(id);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    setDays((d) => (d ?? []).filter((x) => x.id !== id));
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch"><div><div className="ct">{t("Lokaðir dagar")}</div><div className="cs">{t("t.d. jóladagur og gamlársdagur — engar vaktir verða settar á þessa daga")}</div></div></div>
      <div className="cb">
        {err && <p style={{ fontSize: 12, color: "var(--warn)", margin: "0 0 8px" }}>{err}</p>}
        <div className="att">
          {(days ?? []).map((c) => (
            <div className="it" key={c.id}>
              <div className="ic mut" style={{ background: "var(--line2)" }}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16 }}><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
              </div>
              <div className="tx">
                <b>{c.label || t("Lokað")}</b>
                <span>{isDisplay(c.from)}{c.to !== c.from ? ` – ${isDisplay(c.to)}` : ""} · {c.location ?? t("allir staðir")}</span>
              </div>
              <button type="button" className="btn ghost sm" onClick={() => remove(c.id)}>{t("Opna aftur")}</button>
            </div>
          ))}
          {days?.length === 0 && !err && <p className="muted" style={{ fontSize: 12.5 }}>{t("Engir lokaðir dagar framundan.")}</p>}
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 12 }}>
          <DateField value={from} onChange={(v) => { setFrom(v); if (!to || to < v) setTo(v); }} />
          <span className="muted" style={{ fontSize: 12 }}>{t("til")}</span>
          <DateField value={to} onChange={setTo} min={from || undefined} />
          {locs.length > 1 && (
            <select value={loc} onChange={(e) => setLoc(e.target.value)} style={FLD} aria-label={t("Staður")}>
              <option value="">{t("Allir staðir")}</option>
              {locs.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}
            </select>
          )}
          <input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={t("Heiti, t.d. Jól")} maxLength={80} style={{ ...FLD, width: 150 }} />
          <button type="button" className="btn sm" disabled={busy} onClick={add}>{t("Loka")}</button>
        </div>
      </div>
    </div>
  );
}
