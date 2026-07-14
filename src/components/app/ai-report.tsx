"use client";

// AI report assistant card — used on Skýrslur and Frammistaða.
// Ask in plain language about YOUR data for a chosen period; get a
// plain-language summary + table + chart. Save queries as living reports
// (re-run on every open, so figures are always fresh) and export.

import { useEffect, useRef, useState } from "react";
import { toast } from "@/components/app/toast";
import { nf, dec1 } from "@/lib/format";
import { useLang } from "@/components/app/lang";
import { Bars } from "@/components/app/charts";
import { DateField } from "@/components/app/fields";
import { aiReportQuery, type AiReportResult } from "@/app/(app)/skyrslur/ai-report";
import { exportTableXlsx, exportTablePdf } from "@/lib/export-report";

type SavedReport = { id: string; question: string; period: PeriodKey; from?: string; to?: string; created: string };
type PeriodKey = "7d" | "30d" | "month" | "custom";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

/** Resolve a (possibly relative) period into concrete dates — saved reports
 * store the RULE, so "síðustu 30 dagar" is always fresh. */
function resolvePeriod(p: PeriodKey, from?: string, to?: string): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (p === "custom" && from && to) return { from, to };
  if (p === "month") return { from: iso(new Date(t.getFullYear(), t.getMonth(), 1)), to: iso(t) };
  const days = p === "7d" ? 6 : 29;
  const f = new Date(t); f.setDate(f.getDate() - days);
  return { from: iso(f), to: iso(t) };
}

const LS_KEY = "vakto-ai-reports";
const loadSaved = (): SavedReport[] => { try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "[]"); } catch { return []; } };
const storeSaved = (r: SavedReport[]) => { try { localStorage.setItem(LS_KEY, JSON.stringify(r)); } catch {} };

