"use client";

import { useEffect, useState } from "react";
import { useLang } from "@/components/app/lang";
import { toast } from "@/components/app/toast";
import { getMonthlyReportSetting, saveMonthlyReportSetting, sendMonthlyReportTestToMe, type MonthlyReportMode } from "./monthly-report-actions";

/** Mánaðarskýrsla í pósti — aðeins sýnt eiganda. Sækir eigin stöðu svo settings.server haldist óbreytt. */
export function MonthlyReportCard() {
  const { t } = useLang();
  const [mode, setMode] = useState<MonthlyReportMode | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    getMonthlyReportSetting().then((r) => { if (live && r.owner) setMode(r.mode); }).catch(() => {});
    return () => { live = false; };
  }, []);

  if (!mode) return null;

  async function change(v: MonthlyReportMode) {
    const before = mode;
    setMode(v);
    const r = await saveMonthlyReportSetting(v);
    if (!r.ok) setMode(before);
    toast(r.ok ? t("Vistað") : (r.error ?? "Villa"));
  }

  async function test() {
    setBusy(true);
    try {
      const r = await sendMonthlyReportTestToMe();
      toast(r.ok ? `${t("Prufa send á")} ${r.to}` : (r.error ?? "Villa"));
    } finally { setBusy(false); }
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch"><div><div className="ct">{t("Mánaðarskýrsla í pósti")}</div><div className="cs">{t("Laun % af veltu, yfirvinna, veikindi og opin mál síðasta mánaðar — send 1. hvers mánaðar")}</div></div></div>
      <div className="cb">
        <div className="statline"><span className="k">{t("Senda á")}</span>
          <select className="badge" style={{ border: "1px solid var(--line)", padding: "5px 9px", font: "inherit", fontSize: 12.5 }}
            value={mode} onChange={(e) => change(e.target.value as MonthlyReportMode)}>
            <option value="owners">{t("Eigendur")}</option>
            <option value="managers">{t("Eigendur og vaktstjóra")}</option>
            <option value="off">{t("Slökkt")}</option>
          </select>
        </div>
        <div style={{ paddingTop: 10 }}>
          <button className="btn ghost sm" disabled={busy} onClick={test}>{busy ? t("Augnablik…") : t("Senda prufu á mig")}</button>
        </div>
      </div>
    </div>
  );
}
