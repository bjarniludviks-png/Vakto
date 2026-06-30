"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { dec1 } from "@/lib/format";
import type { AttRow } from "@/lib/analytics.server";
import type { OnNowRow, RosterRow } from "./attendance.server";
import { approveAllTimesheets, approveTimesheet, setClockOut, fetchAttendance, managerClockIn, adjustPunch } from "./actions";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };
function rangeFor(period: Period): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (period === "Dagur") return { from: isoOf(t), to: isoOf(t) };
  if (period === "Mánuður") return { from: isoOf(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoOf(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
  const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: isoOf(mon), to: isoOf(sun) };
}

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

export default function AttendanceScreen({ onShift = 5, empty = false, live = false, rows = [], onNow = [], roster = [] }: { onShift?: number; empty?: boolean; live?: boolean; rows?: AttRow[]; onNow?: OnNowRow[]; roster?: RosterRow[] }) {
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

  // Live company: real planned (shifts) vs actual (punches) per employee,
  // with period / custom-range / search / department filtering.
  if (live) {
    return <LiveAttendance onShift={onShift} initial={rows} onNow={onNow} roster={roster} />;
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

function nowHHMM() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

function LiveAttendance({ onShift, initial, onNow, roster }: { onShift: number; initial: AttRow[]; onNow: OnNowRow[]; roster: RosterRow[] }) {
  const { t } = useLang();
  const router = useRouter();
  const [period, setPeriod] = useState<Period>("Vika");
  const init0 = rangeFor("Vika");
  const [from, setFrom] = useState(init0.from);
  const [to, setTo] = useState(init0.to);
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [data, setData] = useState<AttRow[]>(initial);
  const [loading, setLoading] = useState(false);
  const [clockInOpen, setClockInOpen] = useState(false);
  const [editPunch, setEditPunch] = useState<OnNowRow | null>(null);

  async function doClockOut(row: OnNowRow) {
    const res = await adjustPunch(row.punchId, undefined, nowHHMM());
    toast(res.ok ? `${row.name} stimplað(ur) út` : (res.error ?? "Villa"));
    router.refresh();
  }

  function load(f: string, tt: string) {
    setLoading(true);
    fetchAttendance(f, tt).then((res) => { if (res.ok) setData(res.rows); }).finally(() => setLoading(false));
  }
  function changePeriod(p: Period) {
    setPeriod(p);
    if (p !== "Sérsniðið") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); load(r.from, r.to); }
  }
  function changeRange(f: string, tt: string) { setFrom(f); setTo(tt); if (f && tt && f <= tt) load(f, tt); }

  const depts = ["all", ...Array.from(new Set(data.map((r) => r.dept).filter((d) => d && d !== "—")))];
  const shown = data.filter((r) => (deptF === "all" || r.dept === deptF) && (!search || r.name.toLowerCase().includes(search.toLowerCase())));
  const planned = shown.reduce((a, r) => a + r.planned, 0);
  const actual = shown.reduce((a, r) => a + r.actual, 0);
  const missing = shown.filter((r) => r.planned > 0 && r.actual === 0).length;

  return (
    <>
      <PageHeader title="Tímaskráning" subtitle="Áætlað vs raun-tímar" actions={
        <button className="btn ghost sm" onClick={() => toast("Tímaskráning sótt í CSV")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Sækja CSV")}</button>
      } />
      <FilterBar
        periods={["Dagur", "Vika", "Mánuður", "Sérsniðið"]}
        period={period} onPeriod={changePeriod}
        from={from} to={to} onRange={changeRange}
        search={search} onSearch={setSearch}
        filters={[{ value: deptF, onChange: setDeptF, options: depts.map((d) => ({ value: d, label: d === "all" ? "Allar deildir" : d })) }]}
        rangeLabel={`${niceISO(from)} – ${niceISO(to)}`}
      />
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Á vakt núna")}</div><div className="val">{onShift}</div></div>
        <div className="kpi"><div className="lab">{t("Áætl. klst")}</div><div className="val">{dec1(planned)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Raun klst")}</div><div className="val">{dec1(actual)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Frávik")}</div><div className="val" style={{ color: actual > planned ? "var(--warn)" : "var(--good)" }}>{actual >= planned ? "+" : ""}{dec1(actual - planned)} <small>{t("klst")}</small></div></div>
      </div>

      {/* Who is clocked in right now */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch">
          <div><div className="ct">{t("Á vakt núna")}</div><div className="cs">{t("skráðir inn — leiðréttu tíma eða stimplaðu út")}</div></div>
          <button className="btn sm" onClick={() => setClockInOpen(true)}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14M5 12h14" /></svg>{t("Stimpla inn starfsmann")}
          </button>
        </div>
        <div className="cb att">
          {onNow.length ? onNow.map((r) => (
            <div className="it" key={r.punchId}>
              <span className="avt" style={{ background: r.c, width: 34, height: 34 }}>{r.av}</span>
              <div className="tx"><b>{r.name}</b><span>{t(r.dept)} · {t("inn")} {r.in}{r.source === "web" ? ` · ${t("handvirkt")}` : ""}</span></div>
              <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)", marginLeft: "auto" }}>{t("á vakt")}</span>
              <button className="btn ghost sm" style={{ marginLeft: 10 }} onClick={() => setEditPunch(r)}>{t("Leiðrétta")}</button>
              <button className="btn sm" style={{ marginLeft: 8 }} onClick={() => doClockOut(r)}>{t("tk:clockout")}</button>
            </div>
          )) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>{t("Enginn skráður inn núna.")}</div>}
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{niceISO(from)} – {niceISO(to)}{missing ? ` · ${missing} ${t("vantar stimplun")}` : ""}</div></div></div>
        <div className="cb tbl" style={{ paddingTop: 8, opacity: loading ? 0.5 : 1 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th><th>{t("Staða")}</th></tr></thead>
            <tbody>
              {shown.length ? shown.map((r) => (
                <tr key={r.id}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.name}</span></td>
                  <td>{r.dept}</td>
                  <td className="r">{dec1(r.planned)}</td>
                  <td className="r">{dec1(r.actual)}</td>
                  <td className="r" style={{ color: r.deviation > 0 ? "var(--warn)" : r.deviation < 0 ? "var(--bad)" : undefined }}>{r.deviation > 0 ? "+" : ""}{dec1(r.deviation)}</td>
                  <td>{r.actual === 0 && r.planned === 0 ? <span className="pill" style={{ background: "var(--line2)", color: "var(--ink3)" }}>{t("engin gögn")}</span> : r.actual === 0 ? <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Vantar stimplun")}</span> : <span className="pill" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Á áætlun")}</span>}</td>
                </tr>
              )) : <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Engin gögn á þessu tímabili.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {clockInOpen && <ClockInModal roster={roster} onClose={() => setClockInOpen(false)} onDone={() => { setClockInOpen(false); router.refresh(); }} />}
      {editPunch && <AdjustPunchModal row={editPunch} onClose={() => setEditPunch(null)} onDone={() => { setEditPunch(null); router.refresh(); }} />}
    </>
  );
}

function ClockInModal({ roster, onClose, onDone }: { roster: RosterRow[]; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [eid, setEid] = useState(roster[0]?.id ?? "");
  const [time, setTime] = useState(nowHHMM());
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!eid) { toast("Veldu starfsmann"); return; }
    setBusy(true);
    const res = await managerClockIn(eid, time);
    setBusy(false);
    if (res.ok) { toast("Stimplað inn"); onDone(); } else toast(res.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Stimpla inn starfsmann")}</div><div className="muted" style={{ fontSize: 12 }}>{t("fyrir einhvern sem gleymdi að skrá sig inn")}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <div className="field"><label>{t("Starfsmaður")}</label>
            <select value={eid} onChange={(e) => setEid(e.target.value)}>
              {roster.length ? roster.map((r) => <option key={r.id} value={r.id}>{r.name} · {r.dept}</option>) : <option value="">{t("Allir eru þegar skráðir inn")}</option>}
            </select>
          </div>
          <div className="field"><label>{t("Tími innstimplunar")}</label><input type="time" value={time} onChange={(e) => setTime(e.target.value)} /></div>
          <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
            <button className="btn" disabled={busy || !eid} onClick={go}>{t("tk:clockin")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function AdjustPunchModal({ row, onClose, onDone }: { row: OnNowRow; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const [cin, setCin] = useState(row.in);
  const [cout, setCout] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const res = await adjustPunch(row.punchId, cin, cout || undefined);
    setBusy(false);
    if (res.ok) { toast("Tími leiðréttur"); onDone(); } else toast(res.error ?? "Villa");
  }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal">
        <div className="mh">
          <span className="avt" style={{ background: row.c, width: 34, height: 34 }}>{row.av}</span>
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Leiðrétta tíma")} · {row.name}</div><div className="muted" style={{ fontSize: 12 }}>{t("breyttu inn- eða útstimplun")}</div></div>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{t("Innstimplun")}</label><input type="time" value={cin} onChange={(e) => setCin(e.target.value)} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t("Útstimplun")}</label><input type="time" value={cout} onChange={(e) => setCout(e.target.value)} /></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "-4px 0 8px" }}>{t("Skildu útstimplun eftir auða til að halda vaktinni opinni.")}</p>
          <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
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
