"use client";

// Laun % af veltu — sundurliðun sem eigandinn stjórnar sjálfur: tímabil, staðir, deildir, skipt eftir
// stað / deild / starfsmanni / degi / vikudegi / klukkustund, raun eða áætlun, frávik frá markmiði og
// útflutningur í Excel/PDF. Gögnin koma í einni ferð (getLaborFacts) og allt annað reiknast í vafranum.

import { useEffect, useMemo, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { DeptPicker } from "@/components/app/controls";
import { nf, dec1 } from "@/lib/format";
import type { LaborFacts } from "@/lib/labor";
import { fetchLaborFacts } from "./actions";

type Period = "week" | "lastweek" | "month" | "lastmonth" | "30" | "custom";
type Split = "loc" | "dept" | "emp" | "day" | "dow" | "hour";
type Basis = "actual" | "planned";

const PERIODS: [Period, string][] = [["week", "Þessi vika"], ["lastweek", "Síðasta vika"], ["month", "Þessi mánuður"], ["lastmonth", "Síðasti mánuður"], ["30", "30 dagar"], ["custom", "Sérsniðið"]];
const SPLITS: [Split, string][] = [["loc", "Stað"], ["dept", "Deild"], ["emp", "Starfsmanni"], ["day", "Degi"], ["dow", "Vikudegi"], ["hour", "Klukkustund"]];
const PERIOD_EN: Record<Period, string> = { week: "This week", lastweek: "Last week", month: "This month", lastmonth: "Last month", "30": "30 days", custom: "Custom" };
const DOW = ["Sun", "Mán", "Þri", "Mið", "Fim", "Fös", "Lau"];
const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0];

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
function rangeOf(p: Period, today: Date): [string, string] {
  const d = new Date(today); d.setHours(0, 0, 0, 0);
  const mon = new Date(d); mon.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  if (p === "week") { const s = new Date(mon); s.setDate(mon.getDate() + 6); return [iso(mon), iso(s)]; }
  if (p === "lastweek") { const a = new Date(mon); a.setDate(mon.getDate() - 7); const b = new Date(mon); b.setDate(mon.getDate() - 1); return [iso(a), iso(b)]; }
  if (p === "lastmonth") return [iso(new Date(d.getFullYear(), d.getMonth() - 1, 1)), iso(new Date(d.getFullYear(), d.getMonth(), 0))];
  if (p === "30") { const a = new Date(d); a.setDate(d.getDate() - 29); return [iso(a), iso(d)]; }
  return [iso(new Date(d.getFullYear(), d.getMonth(), 1)), iso(new Date(d.getFullYear(), d.getMonth() + 1, 0))];
}
const kr = (n: number) => `${nf(Math.round(n))} kr`;
const pctTxt = (n: number | null) => (n == null ? "—" : `${dec1(n)} %`);

type Row = { key: string; label: string; revenue: number | null; plannedCost: number; actualCost: number; plannedH: number; actualH: number; cost: number; hours: number; pct: number | null; gap: number | null; perHour: number | null; order: number };

