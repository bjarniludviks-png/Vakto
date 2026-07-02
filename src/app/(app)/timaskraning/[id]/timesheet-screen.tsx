"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { TimeField } from "@/components/app/fields";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { dec1 } from "@/lib/format";
import { getEmployeePunches, adjustPunch, deletePunch, setPunchApproved, approveEmployeePunches, type PunchRow } from "../actions";
import { exportTimeReportXlsx, exportTimeReportPdf } from "@/lib/export-report";
import { AsyncButton } from "@/components/app/async-button";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };
function rangeFor(p: Period): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (p === "Dagur") return { from: isoOf(t), to: isoOf(t) };
  if (p === "Vika") { const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7)); const sun = new Date(mon); sun.setDate(sun.getDate() + 6); return { from: isoOf(mon), to: isoOf(sun) }; }
  if (p === "Ár") return { from: `${t.getFullYear()}-01-01`, to: `${t.getFullYear()}-12-31` };
  return { from: isoOf(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoOf(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
}

export default function EmployeeTimesheet({ id, name, initial, needsMigration, from: f0, to: t0 }: { id: string; name: string; initial: PunchRow[]; needsMigration: boolean; from: string; to: string }) {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("Mánuður");
  const [from, setFrom] = useState(f0);
  const [to, setTo] = useState(t0);
  const [rows, setRows] = useState<PunchRow[]>(initial);
  const [mig, setMig] = useState(needsMigration);
  const [loading, setLoading] = useState(false);
  const [edit, setEdit] = useState<PunchRow | null>(null);
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => { setNowMs(Date.now()); const id = setInterval(() => setNowMs(Date.now()), 30000); return () => clearInterval(id); }, []);
  // Live elapsed for an open (on-shift) punch, from its clock-in.
  function openElapsed(p: PunchRow): string {
    const start = new Date(`${p.date}T${p.in}`).getTime();
    const mins = Math.max(0, Math.floor(((nowMs || Date.now()) - start) / 60000));
    const h = Math.floor(mins / 60), m = mins % 60;
    return h > 0 ? `${h} klst ${m} mín` : `${m} mín`;
  }

  function reload(fr = from, tt = to) {
    setLoading(true);
    getEmployeePunches(id, fr, tt).then((r) => { if (r.ok) { setRows(r.rows); setMig(r.needsMigration); } }).finally(() => setLoading(false));
  }
  function changePeriod(p: Period) {
    setPeriod(p);
    if (p !== "Sérsniðið") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); reload(r.from, r.to); }
  }
  function changeRange(fr: string, tt: string) { setFrom(fr); setTo(tt); if (fr && tt && fr <= tt) reload(fr, tt); }

  async function approveAll() {
    const res = await approveEmployeePunches(id, from, to);
    toast(res.ok ? `${res.count} ${t("vaktir samþykktar")}` : (res.error ?? "Villa"));
    if (res.ok) reload();
  }
  async function toggle(p: PunchRow) {
    const res = await setPunchApproved(p.punchId, !p.approved);
    if (res.ok) reload(); else toast(res.error ?? "Villa");
  }
  const [exporting, setExporting] = useState(false);
  async function doExport(kind: "xlsx" | "pdf") {
    if (!rows.length) { toast("Engar skráningar á tímabilinu"); return; }
    setExporting(true);
    // Reuse the shared time-report export; the employee name is the report title.
    const data = rows.map((r) => ({ name, date: r.date, in: r.in, out: r.out, hours: r.hours, approved: r.approved }));
    try {
      if (kind === "xlsx") await exportTimeReportXlsx(data, name || "VAKTO", from, to);
      else await exportTimeReportPdf(data, name || "VAKTO", from, to);
      toast(kind === "xlsx" ? "Excel-skýrsla sótt" : "PDF-skýrsla sótt");
    } catch { toast("Villa við útflutning"); } finally { setExporting(false); }
  }

  const total = rows.reduce((a, r) => a + r.hours, 0);
  const pending = rows.filter((r) => !r.approved && !r.open).length;
  const missing = rows.filter((r) => r.open).length;

  return (
    <>
      <PageHeader title={name ? `${name} · ${t("Tímaskráning")}` : t("Tímaskráning")} subtitle={`${niceISO(from)} – ${niceISO(to)}`} actions={
        <>
          <button className="btn ghost sm" disabled={exporting} onClick={() => doExport("xlsx")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Excel</button>
          <button className="btn ghost sm" style={{ marginLeft: 8 }} disabled={exporting} onClick={() => doExport("pdf")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>PDF</button>
          <Link href="/timaskraning" className="btn ghost sm" style={{ marginLeft: 8 }}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M15 18l-6-6 6-6" /></svg>{t("Til baka")}</Link>
        </>
      } />
      <FilterBar
        periods={["Dagur", "Vika", "Mánuður", "Ár", "Sérsniðið"]}
        period={period} onPeriod={changePeriod}
        from={from} to={to} onRange={changeRange}
        rangeLabel={`${dec1(total)} ${t("klst")}`}
      />

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Unnir tímar")}</div><div className="val">{dec1(total)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Vaktir")}</div><div className="val">{rows.length}</div></div>
        <div className="kpi"><div className="lab">{t("Bíða samþykkis")}</div><div className="val" style={{ color: pending ? "var(--warn)" : undefined }}>{pending}</div></div>
        <div className="kpi"><div className="lab">{t("Vantar útstimplun")}</div><div className="val" style={{ color: missing ? "var(--bad)" : undefined }}>{missing}</div></div>
      </div>

      {mig && <div className="ai" style={{ margin: "16px 0 0" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg><div className="x">{t("Keyrðu migration 0008 í Supabase til að virkja samþykki.")}</div></div>}

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch">
          <div><div className="ct">{t("Allar skráningar")}</div><div className="cs">{niceISO(from)} – {niceISO(to)}</div></div>
          {pending > 0 && <AsyncButton className="btn sm" onClick={approveAll}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.5l4 4 10-10" /></svg>{t("Samþykkja allar")}</AsyncButton>}
        </div>
        <div className="cb att" style={{ opacity: loading ? 0.5 : 1 }}>
          {rows.length ? rows.map((p) => (
            <div className="it" key={p.punchId}>
              <div className="tx">
                <b>{niceISO(p.date)}</b>
                <span>{p.in} – {p.out ?? t("opin")}{p.open ? ` · ${openElapsed(p)} ${t("á vakt")}` : ` · ${dec1(p.hours)} ${t("klst")}`}{p.source === "web" ? ` · ${t("handvirkt")}` : ""}</span>
              </div>
              <div className="itact">
                {p.open ? <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("á vakt")}</span>
                  : p.approved ? <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Samþykkt")}</span>
                    : <span className="tag" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Bíður")}</span>}
                <button className="btn ghost sm" onClick={() => setEdit(p)}>{t("Leiðrétta")}</button>
                {!p.open && (p.approved
                  ? <AsyncButton className="btn ghost sm" onClick={() => toggle(p)}>{t("Afturkalla")}</AsyncButton>
                  : <AsyncButton className="btn sm" onClick={() => toggle(p)}>{t("Samþykkja")}</AsyncButton>)}
              </div>
            </div>
          )) : <div className="muted" style={{ textAlign: "center", padding: 30 }}>{t("Engar skráningar á þessu tímabili.")}</div>}
        </div>
      </div>

      {edit && <PunchEditModal row={edit} onClose={() => setEdit(null)} onDone={() => { setEdit(null); reload(); }} />}
    </>
  );
}

function PunchEditModal({ row, onClose, onDone }: { row: PunchRow; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [cin, setCin] = useState(row.in);
  const [cout, setCout] = useState(row.out ?? "");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await adjustPunch(row.punchId, cin, cout || undefined);
    setBusy(false);
    if (res.ok) { toast("Tími leiðréttur"); onDone(); } else toast(res.error ?? "Villa");
  }
  async function remove() {
    if (!window.confirm(`Eyða stimplun ${niceISO(row.date)}?`)) return;
    setBusy(true);
    const res = await deletePunch(row.punchId);
    setBusy(false);
    if (res.ok) { toast("Stimplun eydd"); onDone(); } else toast(res.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Leiðrétta tíma")}</div><div className="muted" style={{ fontSize: 12 }}>{niceISO(row.date)}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{t("Innstimplun")}</label><TimeField value={cin} onChange={setCin} style={{ width: "100%" }} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t("Útstimplun")}</label><TimeField value={cout} onChange={setCout} style={{ width: "100%" }} /></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "-4px 0 8px" }}>{t("Skildu útstimplun eftir auða til að halda vaktinni opinni.")}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 8, flexWrap: "wrap" }}>
            <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
            <button className="btn ghost" disabled={busy} style={{ color: "var(--bad)", marginLeft: "auto" }} onClick={remove}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ marginRight: 5 }}><path d="M4 7h16M9 7V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v2M6 7l1 13a1 1 0 0 0 1 1h8a1 1 0 0 0 1-1l1-13" /></svg>{t("Eyða")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
