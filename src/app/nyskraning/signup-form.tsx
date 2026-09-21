"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOwnerAccount, setCompanyPlan } from "./actions";

const PLAN = { id: "vakto", price: "5.990", per: "kr/mán · 5 notendur innifaldir", extra: "+590 kr á hvern notanda umfram · árlega 5.090 + 500" };

const Bars = () => (
  <div className="m"><svg viewBox="0 0 28 28" fill="none">
    <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
    <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
    <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
  </svg></div>
);

export default function SignupForm() {
  const [step, setStep] = useState<"account" | "card">("account");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [country, setCountry] = useState<"IS" | "OTHER">("IS");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);


  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setBusy(true);
    try {
      const res = await createOwnerAccount({ fullName, companyName, email, password, country });
      if (!res.ok) { setError(res.error ?? "Tókst ekki að stofna aðgang"); return; }
      if (!res.demo) {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({ email, password });
      }
      setStep("card");
    } catch {
      setError("Tókst ekki að tengjast — er Supabase stillt?");
    } finally { setBusy(false); }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    // No card at signup: the 14-day trial starts here. Billing is set up in
    // Stillingar → Áskrift when the trial ends.
    setBusy(true);
    await setCompanyPlan(PLAN.id);
    window.location.assign("/maelabord");
  }

  if (step === "card") {
    return (
      <form className="form" onSubmit={finish}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <div className="steps2">
          <span className="done">1 · Aðgangur</span><span className="sep">→</span><span className="cur">2 · Prufa</span>
        </div>
        <h1>14 daga frí prufa</h1>
        <div className="sub">Allt innifalið frá fyrsta degi. Ekkert kort, engin binding.</div>

        <div className="planpick" style={{ gridTemplateColumns: "1fr" }}>
          <div className="planopt on" style={{ cursor: "default" }}>
            <div className="pn">VAKTO</div>
            <div className="pp">{PLAN.price} kr <small>{PLAN.per}</small></div>
            <div className="pb">{PLAN.extra}</div>
            <div className="pb">Verð án VSK · reikningur eftir prufuna ef þú heldur áfram</div>
          </div>
        </div>

        {error && <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
        <button className="btn" type="submit" disabled={busy}>{busy ? "Opna…" : "Byrja prufuna"}</button>
        <p className="pcy">Þú færð póst áður en prufan rennur út · hættu hvenær sem er í Stillingum</p>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={submitAccount}>
      <div className="brand"><Bars /><b>VAKTO</b></div>
      <div className="steps2">
        <span className="cur">1 · Aðgangur</span><span className="sep">→</span><span>2 · Áskrift</span>
      </div>
      <h1>Stofna aðgang</h1>
      <div className="sub">Korter — og þú ert í loftinu.</div>

      <div className="field"><div className="lbl"><label htmlFor="fn">Fullt nafn</label></div><input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nafn Nafnsson" autoComplete="name" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="co">Fyrirtæki</label></div><input id="co" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Fyrirtækið ehf" autoComplete="organization" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="ct">Land</label></div>
        <select id="ct" value={country} onChange={(e) => setCountry(e.target.value as "IS" | "OTHER")}>
          <option value="IS">Ísland — kjarasamningar, uppbætur, Payday</option>
          <option value="OTHER">Annað land — staðlaðar reglur</option>
        </select>
      </div>
      <div className="field"><div className="lbl"><label htmlFor="em">Netfang</label></div><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netfang@fyrirtaeki.is" autoComplete="email" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="pw">Lykilorð</label></div>
        <div className="pwwrap">
          <input id="pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="a.m.k. 8 stafir" autoComplete="new-password" required />
          <button type="button" className="pweye" aria-label={showPw ? "Fela lykilorð" : "Sýna lykilorð"} onClick={() => setShowPw((v) => !v)}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.5 10.5 0 0 1 12 20c-7 0-10-8-10-8a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A9.9 9.9 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m2 2 20 20" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        </div>
      </div>

      {error && <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Stofna…" : "Halda áfram"}</button>

      <div className="foot">Ertu með aðgang? <Link href="/login">Skrá inn</Link></div>
    </form>
  );
}
