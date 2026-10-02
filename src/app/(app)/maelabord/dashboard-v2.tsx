"use client";

// Mælaborð v2 (okt. 2026): ein aðaltala (laun % af veltu) með dómi og kvarða, þróun síðustu 8 vikna,
// þrjú spjöld með samhengi (tímar · kostnaður · á vakt), súlurit plan vs raun og „Þarf athygli“.
// Allar tölur koma úr sama útreikningi og áður (getDashboardPeriod / lib/labor).

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { PeriodPicker } from "@/components/app/period-picker";
import { useLang } from "@/components/app/lang";
import { dec1, krCompact } from "@/lib/format";
import { getDashboardPeriod, getLaborTrend, type PeriodData, type TrendPoint } from "./actions";
import { OnboardingCard, useOnboardingHidden, onboardingProgress, ONBOARDING_TOTAL } from "./onboarding";
import type { Onboarding } from "./dashboard.server";

type OnNow = { punchId: string; employeeId?: string; name: string; av: string; c: string; dept: string; in: string; since: string; unscheduled?: boolean };
type Missing = { employeeId: string; name: string; av: string; c: string; dept: string; start: string; late: boolean; mins: number };

const isoD = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
function presetRange(k: string): { from: string; to: string } {
  const t = new Date(); t.setHours(0, 0, 0, 0);
  if (k === "idag") return { from: isoD(t), to: isoD(t) };
  if (k === "30d") { const s = new Date(t); s.setDate(s.getDate() - 29); return { from: isoD(s), to: isoD(t) }; }
  if (k === "7d") { const s = new Date(t); s.setDate(s.getDate() - 6); return { from: isoD(s), to: isoD(t) }; }
  // Vikan til dagsins í dag: plan framtíðardaga má ekki telja sem „undir plani“.
  const mon = new Date(t); mon.setDate(mon.getDate() - ((mon.getDay() + 6) % 7));
  return { from: isoD(mon), to: isoD(t) };
}
const SEGS: { k: string; label: string }[] = [{ k: "idag", label: "Í dag" }, { k: "vika", label: "Vika" }, { k: "30d", label: "30 dagar" }];
const COLOR = { good: "var(--good)", warn: "var(--warn)", bad: "var(--bad)" } as const;
const durSince = (iso: string, now: number) => { const m = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000)); return m >= 60 ? `${Math.floor(m / 60)} klst ${m % 60} mín` : `${m} mín`; };
const WD = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const mins = (m: number) => (m >= 60 ? `${Math.floor(m / 60)} klst ${m % 60} mín` : `${m} mín`);

function Spark({ points, target }: { points: TrendPoint[]; target: number }) {
  const vals = points.map((p) => p.pct).filter((v): v is number => v != null);
  if (vals.length < 2) return null;
  const W = 320, H = 130, pad = 8;
  const max = Math.max(target * 1.3, ...vals) , min = Math.min(target * 0.6, ...vals);
  const x = (i: number) => pad + (i * (W - 2 * pad)) / (points.length - 1);
  const y = (v: number) => pad + (1 - (v - min) / (max - min)) * (H - 2 * pad);
  const pts = points.map((p, i) => (p.pct == null ? null : [x(i), y(p.pct)] as const)).filter(Boolean) as (readonly [number, number])[];
  const line = pts.map(([a, b], i) => `${i ? "L" : "M"}${a.toFixed(1)} ${b.toFixed(1)}`).join(" ");
  const area = `${line} L${pts[pts.length - 1][0].toFixed(1)} ${H} L${pts[0][0].toFixed(1)} ${H}Z`;
  const last = pts[pts.length - 1];
  return (
    <svg className="db2-spark" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" aria-hidden="true">
      <line x1="0" x2={W} y1={y(target)} y2={y(target)} stroke="var(--bad)" strokeDasharray="4 5" strokeWidth="1.2" opacity=".55" />
      <path d={area} fill="var(--brand)" opacity=".13" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="3" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={last[0]} cy={last[1]} r="5" fill="var(--brand)" stroke="var(--panel)" strokeWidth="2.5" />
    </svg>
  );
}

