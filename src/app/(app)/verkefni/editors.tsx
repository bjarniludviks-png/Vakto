"use client";

// Gluggar Verkefna-síðunnar: stakt verkefni, færa ábyrgð, listi, hlutverk, manneskja (skipurit).

import { useMemo, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { Av } from "@/components/app/avatar";
import { initials } from "@/lib/employees";
import { colorFor } from "@/lib/avatar";
import { CATEGORY_LABEL, WEEKDAYS, type ListCategory, type ListTarget } from "@/lib/tasks";
import {
  addAdhocTask, createHandover, saveList, deleteList, saveRole, deleteRole, setReportsTo,
  type TaskPerson, type TaskRole, type TaskListDef,
} from "./actions";

export function Modal({ title, sub, onClose, children, width = 520 }: { title: string; sub?: string; onClose: () => void; children: React.ReactNode; width?: number }) {
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: width }}>
        <div className="mh">
          <div><div style={{ fontSize: 16, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: "var(--ink3)", marginTop: 2 }}>{sub}</div>}</div>
          <button className="x" onClick={onClose} aria-label="Loka">✕</button>
        </div>
        <div className="mb">{children}</div>
      </div>
    </div>
  );
}

export const personAv = (p: Pick<TaskPerson, "id" | "name" | "color">, cls = "db2-av sm") => (
  <Av id={p.id} av={initials(p.name)} c={p.color ?? colorFor(p.id)} className={cls} />
);

const pad = (n: number) => String(n).padStart(2, "0");
export const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function addDays(iso: string, n: number) { const d = new Date(iso + "T12:00:00"); d.setDate(d.getDate() + n); return isoOf(d); }
function endOfWeek(iso: string) { const d = new Date(iso + "T12:00:00"); const dow = (d.getDay() + 6) % 7; return addDays(iso, 6 - dow); }

function Opts<T extends string>({ value, onChange, opts, small }: { value: T; onChange: (v: T) => void; opts: [T, string][]; small?: boolean }) {
  return (
    <div className="tk-opts">
      {opts.map(([v, l]) => <button type="button" key={v} className={`tk-opt${small ? " sm" : ""}${value === v ? " on" : ""}`} onClick={() => onChange(v)}>{l}</button>)}
    </div>
  );
}

/* ------------------------------------------------------------ stakt verkefni */

