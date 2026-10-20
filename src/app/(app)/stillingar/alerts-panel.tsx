"use client";

// Stillingar → Vaktarar og skýrslur (0086). Reglur á mannamáli, kveikja/slökkva, eyða og „Nýr vaktari“
// með sniðmátum. Sama aðgerð og VAKTO AI notar (alert-actions.ts). Þolir að taflan vanti.

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { listAlerts, createAlert, setAlertActive, deleteAlert, sendAlertReportNow, type AlertsData } from "./alert-actions";
import {
  ALERT_PRESETS, SCHEDULABLE_REPORTS, RANGES, REPORT_TITLE, RANGE_LABEL, describeAlert, defaultRange,
  type AlertKind, type AlertPeriod, type AlertChannel, type AlertReport, type ReportFreq, type ReportRange, type AlertRule,
} from "@/lib/alerts";

const Bell = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" /></svg>;
const Doc = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}><path d="M9 12h6M9 16h4M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg>;
const Trash = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 15, height: 15 }}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></svg>;

function Switch({ on, label, onChange }: { on: boolean; label: string; onChange: (v: boolean) => void }) {
  return (
    <button type="button" role="switch" aria-checked={on} aria-label={label} title={label} onClick={(e) => { e.stopPropagation(); onChange(!on); }}
      style={{ width: 38, height: 22, borderRadius: 999, border: 0, padding: 2, cursor: "pointer", flex: "none", background: on ? "var(--brand)" : "var(--line)", transition: "background .15s" }}>
      <span style={{ display: "block", width: 18, height: 18, borderRadius: 999, background: "#fff", boxShadow: "0 1px 2px rgba(0,0,0,.2)", transform: on ? "translateX(16px)" : "none", transition: "transform .15s" }} />
    </button>
  );
}

type Form = {
  kind: AlertKind; hours: string; pct: string; period: AlertPeriod; warnPct: string; includePlanned: boolean;
  report: AlertReport; freq: ReportFreq; weekday: number; day: number; range: ReportRange; channel: AlertChannel; recipients: string[];
};

const WEEKDAYS: [number, string][] = [[1, "Mánudagur"], [2, "Þriðjudagur"], [3, "Miðvikudagur"], [4, "Fimmtudagur"], [5, "Föstudagur"], [6, "Laugardagur"], [7, "Sunnudagur"]];

function fromPreset(id: string, me: string | null): Form {
  const p = ALERT_PRESETS.find((x) => x.id === id) ?? ALERT_PRESETS[0];
  const r = p.rule, pr = r.params;
  return {
    kind: r.kind, hours: String(pr.hours ?? 180), pct: String(pr.pct ?? 32), period: pr.period ?? "month", warnPct: String(pr.warnPct ?? 90),
    includePlanned: !!pr.includePlanned, report: pr.report ?? "overtime", freq: r.schedule?.freq ?? "weekly", weekday: r.schedule?.weekday ?? 1,
    day: r.schedule?.day ?? 1, range: pr.range ?? "last_week", channel: r.channel, recipients: me ? [me] : [],
  };
}

function toInput(f: Form) {
  const num = (s: string) => Number(s.replace(",", "."));
  return {
    kind: f.kind, channel: f.channel, recipients: f.recipients,
    params: f.kind === "report" ? { report: f.report, range: f.range }
      : f.kind === "labor_pct_above" ? { pct: num(f.pct), period: f.period === "week" ? "week" : "month" }
      : f.kind === "overtime_threshold" ? { hours: num(f.hours), period: f.period }
      : { hours: num(f.hours), period: f.period, warnPct: num(f.warnPct || "0"), includePlanned: f.includePlanned },
    schedule: f.kind === "report" ? { freq: f.freq, weekday: f.weekday, day: f.day } : null,
  };
}

