"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useLang } from "./lang";
import { Icon } from "./icons";
import { visibleFor, type Role } from "./nav";
import { listEmployeesForSearch, type SearchEmp } from "@/app/(app)/company-actions";

type Result = { kind: "page" | "emp"; label: string; sub: string; href: string; icon: string };

/** Functional topbar search: pages (role-filtered nav) + employees. Type to filter,
 * Enter/click to navigate, Esc/blur to close. */
export function TopSearch({ role }: { role: Role }) {
  const { t } = useLang();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const [emps, setEmps] = useState<SearchEmp[]>([]);
  const [hi, setHi] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);
  const loaded = useRef(false);

  // Load employees once on first focus.
  function ensureLoaded() {
    if (loaded.current) return;
    loaded.current = true;
    listEmployeesForSearch().then(setEmps);
  }
  useEffect(() => {
    const onDoc = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const pages: Result[] = (() => {
    const { groups, foot } = visibleFor(role);
    const items = [...groups.flatMap((g) => g.items), ...foot];
    return items.map((i) => ({ kind: "page" as const, label: t("nav:" + i.slug), sub: t("Síða"), href: i.href, icon: i.icon }));
  })();

  const ql = q.trim().toLowerCase();
  const results: Result[] = ql
    ? [
        ...pages.filter((p) => p.label.toLowerCase().includes(ql)),
        ...emps.filter((e) => e.name.toLowerCase().includes(ql)).slice(0, 8).map((e) => ({ kind: "emp" as const, label: e.name, sub: e.dept || t("Starfsmaður"), href: `/starfsfolk/${e.id}`, icon: "people" })),
      ].slice(0, 10)
    : pages.slice(0, 6);

  function go(r: Result) { setOpen(false); setQ(""); router.push(r.href); }

  return (
    <div className="tsearch" ref={wrap} style={{ position: "relative", overflow: "visible" }}>
      <Icon name="search" />
      <input
        placeholder={t("search")} value={q}
        onFocus={() => { ensureLoaded(); setOpen(true); }}
        onChange={(e) => { setQ(e.target.value); setOpen(true); setHi(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => Math.min(h + 1, results.length - 1)); }
          else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => Math.max(h - 1, 0)); }
          else if (e.key === "Enter" && results[hi]) { e.preventDefault(); go(results[hi]); }
          else if (e.key === "Escape") setOpen(false);
        }}
      />
      {open && (
        <div className="tsearch-pop">
          {results.length ? results.map((r, i) => (
            <button key={r.href + i} className={`tsr${i === hi ? " on" : ""}`} onMouseEnter={() => setHi(i)} onClick={() => go(r)}>
              <span className="tsr-ic"><Icon name={r.icon} /></span>
              <span className="tsr-tx"><b>{r.label}</b><span>{r.sub}</span></span>
            </button>
          )) : <div className="muted" style={{ fontSize: 13, padding: "12px 14px", textAlign: "center" }}>{t("Ekkert fannst.")}</div>}
        </div>
      )}
    </div>
  );
}