export function AdhocModal({ date, people, roles, onClose, onSaved, preset }: {
  date: string; people: TaskPerson[]; roles: TaskRole[]; onClose: () => void; onSaved: () => void;
  preset?: { employeeId?: string };
}) {
  const { t } = useLang();
  const [title, setTitle] = useState("");
  const [target, setTarget] = useState<"employee" | "role" | "everyone">(preset?.employeeId ? "employee" : roles.length ? "role" : "employee");
  const [emp, setEmp] = useState(preset?.employeeId ?? "");
  const [role, setRole] = useState(roles[0]?.id ?? "");
  const [day, setDay] = useState(date);
  const [due, setDue] = useState("");
  const [photo, setPhoto] = useState(false);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    setBusy(true);
    const r = await addAdhocTask({ title, target, employeeId: emp, roleId: role, date: day, dueTime: due || null, needsPhoto: photo, note });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    toast(t("Verkefninu bætt við — viðkomandi fær tilkynningu"));
    onSaved(); onClose();
  }
  return (
    <Modal title={t("Nýtt verkefni")} sub={t("Stakt verkefni sem birtist strax í appinu")} onClose={onClose}>
      <div className="field"><label>{t("Hvað þarf að gera?")}</label>
        <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder={t("t.d. Fara með samlokur í Hagkaup")} maxLength={200} />
      </div>
      <div className="field"><label>{t("Hver á að gera það?")}</label>
        <Opts value={target} onChange={setTarget} opts={[["employee", t("Manneskja")], ...(roles.length ? [["role", t("Hlutverk")] as ["role", string]] : []), ["everyone", t("Hver sem er á vakt")]]} />
      </div>
      {target === "employee" && <div className="field"><label>{t("Manneskja")}</label>
        <select value={emp} onChange={(e) => setEmp(e.target.value)}>
          <option value="">{t("Veldu…")}</option>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>}
      {target === "role" && <div className="field"><label>{t("Hlutverk")}</label>
        <select value={role} onChange={(e) => setRole(e.target.value)}>
          {roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{t("Fer á þann sem er með hlutverkið þann dag — líka varamann eða þann sem fékk ábyrgðina.")}</div>
      </div>}
      <div className="tk-row2">
        <div className="field"><label>{t("Dagur")}</label><input type="date" value={day} onChange={(e) => setDay(e.target.value)} /></div>
        <div className="field"><label>{t("Fyrir kl. (valfrjálst)")}</label><input type="time" value={due} onChange={(e) => setDue(e.target.value)} /></div>
      </div>
      <div className="field"><label>{t("Athugasemd (valfrjálst)")}</label><input value={note} onChange={(e) => setNote(e.target.value)} maxLength={500} /></div>
      <label className="tk-check"><input type="checkbox" checked={photo} onChange={(e) => setPhoto(e.target.checked)} />{t("Krefjast myndar þegar hakað er við")}</label>
      <div className="tk-mfoot">
        <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
        <button className="btn" disabled={busy || !title.trim()} onClick={save}>{busy ? t("Vista…") : t("Bæta við")}</button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------- færa ábyrgð */

export function HandoverModal({ from, date, people, roles, onClose, onSaved }: {
  from: TaskPerson; date: string; people: TaskPerson[]; roles: TaskRole[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLang();
  const mine = roles.filter((r) => r.holders.some((h) => h.employeeId === from.id && !h.backup));
  const [all, setAll] = useState(true);
  const [pick, setPick] = useState<Set<string>>(new Set(mine.map((r) => r.id)));
  const [to, setTo] = useState("");
  const [len, setLen] = useState<"today" | "week" | "until" | "open">("today");
  const [until, setUntil] = useState(addDays(date, 1));
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  // Varamenn fyrst — þeir þekkja hlutverkið.
  const backups = new Set(mine.flatMap((r) => r.holders.filter((h) => h.backup).map((h) => h.employeeId)));
  const others = people.filter((p) => p.id !== from.id).sort((a, b) => Number(backups.has(b.id)) - Number(backups.has(a.id)) || a.name.localeCompare(b.name, "is"));
  const end = len === "today" ? date : len === "week" ? endOfWeek(date) : len === "until" ? until : null;
  async function save() {
    setBusy(true);
    const r = await createHandover({ fromId: from.id, toId: to, roleIds: all ? "all" : [...pick], start: date, end, note });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    const toName = people.find((p) => p.id === to)?.name.split(" ")[0] ?? "";
    toast(`${t("Ábyrgðin er komin til")} ${toName}`);
    onSaved(); onClose();
  }
  return (
    <Modal title={`${t("Færa ábyrgð")} — ${from.name.split(" ")[0]}`} sub={t("Án veikindaskráningar og óháð vöktum. Fer sjálfkrafa til baka.")} onClose={onClose}>
      <div className="field"><label>{t("Hvað á að færa?")}</label>
        <label className="tk-check"><input type="radio" checked={all} onChange={() => setAll(true)} />{t("Allar ábyrgðir")} <span style={{ color: "var(--ink3)", fontSize: 12 }}>{t("(hlutverk, eigin listar og stök verkefni)")}</span></label>
        {mine.length > 0 && <label className="tk-check"><input type="radio" checked={!all} onChange={() => setAll(false)} />{t("Aðeins valin hlutverk")}</label>}
        {!all && <div style={{ paddingLeft: 26 }}>
          {mine.map((r) => (
            <label key={r.id} className="tk-check"><input type="checkbox" checked={pick.has(r.id)} onChange={(e) => { const n = new Set(pick); if (e.target.checked) n.add(r.id); else n.delete(r.id); setPick(n); }} />{r.name}</label>
          ))}
        </div>}
      </div>
      <div className="field"><label>{t("Til hvers?")}</label>
        <select value={to} onChange={(e) => setTo(e.target.value)}>
          <option value="">{t("Veldu manneskju…")}</option>
          {others.map((p) => <option key={p.id} value={p.id}>{p.name}{backups.has(p.id) ? ` · ${t("varamaður")}` : ""}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{t("Hver sem er — líka sá sem er ekki á vakt eða er ekki með hlutverkið.")}</div>
      </div>
      <div className="field"><label>{t("Hversu lengi?")}</label>
        <Opts value={len} onChange={setLen} opts={[["today", t("Í dag")], ["week", t("Út vikuna")], ["until", t("Til dags")], ["open", t("Þar til skilað")]]} />
        {len === "until" && <input type="date" style={{ marginTop: 8 }} value={until} min={date} onChange={(e) => setUntil(e.target.value)} />}
      </div>
      <div className="field"><label>{t("Skilaboð (valfrjálst)")}</label>
        <input value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("t.d. Lyklarnir eru í skúffunni")} maxLength={500} />
      </div>
      <div className="tk-mfoot">
        <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
        <button className="btn" disabled={busy || !to || (!all && pick.size === 0)} onClick={save}>{busy ? t("Færi…") : t("Færa ábyrgð")}</button>
      </div>
    </Modal>
  );
}

/* --------------------------------------------------------------------- listi */

type ItemDraft = { id?: string | null; title: string; needsPhoto: boolean };

export function ListEditor({ list, people, roles, locations, onClose, onSaved }: {
  list: TaskListDef | null; people: TaskPerson[]; roles: TaskRole[]; locations: { id: string; name: string }[];
  onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(list?.name ?? "");
  const [category, setCategory] = useState<ListCategory>(list?.category ?? "opnun");
  const [target, setTarget] = useState<ListTarget>(list?.target ?? (roles.length ? "role" : "everyone"));
  const [roleId, setRoleId] = useState(list?.roleId ?? roles[0]?.id ?? "");
  const [empId, setEmpId] = useState(list?.employeeId ?? "");
  const [locId, setLocId] = useState(list?.locationId ?? "");
  const [shared, setShared] = useState(list?.shared ?? true);
  const [mode, setMode] = useState<"days" | "month">(list?.monthDay ? "month" : "days");
  const [days, setDays] = useState<Set<number>>(new Set(list?.weekdays ?? [1, 2, 3, 4, 5, 6, 7]));
  const [monthDay, setMonthDay] = useState<number>(list?.monthDay ?? -1);
  const [due, setDue] = useState(list?.dueTime ?? "");
  const [remind, setRemind] = useState(list?.remind ?? true);
  const [escalate, setEscalate] = useState(list?.escalate ?? true);
  const [items, setItems] = useState<ItemDraft[]>(list?.items.length ? list.items.map((i) => ({ ...i })) : [{ title: "", needsPhoto: false }]);
  const [busy, setBusy] = useState(false);
  const editing = !!list?.id;
  const setItem = (n: number, p: Partial<ItemDraft>) => setItems(items.map((it, i) => (i === n ? { ...it, ...p } : it)));
  async function save() {
    setBusy(true);
    const r = await saveList({
      id: editing ? list!.id : null, name, category, target, roleId, employeeId: empId, locationId: locId || null, shared,
      weekdays: mode === "days" ? [...days] : null, monthDay: mode === "month" ? monthDay : null,
      dueTime: due || null, remind, escalate, active: list?.active ?? true, items,
    });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    toast(editing ? t("Listinn er vistaður") : t("Listinn er kominn inn — hann birtist hjá fólki strax"));
    onSaved(); onClose();
  }
  async function remove() {
    if (!list || !editing) return;
    setBusy(true);
    const r = await deleteList(list.id);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    toast(t("Listanum var eytt")); onSaved(); onClose();
  }
  return (
    <Modal title={editing ? t("Breyta lista") : t("Nýr listi")} sub={t("Grunnlisti sem endurtekur sig sjálfkrafa")} onClose={onClose} width={620}>
      <div className="tk-row2">
        <div className="field"><label>{t("Heiti")}</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Opnunarlisti")} maxLength={80} /></div>
        <div className="field"><label>{t("Tegund")}</label>
          <select value={category} onChange={(e) => setCategory(e.target.value as ListCategory)}>
            {(Object.keys(CATEGORY_LABEL) as ListCategory[]).map((c) => <option key={c} value={c}>{t(CATEGORY_LABEL[c])}</option>)}
          </select>
        </div>
      </div>
      <div className="field"><label>{t("Hver gerir listann?")}</label>
        <Opts value={target} onChange={setTarget} opts={[...(roles.length ? [["role", t("Hlutverk")] as ["role", string]] : []), ["everyone", t("Allir á vakt")], ["employee", t("Ein manneskja")]]} />
      </div>
      {target === "role" && <div className="field"><label>{t("Hlutverk")}</label>
        <select value={roleId} onChange={(e) => setRoleId(e.target.value)}>{roles.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
      </div>}
      {target === "employee" && <div className="field"><label>{t("Manneskja")}</label>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)}><option value="">{t("Veldu…")}</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
      </div>}
      {target === "everyone" && locations.length > 1 && <div className="field"><label>{t("Staður")}</label>
        <select value={locId} onChange={(e) => setLocId(e.target.value)}><option value="">{t("Allir staðir")}</option>{locations.map((l) => <option key={l.id} value={l.id}>{l.name}</option>)}</select>
      </div>}
      {target !== "employee" && <div className="field"><label>{t("Hvernig er hakað?")}</label>
        <Opts value={shared ? "s" : "p"} onChange={(v) => setShared(v === "s")} opts={[["s", t("Sameiginlegur — eitt hak fyrir alla")], ["p", t("Hver fyrir sig")]]} />
      </div>}
      <div className="field"><label>{t("Hvenær?")}</label>
        <Opts small value={mode} onChange={setMode} opts={[["days", t("Vikudagar")], ["month", t("Dagur í mánuði")]]} />
        <div style={{ marginTop: 8 }}>
          {mode === "days" ? (
            <div className="tk-opts">
              {WEEKDAYS.map((w) => <button type="button" key={w.n} className={`tk-opt sm${days.has(w.n) ? " on" : ""}`} onClick={() => { const n = new Set(days); if (n.has(w.n)) n.delete(w.n); else n.add(w.n); setDays(n); }}>{t(w.short)}</button>)}
            </div>
          ) : (
            <select value={monthDay} onChange={(e) => setMonthDay(Number(e.target.value))}>
              <option value={-1}>{t("Síðasta dag mánaðar")}</option>
              {Array.from({ length: 28 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}.</option>)}
            </select>
          )}
        </div>
      </div>
      <div className="tk-row2">
        <div className="field"><label>{t("Klárað fyrir kl. (valfrjálst)")}</label><input type="time" value={due} onChange={(e) => setDue(e.target.value)} /></div>
        <div className="field"><label>&nbsp;</label>
          <label className="tk-check"><input type="checkbox" checked={remind} onChange={(e) => setRemind(e.target.checked)} />{t("Áminning í appinu")}</label>
          <label className="tk-check"><input type="checkbox" checked={escalate} onChange={(e) => setEscalate(e.target.checked)} />{t("Láta yfirmann vita ef ekki klárað")}</label>
        </div>
      </div>
      <div className="field"><label>{t("Atriði")}</label>
        <div className="tk-items">
          {items.map((it, n) => (
            <div className="it" key={n}>
              <input type="text" value={it.title} onChange={(e) => setItem(n, { title: e.target.value })} placeholder={`${t("Atriði")} ${n + 1}`} maxLength={200}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); setItems([...items.slice(0, n + 1), { title: "", needsPhoto: false }, ...items.slice(n + 1)]); } }} />
              <label className="tk-photo"><input type="checkbox" checked={it.needsPhoto} onChange={(e) => setItem(n, { needsPhoto: e.target.checked })} />{t("Mynd")}</label>
              <button type="button" className="tk-x" onClick={() => setItems(items.length > 1 ? items.filter((_, i) => i !== n) : [{ title: "", needsPhoto: false }])} aria-label={t("Fjarlægja")}>✕</button>
            </div>
          ))}
          <button type="button" className="btn ghost sm" style={{ justifySelf: "start" }} onClick={() => setItems([...items, { title: "", needsPhoto: false }])}>+ {t("Atriði")}</button>
        </div>
      </div>
      <div className="tk-mfoot">
        {editing && <button className="btn ghost del" disabled={busy} onClick={remove}>{t("Eyða lista")}</button>}
        <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? t("Vista…") : t("Vista lista")}</button>
      </div>
    </Modal>
  );
}