export default function DashboardV2({ onboarding, onNow, missing, pending, firstName }: { onboarding?: Onboarding; onNow: OnNow[]; missing: Missing[]; pending: number; firstName?: string }) {
  const { t } = useLang();
  const [hideOnb, setHideOnb] = useOnboardingHidden();
  const [period, setPeriod] = useState("vika");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState("");
  const [pd, setPd] = useState<PeriodData | null>(null);
  const [week, setWeek] = useState<PeriodData["series"]>([]);
  const [trend, setTrend] = useState<{ target: number; points: TrendPoint[] } | null>(null);
  const [nowMs, setNowMs] = useState(0);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- klukkan byrjar eftir hydration
    setNowMs(Date.now());
    const id = setInterval(() => setNowMs(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    try {
      const sp = localStorage.getItem("vakto-dash-period");
      // eslint-disable-next-line react-hooks/set-state-in-effect -- les vafra-geymslu eftir hydration
      if (sp && (SEGS.some((s) => s.k === sp) || sp === "custom")) setPeriod(sp);
      setCustomFrom(localStorage.getItem("vakto-dash-from") ?? "");
      setCustomTo(localStorage.getItem("vakto-dash-to") ?? "");
    } catch { /* ignore */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem("vakto-dash-period", period); localStorage.setItem("vakto-dash-from", customFrom); localStorage.setItem("vakto-dash-to", customTo); } catch { /* ignore */ }
    let from: string, to: string;
    if (period === "custom") { if (!customFrom || !customTo) return; from = customFrom; to = customTo; } else ({ from, to } = presetRange(period));
    let stop = false;
    getDashboardPeriod(from, to).then((r) => { if (!stop && r.ok) setPd(r); });
    return () => { stop = true; };
  }, [period, customFrom, customTo]);
  useEffect(() => {
    const { from, to } = presetRange("7d");
    getDashboardPeriod(from, to).then((r) => { if (r.ok) setWeek(r.series); });
    getLaborTrend(8).then((r) => { if (r.ok) setTrend(r); });
  }, []);

  const lp = pd?.laborPct ?? null;
  const target = pd?.target ?? trend?.target ?? 30;
  const col = pd?.laborColor ? COLOR[pd.laborColor] : "var(--ink3)";
  const diff = lp != null ? Math.abs(Math.round((lp - target) * 10) / 10) : 0;
  const verdict = lp == null ? null : pd?.laborColor === "good"
    ? <><b>{t("Innan markmiðs.")}</b> {dec1(diff)} {t("stigum undir")} {dec1(target)} % {t("markmiðinu")}.</>
    : <><b>{pd?.laborColor === "warn" ? t("Rétt yfir markmiði.") : t("Yfir markmiði.")}</b> {dec1(diff)} {t("stigum yfir")} {dec1(target)} % {t("markmiðinu")}.</>;
  const gaugeMax = Math.max(50, Math.ceil((target * 1.7) / 5) * 5, lp != null ? Math.ceil((lp + 5) / 5) * 5 : 0);
  const gp = (v: number) => `${Math.min(100, Math.max(0, (v / gaugeMax) * 100))}%`;

  const tp = trend?.points.filter((p) => p.pct != null) ?? [];
  const trendDelta = tp.length >= 2 ? Math.round(((tp[tp.length - 1].pct as number) - (tp[tp.length - 2].pct as number)) * 10) / 10 : null;

  const dev = pd ? pd.deviation : 0;
  const base = pd ? Math.max(0, pd.cost - pd.levies - pd.overtimePay - pd.premiumPay) : 0;
  const parts = pd && pd.cost > 0 ? [
    { k: "Grunnlaun", v: base, c: "var(--brand)" },
    { k: "Launatengd gjöld", v: pd.levies, c: "#f7b678" },
    { k: "Yfirvinna", v: pd.overtimePay, c: "var(--bad)" },
    { k: "Álagsgreiðslur", v: pd.premiumPay, c: "#c9c9d2" },
  ] : [];
  const late = missing.filter((m) => m.late);
  const onPlanToday = onNow.filter((r) => !r.unscheduled).length + missing.length;

  const attention = useMemo(() => {
    const items: { icon: "clock" | "up" | "cal" | "rev" | "ok"; tone: string; title: string; sub: string; href: string; cta: string }[] = [];
    for (const m of late.slice(0, 3)) items.push({ icon: "clock", tone: "warn", title: `${m.name} ${t("er ekki mætt/ur")}`, sub: `${t("Á plani")} ${m.start} · ${mins(m.mins)} ${t("of seint")}`, href: "/timaskraning", cta: t("Skoða") });
    for (const s of (pd?.staff ?? []).filter((s) => s.deviation >= 1).sort((a, b) => b.deviation - a.deviation).slice(0, 3))
      items.push({ icon: "up", tone: "bad", title: `${s.name} ${t("er")} ${dec1(s.deviation)} ${t("klst yfir plani")}`, sub: `${dec1(s.actual)} ${t("unnið")} · ${dec1(s.planned)} ${t("á plani")}`, href: "/timaskraning", cta: t("Skoða") });
    if (pending > 0) items.push({ icon: "cal", tone: "info", title: `${pending} ${pending === 1 ? t("beiðni bíður") : t("beiðnir bíða")}`, sub: t("Frí, vaktaskipti eða lausar vaktir"), href: "/vaktaplan", cta: t("Afgreiða") });
    if (pd && !pd.hasRevenue) items.push({ icon: "rev", tone: "info", title: t("Engin velta skráð á tímabilinu"), sub: t("Skráðu veltu til að sjá laun sem % af veltu"), href: "/stillingar?new=revenue", cta: t("Skrá veltu") });
    return items;
  }, [late, pd, pending, t]);

  const weekMax = Math.max(1, ...week.map((s) => Math.max(s.planned, s.actual))) * 1.08;
  const greet = (() => { const h = new Date().getHours(); return h < 11 ? t("Góðan daginn") : h < 18 ? t("Góðan dag") : t("Gott kvöld"); })();

  return (
    <div className="db2">
      <div className="db2-top">
        <div>
          <h1>{greet}{firstName ? `, ${firstName}` : ""}</h1>
          <div className="db2-sub">{t("Svona gengur reksturinn.")}</div>
        </div>
        <div className="db2-period">
          {onboarding?.show && hideOnb && (
            <button className="btn ghost sm" onClick={() => setHideOnb(false)}>{t("Fyrstu skrefin")} · {onboardingProgress(onboarding)}/{ONBOARDING_TOTAL}</button>
          )}
          <div className="db2-seg" role="tablist">
            {SEGS.map((s) => <button key={s.k} role="tab" aria-selected={period === s.k} className={period === s.k ? "on" : ""} onClick={() => setPeriod(s.k)}>{t(s.label)}</button>)}
          </div>
          <PeriodPicker from={period === "custom" ? customFrom : presetRange(period).from} to={period === "custom" ? customTo : presetRange(period).to}
            onApply={(a, b) => { setCustomFrom(a); setCustomTo(b); setPeriod("custom"); }} />
        </div>
      </div>

      {onboarding?.show && !hideOnb && <OnboardingCard onboarding={onboarding} onHide={() => setHideOnb(true)} />}

      <section className="db2-card db2-hero">
        <div className="db2-hero-l">
          <div className="db2-k">{t("Laun sem hlutfall af veltu")}</div>
          <div className="db2-big" style={{ color: col }}>{lp == null ? "—" : <>{dec1(lp)}<small>%</small></>}</div>
          {pd && (lp != null ? (
            <p className="db2-verdict">{verdict} {t("Velta")} {krCompact(pd.revenue)} {t("og launakostnaður")} {krCompact(pd.cost)} {t("með gjöldum.")}
              {pd.revenueSource === "estimated" && <> <span className="db2-muted">({t("áætluð velta")} · <Link href="/stillingar?new=revenue">{t("breyta")}</Link>)</span></>}</p>
          ) : (
            <p className="db2-verdict">{t("Skráðu veltu tímabilsins til að sjá hlutfallið.")} <Link href="/stillingar?new=revenue">{t("Skrá veltu")}</Link></p>
          ))}
          <div className="db2-gauge" aria-hidden="true">
            <div className="db2-gbar" style={{ background: `linear-gradient(90deg, var(--good) 0 ${gp(target)}, #f2c14b ${gp(target)} ${gp(target + 3)}, var(--bad) ${gp(target + 3)} 100%)` }}>
              {lp != null && <div className="db2-gpin" style={{ left: gp(lp) }} />}
              <div className="db2-gtarget" style={{ left: gp(target) }}>{t("markmið")} {dec1(target)} %</div>
            </div>
            <div className="db2-gscale"><span>0 %</span><span>{dec1(gaugeMax / 2)} %</span><span>{gaugeMax} %</span></div>
          </div>
        </div>
        <div className="db2-hero-r">
          <div className="db2-row-sb"><span className="db2-k">{t("Síðustu 8 vikur")}</span>
            {trendDelta != null && <span className={`db2-pill ${trendDelta <= 0 ? "good" : "bad"}`}>{trendDelta <= 0 ? "▼" : "▲"} {dec1(Math.abs(trendDelta))} {t("stig")}</span>}</div>
          {trend && tp.length >= 2 ? <Spark points={trend.points} target={target} />
            : <div className="db2-muted db2-empty">{t("Þróunin birtist þegar velta og stimplanir hafa safnast í nokkrar vikur.")}</div>}
          <div className="db2-legend"><span><i style={{ background: "var(--brand)" }} />{t("Laun % af veltu")}</span><span><i style={{ background: "var(--bad)", opacity: .6 }} />{t("Markmið")}</span></div>
        </div>
      </section>

      <div className="db2-row3">
        <section className="db2-card db2-tile">
          {pd && Math.abs(dev) >= 0.1 && <span className={`db2-pill ${dev > 0 ? "bad" : "good"} db2-tag`}>{dev > 0 ? "+" : "−"}{dec1(Math.abs(dev))} {dev > 0 ? t("klst yfir plani") : t("klst undir plani")}</span>}
          <div className="db2-k">{t("Unnir tímar")}</div>
          <div className="db2-v">{pd ? dec1(pd.actual) : "—"}<small>/ {pd ? dec1(pd.planned) : "—"} {t("áætl.")}</small></div>
          {pd && Math.abs(dev) >= 0.1 && (
            <div className={`db2-devline ${dev > 0 ? "bad" : "good"}`}>
              <span>{t("Frávik frá plani")}</span>
              <b>{dev > 0 ? "+" : "−"}{dec1(Math.abs(dev))} {t("klst")} · {pd.deviationCost >= 0 ? "+" : "−"}{krCompact(Math.abs(pd.deviationCost))}</b>
            </div>
          )}
          <div className="db2-s">{t("Yfirvinna")} {pd ? dec1(pd.overtime) : "0"} {t("klst")}{pd && pd.overtimePay > 0 ? ` · ${krCompact(pd.overtimePay)}` : ""} · {t("álag")} {pd ? dec1(pd.premium) : "0"} {t("klst")}</div>
          {week.length > 0 && (
            <div className="db2-minibars" aria-hidden="true">
              {week.map((s, i) => <div key={i} title={`${s.label}: ${dec1(s.actual)} / ${dec1(s.planned)}`}><span style={{ height: `${Math.max(6, (s.actual / weekMax) * 100)}%`, background: s.actual > s.planned + 0.05 ? "var(--bad)" : s.actual > 0 ? "var(--brand)" : "var(--line)" }} /></div>)}
            </div>
          )}
        </section>
        <section className="db2-card db2-tile">
          <div className="db2-k">{t("Launakostnaður")}</div>
          <div className="db2-v">{pd ? krCompact(pd.cost) : "—"}</div>
          <div className="db2-s">{pd && pd.costPerHour > 0 ? <>{krCompact(pd.costPerHour)} {t("á unna klukkustund að meðaltali")}</> : t("með launatengdum gjöldum")}</div>
          {parts.length > 0 && (<>
            <div className="db2-stack">{parts.map((p) => <span key={p.k} style={{ width: `${(p.v / pd!.cost) * 100}%`, background: p.c }} />)}</div>
            <div className="db2-keys">{parts.map((p) => <span key={p.k}><i style={{ background: p.c }} />{t(p.k)}<b>{krCompact(p.v)}</b></span>)}</div>
          </>)}
        </section>
        <section className="db2-card db2-tile">
          {late.length > 0 && <span className="db2-pill warn db2-tag">{late.length} {late.length === 1 ? t("seinn") : t("seinir")}</span>}
          <div className="db2-k">{t("Á vakt núna")}</div>
          <div className="db2-v">{onNow.length}<small>{onPlanToday > 0 ? `${t("af")} ${onPlanToday} ${t("á plani")}` : t("skráðir inn")}</small></div>
          {onNow.length + missing.length > 0 && (
            <div className="db2-avs">
              {onNow.slice(0, 7).map((r) => <span key={r.punchId} className="db2-av" style={{ background: r.c }} title={`${r.name} · ${t("inn")} ${r.in}`}>{r.av}</span>)}
              {missing.slice(0, 4).map((m) => <span key={m.employeeId} className="db2-av off" title={`${m.name} · ${t("á plani")} ${m.start}`}>{m.av}</span>)}
            </div>
          )}
          <div className="db2-s">{late[0] ? <>{late[0].name} {t("átti að mæta")} {late[0].start} · {mins(late[0].mins)} {t("of seint")}</> : onNow.length ? t("Allir á plani eru mættir.") : t("Enginn skráður inn núna.")}</div>
        </section>
      </div>

      <div className="db2-grid2">
        <section className="db2-card">
          <div className="db2-ch"><div><div className="db2-ct">{t("Áætlað og unnið, dag fyrir dag")}</div><div className="db2-cs">{t("Síðustu 7 dagar. Tölurnar eru klukkustundir, frávik dagsins er undir.")}</div></div></div>
          {week.some((s) => s.planned > 0 || s.actual > 0) ? (<>
            <div className="db2-legend db2-legend-pad"><span><i style={{ background: "var(--line)" }} />{t("Á plani")}</span><span><i style={{ background: "var(--brand)" }} />{t("Unnið")}</span><span><i style={{ background: "var(--bad)" }} />{t("Unnið umfram plan")}</span></div>
            <div className="db2-bars2">
              {week.map((s, i) => {
                const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (week.length - 1 - i));
                const isToday = i === week.length - 1;
                const diffH = Math.round((s.actual - s.planned) * 10) / 10;
                const over = s.actual > s.planned + 0.05;
                return (
                  <div className="db2-day2" key={i} title={`${s.label} · ${t("Á plani")} ${dec1(s.planned)} · ${t("Unnið")} ${dec1(s.actual)}`}>
                    <div className="db2-cols">
                      <div className="db2-col"><em>{s.planned > 0 ? dec1(s.planned) : ""}</em><span className="pl" style={{ height: `${(s.planned / weekMax) * 100}%` }} /></div>
                      <div className="db2-col"><em className={over ? "bad" : ""}>{s.actual > 0 || !isToday ? dec1(s.actual) : ""}</em><span className={`ac${over ? " over" : ""}${isToday ? " live" : ""}`} style={{ height: `${Math.max(s.actual > 0 ? 2 : 0, (s.actual / weekMax) * 100)}%` }} /></div>
                    </div>
                    <div className="db2-dl">{isToday ? t("Í dag") : `${t(WD[d.getDay()])} ${s.label}`}</div>
                    <div className={`db2-dd ${isToday ? "" : diffH > 0.05 ? "bad" : diffH < -0.05 ? "good" : ""}`}>{isToday ? t("í gangi") : s.planned || s.actual ? `${diffH > 0 ? "+" : diffH < 0 ? "−" : "±"}${dec1(Math.abs(diffH))}` : "–"}</div>
                  </div>
                );
              })}
            </div>
          </>          ) : <div className="db2-muted db2-empty">{t("Birtist þegar vaktir eru birtar og stimplað er inn.")}</div>}
        </section>
        <section className="db2-card">
          <div className="db2-ch"><div><div className="db2-ct">{t("Þarf athygli")}</div><div className="db2-cs">{t("Það sem þú getur klárað núna")}</div></div></div>
          <div className="db2-list">
            {attention.length ? attention.map((a, i) => (
              <Link href={a.href} className="db2-it" key={i}>
                <span className={`db2-ic ${a.tone}`}>
                  {a.icon === "clock" && <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>}
                  {a.icon === "up" && <svg viewBox="0 0 24 24"><path d="M3 17l5-5 4 3 6-7M16 8h4v4" /></svg>}
                  {a.icon === "cal" && <svg viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2" /><path d="M8 3v4M16 3v4M4 10h16" /></svg>}
                  {a.icon === "rev" && <svg viewBox="0 0 24 24"><path d="M12 3v18M17 7.5c0-1.9-2.2-3-5-3s-5 1.1-5 3 2 2.6 5 3.2 5 1.4 5 3.3-2.2 3-5 3-5-1.2-5-3" /></svg>}
                </span>
                <span className="db2-tx"><b>{a.title}</b><span>{a.sub}</span></span>
                <span className="db2-go">{a.cta}</span>
              </Link>
            )) : (
              <div className="db2-allgood">
                <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.5 2.5L16 9.5" /></svg>
                {t("Ekkert sem þarf að bregðast við núna.")}
              </div>
            )}
          </div>
        </section>
      </div>

      <section className="db2-card" id="a-vakt">
        <div className="db2-ch"><div><div className="db2-ct">{t("Á vakt núna")}</div><div className="db2-cs">{t("Skráðir inn í rauntíma. Smelltu á nafn til að sjá tímaskráningu.")}</div></div>
          {onNow.length > 0 && <span className="db2-pill good">{onNow.length} {t("á vakt")}</span>}</div>
        {onNow.length ? (
          <div className="db2-list">
            {onNow.map((r) => (
              <Link href={r.employeeId ? `/timaskraning/${r.employeeId}` : "/timaskraning"} className="db2-it" key={r.punchId}>
                <span className="db2-av sm" style={{ background: r.c }}>{r.av}</span>
                <span className="db2-tx"><b>{r.name}</b><span>{t(r.dept)} · {t("inn")} {r.in}</span></span>
                {r.unscheduled && <span className="db2-pill warn" title={t("Stimplaði sig inn án þess að vera á vaktaplani dagsins")}>{t("óáætlað")}</span>}
                <span className="db2-pill good">{nowMs ? durSince(r.since, nowMs) : t("á vakt")}</span>
                <svg className="db2-chev" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 6 6 6-6 6" /></svg>
              </Link>
            ))}
          </div>
        ) : <div className="db2-muted db2-empty" style={{ padding: "18px 24px" }}>{t("Enginn skráður inn núna.")}</div>}
      </section>

      {(pd?.staff.length ?? 0) > 0 && (
        <section className="db2-card db2-staff">
          <div className="db2-ch"><div><div className="db2-ct">{t("Starfsfólk á tímabilinu")}</div><div className="db2-cs">{t("Unnir tímar borið saman við plan, og hvað frávikið kostar. Smelltu á nafn fyrir tímaskráningu.")}</div></div></div>
          <div className="db2-tblwrap"><table>
            <thead><tr><th>{t("Starfsmaður")}</th><th className="r">{t("Á plani")}</th><th className="r">{t("Unnið")}</th><th className="r">{t("Frávik (klst)")}</th><th className="r">{t("Kostnaður frávika")}</th></tr></thead>
            <tbody>{pd!.staff.map((s, i) => {
              const devCost = s.actual > 0 ? (s.cost / s.actual) * s.deviation : 0;
              const c = s.deviation > 0.05 ? "var(--bad)" : s.deviation < -0.05 ? "var(--good)" : undefined;
              return (
                <tr key={i}>
                  <td><Link href={`/timaskraning/${s.id}`} className="db2-who"><span className="db2-av sm" style={{ background: s.c }}>{s.av}</span><span>{s.name}<small>{t(s.dept)}</small></span></Link></td>
                  <td className="r">{dec1(s.planned)}</td><td className="r">{dec1(s.actual)}</td>
                  <td className="r" style={{ color: c }}>{s.deviation > 0 ? "+" : ""}{dec1(s.deviation)}</td>
                  <td className="r" style={{ color: c }}>{Math.abs(devCost) >= 1 ? `${devCost > 0 ? "+" : "−"}${krCompact(Math.abs(devCost))}` : "–"}</td>
                </tr>
              );
            })}</tbody>
          </table></div>
        </section>
      )}
    </div>
  );
}
