"use client";

import { useEffect, useState } from "react";
import { useLang } from "./lang";
import { toast } from "./toast";
import { getWalletStatus } from "@/app/(app)/wallet-actions";

/** "Add to Apple/Google Wallet" for the staff ID card + a live QR of the clock
 * token (works on the kiosk to punch). Buttons show "væntanlegt" until the
 * provider certs are configured server-side. */
export function WalletButtons() {
  const { t } = useLang();
  const [st, setSt] = useState<{ apple: boolean; google: boolean; token: string | null } | null>(null);
  const [qr, setQr] = useState<string | null>(null);

  useEffect(() => { getWalletStatus().then(setSt); }, []);
  useEffect(() => {
    if (!st?.token) return;
    import("qrcode").then((QR) => QR.toDataURL(st.token!, { margin: 1, width: 320, color: { dark: "#1a1a1f", light: "#ffffff" } }).then(setQr).catch(() => {}));
  }, [st?.token]);

  function open(provider: "apple" | "google", ok: boolean) {
    if (!ok) { toast(t("Veskið er ekki uppsett enn — kemur fljótlega.")); return; }
    window.location.href = `/api/wallet/${provider}`;
  }

  return (
    <div className="card" style={{ marginTop: 16 }}>
      <div className="ch"><div><div className="ct">{t("Starfsmannaskírteini")}</div><div className="cs">{t("bættu því í símann þinn")}</div></div></div>
      <div className="cb" style={{ display: "flex", gap: 18, alignItems: "center", flexWrap: "wrap" }}>
        {qr && <div style={{ background: "#fff", padding: 8, borderRadius: 12, border: "1px solid var(--line)" }}><img src={qr} alt="QR" width={110} height={110} style={{ display: "block" }} /></div>}
        <div style={{ flex: 1, minWidth: 200, display: "flex", flexDirection: "column", gap: 9 }}>
          <p className="muted" style={{ fontSize: 12.5, lineHeight: 1.5, margin: 0 }}>{t("Sýndu QR-kóðann á stimpilklukkunni til að stimpla inn eða út.")}</p>
          <button className="wallet-btn apple" onClick={() => open("apple", !!st?.apple)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.5-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-2.9.9-3.7 2.3-1.6 2.7-.4 6.8 1.1 9 .7 1.1 1.6 2.3 2.8 2.3 1.1 0 1.5-.7 2.9-.7 1.3 0 1.7.7 2.9.7 1.2 0 2-1.1 2.7-2.2.9-1.3 1.2-2.5 1.2-2.6-.1 0-2.3-.9-2.3-3.5zM14.2 5.9c.6-.8 1-1.8.9-2.9-.9 0-2 .6-2.6 1.3-.6.7-1.1 1.7-.9 2.7 1 .1 2-.5 2.6-1.1z" /></svg>
            {t("Bæta í Apple Wallet")}{!st?.apple && <span className="wsoon">{t("væntanlegt")}</span>}
          </button>
          <button className="wallet-btn google" onClick={() => open("google", !!st?.google)}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"><path d="M22.5 12.2c0-.7-.1-1.4-.2-2H12v3.9h5.9a5 5 0 0 1-2.2 3.3v2.7h3.6c2.1-2 3.2-4.9 3.2-7.9z" fill="#4285F4"/><path d="M12 23c2.9 0 5.4-1 7.2-2.6l-3.6-2.7c-1 .7-2.2 1-3.6 1-2.8 0-5.1-1.9-6-4.4H2.3v2.8A11 11 0 0 0 12 23z" fill="#34A853"/><path d="M6 14.3a6.6 6.6 0 0 1 0-4.2V7.3H2.3a11 11 0 0 0 0 9.8L6 14.3z" fill="#FBBC05"/><path d="M12 5.4c1.6 0 3 .6 4.1 1.6l3.1-3.1A11 11 0 0 0 2.3 7.3L6 10.1c.9-2.5 3.2-4.7 6-4.7z" fill="#EA4335"/></svg>
            {t("Bæta í Google Wallet")}{!st?.google && <span className="wsoon">{t("væntanlegt")}</span>}
          </button>
        </div>
      </div>
    </div>
  );
}
