"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOwnerAccount, requestSignupCode, startCardSetup, verifySignupCode } from "./actions";
import { passwordStrength, PASSWORD_MIN } from "@/lib/password";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/turnstile";

const PLAN = { id: "vakto", price: "5.990", per: "kr/mán · 5 notendur innifaldir", extra: "+590 kr á hvern notanda umfram · árlega 5.090 + 500" };

const Bars = () => (
  <div className="m"><svg viewBox="0 0 28 28" fill="none">
    <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
    <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
    <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
  </svg></div>
);

type Step = "email" | "code" | "account" | "card";
const STEPS: { id: Step; label: string }[] = [
  { id: "email", label: "1 · Netfang" }, { id: "account", label: "2 · Aðgangur" }, { id: "card", label: "3 · Prufa" },
];

function Steps({ cur }: { cur: Step }) {
  const idx = STEPS.findIndex((s) => s.id === (cur === "code" ? "email" : cur));
  return (
    <div className="steps2">
      {STEPS.map((s, i) => (
        <span key={s.id} style={{ display: "contents" }}>
          {i > 0 && <span className="sep">→</span>}
          <span className={i < idx ? "done" : i === idx ? "cur" : ""}>{s.label}</span>
        </span>
      ))}
    </div>
  );
}

const Err = ({ msg }: { msg: string | null }) => msg ? <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginBottom: 14 }}>{msg}</div> : null;

