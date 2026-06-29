"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Icon, Logo } from "./icons";
import { ToastHost, toast } from "./toast";
import { visibleFor, type Role } from "./nav";
import { useLang } from "./lang";
import { createClient } from "@/lib/supabase/client";

export type Account = {
  initials: string;
  name: string;
  company: string;
  role: Role;
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
  const [menu, setMenu] = useState<null | "lang" | "new" | "notif" | "acct">(null);
  const [pos, setPos] = useState<MenuPos>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [cookie, setCookie] = useState(false);
  const [roleModal, setRoleModal] = useState(false);
  // Owner can preview the app as another role (account menu → Skipta um hlutverk).
  const [role, setRoleState] = useState<Role>(account.role);
  const [dark, setDark] = useState(false);

  // Apply persisted theme + cookie choice on mount (avoids hydration mismatch).
  useEffect(() => {
    const isDark = localStorage.getItem("vakto-theme") === "dark";
    if (isDark) document.documentElement.classList.add("dark");
    const cookieSet = localStorage.getItem("vakto-cookie");
    requestAnimationFrame(() => {
      if (isDark) setDark(true);
      if (!cookieSet) setCookie(true);
    });
  }, []);
  function dismissCookie(allow: boolean) {
    setCookie(false);
    try { localStorage.setItem("vakto-cookie", allow ? "all" : "deny"); } catch {}
    toast(allow ? t("cookie:allow") : t("cookie:deny"));
  }
  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle("dark", next);
    try { localStorage.setItem("vakto-theme", next ? "dark" : "light"); } catch {}
    setMenu(null);
    toast(next ? t("Dökkt útlit virkt") : t("Ljóst útlit virkt"));
  }

  const ident = role === account.role ? account : ROLE_IDENTITY[role];
  const { groups, foot } = visibleFor(role);

  function switchRole(r: Role) {
    setRoleState(r);
    setRoleModal(false);
    setMenu(null);
    const allowed = visibleFor(r);
    const first = allowed.groups[0]?.items[0]?.href ?? "/maelabord";
    const current = [...allowed.groups.flatMap((g) => g.items), ...allowed.foot].some((i) =>
      pathname.startsWith(i.href),
    );
    if (!current) router.push(first);
    toast("Skoða sem " + ROLE_IDENTITY[r].name);
  }

  function openMenu(
    e: React.MouseEvent<HTMLButtonElement>,
    which: "lang" | "new" | "notif" | "acct",
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
    router.push("/login");
    router.refresh();
  }

  const active = (href: string) =>
    pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      <div
        className={`backdrop${navOpen ? " show" : ""}`}
        onClick={() => setNavOpen(false)}
      />
      <div className="app">
        {/* ---------- sidebar ---------- */}
        <aside className={`side${navOpen ? " open" : ""}`}>
          <div className="brand">
            <div className="m">
              <Logo size={26} />
            </div>
            <b>VAKTO</b>
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
                {!collapsed[g.title] &&
                  g.items.map((it) => (
                    <Link
                      key={it.slug}
                      href={it.href}
                      className={active(it.href) ? "on" : ""}
                      onClick={() => setNavOpen(false)}
                    >
                      <Icon name={it.icon} />
                      {t("nav:" + it.slug)}
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
                onClick={() => setNavOpen(false)}
              >
                <Icon name={it.icon} />
                {t("nav:" + it.slug)}
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
            <div className="tsearch">
              <Icon name="search" />
              <input placeholder={t("search")} />
            </div>
            <div className="tactions">
              <button
                className="ticon"
                title="Tungumál"
                onClick={(e) => openMenu(e, "lang")}
              >
                <Icon name="globe" />
              </button>
              <button
                className="btn sm tnew"
                onClick={(e) => openMenu(e, "new")}
              >
                <Icon name="plus" strokeWidth={2.2} />
                <span className="tnew-label">{t("create")}</span>
                <Icon name="chevron" className="chev" strokeWidth={2} />
              </button>
              <button
                className="ticon"
                title="Tilkynningar"
                onClick={(e) => openMenu(e, "notif")}
              >
                <Icon name="bell" />
              </button>
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
                <div className="mi" onClick={() => { setMenu(null); toast("Tiếng Việt — væntanlegt"); }}>
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
            {menu === "notif" && (
              <>
                <div className="mhd"><b>{t("notifications")}</b></div>
                <div style={{ padding: "18px 14px", textAlign: "center", color: "var(--ink3)", fontSize: 13 }}>
                  {t("Engar nýjar tilkynningar")}
                </div>
              </>
            )}
            {menu === "acct" && (
              <>
                <div className="mhd">
                  <b>{ident.name}</b>
                  <span>{ident.company} · {t("role:" + role)}</span>
                </div>
                <div className="sep" />
                <div className="mi" onClick={() => { setMenu(null); setRoleModal(true); }}>
                  <Icon name="swap" className="ei" />{t("acct:role")}
                </div>
                <div className="mi" onClick={() => nav("/stillingar?new=location")}>
                  <Icon name="building" className="ei" />{t("acct:loc")}
                </div>
                <div className="mi" onClick={() => nav("/kiosk")}>
                  <Icon name="kclock" className="ei" />{t("acct:kiosk")}
                </div>
                <div className="mi" onClick={() => nav("/stillingar")}>
                  <Icon name="settings" className="ei" />{t("acct:settings")}
                </div>
                <div className="mi" onClick={() => nav("/hjalp")}>
                  <Icon name="help" className="ei" />{t("acct:help")}
                </div>
                <div className="mi" onClick={() => { setLang(lang === "is" ? "en" : "is"); setMenu(null); }}>
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

      {/* ---------- floating support chat ---------- */}
      <div className={`cw${chatOpen ? " show" : ""}`}>
        <div className="cwh">
          <b>{t("chat:title")}</b>
          <span>{t("chat:sub")}</span>
          <button className="x" onClick={() => setChatOpen(false)}>✕</button>
        </div>
        <div className="cwb">
          <div className="bub">{t("chat:hi")}</div>
          <div className="bub">{t("chat:hint")}</div>
        </div>
        <div className="cwf">
          <input placeholder={t("chat:ph")} />
          <button onClick={() => toast("Skilaboð send")}>
            <Icon name="chevron" />
          </button>
        </div>
      </div>
      <button
        className="fab"
        title="Aðstoð"
        onClick={() => setChatOpen((o) => !o)}
      >
        <Icon name="chat" />
        {!chatOpen && <span className="fdot">1</span>}
      </button>

      {/* ---------- cookie consent ---------- */}
      {cookie && (
        <div className="cookie">
          <h4>{t("cookie:h")}</h4>
          <p>
            {t("cookie:p")}{" "}
            <a onClick={() => toast(t("cookie:more"))}>{t("cookie:more")}</a>
          </p>
          <div className="crow">
            <button
              className="allow"
              onClick={() => dismissCookie(true)}
            >
              {t("cookie:allow")}
            </button>
            <button
              className="deny"
              onClick={() => dismissCookie(false)}
            >
              {t("cookie:deny")}
            </button>
          </div>
          <button className="cset" onClick={() => toast(t("cookie:settings"))}>
            {t("cookie:settings")}
          </button>
        </div>
      )}

      {/* ---------- role preview ---------- */}
      {roleModal && (
        <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && setRoleModal(false)}>
          <div className="mbg" onClick={() => setRoleModal(false)} />
          <div className="modal">
            <div className="mh"><div style={{ fontSize: 16, fontWeight: 700 }}>Skipta um aðgang</div><button className="x" onClick={() => setRoleModal(false)}>✕</button></div>
            <div className="mb">
              <p className="muted" style={{ fontSize: 12.5, marginBottom: 12 }}>Sjáðu hvernig kerfið lítur út fyrir hvert hlutverk:</p>
              <div className="att">
                {([
                  ["owner", "M4 18h16M4 18l-1.5-9 5 4L12 5l4.5 8 5-4L20 18", "Stjórnandi — Bjarni", "full yfirsýn, laun, áskrift, allar síður"],
                  ["manager", "RECT", "Vaktstjóri — Jón", "vaktir, tímar, starfsfólk, skýrslur — ekki áskrift"],
                  ["employee", "USER", "Starfsmaður — Mína", "aðeins eigin vaktir, tímar, laun og beiðnir"],
                  ["contractor", "TRUCK", "Verktaki — verktaka-aðgangur", "eigin tímar & verk, útselt vs kostnaður (GPS-verkskráning)"],
                ] as const).map(([r, icon, title, desc]) => (
                  <div className="it rowlink" key={r} onClick={() => switchRole(r)}>
                    <div className="ic info">
                      <svg className="ei" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        {icon === "RECT" ? <><rect x="3" y="7.5" width="18" height="12" rx="2" /><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5" /></>
                          : icon === "USER" ? <><circle cx="12" cy="8" r="3.5" /><path d="M5 20a7 7 0 0 1 14 0" /></>
                            : icon === "TRUCK" ? <><path d="M3 13l1.8-5h9.4l3 4H20v4h-2.2M3 13v4h2.2" /><circle cx="7.5" cy="17" r="1.7" /><circle cx="16.5" cy="17" r="1.7" /></>
                              : <path d={icon} />}
                      </svg>
                    </div>
                    <div className="tx"><b>{title}</b><span>{desc}</span></div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      <ToastHost />
    </>
  );
}

const ROLE_IDENTITY: Record<Role, Account> = {
  owner: { initials: "BL", name: "Bjarni Lúðvíksson", company: "Kaffi Krónan", role: "owner" },
  manager: { initials: "JÓ", name: "Jón G.", company: "Kaffi Krónan", role: "manager" },
  employee: { initials: "MÍ", name: "Mína Huong", company: "Kaffi Krónan", role: "employee" },
  contractor: { initials: "VK", name: "Verktaki", company: "Kaffi Krónan", role: "contractor" },
};