/* ----------------------------------------------------------------- hlutverk */

const ROLE_COLORS = ["#e9700f", "#1f9d6b", "#5b50e6", "#d8483a", "#bf8f3a", "#2f80c2", "#8a5cd1", "#6b7280"];

export function RoleEditor({ role, people, shiftTypes, onClose, onSaved }: {
  role: TaskRole | null; people: TaskPerson[]; shiftTypes: { id: string; name: string }[]; onClose: () => void; onSaved: () => void;
}) {
  const { t } = useLang();
  const [name, setName] = useState(role?.name ?? "");
  const [desc, setDesc] = useState(role?.description ?? "");
  const [resp, setResp] = useState((role?.responsibilities ?? []).join("\n"));
  const [color, setColor] = useState(role?.color ?? ROLE_COLORS[0]);
  const [shiftType, setShiftType] = useState(role?.shiftTypeId ?? "");
  const [hold, setHold] = useState<Map<string, boolean>>(new Map((role?.holders ?? []).map((h) => [h.employeeId, h.backup])));
  const [q, setQ] = useState("");
  const [busy, setBusy] = useState(false);
  const shown = useMemo(() => people.filter((p) => !q || p.name.toLowerCase().includes(q.toLowerCase())), [people, q]);
  const setH = (id: string, v: "none" | "fast" | "vara") => { const n = new Map(hold); if (v === "none") n.delete(id); else n.set(id, v === "vara"); setHold(n); };
  async function save() {
    setBusy(true);
    const r = await saveRole({
      id: role?.id, name, description: desc, color, shiftTypeId: shiftType || null,
      responsibilities: resp.split("\n").map((s) => s.trim()).filter(Boolean),
      holders: [...hold].map(([employeeId, backup]) => ({ employeeId, backup })),
    });
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    toast(t("Hlutverkið er vistað")); onSaved(); onClose();
  }
  async function remove() {
    if (!role) return;
    setBusy(true);
    const r = await deleteRole(role.id);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); return; }
    toast(t("Hlutverkinu var eytt")); onSaved(); onClose();
  }
  return (
    <Modal title={role ? t("Breyta hlutverki") : t("Nýtt hlutverk")} sub={t("Hlutverk er ekki deild — sama manneskja getur haft mörg")} onClose={onClose} width={600}>
      <div className="field"><label>{t("Heiti")}</label><input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder={t("t.d. Bílstjóri")} maxLength={60} /></div>
      <div className="field"><label>{t("Litur")}</label>
        <div className="tk-opts">{ROLE_COLORS.map((c) => <button key={c} type="button" onClick={() => setColor(c)} aria-label={c} style={{ width: 26, height: 26, borderRadius: 8, border: color === c ? "2px solid var(--ink)" : "2px solid transparent", background: c, cursor: "pointer" }} />)}</div>
      </div>
      <div className="field"><label>{t("Lýsing (valfrjálst)")}</label><input value={desc} onChange={(e) => setDesc(e.target.value)} maxLength={400} /></div>
      <div className="field"><label>{t("Ábyrgð — ein lína fyrir hvert atriði")}</label>
        <textarea value={resp} onChange={(e) => setResp(e.target.value)} rows={4} placeholder={t("Keyra út pantanir\nSamlokur í Hagkaup á mánudögum\nBíllinn þrifinn á föstudögum")} />
      </div>
      {shiftTypes.length > 0 && <div className="field"><label>{t("Tengja við vaktategund (valfrjálst)")}</label>
        <select value={shiftType} onChange={(e) => setShiftType(e.target.value)}>
          <option value="">{t("Engin — hlutverkið er á fólkinu")}</option>
          {shiftTypes.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select>
        <div style={{ fontSize: 12, color: "var(--ink3)", marginTop: 6 }}>{t("Ef tengt fær hver sem er á þeirri vakt hlutverkið þann dag (t.d. Lokun).")}</div>
      </div>}
      <div className="field"><label>{t("Hver er með hlutverkið?")}</label>
        <input placeholder={t("Leita…")} value={q} onChange={(e) => setQ(e.target.value)} style={{ marginBottom: 8 }} />
        <div className="tk-holdlist">
          {shown.map((p) => {
            const v = hold.has(p.id) ? (hold.get(p.id) ? "vara" : "fast") : "none";
            return (
              <div className="tk-hold" key={p.id}>
                {personAv(p)}<span className="tk-grow">{p.name}</span>
                <Opts small value={v} onChange={(x) => setH(p.id, x)} opts={[["none", "—"], ["fast", t("Fast")], ["vara", t("Varamaður")]]} />
              </div>
            );
          })}
        </div>
      </div>
      <div className="tk-mfoot">
        {role && <button className="btn ghost del" disabled={busy} onClick={remove}>{t("Eyða hlutverki")}</button>}
        <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
        <button className="btn" disabled={busy || !name.trim()} onClick={save}>{busy ? t("Vista…") : t("Vista hlutverk")}</button>
      </div>
    </Modal>
  );
}