export default function SignupForm() {
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [proof, setProof] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [terms, setTerms] = useState(false);
  const [captcha, setCaptcha] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const codeRef = useRef<HTMLInputElement>(null);
  const pw = useMemo(() => passwordStrength(password), [password]);

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [cooldown]);
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  async function sendCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    if (TURNSTILE_SITE_KEY && !captcha) { setError("Augnablik — bot-vörnin er að klára."); return; }
    setBusy(true);
    try {
      const r = await requestSignupCode(email, captcha);
      if (!r.ok) { setError(r.error ?? "Tókst ekki að senda kóða"); return; }
      setCode(""); setCooldown(30); setStep("code");
    } catch { setError("Tókst ekki að tengjast — reyndu aftur."); }
    finally { setBusy(false); }
  }

  async function checkCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) { setError("Kóðinn er 6 tölustafir"); return; }
    setBusy(true);
    try {
      const r = await verifySignupCode(email, digits);
      if (!r.ok) { setError(r.error ?? "Rangur kóði"); return; }
      setProof(r.proof ?? "demo"); setStep("account");
    } catch { setError("Tókst ekki að tengjast — reyndu aftur."); }
    finally { setBusy(false); }
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pw.ok) { setError(pw.reason ?? "Lykilorðið er of veikt"); return; }
    if (!terms) { setError("Þú þarft að samþykkja skilmála og persónuverndarstefnu"); return; }
    setBusy(true);
    try {
      const res = await createOwnerAccount({ fullName, companyName, email, password, country: "IS", proof: proof ?? undefined, termsAccepted: terms });
      if (!res.ok) {
        setError(res.error ?? "Tókst ekki að stofna aðgang");
        if (/Staðfesting netfangs/.test(res.error ?? "")) { setProof(null); setStep("email"); }
        return;
      }
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
    // Prufan hefst núna. Kortið er skráð hjá Straumi (0 kr) og fyrsta gjaldið
    // tekið þegar prufan er búin — eða beint inn ef greiðslur eru ekki tengdar.
    setBusy(true); setError(null);
    const r = await startCardSetup(window.location.origin);
    if (!r.ok) { setError(r.error ?? "Tókst ekki"); setBusy(false); return; }
    window.location.assign(r.skip ? "/maelabord" : r.url!);
  }

  if (step === "card") {
    return (
      <form className="form" onSubmit={finish}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="card" />
        <h1>14 daga frí prufa</h1>
        <div className="sub">Skráðu kort núna — ekkert er dregið fyrr en prufan er búin, og þú getur hætt hvenær sem er.</div>

        <div className="planpick" style={{ gridTemplateColumns: "1fr" }}>
          <div className="planopt on" style={{ cursor: "default" }}>
            <div className="pn">VAKTO</div>
            <div className="pp">{PLAN.price} kr <small>{PLAN.per}</small></div>
            <div className="pb">{PLAN.extra}</div>
            <div className="pb">Verð án VSK · fyrsta gjaldið er tekið eftir 14 daga · kvittun í pósti</div>
          </div>
        </div>

        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Opna greiðslusíðu…" : "Skrá kort og byrja prufuna"}</button>
        <p className="pcy">Kortið er skráð hjá Straumi (Kvika) á öruggri greiðslusíðu · VAKTO geymir aldrei kortanúmer · hættu hvenær sem er í Stillingum</p>
      </form>
    );
  }

  if (step === "email") {
    return (
      <form className="form" onSubmit={sendCode}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="email" />
        <h1>Stofna aðgang</h1>
        <div className="sub">Við sendum þér 6 stafa kóða til að staðfesta netfangið — kvittanir og „gleymt lykilorð“ fara þangað.</div>

        <div className="field"><div className="lbl"><label htmlFor="em">Vinnunetfang</label></div><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="netfang@fyrirtaeki.is" autoComplete="email" autoFocus required /></div>
        <Turnstile onToken={setCaptcha} />
        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy}>{busy ? "Sendi kóða…" : "Senda staðfestingarkóða"}</button>

        <p className="pcy" style={{ marginTop: 14 }}>14 daga frí prufa · engin binding · kort skráð í síðasta skrefi, ekkert dregið fyrr en prufan er búin.</p>
        <div className="foot">Ertu með aðgang? <Link href="/login">Skrá inn</Link></div>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form className="form" onSubmit={checkCode}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="code" />
        <h1>Sláðu inn kóðann</h1>
        <div className="sub">Við sendum 6 stafa kóða á <b style={{ color: "var(--ink)" }}>{email}</b>. Athugaðu ruslpóst ef hann skilar sér ekki á mínútu.</div>

        <div className="field">
          <div className="lbl"><label htmlFor="code">Staðfestingarkóði</label></div>
          <input id="code" ref={codeRef} className="codein" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder="••••••" maxLength={6} required />
        </div>
        <div className="codehint">
          <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0}>{cooldown > 0 ? `Senda aftur (${cooldown}s)` : "Senda kóða aftur"}</button>
          <button type="button" onClick={() => { setStep("email"); setError(null); }}>Breyta netfangi</button>
        </div>
        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? "Athuga…" : "Staðfesta"}</button>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={submitAccount}>
      <div className="brand"><Bars /><b>VAKTO</b></div>
      <Steps cur="account" />
      <h1>Um þig og fyrirtækið</h1>
      <div className="sub">Netfangið {email} er staðfest. Korter — og þú ert í loftinu.</div>

      <div className="field"><div className="lbl"><label htmlFor="fn">Fullt nafn</label></div><input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Nafn Nafnsson" autoComplete="name" autoFocus required /></div>
      <div className="field"><div className="lbl"><label htmlFor="co">Fyrirtæki</label></div><input id="co" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Fyrirtækið ehf" autoComplete="organization" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="pw">Lykilorð</label></div>
        <div className="pwwrap">
          <input id="pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`a.m.k. ${PASSWORD_MIN} stafir — setning með bilum er fín`} autoComplete="new-password" minLength={PASSWORD_MIN} required />
          <button type="button" className="pweye" aria-label={showPw ? "Fela lykilorð" : "Sýna lykilorð"} onClick={() => setShowPw((v) => !v)}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.5 10.5 0 0 1 12 20c-7 0-10-8-10-8a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A9.9 9.9 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m2 2 20 20" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        </div>
        {password.length > 0 && (
          <div className="pwmeter">
            <div className="bars">{[1, 2, 3, 4].map((i) => <i key={i} className={i <= pw.score ? `s${pw.score}` : ""} />)}</div>
            <span className="lbl2" style={{ color: pw.score <= 1 ? "var(--bad)" : pw.score === 2 ? "#bf8f3a" : "var(--good, #1f9d6b)" }}>{pw.label}</span>
            {!pw.ok && pw.reason && <div className="why">{pw.reason}</div>}
            {pw.ok && pw.score === 2 && <div className="why">Lengra lykilorð eða þrjú óskyld orð gerir það sterkara.</div>}
          </div>
        )}
      </div>

      <label className="chk">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
        <span>Ég samþykki <a href="/skilmalar" target="_blank" rel="noreferrer">skilmála</a> (þ.m.t. vinnslusamning) og <a href="/personuvernd" target="_blank" rel="noreferrer">persónuverndarstefnu</a> VAKTO.</span>
      </label>

      <Err msg={error} />
      <button className="btn" type="submit" disabled={busy}>{busy ? "Stofna…" : "Halda áfram"}</button>
      <div className="foot">Ertu með aðgang? <Link href="/login">Skrá inn</Link></div>
    </form>
  );
}
