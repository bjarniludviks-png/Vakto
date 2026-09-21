"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_I18N, type Lang } from "./login-i18n";
import { requestPasswordReset, demoLogin } from "./actions";

export default function LoginForm({ lang = "is", demo = false }: { lang?: Lang; demo?: boolean }) {
  const s = LOGIN_I18N[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  async function forgot() {
    setError(null);
    if (!email.trim()) {
      setNotice(lang === "en" ? "Type your email above first, then tap this link again." : "Sláðu netfangið þitt inn fyrst — smelltu svo aftur á hlekkinn.");
      return;
    }
    setNotice(lang === "en" ? "Sending…" : "Sendi…");
    await requestPasswordReset(email);
    setNotice(
      lang === "en"
        ? "If an account exists for that email, a reset link is on its way."
        : "Ef aðgangur er til fyrir netfangið er póstur með hlekk á leiðinni."
    );
  }

  // Carry the marketing-site language choice into the app after login.
  useEffect(() => {
    try { localStorage.setItem("vakto-lang", lang); } catch {}
  }, [lang]);

  // /auth/callback bounces here with ?error=link when a sign-in link is stale.
  useEffect(() => {
    const err = new URLSearchParams(window.location.search).get("error");
    if (!err) return;
    const id = setTimeout(() => setError(s.errOauth), 0);
    return () => clearTimeout(id);
  }, [s.errOauth]);

  // Preserve the language on the create-account link too.
  const signupHref = lang === "en" ? "/nyskraning?lang=en" : "/nyskraning";

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        return;
      }
      // Full navigation (not client transition) so the app shell loads with its
      // route-scoped CSS + fresh session — avoids the "needs a refresh" flash.
      window.location.assign("/maelabord");
    } catch {
      setError(s.errConnect);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="form" onSubmit={signIn}>
      <div className="brand">
        <div className="m">
          <svg viewBox="0 0 28 28" fill="none">
            <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="var(--brand-2)" />
            <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="var(--brand)" />
            <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="var(--brand-deep)" />
          </svg>
        </div>
        <b>VAKTO</b>
      </div>
      <h1>{s.welcome}</h1>
      <div className="sub">{s.welcomeSub}</div>

      <div className="field">
        <div className="lbl">
          <label htmlFor="email">{s.emailLabel}</label>
        </div>
        <input
          id="email"
          type="email"
          placeholder={s.emailPh}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <div className="lbl">
          <label htmlFor="password">{s.passwordLabel}</label>
          <span className="forgot" role="button" tabIndex={0} style={{ cursor: "pointer" }} onClick={forgot} onKeyDown={(e) => e.key === "Enter" && forgot()}>{s.forgot}</span>
        </div>
        <div className="pwwrap">
          <input
            id="password"
            type={showPw ? "text" : "password"}
            placeholder="••••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
          <button type="button" className="pweye" aria-label={showPw ? "Fela lykilorð" : "Sýna lykilorð"} onClick={() => setShowPw((v) => !v)}>
            {showPw
              ? <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M17.94 17.94A10.5 10.5 0 0 1 12 20c-7 0-10-8-10-8a18.4 18.4 0 0 1 5.06-5.94M9.9 4.24A9.9 9.9 0 0 1 12 4c7 0 10 8 10 8a18.5 18.5 0 0 1-2.16 3.19M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m2 2 20 20" /></svg>
              : <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3-8 10-8 10 8 10 8-3 8-10 8-10-8-10-8Z" /><circle cx="12" cy="12" r="3" /></svg>}
          </button>
        </div>
      </div>

      {error && (
        <div
          style={{
            color: "var(--bad)",
            fontSize: "13px",
            fontWeight: 600,
            marginBottom: "14px",
          }}
        >
          {error}
        </div>
      )}

      {notice && (
        <div style={{ background: "#e8f5ef", color: "#1f9d6b", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>
          {notice}
        </div>
      )}
      <button className="btn" type="submit" disabled={busy}>
        {busy ? s.signingIn : s.signIn}
      </button>

      {demo && <div className="divider">{s.or}</div>}
      {demo && (
        <button className="soc" type="button" disabled={busy} onClick={async () => {
          setBusy(true); setError(null);
          const r = await demoLogin();
          if (!r.ok) { setBusy(false); setError(r.error ?? s.errConnect); return; }
          window.location.assign(r.next ?? "/maelabord");
        }}>
          <span className="ic"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 3l14 9-14 9z" /></svg></span>{" "}
          {lang === "en" ? "Try the demo company" : "Prófa demo-fyrirtæki"}
        </button>
      )}

      <div className="foot">
        {s.noAccount} <Link href={signupHref}>{s.createAccount}</Link>
      </div>
    </form>
  );
}
