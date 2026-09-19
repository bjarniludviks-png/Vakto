"use client";

// Turns a Supabase hashed_token (from auth.admin.generateLink) into a session
// in THIS browser via verifyOtp — the same pattern /nytt-lykilord uses, because
// the PKCE browser client rejects the implicit "#access_token" landing that
// generateLink's action_link produces. Used by /admin/enter (start
// impersonation on the same host) and /admin/return (back to the platform).

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const safeNext = (raw: string | null, fallback: string) =>
  raw && raw.startsWith("/") && !raw.startsWith("//") ? raw : fallback;

export default function TokenExchange({ fallbackNext, title }: { fallbackNext: string; title: string }) {
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tokenHash = params.get("token_hash");
    const next = safeNext(params.get("next"), fallbackNext);
    (async () => {
      if (!tokenHash) { setFailed("Hlekkinn vantar."); return; }
      const supabase = createClient();
      // Any session already in this browser (e.g. the admin's own on a shared
      // host) is replaced by the one the token belongs to.
      const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type: "magiclink" });
      if (error) { setFailed(error.message); return; }
      window.location.replace(next);
    })();
  }, [fallbackNext]);

  return (
    <div className="card" style={{ maxWidth: 480, margin: "40px auto" }}>
      <div className="cb">
        <div className="ct" style={{ marginBottom: 6 }}>{title}</div>
        {failed ? (
          <>
            <p className="muted" style={{ fontSize: 13.5, lineHeight: 1.5 }}>
              Hlekkurinn virkaði ekki (útrunninn eða þegar notaður): {failed}
            </p>
            <a className="btn sm" href="/login">Skrá inn</a>
          </>
        ) : (
          <p className="muted" style={{ fontSize: 13.5 }}>Augnablik…</p>
        )}
      </div>
    </div>
  );
}
