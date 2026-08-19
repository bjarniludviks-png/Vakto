# SHARED-COMPONENTS — VAKTO ⇄ INVENTRA

Afritanlegir íhlutir úr VAKTO fyrir systkina-öpp. Allt brand-litað er leitt af
**EINNI breytu `--brand`** (gegnum `color-mix`) — INVENTRA setur bara sinn græna
lit þar og allt annað fylgir. Engin VAKTO-gögn; límist beint í Next.js verkefni
(App Router, client components).

Uppruni: `src/components/app/app-shell.tsx` + `period-picker.tsx` + `src/styles/app.css`.

---

## 0) Grunntókar — `tokens.css`

Settu í globals (hlaðið alls staðar). **INVENTRA breytir bara `--brand`**
(t.d. `#1f9d6b`); `--brand-soft` og skuggar reiknast sjálfkrafa.

```css
:root {
  /* ============ EINA breytan sem systkina-app skiptir um ============ */
  --brand: #e9700f;                /* VAKTO appelsínugult · INVENTRA: grænt */

  /* leidd af --brand — EKKI breyta */
  --brand-soft: color-mix(in srgb, var(--brand) 10%, white);
  --brand-shadow: color-mix(in srgb, var(--brand) 28%, transparent);

  /* neutrals (sameiginlegt öllum öppunum) */
  --ink: #1a1a1f;                  /* aðaltextalitur */
  --ink2: #5f6470;                 /* millitexti */
  --ink3: #9296a6;                 /* daufur texti / íkonar */
  --line: #e6e6e9;                 /* rammar */
  --line2: #f3f3f5;                /* hover-flötur / daufir rammar */
  --bg: #f4f4f6;                   /* síðubakgrunnur */
  --panel: #ffffff;                /* kort / stika */
  --shadow: 0 1px 2px rgba(18, 18, 40, 0.05);
}

/* deilt: hnappar sem íhlutirnir nota */
.btn{display:inline-flex;align-items:center;gap:7px;background:var(--brand);color:#fff;font-size:13px;font-weight:600;padding:9px 15px;border-radius:10px;border:0;cursor:pointer;box-shadow:0 3px 10px var(--brand-shadow)}
.btn.ghost{background:var(--panel);color:var(--ink);border:1px solid var(--line);box-shadow:var(--shadow)}
.btn.ghost:hover{background:var(--line2)}
.btn.sm{padding:6px 11px;font-size:12px}
```

---

## 1) Samfellanleg hliðarstika (collapsible sidebar)

- Full breidd **250px** → íkon-rönd (**rail**) **64px**; `width` animérast á `.2s ease`.
- **>>/<<**-takkinn efst (`ChevronsLeft` úr lucide) snýst 180° þegar fellt
  (`transform .15s`). Stakan man stöðuna í `localStorage`.
- Hópafyrirsagnir eru smellanlegar (fella hóp saman, ⌄ snýst); í rail-ham eru
  fyrirsagnir faldar og allir hlekkir sýndir sem íkonar með `title`-tooltip.
- Á mobile (≤760px) verður stikan að skúffu (drawer) með backdrop — rail-takkinn
  er falinn þar.

### `components/sidebar.tsx`

