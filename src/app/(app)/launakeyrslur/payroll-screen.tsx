"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { dec1 } from "@/lib/format";
import { BURDEN } from "@/lib/payroll";
import { getSettleCandidates, type SettleCandidate } from "./actions";
import { toast } from "@/components/app/toast";
import { Stacked } from "@/components/app/charts";
import { useLang } from "@/components/app/lang";
import { PayslipModal, type PayslipData } from "@/components/app/payslip-modal";
import { EmptyState } from "@/components/app/empty-state";
import type { PayrollView } from "./payroll.server";
import { runPayroll, getPayrollPeriod, getPayrollHistory, type PeriodPayroll, type PayrollHistory } from "./actions";

const MO = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
// "+30,2% byrði" comes from the payroll engine — never a literal.
const BURDEN_PCT = (Math.round(BURDEN * 1000) / 10).toString().replace(".", ",");

const PRESETS: { k: string; label: string }[] = [
  { k: "this", label: "Þessi mánuður" }, { k: "last", label: "Síðasti mánuður" }, { k: "custom", label: "Sérsniðið" },
];
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };
function payRange(k: string, cf: string, ct: string, startDay = 1): { from: string; to: string } {
  if (k === "custom") return { from: cf, to: ct };
  const t = new Date();
  const d = Math.min(28, Math.max(1, startDay));
  let from: Date;
  if (d === 1) {
    from = new Date(t.getFullYear(), t.getMonth() - (k === "last" ? 1 : 0), 1);
  } else {
    from = t.getDate() >= d ? new Date(t.getFullYear(), t.getMonth(), d) : new Date(t.getFullYear(), t.getMonth() - 1, d);
    if (k === "last") from = new Date(from.getFullYear(), from.getMonth() - 1, d);
  }
  const to = d === 1 ? new Date(from.getFullYear(), from.getMonth() + 1, 0) : new Date(from.getFullYear(), from.getMonth() + 1, d - 1);
  return { from: isoD(from), to: isoD(to) };
}

