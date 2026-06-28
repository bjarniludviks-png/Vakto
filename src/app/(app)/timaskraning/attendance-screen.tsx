"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { approveAllTimesheets, approveTimesheet, setClockOut } from "./actions";

type TS = { date: string; pos: string; sch: string; act: string; pend: boolean; id?: string };
const TSDATA: Record<string, TS> = {
  Mína: { date: "Mánudagur 22. júní", pos: "Kokkur", sch: "08:00–16:00 · 8 klst", act: "08:02 – (vantar útstimplun)", pend: false },
  Bach: { date: "Mánudagur 22. júní", pos: "Þjónn / Sal", sch: "09:00–17:00 · 8 klst", act: "09:18 – 17:05 · 7,8 klst", pend: true },
  Phong: { date: "Mánudagur 22. júní", pos: "Kokkur", sch: "08:00–16:00 · 8 klst", act: "07:56 – 16:00 · 8,1 klst", pend: true },
  Truong: { date: "Mánudagur 22. júní", pos: "Kokkur", sch: "11:00–19:00 · 8 klst", act: "11:00 – 21:08 · 10,1 klst", pend: true },
};

const ROWS = [
  { n: "Mína", av: "MÍ", c: "#5b50e6", sch: "08:00–16:00", in: "08:02", out: "— vantar", outMuted: true, pl: "8,0", ac: "—", st: ["bad", "Vantar útstimplun"], ap: ["muted", "—"] },
  { n: "Bach", av: "BA", c: "#1fb6a6", sch: "09:00–17:00", in: "09:18", out: "17:05", outMuted: false, pl: "8,0", ac: "7,8", st: ["warn", "18 mín of seint"], ap: ["warn", "Bíður"] },
  { n: "Phong", av: "PH", c: "#18a06a", sch: "08:00–16:00", in: "07:56", out: "16:00", outMuted: false, pl: "8,0", ac: "8,1", st: ["good", "Á áætlun"], ap: ["warn", "Bíður"] },
  { n: "Truong", av: "TR", c: "#e0533f", sch: "11:00–19:00", in: "11:00", out: "21:08", outMuted: false, pl: "8,0", ac: "10,1", st: ["warn", "+2,1 klst yfir"], ap: ["warn", "Bíður"] },
] as const;

const pillStyle = (k: string) =>
  k === "bad" ? { background: "var(--bad-soft)", color: "var(--bad)" }
    : k === "warn" ? { background: "var(--warn-soft)", color: "var(--warn)" }
      : k === "good" ? { background: "var(--good-soft)", color: "var(--good)" }
        : { background: "var(--line2)", color: "var(--ink3)" };

