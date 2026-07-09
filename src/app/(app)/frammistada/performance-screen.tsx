"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { Paired, Bars } from "@/components/app/charts";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { dec1, krCompact } from "@/lib/format";
import type { PerfView } from "@/lib/analytics.server";
import { StaffingCard } from "./staffing-card";
import type { StaffingPattern } from "./staffing.server";
import type { PerfHistory } from "./perf.server";
import type { Insight } from "./insights.server";

// Period factors relative to the monthly baseline (demo analytics scale by period).
const PERIODS: Period[] = ["Vika", "Mánuður", "Ársfj.", "Ár", "Sérsniðið"];
const FACTOR: Record<string, number> = { "Vika": 1 / 4.33, "Mánuður": 1, "Ársfj.": 3, "Ár": 12 };
const daysBetween = (a: string, b: string) => a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1) : 30;
const CMP_LABEL: Record<string, string> = {
  "Vika": "Vika 26 vs vika 25", "Mánuður": "Júní 2026 vs maí 2026",
  "Ársfj.": "2. ársfj. vs 1. ársfj.", "Ár": "2026 vs 2025", "Sérsniðið": "Sérsniðið tímabil",
};

type Row = [string, string, string, string, string, string, boolean?];
const CMP: Row[] = [
  ["Velta", "18,6 m", "17,5 m", "16,2 m", "+6,2%", "+14,8%"],
  ["Launakostnaður (byrði)", "7,39 m", "7,17 m", "6,71 m", "+3,1%", "+10,1%"],
  ["Laun af tekjum", "39,7%", "40,9%", "41,4%", "−1,2 stig", "−1,7 stig", true],
  ["Framlegð", "11,2 m", "10,8 m", "9,5 m", "+4,1%", "+18,3%"],
  ["Unnir tímar", "1.968", "1.944", "1.902", "+1,2%", "+3,5%"],
  ["Yfirvinna % af tímum", "4,8%", "4,1%", "5,2%", "+0,7 stig", "−0,4 stig"],
  ["Velta á launatíma", "9.451", "9.002", "8.517", "+5,0%", "+11,0%"],
  ["Velta vs spá", "101,8%", "98,4%", "97,1%", "+3,4 stig", "+4,7 stig", true],
  ["Unnið eftir áætlun", "94,2%", "92,8%", "90,5%", "+1,4 stig", "+3,7 stig", true],
];
// color for change columns: green for good. Specific overrides per prototype.
const goodChange = new Set(["Velta", "Framlegð", "Laun af tekjum", "Velta á launatíma", "Velta vs spá", "Unnið eftir áætlun"]);

const INSIGHT_ICON: Record<string, React.ReactNode> = {
  good: <path d="M5 12.5l4 4 10-10" />,
  info: <><path d="M4 16l5-5 4 3 6-7" /><path d="M16 7h4v4" /></>,
  warn: <><circle cx="12" cy="12" r="9" /><path d="M12 8v5M12 16.5v.5" /></>,
  bad: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
};

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

