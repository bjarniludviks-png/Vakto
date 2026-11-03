"use client";

// Starfsmannaspjald: taxtahækkanir (Laun-flipinn) og athugasemdir stjórnenda (eigin flipi). Migration 0107.

import { useEffect, useState } from "react";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { DateField } from "@/components/app/fields";
import { nf } from "@/lib/format";
import type { Employee } from "@/lib/employees";
import { stepDueDate, stepTrigger, isDisplay, MAX_RATE_STEPS, type RateStep, type RateStepKind, type RateStepMode } from "@/lib/rate-steps";
import { getRateSteps, saveRateSteps, listEmployeeNotes, addEmployeeNote, deleteEmployeeNote, type EmployeeNote } from "./extras-actions";

const FLD: React.CSSProperties = { border: "1px solid var(--line)", borderRadius: 7, padding: "5px 9px", font: "inherit", fontSize: 13, background: "#fff" };
const newId = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID().slice(0, 8) : String(Date.now()));
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

/** Reitirnir hér vistast strax — atburðir mega ekki ná til spjaldsformsins (annars birtist „Óvistaðar breytingar“). */
const isolate = { onInput: (ev: React.SyntheticEvent) => ev.stopPropagation(), onChange: (ev: React.SyntheticEvent) => ev.stopPropagation() };

function Sec({ children }: { children: React.ReactNode }) {
  return <div className="sec">{children}</div>;
}

/** „Taxtahækkanir“: þrep sem hækka taxtann sjálfkrafa eða minna stjórnendur á, t.d. við 17 ára aldur eða 1 ár í starfi. */
export function RateStepsCard({ e }: { e: Employee }) {
  const { t } = useLang();
  const [steps, setSteps] = useState<RateStep[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [kind, setKind] = useState<RateStepKind>("age");
  const [at, setAt] = useState("");
  const [date, setDate] = useState("");
  const [rate, setRate] = useState("");
  const [mode, setMode] = useState<RateStepMode>("auto");
  useEffect(() => {
    getRateSteps(e.id).then((r) => { setSteps(r.steps); setErr(r.ok ? null : (r.error ?? null)); }).catch(() => setSteps([]));
  }, [e.id]);

  const person = { kennitala: e.kennitala ?? null, hireDate: e.hireDate ?? null, priorServiceMonths: e.priorServiceMonths ?? 0 };
  const unit = e.payType === "monthly" ? "kr/mán" : "kr/klst";

  async function persist(next: RateStep[], okMsg: string) {
    setBusy(true);
    const r = await saveRateSteps(e.id, next);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return false; }
    setSteps(r.steps ?? next);
    toast(t(okMsg));
    return true;
  }
  async function add() {
    const amount = Math.max(0, Math.round(Number(rate.replace(/\D/g, "")) || 0));
    const n = Math.round(Number(at));
    if (kind === "date" ? !date : !(n > 0)) { toast(t(kind === "age" ? "Sláðu inn aldur" : kind === "service" ? "Sláðu inn fjölda mánaða" : "Veldu dagsetningu")); return; }
    if (mode === "auto" && !amount) { toast(t("Sláðu inn nýja taxtann")); return; }
    const step: RateStep = { id: newId(), kind, rate: amount, mode, ...(kind === "date" ? { date } : { at: n }) };
    const due = stepDueDate(step, person);
    if (due && due < today() && !window.confirm(t("Þessi dagsetning er liðin. Þrepið verður ekki framkvæmt afturvirkt — viltu samt skrá það?"))) return;
    if (await persist([...(steps ?? []), step], "Taxtahækkun skráð")) { setAt(""); setDate(""); setRate(""); }
  }

  const sorted = [...(steps ?? [])].sort((a, b) => (stepDueDate(a, person) ?? "9999") < (stepDueDate(b, person) ?? "9999") ? -1 : 1);
  return (
    <>
      <Sec>{t("Taxtahækkanir")}</Sec>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 8px", lineHeight: 1.5 }}>
        {t("Skráðu fyrirfram hvenær taxtinn á að breytast, t.d. þegar starfsmaðurinn verður 17 ára eða hefur unnið í eitt ár. VAKTO hækkar taxtann sjálfkrafa á gildisdegi eða lætur stjórnendur vita — alltaf með áminningu viku fyrr.")}
      </p>
      {err && <p style={{ fontSize: 12, color: "var(--warn)", margin: "0 0 8px" }}>{err}</p>}
      {steps === null && <p className="muted" style={{ fontSize: 12.5 }}>{t("Sæki…")}</p>}
      {sorted.map((s) => {
        const due = stepDueDate(s, person);
        const missingWhy = !due ? (s.kind === "age" ? t("vantar kennitölu") : t("vantar ráðningardag")) : null;
        return (
          <div className="statline" key={s.id} style={{ opacity: s.doneAt ? 0.6 : 1 }}>
            <span className="k">
              {t(stepTrigger(s))}
              <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>
                {" · "}{missingWhy ? <span style={{ color: "var(--warn)" }}>{missingWhy}</span> : isDisplay(due!)}
                {" · "}{s.doneAt ? t("lokið") : s.mode === "auto" ? t("hækkar sjálfkrafa") : t("aðeins tilkynning")}
              </span>
            </span>
            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
              <span className="v">{s.rate > 0 ? `${nf(s.rate)} ${unit}` : "—"}</span>
              <button type="button" className="btn ghost sm" disabled={busy} aria-label={t("Eyða")}
                onClick={() => persist((steps ?? []).filter((x) => x.id !== s.id), "Taxtahækkun fjarlægð")}>{t("Eyða")}</button>
            </span>
          </div>
        );
      })}
      {steps && steps.length < MAX_RATE_STEPS && (
        <div {...isolate} style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginTop: 10 }}>
          <select value={kind} onChange={(ev) => setKind(ev.target.value as RateStepKind)} style={FLD} aria-label={t("Hvenær")}>
            <option value="age">{t("Þegar verður … ára")}</option>
            <option value="service">{t("Eftir … mán. í starfi")}</option>
            <option value="date">{t("Á dagsetningu")}</option>
          </select>
          {kind === "date"
            ? <DateField value={date} onChange={setDate} />
            : <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                <input inputMode="numeric" value={at} onChange={(ev) => setAt(ev.target.value.replace(/\D/g, "").slice(0, 3))}
                  placeholder={kind === "age" ? "17" : "12"} style={{ ...FLD, width: 56, textAlign: "right" }} aria-label={kind === "age" ? t("Aldur") : t("Mánuðir")} />
                <span className="muted" style={{ fontSize: 12 }}>{kind === "age" ? t("ára") : t("mán.")}</span>
              </span>}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
            <input inputMode="numeric" value={rate ? nf(Number(rate.replace(/\D/g, "")) || 0) : ""} onChange={(ev) => setRate(ev.target.value.replace(/\D/g, ""))}
              placeholder={nf(e.rate || 0)} style={{ ...FLD, width: 100, textAlign: "right" }} aria-label={t("Nýr taxti")} />
            <span className="muted" style={{ fontSize: 12 }}>{unit}</span>
          </span>
          <select value={mode} onChange={(ev) => setMode(ev.target.value as RateStepMode)} style={FLD} aria-label={t("Hvað gerist")}>
            <option value="auto">{t("Hækka sjálfkrafa")}</option>
            <option value="notify">{t("Aðeins láta vita")}</option>
          </select>
          <button type="button" className="btn sm" disabled={busy} onClick={add}>{t("Bæta við")}</button>
        </div>
      )}
      {kind === "age" && !e.kennitala && <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0", color: "var(--warn)" }}>{t("Aldur er reiknaður úr kennitölu — skráðu hana á Persónulegt-flipanum.")}</p>}
      {kind === "service" && !e.hireDate && <p className="muted" style={{ fontSize: 11.5, margin: "6px 0 0", color: "var(--warn)" }}>{t("Starfstími er reiknaður frá ráðningardegi — skráðu hann á Persónulegt-flipanum.")}</p>}
    </>
  );
}