export function AlertsPanel() {
  const { t, lang } = useLang();
  const L = lang === "is" ? "is" : "en";
  const [data, setData] = useState<AlertsData | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [busy, setBusy] = useState(false);

  async function load() { setData(await listAlerts().catch(() => null)); }
  useEffect(() => { void listAlerts().then(setData).catch(() => setData(null)); }, []);

  const rules = data?.rules ?? [];
  const nameOf = (id: string) => data?.people.find((p) => p.id === id)?.name.split(/\s+/)[0] ?? "";
  const chLabel = (c: AlertChannel) => (c === "push" ? t("Push-tilkynning") : c === "both" ? t("Tölvupóstur og push") : t("Tölvupóstur"));

  async function toggle(r: AlertRule, on: boolean) {
    setData((d) => d && { ...d, rules: d.rules.map((x) => (x.id === r.id ? { ...x, active: on } : x)) });
    const res = await setAlertActive(r.id, on);
    if (!res.ok) { toast(res.error ?? t("Villa")); void load(); }
  }
  async function remove(r: AlertRule) {
    if (!confirm(t("Eyða vaktara?"))) return;
    const res = await deleteAlert(r.id);
    toast(res.ok ? t("Vaktara eytt") : (res.error ?? t("Villa")));
    if (res.ok) setData((d) => d && { ...d, rules: d.rules.filter((x) => x.id !== r.id) });
  }
  async function sendNow(r: AlertRule) {
    const res = await sendAlertReportNow(r.id);
    toast(res.ok ? t("Skýrslan send á netfangið þitt") : (res.error ?? t("Villa")));
  }
  async function save() {
    if (!form) return;
    setBusy(true);
    const res = await createAlert(toInput(form), "ui");
    setBusy(false);
    if (!res.ok) { toast(res.error ?? t("Villa")); return; }
    toast(t("Vaktari vistaður")); setForm(null); void load();
  }
  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm((f) => (f ? { ...f, [k]: v } : f));
  const preview = form ? (() => { const i = toInput(form); return describeAlert({ kind: i.kind, params: i.params as never, schedule: i.schedule ? { ...i.schedule, hour: 8 } : null }, L); })() : "";

  return (
    <>
      <div className="card">
        <div className="ch">
          <div><div className="ct">{t("Vaktarar og skýrslur")}</div><div className="cs">{t("Láttu VAKTO vita þegar eitthvað þarf athygli, eða fáðu skýrslur sendar sjálfkrafa")}</div></div>
          {!data?.missing && <button className="btn sm" disabled={!data?.ok} onClick={() => setForm(fromPreset("h180", data?.me ?? null))}>{t("+ Nýr vaktari")}</button>}
        </div>
        <div className="cb att">
          {data === null && <p className="muted" style={{ fontSize: 12.5 }}>{t("Augnablik…")}</p>}
          {data?.missing && <p className="muted" style={{ fontSize: 12.5 }}>{t("Vaktarar verða virkir þegar uppfærsla gagnagrunnsins er komin inn.")}</p>}
          {data && !data.ok && !data.missing && <p className="muted" style={{ fontSize: 12.5 }}>{data.error ?? t("Villa")}</p>}
          {data?.ok && rules.length === 0 && (
            <>
              <p className="muted" style={{ fontSize: 12.5 }}>{t("Engir vaktarar enn. Byrjaðu á sniðmáti eða biddu VAKTO AI um að setja þá upp.")}</p>
              <div className="chips">
                {ALERT_PRESETS.map((p) => <button key={p.id} className="chip" onClick={() => setForm(fromPreset(p.id, data.me))}>{p[L]}</button>)}
              </div>
            </>
          )}
          {rules.map((r) => (
            <div className="it" key={r.id} style={{ opacity: r.active ? 1 : 0.6 }}>
              <div className="ic info">{r.kind === "report" ? <Doc /> : <Bell />}</div>
              <div className="tx">
                <b>{describeAlert(r, L)}</b>
                <span>
                  {chLabel(r.channel)}
                  {r.recipients.length > 0 && ` · ${r.recipients.map(nameOf).filter(Boolean).join(", ")}`}
                  {r.lastFiredAt && ` · ${t("Síðast")} ${(() => { const d = new Date(r.lastFiredAt); return `${d.getDate()}.${d.getMonth() + 1}.`; })()}`}
                </span>
              </div>
              {r.createdVia === "ai" && <span className="tag info" style={{ whiteSpace: "nowrap" }}>{t("búið til af VAKTO AI")}</span>}
              {r.kind === "report" && <button className="btn ghost sm" onClick={() => sendNow(r)}>{t("Senda núna")}</button>}
              <Switch on={r.active} label={r.active ? t("Slökkva") : t("Kveikja")} onChange={(v) => toggle(r, v)} />
              <button className="btn ghost sm" onClick={() => remove(r)} aria-label={t("Eyða")} title={t("Eyða")}><Trash /></button>
            </div>
          ))}
          {data?.ok && (
            <p className="muted" style={{ fontSize: 12, marginTop: 6 }}>
              {t("Vaktarar eru metnir daglega kl. 8 og hver viðvörun kemur einu sinni per starfsmann per tímabil. Gleymd útstimplun og mætti ekki á vakt eru þegar tilkynnt sjálfkrafa.")}
            </p>
          )}
        </div>
      </div>

      {form && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setForm(null)}>
          <div className="mbg" onClick={() => setForm(null)} />
          <div className="modal" style={{ maxWidth: 520 }}>
            <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Nýr vaktari")}</div><button className="x" onClick={() => setForm(null)}>✕</button></div>
            <div className="mb">
              <div className="chips" style={{ marginTop: 0, marginBottom: 14 }}>
                {ALERT_PRESETS.map((p) => <button key={p.id} type="button" className="chip" onClick={() => setForm({ ...fromPreset(p.id, data?.me ?? null), recipients: form.recipients })}>{p[L]}</button>)}
              </div>
              <div className="field"><label>{t("Tegund")}</label>
                <select value={form.kind} onChange={(e) => set("kind", e.target.value as AlertKind)}>
                  <option value="hours_threshold">{t("Tímafjöldi starfsmanns")}</option>
                  <option value="overtime_threshold">{t("Yfirvinna starfsmanns")}</option>
                  <option value="labor_pct_above">{t("Laun % af veltu")}</option>
                  <option value="report">{t("Skýrsla á tímaáætlun")}</option>
                </select>
              </div>
              {(form.kind === "hours_threshold" || form.kind === "overtime_threshold") && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="field"><label>{form.kind === "overtime_threshold" ? t("Yfirvinnutímar") : t("Klukkustundir")}</label><input inputMode="decimal" value={form.hours} onChange={(e) => set("hours", e.target.value)} /></div>
                  <div className="field"><label>{t("Tímabil")}</label>
                    <select value={form.period} onChange={(e) => set("period", e.target.value as AlertPeriod)}>
                      <option value="week">{t("Vika")}</option><option value="month">{t("Mánuður")}</option><option value="payroll">{t("Launatímabil")}</option>
                    </select>
                  </div>
                </div>
              )}
              {form.kind === "hours_threshold" && (
                <>
                  <div className="field"><label>{t("Viðvörun við % af mörkum (0 = engin)")}</label><input inputMode="numeric" value={form.warnPct} onChange={(e) => set("warnPct", e.target.value)} /></div>
                  <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginBottom: 14 }}>
                    <input type="checkbox" checked={form.includePlanned} onChange={(e) => set("includePlanned", e.target.checked)} />
                    {t("Láta líka vita ef planaðar vaktir sem eru eftir fara yfir")}
                  </label>
                </>
              )}
              {form.kind === "labor_pct_above" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div className="field"><label>{t("Hlutfall %")}</label><input inputMode="decimal" value={form.pct} onChange={(e) => set("pct", e.target.value)} /></div>
                  <div className="field"><label>{t("Tímabil")}</label>
                    <select value={form.period === "week" ? "week" : "month"} onChange={(e) => set("period", e.target.value as AlertPeriod)}>
                      <option value="week">{t("Vika")}</option><option value="month">{t("Mánuður")}</option>
                    </select>
                  </div>
                </div>
              )}
              {form.kind === "report" && (
                <>
                  <div className="field"><label>{t("Skýrsla")}</label>
                    <select value={form.report} onChange={(e) => set("report", e.target.value as AlertReport)}>
                      {SCHEDULABLE_REPORTS.map((r) => <option key={r} value={r}>{REPORT_TITLE[L][r]}</option>)}
                    </select>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="field"><label>{t("Tíðni")}</label>
                      <select value={form.freq} onChange={(e) => { const f = e.target.value as ReportFreq; setForm({ ...form, freq: f, range: defaultRange(f) }); }}>
                        <option value="daily">{t("Daglega")}</option><option value="weekly">{t("Vikulega")}</option><option value="monthly">{t("Mánaðarlega")}</option>
                      </select>
                    </div>
                    {form.freq === "weekly" && (
                      <div className="field"><label>{t("Vikudagur")}</label>
                        <select value={form.weekday} onChange={(e) => set("weekday", Number(e.target.value))}>
                          {WEEKDAYS.map(([v, l]) => <option key={v} value={v}>{t(l)}</option>)}
                        </select>
                      </div>
                    )}
                    {form.freq === "monthly" && (
                      <div className="field"><label>{t("Dagur mánaðar")}</label>
                        <select value={form.day} onChange={(e) => set("day", Number(e.target.value))}>
                          {Array.from({ length: 28 }, (_, i) => i + 1).map((d) => <option key={d} value={d}>{d}.</option>)}
                        </select>
                      </div>
                    )}
                  </div>
                  <div className="field"><label>{t("Tímabil skýrslu")}</label>
                    <select value={form.range} onChange={(e) => set("range", e.target.value as ReportRange)}>
                      {RANGES.map((r) => <option key={r} value={r}>{RANGE_LABEL[L][r]}</option>)}
                    </select>
                  </div>
                  <p className="muted" style={{ fontSize: 12, margin: "-4px 0 14px" }}>{t("Send kl. 8 að morgni sem tafla í tölvupósti með Excel-viðhengi.")}</p>
                </>
              )}
              <div className="field"><label>{t("Rás")}</label>
                <select value={form.channel} onChange={(e) => set("channel", e.target.value as AlertChannel)}>
                  <option value="email">{t("Tölvupóstur")}</option><option value="push">{t("Push-tilkynning")}</option><option value="both">{t("Tölvupóstur og push")}</option>
                </select>
              </div>
              {(data?.people.length ?? 0) > 1 && (
                <div className="field"><label>{t("Viðtakendur")}</label>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 14px" }}>
                    {data!.people.map((p) => (
                      <label key={p.id} style={{ display: "flex", gap: 6, alignItems: "center", fontSize: 13, fontWeight: 500, margin: 0 }}>
                        <input type="checkbox" style={{ width: "auto" }} checked={form.recipients.includes(p.id)}
                          onChange={(e) => set("recipients", e.target.checked ? [...form.recipients, p.id] : form.recipients.filter((x) => x !== p.id))} />
                        {p.name}
                      </label>
                    ))}
                  </div>
                </div>
              )}
              <p style={{ fontSize: 13, fontWeight: 600, background: "var(--line2)", borderRadius: 10, padding: "10px 12px", margin: "4px 0 0" }}>{preview}</p>
              <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
                <button className="btn" disabled={busy} onClick={save}>{t("Vista")}</button>
                <button className="btn ghost" onClick={() => setForm(null)}>{t("Hætta við")}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
