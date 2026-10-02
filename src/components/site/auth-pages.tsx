"use client";

// Innskráning og nýskráning (IS/EN). Formin sjálf eru LoginForm og SignupForm; hér er umgjörðin.
import Link from "next/link";
import LoginForm from "@/app/login/login-form";
import SignupForm from "@/app/nyskraning/signup-form";
import { AhLogo } from "./ah-footer";
import { MacFrame, Phone } from "./home-client";
import { LangToggle, useLangSync } from "./lang";
import SiteAnalytics from "./analytics";

const T = {
  is: {
    try: "Prófa frítt", login: "Innskráning",
    lh: "Vaktin er þegar byrjuð.", lp: "Planið, stimplanirnar og laun % af veltu bíða eftir þér, uppfærð í rauntíma.", lalt: "VAKTO-appið: starfsmaður á vakt",
    sh: "Fyrsta planið í dag.", sp: "Stofnaðu fyrirtækið, lestu starfsfólkið inn úr Excel og birtu planið. Prufan er með öllu, ekkert læst.",
    sli: ["14 dagar frítt, ekkert dregið fyrr en prufan er búin", "Svo 9.990 kr/mán með 5 virkum starfsmönnum, 1.490 kr á hvern umfram (án VSK)", "Engin binding. Þú borgar aðeins fyrir þá sem unnu í mánuðinum", "Við hjálpum við uppsetninguna á hallo@vakto.is"],
    salt: "Mælaborð VAKTO",
  },
  en: {
    try: "Try free", login: "Sign in",
    lh: "The shift has already started.", lp: "The schedule, clock-ins and labor % of revenue are waiting for you, updated in real time.", lalt: "The VAKTO app: an employee on shift",
    sh: "Your first schedule today.", sp: "Set up your company, import your staff from Excel and publish the schedule. The trial includes everything, nothing is locked.",
    sli: ["14 days free, nothing charged until the trial ends", "Then ISK 9,990/month with 5 active employees, ISK 1,490 per additional one (excl. VAT)", "No commitment. You only pay for those who worked that month", "We help you get set up at hallo@vakto.is"],
    salt: "VAKTO dashboard",
  },
};

function Top({ href, label }: { href: string; label: string }) {
  return (
    <div className="ah-auth-top">
      <Link href="/" aria-label="VAKTO" className="ah-auth-logo"><AhLogo /></Link>
      <span className="ah-auth-top-r"><LangToggle /><Link href={href}>{label}</Link></span>
      <SiteAnalytics />
    </div>
  );
}

export function LoginPage({ demo }: { demo: boolean }) {
  const lang = useLangSync();
  const t = T[lang];
  return (
    <div className="ah-auth">
      <div className="ah-auth-l">
        <Top href="/nyskraning" label={t.try} />
        <LoginForm key={lang} lang={lang} demo={demo} />
      </div>
      <div className="ah-auth-r">
        <div><h2>{t.lh}</h2><p>{t.lp}</p></div>
        <Phone live src="/showcase/forsida/light/app-heim.png" alt={t.lalt} />
      </div>
    </div>
  );
}

export function SignupPage() {
  const lang = useLangSync();
  const t = T[lang];
  return (
    <div className="ah-auth">
      <div className="ah-auth-l">
        <Top href="/login" label={t.login} />
        <SignupForm lang={lang} />
      </div>
      <div className="ah-auth-r">
        <div><h2>{t.sh}</h2><p>{t.sp}</p></div>
        <ul>{t.sli.map((x) => <li key={x}>{x}</li>)}</ul>
        <div className="ah-auth-mac"><MacFrame src="/showcase/forsida/light/maelabord.jpg" alt={t.salt} url="vakto.is/maelabord" /></div>
      </div>
    </div>
  );
}
