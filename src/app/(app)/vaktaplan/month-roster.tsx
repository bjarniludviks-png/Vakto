"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import { TimeField } from "@/components/app/fields";
import { getPlan, saveShift, deleteShift, copyShifts, clearShifts, type PlanShift, type PlanLeave } from "./actions";
import type { PlanEmp } from "./roster.server";
import { SickOnShift } from "./sick-on-shift";

// Mánaðarplan sem starfsmannatafla: starfsfólk í röðum, dagar mánaðarins í dálkum.
// Allt eftir starfsmanns-id (ekki nafni) og vistast strax. „Mála“-hamur: veldu vaktategund
// og smelltu á reiti — þannig er mánuðurinn mannaður á nokkrum mínútum.

type ShiftType = { nm: string; t: string; prem: string; bg: string; bd: string; fg: string };
type Tool = { kind: "type"; ty: ShiftType } | { kind: "clip"; start: string; end: string; type: string | null } | { kind: "erase" } | null;

const DAYS = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const LEAVE_LBL: Record<string, string> = { orlof: "Orlof", veikindi: "Veik", olaunad: "Launal." };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const hrs = (a: string, b: string) => {
  const [h1, m1] = a.split(":").map(Number), [h2, m2] = b.split(":").map(Number);
  let d = (h2 * 60 + (m2 || 0)) - (h1 * 60 + (m1 || 0));
  if (d <= 0) d += 1440;
  return Math.round((d / 60) * 100) / 100;
};
const short = (t: string) => (t.endsWith(":00") ? t.slice(0, 2) : t);
const typeTimes = (ty: ShiftType): [string, string] | null => {
  const [a, b] = (ty.t || "").split("–").map((x) => x?.trim().slice(0, 5));
  return a && b && /^\d{2}:\d{2}$/.test(a) && /^\d{2}:\d{2}$/.test(b) ? [a, b] : null;
};

