"use client";

// Icelandic-format, browser-independent date & time fields. Drop-in replacements
// for native <input type="date|time">: they emit the SAME values (date → ISO
// "YYYY-MM-DD", time → 24h "HH:MM"), so no backend/handler changes are needed —
// only the display differs (24h clock, DD.MM.ÁÁÁÁ dates, dark-mode friendly).

import { useEffect, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");

const FIELD: React.CSSProperties = {
  border: "1px solid var(--line)", borderRadius: 7, padding: "5px 9px",
  font: "inherit", fontSize: 13, background: "var(--panel)", color: "var(--ink)",
};

/* ---------------- time (24h HH:MM) ---------------- */
function normalizeTime(str: string): string {
  if (!str) return "";
  const digits = str.replace(/[^\d]/g, "");
  if (!digits) return "";
  let h: string, m: string;
  if (str.includes(":")) { const [a, b] = str.split(":"); h = a; m = b ?? ""; }
  else if (digits.length <= 2) { h = digits; m = ""; }
  else { h = digits.slice(0, digits.length - 2); m = digits.slice(-2); }
  const H = Math.min(23, Math.max(0, parseInt(h || "0", 10) || 0));
  const M = Math.min(59, Math.max(0, parseInt(m || "0", 10) || 0));
  return `${pad(H)}:${pad(M)}`;
}

export function TimeField({ value, defaultValue, name, onChange, style, placeholder = "--:--" }: {
  value?: string; defaultValue?: string; name?: string; onChange?: (v: string) => void;
  style?: React.CSSProperties; placeholder?: string;
}) {
  const controlled = value !== undefined;
  const [text, setText] = useState(value ?? defaultValue ?? "");
  useEffect(() => { if (controlled) setText(value ?? ""); }, [value, controlled]);

  function commit(next: string) {
    const norm = normalizeTime(next);
    setText(norm);
    onChange?.(norm);
  }
  function bump(delta: number) {
    const cur = normalizeTime(text || "00:00");
    const [h, m] = cur.split(":").map(Number);
    let total = (h * 60 + m + delta + 1440) % 1440;
    commit(`${pad(Math.floor(total / 60))}:${pad(total % 60)}`);
  }
  return (
    <input
      type="text" inputMode="numeric" name={name} value={text} placeholder={placeholder}
      onChange={(e) => { setText(e.target.value); if (!controlled) { /* wait for blur */ } }}
      onBlur={(e) => commit(e.target.value)}
      onKeyDown={(e) => { if (e.key === "ArrowUp") { e.preventDefault(); bump(e.shiftKey ? 60 : 5); } else if (e.key === "ArrowDown") { e.preventDefault(); bump(e.shiftKey ? -60 : -5); } else if (e.key === "Enter") commit((e.target as HTMLInputElement).value); }}
      style={{ ...FIELD, width: 88, textAlign: "center", letterSpacing: ".04em", ...style }}
    />
  );
}

/* ---------------- date (ISO value, DD.MM.ÁÁÁÁ display + calendar) ---------------- */
const isoToDisplay = (iso: string) => { const [y, m, d] = (iso || "").split("-"); return y && m && d ? `${d}.${m}.${y}` : ""; };
function displayToIso(str: string): string {
  const p = str.replace(/[^\d.]/g, "").split(".").filter(Boolean);
  if (p.length < 3) return "";
  const [d, m, y] = p;
  const D = parseInt(d, 10), M = parseInt(m, 10), Y = parseInt(y.length === 2 ? "20" + y : y, 10);
  if (!D || !M || !Y || M > 12 || D > 31) return "";
  return `${Y}-${pad(M)}-${pad(D)}`;
}
const MONTHS_IS = ["janúar", "febrúar", "mars", "apríl", "maí", "júní", "júlí", "ágúst", "september", "október", "nóvember", "desember"];
const WD_IS = ["M", "Þ", "M", "F", "F", "L", "S"]; // Mon-first

export function DateField({ value, defaultValue, name, onChange, style, min, max }: {
  value?: string; defaultValue?: string; name?: string; onChange?: (v: string) => void;
  style?: React.CSSProperties; min?: string; max?: string;
}) {
  const controlled = value !== undefined;
  const [iso, setIso] = useState(value ?? defaultValue ?? "");
  const [text, setText] = useState(isoToDisplay(value ?? defaultValue ?? ""));
  const [open, setOpen] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  useEffect(() => { if (controlled) { setIso(value ?? ""); setText(isoToDisplay(value ?? "")); } }, [value, controlled]);
  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  function set(nextIso: string) { setIso(nextIso); setText(isoToDisplay(nextIso)); onChange?.(nextIso); }
  const [vy, vm, vd] = (iso || "").split("-").map(Number);
  const [viewY, setViewY] = useState<number>(vy || new Date().getFullYear());
  const [viewM, setViewM] = useState<number>((vm || (new Date().getMonth() + 1)) - 1); // 0-based
  useEffect(() => { if (iso) { const [y, m] = iso.split("-").map(Number); setViewY(y); setViewM(m - 1); } }, [iso]);

  const first = new Date(viewY, viewM, 1);
  const startOffset = (first.getDay() + 6) % 7; // Mon-first
  const daysInMonth = new Date(viewY, viewM + 1, 0).getDate();
  const cells: (number | null)[] = [...Array(startOffset).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  const beyond = (d: number): boolean => {
    const cand = `${viewY}-${pad(viewM + 1)}-${pad(d)}`;
    return Boolean((min && cand < min) || (max && cand > max));
  };

  return (
    <span ref={wrap} style={{ position: "relative", display: "inline-flex" }}>
      {name && <input type="hidden" name={name} value={iso} readOnly />}
      <input
        type="text" inputMode="numeric" value={text} placeholder="dd.mm.áááá"
        onChange={(e) => setText(e.target.value)}
        onBlur={(e) => { const n = displayToIso(e.target.value); if (n) set(n); else if (!e.target.value) set(""); else setText(isoToDisplay(iso)); }}
        style={{ ...FIELD, width: 118, ...style }}
      />
      <button type="button" onClick={() => setOpen((o) => !o)} title="Dagatal"
        style={{ marginLeft: -30, width: 26, background: "none", border: "none", color: "var(--ink3)", cursor: "pointer", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M3 9h18M8 2v4M16 2v4" /></svg>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 50, background: "var(--panel)", border: "1px solid var(--line)", borderRadius: 10, boxShadow: "var(--shadow-card)", padding: 10, width: 232 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
            <button type="button" onClick={() => { const m = viewM - 1; if (m < 0) { setViewM(11); setViewY(viewY - 1); } else setViewM(m); }} style={navBtn}>‹</button>
            <b style={{ fontSize: 12.5 }}>{MONTHS_IS[viewM]} {viewY}</b>
            <button type="button" onClick={() => { const m = viewM + 1; if (m > 11) { setViewM(0); setViewY(viewY + 1); } else setViewM(m); }} style={navBtn}>›</button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(7,1fr)", gap: 2 }}>
            {WD_IS.map((w, i) => <div key={i} style={{ textAlign: "center", fontSize: 10, color: "var(--ink3)", fontWeight: 600, padding: "2px 0" }}>{w}</div>)}
            {cells.map((d, i) => d === null ? <div key={i} /> : (
              <button key={i} type="button" disabled={beyond(d)} onClick={() => { set(`${viewY}-${pad(viewM + 1)}-${pad(d)}`); setOpen(false); }}
                style={{ aspectRatio: "1", border: "none", borderRadius: 7, cursor: beyond(d) ? "not-allowed" : "pointer", fontSize: 12, fontWeight: 600,
                  background: iso === `${viewY}-${pad(viewM + 1)}-${pad(d)}` ? "var(--brand)" : "transparent",
                  color: beyond(d) ? "var(--ink3)" : iso === `${viewY}-${pad(viewM + 1)}-${pad(d)}` ? "#fff" : "var(--ink)", opacity: beyond(d) ? 0.4 : 1 }}>
                {d}
              </button>
            ))}
          </div>
        </div>
      )}
    </span>
  );
}
const navBtn: React.CSSProperties = { width: 26, height: 26, borderRadius: 7, border: "1px solid var(--line)", background: "var(--panel)", color: "var(--ink)", cursor: "pointer", fontSize: 15, lineHeight: 1 };
