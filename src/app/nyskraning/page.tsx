import type { Metadata } from "next";
import "../login/login.css";
import SignupForm from "./signup-form";

export const metadata: Metadata = { title: "VAKTO — Stofna aðgang" };

export default async function SignupPage() {
  return (
    <div className="wrap">
      <div className="left">
        <SignupForm />
      </div>
      <div className="right">
        <div className="tag">14 daga frí prufa</div>
        <div className="mid">
          <h2>Stofnaðu aðgang <span className="arr">→</span> fyrsta planið í dag.</h2>
          <p className="desc">
            Þú stofnar fyrirtækið, lest starfsfólkið inn úr Excel og birtir fyrsta
            planið á korteri. Prufan er með öllu innifalið — ekkert læst.
          </p>
          <div className="bullets">
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> 14 dagar frítt — engin binding, hættu hvenær sem er</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Eftir prufuna: 5.990 kr/mán fyrir 5 notendur, +590 kr á notanda umfram (án VSK)</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Við hjálpum við uppsetninguna — hallo@vakto.is eða spjallið á forsíðunni</div>
          </div>
        </div>
        <div className="quote">Starfsfólkið fær boð í pósti og skráir sig inn með sama netfangi — sér vaktirnar sínar, stimplar inn og út og fær skírteinið í símann.</div>
      </div>
    </div>
  );
}
