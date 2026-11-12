"use client";

// Efsta valmynd vefsins (forsíða, Verð, Tengingar, Um okkur, lögfræðisíður). Í síma: þrjú strik hægra megin opna valmynd.
import Link from "next/link";
import { useEffect, useState } from "react";
import { AhLogo } from "./ah-footer";
import { useLangSync } from "./lang";
import { LangMenu } from "./lang-menu";
import SiteAnalytics from "./analytics";
import { PATHS, appHref, type PageKey, type SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";

// VAKTO AI-síðan er enn aðeins á /ai (IS/EN eftir vali) — öll mál vísa þangað þar til da/sv/nb-útgáfur koma.
const AI_HREF = "/ai";

export type NavText = { product: string; contracts: string; integrations: string; price: string; about: string; login: string; try: string; open: string; close: string };
const N: Record<SiteLang, NavText> = {
  is: { product: "Kerfið", contracts: "Samningar", integrations: "Tengingar", price: "Verð", about: "Um okkur", login: "Innskráning", try: "Prófa frítt", open: "Opna valmynd", close: "Loka valmynd" },
  en: { product: "Product", contracts: "Contracts", integrations: "Integrations", price: "Pricing", about: "About", login: "Sign in", try: "Try free", open: "Open menu", close: "Close menu" },
  da: da.nav, sv: sv.nav, nb: nb.nav,
};

export default function SiteNav({ home = false, scrolled = true, dark = false, current }: { home?: boolean; scrolled?: boolean; dark?: boolean; current?: PageKey | "ai" }) {
  const lang = useLangSync();
  const t = N[lang];
  const P = PATHS[lang];
  const a = home ? "" : P.home;
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.documentElement.style.overflow = ""; };
  }, [open]);
  const close = () => setOpen(false);
  const cur = (k: PageKey | "ai") => (current === k ? "page" as const : undefined);
  return (
    <nav className={`ah-nav${scrolled || open ? " sc" : ""}${dark && !open ? " dk" : ""}${open ? " open" : ""}`}>
      <Link href={P.home} aria-label="VAKTO" onClick={close}><AhLogo /></Link>
      <div className="ah-nav-links">
        <a href={`${a}#kerfid`}>{t.product}</a>
        <Link href={AI_HREF} aria-current={cur("ai")}>VAKTO AI</Link>
        <a href={`${a}#samningar`}>{t.contracts}</a>
        <Link href={P.integrations} aria-current={cur("integrations")}>{t.integrations}</Link>
        <Link href={P.price} aria-current={cur("price")}>{t.price}</Link>
        <Link href={P.about} aria-current={cur("about")}>{t.about}</Link>
      </div>
      <div className="ah-nav-cta">
        <span className="ah-nav-desk"><LangMenu /></span>
        <Link href={appHref(lang, "/login")} className="ah-nav-in ah-nav-desk">{t.login}</Link>
        <Link href={appHref(lang, "/nyskraning")} className="ah-btn ah-btn-sm">{t.try}</Link>
        <button type="button" className="ah-burger" aria-expanded={open} aria-controls="ah-menu" aria-label={open ? t.close : t.open} onClick={() => setOpen((o) => !o)}>
          <i /><i />
        </button>
      </div>
      <SiteAnalytics />
      <div id="ah-menu" className="ah-menu" hidden={!open}>
        <a href={`${a}#kerfid`} onClick={close}>{t.product}</a>
        <Link href={AI_HREF} onClick={close}>VAKTO AI</Link>
        <a href={`${a}#samningar`} onClick={close}>{t.contracts}</a>
        <Link href={P.integrations} onClick={close}>{t.integrations}</Link>
        <Link href={P.price} onClick={close}>{t.price}</Link>
        <Link href={P.about} onClick={close}>{t.about}</Link>
        <Link href={appHref(lang, "/login")} onClick={close}>{t.login}</Link>
        <LangMenu variant="sheet" />
      </div>
    </nav>
  );
}
