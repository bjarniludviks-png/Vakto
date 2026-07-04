"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { LOGIN_I18N, type Lang } from "./login-i18n";

export default function LoginForm({ lang = "is" }: { lang?: Lang }) {
  const s = LOGIN_I18N[lang];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Carry the marketing-site language choice into the app after login.
  useEffect(() => {
    try { localStorage.setItem("vakto-lang", lang); } catch {}
  }, [lang]);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("error") === "oauth") {
      setError(s.errOauth);
    }
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

  async function oauth(provider: "google" | "azure" | "apple") {
    setError(null);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider,
        options: { redirectTo: `${window.location.origin}/auth/callback?next=/maelabord` },
      });
      if (error) setError(error.message);
    } catch {
      setError(s.errOauth);
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
          <span className="forgot">{s.forgot}</span>
        </div>
        <input
          id="password"
          type="password"
          placeholder="••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
      </div>
      <label className="remember">
        <input type="checkbox" /> {s.remember}
      </label>

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

      <button className="btn" type="submit" disabled={busy}>
        {busy ? s.signingIn : s.signIn}
      </button>

      <div className="divider">{s.or}</div>

      <button className="soc" type="button" onClick={() => oauth("apple")}>
        <span className="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.3-.9-2.3-3.5zM14.2 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z" /></svg></span> {s.withApple}
      </button>
      <button className="soc" type="button" onClick={() => oauth("google")}>
        <span className="ic">G</span> {s.withGoogle}
      </button>
      <button className="soc" type="button" onClick={() => oauth("azure")}>
        <span className="ic">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <rect x="3" y="3" width="8" height="8" />
            <rect x="13" y="3" width="8" height="8" />
            <rect x="3" y="13" width="8" height="8" />
            <rect x="13" y="13" width="8" height="8" />
          </svg>
        </span>{" "}
        {s.withMicrosoft}
      </button>
      <button
        className="soc"
        type="button"
        onClick={() => setError(s.errAudkenni)}
      >
        <span className="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8h14M5 12h14M5 16h9" />
          </svg>
        </span>{" "}
        {s.withAudkenni}
      </button>

      <div className="foot">
        {s.noAccount} <Link href={signupHref}>{s.createAccount}</Link>
      </div>
    </form>
  );
}
