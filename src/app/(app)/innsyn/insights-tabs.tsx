"use client";

// Innsýn — the merged analytics surface. One place to answer "how are we
// doing": Rekstur (revenue/margin/labor%, owner only) and Tímar & mæting
// (planned vs actual, time bank, exports). Each tab reuses the existing
// screen in embedded mode so nothing is duplicated.

import { useState } from "react";
import { PageHeader } from "@/components/app/page-header";
import { useLang } from "@/components/app/lang";
import PerformanceScreen from "../frammistada/performance-screen";
import ReportsScreen from "../skyrslur/reports-screen";
import type { PerfView } from "@/lib/analytics.server";
import type { StaffingPattern } from "../frammistada/staffing.server";
import type { PerfHistory } from "../frammistada/perf.server";
import type { Insight } from "../frammistada/insights.server";
import type { AttRow } from "@/lib/analytics.server";
import type { TimeBank } from "../skyrslur/timebank.server";

export type InnsynProps = {
  owner: boolean;
  initialTab: "rekstur" | "timar";
  empty: boolean;
  perf: { live: boolean; perf?: PerfView; staffing?: StaffingPattern; history?: PerfHistory; insights: Insight[] };
  reports: { live: boolean; rows: AttRow[]; timebank?: TimeBank };
};

export function InsightsTabs({ owner, initialTab, empty, perf, reports }: InnsynProps) {
  const { t } = useLang();
  const [tab, setTab] = useState<"rekstur" | "timar">(owner ? initialTab : "timar");
  const tabs: ["rekstur" | "timar", string][] = owner
    ? [["rekstur", "Rekstur & framlegð"], ["timar", "Tímar & mæting"]]
    : [["timar", "Tímar & mæting"]];
  return (
    <>
      <PageHeader title="Innsýn" subtitle="Greiningar, skýrslur og AI á einum stað" />
      {tabs.length > 1 && (
        <div className="settabs" style={{ marginBottom: 18 }}>
          {tabs.map(([id, label]) => (
            <button key={id} className={`etab2${tab === id ? " on" : ""}`} onClick={() => setTab(id)}>{t(label)}</button>
          ))}
        </div>
      )}
      {tab === "rekstur" && owner
        ? <PerformanceScreen embedded empty={empty} live={perf.live} perf={perf.perf} staffing={perf.staffing} history={perf.history} insights={perf.insights} />
        : <ReportsScreen embedded empty={empty} live={reports.live} rows={reports.rows} timebank={reports.timebank} />}
    </>
  );
}