```tsx
"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronsLeft, type LucideIcon } from "lucide-react";

export type NavItem = { href: string; label: string; icon: LucideIcon };
export type NavGroup = { title: string; items: NavItem[] };

export function Sidebar({
  brand,          // heiti appsins, t.d. "INVENTRA"
  logo,           // ReactNode — merkið (svg), ~26px
  groups,         // aðal-nav í hópum
  foot = [],      // neðsti hluti (Stillingar, Hjálp …)
  storageKey = "app-rail",
  open = false,   // mobile-drawer staða (stýrt utan frá)
  onClose,
}: {
  brand: string;
  logo: ReactNode;
  groups: NavGroup[];
  foot?: NavItem[];
  storageKey?: string;
  open?: boolean;
  onClose?: () => void;
}) {
  const pathname = usePathname();
  const [railed, setRailed] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  // sótt eftir mount svo SSR-html stemmi (ekkert hydration-mismatch)
  useEffect(() => {
    if (localStorage.getItem(storageKey) === "1") {
      requestAnimationFrame(() => setRailed(true));
    }
  }, [storageKey]);

  function toggleRail() {
    setRailed((r) => {
      try { localStorage.setItem(storageKey, r ? "0" : "1"); } catch {}
      return !r;
    });
  }

  const active = (href: string) => pathname === href || pathname.startsWith(href + "/");

  const renderItem = (it: NavItem) => (
    <Link
      key={it.href}
      href={it.href}
      className={active(it.href) ? "on" : ""}
      title={it.label}
      onClick={onClose}
    >
      <it.icon />
      <span className="nlbl">{it.label}</span>
    </Link>
  );

  return (
    <>
      <div className={`backdrop${open ? " show" : ""}`} onClick={onClose} />
      <div className={`app-side-scope${railed ? " railed" : ""}`}>
        <aside className={`side${open ? " open" : ""}`}>
          <div className="brand">
            <span className="m">{logo}</span>
            <b>{brand}</b>
            <button
              className="railtog"
              onClick={toggleRail}
              title={railed ? "Sýna hliðarstiku" : "Fela hliðarstiku"}
              aria-label="toggle sidebar"
            >
              <ChevronsLeft />
            </button>
          </div>
          <nav className="nav">
            {groups.map((g) => (
              <div key={g.title}>
                <div
                  className={`grp${collapsed[g.title] ? " col" : ""}`}
                  onClick={() => setCollapsed((c) => ({ ...c, [g.title]: !c[g.title] }))}
                >
                  {g.title}
                </div>
                {(railed || !collapsed[g.title]) && g.items.map(renderItem)}
              </div>
            ))}
          </nav>
          {foot.length > 0 && <div className="navfoot">{foot.map(renderItem)}</div>}
        </aside>
      </div>
    </>
  );
}
```

### `styles/sidebar.css`

