"use client";

// Set-password page for invites, magic links and password recovery.
// The email links carry ?token_hash=…&type=… which we verify HERE with
// verifyOtp — no redirect chain, works in every browser (incl. iOS Mail).
// Legacy hash-token links (detectSessionInUrl) still work as a fallback.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import "../login/login.css";

type Verify = "checking" | "ready" | "failed";

const strength = (pw: string) => {
  const checks = {
    len: pw.length >= 8,
    num: /\d/.test(pw),
    mix: /[a-záðéíóúýþæö]/i.test(pw) && /[A-ZÁÐÉÍÓÚÝÞÆÖ]/.test(pw),
    extra: pw.length >= 12 || /[^a-za-záðéíóúýþæö0-9]/i.test(pw),
  };
  const score = (checks.len ? 1 : 0) + (checks.num ? 1 : 0) + (checks.mix ? 1 : 0) + (checks.extra ? 1 : 0);
  return { checks, score, ok: checks.len && checks.num };
};

export default function NyttLykilord() {
  const [state, setState] = useState<Verify>("checking");
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = useMemo(() => strength(pw), [pw]);

  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = params.get("type") as "magiclink" | "recovery" | "invite" | "email" | null;

    async function boot() {
      if (tokenHash && type) {
        const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (!err) { setState("ready"); return; }
      }
      // fallback: session already present (e.g. legacy hash-token links)
      const { data } = await supabase.auth.getSession();
      if (data.session) { setState("ready"); return; }
      const { data: sub } = supabase.auth.onAuthStateChange((_e, sess) => {
        if (sess) setState("ready");
      });
      setTimeout(() => setState((cur) => (cur === "checking" ? "failed" : cur)), 4000);
      return () => sub.subscription.unsubscribe();
    }
    void boot();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!s.ok) { setError("Lykilorðið þarf a.m.k. 8 stafi og tölustaf."); return; }
    if (pw !== pw2) { setError("Lykilorðin stemma ekki."); return; }
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setError("Tókst ekki að vista — hlekkurinn gæti verið útrunninn. Biddu um nýjan með „Gleymt lykilorð?“ á innskráningarsíðunni."); return; }
    window.location.assign("/maelabord"); // middleware routes each role home
  }

  const BAR_COLORS = ["#e6e6e9", "#d8483a", "#bf8f3a", "#1f9d6b", "#1f9d6b"];
  const BAR_LABELS = ["", "Veikt", "Í lagi", "Sterkt", "Mjög sterkt"];
  const ready = state === "ready";

  const Check = ({ on, label }: { on: boolean; label: string }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: on ? "#1f9d6b" : "#9296a6", fontWeight: on ? 650 : 500 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        {on ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="8" strokeWidth="1.8" />}
      </svg>
      {label}
    </span>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f4f4f6", padding: 20 }}>
      <form className="form" onSubmit={save} style={{ width: "min(400px, 100%)" }}>
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
        <h1>Veldu lykilorð</h1>
        <div className="sub">
          {state === "checking" && "Staðfesti hlekkinn…"}
          {state === "ready" && "Veldu lykilorð fyrir aðganginn þinn — svo ertu komin(n) inn."}
          {state === "failed" && "Hlekkurinn er útrunninn eða þegar notaður."}
        </div>

        {state === "failed" ? (
          <div style={{ background: "#fbe9e6", color: "#d8483a", borderRadius: 10, padding: "12px 16px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.5 }}>
            Biddu um nýjan hlekk: farðu á <a href="/login" style={{ color: "#d8483a", textDecoration: "underline" }}>innskráningarsíðuna</a>, sláðu inn netfangið þitt og smelltu á „Gleymt lykilorð?“.
          </div>
        ) : (
          <>
            <div className="field">
              <div className="lbl"><label htmlFor="pw">Nýtt lykilorð</label></div>
              <input id="pw" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="a.m.k. 8 stafir og tölustafur" autoComplete="new-password" required disabled={!ready} />
              {pw.length > 0 && (
                <div style={{ marginTop: 8 }}>
                  <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
                    {[1, 2, 3, 4].map((i) => (
                      <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= s.score ? BAR_COLORS[s.score] : "#e6e6e9", transition: "background .2s" }} />
                    ))}
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: BAR_COLORS[s.score] }}>{BAR_LABELS[s.score]}</span>
                    <span style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                      <Check on={s.checks.len} label="8+ stafir" />
                      <Check on={s.checks.num} label="tölustafur" />
                      <Check on={s.checks.mix} label="há- og lágstafir" />
                    </span>
                  </div>
                </div>
              )}
            </div>
            <div className="field">
              <div className="lbl"><label htmlFor="pw2">Endurtaktu lykilorðið</label></div>
              <input id="pw2" type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••••" autoComplete="new-password" required disabled={!ready} />
              {pw2.length > 0 && pw !== pw2 && <span style={{ fontSize: 12, color: "#d8483a", fontWeight: 600 }}>Stemma ekki enn</span>}
            </div>
            {error && (
              <div style={{ background: "#fbe9e6", color: "#d8483a", borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginBottom: 14 }}>{error}</div>
            )}
            <button className="btn" type="submit" disabled={!ready || busy || !s.ok || pw !== pw2}>
              {busy ? "Vista…" : state === "checking" ? "Staðfesti hlekkinn…" : "Vista og skrá inn"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
