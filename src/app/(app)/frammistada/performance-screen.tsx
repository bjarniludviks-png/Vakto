"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Paired, Bars } from "@/components/app/charts";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { PeriodPicker } from "@/components/app/period-picker";
import { dec1, krCompact } from "@/lib/format";
import type { PerfView } from "@/lib/analytics.server";
import { StaffingCard } from "./staffing-card";
import type { StaffingPattern } from "./staffing.server";
import type { PerfHistory } from "./perf.server";
import type { Insight } from "./insights.server";
import { AiReportCard } from "@/components/app/ai-report";
import { NotConnectedCard } from "../skyrslur/reports-screen";

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  good: <path d="M5 12.5l4 4 10-10" />,
  info: <><path d="M4 16l5-5 4 3 6-7" /><path d="M16 7h4v4" /></>,
  warn: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>,
  bad: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

const ExportIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>;

/** Plain-language recommendations — where to add/remove people, overtime and
 * cost drift, department efficiency. Suggestions only, computed from real data. */
export function InsightsCard({ insights }: { insights: Insight[] }) {
  const { t } = useLang();
  if (!insights.length) return null;
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch"><div>
        <div className="ct">{t("Innsýn & ráðleggingar")}</div>
        <div className="cs">{t("reiknað úr þínum gögnum — tillögur, ekki sjálfvirkar aðgerðir")}</div>
      </div></div>
      <div className="cb att">
        {insights.map((ins, i) => (
          <div className="it" key={i}>
            <div className={`ic ${ins.kind}`}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}>{INSIGHT_ICON[ins.kind]}</svg>
            </div>
            <div className="tx"><b>{ins.title}</b><span>{ins.detail}</span></div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function PerformanceScreen({ empty = false, live = false, embedded = false, perf, staffing, history, insights = [], aiEnabled = false }: { empty?: boolean; live?: boolean; embedded?: boolean; perf?: PerfView; staffing?: StaffingPattern; history?: PerfHistory; insights?: Insight[]; aiEnabled?: boolean }) {
  const { t } = useLang();
  // Inside the Innsyn tabs the shared header renders above us — show only actions.
  const head = (actions?: React.ReactNode) => embedded
    ? (actions ? <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>{actions}</div> : null)
    : <PageHeader title="Frammistaða" subtitle="Þróun, framlegð og launasundurliðun" actions={actions} />;
  const [liveFrom, setLiveFrom] = useState("");
  const [liveTo, setLiveTo] = useState("");
  if (empty) {
    return (
      <>
        {head()}
        <EmptyState
          title="Engin frammistöðugögn enn"
          message="Þróun, framlegð og laun% birtast hér þegar þú ert komin/n með veltu og launakeyrslur. Byrjaðu á að bæta við starfsfólki og skrá veltu."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  if (!live || !perf) return <>{head()}<NotConnectedCard /></>;

  // Live company: real headline KPIs + monthly history + department breakdown.
  const all = history?.months ?? [];
  // Period filter (month granularity) — defaults to the last 6 months.
  const defFrom = all.length ? `${all[Math.max(0, all.length - 6)].ym}-01` : "";
  const defTo = all.length ? `${all[all.length - 1].ym}-28` : "";
  const pFrom = liveFrom || defFrom, pTo = liveTo || defTo;
  const months = all.filter((x) => x.ym >= pFrom.slice(0, 7) && x.ym <= pTo.slice(0, 7));
  const withRev = months.filter((m) => m.revenue > 0);
  const cur = months[months.length - 1];
  const prev = months.length >= 2 ? months[months.length - 2] : undefined;
  const m = (n: number) => Math.round(n / 100000) / 10; // kr → m kr (1 decimal)
  // Headline KPIs follow the current month's real figures when history exists.
  const lp = cur && cur.laborPct > 0 ? cur.laborPct : perf.laborPct;
  const lpColor = lp === 0 ? "var(--ink3)" : lp <= 30 ? "var(--good)" : lp <= 33 ? "var(--warn)" : "var(--bad)";
  const kRevenue = cur ? dec1(m(cur.revenue)) : perf.revenueM;
  const kCost = cur ? dec1(m(cur.cost)) : perf.laborCostM;
  const kMargin = cur ? dec1(m(Math.max(0, cur.revenue - cur.cost))) : perf.marginM;
  const chg = (a: number, b: number) => (b > 0 ? Math.round(((a - b) / b) * 1000) / 10 : 0);
  async function exportHistory(kind: "xlsx" | "pdf") {
    if (!months.length) { toast(t("Engin gögn á tímabilinu")); return; }
    const { exportTableXlsx, exportTablePdf } = await import("@/lib/export-report");
    const d = {
      title: t("Rekstur & framlegð"),
      company: "VAKTO",
      from: months[0]?.label ?? "", to: months[months.length - 1]?.label ?? "",
      columns: [t("Mánuður"), t("Velta (m.kr.)"), t("Launakostnaður (m.kr.)"), t("Laun af tekjum %"), t("Framlegð (m.kr.)")],
      numeric: [1, 2, 3, 4],
      rows: months.map((x) => [x.label, m(x.revenue), m(x.cost), x.laborPct > 0 ? Math.round(x.laborPct * 10) / 10 : 0, m(Math.max(0, x.revenue - x.cost))]),
    };
    if (kind === "xlsx") await exportTableXlsx(d); else await exportTablePdf(d);
    toast(kind === "xlsx" ? t("Excel-skýrsla sótt") : t("PDF-skýrsla sótt"));
  }
  const chgCell = (a: number, b: number, goodUp: boolean) => {
    const c = chg(a, b);
    const good = c === 0 ? undefined : (c > 0) === goodUp ? "var(--good)" : "var(--bad)";
    return <td className="r" style={good ? { color: good } : undefined}>{c > 0 ? "+" : ""}{dec1(c)}%</td>;
  };
  const actions = (
    <>
      <button className="btn ghost sm" onClick={() => exportHistory("xlsx")}><ExportIcon />Excel</button>
      <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => exportHistory("pdf")}><ExportIcon />PDF</button>
    </>
  );
  return (
    <>
      {head(actions)}
      {/* One period selector for the whole tab (month granularity). */}
      <div style={{ margin: "0 0 14px" }}>
        <PeriodPicker from={pFrom} to={pTo} onApply={(a, b) => { setLiveFrom(a); setLiveTo(b); }} />
      </div>

      <div className="kperiod">{cur ? `${t("Mánuður")}: ${cur.label}` : t("Nýjasti mánuður")}</div>
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Velta")} <small>/{t("mán")}</small></div><div className="val">{kRevenue} <small>m.kr.</small></div></div>
        <div className="kpi"><div className="lab">{t("Launakostnaður (byrði)")} <small>/{t("mán")}</small></div><div className="val">{kCost} <small>m.kr.</small></div></div>
        <div className="kpi"><div className="lab">{t("Laun af tekjum")}</div><div className="val" style={{ color: lpColor }}>{lp > 0 ? dec1(lp) + "%" : "—"}</div></div>
        <div className="kpi"><div className="lab">{t("Framlegð")} <small>/{t("mán")}</small></div><div className="val">{kMargin} <small>m.kr.</small></div></div>
      </div>

      {months.length > 0 && (
        <div className="grid2">
          <div className="card">
            <div className="ch"><div><div className="ct">{t("Velta vs launakostnaður")}</div><div className="cs">{t("per mánuð · farðu með músina yfir fyrir tölur")}</div></div></div>
            <div className="cb">
              <Paired
                a={months.map((x) => m(x.revenue))}
                b={months.map((x) => m(x.cost))}
                height={200}
                labels={months.map((x) => x.label)}
                aName={t("Velta")}
                bName={t("Launakostnaður")}
              />
              <div className="legend"><span><i style={{ background: "var(--teal)" }} />{t("Velta")}</span><span><i style={{ background: "var(--brand)" }} />{t("Launakostnaður")}</span></div>
            </div>
          </div>
          <div className="card">
            <div className="ch"><div><div className="ct">{t("Laun% þróun vs 30% markmið")}</div><div className="cs">{t("per mánuð · farðu með músina yfir fyrir tölur")}</div></div></div>
            <div className="cb">
              {withRev.length
                ? <Bars vals={withRev.map((x) => x.laborPct)} t={30} labels={withRev.map((x) => x.label)} />
                : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Skráðu veltu til að sjá laun% per mánuð.")}</p>}
            </div>
          </div>
        </div>
      )}

      {cur && prev && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="ch"><div><div className="ct">{t("Samanburður tímabila")}</div><div className="cs">{cur.label} {t("vs")} {prev.label}</div></div></div>
          <div className="cb tbl" style={{ paddingTop: 8 }}>
            <table>
              <thead><tr><th>{t("Mælikvarði")}</th><th className="r">{cur.label}</th><th className="r">{prev.label}</th><th className="r">{t("Breyting")}</th></tr></thead>
              <tbody>
                <tr><td>{t("Velta")}</td><td className="r">{krCompact(cur.revenue)}</td><td className="r">{krCompact(prev.revenue)}</td>{chgCell(cur.revenue, prev.revenue, true)}</tr>
                <tr><td>{t("Launakostnaður (byrði)")}</td><td className="r">{krCompact(cur.cost)}</td><td className="r">{krCompact(prev.cost)}</td>{chgCell(cur.cost, prev.cost, false)}</tr>
                <tr>
                  <td><b>{t("Laun af tekjum")}</b></td>
                  <td className="r"><b>{cur.laborPct > 0 ? dec1(cur.laborPct) + "%" : "—"}</b></td>
                  <td className="r">{prev.laborPct > 0 ? dec1(prev.laborPct) + "%" : "—"}</td>
                  <td className="r" style={cur.laborPct && prev.laborPct ? { color: cur.laborPct <= prev.laborPct ? "var(--good)" : "var(--bad)" } : undefined}>
                    {cur.laborPct && prev.laborPct ? `${cur.laborPct <= prev.laborPct ? "−" : "+"}${dec1(Math.abs(cur.laborPct - prev.laborPct))} ${t("stig")}` : "—"}
                  </td>
                </tr>
                <tr><td>{t("Framlegð")}</td><td className="r">{krCompact(Math.max(0, cur.revenue - cur.cost))}</td><td className="r">{krCompact(Math.max(0, prev.revenue - prev.cost))}</td>{chgCell(Math.max(0, cur.revenue - cur.cost), Math.max(0, prev.revenue - prev.cost), true)}</tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {(history?.departments?.length ?? 0) > 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="ch"><div><div className="ct">{t("Launakostnaður eftir deild")}</div><div className="cs">{t("þessi mánuður · hlutfall af heildarkostnaði")}</div></div></div>
          <div className="cb">
            {history!.departments.map((d) => (
              <div key={d.name} style={{ marginBottom: 15 }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}>
                  <b>{t(d.name)}</b>
                  <span className="muted">{dec1(d.hours)} {t("klst")} · {krCompact(d.cost)} · {d.share}%</span>
                </div>
                <div className="prog"><i style={{ width: `${Math.max(3, d.share)}%`, background: "var(--brand)" }} /></div>
              </div>
            ))}
          </div>
        </div>
      )}

      {months.length === 0 && (
        <div className="card" style={{ marginTop: 20 }}>
          <div className="cb">
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.6, margin: 0 }}>
              {perf.laborPct === 0
                ? t("Skráðu veltu (eða tengdu sölukerfi gegnum API) til að sjá laun af tekjum og framlegð. Launakostnaður reiknast af starfsfólki og kjarasamningum.")
                : t("Söguleg þróun og samanburður tímabila birtist eftir því sem fleiri launatímabil og veltutölur safnast.")}
            </p>
          </div>
        </div>
      )}

      <InsightsCard insights={insights} />
      {aiEnabled && (
        <AiReportCard from={pFrom} to={pTo} examples={[
          "Hvernig þróast launahlutfallið milli mánaða?",
          "Hvaða deild er skilvirkust miðað við kostnað?",
          "Berðu saman þennan mánuð og síðasta",
        ]} />
      )}
      {staffing && staffing.live && <StaffingCard rows={staffing.rows} live={staffing.live} weeks={staffing.weeks} />}
    </>
  );
}
