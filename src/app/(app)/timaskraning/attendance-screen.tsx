"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AsyncButton } from "@/components/app/async-button";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { TimeField } from "@/components/app/fields";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { PunchFlags, rowSeverity, rowAccent, spanText } from "./punch-flags";
import { PunchDateTimeFields } from "./[id]/timesheet-screen";
import { dec1 } from "@/lib/format";
import type { AttRow } from "@/lib/analytics.server";
import type { OnNowRow, RosterRow } from "./attendance.server";
import { fetchAttendance, managerClockIn, adjustPunch, getEmployeePunches, setPunchApproved, approveEmployeePunches, decideCorrection, type PunchRow, type CorrectionRow } from "./actions";

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

export default function AttendanceScreen({ onShift = 5, empty = false, live = false, rows = [], onNow = [], roster = [], corrections = [] }: { onShift?: number; empty?: boolean; live?: boolean; rows?: AttRow[]; onNow?: OnNowRow[]; roster?: RosterRow[]; corrections?: CorrectionRow[] }) {
  const { t } = useLang();

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
    return <LiveAttendance onShift={onShift} initial={rows} onNow={onNow} roster={roster} corrections={corrections} />;
  }

  // No database connection — say so, never show demo rows.
  return (
    <>
      <PageHeader title="Tímaskráning" subtitle="Áætlað vs raun · þessi vika" />
      <div className="card" style={{ marginTop: 20 }}>
        <div className="cb">
          <b style={{ fontSize: 14 }}>{t("Supabase er ekki tengt")}</b>
          <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.55 }}>{t("Gögn birtast hér þegar gagnagrunnurinn er tengdur — sjá supabase/README.md.")}</p>
        </div>
      </div>
    </>
  );
}

function nowHHMM() { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; }

/** Hours a punch has been open. */
const openHrsOf = (sinceISO: string) => Math.max(0, (Date.now() - Date.parse(sinceISO)) / 3600e3);

