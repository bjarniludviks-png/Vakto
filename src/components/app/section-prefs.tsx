"use client";

// Per-user customization of analytics surfaces: reorder sections and
// hide/show them. Preferences live in localStorage (per browser, per surface).
import { useEffect, useState } from "react";
import { useLang } from "./lang";

export type SectionDef = { id: string; title: string; node: React.ReactNode };
type Prefs = { order: string[]; hidden: string[] };

export function CustomSections({ storageKey, defs, customizing }: { storageKey: string; defs: SectionDef[]; customizing: boolean }) {
  const { t } = useLang();
  const [prefs, setPrefs] = useState<Prefs>({ order: [], hidden: [] });
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) { const p = JSON.parse(raw) as Prefs; setPrefs({ order: p.order ?? [], hidden: p.hidden ?? [] }); }
    } catch {}
  }, [storageKey]);
  const save = (p: Prefs) => { setPrefs(p); try { localStorage.setItem(storageKey, JSON.stringify(p)); } catch {} };
  const ids = defs.map((d) => d.id);
  const order = [...prefs.order.filter((i) => ids.includes(i)), ...ids.filter((i) => !prefs.order.includes(i))];
  const move = (id: string, dir: -1 | 1) => {
    const i = order.indexOf(id), j = i + dir;
    if (j < 0 || j >= order.length) return;
    const n = [...order];
    [n[i], n[j]] = [n[j], n[i]];
    save({ ...prefs, order: n });
  };
  const toggle = (id: string) =>
    save({ ...prefs, hidden: prefs.hidden.includes(id) ? prefs.hidden.filter((x) => x !== id) : [...prefs.hidden, id] });

  return (
    <>
      {order.map((id) => {
        const d = defs.find((x) => x.id === id);
        if (!d) return null;
        const hid = prefs.hidden.includes(id);
        if (!customizing && hid) return null;
        if (!customizing) return <div key={id}>{d.node}</div>;
        return (
          <div key={id} style={{ position: "relative", outline: "1.5px dashed var(--line)", outlineOffset: 4, borderRadius: 12, marginTop: 14, opacity: hid ? 0.45 : 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 2px 8px" }}>
              <b style={{ fontSize: 12.5, marginRight: "auto", color: "var(--ink2)" }}>{t(d.title)}</b>
              <button className="btn ghost sm" style={{ padding: "4px 9px" }} onClick={() => move(id, -1)} aria-label={t("Færa upp")}>↑</button>
              <button className="btn ghost sm" style={{ padding: "4px 9px" }} onClick={() => move(id, 1)} aria-label={t("Færa niður")}>↓</button>
              <button className="btn ghost sm" style={{ padding: "4px 9px" }} onClick={() => toggle(id)}>{hid ? t("Sýna") : t("Fela")}</button>
            </div>
            {d.node}
          </div>
        );
      })}
    </>
  );
}

/** The toolbar toggle for customize mode. */
export function CustomizeButton({ on, setOn }: { on: boolean; setOn: (v: boolean) => void }) {
  const { t } = useLang();
  return (
    <button className={`btn ${on ? "" : "ghost"} sm`} onClick={() => setOn(!on)}>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: 5 }}><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" /></svg>
      {on ? t("Lokið") : t("Sérsníða")}
    </button>
  );
}
