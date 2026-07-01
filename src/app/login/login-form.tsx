"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
      setError("Tókst ekki að tengjast — er Supabase stillt í .env.local?");
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
        options: { redirectTo: `${window.location.origin}/maelabord` },
      });
      if (error) setError(error.message);
    } catch {
      setError("Innskráning með þessari þjónustu er ekki stillt enn.");
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
      <h1>Velkomin aftur</h1>
      <div className="sub">Skráðu þig inn til að halda áfram.</div>

      <div className="field">
        <div className="lbl">
          <label htmlFor="email">Netfang</label>
        </div>
        <input
          id="email"
          type="email"
          placeholder="netfang@fyrirtaeki.is"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
          required
        />
      </div>
      <div className="field">
        <div className="lbl">
          <label htmlFor="password">Lykilorð</label>
          <span className="forgot">Gleymt lykilorð?</span>
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
        <input type="checkbox" /> Muna mig
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
        {busy ? "Skrái inn…" : "Skrá inn"}
      </button>

      <div className="divider">eða</div>

      <button className="soc" type="button" onClick={() => oauth("apple")}>
        <span className="ic"><svg viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.3-.9-2.3-3.5zM14.2 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z" /></svg></span> Halda áfram með Apple
      </button>
      <button className="soc" type="button" onClick={() => oauth("google")}>
        <span className="ic">G</span> Halda áfram með Google
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
        Halda áfram með Microsoft
      </button>
      <button
        className="soc"
        type="button"
        onClick={() => setError("Rafræn skilríki (Auðkenni) eru væntanleg.")}
      >
        <span className="ic">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M5 8h14M5 12h14M5 16h9" />
          </svg>
        </span>{" "}
        Rafræn skilríki (Auðkenni)
      </button>

      <div className="foot">
        Ertu ekki með aðgang? <Link href="/nyskraning">Stofna aðgang</Link>
      </div>
    </form>
  );
}
