"use client";

// Verkefni og ábyrgð (0111) — stjórnendasíða: Í dag · Listar · Hlutverk · Skipurit · Frávik.
// Gögnin „hver á að gera hvað“ koma úr tasks_board (sama SQL-regla og appið notar).

import "./verkefni.css";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { Icon } from "@/components/app/icons";
import { CATEGORY_LABEL, VIA_LABEL, counts, isLate, recurrenceText, type BoardRow, type DayAdhoc, type DayItem, type DayList } from "@/lib/tasks";
import {
  getTasksOverview, tickTask, deleteAdhocTask, returnHandover, setListActive, setIncidentStatus,
  type TasksOverview, type TaskPerson, type TaskRole, type TaskListDef,
} from "./actions";
import { AdhocModal, HandoverModal, ListEditor, RoleEditor, PersonModal, personAv, isoOf } from "./editors";

type Tab = "dag" | "listar" | "hlutverk" | "skipurit" | "fravik";
const TABS: [Tab, string][] = [["dag", "Í dag"], ["listar", "Listar"], ["hlutverk", "Hlutverk"], ["skipurit", "Skipurit"], ["fravik", "tk:Frávik"]];
const MONTHS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ág.", "sep.", "okt.", "nóv.", "des."];
const DOW = ["sunnudagur", "mánudagur", "þriðjudagur", "miðvikudagur", "fimmtudagur", "föstudagur", "laugardagur"];
const INC_LABEL: Record<string, string> = { hitastig: "Hitastig", vara: "Vara vantar", bilun: "Bilun", atvik: "Atvik", verkefni: "Verkefni ekki klárað", annad: "Annað" };

