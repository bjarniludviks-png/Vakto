"use client";

// Planið — read-only team schedule (Sling-style transparency) + coworkers.
// Week strip → Mínar / Allir / Lausar / Samstarfsfólk. Click a shift → detail
// with everyone working at the same time.

import { useCallback, useEffect, useMemo, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { applyForShift } from "@/app/(app)/mitt-svaedi/actions";
import { getPlan, getCoworkers, type PlanShift, type Coworker } from "./actions";

const DAY_L = ["Mán", "Þri", "Mið", "Fim", "Fös", "Lau", "Sun"];
const DAY_FULL = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const MONTHS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function mondayOf(d: Date): Date {
  const m = new Date(d);
  m.setDate(m.getDate() - ((m.getDay() + 6) % 7));
  m.setHours(0, 0, 0, 0);
  return m;
}
const soft = (hex: string) => hex + "1f";
const dec1i = (n: number) => String(Math.round(n * 10) / 10).replace(".", ",");

function coworkersOf(all: PlanShift[], shift: PlanShift): PlanShift[] {
  const s1 = shift.start ?? "00:00";
  const e1raw = shift.end ?? "24:00";
  const e1 = e1raw <= s1 ? "24:00" : e1raw;
  return all.filter((s) => {
    if (s.id === shift.id || s.date !== shift.date || !s.empId || s.empId === shift.empId) return false;
    const s2 = s.start ?? "00:00";
    const e2raw = s.end ?? "24:00";
    const e2 = e2raw <= s2 ? "24:00" : e2raw;
    return s2 < e1 && s1 < e2;
  });
}

type Tab = "mine" | "all" | "open" | "people";

export default function PlanScreen() {
  const { t } = useLang();
  const todayISO = iso(new Date());
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [selDate, setSelDate] = useState(todayISO);
  const [tab, setTab] = useState<Tab>("mine");
  const [shifts, setShifts] = useState<PlanShift[]>([]);
  const [people, setPeople] = useState<Coworker[]>([]);
  const [live, setLive] = useState(true);
  const [detail, setDetail] = useState<PlanShift | null>(null);
  const [applied, setApplied] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const load = useCallback(() => {
    getPlan(iso(weekStart)).then((r) => { setShifts(r.shifts); setLive(r.live); });
  }, [weekStart]);
  useEffect(load, [load]);
  useEffect(() => { getCoworkers().then((r) => setPeople(r.people)); }, []);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + i);
      return iso(d);
    }),
    [weekStart]
  );
  const mineByDay = useMemo(() => {
    const m = new Map<string, PlanShift[]>();
    for (const s of shifts) if (s.mine) m.set(s.date, [...(m.get(s.date) ?? []), s]);
    return m;
  }, [shifts]);
  const allOnSel = useMemo(() => shifts.filter((s) => s.date === selDate && !s.open), [shifts, selDate]);
  const openShifts = useMemo(() => shifts.filter((s) => s.open), [shifts]);
  const myHours = useMemo(() => shifts.filter((s) => s.mine).reduce((a, s) => a + s.hours, 0), [shifts]);
  const midD = new Date(days[3] + "T12:00:00");
  const isThisWeek = days.includes(todayISO);

  function moveWeek(delta: number) {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + delta * 7);
    setWeekStart(d);
    setSelDate(iso(d));
  }

  async function apply(s: PlanShift) {
    if (applied.has(s.id)) return;
    setApplied((x) => new Set(x).add(s.id));
    const d = new Date(s.date + "T12:00:00");
    const r = await applyForShift({ note: `${DAY_L[(d.getDay() + 6) % 7]} ${d.getDate()}.${d.getMonth() + 1} ${s.start ?? ""}–${s.end ?? ""}` });
    toast(r.ok ? t("Umsókn send — vaktstjóri fer yfir hana") : (r.error ?? "Villa"));
    setDetail(null);
  }

  const shownPeople = people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <PageHeader title="Planið" subtitle="Vaktir vikunnar — þínar og alls teymisins" />

      {/* week nav + day strip */}
      <div className="card" style={{ marginTop: 14 }}>
        <div className="cb" style={{ padding: "12px 14px" }}>
          <div className="plan-weeknav">
            <button className="iconbtn" onClick={() => moveWeek(-1)} aria-label="fyrri vika">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M15 18l-6-6 6-6" /></svg>
            </button>
            <b>{new Date(days[0] + "T12:00:00").getDate()}.–{new Date(days[6] + "T12:00:00").getDate()}. {t(MONTHS[midD.getMonth()])} {midD.getFullYear()}</b>
            {!isThisWeek && (
              <button className="btn ghost sm" onClick={() => { setWeekStart(mondayOf(new Date())); setSelDate(todayISO); }}>
                {t("Í dag")}
              </button>
            )}
            <button className="iconbtn" onClick={() => moveWeek(1)} aria-label="næsta vika">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l6 6-6 6" /></svg>
            </button>
          </div>
          <div className="plan-strip">
            {days.map((d, i) => {
              const on = d === selDate;
              const today = d === todayISO;
              return (
                <button
                  key={d}
                  className={`plan-day${on ? " on" : ""}${today ? " today" : ""}`}
                  onClick={() => { setSelDate(d); if (tab === "mine" || tab === "people") setTab("all"); }}
                >
                  <span className="dl">{t(DAY_L[i])}</span>
                  <span className="dn">{new Date(d + "T12:00:00").getDate()}</span>
                  <i className={mineByDay.has(d) ? "dot on" : "dot"} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* tabs */}
      <div className="plan-tabs">
        {([["mine", t("plan:mine")], ["all", t("Allir")], ["open", `${t("Lausar")}${openShifts.length ? ` (${openShifts.length})` : ""}`], ["people", t("Samstarfsfólk")]] as [Tab, string][]).map(([k, label]) => (
          <button key={k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {!live && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="cb"><p className="muted" style={{ margin: 0, fontSize: 13 }}>{t("Planið birtist þegar Supabase er tengt.")}</p></div>
        </div>
      )}

      {/* MÍNAR */}
      {tab === "mine" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ch"><div className="ct">{t("Vikan mín")}</div><span className="muted" style={{ fontSize: 13 }}>{dec1i(myHours)} {t("klst")}</span></div>
          <div className="cb" style={{ paddingTop: 4 }}>
            {days.map((d, i) => {
              const mine = mineByDay.get(d) ?? [];
              const today = d === todayISO;
              return (
                <div className="plan-myrow" key={d}>
                  <div className={`plan-date${today ? " today" : ""}`}>
                    <b>{new Date(d + "T12:00:00").getDate()}</b>
                    <span>{t(DAY_L[i]).toUpperCase()}</span>
                  </div>
                  <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                    {mine.length ? mine.map((s) => (
                      <button key={s.id} className="plan-shift mine" style={{ background: soft(s.color), borderLeftColor: s.color }} onClick={() => setDetail(s)}>
                        <b>{s.start}–{s.end} · {dec1i(s.hours)} {t("klst")}</b>
                        <span>{[s.typeName, s.dept].filter(Boolean).join(" · ") || t("plan:vakt")}</span>
                      </button>
                    )) : (
                      <span className="muted" style={{ fontSize: 13, padding: "8px 0" }}>
                        {today ? t("Engin vakt í dag — slakaðu á.") : t("Engin vakt.")}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ALLIR */}
      {tab === "all" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ch">
            <div className="ct">{t(DAY_FULL[(new Date(selDate + "T12:00:00").getDay() + 6) % 7])} {new Date(selDate + "T12:00:00").getDate()}. — {t("allar vaktir")}</div>
            <span className="muted" style={{ fontSize: 13 }}>{allOnSel.length}</span>
          </div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            {allOnSel.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t("Engar vaktir á plani þennan dag.")}</span>}
            {allOnSel.map((s) => (
              <button key={s.id} className={`plan-shift row${s.mine ? " mineflag" : ""}`} style={{ borderLeftColor: s.color, background: s.mine ? soft(s.color) : undefined }} onClick={() => setDetail(s)}>
                <span className="avt" style={{ background: soft(s.color), color: s.color, width: 34, height: 34, fontSize: 12, fontWeight: 700 }}>
                  {(s.empName ?? "?").trim().split(/\s+/)[0].slice(0, 2).toUpperCase()}
                </span>
                <span className="tx">
                  <b>{s.empName}{s.mine ? ` · ${t("þú")}` : ""}</b>
                  <span>{[s.typeName, s.dept].filter(Boolean).join(" · ") || t("plan:vakt")}</span>
                </span>
                <span className="tm"><b>{s.start}–{s.end}</b><span>{dec1i(s.hours)} {t("klst")}</span></span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* LAUSAR */}
      {tab === "open" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ch"><div className="ct">{t("Lausar vaktir vikunnar")}</div></div>
          <div className="cb" style={{ display: "flex", flexDirection: "column", gap: 8, paddingTop: 4 }}>
            {openShifts.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t("Engar lausar vaktir í boði þessa viku.")}</span>}
            {openShifts.map((s) => {
              const d = new Date(s.date + "T12:00:00");
              return (
                <div key={s.id} className="plan-shift row" style={{ borderLeftColor: s.color, cursor: "default" }}>
                  <span className="tx" style={{ flex: 1 }}>
                    <b>{t(DAY_L[(d.getDay() + 6) % 7])} {d.getDate()}.{d.getMonth() + 1} · {s.start ?? "?"}–{s.end ?? "?"}</b>
                    <span>{[s.typeName, s.dept, s.hours ? `${dec1i(s.hours)} ${t("klst")}` : null].filter(Boolean).join(" · ") || t("Opin vakt")}</span>
                  </span>
                  <button className="btn sm" disabled={applied.has(s.id)} onClick={() => apply(s)}>
                    {applied.has(s.id) ? t("Sótt um") : t("Sækja um")}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* SAMSTARFSFÓLK */}
      {tab === "people" && (
        <div className="card" style={{ marginTop: 12 }}>
          <div className="ch">
            <div className="ct">{t("Samstarfsfólk")} · {people.length}</div>
            <div className="srchbox" style={{ maxWidth: 220 }}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg>
              <input placeholder={t("Leita")} value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="cb plan-people">
            {shownPeople.map((p) => (
              <div className="plan-person" key={p.id}>
                {p.photo ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.photo} alt="" />
                ) : (
                  <span className="avt" style={{ background: p.color, width: 44, height: 44, fontSize: 15 }}>{p.av}</span>
                )}
                <div className="tx">
                  <b>{p.name}</b>
                  <span className="muted">{[p.title, p.dept].filter(Boolean).join(" · ") || t("Starfsmaður")}</span>
                  <span className="plan-contact">
                    {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}
                    {p.phone && p.email && " · "}
                    {p.email && <a href={`mailto:${p.email}`}>{p.email}</a>}
                  </span>
                </div>
              </div>
            ))}
            {shownPeople.length === 0 && <span className="muted" style={{ fontSize: 13 }}>{t("Enginn starfsmaður fannst")}</span>}
          </div>
        </div>
      )}

      {/* detail modal */}
      {detail && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setDetail(null)}>
          <div className="mbg" onClick={() => setDetail(null)} />
          <div className="modal" style={{ overflow: "hidden" }}>
            <div className="plan-dhead" style={{ background: detail.color }}>
              <div className="dnum">
                <b>{new Date(detail.date + "T12:00:00").getDate()}</b>
                <span>{t(DAY_L[(new Date(detail.date + "T12:00:00").getDay() + 6) % 7])}</span>
              </div>
              <div style={{ flex: 1 }}>
                <b style={{ fontSize: 17 }}>{detail.start && detail.end ? `${detail.start}–${detail.end} · ${dec1i(detail.hours)} ${t("klst")}` : t("Opin vakt")}</b>
                <div style={{ fontSize: 13, opacity: 0.9 }}>{[detail.typeName, detail.dept].filter(Boolean).join(" · ") || t("plan:vakt")}</div>
              </div>
              <button className="x" style={{ color: "#fff" }} onClick={() => setDetail(null)}>✕</button>
            </div>
            <div className="mb">
              <div className="plan-drow"><span className="muted">{t("Starfsmaður")}</span><b>{detail.open ? t("Opin vakt — laus til umsóknar") : detail.empName}</b></div>
              <div className="plan-drow"><span className="muted">{t("Dagsetning")}</span><b>{t(DAY_FULL[(new Date(detail.date + "T12:00:00").getDay() + 6) % 7])}, {new Date(detail.date + "T12:00:00").getDate()}. {t(MONTHS[new Date(detail.date + "T12:00:00").getMonth()])}</b></div>
              {detail.typeName && <div className="plan-drow"><span className="muted">{t("plan:type")}</span><b>{detail.typeName}</b></div>}
              {detail.dept && <div className="plan-drow"><span className="muted">{t("Deild")}</span><b>{detail.dept}</b></div>}
              <div className="plan-drow" style={{ alignItems: "flex-start" }}>
                <span className="muted">{t("Samstarfsfólk á vaktinni")}</span>
                <div style={{ display: "flex", flexDirection: "column", gap: 7, flex: 1 }}>
                  {coworkersOf(shifts, detail).length === 0 && <b>{t("Enginn annar á sama tíma")}</b>}
                  {coworkersOf(shifts, detail).slice(0, 10).map((c) => (
                    <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 9 }}>
                      <span className="avt" style={{ background: soft(c.color), color: c.color, width: 28, height: 28, fontSize: 11, fontWeight: 700 }}>
                        {(c.empName ?? "?").trim().split(/\s+/)[0].slice(0, 2).toUpperCase()}
                      </span>
                      <b style={{ fontSize: 13.5, flex: 1 }}>{c.empName}</b>
                      <span className="muted" style={{ fontSize: 12.5, fontVariantNumeric: "tabular-nums" }}>{c.start}–{c.end}</span>
                    </div>
                  ))}
                </div>
              </div>
              {detail.open && (
                <button className="btn" style={{ marginTop: 12, width: "100%", justifyContent: "center" }} disabled={applied.has(detail.id)} onClick={() => apply(detail)}>
                  {applied.has(detail.id) ? t("Sótt um — vaktstjóri fer yfir") : t("Sækja um þessa vakt")}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
