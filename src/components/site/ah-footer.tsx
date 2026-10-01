"use client";

// Fótur vefsins (forsíða, Um okkur, innskráning/lögfræði). IS/EN eftir vali notandans.
import Link from "next/link";
import { useSiteLang } from "./lang";

export function AhLogo() {
  return (
    <span className="ah-logo" translate="no">
      <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.3" /><rect x="10" y="8" width="4" height="12" rx="1.3" /><rect x="17" y="4" width="4" height="16" rx="1.3" /></svg>
      VAKTO
    </span>
  );
}

const SOCIAL: [string, string, boolean][] = [["https://www.instagram.com/vakto.is", "Instagram", true], ["https://www.facebook.com/vakto.is", "Facebook", true], ["https://www.linkedin.com/company/vakto", "LinkedIn", true]];
const F = {
  is: {
    desc: "Vaktaplan, stimpilklukka, laun og ráðningarsamningar. Og launin sem hlutfall af veltu í rauntíma. Hannað fyrir íslenska vinnustaði.",
    cols: [
      { h: "Vara", links: [["/#kerfid", "Eiginleikar"], ["/#kynning", "Kynntu þér VAKTO"], ["/#samningar", "Samningar"], ["/#verd", "Verð"], ["/nyskraning", "Prófa frítt"]] },
      { h: "Fyrirtækið", links: [["/um-okkur", "Um okkur"], ["mailto:hallo@vakto.is", "Hafa samband"], ["/login", "Innskráning"]] },
      { h: "Lögfræði", links: [["/personuvernd", "Persónuvernd"], ["/skilmalar", "Skilmálar"], ["/vafrakokur", "Vafrakökur"]] },
      { h: "Fylgdu okkur", links: SOCIAL },
    ] as { h: string; links: (string | boolean)[][] }[],
    copy: "© 2026 BGL Ventures ehf. · kt. 490806-0400", made: "Hannað og þróað á Íslandi",
  },
  en: {
    desc: "Scheduling, time clock, payroll and employment contracts. Plus labor as a share of revenue in real time. Built for Icelandic workplaces.",
    cols: [
      { h: "Product", links: [["/#kerfid", "Features"], ["/#kynning", "Get to know VAKTO"], ["/#samningar", "Contracts"], ["/#verd", "Pricing"], ["/nyskraning", "Try free"]] },
      { h: "Company", links: [["/um-okkur", "About"], ["mailto:hallo@vakto.is", "Contact"], ["/login", "Sign in"]] },
      { h: "Legal", links: [["/personuvernd", "Privacy"], ["/skilmalar", "Terms"], ["/vafrakokur", "Cookies"]] },
      { h: "Follow us", links: SOCIAL },
    ] as { h: string; links: (string | boolean)[][] }[],
    copy: "© 2026 BGL Ventures ehf. · reg. no. 490806-0400", made: "Designed and built in Iceland",
  },
};

export default function AhFooter() {
  const t = F[useSiteLang()];
  return (
    <footer className="ah-foot">
      <div className="ah-foot-grid">
        <div className="ah-foot-brand">
          <Link href="/" aria-label="VAKTO"><AhLogo /></Link>
          <p>{t.desc}</p>
          <a className="ah-foot-mail" href="mailto:hallo@vakto.is">hallo@vakto.is</a>
        </div>
        {t.cols.map((c) => (
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
