"use client";

// Type-ahead autocomplete: suggestions filter from the FIRST character
// (accent- and case-insensitive substring match), full list on focus,
// arrow keys + Enter, click to pick. Free text is always allowed.

import { useEffect, useMemo, useRef, useState } from "react";

const fold = (s: string) =>
  s.toLowerCase()
    .replace(/[áà]/g, "a").replace(/[éè]/g, "e").replace(/[íì]/g, "i")
    .replace(/[óò]/g, "o").replace(/[úù]/g, "u").replace(/ý/g, "y")
    .replace(/þ/g, "th").replace(/ð/g, "d").replace(/æ/g, "ae").replace(/ö/g, "o");

export function Autocomplete({
  value, onChange, onCommit, suggestions, placeholder, name, style, inputStyle,
}: {
  value: string;
  onChange: (v: string) => void;
  onCommit?: (v: string) => void; // fired on pick + blur (e.g. save-on-blur)
  suggestions: string[];
  placeholder?: string;
  name?: string;
  style?: React.CSSProperties;
  inputStyle?: React.CSSProperties;
}) {
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const wrapRef = useRef<HTMLDivElement>(null);

  const shown = useMemo(() => {
    const q = fold(value.trim());
    if (!q) return suggestions;
    const starts = suggestions.filter((s) => fold(s).startsWith(q));
    const contains = suggestions.filter((s) => !fold(s).startsWith(q) && fold(s).includes(q));
    return [...starts, ...contains];
  }, [value, suggestions]);

  useEffect(() => { setHi(-1); }, [value]);
  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, []);

  function pick(v: string) {
    onChange(v);
    onCommit?.(v);
    setOpen(false);
  }

  return (
    <div className="acp" ref={wrapRef} style={style}>
      <input
        name={name}
        value={value}
        placeholder={placeholder}
        autoComplete="off"
        style={inputStyle}
        onChange={(e) => { onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        onBlur={() => onCommit?.(value)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) { setOpen(true); return; }
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, shown.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && open && hi >= 0 && shown[hi]) { e.preventDefault(); pick(shown[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && shown.length > 0 && (
        <div className="acp-list">
          {shown.slice(0, 12).map((s, i) => (
            <button
              key={s}
              type="button"
              className={`acp-item${i === hi ? " on" : ""}`}
              onMouseDown={(e) => { e.preventDefault(); pick(s); }}
              onMouseEnter={() => setHi(i)}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
