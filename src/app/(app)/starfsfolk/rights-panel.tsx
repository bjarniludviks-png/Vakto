"use client";

// Réttindi á starfsmannaspjaldi (Frí-flipinn): orlof skv. kjarasamningi + staða, veikindaréttur og
// veikindi barna á síðustu 12 mánuðum, fjarvistaskrá og „Skrá fjarvist“.

import { useCallback, useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { dec1 } from "@/lib/format";
import type { EmployeeRights } from "@/lib/rights.server";
import { getEmployeeRights, registerAbsence, deleteAbsence, applyOrlofPct, type AbsenceType } from "./rights-actions";

const dmy = (iso: string) => { const [y, m, d] = iso.split("-"); return `${+d}.${+m}.${y}`; };
const pct = (n: number) => String(n).replace(".", ",");
const TYPE_LBL: Record<string, string> = { veikindi: "Veikindi", veikindi_barns: "Veikindi barns", orlof: "Orlof", olaunad: "Launalaust frí" };
const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };

function Bar({ used, of, over }: { used: number; of: number; over?: boolean }) {
  const w = of > 0 ? Math.min(100, (used / of) * 100) : used > 0 ? 100 : 0;
  const c = over ? "var(--bad)" : w >= 80 ? "var(--warn)" : "var(--good)";
  return <div className="db2-prog" style={{ marginTop: 6 }}><span style={{ width: `${w}%`, background: c }} /></div>;
}