export default function PayrollScreen({ view, empty = false, periodStart = 1 }: { view: PayrollView; empty?: boolean; periodStart?: number }) {
  const { t } = useLang();
  const [slip, setSlip] = useState<PayslipData | null>(null);
  const [period, setPeriod] = useState("this");
  const thisMonth = payRange("this", "", "", periodStart);
  const [cf, setCf] = useState(thisMonth.from);
  const [ct, setCt] = useState(thisMonth.to);
  const [pp, setPp] = useState<PeriodPayroll | null>(null);
  const [settleIds, setSettleIds] = useState<string[]>([]);
  const [tbModal, setTbModal] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);

  const range = payRange(period, cf, ct, periodStart);
  useEffect(() => {
    if (!view.live) return;
    if (period === "custom" && (!cf || !ct || cf > ct)) return;
    let cancelled = false;
    getPayrollPeriod(range.from, range.to).then((r) => { if (!cancelled && r.live) setPp(r); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, cf, ct, view.live]);

  // Real payroll history for the year chart.
  const [histYear, setHistYear] = useState(new Date().getFullYear());
  const [hist, setHist] = useState<PayrollHistory | null>(null);
  useEffect(() => {
    if (!view.live) return;
    getPayrollHistory(histYear).then(setHist).catch(() => {});
  }, [view.live, histYear]);

  const usePp = view.live && pp;
  const ROWS = usePp ? pp.rows : view.rows;
  const T = usePp ? pp.totals : view.totals;
  const periodLabel = usePp ? pp.periodLabel : `${niceISO(range.from)} – ${niceISO(range.to)}`;
  const pending = usePp ? pp.pendingPunches : null;
  const qs = `?format=$F&from=${range.from}&to=${range.to}`;
  function download(format: "payday" | "excel" | "dk") {
    setExportOpen(false);
    window.location.href = `/api/payroll/export${qs.replace("$F", format)}`;
  }
  async function keyra() {
    const res = await runPayroll(range.from, range.to, settleIds);
    if (!res.ok) { toast(res.error ?? t("Tókst ekki")); return; }
    toast(`${t("Launakeyrsla keyrð & vistuð")} — ${res.count} ${t("starfsmenn")}`);
  }
  if (empty) {
    return (
      <>
        <PageHeader title="Launakeyrslur" subtitle="Launagreiðslur · 2026" />
        <EmptyState
          title="Engar launakeyrslur enn"
          message="Bættu fyrst við starfsfólki með taxta og kjarasamningi. Þá getur þú keyrt launakeyrslu sem VAKTO reiknar sjálfkrafa og Payday sér um skil."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  if (!view.live) {
    return (
      <>
        <PageHeader title="Launakeyrslur" subtitle="Launagreiðslur · 2026" />
        <div className="card" style={{ marginTop: 16, maxWidth: 520 }}>
          <div className="cb">
            <div className="ct">{t("Supabase er ekki tengt")}</div>
            <p className="muted" style={{ fontSize: 13, margin: "6px 0 0" }}>{t("Launakeyrslur birtast þegar gagnagrunnurinn er tengdur og þú ert innskráð(ur).")}</p>
          </div>
        </div>
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Launakeyrslur"
        subtitle="Launagreiðslur · 2026"
        actions={
          <div style={{ position: "relative" }}>
            <button className="btn ghost sm" aria-haspopup="menu" aria-expanded={exportOpen} onClick={() => setExportOpen((v) => !v)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Flytja út")}
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginLeft: 4 }}><path d="M6 9l6 6 6-6" /></svg>
            </button>
            {exportOpen && (
              <>
                <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setExportOpen(false)} />
                <div className="tmenu show" role="menu" style={{ position: "absolute", right: 0, top: "calc(100% + 6px)", left: "auto", minWidth: 230 }}>
                  <div className="mi" role="menuitem" onClick={() => download("payday")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 10h18M9 4v16" /></svg>
                    <span>Payday <span className="muted" style={{ fontSize: 11.5 }}>· {t("tímaskrá")} (.xlsx)</span></span>
                  </div>
                  <div className="mi" role="menuitem" onClick={() => download("dk")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 3v5h5" /><path d="M7 3h7l5 5v11a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1Z" /></svg>
                    <span>DK <span className="muted" style={{ fontSize: 11.5 }}>· (.csv)</span></span>
                  </div>
                  <div className="mi" role="menuitem" onClick={() => download("excel")}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9h18M3 14h18M9 4v16M15 4v16" /></svg>
                    <span>Excel <span className="muted" style={{ fontSize: 11.5 }}>· {t("sundurliðun per starfsmann")}</span></span>
                  </div>
                </div>
              </>
            )}
          </div>
        }
      />

      {/* pay-period chips (21.–20. logic) + a Payday-style picker for any other range */}
      <div className="pchips" style={{ alignItems: "center" }}>
        {PRESETS.filter((p) => p.k !== "custom").map((p) => (
          <button key={p.k} className={`pchip${period === p.k ? " on" : ""}`} onClick={() => setPeriod(p.k)}>{t(p.label)}</button>
        ))}
        <PeriodPicker
          from={period === "custom" ? cf : range.from} to={period === "custom" ? ct : range.to}
          onApply={(a, b) => { setCf(a); setCt(b); setPeriod("custom"); }}
        />
      </div>

      <div className="dhero" style={{ marginBottom: 20 }}>
        <div className="dhero-head">
          <span className="dhero-badge">{t("Launatímabil")} · {periodLabel}</span>
          {/* Real approval state: green only when every closed punch in the period is approved. */}
          {pending === 0 && (
            <span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Samþykktir tímar")}</span>
          )}
          {pending != null && pending > 0 && (
            <Link href="/timaskraning" className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)", textDecoration: "none" }} title={t("Opna tímaskráningu til að samþykkja")}>
              {pending} {pending === 1 ? t("óafgreidd stimplun") : t("óafgreiddar stimplanir")}
            </Link>
          )}
        </div>
        <div className="dhero-body">
          <div className="dflow">
            <div className="fs"><div className="l">{t("Starfsmenn")}</div><div className="v">{T.count}</div></div>
            <span className="ar">·</span>
            <div className="fs"><div className="l">{t("Unnir tímar")}</div><div className="v">{T.hours}</div></div>
            <span className="ar">·</span>
            <div className="fs"><div className="l">{t("Brúttó")}</div><div className="v">{T.grossM} <small style={{ fontSize: 14, color: "var(--ink3)", fontWeight: 600 }}>m.kr.</small></div></div>
          </div>
          <div className="payacts">
            <button className="btn ghost sm" style={settleIds.length ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
              title={t("Jafnar mínus-stöðu tímabanka á GRUNNTAXTA — yfirvinnuálagið helst alltaf hjá starfsmanninum")}
              onClick={() => setTbModal(true)}>
              {t("Jafna tímabanka")}{settleIds.length ? ` (${settleIds.length})` : ""}
            </button>
            <button className="btn" onClick={keyra}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 6" /></svg>{t("Keyra launakeyrslu")}</button>
          </div>
        </div>
      </div>

      {usePp && pp.needsMigration && (
        <div className="ai" style={{ marginBottom: 16 }}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg><div className="x">{t("Samþykkt tíma er ekki virk í þessum gagnagrunni — allir lokaðir tímar teljast með.")}</div></div>
      )}

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Útborgað")}</div><div className="val">{T.netM} <small>m.kr.</small></div></div>
        <div className="kpi"><div className="lab">{t("Heildarkostnaður")}</div><div className="val">{T.costM} <small>m.kr.</small></div><div className="d mut">+{BURDEN_PCT}% {t("byrði")}</div></div>
        <div className="kpi"><div className="lab">{t("Staðgreiðsla")}</div><div className="val">{T.withholdingM} <small>m.kr.</small></div></div>
        <div className="kpi"><div className="lab">{t("Tryggingagjald")}</div><div className="val">{T.insuranceM} <small>m.kr.</small></div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">{t("Launakeyrsla — sundurliðun per starfsmann")}</div><div className="cs">{periodLabel} · {t("aðeins samþykktir tímar")}</div></div></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th className="r">{t("Tímar")}</th><th className="r">{t("Brúttó")}</th><th className="r">{t("Staðgreiðsla")}</th><th className="r">{t("Lífeyrir+félag")}</th><th className="r">{t("Útborgað")}</th></tr></thead>
            <tbody>
              {ROWS.length ? ROWS.map((r) => (
                <tr className="rowlink" key={r.n} onClick={() => setSlip({ name: r.n, period: periodLabel, hours: r.h, gross: r.g, withholding: r.w.replace("−", ""), pension: r.p.replace("−", ""), net: r.net })}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.n}</span></td>
                  <td className="r">{r.h}</td>
                  <td className="r">{r.g}</td>
                  <td className="r muted">{r.w}</td>
                  <td className="r muted">{r.p}</td>
                  <td className="r" style={{ color: "var(--good)" }}>{r.net}</td>
                </tr>
              )) : <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 26 }}>{t("Engir samþykktir tímar á þessu tímabili — samþykktu vaktir í Tímaskráningu.")}</td></tr>}
              {ROWS.length > 0 && (
              <tr className="foot">
                <td style={{ textAlign: "left" }}>{t("Samtals")} · {T.count} {t("starfsm.")}</td>
                <td className="r">{T.hours}</td><td className="r">{T.gross}</td><td className="r">{T.withholding}</td><td className="r">{T.pensionUnion}</td><td className="r">{T.net}</td>
              </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card" style={{ marginTop: 16 }}>
        <div className="ch"><div><div className="ct">{t("Launakeyrslur — yfirlit")}</div><div className="cs">{t("sundurliðun eftir mánuðum")}</div></div>
          <select className="badge" style={{ border: "1px solid var(--line)", padding: "5px 10px" }} value={histYear} onChange={(e) => setHistYear(Number(e.target.value))}>
            {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
        <div className="cb">
          {(() => {
            // Real runs only — the chart builds up as payroll runs are saved.
            const liveMonths = hist?.months ?? [];
            const hasData = liveMonths.some((m) => m.net > 0);
            const mkr = (n: number) => Math.round(n / 100000) / 10;
            if (!hasData) {
              return <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Sögulega yfirlitið byggist upp þegar þú keyrir launakeyrslur — engin keyrsla er enn vistuð fyrir")} {histYear}.</p>;
            }
            const data = liveMonths.map((m) => [mkr(m.net), mkr(m.withholding), mkr(m.pension), mkr(m.insurance), mkr(m.orlof)]);
            return (<>
              <Stacked data={data} cols={MO} segs={["var(--good)", "var(--warn)", "var(--brand)", "var(--teal)", "#c9ccd6"]} segNames={[t("Útborgað"), t("Staðgreiðsla"), t("Lífeyrir"), t("Tryggingagjald"), t("Orlof")]} />
              <div className="legend">
                <span><i style={{ background: "var(--good)" }} />{t("Útborgað")}</span><span><i style={{ background: "var(--warn)" }} />{t("Staðgreiðsla")}</span>
                <span><i style={{ background: "var(--brand)" }} />{t("Lífeyrir")}</span><span><i style={{ background: "var(--teal)" }} />{t("Tryggingagjald")}</span><span><i style={{ background: "#c9ccd6" }} />{t("Orlof")}</span>
              </div>
            </>);
          })()}
        </div>
      </div>

      <p className="muted" style={{ fontSize: 12, marginTop: 14 }}>{t("Vakto reiknar — Payday sér um skil, greiðslur og opinbera skýrslugerð.")}</p>

      {tbModal && <SettleModal selected={settleIds} onSave={(ids) => { setSettleIds(ids); setTbModal(false); }} onClose={() => setTbModal(false)} />}
      {slip && <PayslipModal data={slip} onClose={() => setSlip(null)} />}
    </>
  );
}


/** Pick WHICH employees get their time bank settled in this run — sometimes
 * the employer (or the employee) wants to wait, so it's per-person. */
function SettleModal({ selected, onSave, onClose }: { selected: string[]; onSave: (ids: string[]) => void; onClose: () => void }) {
  const { t } = useLang();
  const [rows, setRows] = useState<SettleCandidate[]>([]);
  const [sel, setSel] = useState<Set<string>>(new Set(selected));
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    getSettleCandidates().then((r) => {
      setRows(r.rows);
      // Default: everyone with a debt is picked (uncheck to skip someone).
      if (!selected.length) setSel(new Set(r.rows.map((x) => x.id)));
      setLoading(false);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>{t("Jafna tímabanka")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>{t("Veldu hjá hverjum á að jafna í þessari keyrslu. Dregið er af á grunntaxta — yfirvinnuálagið helst alltaf hjá starfsmanninum.")}</p>
          {loading ? <p className="muted" style={{ fontSize: 13 }}>{t("Sæki stöðu…")}</p>
            : rows.length === 0 ? <p className="muted" style={{ fontSize: 13 }}>{t("Enginn mánaðarlaunamaður er með mínus-stöðu í tímabankanum.")}</p>
            : rows.map((r) => (
              <label key={r.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 0", borderBottom: "1px solid var(--line2)", cursor: "pointer", fontSize: 13.5 }}>
                <input type="checkbox" checked={sel.has(r.id)} onChange={(e) => setSel((sv) => { const n = new Set(sv); if (e.target.checked) n.add(r.id); else n.delete(r.id); return n; })} />
                <b style={{ flex: 1 }}>{r.name}</b>
                <span style={{ color: "var(--bad)", fontVariantNumeric: "tabular-nums", fontWeight: 650 }}>{dec1(r.balance)} {t("klst")}</span>
              </label>
            ))}
          <div style={{ display: "flex", gap: 9, marginTop: 16 }}>
            <button className="btn" onClick={() => onSave([...sel])}>{t("Nota í keyrslu")}{sel.size ? ` (${sel.size})` : ""}</button>
            <button className="btn ghost" onClick={() => onSave([])}>{t("Sleppa jöfnun")}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
