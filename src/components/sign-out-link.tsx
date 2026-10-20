"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

// „Skrá út“ á heilsíðu-hliðum (kortasíða, lokaður aðgangur) — annars kemst fólk ekki út.
// scope: 'local' skráir aðeins ÞENNAN vafra út (aðrar lotur, t.d. stuðningsinnskráning admins, haldast).
export function SignOutLink({ label = "Skrá út", style }: { label?: string; style?: React.CSSProperties }) {
  const [busy, setBusy] = useState(false);
  async function out() {
    setBusy(true);
    try { await createClient().auth.signOut({ scope: "local" }); } catch { /* ekki stillt */ }
    window.location.assign("/login");
  }
  return (
    <button type="button" onClick={out} disabled={busy}
      style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", textDecoration: "underline", cursor: "pointer", ...style }}>
      {label}
    </button>
  );
}
