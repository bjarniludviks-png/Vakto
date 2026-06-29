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

  async function oauth(provider: "google" | "azure") {
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
        Ertu ekki með aðgang? <Link href="/#verd">Stofna aðgang</Link>
      </div>
    </form>
  );
}