export function LaborExplorer() {
  const { t, lang } = useLang();
  const [period, setPeriod] = useState<Period>("month");
  const [custom, setCustom] = useState<[string, string]>(() => rangeOf("month", new Date()));
  const [data, setData] = useState<LaborFacts | null>(null);
  const [busy, setBusy] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [locs, setLocs] = useState<string[]>([]);
  const [depts, setDepts] = useState<string[]>([]);
  const [split, setSplit] = useState<Split>("loc");
  const [basis, setBasis] = useState<Basis>("actual");
  const [sort, setSort] = useState<{ col: keyof Row; dir: 1 | -1 } | null>(null);

  const [from, to] = period === "custom" ? custom : rangeOf(period, new Date());
  useEffect(() => {
    let stop = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- hleðslumerki á meðan gögn eru sótt
    setBusy(true); setErr(null);
    fetchLaborFacts(from, to).then((r) => {
      if (stop) return;
      if (r.ok && r.data) {
        setData(r.data);
        // Engin stimplun enn (t.d. framtíð) → áætlun er það eina sem segir eitthvað.
        if (!r.data.facts.some((f) => f.actualH > 0) && r.data.facts.some((f) => f.plannedH > 0)) setBasis("planned");
      } else setErr(r.error ?? "Villa");
      setBusy(false);
    }).catch(() => { if (!stop) { setErr("Villa"); setBusy(false); } });
    return () => { stop = true; };
  }, [from, to]);

  const todayISO = iso(new Date());
  const view = useMemo(() => {
    if (!data) return null;
    // Raun nær aðeins til dagsins í dag — annars telst áætluð velta framtíðar á móti 0 kr launum.
    const upto = basis === "actual" && data.to > todayISO ? todayISO : data.to;
    const locName = new Map(data.locations.map((l) => [l.id, l.name]));
    const empName = new Map(data.employees.map((e) => [e.id, e.name]));
    const inLoc = (l: string) => !locs.length || locs.includes(l);
    const inDept = (d: string) => !depts.length || depts.includes(d);
    const facts = data.facts.filter((f) => f.date <= upto && inLoc(f.loc) && inDept(f.dept));
    const rev = data.revenue.filter((r) => r.date <= upto && inLoc(r.loc));
    const revenue = rev.reduce((a, r) => a + r.amount, 0);
    const estDays = new Set(rev.filter((r) => r.estimated).map((r) => r.date)).size;
    const sum = (k: "plannedCost" | "actualCost" | "plannedH" | "actualH") => facts.reduce((a, f) => a + f[k], 0);
    const tot = { plannedCost: sum("plannedCost"), actualCost: sum("actualCost"), plannedH: sum("plannedH"), actualH: sum("actualH") };
    const cost = basis === "actual" ? tot.actualCost : tot.plannedCost;
    const hours = basis === "actual" ? tot.actualH : tot.plannedH;
    const pct = revenue > 0 && cost > 0 ? (cost / revenue) * 100 : null;
    const target = data.target;
    const totalRevenueForShare = revenue;

    const mk = (key: string, label: string, order: number, revenue: number | null, a: { plannedCost: number; actualCost: number; plannedH: number; actualH: number }): Row => {
      const c = basis === "actual" ? a.actualCost : a.plannedCost;
      const h = basis === "actual" ? a.actualH : a.plannedH;
      // Deild/starfsmaður: velta er ekki skráð á þau → hlutur af veltu valinna staða.
      const base = revenue ?? (split === "dept" || split === "emp" ? (totalRevenueForShare || null) : null);
      return {
        key, label, order, revenue, ...a, cost: c, hours: h,
        pct: base && c > 0 ? (c / base) * 100 : null,
        gap: revenue != null && revenue > 0 ? c - (revenue * target) / 100 : null,
        perHour: revenue != null && h > 0 ? revenue / h : null,
      };
    };
    const acc = new Map<string, { label: string; order: number; plannedCost: number; actualCost: number; plannedH: number; actualH: number }>();
    const bump = (key: string, label: string, order: number, x: { plannedCost: number; actualCost: number; plannedH: number; actualH: number }) => {
      const a = acc.get(key) ?? acc.set(key, { label, order, plannedCost: 0, actualCost: 0, plannedH: 0, actualH: 0 }).get(key)!;
      a.plannedCost += x.plannedCost; a.actualCost += x.actualCost; a.plannedH += x.plannedH; a.actualH += x.actualH;
    };
    const dowOf = (d: string) => new Date(d + "T12:00:00").getDay();
    if (split === "hour") {
      for (const h of data.hours) if (inLoc(h.loc) && inDept(h.dept)) bump(String(h.hour), `${pad(h.hour)}:00`, h.hour, h);
    } else {
      for (const f of facts) {
        if (split === "loc") bump(f.loc, locName.get(f.loc) || t("Án staðar"), 0, f);
        else if (split === "dept") bump(f.dept || "—", f.dept || t("Án deildar"), 0, f);
        else if (split === "emp") bump(f.emp, empName.get(f.emp) ?? "?", 0, f);
        else if (split === "day") bump(f.date, f.date, 0, f);
        else { const w = dowOf(f.date); bump(String(w), t(DOW[w]), DOW_ORDER.indexOf(w), f); }
      }
      // Staðir/dagar með veltu en engin laun eiga líka heima í töflunni.
      if (split === "loc") for (const r of rev) if (!acc.has(r.loc)) bump(r.loc, locName.get(r.loc) || "?", 0, { plannedCost: 0, actualCost: 0, plannedH: 0, actualH: 0 });
      if (split === "day") for (const r of rev) if (!acc.has(r.date)) bump(r.date, r.date, 0, { plannedCost: 0, actualCost: 0, plannedH: 0, actualH: 0 });
    }
    const revBy = (key: string): number | null => {
      if (split === "loc") return rev.filter((r) => r.loc === key).reduce((a, r) => a + r.amount, 0);
      if (split === "day") return rev.filter((r) => r.date === key).reduce((a, r) => a + r.amount, 0);
      if (split === "dow") return rev.filter((r) => String(dowOf(r.date)) === key).reduce((a, r) => a + r.amount, 0);
      return null; // deild, starfsmaður, klukkustund: velta ekki skráð á þau (klukkustund kemur með kassakerfistengingu)
    };
    let rows = [...acc.entries()].map(([key, a]) => mk(key, a.label, a.order, revBy(key), a));
    if (split === "day") rows = rows.map((r) => { const [, m, d] = r.key.split("-"); return { ...r, label: `${t(DOW[dowOf(r.key)])} ${Number(d)}.${Number(m)}.` }; });
    const natural = split === "day" || split === "dow" || split === "hour";
    rows.sort((a, b) => (natural ? (split === "day" ? a.key.localeCompare(b.key) : a.order - b.order) : b.cost - a.cost));
    return { rows, revenue, estDays, cost, hours, pct, target, tot, upto, deptOptions: [...new Set(data.facts.filter((f) => inLoc(f.loc)).map((f) => f.dept).filter(Boolean))].sort() };
  }, [data, locs, depts, split, basis, todayISO, t]);

  const rows = useMemo(() => {
    if (!view) return [];
    if (!sort) return view.rows;
    return [...view.rows].sort((a, b) => {
      const x = a[sort.col], y = b[sort.col];
      if (typeof x === "string" && typeof y === "string") return x.localeCompare(y) * sort.dir;
      return (((x as number | null) ?? -Infinity) - ((y as number | null) ?? -Infinity)) * sort.dir;
    });
  }, [view, sort]);

  const shareMode = split === "dept" || split === "emp";
  const noRev = split === "hour";
  const cols: { k: keyof Row; label: string; num?: boolean }[] = [
    { k: "label", label: SPLITS.find((s) => s[0] === split)![1] },
    ...(shareMode || noRev ? [] : [{ k: "revenue" as const, label: "Velta", num: true }]),
    { k: "plannedCost", label: "Laun áætluð", num: true },
    { k: "actualCost", label: "Laun raun", num: true },
    ...(noRev ? [] : [{ k: "pct" as const, label: shareMode ? "% af veltu" : "Laun %", num: true }]),
    ...(shareMode || noRev ? [] : [{ k: "gap" as const, label: "Frávik frá markmiði", num: true }]),
    { k: "plannedH", label: "Tímar áætl.", num: true },
    { k: "actualH", label: "Tímar raun", num: true },
    ...(shareMode || noRev ? [] : [{ k: "perHour" as const, label: "Velta / klst", num: true }]),
  ];
  const cell = (r: Row, k: keyof Row): string => {
    const v = r[k];
    if (k === "label") return String(v);
    if (k === "pct") return pctTxt(v as number | null);
    if (k === "plannedH" || k === "actualH") return dec1(v as number);
    if (v == null) return "—";
    if (k === "gap") return `${(v as number) > 0 ? "+" : "−"}${kr(Math.abs(v as number))}`;
    return kr(v as number);
  };
  const raw = (r: Row, k: keyof Row): string | number => {
    const v = r[k];
    if (k === "label") return String(v);
    if (v == null) return "";
    return k === "pct" || k === "plannedH" || k === "actualH" ? Math.round((v as number) * 10) / 10 : Math.round(v as number);
  };

  async function exportAs(kind: "xlsx" | "pdf") {
    if (!view || !data) return;
    const { exportTableXlsx, exportTablePdf } = await import("@/lib/export-report");
    const where = [locs.length ? data.locations.filter((l) => locs.includes(l.id)).map((l) => l.name).join(", ") : t("Allir staðir"), depts.length ? depts.join(", ") : ""].filter(Boolean).join(" · ");
    const d = {
      title: `Laun % af veltu — ${t("eftir")} ${t(SPLITS.find((s) => s[0] === split)![1]).toLowerCase()} (${basis === "actual" ? t("raun") : t("áætlun")})`,
      company: where, from: data.from, to: view.upto,
      columns: cols.map((c) => t(c.label)),
      numeric: cols.map((c, i) => (c.num ? i : -1)).filter((i) => i >= 0),
      rows: [...rows.map((r) => cols.map((c) => raw(r, c.k))), cols.map((c, i) => (i === 0 ? t("Samtals") : c.k === "plannedCost" ? Math.round(view.tot.plannedCost) : c.k === "actualCost" ? Math.round(view.tot.actualCost) : c.k === "plannedH" ? Math.round(view.tot.plannedH * 10) / 10 : c.k === "actualH" ? Math.round(view.tot.actualH * 10) / 10 : c.k === "revenue" ? Math.round(view.revenue) : c.k === "pct" && view.pct != null ? Math.round(view.pct * 10) / 10 : ""))],
    };
    try { if (kind === "xlsx") await exportTableXlsx(d); else await exportTablePdf(d); } catch { toast(t("Villa")); }
  }

  const over = view && view.pct != null ? view.pct - view.target : null;
  const gapKr = view && view.revenue > 0 ? view.cost - (view.revenue * view.target) / 100 : null;
  const maxPct = Math.max(view?.target ?? 30, ...rows.map((r) => r.pct ?? 0)) * 1.1;

  return (
    <section className="db2-card" style={{ marginBottom: 20 }}>
      <div className="db2-ch sr-head" style={{ flexWrap: "wrap", gap: 10 }}>
        <div><div className="db2-ct">{t("Laun % af veltu")}</div><div className="db2-cs">{t("veldu tímabil, staði og deildir — skiptu eftir því sem þú vilt sjá")}</div></div>
        <div className="db2-seg" role="tablist">
          {PERIODS.map(([p, label]) => <button key={p} role="tab" aria-selected={period === p} className={period === p ? "on" : ""} onClick={() => setPeriod(p)}>{lang === "en" ? PERIOD_EN[p] : label}</button>)}
        </div>
      </div>
      <div style={{ padding: "0 24px 20px" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", marginBottom: 14 }}>
          {period === "custom" && (
            <>
              <input type="date" className="inp" value={custom[0]} max={custom[1]} onChange={(e) => e.target.value && setCustom([e.target.value, custom[1]])} aria-label={t("Frá")} />
              <span className="muted">–</span>
              <input type="date" className="inp" value={custom[1]} min={custom[0]} onChange={(e) => e.target.value && setCustom([custom[0], e.target.value])} aria-label={t("Til")} />
            </>
          )}
          {data && data.locations.length > 1 && (
            <DeptPicker values={locs.map((id) => data.locations.find((l) => l.id === id)?.name ?? "").filter(Boolean)}
              onChange={(names) => { const ids = data.locations.filter((l) => names.includes(l.name)).map((l) => l.id); setLocs(ids); setDepts([]); }}
              options={data.locations.map((l) => l.name)} allLabel="Allir staðir" unit="staðir" colors={{}} translate={false} />
          )}
          {view && view.deptOptions.length > 1 && (
            <DeptPicker values={depts} onChange={setDepts} options={view.deptOptions} translate={false} />
          )}
          <span className="muted" style={{ fontSize: 13, marginLeft: 6 }}>{t("Skipta eftir")}</span>
          <div className="db2-seg" role="tablist">
            {SPLITS.map(([s, label]) => <button key={s} role="tab" aria-selected={split === s} className={split === s ? "on" : ""} onClick={() => { setSplit(s); setSort(null); }}>{t(label)}</button>)}
          </div>
          <div className="db2-seg" role="tablist" style={{ marginLeft: "auto" }}>
            <button role="tab" aria-selected={basis === "actual"} className={basis === "actual" ? "on" : ""} onClick={() => setBasis("actual")} title={t("Stimplaðir tímar til dagsins í dag")}>{t("Raun")}</button>
            <button role="tab" aria-selected={basis === "planned"} className={basis === "planned" ? "on" : ""} onClick={() => setBasis("planned")} title={t("Vaktaplanið allt tímabilið")}>{t("Áætlun")}</button>
          </div>
        </div>

        {busy && !data && <div className="db2-muted">{t("Sæki…")}</div>}
        {err && <div className="db2-muted">{t(err)}</div>}
        {view && (
          <div style={{ opacity: busy ? 0.6 : 1 }}>
            <div className="wo-tiles" style={{ marginBottom: 14 }}>
              <div><span>{t("Velta")}</span><b>{view.revenue > 0 ? kr(view.revenue) : "—"}</b>{view.estDays > 0 && <span>{t("áætluð fyrir")} {view.estDays} {t("daga án skráðrar veltu")}</span>}</div>
              <div><span>{basis === "actual" ? t("Launakostnaður (raun)") : t("Launakostnaður (áætlun)")}</span><b>{kr(view.cost)}</b><span>{dec1(view.hours)} {t("klst")}{view.revenue > 0 && view.hours > 0 ? ` · ${kr(view.revenue / view.hours)} ${t("velta á klst")}` : ""}</span></div>
              <div><span>{t("Laun % af veltu")}</span><b style={{ color: over == null ? undefined : over <= 0 ? "var(--good)" : over <= 3 ? "var(--warn)" : "var(--bad)" }}>{pctTxt(view.pct)}</b><span>{t("markmið")} {dec1(view.target)} %</span></div>
              <div><span>{t("Frávik frá markmiði")}</span><b style={{ color: gapKr == null ? undefined : gapKr <= 0 ? "var(--good)" : "var(--bad)" }}>{gapKr == null ? "—" : `${gapKr > 0 ? "+" : "−"}${kr(Math.abs(gapKr))}`}</b><span>{gapKr == null ? t("vantar veltu") : gapKr > 0 ? t("yfir launaáætlun") : t("undir launaáætlun")}</span></div>
            </div>

            <div className="db2-tblwrap" style={{ marginTop: 12 }}>
              <table>
                <thead>
                  <tr>
                    {cols.map((c) => (
                      <th key={c.k} className={c.num ? "r" : undefined} style={{ cursor: "pointer", whiteSpace: "nowrap" }}
                        onClick={() => setSort((s) => (s && s.col === c.k ? { col: c.k, dir: (s.dir * -1) as 1 | -1 } : { col: c.k, dir: c.num ? -1 : 1 }))}>
                        {t(c.label)}{sort?.col === c.k ? (sort.dir === 1 ? " ↑" : " ↓") : ""}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r) => (
                    <tr key={r.key}>
                      {cols.map((c) => (
                        <td key={c.k} className={c.num ? "r" : undefined}
                          style={c.k === "pct" && r.pct != null && !shareMode && r.pct > view.target ? { color: "var(--bad)", fontWeight: 650 }
                            : c.k === "gap" && r.gap != null && r.gap > 0 ? { color: "var(--bad)" } : undefined}>
                          {c.k === "pct" && r.pct != null ? (
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
                              <span aria-hidden style={{ position: "relative", width: 64, height: 6, borderRadius: 3, background: "var(--line)", overflow: "hidden" }}>
                                <i style={{ position: "absolute", inset: 0, width: `${Math.min(100, (r.pct / maxPct) * 100)}%`, borderRadius: 3, background: shareMode ? "var(--brand)" : r.pct <= view.target ? "var(--good)" : r.pct <= view.target + 3 ? "var(--warn)" : "var(--bad)" }} />
                              </span>
                              {cell(r, c.k)}
                            </span>
                          ) : cell(r, c.k)}
                        </td>
                      ))}
                    </tr>
                  ))}
                  {!rows.length && <tr><td colSpan={cols.length} className="muted" style={{ textAlign: "center", padding: 14 }}>{t("Engar vaktir eða stimplanir á tímabilinu")}</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button className="btn ghost sm" onClick={() => exportAs("xlsx")}>{t("Sækja Excel")}</button>
              <button className="btn ghost sm" onClick={() => exportAs("pdf")}>{t("Sækja PDF")}</button>
              <span className="muted" style={{ fontSize: 12 }}>
                {shareMode ? t("Velta er skráð á staði, ekki deildir eða fólk — hlutfallið er af veltu valinna staða.")
                  : noRev ? t("Laun % eftir klukkustund krefst veltu eftir klukkustund úr kassakerfi.")
                    : basis === "actual" ? t("Raun: stimplaðir tímar og velta til dagsins í dag.") : t("Áætlun: vaktaplanið allt tímabilið á móti veltu og veltuspá.")}
              </span>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