export function AiReportCard({ examples }: { examples?: string[] }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const [period, setPeriod] = useState<PeriodKey>("30d");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [busy, setBusy] = useState(false);
  const [res, setRes] = useState<AiReportResult | null>(null);
  const [saved, setSaved] = useState<SavedReport[]>([]);
  const [listening, setListening] = useState(false);
  const recRef = useRef<{ stop: () => void } | null>(null);
  useEffect(() => { setSaved(loadSaved()); }, []);

  const speechOk = typeof window !== "undefined" && ("webkitSpeechRecognition" in window || "SpeechRecognition" in window);
  function toggleVoice() {
    if (listening) { recRef.current?.stop(); return; }
    const Ctor = (window as unknown as { SpeechRecognition?: new () => unknown; webkitSpeechRecognition?: new () => unknown }).SpeechRecognition
      ?? (window as unknown as { webkitSpeechRecognition?: new () => unknown }).webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor() as { lang: string; interimResults: boolean; continuous: boolean; onresult: (e: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void; onend: () => void; onerror: () => void; start: () => void; stop: () => void };
    rec.lang = "is-IS"; rec.interimResults = false; rec.continuous = true;
    rec.onresult = (e) => { const text = Array.from({ length: e.results.length }, (_, i) => e.results[i][0]?.transcript ?? "").join(" ").trim(); if (text) setQ((cur) => (cur ? `${cur} ${text}` : text)); };
    rec.onend = () => setListening(false);
    rec.onerror = () => setListening(false);
    recRef.current = rec; setListening(true); rec.start();
  }

  async function run(question?: string, p?: PeriodKey, f?: string, tt?: string) {
    const qq = (question ?? q).trim();
    if (!qq) { toast(t("Skrifaðu spurningu fyrst")); return; }
    const pk = p ?? period;
    const range = resolvePeriod(pk, f ?? from, tt ?? to);
    setBusy(true);
    setRes(null);
    const r = await aiReportQuery(qq, range.from, range.to);
    setBusy(false);
    if (!r.ok) { toast(r.error ?? "Villa"); return; }
    setRes(r);
    if (question) { setQ(question); setPeriod(pk); }
  }

  function save() {
    if (!q.trim()) return;
    const item: SavedReport = { id: String(Date.now()), question: q.trim(), period, from: from || undefined, to: to || undefined, created: iso(new Date()) };
    const next = [item, ...saved].slice(0, 12);
    setSaved(next); storeSaved(next);
    toast(t("Skýrsla vistuð — endurreiknast í hvert sinn sem hún er opnuð"));
  }
  function removeSaved(id: string) {
    const next = saved.filter((s) => s.id !== id);
    setSaved(next); storeSaved(next);
  }

  async function doExport(fmt: "xlsx" | "pdf") {
    if (!res?.rows?.length) { toast(t("Engin tafla til að flytja út")); return; }
    const range = resolvePeriod(period, from, to);
    const payload = { title: res.title, company: "VAKTO", from: range.from, to: range.to, columns: res.columns ?? [], numeric: res.numeric ?? [], rows: res.rows };
    if (fmt === "xlsx") await exportTableXlsx(payload); else await exportTablePdf(payload);
    toast(fmt === "xlsx" ? "Excel sótt" : "PDF sótt");
  }

  const PERIODS: [PeriodKey, string][] = [["7d", "Síðustu 7 dagar"], ["30d", "Síðustu 30 dagar"], ["month", "Þessi mánuður"], ["custom", "Sérsnið"]];
  const ex = examples ?? [
    "Hver er heildarlaunakostnaðurinn og hvernig skiptist hann?",
    "Berðu saman deildirnar — hvar er kostnaðurinn mestur?",
    "Hver vann mesta yfirvinnu og hvað kostaði hún?",
    "Hvernig er mætingin miðað við plan?",
  ];

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch">
        <div>
          <div className="ct" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--brand)" strokeWidth="1.8"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /><path d="M19 15l.9 2.3 2.3.7-2.3.9L19 21l-.9-2.1-2.1-.9 2.1-.7Z" /></svg>
            {t("AI greining")}
          </div>
          <div className="cs">{t("spurðu um gögnin þín á mannamáli — fáðu yfirlit, töflu og graf fyrir valið tímabil")}</div>
        </div>
      </div>
      <div className="cb">
        {/* period filter — always available */}
        <div className="pchips" style={{ alignItems: "center", flexWrap: "wrap", marginBottom: 10 }}>
          {PERIODS.map(([k, label]) => (
            <button key={k} className={`pchip${period === k ? " on" : ""}`} onClick={() => setPeriod(k)}>{t(label)}</button>
          ))}
          {period === "custom" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
              <DateField value={from} onChange={(v) => { setFrom(v); if (to && v > to) setTo(v); }} />
              <span className="muted">–</span>
              <DateField value={to} onChange={(v) => { setTo(v); if (from && v < from) setFrom(v); }} />
            </span>
          )}
        </div>

        <div style={{ position: "relative" }}>
          <textarea
            className="lf-ta" rows={2} value={q} onChange={(e) => setQ(e.target.value)}
            placeholder={t("t.d. Berðu saman launakostnað deilda og segðu mér hvar má spara…")}
            style={speechOk ? { paddingRight: 44 } : undefined}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); run(); } }}
          />
          {speechOk && (
            <button type="button" onClick={toggleVoice} title={listening ? t("Stöðva upptöku") : t("Tala inn fyrirmæli")}
              style={{ position: "absolute", right: 8, top: 8, width: 32, height: 32, borderRadius: "50%", border: "1px solid var(--line)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: listening ? "var(--bad)" : "var(--line2)", color: listening ? "#fff" : "var(--ink2)" }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="9" y="2.5" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3.5" /></svg>
            </button>
          )}
        </div>
        <div className="chips" style={{ marginTop: 8 }}>
          {ex.map((c) => <button className="chip" key={c} onClick={() => setQ(c)}>{c}</button>)}
        </div>
        <div style={{ display: "flex", gap: 9, marginTop: 12, flexWrap: "wrap" }}>
          <button className="btn sm" disabled={busy} onClick={() => run()}>
            {busy ? t("Greini…") : t("Greina")}
          </button>
          <button className="btn ghost sm" disabled={!q.trim()} onClick={save}>{t("Vista skýrslu")}</button>
        </div>

        {/* result */}
        {res && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 16 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <b style={{ fontSize: 15 }}>{res.title}</b>
              {!res.live && <span className="tag mut">{t("innbyggð greining")}</span>}
              <span style={{ marginLeft: "auto", display: "flex", gap: 8 }}>
                <button className="btn ghost sm" onClick={() => doExport("xlsx")}>Excel</button>
                <button className="btn ghost sm" onClick={() => doExport("pdf")}>PDF</button>
              </span>
            </div>
            <p style={{ fontSize: 13.5, lineHeight: 1.6, margin: "10px 0 0", whiteSpace: "pre-line" }}>{res.summary}</p>
            {res.chart && res.chart.values.length > 0 && (
              <div style={{ marginTop: 14 }}>
                <Bars vals={res.chart.values.map((v) => Math.round(v * 10) / 10)} t={Math.max(...res.chart.values) + 1} height={120} labels={res.chart.labels} unit="" tips={res.chart.values.map((v) => `${dec1(v)} ${res.chart!.label}`)} />
                <p className="muted" style={{ fontSize: 11.5, marginTop: 4, textAlign: "center" }}>{res.chart.label}</p>
              </div>
            )}
            {res.rows && res.rows.length > 0 && (
              <div className="tbl" style={{ marginTop: 12, overflowX: "auto" }}>
                <table>
                  <thead><tr>{(res.columns ?? []).map((c, i) => <th key={c} className={res.numeric?.includes(i) ? "r" : undefined}>{c}</th>)}</tr></thead>
                  <tbody>
                    {res.rows.map((r, ri) => (
                      <tr key={ri}>{r.map((v, ci) => <td key={ci} className={res.numeric?.includes(ci) ? "r" : undefined}>{typeof v === "number" ? (Number.isInteger(v) ? nf(v) : dec1(v)) : v}</td>)}</tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* saved living reports */}
        {saved.length > 0 && (
          <div style={{ marginTop: 18, borderTop: "1px solid var(--line)", paddingTop: 14 }}>
            <div className="cs" style={{ marginBottom: 8 }}>{t("Vistaðar skýrslur — endurreiknast með nýjustu gögnum")}</div>
            <div className="att">
              {saved.map((s) => (
                <div className="it" key={s.id}>
                  <div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 15, height: 15 }}><path d="M9 12h6M9 16h4M6 3h9l5 5v13a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg></div>
                  <div className="tx" style={{ cursor: "pointer" }} onClick={() => run(s.question, s.period, s.from, s.to)}>
                    <b>{s.question}</b>
                    <span>{t(PERIODS.find(([k]) => k === s.period)?.[1] ?? "")} · {t("vistuð")} {s.created}</span>
                  </div>
                  <button className="tag mut" style={{ border: "none", cursor: "pointer", background: "var(--line2)", color: "var(--ink3)" }} onClick={() => removeSaved(s.id)}>{t("Eyða")}</button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