const dayLabel = (iso: string, today: string) => {
  const d = new Date(iso + "T12:00:00");
  const rel = iso === today ? "Í dag" : DOW[d.getDay()].replace(/^./, (c) => c.toUpperCase());
  return `${rel}, ${d.getDate()}. ${MONTHS[d.getMonth()]}`;
};
const shiftDay = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoOf(d); };
const nowHM = () => { const d = new Date(); return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`; };
const hm = (iso: string | null) => (iso ? new Date(iso).toTimeString().slice(0, 5) : "");

function Check({ on, onClick, disabled }: { on: boolean; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" className={`tk-ck${on ? " on" : ""}`} onClick={onClick} disabled={disabled} aria-pressed={on}>
      {on && <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={3}><path d="M5 12.5l4.5 4.5L19 7.5" /></svg>}
    </button>
  );
}

export default function VerkefniScreen({ initial, initialTab }: { initial: TasksOverview; initialTab?: string }) {
  const { t } = useLang();
  const [data, setData] = useState<TasksOverview>(initial);
  const [date, setDate] = useState(initial.date);
  const [tab, setTab] = useState<Tab>(TABS.some(([k]) => k === initialTab) ? (initialTab as Tab) : "dag");
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [modal, setModal] = useState<
    | { k: "adhoc"; emp?: string } | { k: "handover"; from: TaskPerson } | { k: "list"; list: TaskListDef | null }
    | { k: "role"; role: TaskRole | null } | { k: "person"; person: TaskPerson } | null
  >(null);
  const today = useMemo(() => isoOf(new Date()), []);
  const dateRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async (d = date) => { const r = await getTasksOverview(d); setData(r); }, [date]);
  const goDate = (d: string) => { setDate(d); reload(d); };
  // Hök starfsfólks í appinu birtast án þess að endurhlaða (létt poll, eins og spjallið).
  useEffect(() => { const iv = setInterval(() => { if (document.visibilityState === "visible") reload(); }, 30000); return () => clearInterval(iv); }, [reload]);

  const people = data.people;
  const byId = useMemo(() => new Map(people.map((p) => [p.id, p])), [people]);
  const nm = (id: string | null | undefined) => (id ? byId.get(id)?.name ?? "" : "");
  const first = (id: string | null | undefined) => nm(id).split(" ")[0];

  const tot = data.board.reduce((a, r) => { const c = counts(r); return { done: a.done + c.done, total: a.total + c.total }; }, { done: 0, total: 0 });
  // Sameiginleg atriði birtast hjá öllum sem eiga þau — teljum hvert einu sinni.
  const uniq = useMemo(() => {
    const seen = new Set<string>(); let done = 0, total = 0, late = 0; const now = nowHM();
    for (const r of data.board) {
      for (const l of r.lists) for (const i of l.items) {
        const k = l.shared ? `${i.id}` : `${i.id}:${r.employee_id}`;
        if (seen.has(k)) continue; seen.add(k); total++; if (i.done) done++;
        if (isLate(l.due_time, i.done, now, date === today)) late++;
      }
      for (const a of r.adhoc) { if (seen.has(a.id)) continue; seen.add(a.id); total++; if (a.done) done++; if (isLate(a.due_time, a.done, now, date === today)) late++; }
    }
    return { done, total, late };
  }, [data.board, date, today]);
  const activeHo = data.handovers.filter((h) => h.start <= date && (!h.end || h.end >= date));
  const openInc = data.incidents.filter((i) => i.status === "open").length;

  async function tick(kind: "item" | "adhoc", id: string, done: boolean, owner?: string) {
    // Bjartsýn uppfærsla: hakið sést strax, endurhlaðið á eftir.
    setData((d) => ({ ...d, board: d.board.map((r) => ({
      ...r,
      lists: r.lists.map((l) => ({ ...l, items: l.items.map((i) => (i.id === id && (l.shared || r.employee_id === owner) ? { ...i, done, done_at: new Date().toISOString(), done_by_name: null } : i)) })),
      adhoc: r.adhoc.map((a) => (a.id === id ? { ...a, done } : a)),
    })) }));
    const r = await tickTask(kind, id, date, done, { owner });
    if (!r.ok) toast(r.error ?? "Villa", "error");
    reload();
  }

  if (data.missing) {
    return (
      <div className="db2x tk-wrap">
        <div className="db2-top"><div><h1>{t("Verkefni")}</h1><div className="db2-sub">{t("Hlutverk, listar og ábyrgð")}</div></div></div>
        <div className="tk-missing">{t("Gagnagrunnurinn er ekki tilbúinn fyrir verkefni ennþá (migration 0111). Keyra þarf hana áður en síðan virkar.")}</div>
      </div>
    );
  }

  return (
    <div className="db2x tk-wrap">
      <div className="db2-top">
        <div><h1>{t("Verkefni")}</h1><div className="db2-sub">{t("Hlutverk, listar og ábyrgð — hver gerir hvað í dag")}</div></div>
        <div className="tk-bar">
          <div className="tk-day">
            <button onClick={() => goDate(shiftDay(date, -1))} aria-label={t("Fyrri dagur")}>‹</button>
            <b onClick={() => dateRef.current?.showPicker?.()} style={{ cursor: "pointer" }}>{t(dayLabel(date, today))}</b>
            <input ref={dateRef} type="date" value={date} onChange={(e) => e.target.value && goDate(e.target.value)} />
            <button onClick={() => goDate(shiftDay(date, 1))} aria-label={t("Næsti dagur")}>›</button>
          </div>
          <button className="btn" onClick={() => setModal({ k: "adhoc" })}><Icon name="plus" className="ic" />{t("Nýtt verkefni")}</button>
        </div>
      </div>

      <div className="tk-bar">
        <div className="db2-seg" role="tablist">
          {TABS.map(([k, l]) => (
            <button key={k} role="tab" aria-selected={tab === k} className={tab === k ? "on" : ""} onClick={() => setTab(k)}>
              {t(l)}{k === "fravik" && openInc > 0 ? ` (${openInc})` : ""}
            </button>
          ))}
        </div>
      </div>

      {tab === "dag" && <>
        <div className="tk-kpis">
          <div className="db2-card tk-kpi"><div className="l">{t("Klárað")}</div><div className="v">{uniq.done}<small>/ {uniq.total}</small></div></div>
          <div className={`db2-card tk-kpi${uniq.late ? " bad" : ""}`}><div className="l">{t("Komið fram yfir tíma")}</div><div className="v">{uniq.late}</div></div>
          <div className="db2-card tk-kpi"><div className="l">{t("Færð ábyrgð")}</div><div className="v">{activeHo.length}</div></div>
          <div className={`db2-card tk-kpi${openInc ? " bad" : ""}`}><div className="l">{t("Opin frávik")}</div><div className="v">{openInc}</div></div>
        </div>

        {activeHo.map((h) => (
          <div className="tk-banner" key={h.id}>
            <span className="ic"><Icon name="swap" /></span>
            <div className="tk-grow">
              <b>{first(h.fromId)}</b> {t("færði")} <b>{h.roleId ? data.roles.find((r) => r.id === h.roleId)?.name ?? t("hlutverk") : t("allar ábyrgðir")}</b> {t("til")} <b>{first(h.toId)}</b>
              {" · "}{h.end ? (h.end === h.start ? t("í dag") : `${t("til")} ${h.end.slice(8, 10)}.${h.end.slice(5, 7)}.`) : t("þar til skilað")}
              {h.note && <span style={{ color: "var(--ink3)" }}> — „{h.note}“</span>}
            </div>
            <button className="btn ghost sm" onClick={async () => { const r = await returnHandover(h.id); if (!r.ok) toast(r.error ?? "Villa", "error"); else { toast(`${t("Skilað til")} ${first(h.fromId)}`); reload(); } }}>
              {t("Skila til")} {first(h.fromId)}
            </button>
          </div>
        ))}

        {tot.total > 0 && uniq.done === uniq.total && <div className="tk-good"><Icon name="shield" />{t("Allt klárað í dag. Vel gert hjá liðinu!")}</div>}

        <div className="db2-card tk-card">
          <div className="tk-head">
            <div><h3>{t("Eftir fólki")}</h3><div className="sub">{t("Smelltu á manneskju til að sjá listana hennar")}</div></div>
          </div>
          {data.board.length === 0 ? (
            <div className="tk-empty">
              <b>{t("Engin verkefni þennan dag")}</b>
              {data.lists.length === 0 ? t("Byrjaðu á að búa til hlutverk og grunnlista — þá birtast verkefnin sjálfkrafa hjá réttu fólki.") : t("Enginn er á vakt eða með lista þennan dag.")}
              <div style={{ marginTop: 12, display: "flex", gap: 8, justifyContent: "center", flexWrap: "wrap" }}>
                <button className="btn ghost sm" onClick={() => setTab("hlutverk")}>{t("Hlutverk")}</button>
                <button className="btn sm" onClick={() => setModal({ k: "list", list: null })}>+ {t("Nýr listi")}</button>
              </div>
            </div>
          ) : data.board.map((r) => (
            <PersonRow key={r.employee_id} r={r} open={open.has(r.employee_id)} today={date === today}
              toggle={() => { const n = new Set(open); if (n.has(r.employee_id)) n.delete(r.employee_id); else n.add(r.employee_id); setOpen(n); }}
              onTick={tick}
              onDelete={async (id) => { const x = await deleteAdhocTask(id); if (!x.ok) toast(x.error ?? "Villa", "error"); else reload(); }}
              onHandover={() => { const p = byId.get(r.employee_id); if (p) setModal({ k: "handover", from: p }); }}
              onTask={() => setModal({ k: "adhoc", emp: r.employee_id })}
            />
          ))}
        </div>
      </>}

      {tab === "listar" && <>
        <div className="tk-bar"><div className="tk-grow" style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Grunnlistar endurtaka sig sjálfkrafa og fara á rétt fólk eftir hlutverki og vöktum.")}</div>
          <button className="btn" onClick={() => setModal({ k: "list", list: null })}><Icon name="plus" className="ic" />{t("Nýr listi")}</button></div>
        {data.lists.length === 0 ? <div className="db2-card tk-empty"><b>{t("Engir listar ennþá")}</b>{t("t.d. Opnunarlisti, Mánudagslisti, Þrifalisti eldhús, Lokunarlisti.")}</div> : (
          <div className="tk-grid">
            {data.lists.map((l) => {
              const role = data.roles.find((r) => r.id === l.roleId);
              const who = l.target === "role" ? role?.name ?? "—" : l.target === "employee" ? nm(l.employeeId) : t("Allir á vakt");
              return (
                <div key={l.id} className={`db2-card tk-tpl${l.active ? "" : " off"}`}>
                  <div className="top"><span className="tk-dot" style={{ background: role?.color ?? "var(--brand)" }} />
                    <div className="tk-grow"><div className="nm">{l.name}</div><div style={{ fontSize: 12, color: "var(--ink3)" }}>{t(CATEGORY_LABEL[l.category])} · {l.items.length} {t("atriði")}</div></div>
                    {!l.active && <span className="db2-pill mut">{t("Óvirkur")}</span>}
                  </div>
                  <div className="rows">
                    <div><span>{t("Hvenær")}</span>{t(recurrenceText(l.weekdays, l.monthDay))}{l.dueTime ? ` · ${t("fyrir kl.")} ${l.dueTime}` : ""}</div>
                    <div><span>{t("Hver")}</span>{who}</div>
                    <div><span>{t("Hak")}</span>{l.shared ? t("Sameiginlegt") : t("Hver fyrir sig")}</div>
                    <div><span>{t("Ef gleymist")}</span>{l.escalate ? t("Yfirmaður fær að vita") : t("Engin tilkynning")}</div>
                  </div>
                  <div className="acts">
                    <button className="btn ghost sm" onClick={() => setModal({ k: "list", list: l })}>{t("Breyta")}</button>
                    <button className="btn ghost sm" onClick={() => setModal({ k: "list", list: { ...l, id: "", name: `${l.name} (${t("afrit")})`, items: l.items.map((i) => ({ ...i, id: "" })) } })}>{t("Afrita")}</button>
                    <button className="btn ghost sm" onClick={async () => { const r = await setListActive(l.id, !l.active); if (!r.ok) toast(r.error ?? "Villa", "error"); else reload(); }}>{l.active ? t("Gera óvirkan") : t("Virkja")}</button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {tab === "hlutverk" && <>
        <div className="tk-bar"><div className="tk-grow" style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Föst hlutverk á fólki, hvert með varamanni sem tekur sjálfkrafa við þegar handhafinn er í fríi eða veikur.")}</div>
          <button className="btn" onClick={() => setModal({ k: "role", role: null })}><Icon name="plus" className="ic" />{t("Nýtt hlutverk")}</button></div>
        {data.roles.length === 0 ? <div className="db2-card tk-empty"><b>{t("Engin hlutverk ennþá")}</b>{t("t.d. Vaktstjóri, Yfirkokkur, Bílstjóri, Opnun, Lokun.")}</div> : (
          <div className="tk-grid">
            {data.roles.map((r) => {
              const fast = r.holders.filter((h) => !h.backup), vara = r.holders.filter((h) => h.backup);
              const st = data.shiftTypes.find((s) => s.id === r.shiftTypeId);
              return (
                <div key={r.id} className="db2-card tk-tpl">
                  <div className="top"><span className="tk-dot" style={{ background: r.color ?? "var(--brand)" }} />
                    <div className="tk-grow"><div className="nm">{r.name}</div>{r.description && <div style={{ fontSize: 12, color: "var(--ink3)" }}>{r.description}</div>}</div>
                    {st && <span className="tk-chip vakt">{t("Fylgir")} {st.name}</span>}
                  </div>
                  {r.responsibilities.length > 0 && <ul className="tk-resp">{r.responsibilities.map((x, i) => <li key={i}>{x}</li>)}</ul>}
                  <div className="rows">
                    <div><span>{t("Handhafi")}</span><div className="tk-avs">{fast.length ? fast.map((h) => { const p = byId.get(h.employeeId); return p ? <span key={h.employeeId} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>{personAv(p)}{p.name.split(" ")[0]}</span> : null; }) : st ? t("Sá sem er á vaktinni") : "—"}</div></div>
                    <div><span>{t("Varamaður")}</span><div className="tk-avs">{vara.length ? vara.map((h) => { const p = byId.get(h.employeeId); return p ? <span key={h.employeeId} style={{ display: "inline-flex", gap: 5, alignItems: "center" }}>{personAv(p)}{p.name.split(" ")[0]}</span> : null; }) : <span style={{ color: "var(--warn)" }}>{t("Enginn — mælt með að velja")}</span>}</div></div>
                    <div><span>{t("Listar")}</span>{data.lists.filter((l) => l.roleId === r.id).map((l) => l.name).join(", ") || "—"}</div>
                  </div>
                  <div className="acts"><button className="btn ghost sm" onClick={() => setModal({ k: "role", role: r })}>{t("Breyta")}</button></div>
                </div>
              );
            })}
          </div>
        )}
      </>}

      {tab === "skipurit" && <OrgTree people={people} roles={data.roles} onPick={(p) => setModal({ k: "person", person: p })} />}

      {tab === "fravik" && (
        <div className="db2-card tk-card">
          <div className="tk-head"><div><h3>{t("Frávik og atvik")}</h3><div className="sub">{t("Starfsfólk skráir í appinu (⋯ á verkefni). Þú færð tilkynningu strax.")}</div></div></div>
          {data.incidents.length === 0 ? <div className="tk-empty"><b>{t("Engin frávik skráð")}</b>{t("Hitastig, vara sem vantaði, bilanir og atvik birtast hér.")}</div> : (
            <div className="tk-tblwrap"><table className="tk-table">
              <thead><tr><th>{t("Dagur")}</th><th>{t("tk:Tegund")}</th><th>{t("Lýsing")}</th><th>{t("Skráð af")}</th><th>{t("Staða")}</th><th /></tr></thead>
              <tbody>{data.incidents.map((i) => (
                <tr key={i.id}>
                  <td style={{ whiteSpace: "nowrap" }}>{i.date.slice(8, 10)}.{i.date.slice(5, 7)}. <span style={{ color: "var(--ink3)" }}>{hm(i.createdAt)}</span></td>
                  <td>{t(INC_LABEL[i.category] ?? i.category)}</td>
                  <td><b style={{ fontWeight: 600 }}>{i.title}</b>{i.note && <div style={{ color: "var(--ink2)", marginTop: 2 }}>{i.note}</div>}{i.taskRef && <div style={{ color: "var(--ink3)", fontSize: 12, marginTop: 2 }}>{t("Verkefni")}: {i.taskRef}</div>}{i.photo && <a href={i.photo} target="_blank" rel="noreferrer" style={{ fontSize: 12, color: "var(--brand)" }}>{t("Sjá mynd")}</a>}</td>
                  <td>{nm(i.employeeId) || "—"}</td>
                  <td>{i.status === "open" ? <span className="db2-pill bad">{t("Opið")}</span> : <span className="db2-pill good">{t("Leyst")}</span>}</td>
                  <td><button className="btn ghost sm" onClick={async () => { const r = await setIncidentStatus(i.id, i.status === "open" ? "resolved" : "open"); if (!r.ok) toast(r.error ?? "Villa", "error"); else reload(); }}>{i.status === "open" ? t("Merkja leyst") : t("Opna aftur")}</button></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      {modal?.k === "adhoc" && <AdhocModal date={date} people={people} roles={data.roles} preset={{ employeeId: modal.emp }} onClose={() => setModal(null)} onSaved={() => reload()} />}
      {modal?.k === "handover" && <HandoverModal from={modal.from} date={date} people={people} roles={data.roles} onClose={() => setModal(null)} onSaved={() => reload()} />}
      {modal?.k === "list" && <ListEditor list={modal.list} people={people} roles={data.roles} locations={data.locations} onClose={() => setModal(null)} onSaved={() => reload()} />}
      {modal?.k === "role" && <RoleEditor role={modal.role} people={people} shiftTypes={data.shiftTypes} onClose={() => setModal(null)} onSaved={() => reload()} />}
      {modal?.k === "person" && <PersonModal person={modal.person} people={people} roles={data.roles} onClose={() => setModal(null)} onSaved={() => reload()}
        onHandover={() => setModal({ k: "handover", from: modal.person })} onTask={() => setModal({ k: "adhoc", emp: modal.person.id })} />}
    </div>
  );
}

function PersonRow({ r, open, today, toggle, onTick, onDelete, onHandover, onTask }: {
  r: BoardRow; open: boolean; today: boolean; toggle: () => void;
  onTick: (kind: "item" | "adhoc", id: string, done: boolean, owner?: string) => void;
  onDelete: (id: string) => void; onHandover: () => void; onTask: () => void;
}) {
  const { t } = useLang();
  const c = counts(r);
  const pct = c.total ? Math.round((c.done / c.total) * 100) : 0;
  const now = nowHM();
  const late = r.lists.some((l) => l.items.some((i) => isLate(l.due_time, i.done, now, today))) || r.adhoc.some((a) => isLate(a.due_time, a.done, now, today));
  return (
    <div className="tk-person">
      <div className="tk-prow" onClick={toggle}>
        {personAv({ id: r.employee_id, name: r.name, color: r.color }, "db2-av")}
        <div className="tk-grow" style={{ minWidth: 0 }}>
          <div className="nm">{r.name}</div>
          <div className="meta">
            {r.on_shift ? <span>{t("tk:Á vakt")}</span> : <span>{t("tk:Ekki á vakt")}</span>}
            {r.roles.map((x) => <span key={x.id} className={`tk-chip ${x.via}`} title={t(VIA_LABEL[x.via]) + (x.from_name ? ` — ${x.from_name}` : "")}><i style={{ background: x.color ?? undefined }} />{x.name}{x.via === "faert" || x.via === "vara" ? ` · ${t("fyrir")} ${(x.from_name ?? "").split(" ")[0]}` : ""}</span>)}
            {late && <span className="db2-pill bad" style={{ padding: "1px 8px", fontSize: 11 }}>{t("Of seint")}</span>}
          </div>
        </div>
        <div className="tk-prog">
          <div className="t">{c.done}/{c.total}</div>
          <div className="db2-prog"><span style={{ width: `${pct}%`, background: pct === 100 ? "var(--good)" : "var(--brand)" }} /></div>
        </div>
      </div>
      {open && (
        <div className="tk-body">
          {r.lists.map((l) => <ListBlock key={l.id} l={l} owner={r.employee_id} today={today} now={now} onTick={onTick} />)}
          {r.adhoc.length > 0 && (
            <div className="tk-list">
              <div className="lh">{t("Stök verkefni")}</div>
              {r.adhoc.map((a) => <AdhocItem key={a.id} a={a} today={today} now={now} onTick={onTick} onDelete={onDelete} />)}
            </div>
          )}
          {!r.lists.length && !r.adhoc.length && <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Engin verkefni.")}</div>}
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <button className="btn ghost sm" onClick={onTask}>+ {t("Verkefni")}</button>
            <button className="btn ghost sm" onClick={onHandover}><Icon name="swap" className="ic" />{t("Færa ábyrgð")}</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListBlock({ l, owner, today, now, onTick }: { l: DayList; owner: string; today: boolean; now: string; onTick: (kind: "item", id: string, done: boolean, owner?: string) => void }) {
  const { t } = useLang();
  const done = l.items.filter((i) => i.done).length;
  return (
    <div className="tk-list">
      <div className="lh">{l.name}<span>{done}/{l.items.length}{l.due_time ? ` · ${t("fyrir kl.")} ${l.due_time}` : ""}{l.shared ? ` · ${t("sameiginlegt")}` : ""}{l.from_name ? ` · ${t("fyrir")} ${l.from_name.split(" ")[0]}` : ""}</span></div>
      {l.items.map((i: DayItem) => (
        <div key={i.id} className={`tk-item${i.done ? " done" : ""}`}>
          <Check on={i.done} onClick={() => onTick("item", i.id, !i.done, l.shared ? undefined : owner)} />
          <span className="tt">{i.title}</span>
          {i.done ? <span className="who">{(i.done_by_name ?? "").split(" ")[0]} {hm(i.done_at)}{i.photo_url && <> · <a href={i.photo_url} target="_blank" rel="noreferrer">{t("mynd")}</a></>}</span>
            : isLate(l.due_time, false, now, today) ? <span className="late">{t("Of seint")}</span> : null}
        </div>
      ))}
    </div>
  );
}

function AdhocItem({ a, today, now, onTick, onDelete }: { a: DayAdhoc; today: boolean; now: string; onTick: (kind: "adhoc", id: string, done: boolean) => void; onDelete: (id: string) => void }) {
  const { t } = useLang();
  return (
    <div className={`tk-item${a.done ? " done" : ""}`}>
      <Check on={a.done} onClick={() => onTick("adhoc", a.id, !a.done)} />
      <span className="tt">{a.title}{a.due_time ? <span style={{ color: "var(--ink3)" }}> · {t("fyrir kl.")} {a.due_time}</span> : null}{a.shared ? <span style={{ color: "var(--ink3)" }}> · {a.role_name ?? t("hver sem er á vakt")}</span> : null}</span>
      {a.done ? <span className="who">{(a.done_by_name ?? "").split(" ")[0]} {hm(a.done_at)}</span> : isLate(a.due_time, false, now, today) ? <span className="late">{t("Of seint")}</span> : <span className="tk-grow" />}
      <button className="tk-x" onClick={() => onDelete(a.id)} aria-label={t("Eyða")}>✕</button>
    </div>
  );
}

function OrgTree({ people, roles, onPick }: { people: TaskPerson[]; roles: TaskRole[]; onPick: (p: TaskPerson) => void }) {
  const { t } = useLang();
  const kids = useMemo(() => {
    const m = new Map<string, TaskPerson[]>();
    for (const p of people) if (p.reportsTo) { if (!m.has(p.reportsTo)) m.set(p.reportsTo, []); m.get(p.reportsTo)!.push(p); }
    return m;
  }, [people]);
  const ids = new Set(people.map((p) => p.id));
  const roots = people.filter((p) => (!p.reportsTo || !ids.has(p.reportsTo)) && kids.has(p.id));
  const loose = people.filter((p) => (!p.reportsTo || !ids.has(p.reportsTo)) && !kids.has(p.id));
  const roleNames = (id: string) => roles.filter((r) => r.holders.some((h) => h.employeeId === id && !h.backup)).map((r) => r.name).join(", ");
  const Node = ({ p, depth }: { p: TaskPerson; depth: number }) => (
    <div>
      <button className="tk-node" onClick={() => onPick(p)}>
        {personAv(p)}
        <span><b>{p.name}</b><small>{[p.title, roleNames(p.id)].filter(Boolean).join(" · ") || t("Ekkert hlutverk")}{kids.get(p.id)?.length ? ` · ${kids.get(p.id)!.length} ${t("undir")}` : ""}</small></span>
      </button>
      {depth < 8 && kids.get(p.id)?.length ? <div className="tk-kids">{kids.get(p.id)!.map((k) => <Node key={k.id} p={k} depth={depth + 1} />)}</div> : null}
    </div>
  );
  return (
    <div className="db2-card tk-card">
      <div className="tk-head"><div><h3>{t("Skipurit")}</h3><div className="sub">{t("Hver er yfir hverjum. Smelltu á manneskju til að velja yfirmann eða færa ábyrgð.")}</div></div></div>
      <div className="tk-tree">
        {roots.map((p) => <Node key={p.id} p={p} depth={0} />)}
        {loose.length > 0 && <>
          <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--ink3)", marginTop: roots.length ? 10 : 0 }}>{roots.length ? t("Ekki komin í skipurit") : t("Enginn yfirmaður valinn ennþá — smelltu á manneskju og veldu yfirmann.")}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>{loose.map((p) => <Node key={p.id} p={p} depth={9} />)}</div>
        </>}
      </div>
    </div>
  );
}
