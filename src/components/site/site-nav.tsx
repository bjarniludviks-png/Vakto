"use client";

// Efsta valmynd vefsins (forsíða, Um okkur, lögfræðisíður).
import Link from "next/link";
import { AhLogo } from "./ah-footer";
import { LangToggle, useLangSync } from "./lang";

const N = {
  is: { product: "Kerfið", contracts: "Samningar", price: "Verð", about: "Um okkur", login: "Innskráning", try: "Prófa frítt" },
  en: { product: "Product", contracts: "Contracts", price: "Pricing", about: "About", login: "Sign in", try: "Try free" },
};

export default function SiteNav({ home = false, scrolled = true, dark = false, current }: { home?: boolean; scrolled?: boolean; dark?: boolean; current?: "about" }) {
  const t = N[useLangSync()];
  const a = home ? "" : "/";
  return (
    <nav className={`ah-nav${scrolled ? " sc" : ""}${dark ? " dk" : ""}`}>
      <Link href="/" aria-label="VAKTO"><AhLogo /></Link>
      <div className="ah-nav-links">
        <a href={`${a}#kerfid`}>{t.product}</a><a href={`${a}#samningar`}>{t.contracts}</a><a href={`${a}#verd`}>{t.price}</a>
        <Link href="/um-okkur" aria-current={current === "about" ? "page" : undefined}>{t.about}</Link>
      </div>
      <div className="ah-nav-cta">
        <LangToggle />
        <Link href="/login" className="ah-nav-in">{t.login}</Link>
        <Link href="/nyskraning" className="ah-btn ah-btn-sm">{t.try}</Link>
      </div>
    </nav>
  );
}