/* ------------------------------------------------------- manneskja í skipuriti */

export function PersonModal({ person, people, roles, onClose, onSaved, onHandover, onTask }: {
  person: TaskPerson; people: TaskPerson[]; roles: TaskRole[]; onClose: () => void; onSaved: () => void;
  onHandover: () => void; onTask: () => void;
}) {
  const { t } = useLang();
  const [boss, setBoss] = useState(person.reportsTo ?? "");
  const [busy, setBusy] = useState(false);
  const held = roles.filter((r) => r.holders.some((h) => h.employeeId === person.id));
  const subs = people.filter((p) => p.reportsTo === person.id);
  async function saveBoss(v: string) {
    setBoss(v); setBusy(true);
    const r = await setReportsTo(person.id, v || null);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa", "error"); setBoss(person.reportsTo ?? ""); return; }
    toast(t("Skipuritið er uppfært")); onSaved();
  }
  return (
    <Modal title={person.name} sub={person.title ?? undefined} onClose={onClose} width={480}>
      <div className="field"><label>{t("Yfirmaður")}</label>
        <select value={boss} disabled={busy} onChange={(e) => saveBoss(e.target.value)}>
          <option value="">{t("Enginn (efst í skipuriti)")}</option>
          {people.filter((p) => p.id !== person.id).map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
        </select>
      </div>
      <div className="field"><label>{t("Hlutverk")}</label>
        {held.length ? <div className="tk-opts">{held.map((r) => {
          const b = r.holders.find((h) => h.employeeId === person.id)?.backup;
          return <span key={r.id} className={`tk-chip${b ? " vara" : ""}`}><i style={{ background: r.color ?? undefined }} />{r.name}{b ? ` · ${t("vara")}` : ""}</span>;
        })}</div> : <div style={{ fontSize: 13, color: "var(--ink3)" }}>{t("Engin hlutverk ennþá — bættu við í Hlutverk-flipanum.")}</div>}
      </div>
      {subs.length > 0 && <div className="field"><label>{t("Undir")} {person.name.split(" ")[0]}</label>
        <div className="tk-avs">{subs.map((s) => <span key={s.id} style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>{personAv(s)}{s.name.split(" ")[0]}</span>)}</div>
      </div>}
      <div className="tk-mfoot">
        <button className="btn ghost" onClick={onTask}>+ {t("Verkefni")}</button>
        <button className="btn" onClick={onHandover}>{t("Færa ábyrgð")}</button>
      </div>
    </Modal>
  );
}
