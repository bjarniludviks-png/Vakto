"use client";

import { Fragment, useState } from "react";
import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import type { TbRow } from "./timebank.server";

/** Accumulated time bank per employee — managers see who has hours banked (over
 * contract) or owed (under). Click a row to expand the monthly breakdown. */
export function TimeBankCard({ rows, live, monthLabels }: { rows: TbRow[]; live: boolean; monthLabels: string[] }) {
  const { t } = useLang();
  const [open, setOpen] = useState<string | null>(null);
  const bal = (n: number, big = false) => (
    <span style={{ color: n > 0.05 ? "var(--good)" : n < -0.05 ? "var(--bad)" : undefined, fontWeight: big ? 700 : 600, fontVariantNumeric: "tabular-nums" }}>
      {n > 0 ? "+" : ""}{dec1(n)}
    </span>
  );
  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch">
        <div><div className="ct">{t("Tímabanki starfsfólks")}</div><div className="cs">{t("uppsafnað +/− vs vinnuskylda")}{live ? "" : ` · ${t("sýnidæmi")}`}</div></div>
      </div>
      <div className="cb tbl" style={{ paddingTop: 8 }}>
        <table>
          <thead><tr><th>{t("Starfsmaður")}</th><th>{t("Deild")}</th><th className="r">{t("Staða banka")}</th><th></th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <Fragment key={r.id}>
                <tr className="rowlink" onClick={() => setOpen(open === r.id ? null : r.id)}>
                  <td><span className="who"><span className="avt" style={{ background: r.c }}>{r.av}</span> {r.name}</span></td>
                  <td>{t(r.dept)}</td>
                  <td className="r">{bal(r.balance, true)} <small style={{ color: "var(--ink3)" }}>{t("klst")}</small></td>
                  <td className="r" style={{ width: 24, color: "var(--ink3)" }}>{r.months.some((m) => m.actual > 0) ? (open === r.id ? "▾" : "▸") : ""}</td>
                </tr>
                {open === r.id && r.months.some((m) => m.actual > 0) && (
                  <tr>
                    <td colSpan={4} style={{ background: "var(--line2)", padding: "6px 14px" }}>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 14 }}>
                        {r.months.filter((m) => m.actual > 0).map((m, i) => (
                          <div key={i} style={{ fontSize: 12.5 }}>
                            <span className="muted">{m.label}:</span> {dec1(m.actual)}/{dec1(m.required)} → {bal(m.delta)}
                          </div>
                        ))}
                      </div>
                    </td>
                  </tr>
                )}
              </Fragment>
            ))}
            {!rows.length && <tr><td colSpan={4} className="muted" style={{ textAlign: "center", padding: 24 }}>{t("Engin gögn enn.")}</td></tr>}
          </tbody>
        </table>
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>{t("Jákvæð staða = unnið umfram vinnuskyldu (starfsmaður á inni). Neikvæð = undir skyldu (fyrirtæki á inni tíma). Uppsafnað yfir mánuðina sem gögn ná til.")}</p>
      </div>
    </div>
  );
}
