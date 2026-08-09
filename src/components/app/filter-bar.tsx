"use client";

import { useState } from "react";
import { useLang } from "./lang";
import { PeriodPicker, type PresetKey } from "./period-picker";

// Map a picker preset onto the screen's Period model (fallback: Sérsniðið).
const PRESET_TO_PERIOD: Record<PresetKey, Period> = {
  today: "Dagur", yesterday: "Dagur", "7d": "Vika", "30d": "Mánuður",
  thisMonth: "Mánuður", lastMonth: "Mánuður", thisYear: "Ár", lastYear: "Ár",
  all: "Ár", custom: "Sérsniðið",
};

export type Period = "Dagur" | "Vika" | "Mánuður" | "Ársfj." | "Ár" | "Sérsniðið";

export type SelectFilter = { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] };

/** Shared toolbar: period segments (+ custom range), search, dept/location
 * filters, and an optional comparison selector. Fully controlled. */
export function FilterBar({
  periods, period, onPeriod,
  from, to, onRange,
  search, onSearch, searchPlaceholder = "Leita að starfsmanni",
  filters = [],
  compare, onCompare,
  rangeLabel, right,
}: {
  periods?: Period[];
  period?: Period;
  onPeriod?: (p: Period) => void;
  from?: string;
  to?: string;
  onRange?: (from: string, to: string) => void;
  search?: string;
  onSearch?: (v: string) => void;
  searchPlaceholder?: string;
  filters?: SelectFilter[];
  compare?: string;
  onCompare?: (v: string) => void;
  rangeLabel?: string;
  right?: React.ReactNode;
}) {
  const { t } = useLang();
  const [preset, setPreset] = useState<PresetKey>("7d");
  return (
    <>
      <div className="stoolbar">
        {periods && period && onPeriod && onRange && (
          <PeriodPicker
            from={from ?? ""} to={to ?? ""} activePreset={preset}
            onApply={(a, b, k) => {
              setPreset(k);
              const mapped = PRESET_TO_PERIOD[k];
              onPeriod(periods.includes(mapped) ? mapped : "Sérsniðið");
              onRange(a, b);
            }}
          />
        )}
        {periods && period && onPeriod && !onRange && (
          <div className="seg">
            {periods.map((p) => (
              <button key={p} className={period === p ? "on" : ""} onClick={() => onPeriod(p)}>{t(p)}</button>
            ))}
          </div>
        )}
        {onSearch !== undefined && (
          <div className="srchbox">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><circle cx="11" cy="11" r="7" /><path d="m20 20-3.4-3.4" /></svg>
            <input placeholder={t(searchPlaceholder)} value={search ?? ""} onChange={(e) => onSearch(e.target.value)} />
          </div>
        )}
        {filters.map((flt, i) => (
          <select key={i} className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }} value={flt.value} onChange={(e) => flt.onChange(e.target.value)}>
            {flt.options.map((o) => <option key={o.value} value={o.value}>{t(o.label)}</option>)}
          </select>
        ))}
        {compare !== undefined && onCompare && (
          <select className="badge" style={{ border: "1px solid var(--line)", padding: "7px 11px" }} value={compare} onChange={(e) => onCompare(e.target.value)} title={t("Bera saman við")}>
            <option value="none">{t("Enginn samanburður")}</option>
            <option value="prev">{t("Fyrra tímabil")}</option>
            <option value="year">{t("Sama tímabil í fyrra")}</option>
          </select>
        )}
        <div className="sp" style={{ flex: 1 }} />
        {rangeLabel && <span className="badge" style={{ background: "var(--brand-soft)", color: "var(--brand)" }}>{rangeLabel}</span>}
        {right}
      </div>

    </>
  );
}
