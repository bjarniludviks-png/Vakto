"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOwnerAccount, setCompanyPlan } from "./actions";

const PLANS = [
  { id: "vakto", name: "VAKTO", price: "9.990", per: "kr/mán · VSK innifalið", blurb: "Allt innifalið — 5 notendur, +990 kr per notanda umfram" },
];

const Bars = () => (
  <div className="m"><svg viewBox="0 0 28 28" fill="none">
    <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
    <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
    <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
  </svg></div>
);

export default function SignupForm({ initialPlan = "vakto" }: { initialPlan?: string }) {
  const [step, setStep] = useState<"account" | "card">("account");
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [plan, setPlan] = useState(initialPlan || "vakto");
  const [country, setCountry] = useState<"IS" | "OTHER">("IS");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // card (Teya-ready — not charged until Teya is connected)
  const [cardName, setCardName] = useState("");
  const [cardNo, setCardNo] = useState("");
  const [exp, setExp] = useState("");
  const [cvc, setCvc] = useState("");

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

  async function oauth(provider: "google" | "azure" | "apple") {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: `${window.location.origin}/auth/callback?next=/maelabord` } });
      if (error) setError(error.message);
    } catch {
      setError("Innskráning með þessari þjónustu er ekki stillt enn.");
    }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    // Teya is not connected yet — card details are collected but not charged.
    // Record the chosen plan + start the 14-day trial, then enter the app.
    await setCompanyPlan(plan);
    window.location.assign("/maelabord");
  }

  const fmtCard = (v: string) => v.replace(/\D/g, "").slice(0, 16).replace(/(.{4})/g, "$1 ").trim();
  const fmtExp = (v: string) => { const d = v.replace(/\D/g, "").slice(0, 4); return d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d; };

  if (step === "card") {
    const p = PLANS.find((x) => x.id === plan) ?? PLANS[0];
    return (
      <form className="form" onSubmit={finish}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <div className="steps2">
          <span className="done">1 · Aðgangur</span><span className="sep">→</span><span className="cur">2 · Áskrift</span>
        </div>
        <h1>Veldu áskrift</h1>
        <div className="sub">14 daga frí prufa — engin greiðsla fyrr en hún rennur út.</div>

        <div className="planpick">
          {PLANS.map((pl) => (
            <button type="button" key={pl.id} className={`planopt${plan === pl.id ? " on" : ""}`} onClick={() => setPlan(pl.id)}>
              <div className="pn">{pl.name}</div>
              <div className="pp">{pl.price} kr <small>{pl.per}</small></div>
              <div className="pb">{pl.blurb}</div>
            </button>
          ))}
        </div>

        <div className="field"><div className="lbl"><label>Nafn á korti</label></div><input value={cardName} onChange={(e) => setCardName(e.target.value)} placeholder="Nafn Nafnsson" autoComplete="cc-name" /></div>
        <div className="field"><div className="lbl"><label>Kortanúmer</label></div><input value={cardNo} onChange={(e) => setCardNo(fmtCard(e.target.value))} inputMode="numeric" placeholder="1234 5678 9012 3456" autoComplete="cc-number" /></div>
        <div style={{ display: "flex", gap: 12 }}>
          <div className="field" style={{ flex: 1 }}><div className="lbl"><label>Gildir til</label></div><input value={exp} onChange={(e) => setExp(fmtExp(e.target.value))} inputMode="numeric" placeholder="MM/ÁÁ" autoComplete="cc-exp" /></div>
          <div className="field" style={{ flex: 1 }}><div className="lbl"><label>CVC</label></div><input value={cvc} onChange={(e) => setCvc(e.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" placeholder="123" autoComplete="cc-csc" /></div>
        </div>

        {error && <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
        <button className="btn" type="submit">Byrja frí prufu — {p.name}</button>
        <p className="pcy">Greitt með Teya · örugg greiðsla. Þú getur sagt upp hvenær sem er.</p>
        <div className="foot"><a onClick={() => window.location.assign("/maelabord")} style={{ cursor: "pointer" }}>Sleppa í bili</a></div>
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
      <div className="sub">Komdu rekstrinum í VAKTO á nokkrum mínútum.</div>

      <div className="field"><div className="lbl"><label htmlFor="fn">Fullt nafn</label></div><input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nafn Nafnsson" autoComplete="name" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="co">Fyrirtæki</label></div><input id="co" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Fyrirtækið ehf" autoComplete="organization" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="ct">Land</label></div>
        <select id="ct" value={country} onChange={(e) => setCountry(e.target.value as "IS" | "OTHER")}>
          <option value="IS">Ísland — kjarasamningar, uppbætur, Payday</option>
          <option value="OTHER">Annað land — staðlaðar reglur</option>
        </select>
      </div>
      <div className="field"><div className="lbl"><label htmlFor="em">Netfang</label></div><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netfang@fyrirtaeki.is" autoComplete="email" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="pw">Lykilorð</label></div><input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="a.m.k. 8 stafir" autoComplete="new-password" required /></div>

      {error && <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{error}</div>}
      <button className="btn" type="submit" disabled={busy}>{busy ? "Stofna…" : "Halda áfram"}</button>

      <div className="divider">eða</div>
      <button className="soc" type="button" onClick={() => oauth("apple")}><span className="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.3-.9-2.3-3.5zM14.2 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z" /></svg></span> Halda áfram með Apple</button>
      <button className="soc" type="button" onClick={() => oauth("google")}><span className="ic">G</span> Halda áfram með Google</button>
      <button className="soc" type="button" onClick={() => oauth("azure")}><span className="ic"><svg viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="8" height="8" /><rect x="13" y="3" width="8" height="8" /><rect x="3" y="13" width="8" height="8" /><rect x="13" y="13" width="8" height="8" /></svg></span> Halda áfram með Microsoft</button>

      <div className="foot">Ertu með aðgang? <Link href="/login">Skrá inn</Link></div>
    </form>
  );
}