export default function MonthRoster({ month, todayISO, types, deptSel, scopeDepts, onOpenDay, onTotals, full, onToggleFull }: {
  month: Date; todayISO: string; types: ShiftType[]; deptSel: string[]; scopeDepts: string[];
  onOpenDay: (d: Date) => void; onTotals: (x: { hrs: number; shifts: number }) => void; full: boolean; onToggleFull: () => void;
}) {
  const { t } = useLang();
  const y = month.getFullYear(), m = month.getMonth();
  const days = useMemo(() => Array.from({ length: new Date(y, m + 1, 0).getDate() }, (_, i) => new Date(y, m, i + 1)), [y, m]);
  const from = iso(days[0]), to = iso(days[days.length - 1]);
  const [emps, setEmps] = useState<PlanEmp[]>([]);
  const [shifts, setShifts] = useState<PlanShift[]>([]);
  const [leave, setLeave] = useState<PlanLeave[]>([]);
  const [ver, setVer] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const loading = loadedKey !== `${from}|${to}|${ver}`;
  const [tool, setTool] = useState<Tool>(null);
  const [edit, setEdit] = useState<{ emp: PlanEmp; date: string } | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let gone = false;
    getPlan(from, to).then((res) => {
      if (gone) return;
      setLoadedKey(`${from}|${to}|${ver}`);
      if (!res.ok) { toast(t("Tókst ekki að sækja vaktaplanið — endurhlaðið síðuna.")); return; }
      setEmps(res.employees); setShifts(res.shifts); setLeave(res.leave);
    });
    return () => { gone = true; };
  }, [from, to, ver]); // eslint-disable-line react-hooks/exhaustive-deps -- t breytist ekki

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { setTool(null); setMenu(false); } };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Sýnilegt starfsfólk: innan umsjónar vaktstjóra og valinna deilda (tómt val = allar).
  const rows = useMemo(() => {
    const inScope = (e: PlanEmp) => scopeDepts.length === 0 || e.depts.some((d) => scopeDepts.includes(d));
    const inSel = (e: PlanEmp) => deptSel.length === 0 || e.depts.some((d) => deptSel.includes(d));
    const list = emps.filter((e) => inScope(e) && inSel(e));
    // Raðað eftir deild (sú valda sem passar fyrst) svo hver deild sé saman í töflunni.
    const groupOf = (e: PlanEmp) => (deptSel.length ? e.depts.find((d) => deptSel.includes(d)) : e.dept) || "";
    return list.map((e) => ({ e, g: groupOf(e) })).sort((a, b) => a.g.localeCompare(b.g, "is") || a.e.name.localeCompare(b.e.name, "is"));
  }, [emps, deptSel, scopeDepts]);
  const showGroups = new Set(rows.map((r) => r.g)).size > 1;

  const byCell = useMemo(() => {
    const map = new Map<string, PlanShift>();
    for (const s of shifts) map.set(`${s.employeeId}|${s.date}`, s);
    return map;
  }, [shifts]);
  const leaveOf = (eid: string, d: string) => leave.find((l) => l.employeeId === eid && l.from <= d && l.to >= d);
  const typeStyle = (s: PlanShift) => {
    const ty = types.find((x) => x.nm === s.type) ?? types.find((x) => typeTimes(x)?.[0] === s.start);
    return ty ? { background: ty.bg, borderColor: ty.bd, color: ty.fg } : undefined;
  };

  const visIds = useMemo(() => new Set(rows.map((r) => r.e.id)), [rows]);
  const visShifts = shifts.filter((s) => visIds.has(s.employeeId) && s.date >= from && s.date <= to);
  const totHrs = visShifts.reduce((a, s) => a + hrs(s.start, s.end), 0);
  useEffect(() => { onTotals({ hrs: Math.round(totHrs * 10) / 10, shifts: visShifts.length }); }, [totHrs, visShifts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Vista eina vakt (bjartsýn uppfærsla, bakfært ef þjónninn hafnar). */
  const put = useCallback(async (emp: PlanEmp, date: string, start: string, end: string, type: string | null) => {
    const key = `${emp.id}|${date}`;
    const prev = shifts;
    setShifts((ss) => [...ss.filter((s) => `${s.employeeId}|${s.date}` !== key), { id: `tmp-${key}`, employeeId: emp.id, date, start, end, type }]);
    const res = await saveShift({ employeeName: emp.id, date, startTime: start, endTime: end, shiftTypeName: type ?? "" });
    if (!res.ok) { setShifts(prev); toast(res.error ?? t("Tókst ekki að vista vaktina")); }
    return res.ok;
  }, [shifts, t]);
  const drop = useCallback(async (emp: PlanEmp, date: string) => {
    const key = `${emp.id}|${date}`;
    const prev = shifts;
    setShifts((ss) => ss.filter((s) => `${s.employeeId}|${s.date}` !== key));
    const res = await deleteShift({ employeeName: emp.id, dateISO: date });
    if (!res.ok) { setShifts(prev); toast(res.error ?? t("Tókst ekki að eyða vaktinni")); }
  }, [shifts, t]);

  function clickCell(emp: PlanEmp, date: string) {
    const cur = byCell.get(`${emp.id}|${date}`);
    if (tool?.kind === "erase") { if (cur) void drop(emp, date); return; }
    if (tool?.kind === "clip") { void put(emp, date, tool.start, tool.end, tool.type); return; }
    if (tool?.kind === "type") {
      const tt = typeTimes(tool.ty);
      if (tt) { void put(emp, date, tt[0], tt[1], tool.ty.nm); return; }
      if (cur) { void put(emp, date, cur.start, cur.end, tool.ty.nm); return; } // tegund án fasts tíma: aðeins litur/álag
    }
    setEdit({ emp, date });
  }

  const visibleIds = () => rows.map((r) => r.e.id);
  async function copyLastMonth() {
    // Hver dagur fær sama vikudag úr síðasta mánuði (−28 eða −35 dagar) svo helgar lendi á helgum.
    const first = new Date(y, m, 1);
    const pairs: [string, string][] = days.map((d) => {
      const s = new Date(d); s.setDate(s.getDate() - 28);
      while (s >= first) s.setDate(s.getDate() - 7);
      return [iso(s), iso(d)];
    });
    const has = visShifts.length > 0;
    if (has && !window.confirm(t("Afrita síðasta mánuð yfir þennan? Vaktir sem eru fyrir í mánuðinum hjá starfsfólkinu sem sést verða leystar af hólmi."))) return;
    await runCopy(pairs, true);
  }
  async function repeatWeek(weekStart: Date) {
    // Endurtaka valda viku (mán–sun) á allar aðrar vikur mánaðarins — aðeins í auða reiti.
    const pairs: [string, string][] = [];
    for (const d of days) {
      const diff = Math.round((d.getTime() - weekStart.getTime()) / 86400000);
      if (diff >= 0 && diff < 7) continue;
      const s = new Date(weekStart); s.setDate(s.getDate() + (((diff % 7) + 7) % 7));
      pairs.push([iso(s), iso(d)]);
    }
    await runCopy(pairs, false);
  }
  async function runCopy(pairs: [string, string][], overwrite: boolean) {
    setBusy(true); setMenu(false);
    const res = await copyShifts({ pairs, employeeIds: visibleIds(), overwrite });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? t("Tókst ekki að afrita")); return; }
    toast(`${res.count ?? 0} ${t("vaktir afritaðar")}${res.skippedLeave ? ` · ${res.skippedLeave} ${t("slepptu vegna frís")}` : ""}`);
    setVer((v) => v + 1);
  }
  async function clearMonth() {
    if (!window.confirm(t("Eyða öllum vöktum mánaðarins hjá starfsfólkinu sem sést? Þetta er ekki hægt að afturkalla."))) return;
    setBusy(true); setMenu(false);
    const res = await clearShifts({ dates: days.map(iso), employeeIds: visibleIds() });
    setBusy(false);
    toast(res.ok ? `${res.count ?? 0} ${t("vöktum eytt")}` : (res.error ?? "Villa"));
    setVer((v) => v + 1);
  }
  // Mánudagar sem byrja viku innan mánaðarins — til að velja „endurtaka viku“.
  const mondays = days.filter((d) => d.getDay() === 1 && d.getDate() + 6 <= days.length);

  const editShift = edit ? byCell.get(`${edit.emp.id}|${edit.date}`) ?? null : null;
  let lastGroup: string | null = null;

  return (
    <div className={`card mroster-card${full ? " full" : ""}`} style={{ marginTop: full ? 0 : 16 }}>
      <div className="mr-bar">
        <div className="mr-tools">
          <span className="mr-lbl">{t("Mála")}:</span>
          {types.map((ty) => {
            const on = tool?.kind === "type" && tool.ty.nm === ty.nm;
            return (
              <button key={ty.nm} type="button" className={`mr-tool${on ? " on" : ""}`} onClick={() => setTool(on ? null : { kind: "type", ty })}
                style={{ background: ty.bg, borderColor: on ? ty.fg : ty.bd, color: ty.fg }} title={ty.t || t("Enginn fastur tími")}>
                {t(ty.nm)}{ty.t && ty.t !== "–" ? <small>{ty.t.replace(/:00/g, "")}</small> : null}
              </button>
            );
          })}
          <button type="button" className={`mr-tool erase${tool?.kind === "erase" ? " on" : ""}`} onClick={() => setTool(tool?.kind === "erase" ? null : { kind: "erase" })}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 20H9L4 15a2 2 0 0 1 0-3l8-8a2 2 0 0 1 3 0l5 5a2 2 0 0 1 0 3l-8 8" /></svg>{t("Strokleður")}
          </button>
        </div>
        {/* Leiðbeining fljótandi neðst — lína ofan við töfluna ýtti henni niður og smellir lentu á röngum reit. */}
        {tool && (
          <div className="mr-hint">
            {tool.kind === "erase" ? t("Smelltu á vaktir til að eyða þeim.") : tool.kind === "clip" ? `${t("Smelltu á reiti til að líma")} ${tool.start}–${tool.end}.` : `${t("Smelltu á reiti til að setja")} ${t(tool.ty.nm)}.`}
            {" "}<a onClick={() => setTool(null)}>{t("Hætta")} (Esc)</a>
          </div>
        )}
        <div className="mr-right">
          <div style={{ position: "relative" }}>
            <button className="btn ghost sm" disabled={busy} onClick={() => setMenu((v) => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="11" height="11" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></svg>{busy ? t("Augnablik…") : t("Afrita")}
            </button>
            {menu && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setMenu(false)} />
                <div className="tmenu show" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", left: "auto", minWidth: 260 }}>
                  <div className="mi" onClick={copyLastMonth}>{t("Afrita síðasta mánuð")}</div>
                  <div className="sep" />
                  {mondays.map((d) => (
                    <div className="mi" key={iso(d)} onClick={() => repeatWeek(d)}>{t("Endurtaka viku")} {d.getDate()}.–{d.getDate() + 6}. {t("út mánuðinn")}</div>
                  ))}
                  <div className="sep" />
                  <div className="mi danger" onClick={clearMonth}>{t("Hreinsa mánuðinn")}</div>
                </div>
              </>
            )}
          </div>
          <button className="btn ghost sm" onClick={onToggleFull} title={full ? t("Loka heilskjá (Esc)") : t("Heilskjár")}>
            {full
              ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5" /></svg>
              : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5" /></svg>}
            {full ? t("Loka") : t("Heilskjár")}
          </button>
        </div>
      </div>
      <div className="mr-wrap">
        <table className="mroster">
          <thead>
            <tr>
              <th className="nm">{t("Starfsmaður")}</th>
              {days.map((d) => {
                const wd = (d.getDay() + 6) % 7;
                return (
                  <th key={d.getDate()} className={`${wd >= 5 ? "we" : ""}${iso(d) === todayISO ? " tod" : ""}`} onClick={() => onOpenDay(d)} title={t("Opna dagsýn")}>
                    <span>{t(DAYS[wd]).slice(0, 2)}</span><b>{d.getDate()}</b>
                  </th>
                );
              })}
              <th className="sum">Σ</th>
            </tr>
          </thead>
          <tbody>
            {loading && !emps.length ? (
              <tr><td colSpan={days.length + 2} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("Hleð…")}</td></tr>
            ) : rows.length === 0 ? (
              <tr><td colSpan={days.length + 2} className="muted" style={{ padding: 24, textAlign: "center" }}>{t("Ekkert starfsfólk í völdum deildum.")}</td></tr>
            ) : rows.map(({ e, g }) => {
              const head = showGroups && g !== lastGroup;
              lastGroup = g;
              const mine = visShifts.filter((s) => s.employeeId === e.id);
              return [
                head ? <tr key={`g-${g}`} className="grp"><td colSpan={days.length + 2}>{g || t("Án deildar")}</td></tr> : null,
                <tr key={e.id}>
                  <td className="nm">
                    <div className="nmi">
                      <span className="avt" style={{ background: e.color }}>{e.init}</span>
                      <span className="who"><b>{e.name}</b>{e.depts.length > 1 && <small>{t("líka")}: {e.depts.filter((d) => d !== g).join(", ")}</small>}</span>
                    </div>
                  </td>
                  {days.map((d) => {
                    const ds = iso(d), s = byCell.get(`${e.id}|${ds}`), lv = leaveOf(e.id, ds);
                    const wd = (d.getDay() + 6) % 7;
                    return (
                      <td key={ds} className={`${wd >= 5 ? "we" : ""}${ds === todayISO ? " tod" : ""}${tool ? " paint" : ""}`} onClick={() => clickCell(e, ds)}
                        onContextMenu={(ev) => { if (s) { ev.preventDefault(); setTool({ kind: "clip", start: s.start, end: s.end, type: s.type }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } }}
                        title={s ? `${e.name} · ${s.start}–${s.end}${s.type ? ` · ${t(s.type)}` : ""}` : lv ? t(LEAVE_LBL[lv.type] ?? "Frí") : undefined}>
                        {s ? <span className="sh" style={typeStyle(s)}>{short(s.start)}<i>{short(s.end)}</i></span>
                          : lv ? <span className="lv">{t(LEAVE_LBL[lv.type] ?? "Frí")}</span> : null}
                      </td>
                    );
                  })}
                  <td className="sum">{mine.length ? dec1(mine.reduce((a, s) => a + hrs(s.start, s.end), 0)) : ""}</td>
                </tr>,
              ];
            })}
          </tbody>
          {rows.length > 0 && (
            <tfoot>
              <tr>
                <td className="nm">{t("Á vakt")}</td>
                {days.map((d) => {
                  const n = visShifts.filter((s) => s.date === iso(d)).length;
                  return <td key={d.getDate()} className={(d.getDay() + 6) % 7 >= 5 ? "we" : ""}>{n || ""}</td>;
                })}
                <td className="sum">{dec1(totHrs)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="mr-foot muted">
        {t("Veldu vaktategund og smelltu á reiti til að fylla mánuðinn hratt · hægrismelltu á vakt til að afrita hana · smelltu á dag efst til að opna dagsýn.")}
      </div>
      {edit && (
        <CellEditor emp={edit.emp} date={edit.date} shift={editShift} types={types} leave={leaveOf(edit.emp.id, edit.date)} monthName={t(MONTHS_IS[m])}
          onClose={() => setEdit(null)}
          onSave={async (st, en, ty) => { setEdit(null); if (await put(edit.emp, edit.date, st, en, ty)) toast(t("Vakt vistuð")); }}
          onDelete={async () => { setEdit(null); await drop(edit.emp, edit.date); toast(t("Vakt eydd")); }}
          onSick={() => { setEdit(null); setVer((v) => v + 1); }}
          onCopy={() => { if (editShift) { setTool({ kind: "clip", start: editShift.start, end: editShift.end, type: editShift.type }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } setEdit(null); }} />
      )}
    </div>
  );
}

function CellEditor({ emp, date, shift, types, leave, monthName, onClose, onSave, onDelete, onCopy, onSick }: {
  emp: PlanEmp; date: string; shift: PlanShift | null; types: ShiftType[]; leave?: PlanLeave; monthName: string;
  onSick?: () => void;
  onClose: () => void; onSave: (start: string, end: string, type: string | null) => void; onDelete: () => void; onCopy: () => void;
}) {
  const { t } = useLang();
  const first = types.find((x) => typeTimes(x));
  const [type, setType] = useState<string>(shift?.type ?? first?.nm ?? "");
  const [start, setStart] = useState(shift?.start ?? typeTimes(first ?? types[0] ?? { nm: "", t: "", prem: "", bg: "", bd: "", fg: "" })?.[0] ?? "08:00");
  const [end, setEnd] = useState(shift?.end ?? typeTimes(first ?? types[0] ?? { nm: "", t: "", prem: "", bg: "", bd: "", fg: "" })?.[1] ?? "16:00");
  const d = new Date(`${date}T12:00:00`);
  const DN = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];
  function pick(ty: ShiftType) { setType(ty.nm); const tt = typeTimes(ty); if (tt) { setStart(tt[0]); setEnd(tt[1]); } }
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{emp.full} · {t(DN[d.getDay()])} {d.getDate()}. {monthName}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          {shift && onSick && !leave && <SickOnShift employeeId={emp.id} name={emp.full} dateISO={date} onDone={onSick} />}
          {leave && <p style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600, marginBottom: 10 }}>{t("ATH: samþykkt frí þennan dag")} ({t(LEAVE_LBL[leave.type] ?? "Frí")})</p>}
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
            {types.map((ty) => (
              <button key={ty.nm} type="button" className={`mr-tool${type === ty.nm ? " on" : ""}`} onClick={() => pick(ty)}
                style={{ background: ty.bg, borderColor: type === ty.nm ? ty.fg : ty.bd, color: ty.fg }}>
                {t(ty.nm)}{ty.t && ty.t !== "–" ? <small>{ty.t.replace(/:00/g, "")}</small> : null}
              </button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{t("Upphaf")}</label><TimeField value={start} onChange={setStart} style={{ width: "100%" }} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t("Lok")}</label><TimeField value={end} onChange={setEnd} style={{ width: "100%" }} /></div>
          </div>
          <p className="muted" style={{ fontSize: 11.5, margin: "-4px 0 10px" }}>{dec1(hrs(start, end))} {t("klst")}{end <= start ? ` · ${t("endar daginn eftir")}` : ""}</p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap" }}>
            <button className="btn" onClick={() => { if (start === end) { toast(t("Upphaf og lok mega ekki vera eins")); return; } onSave(start, end, type || null); }}>{t("Vista")}</button>
            {shift && <button className="btn ghost" onClick={onCopy}>{t("Afrita")}</button>}
            {shift && <button className="btn ghost" style={{ color: "var(--bad)" }} onClick={onDelete}>{t("Eyða vakt")}</button>}
            <button className="btn ghost" onClick={onClose}>{t("Loka")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
