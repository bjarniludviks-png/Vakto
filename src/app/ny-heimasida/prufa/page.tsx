import type { Metadata } from "next";
import "../../login/login.css";
import "../home.css";
import "../auth.css";
import SignupForm from "../../nyskraning/signup-form";

// „Prófa frítt“ í útliti nýju forsíðunnar (tilraun). Sama nýskráningarflæði og /nyskraning.
export const metadata: Metadata = { title: "VAKTO: Prófa frítt", robots: { index: false, follow: false } };

export default function Page() {
  return (
    <div className="ah-auth">
      <div className="ah-auth-l">
        <div className="ah-auth-top">
          <a href="/ny-heimasida" aria-label="VAKTO forsíða" className="ah-logo"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="12" width="4" height="8" rx="1.3" /><rect x="10" y="8" width="4" height="12" rx="1.3" /><rect x="17" y="4" width="4" height="16" rx="1.3" /></svg>VAKTO</a>
          <a href="/ny-heimasida/innskraning">Innskráning</a>
        </div>
        <SignupForm />
      </div>
      <div className="ah-auth-r">
        <div>
          <h2>Fyrsta planið í dag.</h2>
          <p>Stofnaðu fyrirtækið, lestu starfsfólkið inn úr Excel og birtu planið. Prufan er með öllu, ekkert læst.</p>
        </div>
        <ul>
          <li>14 dagar frítt, ekkert dregið fyrr en prufan er búin</li>
          <li>Svo 9.990 kr/mán með 5 virkum starfsmönnum, 1.490 kr á hvern umfram (án VSK)</li>
          <li>Engin binding. Þú borgar aðeins fyrir þá sem unnu í mánuðinum</li>
          <li>Við hjálpum við uppsetninguna á hallo@vakto.is</li>
        </ul>
      </div>
    </div>
  );
}