export default function PerformanceScreen({ empty = false, live = false, perf, staffing, history, insights = [] }: { empty?: boolean; live?: boolean; perf?: PerfView; staffing?: StaffingPattern; history?: PerfHistory; insights?: Insight[] }) {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("Mánuður");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [locF, setLocF] = useState("all");
  const [compare, setCompare] = useState("prev");
  const f = period === "Sérsniðið" ? daysBetween(from, to) / 30 : FACTOR[period];
  const cmpBadge = compare === "none" ? "Án samanburðar" : compare === "year" ? "vs í fyrra" : CMP_LABEL[period];
  if (empty) {
    return (
      <>
        <PageHeader title="Frammistaða" subtitle="Þróun, framlegð og launasundurliðun" />
        <EmptyState
          title="Engin frammistöðugögn enn"
          message="Þróun, framlegð og laun% birtast hér þegar þú ert komin/n með veltu og launakeyrslur. Byrjaðu á að bæta við starfsfólki og skrá veltu."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  // Live company: real headline KPIs + monthly history + department breakdown.
  if (live && perf) {
    const months = history?.months ?? [];
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
    const chgCell = (a: number, b: number, goodUp: boolean) => {
      const c = chg(a, b);
      const good = c === 0 ? undefined : (c > 0) === goodUp ? "var(--good)" : "var(--bad)";
      return <td className="r" style={good ? { color: good } : undefined}>{c > 0 ? "+" : ""}{dec1(c)}%</td>;
    };
    return (
      <>
        <PageHeader title="Frammistaða" subtitle="Þróun, framlegð og launasundurliðun" />
        <div className="kpis">
          <div className="kpi"><div className="lab">{t("Velta")}</div><div className="val">{kRevenue} <small>m kr</small></div></div>
          <div className="kpi"><div className="lab">{t("Launakostnaður (byrði)")}</div><div className="val">{kCost} <small>m kr</small></div></div>
          <div className="kpi"><div className="lab">{t("Laun af tekjum")}</div><div className="val" style={{ color: lpColor }}>{lp > 0 ? dec1(lp) + "%" : "—"}</div></div>
          <div className="kpi"><div className="lab">{t("Framlegð")}</div><div className="val">{kMargin} <small>m kr</small></div></div>
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
                  ? t("Skráðu veltu (eða tengdu Inventra) til að sjá laun af tekjum og framlegð. Launakostnaður reiknast af starfsfólki og kjarasamningum.")
                  : t("Söguleg þróun og samanburður tímabila birtist eftir því sem fleiri launatímabil og veltutölur safnast.")}
              </p>
            </div>
          </div>
        )}
        <InsightsCard insights={insights} />
        {staffing && <StaffingCard rows={staffing.rows} live={staffing.live} weeks={staffing.weeks} />}
      </>
    );
  }
  return (
    <>
      <PageHeader
        title="Frammistaða"
        subtitle="Þróun, framlegð og launasundurliðun"
        actions={
          <>
            <button className="btn ghost sm" onClick={() => toast("Flyt út í Excel")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Excel</button>
            <button className="btn ghost sm" style={{ marginLeft: 8 }} onClick={() => toast("Sæki PDF-skýrslu")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>PDF</button>
          </>
        }
      />

      <FilterBar
        periods={PERIODS} period={period} onPeriod={setPeriod}
        from={from} to={to} onRange={(a, b) => { setFrom(a); setTo(b); }}
        filters={[{ value: locF, onChange: setLocF, options: [{ value: "all", label: "Allir staðir" }, { value: "Reykjavík Asian", label: "Reykjavík Asian" }, { value: "Hotel Umi", label: "Hotel Umi" }] }]}
        compare={compare} onCompare={setCompare}
        rangeLabel={t(cmpBadge)}
      />

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Velta")}</div><div className="val">{dec1(18.6 * f)} <small>m kr</small></div><div className="d up">▲ 6,2% <span className="muted" style={{ fontWeight: 500 }}>{t("vs")} {t(period)}</span></div></div>
        <div className="kpi"><div className="lab">{t("Launakostnaður (byrði)")}</div><div className="val">{dec1(7.39 * f)} <small>m kr</small></div><div className="d dn">▲ 3,1% <span className="muted" style={{ fontWeight: 500 }}>{t("vs")} {t(period)}</span></div></div>
        <div className="kpi"><div className="lab">{t("Laun af tekjum")}</div><div className="val" style={{ color: "var(--warn)" }}>39,7%</div><div className="d up">▼ 1,2 {t("stig")} <span className="muted" style={{ fontWeight: 500 }}>{t("batnar")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Framlegð")}</div><div className="val">{dec1(11.2 * f)} <small>m kr</small></div><div className="d up">▲ 4,1% <span className="muted" style={{ fontWeight: 500 }}>{t("vs")} {t(period)}</span></div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Samanburður tímabila")}</div><div className="cs">{t("þetta tímabil · síðasta tímabil · sama tímabil í fyrra")}</div></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Mælikvarði")}</th><th className="r">{t("Júní 2026")}</th><th className="r">{t("Maí 2026")}</th><th className="r">{t("Júní 2025")}</th><th className="r">{t("Breyting (mán)")}</th><th className="r">{t("vs í fyrra")}</th></tr></thead>
            <tbody>
              {CMP.map((r) => {
                const c = goodChange.has(r[0]) ? "var(--good)" : "var(--bad)";
                return (
                  <tr key={r[0]}>
                    <td>{r[6] ? <b>{t(r[0])}</b> : t(r[0])}</td>
                    <td className="r">{r[6] ? <b>{r[1]}</b> : r[1]}</td>
                    <td className="r">{r[2]}</td>
                    <td className="r">{r[3]}</td>
                    <td className="r" style={{ color: c }}>{r[4]}</td>
                    <td className="r" style={{ color: r[0] === "Yfirvinna % af tímum" ? "var(--good)" : c }}>{r[5]}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch"><div className="ct">{t("Velta vs launakostnaður")}</div><div className="cs">{t("6 mánuðir")}</div></div>
          <div className="cb">
            <Paired a={[3.9, 4.1, 4.4, 3.8, 4.2, 4.3]} b={[1.33, 1.30, 1.47, 1.15, 1.38, 1.38]} height={200} labels={["jan", "feb", "mar", "apr", "maí", "jún"]} aName={t("Velta")} bName={t("Launakostnaður")} />
            <div className="legend"><span><i style={{ background: "var(--teal)" }} />{t("Velta")}</span><span><i style={{ background: "var(--brand)" }} />{t("Launakostnaður")}</span></div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Laun% þróun vs 30% markmið")}</div><div className="cs">{t("síðustu 6 mánuðir · farðu með músina yfir fyrir tölur")}</div></div>
          <div className="cb"><Bars vals={[40.9, 39.4, 40.8, 38.2, 40.9, 39.7]} t={30} labels={["jan", "feb", "mar", "apr", "maí", "jún"]} /></div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Samanburður staða")}</div><div className="cs">{t("hver staður — velta, laun% og framlegð, breyting milli mánaða")}</div></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Staður")}</th><th className="r">{t("Velta")}</th><th className="r">{t("Launakostn.")}</th><th className="r">{t("Laun%")}</th><th className="r">{t("Framlegð")}</th><th className="r">{t("Laun% vs maí")}</th></tr></thead>
            <tbody>
              {(locF === "all" || locF === "Reykjavík Asian") && <tr><td><b>Reykjavík Asian</b></td><td className="r">14,1 m</td><td className="r">5,52 m</td><td className="r" style={{ color: "var(--warn)" }}>39,1%</td><td className="r">8,6 m</td><td className="r" style={{ color: "var(--good)" }}>−1,0 stig</td></tr>}
              {(locF === "all" || locF === "Hotel Umi") && <tr><td><b>Hotel Umi</b></td><td className="r">4,5 m</td><td className="r">1,87 m</td><td className="r" style={{ color: "var(--bad)" }}>41,6%</td><td className="r">2,6 m</td><td className="r" style={{ color: "var(--bad)" }}>+0,8 stig</td></tr>}
              {locF === "all" && <tr className="foot"><td style={{ textAlign: "left" }}>{t("Samtals")}</td><td className="r">18,6 m</td><td className="r">7,39 m</td><td className="r">39,7%</td><td className="r">11,2 m</td><td className="r" style={{ color: "var(--good)" }}>−1,2 stig</td></tr>}
            </tbody>
          </table>
        </div>
        <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
          <div className="ai" style={{ margin: 0 }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3l1.8 4.6L18.5 9l-4.7 1.4L12 15l-1.8-4.6L5.5 9l4.7-1.4Z" /></svg>
            <div className="x"><b>Hotel Umi</b>{t("perf:ai1")}<b>~113.000 kr</b>{t("perf:ai2")}</div>
          </div>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch"><div className="ct">{t("Greining eftir deild")}</div><div className="cs">{t("laun% per deild · júní")}</div></div>
          <div className="cb">
            <div style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><b>Eldhús</b><span className="muted">34,2% laun% · <span style={{ color: "var(--bad)" }}>+0,6</span> vs maí</span></div>
              <div className="prog"><i style={{ width: "68%", background: "var(--warn)" }} /></div>
            </div>
            <div style={{ marginBottom: 15 }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><b>Sal</b><span className="muted">28,6% laun% · <span style={{ color: "var(--good)" }}>−1,4</span> vs maí</span></div>
              <div className="prog"><i style={{ width: "57%", background: "var(--good)" }} /></div>
            </div>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 6 }}><b>Stjórnun</b><span className="muted">13,0% laun% · <span className="muted">0,0</span></span></div>
              <div className="prog"><i style={{ width: "26%", background: "var(--brand)" }} /></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Launasundurliðun")}</div><div className="cs">{t("hvert peningarnir fara")}</div></div>
          <div className="cb">
            <div className="bars" style={{ height: 150 }}>
              <div className="b"><span className="pc">60%</span><div className="c" style={{ height: "88%", background: "var(--good)" }} /><small>{t("perf:staff")}</small></div>
              <div className="b"><span className="pc">19%</span><div className="c" style={{ height: "28%", background: "var(--warn)" }} /><small>{t("Ríkið")}</small></div>
              <div className="b"><span className="pc">12%</span><div className="c" style={{ height: "18%", background: "var(--brand)" }} /><small>{t("Lífeyrir")}</small></div>
              <div className="b"><span className="pc">8%</span><div className="c" style={{ height: "12%", background: "var(--teal)" }} /><small>{t("Orlof")}</small></div>
              <div className="b"><span className="pc">1%</span><div className="c" style={{ height: "3%", background: "#c9ccd6" }} /><small>{t("Sjóðir")}</small></div>
            </div>
          </div>
        </div>
      </div>
      {staffing && <StaffingCard rows={staffing.rows} live={staffing.live} weeks={staffing.weeks} />}
    </>
  );
}
