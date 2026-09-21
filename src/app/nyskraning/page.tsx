import type { Metadata } from "next";
import "../login/login.css";
import SignupForm from "./signup-form";

export const metadata: Metadata = { title: "VAKTO — Stofna aðgang" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ plan?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="wrap">
      <div className="left">
        <SignupForm initialPlan={sp.plan ?? "vakto"} />
      </div>
      <div className="right">
        <div className="tag">Byrjaðu frítt</div>
        <div className="mid">
          <h2>Stofnaðu aðgang <span className="arr">→</span> sjáðu laun% í dag.</h2>
          <p className="desc">
            Ekkert kort. Fyrirtækið, fólkið og fyrsta planið á nokkrum mínútum —
            starfsfólkið má lesa inn úr Excel.
          </p>
          <div className="bullets">
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Frítt fyrir allt að 10 notendur</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Pro: 590 kr á notanda á mánuði — 14 daga frí prufa</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Engin binding — hættu hvenær sem er</div>
          </div>
        </div>
        <div className="quote">Íslensk laun eftir kjarasamningum, flutt beint í Payday. Skírteini, spjall og ráðningarsamningar í appinu.</div>
      </div>
    </div>
  );
}
