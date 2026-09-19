"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo } from "./icons";
import { ToastHost, toast } from "./toast";
import { visibleFor, type Role } from "./nav";
import { homeFor } from "@/lib/access";
import { useLang } from "./lang";
import { createClient } from "@/lib/supabase/client";
import { getMyCompanies, switchCompany, type CompanyOption } from "@/app/(app)/company-actions";
import { TopSearch } from "./top-search";

export type Account = {
  initials: string;
  name: string;
  company: string;
  /** Real company id. */
  companyId?: string;
  /** Secret kiosk token (companies.kiosk_token) — the account menu's kiosk link. */
  kioskToken?: string;
  role: Role;
  /** SaaS-owner super-admin (email allowlist) — shows the VAKTO Admin menu entry. */
  vaktoAdmin?: boolean;
};

type MenuPos = { top: number; right: number } | null;

export default function AppShell({
  account,
  children,
}: {
  account: Account;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, t } = useLang();
  const [navOpen, setNavOpen] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [menu, setMenu] = useState<null | "lang" | "new" | "acct">(null);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [picker, setPicker] = useState(false);
  useEffect(() => {
    if ((menu === "acct" || picker) && companies.length === 0) getMyCompanies().then(setCompanies);
  }, [menu, picker]); // eslint-disable-line react-hooks/exhaustive-deps
  async function pickCompany(id: string) {
    setMenu(null); setPicker(false);
    const res = await switchCompany(id);
    if (res.ok) { toast(t("Skipt um félag")); window.location.assign(homeFor(account.role)); }
    else toast(res.error ?? "Villa");
  }
  const [pos, setPos] = useState<MenuPos>(null);
  const role: Role = account.role;
  const [dark, setDark] = useState(false);
  const [railed, setRailed] = useState(false);

  // Apply persisted theme on mount (avoids hydration mismatch). The cookie
  // banner lives on the marketing site only — the signed-in app uses nothing
  // but strictly necessary auth cookies, so no consent UI belongs here.
  useEffect(() => {
    const isDark = localStorage.getItem("vakto-theme") === "dark";
    if (isDark) document.documentElement.classList.add("dark");
    const rail = localStorage.getItem("vakto-rail") === "1";
    requestAnimationFrame(() => {
      if (isDark) setDark(true);
      if (rail) setRailed(true);
    });
  }, []);
  function toggleRail() {
    setRailed((r) => { try { localStorage.setItem("vakto-rail", r ? "0" : "1"); } catch {} return !r; });
  }
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("vakto-theme", next ? "dark" : "light"); } catch {}
    setMenu(null);
    toast(next ? t("Dökkt útlit virkt") : t("Ljóst útlit virkt"));
  }

  const ident = account;
  const { groups, foot } = visibleFor(role);
  const canCreate = role === "owner" || role === "manager";

  function openMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    which: "lang" | "new" | "acct",
  ) {
    const r = e.currentTarget.getBoundingClientRect();
    setPos({ top: r.bottom + 8, right: Math.max(12, window.innerWidth - r.right) });
    setMenu((m) => (m === which ? null : which));
  }

  function nav(href: string) {
    setMenu(null);
    router.push(href);
  }

  async function signOut() {
    setMenu(null);
    try {
      await createClient().auth.signOut();
    } catch {
      /* ignore when not configured */
    }
    // Full navigation to the marketing homepage (clears the app shell + session).
    window.location.assign("/");
  }

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div
        className={`backdrop${navOpen ? " show" : ""}`}
        onClick={() => setNavOpen(false)}
      />
      <div className={`app${railed ? " railed" : ""}`}>
        {/* ---------- sidebar ---------- */}
        <aside className={`side${navOpen ? " open" : ""}`}>
          <div className="brand">
            <Link href="/" className="brandlink" title={t("Fara á forsíðu")} aria-label={t("Fara á forsíðu")}>
              <div className="m">
                <Logo size={26} />
              </div>
              <b>VAKTO</b>
            </Link>
            <button className="railtog" onClick={toggleRail} title={railed ? "Sýna hliðarstiku" : "Fela hliðarstiku"} aria-label="toggle sidebar">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l-6 6 6 6M21 6l-6 6 6 6" /></svg>
            </button>
          </div>
          <nav className="nav">
            {groups.map((g) => (
              <div key={g.title}>
                <div
                  className={`grp${collapsed[g.title] ? " col" : ""}`}
                  onClick={() =>
                    setCollapsed((c) => ({ ...c, [g.title]: !c[g.title] }))
                  }
                >
                  {t("grp:" + g.title)}
                </div>
                {(railed || !collapsed[g.title]) &&
                  g.items.map((it) => (
                    <Link
                      key={it.slug}
                      href={it.href}
                      className={active(it.href) ? "on" : ""}
                      title={t("nav:" + it.slug)}
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon name={it.icon} />
                      <span className="nlbl">{t("nav:" + it.slug)}</span>
                    </Link>
                  ))}
              </div>
            ))}
          </nav>
          <div className="navfoot">
            {foot.map((it) => (
              <Link
                key={it.slug}
                href={it.href}
                className={active(it.href) ? "on" : ""}
                title={t("nav:" + it.slug)}
                onClick={() => setNavOpen(false)}
              >
                <Icon name={it.icon} />
                <span className="nlbl">{t("nav:" + it.slug)}</span>
              </Link>
            ))}
          </div>
        </aside>

        {/* ---------- main ---------- */}
        <main className="main">
          <header className="tbar">
            <button className="menu-btn" onClick={() => setNavOpen(true)}>
              <Icon name="menu" />
            </button>
            <TopSearch role={role} />
            <div className="tactions">
              <button
                className="ticon"
                title="Tungumál"
                onClick={(e) => openMenu(e, "lang")}
              >
                <Icon name="globe" />
              </button>
              {canCreate && (
                <button className="btn sm tnew" onClick={(e) => openMenu(e, "new")}>
                  <Icon name="plus" strokeWidth={2.2} />
                  <span className="tnew-label">{t("create")}</span>
                  <Icon name="chevron" className="chev" strokeWidth={2} />
                </button>
              )}
              <button className="tacct" onClick={(e) => openMenu(e, "acct")}>
                <span className="tav">{ident.initials}</span>
                <span className="tacct-n">{ident.company}</span>
                <Icon name="chevron" />
              </button>
            </div>
          </header>

          <div className="wrap">{children}</div>
        </main>
      </div>

      {/* ---------- dropdown menus ---------- */}
      {menu && pos && (
        <>
          <div
            style={{ position: "fixed", inset: 0, zIndex: 59 }}
            onClick={() => setMenu(null)}
          />
          <div
            className="tmenu show"
            style={{ top: pos.top, right: pos.right }}
          >
            {menu === "lang" && (
              <>
                <div className={`mi${lang === "is" ? " on" : ""}`} onClick={() => { setLang("is"); setMenu(null); toast("Tungumál: Íslenska"); }}>
                  Íslenska
                </div>
                <div className={`mi${lang === "en" ? " on" : ""}`} onClick={() => { setLang("en"); setMenu(null); toast("Language: English"); }}>
                  English
                </div>
                <div className={`mi${lang === "vi" ? " on" : ""}`} onClick={() => { setLang("vi"); setMenu(null); toast("Ngôn ngữ: Tiếng Việt"); }}>
                  Tiếng Việt
                </div>
              </>
            )}
            {menu === "new" && (
              <>
                <div className="mi" onClick={() => nav("/vaktaplan")}>{t("create:shift")}</div>
                <div className="mi" onClick={() => nav("/starfsfolk?new=1")}>{t("create:emp")}</div>
                <div className="mi" onClick={() => nav("/vaktaplan")}>{t("create:plan")}</div>
                <div className="mi" onClick={() => nav("/stillingar?new=location")}>{t("create:loc")}</div>
              </>
            )}
            {menu === "acct" && (
              <>
                <div className="mhd">
                  <b>{ident.name}</b>
                  <span>{ident.company} · {t("role:" + role)}</span>
                </div>
                <div className="sep" />
                <div className="mi" onClick={() => { setMenu(null); setPicker(true); }}>
                  <Icon name="building" className="ei" />{companies.length > 1 ? t("Skipta um félag") : t("Mín félög")}
                </div>
                <div className="sep" />
                <div className="mi" onClick={() => nav(account.kioskToken ? `/kiosk?k=${account.kioskToken}` : "/kiosk")}>
                  <Icon name="kclock" className="ei" />{t("acct:kiosk")}
                </div>
                {canCreate && (
                  <div className="mi" onClick={() => nav("/stillingar")}>
                    <Icon name="settings" className="ei" />{t("acct:settings")}
                  </div>
                )}
                {account.vaktoAdmin && (
                  <div className="mi" onClick={() => { window.location.assign(window.location.hostname.endsWith("vakto.is") ? "https://admin.vakto.is" : "/admin"); }}>
                    <Icon name="shield" className="ei" />VAKTO Admin
                  </div>
                )}
                <div className="mi" onClick={() => nav("/hjalp")}>
                  <Icon name="help" className="ei" />{t("acct:help")}
                </div>
                <div className="mi" onClick={() => { setLang(lang === "is" ? "en" : lang === "en" ? "vi" : "is"); setMenu(null); }}>
                  <Icon name="globe" className="ei" />{lang === "is" ? "English" : "Íslenska"}
                </div>
                <div className="mi" onClick={toggleTheme}>
                  <Icon name="moon" className="ei" />{dark ? t("Ljóst útlit") : t("acct:dark")}
                </div>
                <div className="sep" />
                <div className="mi danger" onClick={signOut}>
                  <Icon name="logout" className="ei" />{t("acct:logout")}
                </div>
              </>
            )}
          </div>
        </>
      )}

      {/* ---------- company picker (Payday-style) ---------- */}
      {picker && <CompanyPicker companies={companies} onPick={pickCompany} onClose={() => setPicker(false)} />}

      <ToastHost />
    </>
  );
}

