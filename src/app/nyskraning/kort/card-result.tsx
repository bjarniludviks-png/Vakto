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

export default function CardResult({ cancelled }: { cancelled: boolean }) {
  const [card, setCard] = useState<{ last4: string | null; brand: string | null } | null>(null);
  const [waited, setWaited] = useState(0);
  const [busy, setBusy] = useState(false);

  // Tokenið kemur með webhook nokkrum sekúndum eftir að Straumur sendir fólk til baka.
  useEffect(() => {
    if (cancelled) return;
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
  }, [cancelled]);

  async function retry() {
    setBusy(true);
    const r = await startCardSetup(window.location.origin);
    if (r.ok && r.url) window.location.assign(r.url); else if (r.ok && r.skip) window.location.assign("/maelabord"); else setBusy(false);
  }

  const brand = card?.brand === "VI" ? "Visa" : card?.brand === "MC" ? "Mastercard" : card?.brand ?? "Kort";
  return (
    <div className="form">
      <div className="brand"><Bars /><b>VAKTO</b></div>
      {cancelled ? (
        <>
          <h1>Hætt við kortaskráningu</h1>
          <div className="sub">Prufan er samt byrjuð. Þú getur skráð kortið núna eða síðar í Stillingum → Áskrift; það þarf að vera komið áður en prufan rennur út.</div>
          <button className="btn" onClick={retry} disabled={busy}>{busy ? "Opna…" : "Skrá kort núna"}</button>
          <div className="foot"><a href="/maelabord">Skrá kort síðar og opna VAKTO</a></div>
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
