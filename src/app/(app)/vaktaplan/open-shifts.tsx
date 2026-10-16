"use client";

// Lausar vaktir: stjórnandi stofnar vakt án starfsmanns, starfsfólk sækir um (vefur/app), stjórnandi úthlutar.
// Gögn: shifts.employee_id IS NULL + shift_claims (migration 0082).
import { useCallback, useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { TimeField } from "@/components/app/fields";
import { AsyncButton } from "@/components/app/async-button";
import { assignOpenShift, createOpenShift, deleteOpenShift, getOpenShifts, type OpenShift } from "./actions";

const DAYS = ["Mánudagur", "Þriðjudagur", "Miðvikudagur", "Fimmtudagur", "Föstudagur", "Laugardagur", "Sunnudagur"];
const SHORT = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const label = (dateISO: string) => { const d = new Date(`${dateISO}T12:00:00`); return `${SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}`; };

export default function OpenShifts({ weekDays, types, todayISO }: { weekDays: Date[]; types: { nm: string; t: string }[]; todayISO: string }) {
  const { t } = useLang();
  const from = iso(weekDays[0]), to = iso(weekDays[6]);
  const [list, setList] = useState<OpenShift[]>([]);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    const r = await getOpenShifts(from, to);
    if (r.ok) setList(r.shifts);
  }, [from, to]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- sækir lausar vaktir þegar vikan breytist
  useEffect(() => { void load(); }, [load]);

  const pending = list.reduce((n, s) => n + s.claims.length, 0);

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch">
        <div><div className="ct">{t("Lausar vaktir")}</div><div className="cs">{t("vaktir án starfsmanns sem starfsfólk getur sótt um")}</div></div>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          {pending > 0 && <span className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{pending} {t(pending === 1 ? "umsókn" : "umsóknir")}</span>}
          <button className="btn sm" onClick={() => setOpen(true)}>+ {t("Laus vakt")}</button>
        </div>
      </div>
      <div className="cb att">
        {list.length === 0 && <div className="muted" style={{ fontSize: 13, padding: "6px 0" }}>{t("Engar lausar vaktir þessa viku. Stofnaðu lausa vakt og starfsfólk fær tilkynningu í appinu.")}</div>}
        {list.map((s) => (
          <div className="it" key={s.id} style={{ alignItems: "flex-start" }}>
            <div className="ic info"><svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4.5" width="18" height="16" rx="2" /><path d="M3 9.5h18M8 2.5v4M16 2.5v4" /></svg></div>
            <div className="tx" style={{ flex: 1 }}>
              <b>{label(s.date)} · {s.start}–{s.end}{s.type ? ` · ${s.type}` : ""}</b>
              {s.note && <span style={{ display: "block" }}>{s.note}</span>}
              {s.claims.length === 0
                ? <span style={{ display: "block" }}>{t("Engin umsókn enn")}</span>
                : <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: 6 }}>
                    {s.claims.map((c) => (
                      <div key={c.id} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--ink)" }}>{c.name}</span>
                        <AsyncButton className="btn sm" onClick={async () => {
                          const r = await assignOpenShift(c.id);
                          if (r.ok) { toast(`${t("Úthlutað")}: ${c.name}`); void load(); } else toast(r.error ?? "Villa", "error");
                        }}>{t("Úthluta")}</AsyncButton>
                      </div>
                    ))}
                  </div>}
            </div>
            <AsyncButton className="btn ghost sm" onClick={async () => {
              const r = await deleteOpenShift(s.id);
              if (r.ok) { toast(t("Lausri vakt eytt")); void load(); } else toast(r.error ?? "Villa", "error");
            }}>{t("Eyða")}</AsyncButton>
          </div>
        ))}
      </div>
      {open && <NewOpenShift weekDays={weekDays} types={types} todayISO={todayISO} onClose={() => setOpen(false)} onDone={() => { setOpen(false); void load(); }} />}
    </div>
  );
}

function NewOpenShift({ weekDays, types, todayISO, onClose, onDone }: { weekDays: Date[]; types: { nm: string; t: string }[]; todayISO: string; onClose: () => void; onDone: () => void }) {
  const { t } = useLang();
  const firstFuture = Math.max(0, weekDays.findIndex((d) => iso(d) >= todayISO));
  const [day, setDay] = useState(firstFuture);
  const [type, setType] = useState("");
  const [start, setStart] = useState("12:00");
  const [end, setEnd] = useState("20:00");
  const [count, setCount] = useState(1);
  const [note, setNote] = useState("");
  const pickType = (nm: string) => {
    setType(nm);
    const m = /(\d{1,2}[:.]?\d{0,2})\s*[–-]\s*(\d{1,2}[:.]?\d{0,2})/.exec(types.find((x) => x.nm === nm)?.t ?? "");
    const hm = (v: string) => { const [h, mm = "00"] = v.replace(".", ":").split(":"); return `${h.padStart(2, "0")}:${(mm || "00").padEnd(2, "0")}`; };
    if (m) { setStart(hm(m[1])); setEnd(hm(m[2])); }
  };
  const past = iso(weekDays[day]) < todayISO;
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" role="dialog" aria-modal="true" style={{ maxWidth: 440 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Ný laus vakt")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Starfsfólk fær tilkynningu og getur sótt um. Þú velur hver fær vaktina.")}</p>
          <div className="field"><label>{t("Dagur")}</label>
            <select value={day} onChange={(e) => setDay(Number(e.target.value))}>
              {weekDays.map((d, i) => <option key={i} value={i}>{t(DAYS[i])} {d.getDate()}.{d.getMonth() + 1}.</option>)}
            </select>
          </div>
          {types.length > 0 && <div className="field" style={{ marginTop: 10 }}><label>{t("Tegund vaktar")}</label>
            <select value={type} onChange={(e) => pickType(e.target.value)}>
              <option value="">{t("Engin")}</option>
              {types.map((x) => <option key={x.nm} value={x.nm}>{t(x.nm)}{x.t ? ` (${x.t})` : ""}</option>)}
            </select>
          </div>}
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <div className="field" style={{ flex: 1 }}><label>{t("Upphaf")}</label><TimeField value={start} onChange={setStart} style={{ width: "100%" }} /></div>
            <div className="field" style={{ flex: 1 }}><label>{t("Lok")}</label><TimeField value={end} onChange={setEnd} style={{ width: "100%" }} /></div>
            <div className="field" style={{ width: 90 }}><label>{t("Fjöldi")}</label><input type="number" min={1} max={10} value={count} onChange={(e) => setCount(Math.min(10, Math.max(1, Number(e.target.value) || 1)))} /></div>
          </div>
          <div className="field" style={{ marginTop: 10 }}><label>{t("Athugasemd (valkvætt)")}</label><input value={note} maxLength={200} onChange={(e) => setNote(e.target.value)} placeholder={t("t.d. Eldhús, vantar vanan")} /></div>
          {past && <div style={{ color: "var(--warn)", fontSize: 12.5, marginTop: 10 }}>{t("Þessi dagur er liðinn.")}</div>}
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <AsyncButton className="btn" disabled={past} onClick={async () => {
              const r = await createOpenShift({ date: iso(weekDays[day]), start, end, shiftTypeName: type || undefined, note, count });
              if (r.ok) { toast(count > 1 ? `${count} ${t("lausar vaktir birtar")}` : t("Laus vakt birt")); onDone(); } else toast(r.error ?? "Villa", "error");
            }}>{t("Birta lausa vakt")}</AsyncButton>
            <button className="btn ghost" onClick={onClose}>{t("Hætta við")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
