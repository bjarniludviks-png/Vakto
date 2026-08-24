"use client";

// Landing page for the password-recovery link: the browser Supabase client
// picks the session up from the URL, the user chooses a new password.

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../login/login.css";

export default function NyttLykilord() {
  const [ready, setReady] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supabase = createClient();
    // The recovery link lands with tokens in the URL; wait for the session.
    supabase.auth.getSession().then(({ data }) => setReady(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setReady(!!s));
    return () => sub.subscription.unsubscribe();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (pw.length < 8) { setError("Lykilorðið þarf að vera a.m.k. 8 stafir."); return; }
    if (pw !== pw2) { setError("Lykilorðin stemma ekki."); return; }
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setError("Tókst ekki að vista — hlekkurinn gæti verið útrunninn. Biddu um nýjan."); return; }
    window.location.assign("/maelabord"); // middleware routes each role to its home
  }

  return (
    <div className="login-page" style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "var(--bg, #f4f4f6)" }}>
      <form className="form" onSubmit={save} style={{ width: "min(400px, calc(100% - 40px))" }}>
        <div className="brand">
          <div className="m">
            <svg viewBox="0 0 28 28" fill="none" width="26" height="26">
              <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
              <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
              <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
            </svg>
          </div>
          <b>VAKTO</b>
        </div>
        <h1>Nýtt lykilorð</h1>
        <div className="sub">
          {ready ? "Veldu nýtt lykilorð fyrir aðganginn þinn." : "Sæki auðkenningu úr hlekknum…"}
        </div>
        <div className="field">
          <div className="lbl"><label htmlFor="pw">Nýtt lykilorð</label></div>
          <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="a.m.k. 8 stafir" autoComplete="new-password" required disabled={!ready} />
        </div>
        <div className="field">
          <div className="lbl"><label htmlFor="pw2">Endurtaktu lykilorðið</label></div>
          <input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••••" autoComplete="new-password" required disabled={!ready} />
        </div>
        {error && (
          <div style={{ background: "#fbe9e6", color: "#d8483a", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>
        )}
        <button className="btn" type="submit" disabled={!ready || busy}>
          {busy ? "Vista…" : "Vista og skrá inn"}
        </button>
      </form>
    </div>
  );
}