function LiveAttendance({ onShift, initial, onNow, roster, corrections }: { onShift: number; initial: AttRow[]; onNow: OnNowRow[]; roster: RosterRow[]; corrections: CorrectionRow[] }) {
  const { t } = useLang();
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const router = useRouter();
  async function decideCorr(id: string, approve: boolean) {
    const res = await decideCorrection(id, approve);
    toast(res.ok ? (approve ? "Leiðrétting samþykkt" : "Hafnað") : (res.error ?? "Villa"));
    router.refresh();
  }
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
  const [detail, setDetail] = useState<{ id: string; name: string } | null>(null);

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
        storageKey="timaskraning"
      />
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Á vakt núna")}</div><div className="val">{onNow.length}</div></div>
        <div className="kpi"><div className="lab">{t("Áætl. klst")}</div><div className="val">{dec1(planned)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Raun klst")}</div><div className="val">{dec1(actual)} <small>{t("klst")}</small></div></div>
        <div className="kpi"><div className="lab">{t("Frávik")}</div><div className="val" style={{ color: actual > planned ? "var(--bad)" : actual < planned ? "var(--good)" : undefined }}>{actual >= planned ? "+" : ""}{dec1(actual - planned)} <small>{t("klst")}</small></div></div>
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
              <span className="avt" style={{ background: r.c, width: 34, height: 34, cursor: "pointer" }} onClick={() => router.push(`/timaskraning/${r.employeeId}`)}>{r.av}</span>
              <div className="tx" style={{ cursor: "pointer" }} onClick={() => router.push(`/timaskraning/${r.employeeId}`)}><b>{r.name}</b><span>{t(r.dept)} · {t("inn")} {r.in}{r.source === "web" ? ` · ${t("handvirkt")}` : ""}</span></div>
              {r.unscheduled && <span className="tag" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("óáætlað")}</span>}
              <div className="itact">
                {openHrsOf(r.since) > 12
                  ? <span className="tag" style={{ background: "var(--bad-soft, #fbe9e5)", color: "var(--bad)" }} title={t("Opin stimplun í meira en 12 klst — gleymt að stimpla út?")}>⚠ {Math.round(openHrsOf(r.since))} {t("klst")}</span>
                  : <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("á vakt")}</span>}
                <button className="btn ghost sm" onClick={() => setEditPunch(r)}>{t("Leiðrétta")}</button>
                <AsyncButton className="btn sm" onClick={() => doClockOut(r)}>{t("tk:clockout")}</AsyncButton>
              </div>
            </div>
          )) : <div className="muted" style={{ padding: 16, textAlign: "center" }}>{t("Enginn skráður inn núna.")}</div>}
        </div>
      </div>

      {corrections.length > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="ch"><div><div className="ct">{t("Leiðréttingabeiðnir")}</div><div className="cs">{t("frá starfsfólki — samþykktu eða hafnaðu")}</div></div><span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{corrections.length} {t("ný")}</span></div>
          <div className="cb att">
            {corrections.map((c) => (
              <div className="it" key={c.id}>
                <div className="ic warn"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div>
                <div className="tx"><b>{c.name} · {niceISO(c.date)}</b><span>{c.requestedIn ? `${t("inn")} ${c.requestedIn}` : ""}{c.requestedOut ? ` · ${t("út")} ${c.requestedOut}` : ""}{c.reason ? ` — ${c.reason}` : ""}</span></div>
                <div className="itact">
                  <AsyncButton className="btn sm" onClick={() => decideCorr(c.id, true)}>{t("Samþykkja")}</AsyncButton>
                  <AsyncButton className="btn ghost sm" onClick={() => decideCorr(c.id, false)}>{t("Hafna")}</AsyncButton>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch">
          <div><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{niceISO(from)} – {niceISO(to)}{missing ? ` · ${missing} ${t("vantar stimplun")}` : ""}</div></div>
          {sel.size > 0 && (
            <button className="btn sm" disabled={bulkBusy} onClick={async () => {
              setBulkBusy(true);
              let n = 0;
              const picked = sel.size;
              for (const id of sel) { const res = await approveEmployeePunches(id, from, to); if (res.ok) n += res.count ?? 0; }
              setBulkBusy(false);
              setSel(new Set());
              toast(`${t("Samþykkt")}: ${n} ${t("stimplanir hjá")} ${picked} ${t("starfsmönnum")}`);
              router.refresh();
            }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.5l4 4 10-10" /></svg>
              {t("Samþykkja valda")} ({sel.size})
            </button>
          )}
        </div>
        <div className="cb tbl" style={{ paddingTop: 8, opacity: loading ? 0.5 : 1 }}>
          <table>
            <thead><tr>
              <th style={{ width: 34 }}><input type="checkbox" checked={shown.length > 0 && sel.size === shown.length} onChange={(e) => setSel(e.target.checked ? new Set(shown.map((r) => r.id)) : new Set())} /></th>
              <th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th><th>{t("Staða")}</th>
            </tr></thead>
            <tbody>
              {shown.length ? shown.map((r) => {
                const longOpen = onNow.find((o) => o.employeeId === r.id && openHrsOf(o.since) > 12);
                const bigDev = !longOpen && r.deviation > 4;
                return (
                <tr key={r.id} className="rowlink" onClick={() => router.push(`/timaskraning/${r.id}`)}>
                  <td onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" checked={sel.has(r.id)} onChange={(e) => setSel((sv) => { const n = new Set(sv); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                  </td>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.name}</span></td>
                  <td>{r.dept}</td>
                  <td className="r">{dec1(r.planned)}</td>
                  <td className="r">{dec1(r.actual)}</td>
                  <td className="r" style={{ color: r.deviation > 0 ? "var(--bad)" : r.deviation < 0 ? "var(--good)" : undefined }}>{r.deviation > 0 ? "+" : ""}{dec1(r.deviation)}</td>
                  <td>
                    {longOpen ? <span className="pill" style={{ background: "var(--bad-soft, #fbe9e5)", color: "var(--bad)" }} title={t("Opin stimplun í meira en 12 klst — gleymt að stimpla út?")}>⚠ {t("Opin stimplun")}</span>
                      : bigDev ? <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn)" }} title={t("Frávik yfir 4 klst — skoðaðu stimplanirnar")}>⚠ {t("Mikið frávik")}</span>
                      : r.actual === 0 && r.planned === 0 ? <span className="pill" style={{ background: "var(--line2)", color: "var(--ink3)" }}>{t("engin gögn")}</span>
                      : r.actual === 0 ? <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Vantar stimplun")}</span>
                      : <span className="pill" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Á áætlun")}</span>}
                  </td>
                </tr>
                );
              }) : <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Engin gögn á þessu tímabili.")}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {clockInOpen && <ClockInModal roster={roster} onClose={() => setClockInOpen(false)} onDone={() => { setClockInOpen(false); router.refresh(); }} />}
      {editPunch && <AdjustPunchModal row={editPunch} onClose={() => setEditPunch(null)} onDone={() => { setEditPunch(null); router.refresh(); }} />}
      {detail && <EmployeePunchesModal employeeId={detail.id} name={detail.name} from={from} to={to} onClose={() => setDetail(null)} onChanged={() => router.refresh()} />}
    </>
  );
}

function EmployeePunchesModal({ employeeId, name, from, to, onClose, onChanged }: { employeeId: string; name: string; from: string; to: string; onClose: () => void; onChanged: () => void }) {
  const { t } = useLang();
  const [rows, setRows] = useState<PunchRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [needsMig, setNeedsMig] = useState(false);

  useEffect(() => {
    let cancelled = false;
    getEmployeePunches(employeeId, from, to).then((r) => {
      if (cancelled) return;
      setRows(r.rows); setNeedsMig(r.needsMigration);
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [employeeId, from, to]);

  function refresh() {
    getEmployeePunches(employeeId, from, to).then((r) => { setRows(r.rows); setNeedsMig(r.needsMigration); });
    onChanged();
  }
  async function toggle(p: PunchRow) {
    const res = await setPunchApproved(p.punchId, !p.approved);
    if (res.ok) refresh(); else toast(res.error ?? "Villa");
  }
  async function approveAll() {
    const res = await approveEmployeePunches(employeeId, from, to);
    toast(res.ok ? `${res.count} ${t("vaktir samþykktar")}` : (res.error ?? "Villa"));
    if (res.ok) refresh();
  }

  const total = rows.reduce((a, r) => a + r.hours, 0);
  const pending = rows.filter((r) => !r.approved && !r.open).length;

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 640 }}>
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Tímaskráningar")} · {name}</div><div className="muted" style={{ fontSize: 12 }}>{niceISO(from)} – {niceISO(to)} · {dec1(total)} {t("klst")}{pending ? ` · ${pending} ${t("bíða samþykkis")}` : ""}</div></div>
          <Link href={`/timaskraning/${employeeId}`} className="btn ghost sm" style={{ marginLeft: "auto", marginRight: 8 }} onClick={onClose}>{t("Opna á heilli síðu")} →</Link>
          <button className="x" onClick={onClose}>✕</button>
        </div>
        <div className="mb">
          {needsMig && <div className="ai" style={{ margin: "0 0 12px" }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg><div className="x">{t("Samþykki stimplana er ekki virkt í þessu fyrirtæki — hafðu samband við VAKTO.")}</div></div>}
          {pending > 0 && <div style={{ marginBottom: 6 }}><button className="btn sm" onClick={approveAll}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12.5l4 4 10-10" /></svg>{t("Samþykkja allar")}</button></div>}
          <div className="att" style={{ maxHeight: "52vh", overflowY: "auto" }}>
            {loading ? <div className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Hleð…")}</div>
              : rows.length ? rows.map((p) => (
                <div className="it" key={p.punchId} style={rowAccent(rowSeverity(p))}>
                  <div className="tx">
                    <b>{niceISO(p.date)}</b>
                    <span>{spanText(p, t("opin"))}{p.open ? "" : ` · ${dec1(p.hours)} ${t("klst")}`}{p.sched ? ` · ${t("áætl.")} ${p.sched.start}–${p.sched.end}` : ""}{p.source === "web" ? ` · ${t("handvirkt")}` : ""}</span>
                  </div>
                  <div className="itact">
                    <PunchFlags flags={p.flags} />
                    {p.open ? (p.flags.length ? null : <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("á vakt")}</span>)
                      : p.approved ? <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Samþykkt")}</span>
                        : <span className="tag" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Bíður")}</span>}
                    {!p.open && (p.approved
                      ? <button className="btn ghost sm" onClick={() => toggle(p)}>{t("Afturkalla")}</button>
                      : <button className="btn sm" onClick={() => toggle(p)}>{t("Samþykkja")}</button>)}
                  </div>
                </div>
              )) : <div className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Engar skráningar á þessu tímabili.")}</div>}
          </div>
        </div>
      </div>
    </div>
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
          <div className="field"><label>{t("Tími innstimplunar")}</label><TimeField value={time} onChange={setTime} style={{ width: "100%" }} /></div>
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
  const day = row.since.slice(0, 10);
  const [dIn, setDIn] = useState(day);
  const [cin, setCin] = useState(row.in);
  const [dOut, setDOut] = useState(day);
  const [cout, setCout] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!dIn) { toast("Veldu dagsetningu innstimplunar"); return; }
    setBusy(true);
    const res = await adjustPunch(row.punchId, cin, cout || undefined, { inDate: dIn, outDate: cout ? (dOut || dIn) : undefined });
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
          <PunchDateTimeFields dIn={dIn} cin={cin} dOut={dOut} cout={cout} onDIn={setDIn} onCin={setCin} onDOut={setDOut} onCout={setCout} />
          <div style={{ display: "flex", gap: 9, marginTop: 8 }}>
            <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
