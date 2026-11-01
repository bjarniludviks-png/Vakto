"use client";

/**
 * Samræmdar stjórnir fyrir síu-raðir (Vaktaplan, Tímaskráning, Launakeyrslur, Skýrslur …):
 * sama hæð, radíus, letur og chevron alls staðar. Útlit í `.ctl*` klösum í app.css.
 */
import { useEffect, useState } from "react";
import { useLang } from "./lang";
import { getDepartmentColors } from "@/app/(app)/starfsfolk/actions";

export function Chevron() {
  return (
    <svg className="ctl-chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m6 9 6 6 6-6" />
    </svg>
  );
}

/** Native <select> í samræmdu útliti (chevron sem yfirlag svo dark-mode !important brjóti ekkert). */
export function CtlSelect({ value, onChange, children, title, className, ...rest }: Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "onChange"> & { onChange?: (v: string) => void }) {
  return (
    <span className={`ctl-sel${className ? ` ${className}` : ""}`}>
      <select className="ctl" value={value} title={title} onChange={onChange ? (e) => onChange(e.target.value) : undefined} {...rest}>{children}</select>
      <Chevron />
    </span>
  );
}

/**
 * Deildaval (fjölval): tómt = allar. Litaðir punktar eftir lit deildar; ef `colors` vantar
 * eru litirnir sóttir einu sinni.
 */
export function DeptPicker({
  values, onChange, options, allLabel = "Allar deildir", unit = "deildir", colors, translate = true,
}: {
  values: string[];
  onChange: (v: string[]) => void;
  options: string[];
  allLabel?: string;
  unit?: string;
  colors?: Record<string, string>;
  /** Þýða deildaheiti með t() (FilterBar gerði það áður). */
  translate?: boolean;
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [fetched, setFetched] = useState<Record<string, string>>({});
  useEffect(() => {
    if (colors) return;
    let live = true;
    getDepartmentColors().then((c) => { if (live) setFetched(c); }).catch(() => {});
    return () => { live = false; };
  }, [colors]);
  const col = colors ?? fetched;
  const name = (d: string) => (translate ? t(d) : d);
  const label = values.length === 0 ? t(allLabel) : values.length <= 2 ? values.map(name).join(" + ") : `${values.length} ${t(unit)}`;
  return (
    <div className="ctl-wrap">
      <button type="button" className={`ctl${values.length ? " on" : ""}`} aria-expanded={open} onClick={() => setOpen((v) => !v)}>
        <span className="ctl-lbl">{label}</span>
        <Chevron />
      </button>
      {open && (
        <>
          <div style={{ position: "fixed", inset: 0, zIndex: 55 }} onClick={() => setOpen(false)} />
          <div className="tmenu show ctl-menu">
            <div className="mi ctl-all" onClick={() => { onChange([]); setOpen(false); }}>{t(allLabel)}</div>
            <div className="sep" />
            {options.map((o) => {
              const on = values.includes(o);
              return (
                <label className="mi ctl-opt" key={o}>
                  <input type="checkbox" checked={on} onChange={() => onChange(on ? values.filter((x) => x !== o) : [...values, o])} />
                  {col[o] && <i className="ctl-dot" style={{ background: col[o] }} />}
                  {name(o)}
                </label>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
