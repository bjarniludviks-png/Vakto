import type { Metadata } from "next";
import "./login.css";
import LoginForm from "./login-form";

export const metadata: Metadata = {
  title: "VAKTO — Skrá inn",
};

export default function LoginPage() {
  return (
    <div className="wrap">
      <div className="left">
        <LoginForm />
      </div>

      <div className="right">
        <div className="tag">Vinnuafls-arðsemi fyrir fyrirtæki</div>
        <div className="mid">
          <h2>
            Vaktaplan <span className="arr">→</span> mæting{" "}
            <span className="arr">→</span> laun <span className="arr">→</span>{" "}
            arðsemi.
          </h2>
          <p className="desc">
            Vakto sýnir þér laun sem hlutfall af veltu í rauntíma, ber áætlað
            vaktaplan saman við raunverulega tíma, og hjálpar þér að halda
            launakostnaði í skefjum — áður en mánuðurinn er búinn.
          </p>
          <div className="bullets">
            <div className="bullet">
              <span className="ck">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4 4 10-10" />
                </svg>
              </span>{" "}
              Laun vs velta í rauntíma
            </div>
            <div className="bullet">
              <span className="ck">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4 4 10-10" />
                </svg>
              </span>{" "}
              Íslensk launalógík — kjarasamningar, staðgreiðsla, tryggingagjald
            </div>
            <div className="bullet">
              <span className="ck">
                <svg viewBox="0 0 24 24" fill="none">
                  <path d="M5 12.5l4 4 10-10" />
                </svg>
              </span>{" "}
              Vaktaplan, stimpilklukka og starfsmannaapp á einum stað
            </div>
          </div>
        </div>
        <div className="quote">
          „Vakto sýndi okkur strax hvar launin voru að éta framlegðina — við
          lækkuðum launahlutfallið um 4% á tveimur mánuðum.&quot; —
          veitingahúsaeigandi
        </div>
      </div>
    </div>
  );
}
