"use client";

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { nf, dec1 } from "@/lib/format";
import type { AttRow } from "@/lib/analytics.server";
import { fetchAttendance, getTimeReport } from "../timaskraning/actions";
import { exportTimeReportXlsx, exportTimeReportPdf } from "@/lib/export-report";
import { TimeBankCard } from "./timebank-card";
import type { TimeBank } from "./timebank.server";

const MONTHS_IS = ["jan.", "feb.", "mar.", "apr.", "maí", "jún.", "júl.", "ágú.", "sep.", "okt.", "nóv.", "des."];
const pad = (n: number) => String(n).padStart(2, "0");
const isoOf = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const niceISO = (s: string) => { const [y, m, d] = s.split("-").map(Number); return `${d}. ${MONTHS_IS[m - 1]} ${y}`; };
function rangeFor(period: Period): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (period === "Dagur") return { from: isoOf(t), to: isoOf(t) };
  if (period === "Mánuður") return { from: isoOf(new Date(t.getFullYear(), t.getMonth(), 1)), to: isoOf(new Date(t.getFullYear(), t.getMonth() + 1, 0)) };
  const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: isoOf(mon), to: isoOf(sun) };
}

// Period factors relative to the weekly baseline (demo analytics scale by period).
const PERIODS: Period[] = ["Dagur", "Vika", "Mánuður", "Ársfj.", "Ár", "Sérsniðið"];
const FACTOR: Record<string, number> = { "Dagur": 1 / 5, "Vika": 1, "Mánuður": 4.33, "Ársfj.": 13, "Ár": 52 };
const daysBetween = (a: string, b: string) => a && b ? Math.max(1, Math.round((Date.parse(b) - Date.parse(a)) / 86400000) + 1) : 7;

/** Scale an Icelandic-formatted number string by a factor, preserving sign + decimals. */
function sc(s: string, f: number): string {
  const t = s.trim();
  const lead = t[0] === "+" ? "+" : "";
  const neg = t[0] === "−" || t[0] === "-";
  const body = t.replace(/^[+−-]/, "");
  const hadDec = body.includes(",");
  let n = parseFloat(body.replace(/\./g, "").replace(",", ".")) * f;
  if (neg) n = -n;
  const abs = hadDec ? dec1(Math.abs(n)) : nf(Math.round(Math.abs(n)));
  return (n < 0 ? "−" : lead) + abs;
}

const PVA = [
  { n: "Mína", d: "Eldhús", pl: "47,0", ac: "49,2", fr: "+2,2", frC: "var(--bad)", pw: "+1,8", cost: "207.700" },
  { n: "Bach", d: "Sal", pl: "40,0", ac: "39,1", fr: "−0,9", frC: "var(--good)", pw: "−0,4", cost: "165.100" },
  { n: "Phong", d: "Eldhús", pl: "39,0", ac: "39,4", fr: "+0,4", frC: "", pw: "+0,2", cost: "166.400" },
  { n: "Ómar", d: "Sal", pl: "40,0", ac: "48,0", fr: "+8,0", frC: "var(--bad)", pw: "+6,5", pwC: "var(--bad)", cost: "202.700" },
];
const BANK = [
  { n: "Mína", req: "162", w: "171", b: "+9,0", c: "var(--good)" },
  { n: "Ómar", req: "130", w: "148", b: "+18,0", c: "var(--bad)" },
  { n: "Ha Vu", req: "120", w: "112", b: "−8,0", c: "var(--warn)" },
  { n: "Bach", req: "162", w: "160", b: "−2,0", c: "" },
];
const LIB = [
  ["Launatímar per starfsmaður", "fyrir launakeyrslu · CSV/Excel", "Excel", "M4 6h16M4 12h16M4 18h10"],
  ["Yfirvinna & álög", "sundurliðun á álagstímum", "PDF", "M3 17l5-5 4 3 6-7"],
  ["Mæting & frávik", "seinkomur, fjarvistir, vantar útstimplun", "PDF", "CLOCK"],
  ["Orlof & réttindi", "staða orlofs og tímabanka per starfsmann", "Excel", "M12 2.5v2.5M12 19v2.5M2.5 12H5M19 12h2.5"],
];

