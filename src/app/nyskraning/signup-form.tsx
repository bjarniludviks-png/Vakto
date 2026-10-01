"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { createOwnerAccount, requestSignupCode, startCardSetup, verifySignupCode } from "./actions";
import { passwordStrength, PASSWORD_MIN } from "@/lib/password";
import Turnstile, { TURNSTILE_SITE_KEY } from "@/components/turnstile";

export type SignupLang = "is" | "en";
const L = {
  is: {
    per: "kr/mán · 5 virkir starfsmenn innifaldir",
    extra: "+1.490 kr á hvern virkan starfsmann umfram · árlega 8.490 + 1.270",
    cur: "kr",
    st1: "1 · Netfang",
    st2: "2 · Aðgangur",
    st3: "3 · Prufa",
    botWait: "Augnablik — bot-vörnin er að klára.",
    codeFail: "Tókst ekki að senda kóða",
    netErr: "Tókst ekki að tengjast — reyndu aftur.",
    code6: "Kóðinn er 6 tölustafir",
    badCode: "Rangur kóði",
    weak: "Lykilorðið er of veikt",
    needTerms: "Þú þarft að samþykkja skilmála og persónuverndarstefnu",
    createFail: "Tókst ekki að stofna aðgang",
    supa: "Tókst ekki að tengjast — er Supabase stillt?",
    fail: "Tókst ekki",
    trialH: "14 daga frí prufa",
    trialSub: "Skráðu kort núna — ekkert er dregið fyrr en prufan er búin, og þú getur hætt hvenær sem er.",
    vatNote: "Verð án VSK · fyrsta gjaldið er tekið eftir 14 daga · kvittun í pósti",
    opening: "Opna greiðslusíðu…",
    startTrial: "Skrá kort og byrja prufuna",
    cardNote: "Kortið er skráð hjá Straumi (Kvika) á öruggri greiðslusíðu · VAKTO geymir aldrei kortanúmer · hættu hvenær sem er í Stillingum",
    createH: "Stofna aðgang",
    createSub: "Við sendum þér 6 stafa kóða til að staðfesta netfangið — kvittanir og „gleymt lykilorð“ fara þangað.",
    workEmail: "Vinnunetfang",
    emailPh: "netfang@fyrirtaeki.is",
    sending: "Sendi kóða…",
    sendCode: "Senda staðfestingarkóða",
    trialNote: "14 daga frí prufa · engin binding · kort skráð í síðasta skrefi, ekkert dregið fyrr en prufan er búin.",
    haveAcc: "Ertu með aðgang?",
    signIn: "Skrá inn",
    codeH: "Sláðu inn kóðann",
    codeSubA: "Við sendum 6 stafa kóða á ",
    codeSubB: ". Athugaðu ruslpóst ef hann skilar sér ekki á mínútu.",
    codeLbl: "Staðfestingarkóði",
    resendIn: "Senda aftur",
    resend: "Senda kóða aftur",
    changeEmail: "Breyta netfangi",
    checking: "Athuga…",
    confirm: "Staðfesta",
    accH: "Um þig og fyrirtækið",
    accSubA: "Netfangið ",
    accSubB: " er staðfest. Korter — og þú ert í loftinu.",
    fullName: "Fullt nafn",
    namePh: "Nafn Nafnsson",
    company: "Fyrirtæki",
    coPh: "Fyrirtækið ehf",
    pw: "Lykilorð",
    pwPh: "a.m.k. {n} stafir — setning með bilum er fín",
    hidePw: "Fela lykilorð",
    showPw: "Sýna lykilorð",
    stronger: "Lengra lykilorð eða þrjú óskyld orð gerir það sterkara.",
    agreeA: "Ég samþykki ",
    terms: "skilmála",
    agreeB: " (þ.m.t. vinnslusamning) og ",
    privacy: "persónuverndarstefnu",
    agreeC: " VAKTO.",
    creating: "Stofna…",
    cont: "Halda áfram",
  },
  en: {
    per: "ISK/mo · 5 active employees included",
    extra: "+ISK 1,490 per additional active employee · annually 8,490 + 1,270",
    cur: "ISK",
    st1: "1 · Email",
    st2: "2 · Account",
    st3: "3 · Trial",
    botWait: "One moment, the bot check is finishing.",
    codeFail: "Couldn't send the code",
    netErr: "Couldn't connect. Please try again.",
    code6: "The code is 6 digits",
    badCode: "Wrong code",
    weak: "The password is too weak",
    needTerms: "You need to accept the terms and privacy policy",
    createFail: "Couldn't create the account",
    supa: "Couldn't connect. Please try again.",
    fail: "Something went wrong",
    trialH: "14-day free trial",
    trialSub: "Add a card now. Nothing is charged until the trial ends, and you can cancel any time.",
    vatNote: "Prices excl. VAT · first charge after 14 days · receipt by email",
    opening: "Opening payment page…",
    startTrial: "Add card and start the trial",
    cardNote: "Your card is registered with Straumur (Kvika) on a secure payment page · VAKTO never stores card numbers · cancel any time in Settings",
    createH: "Create an account",
    createSub: "We'll send you a 6-digit code to confirm your email. Receipts and password resets go there.",
    workEmail: "Work email",
    emailPh: "name@company.com",
    sending: "Sending code…",
    sendCode: "Send confirmation code",
    trialNote: "14-day free trial · no commitment · card added in the last step, nothing charged until the trial ends.",
    haveAcc: "Already have an account?",
    signIn: "Sign in",
    codeH: "Enter the code",
    codeSubA: "We sent a 6-digit code to ",
    codeSubB: ". Check your spam folder if it hasn't arrived within a minute.",
    codeLbl: "Confirmation code",
    resendIn: "Resend",
    resend: "Resend code",
    changeEmail: "Change email",
    checking: "Checking…",
    confirm: "Confirm",
    accH: "About you and your company",
    accSubA: "",
    accSubB: " is confirmed. Fifteen minutes and you're up and running.",
    fullName: "Full name",
    namePh: "Jane Smith",
    company: "Company",
    coPh: "Company ehf.",
    pw: "Password",
    pwPh: "at least {n} characters. A sentence with spaces works well",
    hidePw: "Hide password",
    showPw: "Show password",
    stronger: "A longer password or three unrelated words makes it stronger.",
    agreeA: "I accept the VAKTO ",
    terms: "terms",
    agreeB: " (including the data processing agreement) and ",
    privacy: "privacy policy",
    agreeC: ".",
    creating: "Creating…",
    cont: "Continue",
  },
};
const PRICE: Record<SignupLang, string> = { is: "9.990", en: "9,990" };

