"use client";

import { useLang } from "@/components/app/lang";
import { dec1 } from "@/lib/format";
import type { WeekdayStat } from "./staffing.server";

/** Weekday staffing pattern — planned vs actual hours per weekday (line-ish bars),
 * flagging days that are consistently over/under-staffed with a recommendation. */
export function StaffingCard({ rows, live, weeks }: { rows: WeekdayStat[]; live: boolean; weeks: number }) {
  const { t } = useLang();
  const max = Math.max(1, ...rows.map((r) => Math.max(r.planned, r.actual))) * 1.15;
  const over = rows.filter((r) => r.rec === "more");
  const under = rows.filter((r) => r.rec === "fewer");
  const short = (label: string) => t(label).slice(0, 3);

  return (
    <div className="card" style={{ marginTop: 20 }}>
      <div className="ch">
        <div><div className="ct">{t("Mönnun eftir vikudögum")}</div><div className="cs">{t("meðal-vika")}{live ? ` · ${weeks} ${t("vikur")}` : ` · ${t("sýnidæmi")}`}</div></div>
        <div style={{ display: "flex", gap: 14, fontSize: 12, color: "var(--ink2)" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--teal)" }} />{t("Áætlað")}</span>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}><i style={{ width: 10, height: 10, borderRadius: 3, background: "var(--brand)" }} />{t("Raun")}</span>
        </div>
      </div>
      <div className="cb">
        <div className="sbars" style={{ height: 180 }}>
          {rows.map((r) => {
            const tip = `${t(r.label)} · ${t("Áætlað")} ${dec1(r.planned)} · ${t("Raun")} ${dec1(r.actual)} (${r.deviation >= 0 ? "+" : ""}${dec1(r.deviation)})`;
            const actualColor = r.rec === "more" ? "var(--bad)" : r.rec === "fewer" ? "var(--warn)" : "var(--brand)";
            return (
              <div className="col" key={r.wd} title={tip}>
                <div style={{ display: "flex", gap: 3, alignItems: "flex-end", height: "100%", width: "100%", justifyContent: "center" }}>
                  <div style={{ width: "34%", height: `${Math.round((r.planned / max) * 100)}%`, background: "var(--teal)", borderRadius: "5px 5px 2px 2px", minHeight: r.planned > 0 ? 2 : 0 }} />
                  <div style={{ width: "34%", height: `${Math.round((r.actual / max) * 100)}%`, background: actualColor, borderRadius: "5px 5px 2px 2px", minHeight: r.actual > 0 ? 2 : 0 }} />
                </div>
                <small>{short(r.label)}</small>
              </div>
            );
          })}
        </div>
      </div>
      <div className="cb tbl" style={{ borderTop: "1px solid var(--line2)", paddingTop: 8 }}>
        <table>
          <thead><tr><th>{t("Vikudagur")}</th><th className="r">{t("Áætl. klst")}</th><th className="r">{t("Raun klst")}</th><th className="r">{t("Frávik")}</th><th>{t("Ábending")}</th></tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.wd}>
                <td>{t(r.label)}</td>
                <td className="r">{dec1(r.planned)}</td>
                <td className="r">{dec1(r.actual)}</td>
                <td className="r" style={{ color: r.deviation > 0.05 ? "var(--bad)" : r.deviation < -0.05 ? "var(--good)" : undefined }}>{r.deviation > 0 ? "+" : ""}{dec1(r.deviation)}</td>
                <td>
                  {r.rec === "more" ? <span className="pill" style={{ background: "var(--bad-soft)", color: "var(--bad)" }}>{t("Bæta við fólki")}</span>
                    : r.rec === "fewer" ? <span className="pill" style={{ background: "var(--warn-soft)", color: "var(--warn)" }}>{t("Of mörg — fækka")}</span>
                      : <span className="pill" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("Í jafnvægi")}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="cb" style={{ borderTop: "1px solid var(--line2)" }}>
        <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5 }}>
          {over.length > 0 && <>{t("Álagstoppar — bættu við fólki")}: <b>{over.map((r) => short(r.label)).join(", ")}</b>. </>}
          {under.length > 0 && <>{t("Rólegir dagar — íhugaðu færri")}: <b>{under.map((r) => short(r.label)).join(", ")}</b>.</>}
          {over.length === 0 && under.length === 0 && t("Mönnun er í góðu jafnvægi yfir vikuna.")}
        </p>
      </div>
    </div>
  );
}