export default function AttendanceScreen({ onShift = 5, empty = false }: { onShift?: number; empty?: boolean }) {
  const { t } = useLang();
  const [wk, setWk] = useState(0);
  const [cur, setCur] = useState<string | null>(null);
  const lbl = wk === 0 ? "22.–28. júní" : `${22 + wk * 7}.–${28 + wk * 7}. júní`;

  if (empty) {
    return (
      <>
        <PageHeader title="Tímaskráning" subtitle="Áætlað vs raun · þessi vika" />
        <EmptyState
          title="Engin tímaskráning enn"
          message="Tímaskráning birtist hér um leið og starfsfólk byrjar að stimpla inn — gegnum appið eða Kiosk-skjáinn. Bættu fyrst við starfsfólki."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }

  return (
    <>
      <PageHeader title="Tímaskráning" subtitle="Áætlað vs raun · þessi vika" />

      <div className="stoolbar">
        <div className="wk"><button onClick={() => setWk((w) => w - 1)}>‹</button><span className="lbl">{lbl}</span><button onClick={() => setWk((w) => w + 1)}>›</button></div>
        <div className="seg"><button>{t("Dagur")}</button><button className="on">{t("Vika")}</button><button>{t("Mánuður")}</button></div>
        <div className="srchbox"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg><input placeholder={t("Leita að starfsmanni")} /></div>
        <select className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }}><option>{t("Allar deildir")}</option><option>Eldhús</option><option>Sal</option><option>Stjórnun</option></select>
        <div className="sp" style={{ flex: 1 }} />
        <button className="btn ghost sm" onClick={() => toast("Tímaskráning sótt í CSV")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Sækja CSV")}</button>
      </div>

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Á vakt núna")}</div><div className="val">{onShift}</div></div>
        <div className="kpi"><div className="lab">{t("Mætti of seint")}</div><div className="val" style={{ color: "var(--warn)" }}>2</div></div>
        <div className="kpi"><div className="lab">{t("Vantar útstimplun")}</div><div className="val" style={{ color: "var(--bad)" }}>1</div></div>
        <div className="kpi"><div className="lab">{t("Frávik (klst)")}</div><div className="val">+3,4</div></div>
      </div>

      <div className="grid2" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="card">
          <div className="ch"><div><div className="ct">{t("Fer yfir áætlun")}</div><div className="cs">{t("stefnir í yfirvinnu eða aukinn kostnað")}</div></div></div>
          <div className="cb att">
            <div className="it"><div className="ic bad">ÓM</div><div className="tx"><b>Ómar · Sal</b><span>Plan 40 klst · Raun 48 · þak 40</span></div><span className="tag bad">+24.500 kr</span></div>
            <div className="it"><div className="ic warn">TR</div><div className="tx"><b>Truong · Eldhús</b><span>fór 2,1 klst yfir plani í gær</span></div><span className="tag warn">+7.900 kr</span></div>
            <div className="it"><div className="ic warn">BA</div><div className="tx"><b>Bach · Sal</b><span>18 mín of seint — annað skiptið í viku</span></div><span className="tag mut">skráð</span></div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Áætlað vs raun í dag")}</div><span className="badge">+11.900 kr</span></div>
          <div className="cb">
            <div className="statline"><span className="k">{t("Áætlaður launakostnaður")}</span><span className="v">186.500 kr</span></div>
            <div className="statline"><span className="k">{t("Raun launakostnaður")}</span><span className="v">198.400 kr</span></div>
            <div className="statline"><span className="k">{t("Raun laun% (klukknaðir tímar)")}</span><span className="v" style={{ color: "var(--warn)" }}>32,4%</span></div>
            <div className="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg><div className="x">Mína gleymdi útstimplun — setja á 16:00 (áætl. lok)?</div><button className="go" onClick={async () => { const res = await setClockOut({ employeeName: "Mína", time: "16:00" }); toast(res.ok ? "Útstimplun sett á 16:00" : (res.error ?? "Villa")); }}>{t("Samþykkja")}</button></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch">
          <div><div className="ct">{t("Tímaskráning vikunnar")}</div><div className="cs">{t("smelltu á röð til að skoða og samþykkja")}</div></div>
          <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
            <button className="btn ghost sm" onClick={async () => { const res = await approveAllTimesheets(); toast(res.ok ? "Allar tímaskráningar samþykktar" : (res.error ?? "Villa")); }}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.5l4 4 10-10" /></svg>{t("Samþykkja allt")}</button>
            <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("3 bíða samþykkis")}</span>
          </div>
        </div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("th:Starfsm.")}</th><th>{t("Áætluð vakt")}</th><th>{t("Stimplað inn")}</th><th>{t("Stimplað út")}</th><th className="r">{t("Áætl.")}</th><th className="r">{t("Raun")}</th><th>{t("Staða")}</th><th>{t("Samþykki")}</th></tr></thead>
            <tbody>
              {ROWS.map((r) => (
                <tr className="rowlink" key={r.n} onClick={() => setCur(r.n)}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.n}</span></td>
                  <td>{r.sch}</td>
                  <td>{r.in}</td>
                  <td className={r.outMuted ? "muted" : ""}>{r.out}</td>
                  <td className="r">{r.pl}</td>
                  <td className="r">{r.ac}</td>
                  <td><span className="pill" style={pillStyle(r.st[0])}>{r.st[1]}</span></td>
                  <td>{r.ap[0] === "muted" ? <span className="muted">—</span> : <span className="pill" style={pillStyle(r.ap[0])}>{r.ap[1]}</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {cur && <TimesheetModal name={cur} ts={TSDATA[cur]} onClose={() => setCur(null)} />}
    </>
  );
}

function TimesheetModal({ name, ts, onClose }: { name: string; ts: TS; onClose: () => void }) {
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div className="ic warn" style={{ width: 34, height: 34, borderRadius: 9, background: "var(--warn-soft)", color: "var(--warn)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 18, height: 18 }}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          </div>
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>Tímaskráning · {name}</div><div className="muted" style={{ fontSize: 12 }}>{ts.pend ? "Bíður samþykkis þíns" : "Vantar útstimplun"}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <div className="statline"><span className="k">Dagsetning</span><span className="v">{ts.date}</span></div>
          <div className="statline"><span className="k">Staður</span><span className="v">Reykjavík Asian</span></div>
          <div className="statline"><span className="k">Staða</span><span className="v" style={{ color: "#c47a1a" }}>{ts.pos}</span></div>
          <div className="statline"><span className="k">Áætlað</span><span className="v">{ts.sch}</span></div>
          <div className="statline"><span className="k">Raun</span><span className="v">{ts.act}</span></div>
          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            {ts.pend
              ? <button className="btn" style={{ background: "var(--good)" }} onClick={async () => { const res = await approveTimesheet(ts.id ?? ""); onClose(); toast(res.ok ? "Tímaskráning samþykkt" : (res.error ?? "Villa")); }}>✓ Samþykkja</button>
              : <button className="btn" onClick={async () => { const res = await setClockOut({ employeeName: name, time: "16:00" }); onClose(); toast(res.ok ? "Útstimplun sett á 16:00" : (res.error ?? "Villa")); }}>Setja útstimplun á 16:00</button>}
            <button className="btn ghost" onClick={onClose}>Loka</button>
          </div>
        </div>
      </div>
    </div>
  );
}
