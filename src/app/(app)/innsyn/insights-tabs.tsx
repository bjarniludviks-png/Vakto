"use client";

// Innsýn — the merged analytics surface. One place to answer "how are we
// doing": Rekstur (revenue/margin/labor%, owner only) and Tímar & mæting
// (planned vs actual, time bank, exports). Each tab reuses the existing
// screen in embedded mode so nothing is duplicated.

import { useState } from "react";
import { useLang } from "@/components/app/lang";
import PerformanceScreen from "../frammistada/performance-screen";
import ReportsScreen from "../skyrslur/reports-screen";
import type { PerfView } from "@/lib/analytics.server";
import type { StaffingPattern } from "../frammistada/staffing.server";
import type { PerfHistory } from "../frammistada/perf.server";
import type { Insight } from "../frammistada/insights.server";
import type { AttRow } from "@/lib/analytics.server";
import type { TimeBank } from "../skyrslur/timebank.server";
import type { Absence } from "@/lib/absence.server";
import { AbsenceCard } from "./absence-card";

export type InnsynProps = {
  owner: boolean;
  initialTab: "rekstur" | "timar";
  empty: boolean;
  perf: { live: boolean; perf?: PerfView; staffing?: StaffingPattern; history?: PerfHistory; insights: Insight[] };
  reports: { live: boolean; rows: AttRow[]; timebank?: TimeBank };
  absence: Absence;
};

export function InsightsTabs({ owner, initialTab, empty, perf, reports, absence }: InnsynProps) {
  const { t } = useLang();
  const [tab, setTab] = useState<"rekstur" | "timar">(owner ? initialTab : "timar");
  const tabs: ["rekstur" | "timar", string][] = owner
    ? [["rekstur", "Rekstur & framlegð"], ["timar", "Tímar & mæting"]]
    : [["timar", "Tímar & mæting"]];
  return (
    <div className="db2x">
      <div className="db2-top">
        <div><h1>{t("Innsýn")}</h1><div className="db2-sub">{t("Greiningar, skýrslur og AI á einum stað")}</div></div>
        {tabs.length > 1 && (
          <div className="db2-seg" role="tablist">
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={tab === id} className={tab === id ? "on" : ""} onClick={() => setTab(id)}>{t(label)}</button>
            ))}
          </div>
        )}
      </div>
      {tab === "rekstur" && owner
        ? <PerformanceScreen embedded empty={empty} live={perf.live} perf={perf.perf} staffing={perf.staffing} history={perf.history} insights={perf.insights} />
        : <><ReportsScreen embedded empty={empty} live={reports.live} rows={reports.rows} timebank={reports.timebank} /><AbsenceCard data={absence} /></>}
    </div>
  );
}
