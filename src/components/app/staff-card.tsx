"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useLang } from "./lang";
import { toast } from "./toast";

export type StaffCardData = {
  name: string; role: string; company: string;
  photoUrl: string | null; idCode: string; initials: string; color: string;
};

export function StaffCardModal({ card, onClose }: { card: StaffCardData; onClose: () => void }) {
  const { t } = useLang();
  const [qr, setQr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const origin = typeof window !== "undefined" ? window.location.origin : "https://vakto.is";
    QRCode.toDataURL(`${origin}/s/${card.idCode}`, { width: 240, margin: 1, color: { dark: "#111827", light: "#ffffff" } })
      .then(setQr).catch(() => setQr(null));
  }, [card.idCode]);

  async function addToWallet(platform: "apple" | "google") {
    setBusy(true);
    try {
      const res = await fetch(`/api/wallet/pass?platform=${platform}`);
      if (res.ok) {
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        window.location.href = url;
      } else {
        const j = await res.json().catch(() => ({} as { message?: string }));
        toast(j.message ?? t("Wallet er ekki uppsett enn"));
      }
    } catch {
      toast(t("Wallet er ekki uppsett enn"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 360, padding: 0, overflow: "hidden" }}>
        {/* brand header */}
        <div style={{ background: "linear-gradient(135deg,#e9700f,#f59e3c)", color: "#fff", padding: "16px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800, letterSpacing: "-.01em" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><rect x="3" y="13" width="4" height="8" rx="1.2" fill="#fff" /><rect x="10" y="8" width="4" height="13" rx="1.2" fill="#fff" /><rect x="17" y="4" width="4" height="17" rx="1.2" fill="#fff" /></svg>
            VAKTO
          </div>
          <span style={{ fontSize: 11, fontWeight: 600, opacity: .92, textTransform: "uppercase", letterSpacing: ".04em" }}>{t("Starfsmannaskírteini")}</span>
          <button className="x" onClick={onClose} style={{ position: "absolute", right: 12, top: 12, color: "#fff" }}>✕</button>
        </div>

        {/* identity */}
        <div style={{ padding: "20px 20px 8px", display: "flex", alignItems: "center", gap: 14 }}>
          {card.photoUrl
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={card.photoUrl} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: "cover" }} />
            : <span style={{ width: 64, height: 64, borderRadius: 16, background: card.color, color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 24 }}>{card.initials}</span>}
          <div>
            <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.01em" }}>{card.name}</div>
            <div style={{ fontSize: 13.5, color: "var(--ink2)", fontWeight: 600 }}>{t(card.role)}</div>
            <div style={{ fontSize: 12.5, color: "var(--ink3)" }}>{card.company}</div>
          </div>
        </div>

        {/* QR */}
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "8px 20px 16px" }}>
          {qr
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={qr} alt="QR" style={{ width: 168, height: 168 }} />
            : <div style={{ width: 168, height: 168, background: "var(--line2)", borderRadius: 12 }} />}
          <div className="muted" style={{ fontSize: 11.5, marginTop: 6 }}>{t("Sýndu kóðann við innstimplun eða auðkenningu")}</div>
        </div>

        {/* wallet buttons */}
        <div style={{ display: "flex", gap: 9, padding: "0 20px 20px" }}>
          <button className="btn" disabled={busy} style={{ flex: 1, background: "#111827", justifyContent: "center" }} onClick={() => addToWallet("apple")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M16.4 12.9c0-2.3 1.9-3.4 2-3.4-1.1-1.6-2.8-1.8-3.4-1.8-1.4-.1-2.8.9-3.5.9-.7 0-1.8-.8-3-.8-1.5 0-3 .9-3.8 2.3-1.6 2.8-.4 7 1.2 9.3.8 1.1 1.7 2.3 2.9 2.3 1.2 0 1.6-.7 3-.7 1.4 0 1.8.7 3 .7 1.2 0 2-1.1 2.8-2.2.9-1.3 1.2-2.5 1.3-2.6-.1 0-2.5-.9-2.5-3.5zM14.2 6c.6-.8 1.1-1.9.9-3-1 0-2.1.7-2.8 1.5-.6.7-1.1 1.8-1 2.8 1.1.1 2.2-.5 2.9-1.3z" /></svg>
            {t("Apple Wallet")}
          </button>
          <button className="btn ghost" disabled={busy} style={{ flex: 1, justifyContent: "center" }} onClick={() => addToWallet("google")}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor"><rect x="3" y="6" width="18" height="13" rx="2.5" /><path d="M3 10h18M7 15h3" /></svg>
            {t("Google Wallet")}
          </button>
        </div>
      </div>
    </div>
  );
}
