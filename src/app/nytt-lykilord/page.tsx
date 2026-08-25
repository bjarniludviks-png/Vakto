"use client";

// Set-password page for invites, magic links and password recovery.
// Self-contained light styling (login.css is dark-themed — not reused here).
// Email links carry ?token_hash&type which we verify in the BACKGROUND with
// verifyOtp — the form is usable immediately; only a failed/expired token
// surfaces an error. Legacy hash-token links still work via getSession.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const C = {
  ink: "#1a1a1f", ink2: "#5f6470", ink3: "#9296a6", line: "#e6e6e9",
  bg: "#f4f4f6", brand: "#e9700f", good: "#1f9d6b", warn: "#bf8f3a", bad: "#d8483a",
};

const strength = (pw: string) => {
  const checks = {
    len: pw.length >= 8,
    num: /\d/.test(pw),
    mix: /[a-záðéíóúýþæö]/.test(pw) && /[A-ZÁÐÉÍÓÚÝÞÆÖ]/.test(pw),
    extra: pw.length >= 12 || /[^a-zA-Z0-9áðéíóúýþæöÁÐÉÍÓÚÝÞÆÖ]/.test(pw),
  };
  const score = (checks.len ? 1 : 0) + (checks.num ? 1 : 0) + (checks.mix ? 1 : 0) + (checks.extra ? 1 : 0);
  return { checks, score, ok: checks.len && checks.num };
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box", border: `1px solid ${C.line}`, borderRadius: 10,
  padding: "13px 14px", fontSize: 16, fontFamily: "inherit", color: C.ink, background: "#fff", outline: "none",
};

export default function NyttLykilord() {
  const [failed, setFailed] = useState(false);
  const [pw, setPw] = useState("");
  const [pw2, setPw2] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const s = useMemo(() => strength(pw), [pw]);

  // Verify the link token in the background — the form stays usable meanwhile.
  useEffect(() => {
    const supabase = createClient();
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const type = (params.get("type") as "magiclink" | "recovery" | "invite" | "email" | null) ?? "magiclink";
    (async () => {
      if (tokenHash) {
        const { error: err } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
        if (err) {
          const { data } = await supabase.auth.getSession();
          if (!data.session) setFailed(true);
        }
      } else {
        // legacy links: session may arrive from the URL hash
        setTimeout(async () => {
          const { data } = await supabase.auth.getSession();
          if (!data.session) setFailed(true);
        }, 3500);
      }
    })();
  }, []);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!s.ok) { setError("Lykilorðið þarf a.m.k. 8 stafi og tölustaf."); return; }
    if (pw !== pw2) { setError("Lykilorðin stemma ekki."); return; }
    setBusy(true);
    const { error: err } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setFailed(true); return; }
    window.location.assign("/maelabord"); // middleware routes each role home
  }

  const BAR_COLORS = [C.line, C.bad, C.warn, C.good, C.good];
  const BAR_LABELS = ["", "Veikt", "Í lagi", "Sterkt", "Mjög sterkt"];

  const Check = ({ on, label }: { on: boolean; label: string }) => (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 5, fontSize: 12.5, color: on ? C.good : C.ink3, fontWeight: on ? 650 : 500 }}>
      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4">
        {on ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="8" strokeWidth="1.8" />}
      </svg>
      {label}
    </span>
  );

  return (
    <div style={{ minHeight: "100dvh", display: "flex", alignItems: "center", justifyContent: "center", background: C.bg, padding: 20, fontFamily: "'General Sans', system-ui, -apple-system, sans-serif" }}>
      <form onSubmit={save} style={{ width: "min(420px, 100%)", background: "#fff", borderRadius: 16, padding: "34px 30px", boxShadow: "0 1px 2px rgba(18,18,40,.04), 0 12px 30px -16px rgba(18,18,40,.14)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 9, marginBottom: 18 }}>
          <svg viewBox="0 0 28 28" fill="none" width="26" height="26">
            <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
            <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
            <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
          </svg>
          <b style={{ fontSize: 17, letterSpacing: 1, color: C.ink }}>VAKTO</b>
        </div>
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", color: C.ink, margin: "0 0 6px" }}>Veldu lykilorð</h1>
        <p style={{ fontSize: 14.5, color: C.ink2, margin: "0 0 22px", lineHeight: 1.5 }}>
          Veldu þér lykilorð — svo ertu komin(n) beint inn.
        </p>

        {failed ? (
          <div style={{ background: "#fbe9e6", color: C.bad, borderRadius: 10, padding: "14px 16px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.55 }}>
            Hlekkurinn er útrunninn eða þegar notaður.<br />
            Farðu á <a href="/login" style={{ color: C.bad, textDecoration: "underline" }}>innskráningarsíðuna</a>, sláðu inn netfangið þitt og smelltu á „Gleymt lykilorð?“ til að fá nýjan.
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink2, marginBottom: 6 }} htmlFor="pw">Nýtt lykilorð</label>
            <input id="pw" style={inputStyle} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="a.m.k. 8 stafir og tölustafur" autoComplete="new-password" autoFocus required />
            {pw.length > 0 && (
              <div style={{ marginTop: 10 }}>
                <div style={{ display: "flex", gap: 4, marginBottom: 7 }}>
                  {[1, 2, 3, 4].map((i) => (
                    <span key={i} style={{ flex: 1, height: 5, borderRadius: 3, background: i <= s.score ? BAR_COLORS[s.score] : C.line, transition: "background .2s" }} />
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

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink2, margin: "18px 0 6px" }} htmlFor="pw2">Endurtaktu lykilorðið</label>
            <input id="pw2" style={inputStyle} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••••" autoComplete="new-password" required />
            {pw2.length > 0 && pw !== pw2 && <div style={{ fontSize: 12, color: C.bad, fontWeight: 600, marginTop: 5 }}>Stemma ekki enn</div>}

            {error && (
              <div style={{ background: "#fbe9e6", color: C.bad, borderRadius: 10, padding: "10px 14px", fontSize: 13.5, fontWeight: 600, marginTop: 14 }}>{error}</div>
            )}

            <button
              type="submit"
              disabled={busy || !s.ok || pw !== pw2}
              style={{
                width: "100%", marginTop: 20, background: C.brand, color: "#fff", border: 0, borderRadius: 11,
                padding: "14px 0", fontSize: 15.5, fontWeight: 700, fontFamily: "inherit", cursor: "pointer",
                opacity: busy || !s.ok || pw !== pw2 ? 0.55 : 1, boxShadow: "0 3px 10px rgba(233,112,15,.28)",
              }}
            >
              {busy ? "Vista…" : "Vista og skrá inn"}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