export function RightsPanel({ employeeId }: { employeeId: string }) {
  const { t } = useLang();
  const [r, setR] = useState<EmployeeRights | null | undefined>(undefined);
  const load = useCallback(() => { getEmployeeRights(employeeId).then((x) => setR(x[0] ?? null)).catch(() => setR(null)); }, [employeeId]);
  useEffect(() => { load(); }, [load]);
  const [form, setForm] = useState<{ type: AbsenceType; from: string; to: string; note: string; free: boolean } | null>(null);
  const [busy, setBusy] = useState(false);

  async function save() {
    if (!form) return;
    setBusy(true);
    const res = await registerAbsence({ employeeId, type: form.type, from: form.from, to: form.to || form.from, note: form.note, freeShifts: form.free });
    setBusy(false);
    if (!res.ok) { toast(res.error ?? "Villa"); return; }
    toast(res.warning ? res.warning : t("Fjarvist skráð"));
    setForm(null); load();
  }
  async function remove(id: string) {
    const res = await deleteAbsence(id);
    toast(res.ok ? t("Fjarvist eytt") : (res.error ?? "Villa"));
    if (res.ok) load();
  }
  async function bumpPct(p: number) {
    const res = await applyOrlofPct(employeeId, p);
    toast(res.ok ? `${t("Orlofsprósenta uppfærð í")} ${pct(p)} %` : (res.error ?? "Villa"));
    if (res.ok) load();
  }

  if (r === undefined) return <p className="muted" style={{ fontSize: 12.5 }}>{t("Sæki…")}</p>;
  if (r === null) return <p className="muted" style={{ fontSize: 12.5 }}>{t("Réttindi reiknast þegar Supabase er tengt.")}</p>;
  const o = r.orlof, s = r.sick, c = r.child;

  // Skráningin vistast sjálf — atburðir mega ekki ná forminu utan um (annars „Óvistaðar breytingar“).
  const stop = (ev: React.SyntheticEvent) => ev.stopPropagation();
  return (
    <div onInput={stop} onChange={stop}>
      {!r.agreement && (
        <p style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600, margin: "4px 0 10px" }}>
          {r.union ? `${t("Réttindi skv. kjarasamningi")} „${r.union}“ ${t("eru ekki komin inn í VAKTO enn — sýnt er aðeins það sem er skráð.")}` : t("Veldu stéttarfélag undir Laun til að sjá orlofs- og veikindarétt skv. kjarasamningi.")}
        </p>
      )}
      {!r.hireDate && <p style={{ fontSize: 12.5, color: "var(--warn)", fontWeight: 600, margin: "4px 0 10px" }}>{t("Ráðningardagur vantar (Vinna-flipinn) — réttindi eftir starfsaldri reiknast út frá honum.")}</p>}

      {/* ---- Orlof ---- */}
      <div className="statline">
        <span className="k">{t("Orlofsréttur")}{o.right && <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}> · {t(o.right.now.reason)}</span>}</span>
        <span className="v" style={{ fontWeight: 700 }}>{o.right ? `${o.right.now.days} ${t("dagar")} · ${pct(o.right.now.pct)} %` : `${pct(o.pctSet)} %`}</span>
      </div>
      {o.pctBehind && o.right && (
        <div className="statline" style={{ background: "var(--warn-soft)", borderRadius: 8, padding: "8px 10px", margin: "4px 0" }}>
          <span className="k" style={{ color: "var(--warn)", fontWeight: 600 }}>{t("Skráð orlofsprósenta er")} {pct(o.pctSet)} % {t("en rétturinn er")} {pct(o.right.now.pct)} %</span>
          <button className="btn sm" onClick={() => bumpPct(o.right!.now.pct)}>{t("Uppfæra í")} {pct(o.right.now.pct)} %</button>
        </div>
      )}
      {o.right?.next && (
        <div className="statline"><span className="k muted">{t("Næsta hækkun")}</span><span className="v muted">{dmy(o.right.next.from)} → {o.right.next.days} {t("dagar")} · {pct(o.right.next.pct)} %</span></div>
      )}
      {o.balance?.tracksDays && (
        <div className="statline">
          <span className="k">{t("Orlofsdagar á orlofsárinu")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t("frá")} {dmy(o.balance.yearStart)}</span></span>
          <span className="v">{dec1(o.balance.earnedDays)} {t("áunnið")} · {o.balance.takenDays} {t("tekið")}{o.balance.pendingDays ? ` · ${o.balance.pendingDays} ${t("í bið")}` : ""} · <b>{dec1(o.balance.remainingDays)} {t("eftir")}</b></span>
        </div>
      )}

      {/* ---- Veikindi ---- */}
      <div className="statline" style={{ marginTop: 10 }}>
        <span className="k">{t("Veikindi síðustu 12 mánuði")}{s.right && <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}> · {t("réttur")} {t(s.right.label)}</span>}</span>
        <span className="v" style={{ fontWeight: 700, color: s.over ? "var(--bad)" : s.near ? "var(--warn)" : undefined }}>
          {s.used}{s.right ? ` / ${s.right.days}` : ""} {t("dagar")}
        </span>
      </div>
      {s.right && <Bar used={s.used} of={s.right.days} over={s.over} />}
      {s.right && s.right.parts.length > 0 && (
        <p className="muted" style={{ fontSize: 11.5, margin: "4px 0 0" }}>{s.right.parts.map((p) => `${p.months} ${t(p.months === 1 ? "mán." : "mán.")} ${t(p.pay)}`).join(" + ")}</p>
      )}
      {s.right?.next && <div className="statline"><span className="k muted">{t("Veikindaréttur eykst")}</span><span className="v muted">{dmy(s.right.next.from)} → {t(s.right.next.label)}</span></div>}

      <div className="statline" style={{ marginTop: 10 }}>
        <span className="k">{t("Veikindi barna síðustu 12 mánuði")} <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}>· {t(c.label)}</span></span>
        <span className="v" style={{ fontWeight: 700, color: c.over ? "var(--bad)" : undefined }}>{c.used} / {c.days} {t("dagar")}</span>
      </div>
      <Bar used={c.used} of={c.days} over={c.over} />

      {/* ---- Fjarvistir ---- */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 16 }}>
        <b style={{ fontSize: 13 }}>{t("Fjarvistir")}</b>
        {!form && <button className="btn sm" onClick={() => setForm({ type: "veikindi", from: today(), to: today(), note: "", free: false })}>{t("+ Skrá fjarvist")}</button>}
      </div>
      {form && (
        <div style={{ border: "1px solid var(--line)", borderRadius: 10, padding: 12, marginTop: 8 }}>
          <div className="seg" style={{ marginBottom: 10, flexWrap: "wrap" }}>
            {(["veikindi", "veikindi_barns", "orlof", "olaunad"] as AbsenceType[]).map((k) => (
              <button key={k} type="button" className={form.type === k ? "on" : ""} onClick={() => setForm({ ...form, type: k })}>{t(TYPE_LBL[k])}</button>
            ))}
          </div>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <div className="field" style={{ flex: 1, minWidth: 130 }}><label>{t("Frá")}</label><input type="date" value={form.from} onChange={(e) => setForm({ ...form, from: e.target.value, to: form.to < e.target.value ? e.target.value : form.to })} /></div>
            <div className="field" style={{ flex: 1, minWidth: 130 }}><label>{t("Til")}</label><input type="date" value={form.to} min={form.from} onChange={(e) => setForm({ ...form, to: e.target.value })} /></div>
          </div>
          <div className="field"><label>{t("Athugasemd (valkvætt)")}</label><input value={form.note} onChange={(e) => setForm({ ...form, note: e.target.value })} placeholder={t("t.d. læknisvottorð komið")} /></div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, cursor: "pointer", margin: "2px 0 10px" }}>
            <input type="checkbox" checked={form.free} onChange={(e) => setForm({ ...form, free: e.target.checked })} style={{ width: 16, height: 16, accentColor: "var(--brand)" }} />
            {t("Gera vaktir starfsmannsins þessa daga að lausum vöktum (starfsfólk fær tilkynningu og getur sótt um)")}
          </label>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn" disabled={busy} onClick={save}>{busy ? t("Augnablik…") : t("Skrá")}</button>
            <button className="btn ghost" onClick={() => setForm(null)}>{t("Hætta við")}</button>
          </div>
        </div>
      )}
      {r.absences.length === 0 ? <p className="muted" style={{ fontSize: 12.5, marginTop: 6 }}>{t("Engar fjarvistir síðustu 12 mánuði.")}</p> : (
        <div style={{ marginTop: 6 }}>
          {r.absences.map((a) => (
            <div className="statline" key={a.id}>
              <span className="k">{t(TYPE_LBL[a.type] ?? a.type)}{a.status !== "approved" && <span className="tag mut" style={{ marginLeft: 6 }}>{t(a.status === "pending" ? "í bið" : "hafnað")}</span>}
                {a.note && <span className="muted" style={{ fontWeight: 400, fontSize: 11.5 }}> · {a.note}</span>}</span>
              <span className="v" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {dmy(a.from)}{a.to !== a.from ? ` – ${dmy(a.to)}` : ""} · {a.days} {t(a.days === 1 ? "dagur" : "dagar")}
                <button className="x" title={t("Eyða")} onClick={() => remove(a.id)}>✕</button>
              </span>
            </div>
          ))}
        </div>
      )}

      {r.agreement && (
        <p className="muted" style={{ fontSize: 11.5, marginTop: 12 }}>
          {t("Skv.")} <a href={r.agreement.url} target="_blank" rel="noreferrer" style={{ color: "var(--brand)" }}>{r.agreement.source}</a>.{" "}
          {t("Starfsaldur er talinn frá ráðningardegi hjá þessu fyrirtæki; áunninn réttur frá fyrri vinnuveitanda er ekki með. Veikindadagar eru virkir dagar; mánuður ≈ 21,7 dagar.")}
          {!r.birthKnown && ` ${t("Kennitala vantar — 22 ára reglan um orlof er ekki metin.")}`}
        </p>
      )}
    </div>
  );
}
