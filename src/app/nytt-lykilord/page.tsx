"use client";

// Set-password page for invites, magic links and password recovery.
// Self-contained light styling (login.css is dark-themed — not reused here).
// Email links carry ?token_hash&type which we verify in the BACKGROUND with
// verifyOtp — the form is usable immediately; only a failed/expired token
// surfaces an error. Legacy hash-token links still work via getSession.

import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { passwordStrength, PASSWORD_MIN } from "@/lib/password";
import { checkNewPassword } from "./actions";
import { VaktoLogo } from "@/components/brand/vakto-logo";

const C = {
  ink: "#1a1a1f", ink2: "#5f6470", ink3: "#9296a6", line: "#e6e6e9",
  bg: "#f4f4f6", brand: "#e9700f", good: "#1f9d6b", warn: "#bf8f3a", bad: "#d8483a",
};

type PwLang = "is" | "en" | "pl";
const PW_LANGS: PwLang[] = ["is", "en", "pl"];
const T = {
  is: {
    h1: "Veldu lykilorð", sub: "Veldu þér lykilorð — svo ertu komin(n) beint inn.",
    expiredA: "Hlekkurinn er útrunninn eða þegar notaður.", expiredB: "Farðu á ", expiredLink: "innskráningarsíðuna", expiredC: ", sláðu inn netfangið þitt og smelltu á „Gleymt lykilorð?“ til að fá nýjan.",
    newPw: "Nýtt lykilorð", ph: (n: number) => `a.m.k. ${n} stafir — setning með bilum er fín`,
    bars: ["", "Of veikt", "Í lagi", "Sterkt", "Mjög sterkt"], chars: "stafir", words: "3+ orð", mix: "tala eða tákn",
    repeat: "Endurtaktu lykilorðið", noMatchYet: "Stemma ekki enn", noMatch: "Lykilorðin stemma ekki.", minLen: (n: number) => `Lykilorðið þarf a.m.k. ${n} stafi.`, weak: "Lykilorðið er of veikt",
    saving: "Vista…", save: "Vista og skrá inn",
    reasons: {} as Record<string, string>,
  },
  en: {
    h1: "Choose a password", sub: "Pick a password — then you're straight in.",
    expiredA: "This link has expired or has already been used.", expiredB: "Go to the ", expiredLink: "sign-in page", expiredC: ", enter your email and click “Forgot password?” to get a new one.",
    newPw: "New password", ph: (n: number) => `at least ${n} characters — a sentence with spaces works well`,
    bars: ["", "Too weak", "OK", "Strong", "Very strong"], chars: "characters", words: "3+ words", mix: "number or symbol",
    repeat: "Repeat the password", noMatchYet: "Doesn't match yet", noMatch: "The passwords don't match.", minLen: (n: number) => `The password needs at least ${n} characters.`, weak: "The password is too weak",
    saving: "Saving…", save: "Save and sign in",
    reasons: {
      "Lykilorð vantar": "Password is missing",
      "Þetta lykilorð er of algengt — veldu annað.": "This password is too common — choose another.",
      "Endurtekningar og runur (1234, abcd) gera lykilorðið fyrirsjáanlegt.": "Repeats and sequences (1234, abcd) make the password predictable.",
      "Lykilorðið er of veikt": "The password is too weak",
      "Þetta lykilorð hefur birst í þekktum gagnaleka — veldu annað.": "This password has appeared in a known data breach — choose another.",
    } as Record<string, string>,
  },
  pl: {
    h1: "Ustaw hasło", sub: "Wybierz hasło — i od razu jesteś w środku.",
    expiredA: "Link wygasł lub został już użyty.", expiredB: "Przejdź na ", expiredLink: "stronę logowania", expiredC: ", wpisz swój e-mail i kliknij „Nie pamiętasz hasła?”, aby dostać nowy link.",
    newPw: "Nowe hasło", ph: (n: number) => `co najmniej ${n} znaków — zdanie ze spacjami też jest dobre`,
    bars: ["", "Za słabe", "W porządku", "Silne", "Bardzo silne"], chars: "znaków", words: "3+ słowa", mix: "cyfra lub symbol",
    repeat: "Powtórz hasło", noMatchYet: "Hasła jeszcze się nie zgadzają", noMatch: "Hasła nie są takie same.", minLen: (n: number) => `Hasło musi mieć co najmniej ${n} znaków.`, weak: "Hasło jest za słabe",
    saving: "Zapisywanie…", save: "Zapisz i zaloguj się",
    reasons: {
      "Lykilorð vantar": "Brak hasła",
      "Þetta lykilorð er of algengt — veldu annað.": "To hasło jest zbyt popularne — wybierz inne.",
      "Endurtekningar og runur (1234, abcd) gera lykilorðið fyrirsjáanlegt.": "Powtórzenia i ciągi znaków (1234, abcd) sprawiają, że hasło jest łatwe do odgadnięcia.",
      "Lykilorðið er of veikt": "Hasło jest za słabe",
      "Þetta lykilorð hefur birst í þekktum gagnaleka — veldu annað.": "To hasło pojawiło się w znanym wycieku danych — wybierz inne.",
    } as Record<string, string>,
  },
};

