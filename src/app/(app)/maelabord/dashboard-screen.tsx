"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { toast } from "@/components/app/toast";
import { useLang } from "@/components/app/lang";
import { dec1, krCompact } from "@/lib/format";
import { getDashboardPeriod, type PeriodData } from "./actions";

// Paired demo bars (this period vs previous) — used only in the demo/preview state.
function Paired({ a, b }: { a: number[]; b: number[] }) {
  const max = Math.max(...a, ...b) * 1.1;
  return (
    <div className="sbars" id="dcompare" style={{ height: 180 }}>
      {a.map((v, i) => (
        <div className="col" key={i}>
          <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
            <div style={{ width: "32%", height: `${Math.round((v / max) * 100)}%`, background: "var(--teal)", borderRadius: "5px 5px 2px 2px" }} />
            <div style={{ width: "32%", height: `${Math.round((b[i] / max) * 100)}%`, background: "var(--brand)", borderRadius: "5px 5px 2px 2px" }} />
          </div>
          <small>V{i + 1}</small>
        </div>
      ))}
    </div>
  );
}

// Planned vs actual hours — line chart. Hover a point for the exact numbers.
function PlannedActual({ series, t }: { series: { label: string; planned: number; actual: number }[]; t: (s: string) => string }) {
  const W = 640, H = 200, padL = 30, padR = 12, padT = 14, padB = 26;
  const n = series.length;
  const max = Math.max(1, ...series.map((s) => Math.max(s.planned, s.actual))) * 1.12;
  const x = (i: number) => n <= 1 ? (padL + (W - padL - padR) / 2) : padL + (i * (W - padL - padR)) / (n - 1);
  const y = (v: number) => padT + (1 - v / max) * (H - padT - padB);
  const path = (key: "planned" | "actual") => series.map((s, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(" ");
  // y gridlines (0, mid, max-ish)
  const ticks = [0, Math.round(max / 2), Math.round(max * 0.9)];
  const labelStep = Math.ceil(n / 8);
  return (
    <div className="cb">
      <div style={{ display: "flex", gap: 16, fontSize: 12, color: "var(--ink2)", margin: "0 2px 8px" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 12, height: 3, borderRadius: 2, background: "var(--teal)" }} />{t("Áætlað")}</span>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 12, height: 3, borderRadius: 2, background: "var(--brand)" }} />{t("Raun")}</span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height={200} preserveAspectRatio="none" style={{ overflow: "visible" }}>
        {ticks.map((tk, i) => (
          <g key={i}>
            <line x1={padL} x2={W - padR} y1={y(tk)} y2={y(tk)} stroke="var(--line2)" strokeWidth={1} />
            <text x={0} y={y(tk) + 3} fontSize={10} fill="var(--ink3)">{dec1(tk)}</text>
          </g>
        ))}
        <path d={path("planned")} fill="none" stroke="var(--teal)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        <path d={path("actual")} fill="none" stroke="var(--brand)" strokeWidth={2.5} strokeLinejoin="round" strokeLinecap="round" />
        {series.map((s, i) => {
          const dev = Math.round((s.actual - s.planned) * 10) / 10;
          const tip = `${s.label} · ${t("Áætlað")} ${dec1(s.planned)} · ${t("Raun")} ${dec1(s.actual)} (${dev >= 0 ? "+" : ""}${dec1(dev)})`;
          return (
            <g key={i}>
              <circle cx={x(i)} cy={y(s.planned)} r={3} fill="var(--teal)" />
              <circle cx={x(i)} cy={y(s.actual)} r={3} fill={s.actual > s.planned + 0.05 ? "var(--bad)" : "var(--brand)"} />
              {/* wide invisible hit area for the tooltip */}
              <rect x={x(i) - 12} y={padT} width={24} height={H - padT - padB} fill="transparent"><title>{tip}</title></rect>
              {(i % labelStep === 0 || i === n - 1) && <text x={x(i)} y={H - 8} fontSize={10} fill="var(--ink3)" textAnchor="middle">{s.label}</text>}
            </g>
          );
        })}
      </svg>
    </div>
  );
}

