"use client";

// Efsta valmynd vefsins (forsíða, Um okkur, lögfræðisíður). Í síma: þrjú strik hægra megin opna valmynd.
import Link from "next/link";
import { useEffect, useState } from "react";
import { AhLogo } from "./ah-footer";
import { LangToggle, useLangSync } from "./lang";
import SiteAnalytics from "./analytics";

const N = {
  is: { product: "Kerfið", contracts: "Samningar", price: "Verð", about: "Um okkur", login: "Innskráning", try: "Prófa frítt", open: "Opna valmynd", close: "Loka valmynd" },
  en: { product: "Product", contracts: "Contracts", price: "Pricing", about: "About", login: "Sign in", try: "Try free", open: "Open menu", close: "Close menu" },
};

export default function SiteNav({ home = false, scrolled = true, dark = false, current }: { home?: boolean; scrolled?: boolean; dark?: boolean; current?: "about" }) {
  const t = N[useLangSync()];
  const a = home ? "" : "/";
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!open) return;
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("keydown", esc);
    document.documentElement.style.overflow = "hidden";
    return () => { window.removeEventListener("keydown", esc); document.documentElement.style.overflow = ""; };
  }, [open]);
  const close = () => setOpen(false);
  return (
    <nav className={`ah-nav${scrolled || open ? " sc" : ""}${dark && !open ? " dk" : ""}${open ? " open" : ""}`}>
      <Link href="/" aria-label="VAKTO" onClick={close}><AhLogo /></Link>
      <div className="ah-nav-links">
        <a href={`${a}#kerfid`}>{t.product}</a><a href={`${a}#samningar`}>{t.contracts}</a><a href={`${a}#verd`}>{t.price}</a>
        <Link href="/um-okkur" aria-current={current === "about" ? "page" : undefined}>{t.about}</Link>
      </div>
      <div className="ah-nav-cta">
        <span className="ah-nav-desk"><LangToggle /></span>
        <Link href="/login" className="ah-nav-in ah-nav-desk">{t.login}</Link>
        <Link href="/nyskraning" className="ah-btn ah-btn-sm">{t.try}</Link>
        <button type="button" className="ah-burger" aria-expanded={open} aria-controls="ah-menu" aria-label={open ? t.close : t.open} onClick={() => setOpen((o) => !o)}>
          <i /><i />
        </button>
      </div>
      <SiteAnalytics />
      <div id="ah-menu" className="ah-menu" hidden={!open}>
        <a href={`${a}#kerfid`} onClick={close}>{t.product}</a>
        <a href={`${a}#samningar`} onClick={close}>{t.contracts}</a>
        <a href={`${a}#verd`} onClick={close}>{t.price}</a>
        <Link href="/um-okkur" onClick={close}>{t.about}</Link>
        <Link href="/login" onClick={close}>{t.login}</Link>
        <div className="ah-menu-lang"><LangToggle /></div>
      </div>
    </nav>
  );
}
