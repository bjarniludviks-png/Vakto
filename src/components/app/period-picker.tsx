"use client";

// Payday-style period picker: one button showing the active range, opening a
// panel with preset shortcuts on the left and a dual-month calendar on the
// right. Confirm with Staðfesta. Used everywhere a period can be chosen.

import { useEffect, useRef, useState } from "react";
import { useLang } from "./lang";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (s: string) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "");

export type PresetKey = "today" | "yesterday" | "7d" | "30d" | "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "all" | "custom";

export const PRESET_LABELS: [PresetKey, string][] = [
  ["today", "Í dag"], ["yesterday", "Í gær"],
  ["7d", "Síðustu 7 daga"], ["30d", "Síðustu 30 daga"],
  ["thisMonth", "Þennan mánuð"], ["lastMonth", "Síðasta mánuð"],
  ["thisYear", "Þetta ár"], ["lastYear", "Síðasta ár"],
  ["all", "Frá upphafi"], ["custom", "Velja úr dagatali"],
];

export function presetRange(k: PresetKey): { from: string; to: string } {
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const d = (n: number) => { const x = new Date(now); x.setDate(x.getDate() + n); return x; };
  switch (k) {
    case "today": return { from: iso(now), to: iso(now) };
    case "yesterday": return { from: iso(d(-1)), to: iso(d(-1)) };
    case "7d": return { from: iso(d(-6)), to: iso(now) };
    case "30d": return { from: iso(d(-29)), to: iso(now) };
    case "thisMonth": return { from: iso(new Date(now.getFullYear(), now.getMonth(), 1)), to: iso(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
    case "lastMonth": return { from: iso(new Date(now.getFullYear(), now.getMonth() - 1, 1)), to: iso(new Date(now.getFullYear(), now.getMonth(), 0)) };
    case "thisYear": return { from: iso(new Date(now.getFullYear(), 0, 1)), to: iso(new Date(now.getFullYear(), 11, 31)) };
    case "lastYear": return { from: iso(new Date(now.getFullYear() - 1, 0, 1)), to: iso(new Date(now.getFullYear() - 1, 11, 31)) };
    case "all": return { from: "2020-01-01", to: iso(now) };
    default: return { from: iso(d(-6)), to: iso(now) };
  }
}

function MonthGrid({ base, selFrom, selTo, onPick }: { base: Date; selFrom: string; selTo: string; onPick: (isoDate: string) => void }) {
  const { t } = useLang();
  const y = base.getFullYear(), m = base.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // Mon-first
  const MON = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
  const HD = ["Má", "Þr", "Mi", "Fi", "Fö", "La", "Su"];
  const todayISO = iso(new Date());
  return (
    <div className="pp-month">
      <div className="pp-mtitle">{t(MON[m])} {y}</div>
      <div className="pp-grid">
        {HD.map((h) => <span className="hd" key={h}>{h}</span>)}
        {Array.from({ length: lead }, (_, i) => <span key={`l${i}`} />)}
        {Array.from({ length: days }, (_, i) => {
          const dIso = `${y}-${pad(m + 1)}-${pad(i + 1)}`;
          const inRange = selFrom && selTo && dIso >= selFrom && dIso <= selTo;
          const edge = dIso === selFrom || dIso === selTo;
          return (
            <button key={dIso}
              className={`pp-d${edge ? " edge" : inRange ? " in" : ""}${dIso === todayISO ? " tod" : ""}`}
              onClick={() => onPick(dIso)}>{i + 1}</button>
          );
        })}
      </div>
    </div>
  );
}

export function PeriodPicker({ from, to, activePreset, onApply, align = "left" }: {
  from: string; to: string;
  activePreset?: PresetKey;
  onApply: (from: string, to: string, preset: PresetKey) => void;
  align?: "left" | "right";
}) {
  const { t } = useLang();
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetKey>(activePreset ?? "7d");
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [page, setPage] = useState(() => { const d = from ? new Date(from) : new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  function openPanel() {
    setSelFrom(from); setSelTo(to);
    setPreset(activePreset ?? "custom");
    const d = from ? new Date(from) : new Date();
    setPage(new Date(d.getFullYear(), d.getMonth(), 1));
    setOpen(true);
  }
  function pickPreset(k: PresetKey) {
    setPreset(k);
    if (k === "custom") return;
    const r = presetRange(k);
    setSelFrom(r.from); setSelTo(r.to);
    const d = new Date(r.from);
    setPage(new Date(d.getFullYear(), d.getMonth(), 1));
  }
  function pickDay(dIso: string) {
    setPreset("custom");
    if (!selFrom || (selFrom && selTo && selFrom !== selTo)) { setSelFrom(dIso); setSelTo(dIso); return; }
    if (dIso < selFrom) { setSelTo(selFrom); setSelFrom(dIso); } else setSelTo(dIso);
  }
  const next = new Date(page.getFullYear(), page.getMonth() + 1, 1);

  return (
    <div className="pp" ref={ref}>
      <button className="pp-btn" onClick={() => (open ? setOpen(false) : openPanel())}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
        <span>{from && to ? `${nice(from)} – ${nice(to)}` : t("Velja tímabil")}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={`pp-panel ${align}`}>
          <div className="pp-presets">
            {PRESET_LABELS.map(([k, label]) => (
              <button key={k} className={preset === k ? "on" : ""} onClick={() => pickPreset(k)}>{t(label)}</button>
            ))}
            <div className="pp-actions">
              <button className="btn sm" onClick={() => { setOpen(false); onApply(selFrom, selTo, preset); }}>{t("Staðfesta")}</button>
              <button className="btn ghost sm" onClick={() => setOpen(false)}>{t("Hætta við")}</button>
            </div>
          </div>
          <div className="pp-cal">
            <div className="pp-range">
              <span>{nice(selFrom) || "—"}</span>
              <span className="pp-arrow">→</span>
              <span>{nice(selTo) || "—"}</span>
            </div>
            <div className="pp-months">
              <button className="pp-nav" onClick={() => setPage(new Date(page.getFullYear(), page.getMonth() - 1, 1))}>‹</button>
              <MonthGrid base={page} selFrom={selFrom} selTo={selTo} onPick={pickDay} />
              <MonthGrid base={next} selFrom={selFrom} selTo={selTo} onPick={pickDay} />
              <button className="pp-nav" onClick={() => setPage(new Date(page.getFullYear(), page.getMonth() + 1, 1))}>›</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
