"use client";

// Veikindahlutfall — veikindatímar ÷ áætlaðir tímar per tímabil, þróun, deildir og starfsmenn.
// Sama veikindagrunnur og Fjarvistir & mæting (samþykktar veikindabeiðnir).

import { useState } from "react";
import Link from "next/link";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { dec1 } from "@/lib/format";
import { byDept, pctOf, SICK_DEFINITION, type SickRate } from "@/lib/sickrate";
import type { Gran } from "@/lib/periods";
import { fetchSickRate } from "./actions";

const GRANS: [Gran, string][] = [["period", "sr:period"], ["month", "Mánuður"], ["quarter", "Ársfj."], ["year", "Ár"]];
const pct = (n: number | null) => (n == null ? "—" : `${dec1(n)} %`);

export function SickRateCard({ initial }: { initial: SickRate }) {
  const { t } = useLang();
  const [data, setData] = useState(initial);
  const [sel, setSel] = useState<number>(Math.max(0, initial.buckets.length - 1));
  const [busy, setBusy] = useState(false);
  if (!initial.live) return null;

  async function pick(g: Gran) {
    if (g === data.gran || busy) return;
    setBusy(true);
    try {
      const d = await fetchSickRate(g);
      setData(d); setSel(Math.max(0, d.buckets.length - 1));
    } catch { toast(t("Villa"), "error"); }
    setBusy(false);
  }

  const b = data.buckets[sel];
  const prev = sel > 0 ? data.buckets[sel - 1] : null;
  const max = Math.max(1, ...data.buckets.map((x) => x.rate ?? 0));
  const depts = b ? byDept(b.rows) : [];
  const delta = b?.rate != null && prev?.rate != null ? Math.round((b.rate - prev.rate) * 10) / 10 : null;

  async function exportAs(kind: "xlsx" | "pdf") {
    if (!b) return;
    const { exportTableXlsx, exportTablePdf } = await import("@/lib/export-report");
    const rows: (string | number)[][] = [
      ...b.rows.map((r) => [r.name, r.dept, r.planned, r.sick, r.sickDays, r.occurrences, pctOf(r.sick, r.planned) ?? 0]),
      ["Samtals", "", b.planned, b.sick, b.sickDays, b.occurrences, b.rate ?? 0],
    ];
    const d = { title: `Veikindahlutfall ${b.label}`, company: data.company, from: b.from, to: b.to, columns: ["Starfsmaður", "Deild", "Áætlaðir tímar", "Veikindatímar", "Veikindadagar", "Tilvik", "Hlutfall %"], numeric: [2, 3, 4, 5, 6], rows };
    if (kind === "xlsx") await exportTableXlsx(d); else await exportTablePdf(d);
  }

  return (
    <section className="db2-card" style={{ marginTop: 20 }}>
      <div className="db2-ch sr-head">
        <div><div className="db2-ct">{t("Veikindahlutfall")}</div><div className="db2-cs">{t("veikindatímar ÷ áætlaðir vinnutímar")}</div></div>
        <div className="db2-seg" role="tablist" style={{ opacity: busy ? 0.6 : 1 }}>
          {GRANS.map(([g, label]) => <button key={g} role="tab" aria-selected={data.gran === g} className={data.gran === g ? "on" : ""} onClick={() => pick(g)}>{t(label)}</button>)}
        </div>
      </div>
      <div style={{ padding: "0 24px 20px" }}>
        {b ? (
          <>
            <div className="wo-tiles" style={{ marginBottom: 14 }}>
              <div><span>{t(b.label)}</span><b style={{ color: (b.rate ?? 0) >= 5 ? "var(--bad)" : (b.rate ?? 0) >= 3 ? "var(--warn)" : undefined }}>{pct(b.rate)}</b>{delta != null && <span>{delta > 0 ? "+" : delta < 0 ? "−" : "±"}{dec1(Math.abs(delta))} {t("prósentustig frá fyrra")}</span>}</div>
              <div><span>{t("Veikindatímar")}</span><b>{dec1(b.sick)} {t("klst")}</b><span>{t("af")} {dec1(b.planned)} {t("áætluðum")}</span></div>
              <div><span>{t("Veikindadagar")}</span><b>{b.sickDays}</b></div>
              <div><span>{t("Tilvik")}</span><b>{b.occurrences}</b></div>
            </div>
            <div className="sr-bars" role="list" aria-label={t("Þróun veikindahlutfalls")}>
              {data.buckets.map((x, i) => (
                <button key={x.key} role="listitem" className={`sr-bar${i === sel ? " on" : ""}`} onClick={() => setSel(i)} title={`${x.label}: ${pct(x.rate)}`}>
                  <em>{x.rate == null ? "" : dec1(x.rate)}</em>
                  <i style={{ height: `${Math.round(((x.rate ?? 0) / max) * 80)}px` }} />
                  <small>{x.short}</small>
                </button>
              ))}
            </div>

            <div className="db2-tblwrap" style={{ marginTop: 16 }}>
              <table>
                <thead><tr><th>{t("Deild")}</th><th className="r">{t("sr:people")}</th><th className="r">{t("Veikindadagar")}</th><th className="r">{t("Tilvik")}</th><th className="r">{t("Hlutfall")}</th></tr></thead>
                <tbody>
                  {depts.map((d) => <tr key={d.dept}><td>{t(d.dept)}</td><td className="r">{d.people}</td><td className="r">{d.sickDays}</td><td className="r">{d.occurrences}</td><td className="r">{pct(d.rate)}</td></tr>)}
                  {!depts.length && <tr><td colSpan={5} className="muted" style={{ textAlign: "center", padding: 14 }}>{t("Engar vaktir á tímabilinu")}</td></tr>}
                </tbody>
              </table>
            </div>
            <div className="db2-tblwrap" style={{ marginTop: 12 }}>
              <table>
                <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Veikindadagar")}</th><th className="r">{t("Tilvik")}</th><th className="r">{t("Veikindatímar")}</th><th className="r">{t("Hlutfall")}</th></tr></thead>
                <tbody>
                  {b.rows.filter((r) => r.sick > 0).map((r) => (
                    <tr key={r.id}><td><Link href={`/timaskraning/${r.id}`} style={{ color: "inherit" }}>{r.name}</Link></td><td>{t(r.dept)}</td><td className="r">{r.sickDays}</td><td className="r" style={r.occurrences >= 3 ? { color: "var(--warn)", fontWeight: 650 } : undefined}>{r.occurrences}</td><td className="r">{dec1(r.sick)}</td><td className="r">{pct(pctOf(r.sick, r.planned))}</td></tr>
                  ))}
                  {!b.rows.some((r) => r.sick > 0) && <tr><td colSpan={6} className="muted" style={{ textAlign: "center", padding: 14 }}>{t("Engin skráð veikindi á tímabilinu")}</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
              <button className="btn ghost sm" onClick={() => exportAs("xlsx")}>{t("Sækja Excel")}</button>
              <button className="btn ghost sm" onClick={() => exportAs("pdf")}>{t("Sækja PDF")}</button>
            </div>
          </>
        ) : <div className="db2-muted">{t("Engar vaktir á tímabilinu")}</div>}
        <p className="wo-def">{t(SICK_DEFINITION)}</p>
      </div>
    </section>
  );
}
