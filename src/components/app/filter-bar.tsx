"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang";
import { PeriodPicker, presetRange, type PresetKey } from "./period-picker";

type Stored = { preset: PresetKey; from: string; to: string };
const ISO_RE = /^\d{4}-\d{2}-\d{2}$/;
const storageId = (key: string) => `vakto:period:${key}`;

function readStored(key: string): Stored | null {
  try {
    const raw = window.localStorage.getItem(storageId(key));
    if (!raw) return null;
    const v = JSON.parse(raw) as Partial<Stored>;
    if (!v.preset || !(v.preset in PRESET_TO_PERIOD)) return null;
    // Relative presets ("last month", "last 7 days") are re-derived from today so
    // they stay correct across days; only a custom pick keeps its exact dates.
    if (v.preset !== "custom") return { preset: v.preset, ...presetRange(v.preset) };
    if (!ISO_RE.test(v.from ?? "") || !ISO_RE.test(v.to ?? "") || v.from! > v.to!) return null;
    return { preset: "custom", from: v.from!, to: v.to! };
  } catch { return null; }
}
function writeStored(key: string, v: Stored) {
  try { window.localStorage.setItem(storageId(key), JSON.stringify(v)); } catch { /* private mode etc. */ }
}

// Map a picker preset onto the screen's Period model (fallback: Sérsniðið).
const PRESET_TO_PERIOD: Record<PresetKey, Period> = {
  today: "Dagur", yesterday: "Dagur", "7d": "Vika", "30d": "Mánuður",
  thisMonth: "Mánuður", lastMonth: "Mánuður", thisYear: "Ár", lastYear: "Ár",
  all: "Ár", custom: "Sérsniðið",
};

export type Period = "Dagur" | "Vika" | "Mánuður" | "Ársfj." | "Ár" | "Sérsniðið";

export type SelectFilter = { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] };
/** Fjölval (t.d. deildir): tómt = allt. */
export type MultiFilter = { values: string[]; onChange: (v: string[]) => void; options: string[]; allLabel: string; unit: string };

function MultiSelect({ f }: { f: MultiFilter }) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const vs = f.values;
  return (
    <div style={{ position: "relative" }}>
      <button type="button" className="badge" aria-expanded={open} onClick={() => setOpen((v) => !v)}
        style={{ border: "1px solid var(--line)", padding: "7px 11px", cursor: "pointer", background: vs.length ? "var(--brand-soft)" : undefined, color: vs.length ? "var(--brand)" : undefined }}>
        {vs.length === 0 ? t(f.allLabel) : vs.length <= 2 ? vs.map((v) => t(v)).join(" + ") : `${vs.length} ${t(f.unit)}`} ▾
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setOpen(false)} />
          <div className="tmenu show" style={{ position: "absolute", left: 0, top: "calc(100% + 6px)", right: "auto", minWidth: 220, maxHeight: 360, overflowY: "auto" }}>
            <div className="mi" onClick={() => { f.onChange([]); setOpen(false); }} style={{ fontWeight: vs.length === 0 ? 700 : undefined }}>{t(f.allLabel)}</div>
            <div className="sep" />
            {f.options.map((o) => {
              const on = vs.includes(o);
              return (
                <label className="mi" key={o} style={{ display: "flex", alignItems: "center", gap: 9, cursor: "pointer" }}>
                  <input type="checkbox" checked={on} onChange={() => f.onChange(on ? vs.filter((x) => x !== o) : [...vs, o])} style={{ width: 15, height: 15, accentColor: "var(--brand)" }} />
                  {t(o)}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

/** Shared toolbar: period segments (+ custom range), search, dept/location
 * filters, and an optional comparison selector. Fully controlled. */
export function FilterBar({
  periods, period, onPeriod,
  from, to, onRange,
  search, onSearch, searchPlaceholder = "Leita að starfsmanni",
  filters = [], multi,
  compare, onCompare,
  rangeLabel, right,
  storageKey, defaultPreset = "7d",
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
  multi?: MultiFilter;
  compare?: string;
  onCompare?: (v: string) => void;
  rangeLabel?: string;
  right?: React.ReactNode;
  /** When set, the chosen period survives reloads and navigation (localStorage). */
  storageKey?: string;
  defaultPreset?: PresetKey;
}) {
  const { t } = useLang();
  const [preset, setPreset] = useState<PresetKey>(defaultPreset);

  function apply(a: string, b: string, k: PresetKey) {
    setPreset(k);
    const mapped = PRESET_TO_PERIOD[k];
    onPeriod?.(periods?.includes(mapped) ? mapped : "Sérsniðið");
    onRange?.(a, b);
    if (storageKey) writeStored(storageKey, { preset: k, from: a, to: b });
  }
  // Restore a remembered period once on mount (after hydration, so the server
  // and first client render still agree). Mount-only by design; localStorage
  // can only be read client-side, so the state update has to live in an effect.
  /* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  useEffect(() => {
    if (!storageKey) return;
    const st = readStored(storageKey);
    if (!st) return;
    if (st.from === from && st.to === to) { setPreset(st.preset); return; }
    apply(st.from, st.to, st.preset);
  }, [storageKey]);
  /* eslint-enable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
  return (
    <>
      <div className="stoolbar">
        {periods && period && onPeriod && onRange && (
          <PeriodPicker
            from={from ?? ""} to={to ?? ""} activePreset={preset}
            onApply={apply}
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
        {multi && multi.options.length > 0 && <MultiSelect f={multi} />}
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