```css
/* ---------- sidebar ---------- */
.app-side-scope{display:contents}
.side{width:250px;background:var(--panel);border-right:1px solid var(--line);display:flex;flex-direction:column;
  position:sticky;top:0;height:100vh;flex-shrink:0;z-index:40;transition:width .2s ease}
.brand{display:flex;align-items:center;gap:9px;padding:22px 22px 18px}
.brand .m{display:flex;align-items:center;justify-content:center}
.brand .m svg{width:26px;height:26px;display:block}
.brand b{font-size:18px;font-weight:700;letter-spacing:.04em;color:var(--ink)}

.nav{padding:6px 14px;flex:1 1 auto;overflow-y:auto;display:flex;flex-direction:column}
.nav .grp{font-size:11px;font-weight:600;letter-spacing:.07em;text-transform:uppercase;color:var(--ink3);padding:16px 10px 8px;cursor:pointer;user-select:none}
.nav .grp::after{content:"⌄";float:right;font-size:13px;opacity:.45;margin-top:-2px;transition:.15s;display:inline-block}
.nav .grp.col::after{transform:rotate(-90deg)}
.nav a{display:flex;align-items:center;gap:13px;padding:9px 11px;border-radius:10px;font-size:14.5px;font-weight:500;
  color:var(--ink2);margin-bottom:2px;cursor:pointer;transition:.12s;text-decoration:none}
.nav a svg{width:19px;height:19px;color:var(--ink3);flex-shrink:0;stroke-width:1.9}
.nav a:hover{background:var(--line2);color:var(--ink)}
.nav a.on{background:var(--line2);color:var(--ink);font-weight:600}
.nav a.on svg{color:var(--brand)}

.navfoot{padding:8px 14px 16px;border-top:1px solid var(--line)}
.navfoot a{display:flex;align-items:center;gap:13px;padding:9px 11px;border-radius:10px;font-size:14.5px;font-weight:500;color:var(--ink2);cursor:pointer;transition:.12s;text-decoration:none}
.navfoot a svg{width:19px;height:19px;color:var(--ink3);flex-shrink:0;stroke-width:1.9}
.navfoot a:hover{background:var(--line2);color:var(--ink)}
.navfoot a.on{background:var(--line2);color:var(--ink);font-weight:600}
.navfoot a.on svg{color:var(--brand)}

/* ---- >>/<< takkinn ---- */
.railtog{margin-left:auto;width:30px;height:30px;border-radius:8px;display:flex;align-items:center;justify-content:center;
  color:var(--ink3);flex-shrink:0;background:none;border:0;cursor:pointer}
.railtog svg{width:16px;height:16px;transition:transform .15s}
.railtog:hover{background:var(--line2);color:var(--ink)}
@media(max-width:760px){.railtog{display:none}}

/* ---- rail-hamur (bara íkonar, 64px) ---- */
@media(min-width:761px){
  .app-side-scope.railed .side{width:64px}
  .app-side-scope.railed .brand{flex-direction:column;padding:16px 0 10px;gap:8px}
  .app-side-scope.railed .brand b{display:none}
  .app-side-scope.railed .railtog{margin:0}
  .app-side-scope.railed .railtog svg{transform:rotate(180deg)}  /* << verður >> */
  .app-side-scope.railed .nav{padding:6px 8px}
  .app-side-scope.railed .nav .grp{display:none}
  .app-side-scope.railed .nav a,
  .app-side-scope.railed .navfoot a{justify-content:center;padding:11px 0;gap:0}
  .app-side-scope.railed .nlbl{display:none}
  .app-side-scope.railed .navfoot{padding:8px 8px 16px}
}

/* ---- mobile: skúffa með backdrop ---- */
.backdrop{position:fixed;inset:0;background:rgba(15,16,20,.4);opacity:0;pointer-events:none;transition:.2s;z-index:39}
.backdrop.show{opacity:1;pointer-events:auto}
@media(max-width:760px){
  .side{position:fixed;left:0;top:0;height:100dvh;transform:translateX(-100%);transition:.25s;box-shadow:0 0 40px rgba(0,0,0,.2)}
  .side.open{transform:none}
  .navfoot{padding-bottom:calc(16px + env(safe-area-inset-bottom))}
}
```

### Notkun

```tsx
import { Sidebar } from "@/components/sidebar";
import {
  LayoutDashboard, Package, Truck, BarChart3, Users,
  Settings, HelpCircle,
} from "lucide-react";

// layout-ið á að vera: <div style={{display:"flex",minHeight:"100vh"}}> <Sidebar/> <main/> </div>
<Sidebar
  brand="INVENTRA"
  logo={<MyGreenLogo />}
  groups={[
    { title: "Yfirlit", items: [
      { href: "/dash", label: "Mælaborð", icon: LayoutDashboard },
      { href: "/vorur", label: "Vörur", icon: Package },
    ]},
    { title: "Rekstur", items: [
      { href: "/birgjar", label: "Birgjar", icon: Truck },
      { href: "/skyrslur", label: "Skýrslur", icon: BarChart3 },
      { href: "/notendur", label: "Notendur", icon: Users },
    ]},
  ]}
  foot={[
    { href: "/stillingar", label: "Stillingar", icon: Settings },
    { href: "/hjalp", label: "Hjálp", icon: HelpCircle },
  ]}
  storageKey="inventra-rail"
/>
```

Lucide-íkonnöfn sem VAKTO notar (til samræmis): `LayoutDashboard, CalendarDays,
Clock, Wallet, Users, BarChart3, TrendingUp, User, MessageCircle, Newspaper,
Settings, HelpCircle, ChevronsLeft, Menu`.

---

## 2) Dagsetninga-tólið (date-range picker)

Payday-stíll: einn hnappur með virka bilinu → spjald með **forstillingum vinstra
megin** og **tveggja mánaða dagatali** hægra megin. Val á bili: fyrsti smellur =
frá-dagur, næsti = til-dagur (víxlast sjálfkrafa ef öfugt). **Staðfesta** kallar
á `onApply`, **Hætta við** lokar án breytinga. Smellt utan spjalds = loka.
Vikur byrja á mánudegi; dagurinn í dag fær brand-hring.