/** "3 klst 12 mín" style duration between an ISO start and now (ms). */
function durSince(iso: string, nowMs: number): string {
  const mins = Math.max(0, Math.floor((nowMs - new Date(iso).getTime()) / 60000));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? `${h} klst ${m} mín` : `${m} mín`;
}

function EmptyBody({ msg }: { msg: string }) {
  const { t } = useLang();
  return <div className="cb"><div className="muted" style={{ fontSize: 13, lineHeight: 1.6, padding: "22px 6px", textAlign: "center" }}>{t(msg)}</div></div>;
}

type Onb = { show: boolean; hasLocation: boolean; hasStaff: boolean; hasSchedule: boolean; hasRevenue: boolean };
type OnNow = { punchId: string; name: string; av: string; c: string; dept: string; in: string; since: string };
type Missing = { employeeId: string; name: string; av: string; c: string; dept: string; start: string; late: boolean; mins: number };

const PRESETS: { k: string; label: string }[] = [
  { k: "idag", label: "Í dag" }, { k: "igaer", label: "Í gær" },
  { k: "7d", label: "7 dagar" }, { k: "30d", label: "30 dagar" }, { k: "vika", label: "db:vika" },
];
const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presetRange(k: string): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (k === "idag") return { from: isoD(t), to: isoD(t) };
  if (k === "igaer") { const y = new Date(t); y.setDate(y.getDate() - 1); return { from: isoD(y), to: isoD(y) }; }
  if (k === "7d") { const s = new Date(t); s.setDate(s.getDate() - 6); return { from: isoD(s), to: isoD(t) }; }
  if (k === "30d") { const s = new Date(t); s.setDate(s.getDate() - 29); return { from: isoD(s), to: isoD(t) }; }
  const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  const sun = new Date(mon); sun.setDate(sun.getDate() + 6);
  return { from: isoD(mon), to: isoD(sun) };
}

