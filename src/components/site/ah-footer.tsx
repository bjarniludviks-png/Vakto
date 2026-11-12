"use client";

// Fótur vefsins (forsíða, Um okkur, innskráning/lögfræði). Á máli síðunnar (i18n.ts).
import Link from "next/link";
import { useSiteLang } from "./lang";
import { PATHS, appHref, type SiteLang } from "./i18n";
import * as da from "./text/da";
import * as sv from "./text/sv";
import * as nb from "./text/nb";
import { VaktoLogo } from "@/components/brand/vakto-logo";

/** Merki vefsins = sama merki og í kerfinu (components/brand/vakto-logo.tsx). */
export function AhLogo() {
  return (
    <VaktoLogo size={26} className="ah-logo" />
  );
}

const SOCIAL: [string, string][] = [["https://www.instagram.com/vakto.is", "Instagram"], ["https://www.facebook.com/vakto.is", "Facebook"], ["https://www.linkedin.com/company/vakto", "LinkedIn"]];

/** Texti fótarins. Hlekkirnir sjálfir eru byggðir úr PATHS (i18n.ts) svo hvert mál vísi á sínar síður. */
export type FootText = {
  desc: string;
  product: string; features: string; showcase: string; contracts: string; integrations: string; price: string; contractors: string; try: string;
  company: string; about: string; contact: string; login: string;
  legal: string; privacy: string; terms: string; cookies: string;
  follow: string; copy: string; made: string;
};
const F: Record<SiteLang, FootText> = {
  is: {
    desc: "Vaktaplan, stimpilklukka, laun og ráðningarsamningar. Og launin sem hlutfall af veltu í rauntíma. Hannað fyrir íslenska vinnustaði.",
    product: "Vara", features: "Eiginleikar", showcase: "Kynntu þér VAKTO", contracts: "Samningar", integrations: "Tengingar", price: "Verð", contractors: "Fyrir verktaka", try: "Prófa frítt",
    company: "Fyrirtækið", about: "Um okkur", contact: "Hafa samband", login: "Innskráning",
    legal: "Lögfræði", privacy: "Persónuvernd", terms: "Skilmálar", cookies: "Vafrakökur",
    follow: "Fylgdu okkur", copy: "© 2026 BGL Ventures ehf. · kt. 490806-0400", made: "Hannað og þróað á Íslandi",
  },
  en: {
    desc: "Scheduling, time clock, payroll and employment contracts. Plus labor as a share of revenue in real time. Built for Icelandic workplaces.",
    product: "Product", features: "Features", showcase: "Get to know VAKTO", contracts: "Contracts", integrations: "Integrations", price: "Pricing", contractors: "For contractors", try: "Try free",
    company: "Company", about: "About", contact: "Contact", login: "Sign in",
    legal: "Legal", privacy: "Privacy", terms: "Terms", cookies: "Cookies",
    follow: "Follow us", copy: "© 2026 BGL Ventures ehf. · reg. no. 490806-0400", made: "Designed and built in Iceland",
  },
  da: da.footer, sv: sv.footer, nb: nb.footer,
};

export default function AhFooter() {
  const lang = useSiteLang();
  const t = F[lang];
  const P = PATHS[lang];
  // Lögfræðisíðurnar eru á íslensku (með enskri athugasemd): önnur mál opna þær með ?lang=en.
  const cols: { h: string; links: [string, string, boolean?][] }[] = [
    { h: t.product, links: [[`${P.home}#kerfid`, t.features], ["/ai", "VAKTO AI"], [`${P.home}#kynning`, t.showcase], [`${P.home}#samningar`, t.contracts], [P.integrations, t.integrations], [P.price, t.price], [P.contractors, t.contractors], [appHref(lang, "/nyskraning"), t.try]] },
    { h: t.company, links: [[P.about, t.about], ["mailto:hallo@vakto.is", t.contact], [appHref(lang, "/login"), t.login]] },
    { h: t.legal, links: [[appHref(lang, "/personuvernd"), t.privacy], [appHref(lang, "/skilmalar"), t.terms], [appHref(lang, "/vafrakokur"), t.cookies]] },
    { h: t.follow, links: SOCIAL.map(([u, n]) => [u, n, true]) },
  ];
  return (
    <footer className="ah-foot">
      <div className="ah-foot-grid">
        <div className="ah-foot-brand">
          <Link href={P.home} aria-label="VAKTO"><AhLogo /></Link>
          <p>{t.desc}</p>
          <a className="ah-foot-mail" href="mailto:hallo@vakto.is">hallo@vakto.is</a>
        </div>
        {cols.map((c) => (
          <nav key={c.h} aria-label={c.h}>
            <h2>{c.h}</h2>
            {c.links.map(([href, label, ext]) => <a key={String(label)} href={String(href)} {...(ext ? { target: "_blank", rel: "noreferrer" } : {})}>{label}</a>)}
          </nav>
        ))}
      </div>
      <div className="ah-foot-bot">
        <span>{t.copy}</span>
        <span>{t.made}</span>
      </div>
    </footer>
  );
}
