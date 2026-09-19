"use client";

// Mælaborð — the owner sees ONE number: laun % af veltu (yesterday + this
// week, traffic-light coloured against the company target). Everything else
// is a drill-down: three supporting KPIs for a chosen period, one "Þarf
// athygli" list and a collapsed per-employee plan-vs-actual table.
// Every figure comes from src/lib/labor.ts — nothing is computed here.

import { useEffect, useState } from "react";
import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { PeriodPicker, presetRange, type PresetKey } from "@/components/app/period-picker";
import { useLang } from "@/components/app/lang";
import { dec1, krCompact, nf } from "@/lib/format";
import { getDashboardPeriod, type PeriodData } from "./actions";
import type { DashboardView, HeroFigure, OpenPunchRow } from "./dashboard.server";

type OnNow = { punchId: string; name: string; dept: string };
type Missing = { employeeId: string; name: string; av: string; c: string; dept: string; start: string; late: boolean; mins: number };
type Range = { from: string; to: string; preset: PresetKey };

const RANGE_KEY = "vakto-dash-range";
const COLOR: Record<string, string> = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" };
const colorOf = (c: string | null | undefined) => (c && COLOR[c]) || "var(--ink3)";
const pctStr = (n: number) => (Number.isInteger(n) ? nf(n) : dec1(n));
const LINK: React.CSSProperties = { color: "var(--brand)", fontWeight: 600, textDecoration: "none", display: "inline-flex", alignItems: "center", minHeight: 44 };

function sourceKey(s: string): string {
  return s === "inventra" ? "tengt Inventra" : s === "api" ? "gegnum API" : s === "manual" ? "handvirkt" : s === "mixed" ? "blandað" : s === "estimated" ? "áætluð velta" : "";
}

/** One hero figure (Í gær / Þessi vika). null pct → "—" + the honest reason. */
function Figure({ label, fig, big = true }: { label: string; fig: HeroFigure | null; big?: boolean }) {
  const { t } = useLang();
  const pct = fig?.pct ?? null;
  const color = colorOf(fig?.color);
  const reason = !fig ? "" : fig.revenue <= 0 ? t("engin velta skráð") : fig.cost <= 0 ? t("engar stimplanir") : "";
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink3)" }}>{label}</div>
      <div style={{ fontSize: big ? "clamp(38px, 6vw, 56px)" : 30, fontWeight: 700, letterSpacing: "-.03em", lineHeight: 1.05, marginTop: 6, color, fontVariantNumeric: "tabular-nums" }}>
        {pct == null ? "—" : <>{dec1(pct)}<span style={{ fontSize: "0.5em", fontWeight: 600, marginLeft: 3 }}>%</span></>}
      </div>
      <div style={{ fontSize: 12.5, color: "var(--ink2)", marginTop: 8, lineHeight: 1.5 }}>
        {pct != null && fig
          ? <>{t("velta")} {krCompact(fig.revenue)} · {t("laun")} {krCompact(fig.cost)}{sourceKey(fig.revenueSource) ? <> · {t(sourceKey(fig.revenueSource))}</> : null}</>
          : reason
            ? <>{reason}{fig && fig.revenue <= 0 && <> · <Link href="/stillingar?new=revenue" style={{ ...LINK, minHeight: 0 }}>{t("Skrá veltu")}</Link></>}</>
            : t("engin gögn")}
      </div>
    </div>
  );
}

function AttentionRow({ href, kind, title, detail, tag }: { href: string; kind: "bad" | "warn" | "info"; title: string; detail: string; tag: string }) {
  return (
    <Link href={href} className="it" style={{ textDecoration: "none", color: "inherit", alignItems: "center", minHeight: 44 }}>
      <div className={`ic ${kind}`}>
        {kind === "bad"
          ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>
          : kind === "warn"
            ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M12 9v4M12 17h.01M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" /></svg>
            : <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>}
      </div>
      <div className="tx"><b>{title}</b><span>{detail}</span></div>
      <span className={`tag ${kind}`} style={{ marginLeft: "auto", whiteSpace: "nowrap" }}>{tag}</span>
    </Link>
  );
}

