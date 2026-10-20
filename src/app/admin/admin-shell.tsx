"use client";

// Platform chrome — SAMA skel og kerfið sjálft (.app/.side/.nav/.tbar úr app.css), bara með
// valmynd VAKTO-teymisins: Mælaborð · Fyrirtæki · Spjall · Auglýsingar · Kerfið · Stillingar.
// Ljóst/dökkt útlit notar sama „vakto-theme“ lykil og kerfið.
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Icon } from "@/components/app/icons";
import { VaktoLogo } from "@/components/brand/vakto-logo";

const SERVER_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <rect x="4" y="4.5" width="16" height="6" rx="1.8" /><rect x="4" y="13.5" width="16" height="6" rx="1.8" />
    <path d="M7.5 7.5h.01M7.5 16.5h.01" />
  </svg>
);
const SUN_ICON = (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor">
    <circle cx="12" cy="12" r="4" /><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4" />
  </svg>
);

type Item = { href: string; label: string; icon: React.ReactNode };
const GROUPS: { title: string; items: Item[] }[] = [
  { title: "Yfirlit", items: [
    { href: "/admin", label: "Mælaborð", icon: <Icon name="dashboard" /> },
    { href: "/admin/fyrirtaeki", label: "Fyrirtæki", icon: <Icon name="building" /> },
  ] },
  { title: "Samskipti og markaður", items: [
    { href: "/admin/spjall", label: "Spjall", icon: <Icon name="chat" /> },
    { href: "/admin/auglysingar", label: "Auglýsingar", icon: <Icon name="megaphone" /> },
  ] },
];
const FOOT: Item[] = [
  { href: "/admin/kerfid", label: "Kerfið", icon: SERVER_ICON },
  { href: "/admin/stillingar", label: "Stillingar", icon: <Icon name="settings" /> },
];

const initials = (name: string | null, email: string) => {
  const parts = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  return (parts[0] ?? email).slice(0, 2).toUpperCase();
};

export default function AdminShell({ email, name, unread, children }: { email: string; name: string | null; unread: number; children: React.ReactNode }) {
  const pathname = usePathname();
  const [dark, setDark] = useState(false);
  const [railed, setRailed] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [menu, setMenu] = useState(false);

  useEffect(() => {
    let isDark = false, rail = false;
    try { isDark = localStorage.getItem("vakto-theme") === "dark"; rail = localStorage.getItem("vakto-rail") === "1"; } catch { /* einkagluggi */ }
    document.documentElement.classList.toggle("dark", isDark);
    requestAnimationFrame(() => { setDark(isDark); setRailed(rail); });
  }, []);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("vakto-theme", next ? "dark" : "light"); } catch { /* ignore */ }
    window.dispatchEvent(new Event("vakto-theme"));
  }
  function toggleRail() {
    setRailed((r) => { try { localStorage.setItem("vakto-rail", r ? "0" : "1"); } catch { /* ignore */ } return !r; });
  }
  async function signOut() {
    try { await createClient().auth.signOut(); } catch { /* ignore */ }
    window.location.assign("/login");
  }
  const isOn = (href: string) => (href === "/admin" ? pathname === "/admin" : pathname === href || pathname.startsWith(href + "/"));
  const link = (n: Item) => (
    <a key={n.href} href={n.href} className={isOn(n.href) ? "on" : ""} aria-current={isOn(n.href) ? "page" : undefined} title={n.label}>
      {n.icon}
      <span className="nlbl">{n.label}</span>
      {n.href === "/admin/spjall" && unread > 0 && <span className="adm-dot">{unread}</span>}
    </a>
  );

  return (
    <>
      <div className={`backdrop${navOpen ? " show" : ""}`} onClick={() => setNavOpen(false)} />
      <div className={`app${railed ? " railed" : ""}`}>
        <aside className={`side${navOpen ? " open" : ""}`}>
          <div className="brand">
            <a href="/admin" className="brandlink" title="Mælaborð" aria-label="Mælaborð">
              <VaktoLogo size={26} />
            </a>
            <button className="railtog" onClick={toggleRail} title={railed ? "Sýna hliðarstiku" : "Fela hliðarstiku"} aria-label="Fela eða sýna hliðarstiku">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l-6 6 6 6M21 6l-6 6 6 6" /></svg>
            </button>
          </div>
          <nav className="nav">
            {GROUPS.map((g) => (
              <div key={g.title}>
                <div className="grp">{g.title}</div>
                {g.items.map(link)}
              </div>
            ))}
          </nav>
          <div className="navfoot">{FOOT.map(link)}</div>
        </aside>

        <main className="main">
          <header className="tbar">
            <button className="menu-btn" onClick={() => setNavOpen(true)} aria-label="Opna valmynd"><Icon name="menu" /></button>
            <span className="adm-pill">PLATFORM</span>
            <div className="tactions">
              <button className="ticon" onClick={toggleTheme} title={dark ? "Skipta í ljóst útlit" : "Skipta í dökkt útlit"} aria-label={dark ? "Ljóst útlit" : "Dökkt útlit"}>
                {dark ? SUN_ICON : <Icon name="moon" />}
              </button>
              <div>
                <button className="tacct" onClick={() => setMenu((m) => !m)} aria-haspopup="menu" aria-expanded={menu}>
                  <span className="tav">{initials(name, email)}</span>
                  <span className="tacct-n">{name ?? email}</span>
                  <Icon name="chevron" />
                </button>
                {menu && (
                  <>
                    <div style={{ position: "fixed", inset: 0, zIndex: 59 }} onClick={() => setMenu(false)} />
                    <div className="tmenu show" style={{ top: 60, right: 20 }} role="menu">
                      <div className="mhd"><b>{name ?? "VAKTO-teymið"}</b><span>{email}</span></div>
                      <div className="sep" />
                      <a className="mi" href="/admin/stillingar" role="menuitem">Stillingar</a>
                      <div className="mi" onClick={() => { toggleTheme(); setMenu(false); }} role="menuitem">{dark ? "Ljóst útlit" : "Dökkt útlit"}</div>
                      <div className="sep" />
                      <div className="mi" onClick={signOut} role="menuitem">Skrá út</div>
                    </div>
                  </>
                )}
              </div>
            </div>
          </header>
          <div className="wrap">{children}</div>
        </main>
      </div>
    </>
  );
}
