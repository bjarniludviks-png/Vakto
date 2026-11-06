"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import { getPlan, saveShift, deleteShift, copyShifts, clearShifts, type PlanShift, type PlanLeave } from "./actions";
import type { PlanEmp } from "./roster.server";
import { offerUndo } from "./undo-delete";
import { ShiftForm, ShiftSheet, PaintTools, SlotTabs, typeTimes, defaultsFor, type ShiftType, type PaintTool } from "./shift-form";

// Mánaðarplan sem starfsmannatafla: starfsfólk í röðum, dagar mánaðarins í dálkum.
// Allt eftir starfsmanns-id (ekki nafni) og vistast strax. „Mála“-hamur: veldu vaktategund
// og smelltu á reiti — þannig er mánuðurinn mannaður á nokkrum mínútum.

type Tool = PaintTool;

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

export default function MonthRoster({ range, todayISO, types, deptSel, scopeDepts, allDepts = [], onOpenDay, onTotals, full, onToggleFull, onTypes, reloadKey = 0 }: {
  /** Tímabilið sem taflan sýnir — launatímabil fyrirtækisins (t.d. 21. okt.–20. nóv.), annars almanaksmánuður. */
  range: { from: string; to: string }; todayISO: string;
  /** Allar deildir fyrirtækisins — vakt má setja í aðra deild en starfsmaðurinn er skráður í (0110). */
  allDepts?: string[]; types: ShiftType[]; deptSel: string[]; scopeDepts: string[];
  onOpenDay: (d: Date) => void; onTotals: (x: { hrs: number; shifts: number; list: { emp: string; date: string; start: string; end: string }[] }) => void; full: boolean; onToggleFull: () => void;
  /** Opnar vaktategundaglugga Vaktaplansins. */
  onTypes?: () => void;
  /** Breytist þegar foreldrið vill að planið sé sótt aftur (t.d. eftir útgáfu). */
  reloadKey?: number;
}) {
  const { t } = useLang();
  const days = useMemo(() => {
    const out: Date[] = [];
    const d = new Date(`${range.from}T12:00:00`), end = new Date(`${range.to}T12:00:00`);
    while (d <= end && out.length < 62) { out.push(new Date(d.getFullYear(), d.getMonth(), d.getDate())); d.setDate(d.getDate() + 1); }
    return out;
  }, [range.from, range.to]);
  const from = iso(days[0]), to = iso(days[days.length - 1]);
  const [emps, setEmps] = useState<PlanEmp[]>([]);
  const [shifts, setShifts] = useState<PlanShift[]>([]);
  const [leave, setLeave] = useState<PlanLeave[]>([]);
  const [ver, setVer] = useState(0);
  const [loadedKey, setLoadedKey] = useState("");
  const loading = loadedKey !== `${from}|${to}|${ver}`;
  const [tool, setTool] = useState<Tool>(null);
  const [edit, setEdit] = useState<{ emp: PlanEmp; date: string; slot: number } | null>(null);
  const [menu, setMenu] = useState(false);
  const [busy, setBusy] = useState(false);
  // Draga og sleppa: vakt dregin í annan reit færist (Alt/⌥ eða Ctrl = afrita).
  const [dragSrc, setDragSrc] = useState<{ emp: PlanEmp; date: string; slot: number } | null>(null);

  useEffect(() => {
    let gone = false;
    getPlan(from, to).then((res) => {
      if (gone) return;
      setLoadedKey(`${from}|${to}|${ver}`);
      if (!res.ok) { toast(t("Tókst ekki að sækja vaktaplanið — endurhlaðið síðuna.")); return; }
      setEmps(res.employees); setShifts(res.shifts); setLeave(res.leave);
    });
    return () => { gone = true; };
  }, [from, to, ver, reloadKey]); // eslint-disable-line react-hooks/exhaustive-deps -- t breytist ekki

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

  // Allar vaktir dagsins hjá starfsmanni, í röð (0110: fleiri en ein vakt á dag).
  const byCell = useMemo(() => {
    const map = new Map<string, PlanShift[]>();
    for (const s of shifts) { const k = `${s.employeeId}|${s.date}`; (map.get(k) ?? map.set(k, []).get(k)!).push(s); }
    for (const l of map.values()) l.sort((a, b) => a.slot - b.slot || a.start.localeCompare(b.start));
    return map;
  }, [shifts]);
  const cellOf = (eid: string, d: string) => byCell.get(`${eid}|${d}`) ?? [];
  const slotOf = (eid: string, d: string, slot: number) => cellOf(eid, d).find((s) => s.slot === slot);
  const leaveOf = (eid: string, d: string) => leave.find((l) => l.employeeId === eid && l.from <= d && l.to >= d);
  const typeStyle = (s: PlanShift) => {
    const ty = types.find((x) => x.nm === s.type) ?? types.find((x) => typeTimes(x)?.[0] === s.start);
    return ty ? { background: ty.bg, borderColor: ty.bd, color: ty.fg } : undefined;
  };

  const visIds = useMemo(() => new Set(rows.map((r) => r.e.id)), [rows]);
  const visShifts = shifts.filter((s) => visIds.has(s.employeeId) && s.date >= from && s.date <= to);
  const totHrs = visShifts.reduce((a, s) => a + hrs(s.start, s.end), 0);
  // Vaktirnar sjálfar fara upp líka svo kostnaður, álag og yfirvinna mánaðarins reiknist eins og í vikusýn.
  useEffect(() => {
    onTotals({ hrs: Math.round(totHrs * 10) / 10, shifts: visShifts.length, list: visShifts.map((s) => ({ emp: s.employeeId, date: s.date, start: s.start, end: s.end })) });
  }, [totHrs, visShifts.length, shifts]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Vista eina vakt (bjartsýn uppfærsla, bakfært ef þjónninn hafnar). */
  const put = useCallback(async (emp: PlanEmp, date: string, start: string, end: string, type: string | null, slot = 0, dept?: string) => {
    const key = `${emp.id}|${date}`;
    const prev = shifts;
    const old = shifts.find((s) => `${s.employeeId}|${s.date}` === key && s.slot === slot);
    const draft = !(old && !old.draft && old.start === start && old.end === end); // sama regla og saveShift
    const nd = dept === undefined ? old?.dept ?? null : dept || null;
    setShifts((ss) => [...ss.filter((s) => !(`${s.employeeId}|${s.date}` === key && s.slot === slot)), { id: `tmp-${key}-${slot}`, employeeId: emp.id, date, start, end, type, draft, slot, dept: nd }]);
    const res = await saveShift({ employeeName: emp.id, date, startTime: start, endTime: end, shiftTypeName: type ?? "", slot, ...(dept !== undefined ? { deptName: dept } : {}) });
    if (!res.ok) { setShifts(prev); toast(res.error ?? t("Tókst ekki að vista vaktina")); }
    return res.ok;
  }, [shifts, t]);
  const drop = useCallback(async (emp: PlanEmp, date: string, slot = 0) => {
    const key = `${emp.id}|${date}`;
    const prev = shifts;
    // Vaktirnar á eftir færast upp um eitt sæti — eins og þjónninn gerir.
    setShifts((ss) => ss.filter((s) => !(`${s.employeeId}|${s.date}` === key && s.slot === slot))
      .map((s) => (`${s.employeeId}|${s.date}` === key && s.slot > slot ? { ...s, slot: s.slot - 1 } : s)));
    const res = await deleteShift({ employeeName: emp.id, dateISO: date, slot });
    if (!res.ok) { setShifts(prev); toast(res.error ?? t("Tókst ekki að eyða vaktinni")); return; }
    offerUndo(res.deleted, t, () => setVer((v) => v + 1));
  }, [shifts, t]);

  async function dropOn(emp: PlanEmp, date: string, copy: boolean) {
    const src = dragSrc;
    setDragSrc(null);
    if (!src || (src.emp.id === emp.id && src.date === date)) return;
    const s = slotOf(src.emp.id, src.date, src.slot);
    if (!s) return;
    if (cellOf(emp.id, date).length && !window.confirm(t("Það er vakt fyrir í þessum reit. Skipta henni út?"))) return;
    if (!(await put(emp, date, s.start, s.end, s.type, 0, s.dept ?? ""))) return;
    if (copy) { toast(t("Vakt afrituð")); return; }
    const key = `${src.emp.id}|${src.date}`;
    setShifts((ss) => ss.filter((x) => !(`${x.employeeId}|${x.date}` === key && x.slot === src.slot))
      .map((x) => (`${x.employeeId}|${x.date}` === key && x.slot > src.slot ? { ...x, slot: x.slot - 1 } : x)));
    const res = await deleteShift({ employeeName: src.emp.id, dateISO: src.date, slot: src.slot });
    if (!res.ok) { toast(res.error ?? t("Tókst ekki að eyða vaktinni")); setVer((v) => v + 1); return; }
    toast(t("Vakt færð — gefðu planið út svo starfsfólk sjái breytinguna"));
  }

  function clickCell(emp: PlanEmp, date: string) {
    const cur = slotOf(emp.id, date, 0);
    if (tool?.kind === "erase") { if (cur) void drop(emp, date, 0); return; }
    if (tool?.kind === "clip") { void put(emp, date, tool.start, tool.end, tool.type); return; }
    if (tool?.kind === "type") {
      const tt = typeTimes(tool.ty);
      if (tt) { void put(emp, date, tt[0], tt[1], tool.ty.nm); return; }
      if (cur) { void put(emp, date, cur.start, cur.end, tool.ty.nm); return; } // tegund án fasts tíma: aðeins litur/álag
    }
    setEdit({ emp, date, slot: 0 });
  }

  const visibleIds = () => rows.map((r) => r.e.id);
  async function copyLastMonth() {
    // Hver dagur fær sama vikudag úr síðasta mánuði (−28 eða −35 dagar) svo helgar lendi á helgum.
    const first = days[0];
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
    toast(`${res.count ?? 0} ${t("vaktir afritaðar")}${res.skippedLeave ? ` · ${res.skippedLeave} ${t("slepptu vegna frís")}` : ""}${res.skippedClosed ? ` · ${res.skippedClosed} ${t("slepptu vegna lokaðra daga")}` : ""}`);
    setVer((v) => v + 1);
  }
  async function clearMonth() {
    if (!window.confirm(t("Eyða öllum vöktum mánaðarins hjá starfsfólkinu sem sést?"))) return;
    setBusy(true); setMenu(false);
    const res = await clearShifts({ dates: days.map(iso), employeeIds: visibleIds() });
    setBusy(false);
    if (res.ok && res.deleted?.length) offerUndo(res.deleted, t, () => setVer((v) => v + 1));
    else toast(res.ok ? `${res.count ?? 0} ${t("vöktum eytt")}` : (res.error ?? "Villa"));
    setVer((v) => v + 1);
  }
  // Mánudagar sem byrja viku innan mánaðarins — til að velja „endurtaka viku“.
  const mondays = days.filter((d, i) => d.getDay() === 1 && i + 6 < days.length);

  const editShift = edit ? slotOf(edit.emp.id, edit.date, edit.slot) ?? null : null;
  const editDay = edit ? cellOf(edit.emp.id, edit.date) : [];
  let lastGroup: string | null = null;

  return (
    <div className={`card mroster-card${full ? " full" : ""}`} style={{ marginTop: full ? 0 : 16 }}>
      <div className="mr-bar">
        <PaintTools types={types} tool={tool} setTool={setTool} onTypes={onTypes} />
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
                    const ds = iso(d), list = cellOf(e.id, ds), s = list[0], lv = leaveOf(e.id, ds);
                    const wd = (d.getDay() + 6) % 7;
                    return (
                      <td key={ds} className={`${wd >= 5 ? "we" : ""}${ds === todayISO ? " tod" : ""}${tool ? " paint" : ""}`} onClick={() => clickCell(e, ds)}
                        onDragOver={dragSrc ? (ev) => { ev.preventDefault(); ev.dataTransfer.dropEffect = ev.altKey || ev.ctrlKey ? "copy" : "move"; ev.currentTarget.classList.add("cellh"); } : undefined}
                        onDragLeave={(ev) => ev.currentTarget.classList.remove("cellh")}
                        onDrop={(ev) => { ev.preventDefault(); ev.currentTarget.classList.remove("cellh"); void dropOn(e, ds, ev.altKey || ev.ctrlKey); }}
                        onContextMenu={(ev) => { if (s) { ev.preventDefault(); setTool({ kind: "clip", start: s.start, end: s.end, type: s.type }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } }}
                        title={list.length ? `${e.name} · ${list.map((x) => `${x.start}–${x.end}${x.type ? ` ${t(x.type)}` : ""}${x.dept ? ` (${x.dept})` : ""}`).join(" + ")}` : lv ? t(LEAVE_LBL[lv.type] ?? "Frí") : undefined}>
                        {list.length ? <span className="shs">{list.map((x) => (
                          <span key={x.slot} className={`sh${x.draft ? " draft" : ""}`} style={typeStyle(x)} draggable={!tool}
                            onClick={(ev) => { if (!tool && list.length > 1) { ev.stopPropagation(); setEdit({ emp: e, date: ds, slot: x.slot }); } }}
                            onDragStart={(ev) => { ev.dataTransfer.effectAllowed = "copyMove"; ev.dataTransfer.setData("text/plain", `${x.start}-${x.end}`); setDragSrc({ emp: e, date: ds, slot: x.slot }); }}
                            onDragEnd={() => setDragSrc(null)} title={x.draft ? t("Drög — ekki útgefið") : undefined}>{short(x.start)}<i>{short(x.end)}</i></span>
                        ))}</span>
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
                  const n = new Set(visShifts.filter((s) => s.date === iso(d)).map((s) => s.employeeId)).size;
                  return <td key={d.getDate()} className={(d.getDay() + 6) % 7 >= 5 ? "we" : ""}>{n || ""}</td>;
                })}
                <td className="sum">{dec1(totHrs)}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
      <div className="mr-foot muted">
        {t("Veldu vaktategund og smelltu á reiti til að fylla mánuðinn hratt · dragðu vakt til að færa hana (haltu ⌥/Alt til að afrita) · hægrismelltu á vakt til að afrita hana · smelltu á dag efst til að opna dagsýn.")}
      </div>
      {edit && (
        <CellEditor key={`${edit.emp.id}|${edit.date}|${edit.slot}`} emp={edit.emp} date={edit.date} shift={editShift} day={editDay} slot={edit.slot} allDepts={allDepts}
          types={types} leave={leaveOf(edit.emp.id, edit.date)} monthName={t(MONTHS_IS[new Date(`${edit.date}T12:00:00`).getMonth()])}
          onClose={() => setEdit(null)}
          onPickSlot={(sl) => setEdit({ ...edit, slot: sl })}
          onSave={async (st, en, ty, dp) => { setEdit(null); if (await put(edit.emp, edit.date, st, en, ty, edit.slot, dp)) toast(t("Vakt vistuð")); }}
          onDelete={async () => { setEdit(null); await drop(edit.emp, edit.date, edit.slot); }}
          onSick={() => { setEdit(null); setVer((v) => v + 1); }}
          onCopy={() => { if (editShift) { setTool({ kind: "clip", start: editShift.start, end: editShift.end, type: editShift.type }); toast(t("Vakt afrituð — smelltu á reiti til að líma")); } setEdit(null); }} />
      )}
    </div>
  );
}

function CellEditor({ emp, date, shift, day, slot, allDepts, types, leave, monthName, onClose, onSave, onDelete, onCopy, onSick, onPickSlot }: {
  emp: PlanEmp; date: string; shift: PlanShift | null; day: PlanShift[]; slot: number; allDepts: string[]; types: ShiftType[]; leave?: PlanLeave; monthName: string;
  onSick?: () => void; onPickSlot: (slot: number) => void;
  onClose: () => void; onSave: (start: string, end: string, type: string | null, dept?: string) => void; onDelete: () => void; onCopy: () => void;
}) {
  const { t } = useLang();
  const d = new Date(`${date}T12:00:00`);
  const DN = ["Sunnudagur", "Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur"];
  // Ný aukavakt byrjar þar sem síðasta vakt dagsins endar (morgunmatur 7–10 → þrif frá 10).
  const last = day[day.length - 1];
  const init = shift ? { type: shift.type ?? "", start: shift.start, end: shift.end, dept: shift.dept ?? undefined }
    : last ? { ...defaultsFor(types), type: "", start: last.end, end: `${String((Number(last.end.slice(0, 2)) + 4) % 24).padStart(2, "0")}${last.end.slice(2)}` }
    : defaultsFor(types);
  return (
    <ShiftSheet title={`${emp.full} · ${t(DN[d.getDay()])} ${d.getDate()}. ${monthName}`} onClose={onClose}>
      <ShiftForm types={types} initial={init} isEdit={!!shift} depts={emp.depts} mainDept={emp.dept} otherDepts={allDepts}
        head={<SlotTabs items={day} current={slot} onPick={onPickSlot} onAdd={() => onPickSlot(day.length)} />}
        notice={leave ? `${t("ATH: samþykkt frí þennan dag")} (${t(LEAVE_LBL[leave.type] ?? "Frí")})` : null}
        sick={onSick && !leave ? { employeeId: emp.id, name: emp.full, dateISO: date, onDone: onSick } : null}
        onSave={(st, en, ty, dp) => onSave(st, en, ty || null, dp)} onDelete={onDelete} onCopy={onCopy} onClose={onClose} />
    </ShiftSheet>
  );
}