export default function DashboardScreen({ view, onNow = [], missing = [], pending = 0 }: { view: DashboardView; onNow?: OnNow[]; missing?: Missing[]; pending?: number }) {
  const { t } = useLang();
  const [hideOnb, setHideOnb] = useState(false);
  const [range, setRange] = useState<Range>(() => ({ ...presetRange("7d"), preset: "7d" }));
  const [loaded, setLoaded] = useState<{ key: string; data: PeriodData } | null>(null);
  const [showStaff, setShowStaff] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem("vakto-onb-hidden") === "1") requestAnimationFrame(() => setHideOnb(true));
      localStorage.removeItem("vakto-dash-hidden"); // old "Sérsníða" widget state — gone
      const raw = localStorage.getItem(RANGE_KEY);
      if (raw) {
        const r = JSON.parse(raw) as Partial<Range>;
        if (r.preset && r.preset !== "custom") requestAnimationFrame(() => setRange({ ...presetRange(r.preset as PresetKey), preset: r.preset as PresetKey }));
        else if (r.from && r.to) requestAnimationFrame(() => setRange({ from: r.from!, to: r.to!, preset: "custom" }));
      }
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    if (!view.live) return;
    let cancelled = false;
    const key = `${range.from}|${range.to}`;
    // One retry: the action can fail transiently while the server is busy.
    const attempt = (n: number) => getDashboardPeriod(range.from, range.to)
      .then((r) => { if (cancelled) return; if (r.ok) setLoaded({ key, data: r }); else if (n > 0) setTimeout(() => attempt(n - 1), 1500); })
      .catch(() => { if (!cancelled && n > 0) setTimeout(() => attempt(n - 1), 1500); });
    attempt(1);
    return () => { cancelled = true; };
  }, [range, view.live]);
  // Only show figures that belong to the CURRENT range (stale → "…" while loading).
  const pd = loaded && loaded.key === `${range.from}|${range.to}` ? loaded.data : null;

  function applyRange(from: string, to: string, preset: PresetKey) {
    const r = { from, to, preset };
    setRange(r);
    try { localStorage.setItem(RANGE_KEY, JSON.stringify(r)); } catch { /* ignore */ }
  }
  function hideOnboarding() {
    setHideOnb(true);
    try { localStorage.setItem("vakto-onb-hidden", "1"); } catch { /* ignore */ }
  }

  if (!view.configured) {
    return (
      <>
        <PageHeader title="Mælaborð" subtitle={t("Laun % af veltu — lægra er betra")} />
        <div className="card" style={{ maxWidth: 560 }}>
          <div className="ch"><div className="ct">{t("Supabase er ekki tengt")}</div></div>
          <div className="cb" style={{ fontSize: 13.5, color: "var(--ink2)", lineHeight: 1.6 }}>
            {t("Settu NEXT_PUBLIC_SUPABASE_URL og NEXT_PUBLIC_SUPABASE_ANON_KEY í .env.local (sjá supabase/README.md). Mælaborðið sýnir eingöngu rauntölur.")}
          </div>
        </div>
      </>
    );
  }

  const target = view.target;
  const targetStr = `${pctStr(target)} %`;
  const onb = view.onboarding;
  const steps = [
    { label: "Fyrirtæki & staðir", href: "/stillingar?new=location", done: onb.hasLocation },
    { label: "Bæta við starfsfólki", href: "/starfsfolk?new=1", done: onb.hasStaff },
    { label: "Gera fyrsta vaktaplan", href: "/vaktaplan", done: onb.hasSchedule },
    { label: "Skrá veltu / tengja Inventra", href: "/stillingar?new=revenue", done: onb.hasRevenue },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  const curIdx = steps.findIndex((s) => !s.done);

  // Selected period (secondary figure + the three KPIs).
  const periodFig: HeroFigure | null = pd?.ok
    ? { pct: pd.laborPct, revenue: pd.revenue, cost: pd.cost, revenueSource: pd.revenueSource, hours: pd.actual, color: pd.laborColor, from: range.from, to: range.to }
    : null;
  const staff = pd?.ok ? pd.staff : [];
  const overCount = staff.filter((s) => s.over).length;

  // Þarf athygli — one list, each row links to where it is fixed.
  const late = missing.filter((m) => m.late);
  const openPunches: OpenPunchRow[] = view.openPunches;
  const attentionCount = late.length + openPunches.length + (pending > 0 ? 1 : 0);
  const minsStr = (mins: number) => (mins >= 60 ? `${Math.floor(mins / 60)} ${t("klst")} ${mins % 60} ${t("mín")}` : `${mins} ${t("mín")}`);

  return (
    <>
      <PageHeader title="Mælaborð" subtitle={t("Laun % af veltu — lægra er betra")} />

      {onb.show && !hideOnb && (
        <div className="onb">
          <div className="ohd">
            <div>
              <h3>{t("Komdu þér af stað með VAKTO")}</h3>
              <div className="osub">{doneCount} {t("af 4 skrefum kláruð — settu kerfið upp á nokkrum mínútum.")}</div>
            </div>
            <button type="button" className="ohide" onClick={hideOnboarding} style={{ background: "none", border: "none", font: "inherit", minHeight: 44, padding: "0 6px" }}>{t("Fela")}</button>
          </div>
          <div className="obar"><i style={{ width: `${(doneCount / 4) * 100}%` }} /></div>
          <div className="osteps">
            {steps.map((s, i) => (
              <Link href={s.href} key={s.label} className={`ostep ${s.done ? "done" : i === curIdx ? "cur" : ""}`}>
                <span className="n">{s.done ? <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M5 12.5l4 4 10-10" /></svg> : i + 1}</span>
                <span className="t">{t(s.label)}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* THE number — laun % af veltu, yesterday and this week side by side */}
      <div className="dhero">
        <div className="dhero-head">
          <span className="dhero-badge">{t("Laun % af veltu")}</span>
          <span className="dhero-sub">{t("markmið")} {targetStr} · {t("grænt undir markmiði, gult allt að 3 stigum yfir, rautt þar fyrir ofan")}</span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "22px 40px", position: "relative", zIndex: 1 }}>
          <Figure label={t("Í gær")} fig={view.yesterday} />
          <Figure label={t("db:vika")} fig={view.week} />
        </div>
      </div>

      {/* period picker → secondary figure + the three KPIs */}
      <div className="card" style={{ marginBottom: 20 }}>
        <div className="cb" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 16, flexWrap: "wrap", padding: "16px 22px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: ".05em", textTransform: "uppercase", color: "var(--ink3)" }}>{t("Valið tímabil")}</span>
            <PeriodPicker from={range.from} to={range.to} activePreset={range.preset} onApply={applyRange} />
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
            <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>{t("laun %")}</span>
            <span style={{ fontSize: 26, fontWeight: 700, letterSpacing: "-.03em", color: colorOf(periodFig?.color), fontVariantNumeric: "tabular-nums" }}>
              {periodFig?.pct != null ? `${dec1(periodFig.pct)} %` : pd ? "—" : "…"}
            </span>
          </div>
        </div>
      </div>

      <div className="kpis" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))" }}>
        <div className="kpi">
          <div className="lab">{t("Velta")}</div>
          <div className="val">{periodFig && periodFig.revenue > 0 ? krCompact(periodFig.revenue) : "—"}</div>
          {periodFig && periodFig.revenue > 0
            ? <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{t(sourceKey(periodFig.revenueSource))} · <Link href="/stillingar?new=revenue" style={{ ...LINK, minHeight: 0 }}>{t("breyta")}</Link></div>
            : <Link href="/stillingar?new=revenue" style={{ ...LINK, fontSize: 12.5, marginTop: 2 }}>{t("Skrá veltu")}</Link>}
        </div>
        <div className="kpi">
          <div className="lab">{t("Launakostnaður")}</div>
          <div className="val">{periodFig && periodFig.cost > 0 ? krCompact(periodFig.cost) : "—"}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>
            {pd?.ok && pd.cost > 0 ? <>{t("þar af launatengd gjöld")} {krCompact(pd.levies)} · {dec1(pd.actual)} {t("klst")}</> : t("engar stimplanir á tímabilinu")}
          </div>
        </div>
        <Link href="/timaskraning" className="kpi" style={{ textDecoration: "none", color: "inherit", display: "block" }}>
          <div className="lab">{t("Á vakt núna")}</div>
          <div className="val" style={onNow.length > 0 ? { color: "var(--good)" } : undefined}>{onNow.length}</div>
          <div className="muted" style={{ fontSize: 11.5, marginTop: 2, color: "var(--brand)", fontWeight: 600 }}>{t("sjá í Tímaskráningu")}</div>
        </Link>
      </div>

      {/* Þarf athygli — one list */}
      <div className="card" style={{ marginTop: 20 }}>
        <div className="ch">
          <div><div className="ct">{t("Þarf athygli")}</div><div className="cs">{t("ekki mætt af plani · opnar stimplanir · beiðnir")}</div></div>
          <span className="badge" style={attentionCount ? { background: "var(--warn-soft)", color: "var(--warn)" } : undefined}>{attentionCount} {t("atriði")}</span>
        </div>
        {attentionCount ? (
          <div className="cb att">
            {late.map((m) => (
              <AttentionRow key={`m-${m.employeeId}`} href="/timaskraning" kind="bad"
                title={`${m.name} · ${t("ekki mætt")}`}
                detail={`${t(m.dept)} · ${t("á plani")} ${m.start}`}
                tag={`${minsStr(m.mins)} ${t("of seint")}`} />
            ))}
            {openPunches.map((p) => (
              <AttentionRow key={`p-${p.punchId}`} href="/timaskraning" kind="warn"
                title={`${p.name} · ${t("opin stimplun")}`}
                detail={`${t(p.dept)} · ${t("stimplaði inn")} ${p.since.slice(11, 16)} ${t("þann")} ${p.since.slice(8, 10)}.${p.since.slice(5, 7)}.`}
                tag={`${dec1(p.hours)} ${t("klst")}`} />
            ))}
            {pending > 0 && (
              <AttentionRow href="/vaktaplan" kind="info"
                title={`${pending} ${pending === 1 ? t("beiðni í bið") : t("beiðnir í bið")}`}
                detail={t("frí, vaktaskipti og óframboð")}
                tag={t("afgreiða")} />
            )}
          </div>
        ) : (
          <div className="cb" style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: 96 }}>
            <div className="muted" style={{ fontSize: 13, textAlign: "center" }}>
              <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="var(--good)" strokeWidth="1.6" style={{ display: "block", margin: "0 auto 8px" }}><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
              {t("Ekkert sem þarf athygli")}
            </div>
          </div>
        )}
      </div>

      {/* drill-down: per employee, plan vs actual for the selected period (collapsed) */}
      <div className="card" style={{ marginTop: 20 }}>
        <button type="button" className="ch" onClick={() => setShowStaff((v) => !v)}
          style={{ width: "100%", background: "none", border: "none", font: "inherit", textAlign: "left", cursor: "pointer", paddingBottom: showStaff ? 0 : 20, minHeight: 44 }}>
          <div><div className="ct">{t("Innan vs yfir áætlun")}</div><div className="cs">{t("raun tímar borið saman við plan á völdu tímabili")}</div></div>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
            {staff.length > 0 && <span className="badge" style={{ background: overCount ? "var(--bad-soft)" : "var(--good-soft)", color: overCount ? "var(--bad)" : "var(--good)" }}>{overCount} {t("yfir áætlun")}</span>}
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ transform: showStaff ? "rotate(180deg)" : undefined, transition: "transform .12s" }}><path d="m6 9 6 6 6-6" /></svg>
          </span>
        </button>
        {showStaff && (staff.length ? (
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
        ) : (
          <div className="cb"><div className="muted" style={{ fontSize: 13, textAlign: "center", padding: "14px 6px" }}>{t("Birtist þegar vaktir og stimplanir safnast.")}</div></div>
        ))}
      </div>
    </>
  );
}