### `components/period-picker.tsx`

```tsx
"use client";

import { useEffect, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const nice = (s: string) => (s ? `${s.slice(8, 10)}.${s.slice(5, 7)}.${s.slice(0, 4)}` : "");

export type PresetKey =
  | "today" | "yesterday" | "7d" | "30d"
  | "thisMonth" | "lastMonth" | "thisYear" | "lastYear" | "custom";

export const PRESET_LABELS: [PresetKey, string][] = [
  ["today", "Í dag"], ["yesterday", "Í gær"],
  ["7d", "Síðustu 7 daga"], ["30d", "Síðustu 30 daga"],
  ["thisMonth", "Þennan mánuð"], ["lastMonth", "Síðasta mánuð"],
  ["thisYear", "Þetta ár"], ["lastYear", "Síðasta ár"],
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
    default: return { from: iso(d(-6)), to: iso(now) };
  }
}

const MON = ["janúar","febrúar","mars","apríl","maí","júní","júlí","ágúst","september","október","nóvember","desember"];
const HD = ["Má","Þr","Mi","Fi","Fö","La","Su"];

function MonthGrid({ base, selFrom, selTo, onPick }: {
  base: Date; selFrom: string; selTo: string; onPick: (isoDate: string) => void;
}) {
  const y = base.getFullYear(), m = base.getMonth();
  const days = new Date(y, m + 1, 0).getDate();
  const lead = (new Date(y, m, 1).getDay() + 6) % 7; // mánudags-fyrst
  const todayISO = iso(new Date());
  return (
    <div className="pp-month">
      <div className="pp-mtitle">{MON[m]} {y}</div>
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
  const [open, setOpen] = useState(false);
  const [preset, setPreset] = useState<PresetKey>(activePreset ?? "7d");
  const [selFrom, setSelFrom] = useState(from);
  const [selTo, setSelTo] = useState(to);
  const [page, setPage] = useState(() => {
    const d = from ? new Date(from) : new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
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
        <span>{from && to ? `${nice(from)} – ${nice(to)}` : "Velja tímabil"}</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m6 9 6 6 6-6" /></svg>
      </button>
      {open && (
        <div className={`pp-panel ${align}`}>
          <div className="pp-presets">
            {PRESET_LABELS.map(([k, label]) => (
              <button key={k} className={preset === k ? "on" : ""} onClick={() => pickPreset(k)}>{label}</button>
            ))}
            <div className="pp-actions">
              <button className="btn sm" onClick={() => { setOpen(false); onApply(selFrom, selTo, preset); }}>Staðfesta</button>
              <button className="btn ghost sm" onClick={() => setOpen(false)}>Hætta við</button>
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
```

### `styles/period-picker.css`