/** Payday-style company picker: search + avatar list of the user's companies. */
function CompanyPicker({ companies, onPick, onClose }: { companies: CompanyOption[]; onPick: (id: string) => void; onClose: () => void }) {
  const { t } = useLang();
  const [q, setQ] = useState("");
  const list = q ? companies.filter((c) => c.name.toLowerCase().includes(q.toLowerCase())) : companies;
  const initials = (n: string) => n.trim().split(/\s+/).slice(0, 2).map((w) => w[0]).join("").toUpperCase() || "VK";
  const COLORS = ["#5b50e6", "#1fb6a6", "#e9700f", "#0891b2", "#db2777", "#7c6ff2"];
  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 460 }}>
        <div className="mh"><div style={{ fontSize: 17, fontWeight: 700 }}>{t("Velja félag")}</div><button className="x" onClick={onClose}>✕</button></div>
        <div className="mb">
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("Leita…")}
            style={{ width: "100%", border: "1px solid var(--line)", borderRadius: 9, padding: "10px 12px", font: "inherit", fontSize: 14, background: "var(--panel)", color: "var(--ink)", marginBottom: 10 }} />
          <div style={{ maxHeight: "52vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 4 }}>
            {list.map((c, i) => (
              <button key={c.id} onClick={() => !c.active && onPick(c.id)}
                style={{ display: "flex", alignItems: "center", gap: 12, padding: "11px 12px", borderRadius: 11, border: "1px solid " + (c.active ? "var(--brand)" : "transparent"), background: c.active ? "var(--brand-soft)" : "transparent", cursor: c.active ? "default" : "pointer", textAlign: "left", width: "100%" }}>
                <span className="avt" style={{ background: COLORS[i % COLORS.length], width: 40, height: 40, fontSize: 14 }}>{initials(c.name)}</span>
                <span style={{ flex: 1, minWidth: 0 }}><b style={{ display: "block", fontSize: 14 }}>{c.name}</b><span className="muted" style={{ fontSize: 12 }}>{t("role:" + c.role)}</span></span>
                {c.active && <span className="tag good" style={{ background: "var(--good-soft)", color: "var(--good)" }}>{t("virkt")}</span>}
              </button>
            ))}
            {!list.length && <p className="muted" style={{ fontSize: 13, textAlign: "center", padding: 18 }}>{t("Ekkert fannst.")}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