function when(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getDate()}.${d.getMonth() + 1}.${d.getFullYear()} kl. ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

/** „Athugasemdir“-flipinn: innri athugasemdir sem aðeins stjórnendur sjá (aldrei starfsmaðurinn sjálfur). */
export function NotesTab({ employeeId }: { employeeId: string }) {
  const { t } = useLang();
  const [notes, setNotes] = useState<EmployeeNote[] | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const load = () => listEmployeeNotes(employeeId).then((r) => { setNotes(r.notes); setErr(r.ok ? null : (r.error ?? null)); }).catch(() => setNotes([]));
  useEffect(() => { load(); }, [employeeId]); // eslint-disable-line react-hooks/exhaustive-deps

  async function add() {
    if (!text.trim()) return;
    setBusy(true);
    const r = await addEmployeeNote(employeeId, text);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    setText("");
    toast(t("Athugasemd vistuð"));
    load();
  }
  async function remove(id: string) {
    if (!window.confirm(t("Eyða athugasemdinni?"))) return;
    const r = await deleteEmployeeNote(id);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    setNotes((n) => (n ?? []).filter((x) => x.id !== id));
  }

  return (
    <>
      <div className="sec" style={{ marginTop: 0 }}>{t("Athugasemdir stjórnenda")}</div>
      <p className="muted" style={{ fontSize: 12, margin: "0 0 10px", lineHeight: 1.5 }}>
        {t("Aðeins eigendur og stjórnendur sjá þessar athugasemdir — starfsmaðurinn sjálfur sér þær aldrei, hvorki á vefnum né í appinu.")}
      </p>
      <div {...isolate}><textarea value={text} onChange={(ev) => setText(ev.target.value)} rows={3} maxLength={4000}
        placeholder={t("t.d. launaviðtal 3.11 — samið um endurskoðun í mars")}
        style={{ ...FLD, width: "100%", resize: "vertical", lineHeight: 1.5, padding: "8px 10px" }} /></div>
      {/* Ekki hluti af spjaldsforminu — vistast strax. */}
      <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="btn sm" disabled={busy || !text.trim()} onClick={add}>{busy ? t("Vista…") : t("Bæta við athugasemd")}</button>
      </div>
      {err && <p style={{ fontSize: 12, color: "var(--warn)", margin: "8px 0 0" }}>{err}</p>}
      {notes === null && <p className="muted" style={{ fontSize: 12.5 }}>{t("Sæki…")}</p>}
      {notes?.length === 0 && !err && <p className="muted" style={{ fontSize: 12.5, marginTop: 10 }}>{t("Engar athugasemdir enn.")}</p>}
      <div style={{ display: "grid", gap: 10, marginTop: 12 }}>
        {(notes ?? []).map((n) => (
          <div key={n.id} style={{ border: "1px solid var(--line)", borderRadius: 12, padding: "10px 12px", background: "var(--panel)" }}>
            <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.5 }}>{n.body}</div>
            <div className="muted" style={{ fontSize: 11.5, marginTop: 6, display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{[n.author, when(n.created)].filter(Boolean).join(" · ")}</span>
              <button type="button" onClick={() => remove(n.id)} style={{ border: 0, background: "none", color: "var(--ink3)", cursor: "pointer", font: "inherit", fontSize: 11.5, padding: 0 }}>{t("Eyða")}</button>
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