const strength = (pw: string) => {
  const st = passwordStrength(pw);
  return { checks: { len: pw.length >= PASSWORD_MIN, words: pw.trim().split(/\s+/).length >= 3, mix: /\d/.test(pw) || /[^\p{L}\p{N}]/u.test(pw) }, score: st.score, ok: st.ok, reason: st.reason };
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
  const [lang, setLang] = useState<PwLang>("is");
  const t = T[lang];
  // Lengdarvillan úr passwordStrength inniheldur töluna; hinar eru fastir textar.
  const tReason = (r: string | undefined) => (!r ? t.weak : r.startsWith("Lykilorðið þarf a.m.k.") ? t.minLen(PASSWORD_MIN) : lang === "is" ? r : t.reasons[r] ?? r);

  // Tungumál: ?lang= → val vistað í vafranum (vakto-lang) → pólskur vafri → íslenska.
  useEffect(() => {
    let l: PwLang = "is";
    try {
      const q = new URLSearchParams(window.location.search).get("lang");
      const saved = localStorage.getItem("vakto-lang");
      if (PW_LANGS.includes(q as PwLang)) l = q as PwLang;
      else if (PW_LANGS.includes(saved as PwLang)) l = saved as PwLang;
      else if (saved === "vi") l = "en";
      else if (navigator.language?.toLowerCase().startsWith("pl")) l = "pl";
    } catch { /* ignore */ }
    if (l !== "is") { const id = requestAnimationFrame(() => setLang(l)); return () => cancelAnimationFrame(id); }
  }, []);
  function pickLang(l: PwLang) {
    setLang(l);
    try { localStorage.setItem("vakto-lang", l); } catch { /* ignore */ }
  }

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
    if (!s.ok) { setError(s.reason ? tReason(s.reason) : t.minLen(PASSWORD_MIN)); return; }
    if (pw !== pw2) { setError(t.noMatch); return; }
    setBusy(true);
    const chk = await checkNewPassword(pw);
    if (!chk.ok) { setBusy(false); setError(tReason(chk.error)); return; }
    const { error: err } = await createClient().auth.updateUser({ password: pw });
    setBusy(false);
    if (err) { setFailed(true); return; }
    window.location.assign("/maelabord"); // middleware routes each role home
  }

  const BAR_COLORS = [C.line, C.bad, C.warn, C.good, C.good];
  const BAR_LABELS = t.bars;

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
        <VaktoLogo size={26} style={{ marginBottom: 18, color: C.ink }} />
        <h1 style={{ fontSize: 24, fontWeight: 700, letterSpacing: "-.02em", color: C.ink, margin: "0 0 6px" }}>{t.h1}</h1>
        <p style={{ fontSize: 14.5, color: C.ink2, margin: "0 0 22px", lineHeight: 1.5 }}>
          {t.sub}
        </p>

        {failed ? (
          <div style={{ background: "#fbe9e6", color: C.bad, borderRadius: 10, padding: "14px 16px", fontSize: 13.5, fontWeight: 600, lineHeight: 1.55 }}>
            {t.expiredA}<br />
            {t.expiredB}<a href={lang === "is" ? "/login" : `/login?lang=${lang}`} style={{ color: C.bad, textDecoration: "underline" }}>{t.expiredLink}</a>{t.expiredC}
          </div>
        ) : (
          <>
            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink2, marginBottom: 6 }} htmlFor="pw">{t.newPw}</label>
            <input id="pw" style={inputStyle} type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder={t.ph(PASSWORD_MIN)} autoComplete="new-password" autoFocus required />
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
                    <Check on={s.checks.len} label={`${PASSWORD_MIN}+ ${t.chars}`} />
                    <Check on={s.checks.words} label={t.words} />
                    <Check on={s.checks.mix} label={t.mix} />
                  </span>
                </div>
              </div>
            )}

            <label style={{ display: "block", fontSize: 13, fontWeight: 600, color: C.ink2, margin: "18px 0 6px" }} htmlFor="pw2">{t.repeat}</label>
            <input id="pw2" style={inputStyle} type="password" value={pw2} onChange={(e) => setPw2(e.target.value)} placeholder="••••••••••" autoComplete="new-password" required />
            {pw2.length > 0 && pw !== pw2 && <div style={{ fontSize: 12, color: C.bad, fontWeight: 600, marginTop: 5 }}>{t.noMatchYet}</div>}

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
              {busy ? t.saving : t.save}
            </button>
          </>
        )}

        <div style={{ display: "flex", justifyContent: "center", gap: 4, marginTop: 22 }}>
          {PW_LANGS.map((l) => (
            <button key={l} type="button" onClick={() => pickLang(l)} aria-pressed={lang === l}
              style={{ border: 0, background: lang === l ? C.line : "transparent", color: lang === l ? C.ink : C.ink3, borderRadius: 7, padding: "4px 10px", fontSize: 12, fontWeight: 700, letterSpacing: ".03em", fontFamily: "inherit", cursor: "pointer" }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </form>
    </div>
  );
}
