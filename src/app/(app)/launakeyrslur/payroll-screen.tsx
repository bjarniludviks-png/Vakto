"use client";

import { useEffect, useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker } from "@/components/app/period-picker";
import { dec1, nf } from "@/lib/format";
import { getSettleCandidates, type SettleCandidate } from "./actions";
import { toast } from "@/components/app/toast";
import { Stacked } from "@/components/app/charts";
import { useLang } from "@/components/app/lang";
import { PayslipModal, type PayslipData } from "@/components/app/payslip-modal";
import { EmptyState } from "@/components/app/empty-state";
import type { PayrollView } from "./payroll.server";
import { runPayroll, getPayrollPeriod, getPayrollHistory, type PeriodPayroll, type PayrollHistory } from "./actions";

const MO = ["jan", "feb", "mar", "apr", "maí", "jún", "júl", "ágú", "sep", "okt", "nóv", "des"];
const BASE = [4.8, 5.8, 3.9, 5.7, 5.6, 4.46, 4.7, 3.4, 6.7, 6.3, 5.2, 5.4];
const PAY = BASE.map((b) => [b, b * 0.22, b * 0.2, b * 0.12, b * 0.08]);

const PRESETS: { k: string; label: string }[] = [
  { k: "this", label: "Þessi mánuður" }, { k: "last", label: "Síðasti mánuður" }, { k: "custom", label: "Sérsniðið" },
];
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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

  const range = payRange(period, cf, ct, periodStart);
  useEffect(() => {
    if (!view.live) return;
    if (period === "custom" && (!cf || !ct || cf > ct)) return;
    let cancelled = false;
    getPayrollPeriod(range.from, range.to).then((r) => { if (!cancelled && r.live) setPp(r); });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [period, cf, ct, view.live]);

  // Real payroll history for the year chart (live companies only).
  const [histYear, setHistYear] = useState(new Date().getFullYear());
  const [hist, setHist] = useState<PayrollHistory | null>(null);
  useEffect(() => {
    if (!view.live) return;
    getPayrollHistory(histYear).then(setHist).catch(() => {});
  }, [view.live, histYear]);

  const usePp = view.live && pp;
  const ROWS = usePp ? pp.rows : view.rows;
  const T = usePp ? pp.totals : view.totals;
  const periodLabel = usePp ? pp.periodLabel : `${range.from} – ${range.to}`;
  const qs = `?format=$F&from=${range.from}&to=${range.to}`;
  function download(format: "payday" | "excel" | "dk") {
    window.location.href = `/api/payroll/export${qs.replace("$F", format)}`;
  }
  async function keyra() {
    const res = await runPayroll(view.live ? range.from : undefined, view.live ? range.to : undefined, settleIds);
    if (!res.ok) { toast(res.error ?? "Tókst ekki"); return; }
    toast(res.demo ? `Launakeyrsla keyrð (demo — ${res.count} starfsm.)` : `Launakeyrsla keyrð & vistuð — ${res.count} starfsmenn`);
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
  const num = (x: string) => Number(String(x).replace(/[^\d]/g, "")) || 0;
  const gross = num(T.gross), net = num(T.net), wh = num(T.withholding), pu = num(T.pensionUnion);
  const cost = num(T.cost) || Math.round(gross * 1.302);
  const levies = Math.max(0, cost - gross);
  const orlof = Math.round(gross * 0.1017), pens = Math.round(gross * 0.115), trygg = Math.round(gross * 0.0635);
  const parts = [
    { k: "Útborgað", v: net, c: "var(--good)" },
    { k: "Staðgreiðsla", v: wh, c: "var(--warn)" },
    { k: "Lífeyrir+félag", v: pu, c: "var(--brand)" },
    { k: "Launatengd gjöld", v: levies, c: "#c9ccd6" },
  ].filter((p) => p.v > 0);
  const partsSum = parts.reduce((a, p) => a + p.v, 0);
  const hoursN = Number(String(T.hours).replace(/\./g, "").replace(",", ".")) || 0;
  return (
    <div className="db2">
      <div className="db2-top">
        <div><h1>{t("Launakeyrslur")}</h1><div className="db2-sub">{t("Launatímabil")} · {periodLabel}</div></div>
        <div className="db2-period">
          <div className="db2-seg" role="tablist">
            {PRESETS.filter((p) => p.k !== "custom").map((p) => (
              <button key={p.k} role="tab" aria-selected={period === p.k} className={period === p.k ? "on" : ""} onClick={() => setPeriod(p.k)}>{t(p.label)}</button>
            ))}
          </div>
          <PeriodPicker
            from={period === "custom" ? cf : range.from} to={period === "custom" ? ct : range.to}
            onApply={(a, b) => { setCf(a); setCt(b); setPeriod("custom"); }}
          />
        </div>
      </div>

      {usePp && pp.needsMigration && (
        <div className="ai"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v4h1" /></svg><div className="x">{t("Aðgerðin tókst ekki — reyndu aftur eða hafðu samband við VAKTO.")}</div></div>
      )}

      <section className="db2-card db2-hero">
        <div className="db2-hero-l">
          <div className="db2-k">{t("Heildarkostnaður launa")}</div>
          <div className="db2-big db2-big-kr">{nf(cost)}<small>kr</small></div>
          <p className="db2-verdict">{T.count} {t("starfsmenn")} · {T.hours} {t("klst")}{hoursN > 0 && cost > 0 ? ` · ${nf(Math.round(cost / hoursN))} kr ${t("á klst með gjöldum")}` : ""}. <span className="db2-muted">{t("Aðeins samþykktir tímar.")}</span></p>
          {partsSum > 0 && (<>
            <div className="db2-stack db2-stack-lg">{parts.map((p) => <span key={p.k} style={{ width: `${(p.v / partsSum) * 100}%`, background: p.c }} />)}</div>
            <div className="db2-keys">{parts.map((p) => <span key={p.k}><i style={{ background: p.c }} />{t(p.k)}<b>{nf(p.v)} kr</b></span>)}</div>
          </>)}
          <div className="db2-heroacts">
            <button className="btn" onClick={keyra}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12l5 5L20 6" /></svg>{t("Keyra launakeyrslu")}</button>
            <button className="btn ghost" style={settleIds.length ? { borderColor: "var(--brand)", color: "var(--brand)" } : undefined}
              title={t("Jafnar mínus-stöðu tímabanka á GRUNNTAXTA — yfirvinnuálagið helst alltaf hjá starfsmanninum")}
              onClick={() => setTbModal(true)}>
              {t("Jafna tímabanka")}{settleIds.length ? ` (${settleIds.length})` : ""}
            </button>
          </div>
        </div>
        <div className="db2-hero-r">
          <div className="db2-k">{t("Útborgað til starfsfólks")}</div>
          <div className="db2-v">{nf(net)}<small>kr</small></div>
          <div className="db2-lines">
            <div><span>{t("Brúttólaun")}</span><b>{nf(gross)} kr</b></div>
            <div><span>{t("Orlof 10,17%")}</span><b>+{nf(orlof)} kr</b></div>
            <div><span>{t("Mótframlag lífeyris 11,5%")}</span><b>+{nf(pens)} kr</b></div>
            <div><span>{t("Tryggingagjald 6,35%")}</span><b>+{nf(trygg)} kr</b></div>
            {levies - orlof - pens - trygg > 0 && <div><span>{t("Önnur launatengd gjöld (sjóðir o.fl.)")}</span><b>+{nf(levies - orlof - pens - trygg)} kr</b></div>}
            <div className="tot"><span>{t("Heildarkostnaður")}</span><b>{nf(cost)} kr</b></div>
          </div>
        </div>
      </section>

      <section className="db2-card db2-staff">
        <div className="db2-ch"><div><div className="db2-ct">{t("Sundurliðun per starfsmann")}</div><div className="db2-cs">{periodLabel} · {t("smelltu á röð til að sjá launaseðil")}</div></div>
          <button className="btn ghost sm" onClick={() => download("excel")}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>{t("Allir seðlar")}</button></div>
        <div className="db2-tblwrap">
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th className="r">{t("Tímar")}</th><th className="r">{t("Brúttó")}</th><th className="r">{t("Staðgreiðsla")}</th><th className="r">{t("Lífeyrir+félag")}</th><th className="r">{t("Útborgað")}</th><th style={{ width: 20 }} /></tr></thead>
            <tbody>
              {ROWS.length ? ROWS.map((r) => {
                const zero = num(r.g) === 0;
                return (
                <tr className={`db2-rowlink${zero ? " db2-dim" : ""}`} key={r.n} onClick={() => setSlip({ name: r.d?.name ?? r.n, period: periodLabel, hours: r.h, gross: r.g, withholding: r.w.replace("−", ""), pension: r.p.replace("−", ""), net: r.net, d: r.d })}>
                  <td><span className="db2-who"><span className="db2-av sm" style={{ background: r.c }}>{r.av}</span><span>{r.n}</span></span></td>
                  <td className="r">{r.h}</td>
                  <td className="r">{r.g}</td>
                  <td className="r db2-muted">{r.w}</td>
                  <td className="r db2-muted">{r.p}</td>
                  <td className="r" style={{ color: zero ? undefined : "var(--good)", fontWeight: 600 }}>{r.net}</td>
                  <td><svg className="db2-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg></td>
                </tr>
                );
              }) : <tr><td colSpan={7} className="db2-muted" style={{ textAlign: "center", padding: 26 }}>{t("Engir samþykktir tímar á þessu tímabili — samþykktu vaktir í Tímaskráningu.")}</td></tr>}
              {ROWS.length > 0 && (
              <tr className="db2-foot">
                <td>{t("Samtals")} · {T.count} {t("starfsm.")}</td>
                <td className="r">{T.hours}</td><td className="r">{T.gross}</td><td className="r">{T.withholding}</td><td className="r">{T.pensionUnion}</td><td className="r">{T.net}</td><td />
              </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <div className="db2-grid2">
        <section className="db2-card">
          <div className="db2-ch"><div><div className="db2-ct">{t("Launakeyrslur — yfirlit")}</div><div className="db2-cs">{t("sundurliðun eftir mánuðum · færðu músina yfir súlu")}</div></div>
            <select className="badge" style={{ border: "1px solid var(--line)", padding: "5px 10px" }} value={histYear} onChange={(e) => setHistYear(Number(e.target.value))}>
              {[new Date().getFullYear(), new Date().getFullYear() - 1].map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
          <div className="db2-pad">
            {(() => {
              const liveMonths = hist?.months ?? [];
              const hasData = liveMonths.some((m) => m.net > 0);
              const mkr = (n: number) => Math.round(n / 100000) / 10;
              const data = view.live
                ? liveMonths.map((m) => [mkr(m.net), mkr(m.withholding), mkr(m.pension), mkr(m.insurance), mkr(m.orlof)])
                : PAY;
              if (view.live && !hasData) {
                return <p className="db2-muted db2-empty">{t("Sögulega yfirlitið byggist upp þegar þú keyrir launakeyrslur — engin keyrsla er enn vistuð fyrir")} {histYear}.</p>;
              }
              return (<>
                <Stacked data={data} cols={MO} segs={["var(--good)", "var(--warn)", "var(--brand)", "var(--teal)", "#c9ccd6"]} segNames={[t("Útborgað"), t("Staðgreiðsla"), t("Lífeyrir"), t("Tryggingagjald"), t("Orlof")]} />
                <div className="db2-legend" style={{ marginTop: 10 }}>
                  <span><i style={{ background: "var(--good)" }} />{t("Útborgað")}</span><span><i style={{ background: "var(--warn)" }} />{t("Staðgreiðsla")}</span>
                  <span><i style={{ background: "var(--brand)" }} />{t("Lífeyrir")}</span><span><i style={{ background: "var(--teal)" }} />{t("Tryggingagjald")}</span><span><i style={{ background: "#c9ccd6" }} />{t("Orlof")}</span>
                </div>
              </>);
            })()}
          </div>
        </section>
        <section className="db2-card">
          <div className="db2-ch"><div><div className="db2-ct">{t("Útflutningur")}</div><div className="db2-cs">{t("Vakto reiknar — Payday sér um skil, greiðslur og opinbera skýrslugerð.")}</div></div></div>
          <div className="db2-list">
            <div className="db2-it"><span className="db2-ic good">P</span><span className="db2-tx"><b>Payday</b><span>{t("tímaskrá (Excel) — hlaðið upp undir Ný launakeyrsla → Hlaða upp tímaskrá")}</span></span><button className="btn sm" onClick={() => download("payday")}>{t("Flytja")}</button></div>
            <div className="db2-it"><span className="db2-ic info">DK</span><span className="db2-tx"><b>DK</b><span>{t("launaskrá fyrir DK bókhald")}</span></span><button className="btn ghost sm" onClick={() => download("dk")}>{t("Sækja")}</button></div>
            <div className="db2-it"><span className="db2-ic info">XL</span><span className="db2-tx"><b>Excel</b><span>{t("sundurliðun per starfsmann")}</span></span><button className="btn ghost sm" onClick={() => download("excel")}>{t("Sækja")}</button></div>
          </div>
        </section>
      </div>

      {tbModal && <SettleModal selected={settleIds} onSave={(ids) => { setSettleIds(ids); setTbModal(false); }} onClose={() => setTbModal(false)} />}
      {slip && <PayslipModal data={slip} onClose={() => setSlip(null)} />}
    </div>
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