export default function DashboardScreen({ laborPct = 32.1, laborCostWeek = "1,40", hoursWeek = "374", onboarding, live = false, onNow = [], missing = [] }: { laborPct?: number; laborCostWeek?: string; hoursWeek?: string; onboarding?: Onb; live?: boolean; onNow?: OnNow[]; missing?: Missing[] }) {
  const { t } = useLang();
  const [chartSeg, setChartSeg] = useState("Vika");
  const [hideOnb, setHideOnb] = useState(false);
  const [period, setPeriod] = useState("vika");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pd, setPd] = useState<PeriodData | null>(null);
  const [nowMs, setNowMs] = useState(0);
  const [editMode, setEditMode] = useState(false);
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  function toggleHidden(id: string) {
    setHidden((prev) => {
      const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id);
      try { localStorage.setItem("vakto-dash-hidden", JSON.stringify([...n])); } catch { /* ignore */ }
      return n;
    });
  }
  // Widget wrapper: hidden cards vanish unless we're editing (then ghosted + a
  // toggle to show/hide). The "Sérsníða" button flips editMode.
  const Widget = ({ id, children }: { id: string; children: React.ReactNode }) => {
    if (!editMode && hidden.has(id)) return null;
    const off = editMode && hidden.has(id);
    return (
      <div style={{ position: "relative", opacity: off ? 0.4 : 1, transition: "opacity .12s" }}>
        {editMode && (
          <button onClick={() => toggleHidden(id)} title={hidden.has(id) ? t("Sýna") : t("Fela")}
            style={{ position: "absolute", top: 10, right: 10, zIndex: 6, width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "var(--panel)", color: hidden.has(id) ? "var(--brand)" : "var(--bad)", cursor: "pointer", fontSize: 14, fontWeight: 700, lineHeight: 1, display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "var(--shadow)" }}>
            {hidden.has(id) ? "+" : "✕"}
          </button>
        )}
        {children}
      </div>
    );
  };
  useEffect(() => {
    if (localStorage.getItem("vakto-onb-hidden") === "1") requestAnimationFrame(() => setHideOnb(true));
    // Restore the last-selected period + custom range (persists across navigation).
    const sp = localStorage.getItem("vakto-dash-period"); if (sp) setPeriod(sp);
    const sf = localStorage.getItem("vakto-dash-from"); if (sf) setCustomFrom(sf);
    const st = localStorage.getItem("vakto-dash-to"); if (st) setCustomTo(st);
    try { const h = JSON.parse(localStorage.getItem("vakto-dash-hidden") || "[]"); if (Array.isArray(h)) setHidden(new Set(h)); } catch { /* ignore */ }
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60000); // live "on shift" duration
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem("vakto-dash-period", period);
      localStorage.setItem("vakto-dash-from", customFrom);
      localStorage.setItem("vakto-dash-to", customTo);
    } catch { /* ignore */ }
  }, [period, customFrom, customTo]);
  useEffect(() => {
    if (!live) return;
    let from: string, to: string;
    if (period === "custom") { if (!customFrom || !customTo) return; from = customFrom; to = customTo; }
    else ({ from, to } = presetRange(period));
    let cancelled = false;
    getDashboardPeriod(from, to).then((r) => { if (!cancelled && r.ok) setPd(r); });
    return () => { cancelled = true; };
  }, [period, live, customFrom, customTo]);
  function hideOnboarding() {
    setHideOnb(true);
    try { localStorage.setItem("vakto-onb-hidden", "1"); } catch {}
  }
  const ringP = Math.round(laborPct);
  const ringColor = laborPct <= 30 ? "var(--good)" : laborPct <= 33 ? "var(--warn)" : "var(--bad)";
  const pctLabel = laborPct.toFixed(1).replace(".", ",");

  const steps = [
    { label: "Fyrirtæki & staðir", href: "/stillingar?new=location", done: !!onboarding?.hasLocation },
    { label: "Bæta við starfsfólki", href: "/starfsfolk?new=1", done: !!onboarding?.hasStaff },
    { label: "Gera fyrsta vaktaplan", href: "/vaktaplan", done: !!onboarding?.hasSchedule },
    { label: "Skrá veltu / tengja Inventra", href: "/stillingar?new=revenue", done: !!onboarding?.hasRevenue },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const curIdx = steps.findIndex((s) => !s.done);
  const Check = () => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg>;

  // Live company (signed in): the standard dashboard layout, always — filled
  // with real numbers where we have them, clean empty-states where we don't.
  if (live) {
    const lp = pd?.ok ? pd.laborPct : laborPct;
    const lpColor = lp === 0 ? "var(--ink3)" : lp <= 30 ? "var(--good)" : lp <= 33 ? "var(--warn)" : "var(--bad)";
    const plannedH = pd?.ok ? dec1(pd.planned) : hoursWeek;
    const actualH = pd?.ok ? dec1(pd.actual) : "—";
    const deviationH = pd?.ok ? `${pd.deviation >= 0 ? "+" : ""}${dec1(pd.deviation)}` : "—";
    const dvColor = pd?.ok && pd.deviation !== 0 ? (pd.deviation > 0 ? "var(--bad)" : "var(--good)") : "";
    const overtimeH = pd?.ok ? dec1(pd.overtime) : "0";
    const premiumH = pd?.ok ? dec1(pd.premium) : "0";
    const costStr = pd?.ok ? krCompact(pd.cost) : `${laborCostWeek} m.kr.`;
    const plannedCostStr = pd?.ok ? krCompact(pd.plannedCost) : "—";
    const deviationCostStr = pd?.ok ? `${pd.deviationCost >= 0 ? "+" : ""}${krCompact(pd.deviationCost)}` : "—";
    const overtimePayStr = pd?.ok ? krCompact(pd.overtimePay) : "—";
    const premiumPayStr = pd?.ok ? krCompact(pd.premiumPay) : "—";
    const leviesStr = pd?.ok ? krCompact(pd.levies) : "—";
    const costPerHourStr = pd?.ok ? krCompact(pd.costPerHour) : "—";
    const revenueStr = pd?.ok && pd.revenue > 0 ? krCompact(pd.revenue) : "";
    const sourceLabel = pd?.ok ? (pd.revenueSource === "inventra" ? t("tengt Inventra") : pd.revenueSource === "manual" ? t("handvirkt") : pd.revenueSource === "mixed" ? t("blandað") : pd.revenueSource === "estimated" ? t("áætluð") : "") : "";
    const series = pd?.ok ? pd.series : [];
    const staff = pd?.ok ? pd.staff : [];
    const overCount = staff.filter((s) => s.over).length;
    return (
      <>
        <PageHeader
          title="Mælaborð"
          subtitle={t("Rauntölur úr þínum gögnum")}
          actions={
            <button className={`btn ${editMode ? "" : "ghost "}sm`} onClick={() => setEditMode((v) => !v)}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M4 6h11M4 12h7M4 18h13M17 4v4M13 10v4M19 16v4" /></svg>{editMode ? t("Búið") : t("Sérsníða")}
            </button>
          }
        />

        {onboarding?.show && !hideOnb && (
          <div className="onb">
            <div className="ohd">
              <div>
                <h3>{t("Komdu þér af stað með VAKTO")}</h3>
                <div className="osub">{doneCount} {t("af 4 skrefum kláruð — settu kerfið upp á nokkrum mínútum.")}</div>
              </div>
              <span className="ohide" onClick={hideOnboarding} style={{ cursor: "pointer" }}>{t("Fela")}</span>
            </div>
            <div className="obar"><i style={{ width: `${(doneCount / 4) * 100}%` }} /></div>
            <div className="osteps">
              {steps.map((s, i) => (
                <Link href={s.href} key={s.label} className={`ostep ${s.done ? "done" : i === curIdx ? "cur" : ""}`} style={{ cursor: "pointer" }}>
                  <span className="n">{s.done ? <Check /> : i + 1}</span>
                  <span className="t">{t(s.label)}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {editMode && (
          <div style={{ background: "var(--brand-soft)", border: "1px solid var(--brand-2)", color: "var(--brand-deep)", borderRadius: 10, padding: "9px 13px", margin: "0 0 14px", fontSize: 12.5, fontWeight: 500 }}>
            {t("Smelltu á ✕ til að fela spjald sem þú vilt ekki sjá, + til að sýna aftur. Vistast sjálfkrafa — smelltu „Búið\" þegar þú ert klár/klár.")}
          </div>
        )}

        {/* period presets + custom range */}
        <div className="pchips" style={{ alignItems: "center", flexWrap: "wrap" }}>
          {PRESETS.map((p) => (
            <button key={p.k} className={`pchip${period === p.k ? " on" : ""}`} onClick={() => setPeriod(p.k)}>{t(p.label)}</button>
          ))}
          <button className={`pchip${period === "custom" ? " on" : ""}`} onClick={() => setPeriod("custom")}>{t("Sérsnið")}</button>
          {period === "custom" && (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 6, marginLeft: 4 }}>
              <input type="date" value={customFrom} max={customTo || undefined} onChange={(e) => setCustomFrom(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "5px 8px", font: "inherit", fontSize: 13, background: "#fff" }} />
              <span className="muted">–</span>
              <input type="date" value={customTo} min={customFrom || undefined} onChange={(e) => setCustomTo(e.target.value)} style={{ border: "1px solid var(--line)", borderRadius: 7, padding: "5px 8px", font: "inherit", fontSize: 13, background: "#fff" }} />
            </span>
          )}
        </div>

        {/* hero strip — figures follow the selected period */}
        <div className="dhero">
          <div className="dhero-head">
            <span className="dhero-badge">{period === "custom" ? (customFrom && customTo ? `${customFrom} – ${customTo}` : t("Sérsnið")) : t(PRESETS.find((p) => p.k === period)?.label ?? "Þessi vika")}</span>
            <span className="dhero-sub">{t("Rauntölur uppfærast eftir því sem stimplað er inn og út.")}</span>
          </div>
          <div className="dhero-body">
            <div className="dflow">
              <div className="fs"><div className="l">{t("Áætlaðir tímar")}</div><div className="v">{plannedH}</div></div>
              <span className="ar">→</span>
              <div className="fs"><div className="l">{t("Raun tímar")}</div><div className="v">{actualH}</div></div>
              <span className="ar">→</span>
              <div className="fs"><div className="l">{t("Frávik")}</div><div className="v" style={dvColor ? { color: dvColor } : undefined}>{deviationH}</div></div>
              <span className="ar">→</span>
              <div className="fs"><div className="l">{t("Yfirvinna")}</div><div className="v">{overtimeH} <small style={{ fontSize: 14, color: "var(--ink3)", fontWeight: 600 }}>{t("klst")}</small></div></div>
            </div>
            <div className="dhero-right">
              <div className="l">{t("Launakostnaður")}</div>
              <div className="big">{costStr}</div>
              <div className="s2">{t("Áætlað v. plan")} {plannedCostStr} · {t("frávik")} <span style={dvColor ? { color: dvColor } : undefined}>{deviationCostStr}</span>{lp > 0 ? ` · ${t("Laun af tekjum")} ${dec1(lp)}%` : ""}</div>
            </div>
          </div>
        </div>

        {/* headline KPIs (real, period-aware) */}
        <div className="kpis">
          <div className="kpi flex">
            <div className="ring" style={{ ["--p" as string]: lp === 0 ? 0 : Math.round(lp), ["--c" as string]: lpColor }}>
              <div className="in" style={{ color: lpColor }}>{lp === 0 ? "—" : Math.round(lp) + "%"}</div>
            </div>
            <div>
              <div className="lab">{t("Laun af tekjum")}</div>
              <div className="val" style={{ fontSize: 22 }}>{lp === 0 ? "—" : <>{dec1(lp)}<small>%</small></>}</div>
              {revenueStr
                ? <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t("Velta")} {revenueStr} · {sourceLabel} · <Link href="/stillingar?new=revenue" style={{ color: "var(--brand)", fontWeight: 600, textDecoration: "none" }}>{t("breyta")}</Link></div>
                : <Link href="/stillingar?new=revenue" className="muted" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none", display: "inline-block", marginTop: 2 }}>{t("Skrá veltu")}</Link>}
            </div>
          </div>
          <div className="kpi"><div className="lab">{t("Launakostnaður")}</div><div className="val">{costStr}</div></div>
          <div className="kpi"><div className="lab">{t("Raun tímar")}</div><div className="val">{actualH} <small>{t("klst")}</small></div></div>
          <div className="kpi"><div className="lab">{t("Frávik frá plani")}</div><div className="val" style={dvColor ? { color: dvColor } : undefined}>{deviationH} <small>{t("klst")}</small></div></div>
          <div className="kpi"><div className="lab">{t("Yfirvinna")}</div><div className="val" style={pd?.ok && pd.overtime > 0 ? { color: "var(--bad)" } : undefined}>{overtimeH} <small>{t("klst")}</small></div><div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2 }}>{overtimePayStr}</div></div>
          <div className="kpi"><div className="lab">{t("Álagstímar")}</div><div className="val">{premiumH} <small>{t("klst")}</small></div><div className="muted" style={{ fontSize: 11.5, fontWeight: 600, marginTop: 2 }}>{premiumPayStr}</div></div>
          <div className="kpi"><div className="lab">{t("Launatengd gjöld")}</div><div className="val">{leviesStr}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t("tryggingagjald, lífeyrir o.fl.")}</div></div>
          <div className="kpi"><div className="lab">{t("Kostnaður á klst")}</div><div className="val">{costPerHourStr}</div><div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t("meðaltal m. byrði")}</div></div>
        </div>

        {/* comparison charts — empty until history accrues */}
        <div className="grid2">
          <Widget id="chart"><div className="card">
            <div className="ch">
              <div><div className="ct">{t("Áætlað vs raun (tímar)")}</div><div className="cs">{t("farðu með músina yfir fyrir tölur")}</div></div>
            </div>
            {series.some((s) => s.planned > 0 || s.actual > 0)
              ? <PlannedActual series={series} t={t} />
              : <EmptyBody msg="Birtist þegar vaktir eru birtar og stimplað er inn." />}
          </div></Widget>
          <Widget id="onnow"><div className="card">
            <div className="ch"><div><div className="ct">{t("Á vakt núna")}</div><div className="cs">{t("skráðir inn í rauntíma")}</div></div><Link href="/timaskraning" className="badge" style={{ background: "var(--good-soft)", color: "var(--good)", textDecoration: "none" }}>{onNow.length} {t("á vakt")}</Link></div>
            {onNow.length ? (
              <div className="cb att">
                {onNow.map((r) => (
                  <div className="it" key={r.punchId}>
                    <span className="avt" style={{ background: r.c, width: 32, height: 32 }}>{r.av}</span>
                    <div className="tx"><b>{r.name}</b><span>{t(r.dept)} · {t("inn")} {r.in}</span></div>
                    <span className="tag" style={{ background: "var(--good-soft)", color: "var(--good)", marginLeft: "auto" }}>{nowMs ? durSince(r.since, nowMs) : t("á vakt")}</span>
                  </div>
                ))}
              </div>
            ) : <EmptyBody msg="Enginn skráður inn núna." />}
          </div></Widget>
        </div>

        {/* not clocked in — scheduled today but no punch (late / forgot / upcoming) */}
        <Widget id="missing"><div className="card" style={{ marginTop: 20 }}>
          <div className="ch">
            <div><div className="ct">{t("Ekki mætt af plani")}</div><div className="cs">{t("á plani í dag en ekki stimplaðir inn")}</div></div>
            {missing.length > 0 && <Link href="/timaskraning" className="badge" style={{ background: "var(--warn-soft)", color: "var(--warn)", textDecoration: "none" }}>{missing.filter((m) => m.late).length} {t("seinir")}</Link>}
          </div>
          {missing.length ? (
            <div className="cb att">
              {missing.map((m) => (
                <div className="it" key={m.employeeId}>
                  <span className="avt" style={{ background: m.c, width: 32, height: 32 }}>{m.av}</span>
                  <div className="tx"><b>{m.name}</b><span>{t(m.dept)} · {t("á plani")} {m.start}</span></div>
                  {m.late
                    ? <span className="tag" style={{ background: "var(--bad-soft)", color: "var(--bad)", marginLeft: "auto" }}>{m.mins >= 60 ? `${Math.floor(m.mins / 60)} klst ${m.mins % 60} mín` : `${m.mins} mín`} {t("of seint")}</span>
                    : <span className="tag" style={{ background: "var(--line2)", color: "var(--ink2)", marginLeft: "auto" }}>{t("væntanleg/ur")}</span>}
                </div>
              ))}
            </div>
          ) : <EmptyBody msg="Allir á plani hafa mætt." />}
        </div></Widget>

        {/* within vs over plan — who stays inside their hours, who runs over */}
        <Widget id="overplan"><div className="card" style={{ marginTop: 20 }}>
          <div className="ch">
            <div><div className="ct">{t("Innan vs yfir áætlun")}</div><div className="cs">{t("raun tímar borið saman við plan á tímabilinu")}</div></div>
            {staff.length > 0 && <span className="badge" style={{ background: overCount ? "var(--bad-soft)" : "var(--good-soft)", color: overCount ? "var(--bad)" : "var(--good)" }}>{overCount} {t("yfir áætlun")}</span>}
          </div>
          {staff.length ? (
            <div className="cb tbl" style={{ paddingTop: 8 }}>
              <table>
                <thead><tr><th>{t("Starfsmaður")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th></tr></thead>
                <tbody>
                  {staff.map((s, i) => (
                    <tr key={i}>
                      <td><span className="who"><span className="avt" style={{ background: s.c }}>{s.av}</span><span>{s.name}<small>{t(s.dept)}</small></span></span></td>
                      <td className="r">{dec1(s.planned)}</td>
                      <td className="r">{dec1(s.actual)}</td>
                      <td className="r" style={{ color: s.deviation > 0.05 ? "var(--bad)" : s.deviation < -0.05 ? "var(--good)" : undefined }}>{s.deviation > 0 ? "+" : ""}{dec1(s.deviation)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : <EmptyBody msg="Birtist þegar vaktir og stimplanir safnast." />}
        </div></Widget>

        {/* monthly overview */}
        <Widget id="monthly">
          <div className="sec">{t("Mánaðaryfirlit")}</div>
          <div className="card">
            <EmptyBody msg="Mánaðarsamanburður birtist þegar fleiri tímabil og launakeyrslur safnast." />
          </div>
        </Widget>
      </>
    );
  }

  return (
    <>
      <PageHeader
        title="Mælaborð"
        subtitle="Þriðjudagur 23. júní 2026"
        actions={
          <button
            className="btn ghost sm"
            onClick={() => toast("Sérsníða mælaborð — dragðu til spjöld og veldu hvað þú sérð")}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor">
              <path d="M4 6h11M4 12h7M4 18h13M17 4v4M13 10v4M19 16v4" />
            </svg>
            {t("Sérsníða")}
          </button>
        }
      />

      {/* "Í gær" hero strip */}
      <div className="dhero">
        <div className="dhero-head">
          <span className="dhero-badge">{t("Í gær · 24. júní 2026")}</span>
          <span className="dhero-sub">{t("Tímar og laun gærdagsins eru komin inn — dagurinn í dag uppfærist í rauntíma.")}</span>
        </div>
        <div className="dhero-body">
          <div className="dflow">
            <div className="fs"><div className="l">{t("Áætlaðir tímar")}</div><div className="v">374</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Raun tímar")}</div><div className="v" style={{ color: "var(--teal)" }}>381</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Frávik")}</div><div className="v" style={{ color: "var(--bad)" }}>+7</div></div>
            <span className="ar">→</span>
            <div className="fs"><div className="l">{t("Yfirvinna")}</div><div className="v" style={{ color: "var(--warn)" }}>12 <small style={{ fontSize: 14, color: "var(--ink3)", fontWeight: 600 }}>{t("klst")}</small></div></div>
          </div>
          <div className="dhero-right">
            <div className="l">{t("Launakostnaður gærdagsins")}</div>
            <div className="big">1,42 m.kr.</div>
            <div className="s2">{t("Laun% 32,4% · 47 vaktir · 8,2% yfirvinna")}</div>
          </div>
        </div>
      </div>

      {/* daily/weekly KPIs */}
      <div className="kpis">
        <div className="kpi flex">
          <div className="ring" style={{ ["--p" as string]: ringP, ["--c" as string]: ringColor }}>
            <div className="in" style={{ color: ringColor }}>{ringP}%</div>
          </div>
          <div>
            <div className="lab">{t("Laun af tekjum")}</div>
            <div className="val" style={{ fontSize: 22 }}>{pctLabel}<small>%</small></div>
            <div className="d up">▼ 0,8 {t("stig")} <span className="muted" style={{ fontWeight: 500 }}>{t("vs í gær")}</span></div>
            <Link href="/stillingar?new=revenue" className="muted" style={{ fontSize: 11.5, fontWeight: 600, color: "var(--brand)", textDecoration: "none", display: "inline-block", marginTop: 2 }}>{t("Skrá veltu")}</Link>
          </div>
        </div>
        <div className="kpi"><div className="lab">{t("Launakostnaður (vika)")}</div><div className="val">{laborCostWeek} <small>m kr</small></div><div className="d dn">▲ 3,0% <span className="muted" style={{ fontWeight: 500 }}>{t("vs fyrri viku")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Unnir tímar (vika)")}</div><div className="val">{hoursWeek} <small>{t("/ 368 áætl")}</small></div><div className="d dn">+6 {t("klst")} <span className="muted" style={{ fontWeight: 500 }}>{t("yfir plani")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Yfirvinna (vika)")}</div><div className="val">18 <small>{t("klst")}</small></div><div className="d dn">▲ 4 {t("klst")} <span className="muted" style={{ fontWeight: 500 }}>{t("vs fyrri viku")}</span></div></div>
      </div>

      <div className="grid2">
        <div className="card">
          <div className="ch">
            <div><div className="ct">{t("Launakostnaður — samanburður")}</div><div className="cs">{t("þetta tímabil vs fyrra")}</div></div>
            <div className="seg">
              {["Vika", "Mánuður", "Ár"].map((s) => (
                <button key={s} className={chartSeg === s ? "on" : ""} onClick={() => setChartSeg(s)}>{t(s)}</button>
              ))}
            </div>
          </div>
          <div className="cb">
            <Paired a={[1.31, 1.28, 1.35, 1.22, 1.40, 1.38]} b={[1.27, 1.30, 1.29, 1.24, 1.34, 1.30]} />
            <div className="legend">
              <span><i style={{ background: "var(--teal)" }} />{t("Þetta tímabil")}</span>
              <span><i style={{ background: "var(--brand)" }} />{t("Fyrra tímabil")}</span>
            </div>
            <div className="cmpfoot">
              <div><div className="l">{t("Þetta tímabil")}</div><div className="v">1,40 m</div></div>
              <div><div className="l">{t("Fyrra tímabil")}</div><div className="v">1,36 m</div></div>
              <div><div className="l">{t("Breyting")}</div><div className="v" style={{ color: "var(--good)" }}>+3,0%</div></div>
              <div><div className="l">{t("Tímar")}</div><div className="v">374 <span style={{ fontSize: 12, color: "var(--ink3)", fontWeight: 500 }}>/ 372</span></div></div>
            </div>
          </div>
        </div>
        <div className="card">
          <div className="ch">
            <div><div className="ct">{t("Vinnum við eftir plani?")}</div><div className="cs">{t("raun tímar vs áætlun · þessi vika")}</div></div>
            <span className="badge" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("94% eftir plani")}</span>
          </div>
          <div className="cb att">
            <div className="it"><div className="ic bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l5-5 4 3 6-7M16 8h4v4" /></svg></div><div className="tx"><b>Ómar</b><span>48,0 raun vs 40,0 áætl · yfirvinna</span></div><span className="tag bad">+8,0 klst</span></div>
            <div className="it"><div className="ic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 17l5-5 4 3 6-7M16 8h4v4" /></svg></div><div className="tx"><b>Truong</b><span>42,1 raun vs 40,0 áætl</span></div><span className="tag warn">+2,1 klst</span></div>
            <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M3 7l5 5 4-3 6 7M16 16h4v-4" /></svg></div><div className="tx"><b>Ha Vu</b><span>32,0 raun vs 40,0 áætl · undir plani</span></div><span className="tag" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>−8,0 klst</span></div>
            <div className="it"><div className="ic good"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg></div><div className="tx"><b>Bach</b><span>39,1 raun vs 40,0 áætl · á áætlun</span></div><span className="tag mut" style={{ background: "var(--line2)", color: "var(--ink3)" }}>−0,9 klst</span></div>
          </div>
        </div>
      </div>

      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch"><div className="ct">{t("Þarf athygli")}</div><span className="badge">{t("3 atriði")}</span></div>
        <div className="cb att">
          <div className="it"><div className="ic bad"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg></div><div className="tx"><b>{t("Yfirvinnu-áhætta: Ómar")}</b><span>{t("18 klst yfir starfshlutfalli í mánuðinum")}</span></div><span className="tag bad">+24.500 kr</span></div>
          <div className="it"><div className="ic warn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 3v18M5 8h14M5 16h14" /></svg></div><div className="tx"><b>{t("Hvíldartími: Jón")}</b><span>{t("9 klst milli vakta — undir 11 klst lágmarki")}</span></div><span className="tag warn">{t("laga")}</span></div>
          <div className="it"><div className="ic info"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 16v-4M12 8h.01" /></svg></div><div className="tx"><b>{t("Vantar útstimplun: Mína")}</b><span>{t("stimplaði inn 08:02, engin útstimplun í gær")}</span></div><span className="tag warn">{t("skoða")}</span></div>
        </div>
      </div>

      <div className="sec">
        {t("Mánuðurinn · júní 2026")}{" "}
        <span style={{ textTransform: "none", letterSpacing: 0, fontWeight: 500, color: "var(--ink3)" }}>{t("· borið saman við maí")}</span>
      </div>
      <div className="kpis">
        <div className="kpi"><div className="lab">{t("Unnir tímar")}</div><div className="val">1.968</div><div className="d mut">+1,2% {t("vs maí")}</div></div>
        <div className="kpi"><div className="lab">{t("Launakostn. (byrði)")}</div><div className="val">7,39 <small>m kr</small></div><div className="d dn">▲ 3,1% <span className="muted" style={{ fontWeight: 500 }}>{t("vs maí")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Laun% (með byrði)")}</div><div className="val" style={{ color: "var(--warn)" }}>39,7%</div><div className="d up">▼ 1,2 {t("stig")} <span className="muted" style={{ fontWeight: 500 }}>{t("batnar")}</span></div></div>
        <div className="kpi"><div className="lab">{t("Launaspá (mánuður)")}</div><div className="val">5,68 <small>m kr</small></div><div className="d mut">{t("brúttó · fyrir byrði")}</div></div>
      </div>
    </>
  );
}