const Bars = () => (
  <div className="m"><svg viewBox="0 0 28 28" fill="none">
    <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
    <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
    <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
  </svg></div>
);

type Step = "email" | "code" | "account" | "card";
const STEP_IDS: Step[] = ["email", "account", "card"];

function Steps({ cur, s }: { cur: Step; s: (typeof L)["is"] }) {
  const STEPS = STEP_IDS.map((id, i) => ({ id, label: [s.st1, s.st2, s.st3][i] }));
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

export default function SignupForm({ lang = "is" }: { lang?: SignupLang }) {
  const s = L[lang];
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
    if (TURNSTILE_SITE_KEY && !captcha) { setError(s.botWait); return; }
    setBusy(true);
    try {
      const r = await requestSignupCode(email, captcha);
      if (!r.ok) { setError(r.error ?? s.codeFail); return; }
      setCode(""); setCooldown(30); setStep("code");
    } catch { setError(s.netErr); }
    finally { setBusy(false); }
  }

  async function checkCode(e?: React.FormEvent) {
    e?.preventDefault();
    setError(null);
    const digits = code.replace(/\D/g, "");
    if (digits.length !== 6) { setError(s.code6); return; }
    setBusy(true);
    try {
      const r = await verifySignupCode(email, digits);
      if (!r.ok) { setError(r.error ?? s.badCode); return; }
      setProof(r.proof ?? "demo"); setStep("account");
    } catch { setError(s.netErr); }
    finally { setBusy(false); }
  }

  async function submitAccount(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!pw.ok) { setError(pw.reason ?? s.weak); return; }
    if (!terms) { setError(s.needTerms); return; }
    setBusy(true);
    try {
      const res = await createOwnerAccount({ fullName, companyName, email, password, country: "IS", proof: proof ?? undefined, termsAccepted: terms });
      if (!res.ok) {
        setError(res.error ?? s.createFail);
        if (/Staðfesting netfangs/.test(res.error ?? "")) { setProof(null); setStep("email"); }
        return;
      }
      if (!res.demo) {
        const supabase = createClient();
        await supabase.auth.signInWithPassword({ email, password });
      }
      setStep("card");
    } catch {
      setError(s.supa);
    } finally { setBusy(false); }
  }

  async function finish(e: React.FormEvent) {
    e.preventDefault();
    // Prufan hefst núna. Kortið er skráð hjá Straumi (0 kr) og fyrsta gjaldið
    // tekið þegar prufan er búin — eða beint inn ef greiðslur eru ekki tengdar.
    setBusy(true); setError(null);
    const r = await startCardSetup(window.location.origin);
    if (!r.ok) { setError(r.error ?? s.fail); setBusy(false); return; }
    window.location.assign(r.skip ? "/maelabord" : r.url!);
  }

  if (step === "card") {
    return (
      <form className="form" onSubmit={finish}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="card" s={s} />
        <h1>{s.trialH}</h1>
        <div className="sub">{s.trialSub}</div>

        <div className="planpick" style={{ gridTemplateColumns: "1fr" }}>
          <div className="planopt on" style={{ cursor: "default" }}>
            <div className="pn">VAKTO</div>
            <div className="pp">{lang === "en" ? `ISK ${PRICE.en}` : `${PRICE.is} kr`} <small>{s.per}</small></div>
            <div className="pb">{s.extra}</div>
            <div className="pb">{s.vatNote}</div>
          </div>
        </div>

        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy}>{busy ? s.opening : s.startTrial}</button>
        <p className="pcy">{s.cardNote}</p>
      </form>
    );
  }

  if (step === "email") {
    return (
      <form className="form" onSubmit={sendCode}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="email" s={s} />
        <h1>{s.createH}</h1>
        <div className="sub">{s.createSub}</div>

        <div className="field"><div className="lbl"><label htmlFor="em">{s.workEmail}</label></div><input id="em" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={s.emailPh} autoComplete="email" autoFocus required /></div>
        <Turnstile onToken={setCaptcha} />
        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy}>{busy ? s.sending : s.sendCode}</button>

        <p className="pcy" style={{ marginTop: 14 }}>{s.trialNote}</p>
        <div className="foot">{s.haveAcc} <Link href="/login">{s.signIn}</Link></div>
      </form>
    );
  }

  if (step === "code") {
    return (
      <form className="form" onSubmit={checkCode}>
        <div className="brand"><Bars /><b>VAKTO</b></div>
        <Steps cur="code" s={s} />
        <h1>{s.codeH}</h1>
        <div className="sub">{s.codeSubA}<b style={{ color: "var(--ink)" }}>{email}</b>{s.codeSubB}</div>

        <div className="field">
          <div className="lbl"><label htmlFor="code">{s.codeLbl}</label></div>
          <input id="code" ref={codeRef} className="codein" value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            inputMode="numeric" pattern="[0-9]*" autoComplete="one-time-code" placeholder="••••••" maxLength={6} required />
        </div>
        <div className="codehint">
          <button type="button" onClick={() => sendCode()} disabled={busy || cooldown > 0}>{cooldown > 0 ? `${s.resendIn} (${cooldown}s)` : s.resend}</button>
          <button type="button" onClick={() => { setStep("email"); setError(null); }}>{s.changeEmail}</button>
        </div>
        <Err msg={error} />
        <button className="btn" type="submit" disabled={busy || code.length !== 6}>{busy ? s.checking : s.confirm}</button>
      </form>
    );
  }

  return (
    <form className="form" onSubmit={submitAccount}>
      <div className="brand"><Bars /><b>VAKTO</b></div>
      <Steps cur="account" s={s} />
      <h1>{s.accH}</h1>
      <div className="sub">{s.accSubA}{email}{s.accSubB}</div>

      <div className="field"><div className="lbl"><label htmlFor="fn">{s.fullName}</label></div><input id="fn" value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={s.namePh} autoComplete="name" autoFocus required /></div>
      <div className="field"><div className="lbl"><label htmlFor="co">{s.company}</label></div><input id="co" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder={s.coPh} autoComplete="organization" required /></div>
      <div className="field"><div className="lbl"><label htmlFor="pw">{s.pw}</label></div>
        <div className="pwwrap">
          <input id="pw" type={showPw ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} placeholder={s.pwPh.replace("{n}", String(PASSWORD_MIN))} autoComplete="new-password" minLength={PASSWORD_MIN} required />
          <button type="button" className="pweye" aria-label={showPw ? s.hidePw : s.showPw} onClick={() => setShowPw((v) => !v)}>
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
            {pw.ok && pw.score === 2 && <div className="why">{s.stronger}</div>}
          </div>
        )}
      </div>

      <label className="chk">
        <input type="checkbox" checked={terms} onChange={(e) => setTerms(e.target.checked)} required />
        <span>{s.agreeA}<a href="/skilmalar" target="_blank" rel="noreferrer">{s.terms}</a>{s.agreeB}<a href="/personuvernd" target="_blank" rel="noreferrer">{s.privacy}</a>{s.agreeC}</span>
      </label>

      <Err msg={error} />
      <button className="btn" type="submit" disabled={busy}>{busy ? s.creating : s.cont}</button>
      <div className="foot">{s.haveAcc} <Link href="/login">{s.signIn}</Link></div>
    </form>
  );
}
