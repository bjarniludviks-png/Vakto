"use client";

import { useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { EmptyState } from "@/components/app/empty-state";
import { FilterBar, type Period } from "@/components/app/filter-bar";
import { nf, dec1 } from "@/lib/format";
import type { AttRow } from "@/lib/analytics.server";
import { fetchAttendance, getTimeReport } from "../timaskraning/actions";
import { exportTimeReportXlsx, exportTimeReportPdf, exportTableXlsx, exportTablePdf } from "@/lib/export-report";
import { getManagerReport, type ReportKind } from "./actions";
import { TimeBankCard } from "./timebank-card";
import { AiReportCard } from "@/components/app/ai-report";
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

const ExportIcon = () => <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v12m0 0l-4-4m4 4l4-4M5 21h14" /></svg>;

// The three manager reports that matter: profitability, labor cost, attendance.
const LIB: { kind: ReportKind; title: string; sub: string; fmt: "Excel" | "PDF"; icon: string }[] = [
  { kind: "profit", title: "Arðsemi (laun % af veltu)", sub: "velta, launakostnaður og laun% per mánuð", fmt: "Excel", icon: "M3 17l5-5 4 3 6-7" },
  { kind: "cost", title: "Launakostnaður per starfsmaður", sub: "grunnlaun, álag, yfirvinna, gjöld og heild", fmt: "Excel", icon: "M12 1v22M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" },
  { kind: "attendance", title: "Mæting & frávik", sub: "áætlað vs raun, vantar útstimplun", fmt: "PDF", icon: "CLOCK" },
];

/** Downloadable manager reports — filter-first (department, employee), then
 * pick the report. Real data only, Excel/PDF. */
function ReportLibrary({ from, to, departments }: { from: string; to: string; departments: string[] }) {
  const { t } = useLang();
  const [busy, setBusy] = useState<ReportKind | null>(null);
  const [dept, setDept] = useState("");
  const [who, setWho] = useState("");
  async function download(item: (typeof LIB)[number]) {
    if (busy) return;
    setBusy(item.kind);
    try {
      const rep = await getManagerReport(item.kind, from, to, {
        department: dept || undefined,
        employee: who.trim() || undefined,
      });
      if (!rep.ok) { toast(rep.error ?? "Tókst ekki að sækja gögn"); return; }
      if (!rep.rows.length) { toast("Engin gögn á tímabilinu"); return; }
      const payload = { title: rep.title, company: rep.company, from, to, columns: rep.columns, numeric: rep.numeric, rows: rep.rows };
      if (item.fmt === "Excel") await exportTableXlsx(payload); else await exportTablePdf(payload);
      toast(`${rep.title} sótt`);
    } catch { toast("Villa við útflutning"); } finally { setBusy(null); }
  }
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch"><div><div className="ct">{t("Skýrslusafn")}</div><div className="cs">{t("veldu fyrst síur — svo skýrsluna sem þú vilt sækja")}</div></div></div>
      <div className="cb" style={{ paddingBottom: 0 }}>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12 }}>
          <select className="pchip" style={{ font: "inherit", fontSize: 13 }} value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">{t("Allar deildir")}</option>
            {departments.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
          <input className="pchip" style={{ font: "inherit", fontSize: 13, minWidth: 170 }} value={who} onChange={(e) => setWho(e.target.value)} placeholder={t("Starfsmaður (allir)")} />
        </div>
      </div>
      <div className="cb att" style={{ paddingTop: 0 }}>
        {LIB.map((r) => (
          <div className="it rowlink" key={r.kind} style={busy === r.kind ? { opacity: 0.55 } : undefined} onClick={() => download(r)}>
            <div className="ic info">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" style={{ width: 16, height: 16 }}>
                {r.icon === "CLOCK" ? <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></> : <path d={r.icon} />}
              </svg>
            </div>
            <div className="tx"><b>{t(r.title)}</b><span>{busy === r.kind ? t("Sæki…") : t(r.sub)}</span></div>
            <span className="badge">{r.fmt}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Small honest notice when the app runs without a database connection. */
export function NotConnectedCard() {
  const { t } = useLang();
  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="cb">
        <b style={{ fontSize: 14 }}>{t("Supabase er ekki tengt")}</b>
        <p className="muted" style={{ fontSize: 13, margin: "6px 0 0", lineHeight: 1.55 }}>{t("Gögn birtast hér þegar gagnagrunnurinn er tengdur — sjá supabase/README.md.")}</p>
      </div>
    </div>
  );
}

export default function ReportsScreen({ empty = false, live = false, embedded = false, rows = [], timebank, aiEnabled = false }: { empty?: boolean; live?: boolean; embedded?: boolean; rows?: AttRow[]; timebank?: TimeBank; aiEnabled?: boolean }) {
  const head = (actions?: React.ReactNode) => embedded
    ? (actions ? <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>{actions}</div> : null)
    : <PageHeader title="Skýrslur" subtitle="Greiningar og frammistaða" actions={actions} />;
  if (empty) {
    return (
      <>
        {head()}
        <EmptyState
          title="Engar skýrslur enn"
          message="Skýrslur byggja á vöktum, tímaskráningu og launakeyrslum. Bættu við starfsfólki og birtu vaktaplan — þá fyllast greiningarnar sjálfkrafa."
          ctaLabel="Bæta við starfsfólki"
          ctaHref="/starfsfolk?new=1"
        />
      </>
    );
  }
  if (!live) return <>{head()}<NotConnectedCard /></>;
  return <LiveReports initial={rows} timebank={timebank} embedded={embedded} aiEnabled={aiEnabled} />;
}

function LiveReports({ initial, timebank, embedded = false, aiEnabled }: { initial: AttRow[]; timebank?: TimeBank; embedded?: boolean; aiEnabled: boolean }) {
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
      toast(kind === "xlsx" ? "Excel-skýrsla sótt" : "PDF-skýrsla sótt");
    } catch { toast("Villa við útflutning"); }
  }

  const depts = ["all", ...Array.from(new Set(data.map((r) => r.dept).filter((d) => d && d !== "—")))];
  const shown = data.filter((r) => (deptF === "all" || r.dept === deptF) && (!search || r.name.toLowerCase().includes(search.toLowerCase())));
  const planned = shown.reduce((a, r) => a + r.planned, 0);
  const actual = shown.reduce((a, r) => a + r.actual, 0);
  const estC = shown.reduce((a, r) => a + r.estCost, 0);
  const actC = shown.reduce((a, r) => a + r.actCost, 0);
  const devC = actC - estC;
  const worst = [...shown].sort((a, b) => Math.abs(b.actCost - b.estCost) - Math.abs(a.actCost - a.estCost))[0];

  const actions = (
    <>
      <button className="btn ghost sm" disabled={exporting} onClick={() => doExport("xlsx")}><ExportIcon />Excel</button>
      <button className="btn ghost sm" style={{ marginLeft: 8 }} disabled={exporting} onClick={() => doExport("pdf")}><ExportIcon />PDF</button>
    </>
  );

  return (
    <>
      {embedded
        ? <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: 12 }}>{actions}</div>
        : <PageHeader title="Skýrslur" subtitle="Greiningar og frammistaða" actions={actions} />}
      <FilterBar
        periods={["Dagur", "Vika", "Mánuður", "Sérsniðið"]}
        period={period} onPeriod={changePeriod}
        from={from} to={to} onRange={changeRange}
        search={search} onSearch={setSearch}
        filters={[{ value: deptF, onChange: setDeptF, options: depts.map((d) => ({ value: d, label: d === "all" ? "Allar deildir" : d })) }]}
      />

      {/* Planned vs actual lives in Tímaskráning — here only the period summary + a link. */}
      <div className="card" style={{ marginTop: 16, opacity: loading ? 0.5 : 1 }}>
        <div className="ch"><div><div className="ct">{t("Vaktaplan vs raun-tímar")}</div><div className="cs">{niceISO(from)} – {niceISO(to)} · {t("kostnaður m. byrði")}</div></div>
          <Link className="btn ghost sm" href="/timaskraning" style={{ textDecoration: "none" }}>{t("Opna Tímaskráningu")}</Link>
        </div>
        <div className="cb">
          {shown.length > 0 ? (
            <div className="kstrip" style={{ margin: 0 }}>
              <span>{t("Áætl. klst")} <b>{dec1(planned)}</b> · {t("Raun klst")} <b>{dec1(actual)}</b></span>
              <span>{t("Tímabilið kostaði")} <b>{nf(actC)}</b> kr</span>
              <span className={devC > 0 ? "bad" : ""}>{devC >= 0 ? "+" : "−"}<b>{nf(Math.abs(devC))}</b> kr {t("miðað við plan")}</span>
              {worst && Math.abs(worst.actCost - worst.estCost) > 0 && <span>{t("mesta frávik hjá")} <b>{worst.name}</b></span>}
            </div>
          ) : <p className="muted" style={{ fontSize: 13, margin: 0 }}>{t("Engin gögn á þessu tímabili.")}</p>}
        </div>
      </div>

      <ReportLibrary from={from} to={to} departments={depts.filter((d) => d !== "all")} />
      {aiEnabled && <AiReportCard from={from} to={to} />}
      {timebank && timebank.live && <TimeBankCard rows={timebank.rows} live={timebank.live} monthLabels={timebank.monthLabels} />}
    </>
  );
}
