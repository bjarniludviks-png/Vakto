"use client";

import { useEffect, useState } from "react";
import { hasCardOnFile, startCardSetup } from "../actions";

const Bars = () => (
  <div className="m"><svg viewBox="0 0 28 28" fill="none">
    <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
    <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
    <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
  </svg></div>
);

export default function CardResult({ cancelled, required = false }: { cancelled: boolean; required?: boolean }) {
  const [card, setCard] = useState<{ last4: string | null; brand: string | null } | null>(null);
  const [waited, setWaited] = useState(0);
  const [busy, setBusy] = useState(false);

  // Tokenið kemur með webhook nokkrum sekúndum eftir að Straumur sendir fólk til baka.
  useEffect(() => {
    if (cancelled || required) return;
    let alive = true;
    const tick = async (n: number) => {
      const r = await hasCardOnFile();
      if (!alive) return;
      if (r.card) { setCard(r.card); return; }
      setWaited(n);
      if (n < 12) setTimeout(() => tick(n + 1), 2500);
    };
    void tick(0);
    return () => { alive = false; };
  }, [cancelled, required]);

  async function retry() {
    setBusy(true);
    const r = await startCardSetup(window.location.origin);
    if (r.ok && r.url) window.location.assign(r.url); else if (r.ok && r.skip) window.location.assign("/maelabord"); else setBusy(false);
  }

  const brand = card?.brand === "VI" ? "Visa" : card?.brand === "MC" ? "Mastercard" : card?.brand ?? "Kort";
  return (
    <div className="form">
      <div className="brand"><Bars /><b>VAKTO</b></div>
      {required ? (
        <>
          <h1>Skráðu kort til að opna VAKTO</h1>
          <div className="sub">Prufan er frí í 14 daga og ekkert er dregið fyrr en hún er búin — en kortið þarf að vera skráð áður en kerfið opnast. Það er geymt hjá Straumi (Kvika), VAKTO geymir aldrei kortanúmer.</div>
          <button className="btn" onClick={retry} disabled={busy}>{busy ? "Opna greiðslusíðu…" : "Skrá kort"}</button>
          <div className="foot"><a href="mailto:hallo@vakto.is">Spurningar? hallo@vakto.is</a></div>
        </>
      ) : cancelled ? (
        <>
          <h1>Hætt við kortaskráningu</h1>
          <div className="sub">Aðgangurinn opnast þegar kortið er skráð. Ekkert er dregið fyrr en 14 daga prufan er búin.</div>
          <button className="btn" onClick={retry} disabled={busy}>{busy ? "Opna…" : "Skrá kort núna"}</button>
          <div className="foot"><a href="mailto:hallo@vakto.is">Spurningar? hallo@vakto.is</a></div>
        </>
      ) : card ? (
        <>
          <h1>Kortið er skráð</h1>
          <div className="sub">{brand} sem endar á {card.last4 ?? "····"}. Ekkert er dregið fyrr en prufan er búin, þá færðu kvittun í pósti.</div>
          <a className="btn" href="/maelabord" style={{ display: "block", textAlign: "center" }}>Opna VAKTO</a>
        </>
      ) : waited < 12 ? (
        <>
          <h1>Staðfesti kortið…</h1>
          <div className="sub">Augnablik, Straumur er að skila staðfestingunni.</div>
        </>
      ) : (
        <>
          <h1>Staðfesting barst ekki enn</h1>
          <div className="sub">Þetta getur tekið mínútu. Þú getur opnað VAKTO núna; kortið birtist í Stillingum → Áskrift um leið og staðfestingin kemur.</div>
          <a className="btn" href="/maelabord" style={{ display: "block", textAlign: "center" }}>Opna VAKTO</a>
          <div className="foot"><a onClick={retry} style={{ cursor: "pointer" }}>Reyna kortaskráningu aftur</a></div>
        </>
      )}
    </div>
  );
}