export default function ReportsScreen({ empty = false, live = false, rows = [], timebank }: { empty?: boolean; live?: boolean; rows?: AttRow[]; timebank?: TimeBank }) {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("Vika");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [compare, setCompare] = useState("prev");
  const [exporting, setExporting] = useState(false);
  async function doExport(kind: "xlsx" | "pdf") {
    const range = period === "Sérsniðið" && from && to ? { from, to } : rangeFor(period);
    setExporting(true);
    const rep = await getTimeReport(range.from, range.to);
    setExporting(false);
    if (!rep.ok) { toast("Tókst ekki að sækja gögn"); return; }
    if (!rep.rows.length) { toast("Engar tímafærslur á tímabilinu"); return; }
    try {
      if (kind === "xlsx") await exportTimeReportXlsx(rep.rows, rep.company || "VAKTO", range.from, range.to);
      else await exportTimeReportPdf(rep.rows, rep.company || "VAKTO", range.from, range.to);
      toast(rep.needsMigration ? "Skýrsla sótt (staða óviss — keyrðu migration 0008)" : (kind === "xlsx" ? "Excel-skýrsla sótt" : "PDF-skýrsla sótt"));
    } catch { toast("Villa við útflutning"); }
  }
  const f = period === "Sérsniðið" ? daysBetween(from, to) / 7 : FACTOR[period];
  const cmpCol = compare === "year" ? "Í fyrra" : compare === "none" ? "—" : "Fyrri tímabil";
  const cmpBadge = compare === "none" ? "Án samanburðar" : compare === "year" ? `${t("vs í fyrra")}` : `${t("vs fyrri")} ${period === "Sérsniðið" ? t("tímabil") : t(period)}`;
  const matchName = (n: string) => !search || n.toLowerCase().includes(search.toLowerCase());
  const shownPVA = PVA.filter((r) => (deptF === "all" || r.d === deptF) && matchName(r.n));
  const shownBANK = BANK.filter((r) => matchName(r.n));
  if (empty) {
    return (
      <>
        <PageHeader title="Skýrslur" subtitle="Greiningar og frammistaða" />
        <EmptyState
          title="Engar skýrslur enn"
          message="Skýrslur byggja á vöktum, tímaskráningu og launakeyrslum. Bættu við starfsfólki og birtu vaktaplan — þá fyllast greiningarnar sjálfkrafa."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  // Live company: real planned vs actual + time-bank, with period/range/search.
  if (live) return <LiveReports initial={rows} timebank={timebank} />;
  return (
    <>
      <PageHeader
        title="Skýrslur"
        subtitle="Greiningar og frammistaða"
        actions={
          <>
            <button className="btn ghost sm" disabled={exporting} onClick={() => doExport("xlsx")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Excel</button>
            <button className="btn ghost sm" style={{ marginLeft: 8 }} disabled={exporting} onClick={() => doExport("pdf")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>PDF</button>
          </>
        }
      />

      <FilterBar
        periods={PERIODS} period={period} onPeriod={setPeriod}
        from={from} to={to} onRange={(a, b) => { setFrom(a); setTo(b); }}
        search={search} onSearch={setSearch}
        filters={[{ value: deptF, onChange: setDeptF, options: [{ value: "all", label: "Allar deildir" }, { value: "Eldhús", label: "Eldhús" }, { value: "Sal", label: "Sal" }] }]}
        compare={compare} onCompare={setCompare}
        rangeLabel={cmpBadge}
      />

      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Velta á starfsmann")}</div><div className="val">{sc("358", f)} <small>þ kr</small></div><div className="d up">▲ 3,2%</div></div>
        <div className="kpi"><div className="lab">{t("Velta á launatíma")}</div><div className="val">11.685 <small>kr</small></div><div className="d up">▲ 2,3%</div></div>
        <div className="kpi"><div className="lab">{t("Yfirvinna % af tímum")}</div><div className="val" style={{ color: "var(--warn)" }}>4,8%</div><div className="d dn">▲ 0,7 {t("stig")}</div></div>
        <div className="kpi"><div className="lab">{t("Mætingahlutfall")}</div><div className="val" style={{ color: "var(--good)" }}>96,2%</div><div className="d up">▲ 1,1 {t("stig")}</div></div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{t("áætlað á móti klukknuðum tímum — þessi vika vs fyrri vika")}</div></div>
        <div className="cb tbl" style={{ paddingTop: 8 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th>{compare !== "none" && <th className="r">{t(cmpCol)}</th>}<th className="r">{t("Raun kostn.")}</th></tr></thead>
            <tbody>
              {shownPVA.map((r) => (
                <tr key={r.n}>
                  <td>{r.n}</td><td>{r.d}</td><td className="r">{sc(r.pl, f)}</td><td className="r">{sc(r.ac, f)}</td>
                  <td className="r" style={r.frC ? { color: r.frC } : undefined}>{sc(r.fr, f)}</td>
                  {compare !== "none" && <td className={`r${r.pwC ? "" : " muted"}`} style={r.pwC ? { color: r.pwC } : undefined}>{sc(r.pw, f)}</td>}
                  <td className="r">{sc(r.cost, f)}</td>
                </tr>
              ))}
              {!shownPVA.length && <tr><td colSpan={7} className="muted" style={{ textAlign: "center", padding: 18 }}>{t("Enginn starfsmaður fannst")}</td></tr>}
              {shownPVA.length > 0 && <tr className="foot"><td style={{ textAlign: "left" }}>{t("Samtals")} · {shownPVA.length} {t("starfsm.")}</td><td></td><td className="r">{sc("368,0", f)}</td><td className="r">{sc("374,6", f)}</td><td className="r">{sc("+6,6", f)}</td>{compare !== "none" && <td className="r">{sc("+5,1", f)}</td>}<td className="r">{sc("1.401.900", f)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch"><div className="ct">{t("Tímabanki starfsfólks")}</div><div className="cs">{t("uppsafnað +/− vs vinnuskylda")}</div></div>
          <div className="cb tbl" style={{ paddingTop: 8 }}>
            <table>
              <thead><tr><th>{t("th:Starfsm.")}</th><th className="r">{t("Vinnuskylda")}</th><th className="r">{t("Unnið")}</th><th className="r">{t("Staða banka")}</th></tr></thead>
              <tbody>
                {shownBANK.map((r) => (
                  <tr key={r.n}><td>{r.n}</td><td className="r">{sc(r.req, f)}</td><td className="r">{sc(r.w, f)}</td><td className={`r${r.c ? "" : " muted"}`} style={r.c ? { color: r.c } : undefined}>{sc(r.b, f)}</td></tr>
                ))}
                {!shownBANK.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 18 }}>{t("Enginn starfsmaður fannst")}</td></tr>}
              </tbody>
            </table>
          </div>
        </div>
        <div className="card">
          <div className="ch"><div className="ct">{t("Skýrslusafn")}</div><div className="cs">{t("smelltu til að sækja — PDF eða Excel")}</div></div>
          <div className="cb att">
            {LIB.map((r) => (
              <div className="it rowlink" key={r[0]} onClick={() => toast(`Sæki: ${r[0]}`)}>
                <div className="ic info">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}>
                    {r[3] === "CLOCK" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <path d={r[3]} />}
                  </svg>
                </div>
                <div className="tx"><b>{r[0]}</b><span>{r[1]}</span></div>
                <span className="badge">{r[2]}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

function LiveReports({ initial, timebank }: { initial: AttRow[]; timebank?: TimeBank }) {
  const { t } = useLang();
  const [period, setPeriod] = useState<Period>("Vika");
  const init0 = rangeFor("Vika");
  const [from, setFrom] = useState(init0.from);
  const [to, setTo] = useState(init0.to);
  const [search, setSearch] = useState("");
  const [deptF, setDeptF] = useState("all");
  const [data, setData] = useState<AttRow[]>(initial);
  const [loading, setLoading] = useState(false);

  function load(f: string, tt: string) {
    setLoading(true);
    fetchAttendance(f, tt).then((res) => { if (res.ok) setData(res.rows); }).finally(() => setLoading(false));
  }
  function changePeriod(p: Period) {
    setPeriod(p);
    if (p !== "Sérsniðið") { const r = rangeFor(p); setFrom(r.from); setTo(r.to); load(r.from, r.to); }
  }
  function changeRange(f: string, tt: string) { setFrom(f); setTo(tt); if (f && tt && f <= tt) load(f, tt); }
  const [exporting, setExporting] = useState(false);
  async function doExport(kind: "xlsx" | "pdf") {
    setExporting(true);
    const rep = await getTimeReport(from, to);
    setExporting(false);
    if (!rep.ok) { toast("Tókst ekki að sækja gögn"); return; }
    if (!rep.rows.length) { toast("Engar tímafærslur á tímabilinu"); return; }
    try {
      if (kind === "xlsx") await exportTimeReportXlsx(rep.rows, rep.company || "VAKTO", from, to);
      else await exportTimeReportPdf(rep.rows, rep.company || "VAKTO", from, to);
      toast(rep.needsMigration ? "Skýrsla sótt (staða óviss — keyrðu migration 0008)" : (kind === "xlsx" ? "Excel-skýrsla sótt" : "PDF-skýrsla sótt"));
    } catch { toast("Villa við útflutning"); }
  }

  const depts = ["all", ...Array.from(new Set(data.map((r) => r.dept).filter((d) => d && d !== "—")))];
  const shown = data.filter((r) => (deptF === "all" || r.dept === deptF) && (!search || r.name.toLowerCase().includes(search.toLowerCase())));
  const planned = shown.reduce((a, r) => a + r.planned, 0);
  const actual = shown.reduce((a, r) => a + r.actual, 0);

  return (
    <>
      <PageHeader title="Skýrslur" subtitle="Greiningar og frammistaða" actions={
        <>
          <button className="btn ghost sm" disabled={exporting} onClick={() => doExport("xlsx")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>Excel</button>
          <button className="btn ghost sm" style={{ marginLeft: 8 }} disabled={exporting} onClick={() => doExport("pdf")}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>PDF</button>
        </>
      } />
      <FilterBar
        periods={["Dagur", "Vika", "Mánuður", "Sérsniðið"]}
        period={period} onPeriod={changePeriod}
        from={from} to={to} onRange={changeRange}
        search={search} onSearch={setSearch}
        filters={[{ value: deptF, onChange: setDeptF, options: depts.map((d) => ({ value: d, label: d === "all" ? "Allar deildir" : d })) }]}
        rangeLabel={`${niceISO(from)} – ${niceISO(to)}`}
      />
      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{niceISO(from)} – {niceISO(to)}</div></div></div>
        <div className="cb tbl" style={{ paddingTop: 8, opacity: loading ? 0.5 : 1 }}>
          <table>
            <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th></tr></thead>
            <tbody>
              {shown.length ? shown.map((r) => (
                <tr key={r.id}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.name}</span></td>
                  <td>{r.dept}</td><td className="r">{dec1(r.planned)}</td><td className="r">{dec1(r.actual)}</td>
                  <td className="r" style={{ color: r.deviation > 0 ? "var(--warn)" : r.deviation < 0 ? "var(--bad)" : undefined }}>{r.deviation > 0 ? "+" : ""}{dec1(r.deviation)}</td>
                </tr>
              )) : <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Engin gögn á þessu tímabili.")}</td></tr>}
              {shown.length > 0 && <tr className="foot"><td style={{ textAlign: "left" }}>{t("Samtals")} · {shown.length} {t("starfsm.")}</td><td></td><td className="r">{dec1(planned)}</td><td className="r">{dec1(actual)}</td><td className="r">{actual >= planned ? "+" : ""}{dec1(actual - planned)}</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
      {timebank && <TimeBankCard rows={timebank.rows} live={timebank.live} monthLabels={timebank.monthLabels} />}
    </>
  );
}
