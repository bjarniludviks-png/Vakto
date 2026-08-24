"use client";

// Minimal platform chrome: dark top bar (deliberately distinct from the
// customer app so it's obvious you're in VAKTO-the-company territory).
import { createClient } from "@/lib/supabase/client";

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  async function signOut() {
    try { await createClient().auth.signOut(); } catch { /* ignore */ }
    window.location.assign("/login");
  }
  return (
    <>
      <header style={{
        background: "#101014", color: "#f4f2ee", padding: "0 22px", height: 58,
        display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 50,
      }}>
        <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
          <rect x="3" y="15" width="5.4" height="10" rx="1.6" fill="#f59331" />
          <rect x="11.3" y="9" width="5.4" height="16" rx="1.6" fill="#e9700f" />
          <rect x="19.6" y="3" width="5.4" height="22" rx="1.6" fill="#cf5f0c" />
        </svg>
        <b style={{ fontSize: 15.5, letterSpacing: 1 }}>VAKTO</b>
        <span style={{
          fontSize: 10.5, fontWeight: 700, letterSpacing: ".12em", color: "#f59331",
          border: "1px solid rgba(245,147,49,.4)", borderRadius: 999, padding: "3px 10px",
        }}>PLATFORM</span>
        <span style={{ marginLeft: "auto", fontSize: 12.5, color: "rgba(244,242,238,.55)" }}>{email}</span>
        <button
          onClick={signOut}
          style={{
            font: "inherit", fontSize: 12.5, fontWeight: 600, color: "#f4f2ee", cursor: "pointer",
            background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.14)",
            borderRadius: 9, padding: "7px 14px",
          }}
        >
          Skrá út
        </button>
      </header>
      <main style={{ maxWidth: 1160, margin: "0 auto", padding: "26px 22px 60px" }}>{children}</main>
    </>
  );
}
