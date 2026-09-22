import type { Metadata } from "next";
import "../../login/login.css";
import CardResult from "./card-result";

export const metadata: Metadata = { title: "VAKTO — Kort skráð" };

// Straumur sendir kúnnann hingað eftir kortaskráningu (ok=1) eða ef hætt var við (ok=0).
export default async function CardReturnPage({ searchParams }: { searchParams: Promise<{ ok?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="wrap">
      <div className="left"><CardResult cancelled={sp.ok === "0"} /></div>
      <div className="right">
        <div className="tag">14 daga frí prufa</div>
        <div className="mid">
          <h2>Næst <span className="arr">→</span> fyrsta planið.</h2>
          <p className="desc">Stofnaðu staðina, deildirnar og starfsfólkið (Excel-innlestur er í Starfsfólki) og birtu fyrsta vaktaplanið. Við hjálpum: hallo@vakto.is.</p>
        </div>
      </div>
    </div>
  );
}
