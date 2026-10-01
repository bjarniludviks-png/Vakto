import type { Metadata } from "next";
import "../../login/login.css";
import "../home.css";
import "../auth.css";
import LoginForm from "../../login/login-form";
import { pickLang } from "../../login/login-i18n";
import { Phone } from "../home-client";

// Innskráning í útliti nýju forsíðunnar (tilraun). Sama form og /login.
export const metadata: Metadata = { title: "VAKTO: Skrá inn", robots: { index: false, follow: false } };

export default async function Page({ searchParams }: { searchParams: Promise<{ lang?: string | string[] }> }) {
  const lang = pickLang((await searchParams).lang);
  return (
    <div className="ah-auth">
      <div className="ah-auth-l">
        <div className="ah-auth-top">
          <a href="/ny-heimasida" aria-label="VAKTO forsíða" className="ah-logo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.3" /><rect x="10" y="8" width="4" height="12" rx="1.3" /><rect x="17" y="4" width="4" height="16" rx="1.3" /></svg>VAKTO</a>
          <a href="/ny-heimasida/prufa">Prófa frítt</a>
        </div>
        <LoginForm lang={lang} demo={!!(process.env.DEMO_LOGIN_EMAIL && process.env.DEMO_LOGIN_PASSWORD)} />
      </div>
      <div className="ah-auth-r">
        <div>
          <h2>Vaktin er þegar byrjuð.</h2>
          <p>Planið, stimplanirnar og laun % af veltu bíða eftir þér, uppfærð í rauntíma.</p>
        </div>
        <Phone live src="/showcase/forsida/light/app-heim.png" alt="VAKTO-appið: starfsmaður á vakt" />
      </div>
    </div>
  );
}
