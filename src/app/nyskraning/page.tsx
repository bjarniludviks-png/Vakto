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
        <div className="tag">Reksturinn þinn í rauntíma</div>
        <div className="mid">
          <h2>Byrjaðu núna <span className="arr">→</span> sjáðu laun% í dag.</h2>
          <p className="desc">
            14 daga frí prufa. Fyrirtækið, fólkið og fyrsta planið á nokkrum
            mínútum — VAKTO sér um afganginn.
          </p>
          <div className="bullets">
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Laun% af veltu í rauntíma</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Íslensk laun — kjarasamningar, staðgreiðsla, tryggingagjald</div>
            <div className="bullet"><span className="ck"><svg viewBox="0 0 24 24" fill="none"><path d="M5 12.5l4 4 10-10" /></svg></span> Engin binding — hættu hvenær sem er</div>
          </div>
        </div>
        <div className="quote">„Uppsetningin tók korter og launahlutfallið birtist strax fyrsta daginn.&quot; — veitingahúsaeigandi</div>
      </div>
    </div>
  );
}