```css
/* ---------- period picker ---------- */
.pp{position:relative}
.pp-btn{display:inline-flex;align-items:center;gap:9px;font:inherit;font-size:13px;font-weight:600;color:var(--ink);background:var(--panel);border:1px solid var(--line);border-radius:11px;padding:8px 13px;cursor:pointer;font-variant-numeric:tabular-nums}
.pp-btn:hover{border-color:var(--ink3)}
.pp-panel{position:absolute;top:calc(100% + 8px);z-index:70;display:flex;background:var(--panel);border:1px solid var(--line);border-radius:16px;box-shadow:0 24px 60px rgba(20,22,28,.22);overflow:hidden}
.pp-panel.left{left:0}.pp-panel.right{right:0}

/* forstillingar (vinstri dálkur) */
.pp-presets{display:flex;flex-direction:column;gap:3px;padding:10px;border-right:1px solid var(--line2);min-width:148px;background:var(--bg)}
.pp-presets>button{font:inherit;font-size:12px;font-weight:600;text-align:left;color:var(--ink);background:var(--panel);border:1px solid var(--line2);border-radius:8px;padding:6px 10px;cursor:pointer;white-space:nowrap}
.pp-presets>button:hover{border-color:var(--ink3)}
.pp-presets>button.on{background:var(--ink);color:var(--panel);border-color:var(--ink)}
.pp-actions{display:flex;gap:6px;margin-top:auto;padding-top:8px}

/* dagatalið (hægri hluti) */
.pp-cal{padding:10px 12px}
.pp-range{display:flex;align-items:center;gap:8px;font-size:12px;font-weight:650;font-variant-numeric:tabular-nums;margin-bottom:8px}
.pp-range span{background:var(--line2);border-radius:8px;padding:4px 10px}
.pp-range .pp-arrow{background:none;padding:0;color:var(--ink3)}
.pp-months{display:flex;gap:8px;align-items:flex-start}
.pp-nav{font:inherit;font-size:15px;background:none;border:1px solid var(--line);border-radius:8px;width:24px;height:24px;line-height:1;cursor:pointer;color:var(--ink);margin-top:64px}
.pp-month{width:192px}
.pp-mtitle{font-size:12px;font-weight:700;text-align:center;margin-bottom:4px;text-transform:capitalize}
.pp-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:0}
.pp-grid .hd{font-size:9.5px;font-weight:700;color:var(--ink3);text-align:center;padding:2px 0}
.pp-d{font:inherit;font-size:11.5px;font-variant-numeric:tabular-nums;background:none;border:0;border-radius:7px;height:25px;cursor:pointer;color:var(--ink)}
.pp-d:hover{background:var(--line2)}
.pp-d.in{background:var(--brand-soft);border-radius:0}         /* innan bils */
.pp-d.edge{background:var(--brand);color:#fff;font-weight:700} /* frá/til dagar */
.pp-d.tod:not(.edge){box-shadow:inset 0 0 0 1px var(--brand)}  /* dagurinn í dag */

/* mobile */
@media(max-width:760px){
  .pp{width:100%}
  .pp-btn{width:100%;justify-content:center}
  .pp-panel{flex-direction:column;width:calc(100vw - 40px);max-width:calc(100vw - 40px)}
  .pp-presets{display:grid;grid-template-columns:1fr 1fr;gap:6px;border-right:0;border-bottom:1px solid var(--line2);min-width:0}
  .pp-presets>button{text-align:center}
  .pp-actions{grid-column:1 / -1;display:flex;gap:8px;margin-top:4px}
  .pp-actions .btn{flex:1;justify-content:center}
  .pp-months{overflow-x:auto}
  .pp-nav{margin-top:52px}
}
```

### Notkun

```tsx
import { useState } from "react";
import { PeriodPicker, presetRange, type PresetKey } from "@/components/period-picker";

const init = presetRange("7d");
const [range, setRange] = useState({ ...init, preset: "7d" as PresetKey });

<PeriodPicker
  from={range.from}
  to={range.to}
  activePreset={range.preset}
  align="right"   /* "left" | "right" — hvorum megin spjaldið opnast */
  onApply={(from, to, preset) => setRange({ from, to, preset })}
/>
```

---

## Athugasemdir

- **Letur**: VAKTO notar General Sans (Fontshare). Íhlutirnir erfa `font: inherit`
  svo INVENTRA-letrið gildir sjálfkrafa — engin leturtilvísun í kóðanum.
- **Tailwind**: CSS-ið hér er vanilla (route-scoped í VAKTO) og virkar við hlið
  Tailwind v4 án árekstra; klasanöfnin (`side`, `pp-*`) eru einkvæm.
- **i18n**: strengir eru harðkóðuð íslenska hér; VAKTO vefur þá gegnum
  `useLang()`-DICT — skiptu labels út fyrir eigin i18n eftir þörfum.
- **`color-mix`** er stutt í öllum nútímavöfrum (Safari 16.2+, Chrome 111+).
  Ef eldri stuðningur skiptir máli má harðkóða `--brand-soft` og `--brand-shadow`.
