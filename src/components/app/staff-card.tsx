"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useLang } from "./lang";
import { toast } from "./toast";

export type StaffCardData = {
  name: string; role: string; company: string; department?: string | null;
  photoUrl: string | null; idCode: string; initials: string; color: string;
  employeeKt?: string | null; companyKt?: string | null;
};

/** A small labelled field on the orange card (uppercase label + value). */
function Field({ k, v }: { k: string; v: string }) {
  return (
    <div>
      <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>{k}</div>
      <div style={{ fontSize: 15, fontWeight: 700, marginTop: 3, fontVariantNumeric: "tabular-nums" }}>{v}</div>
    </div>
  );
}

/** Company initials → short code, e.g. "BM Veitingar" → "BMV". */
function companyCode(name: string): string {
  const c = name.split(/\s+/).map((w) => w[0]).join("").replace(/[^A-Za-zÁÐÉÍÓÚÝÞÆÖ]/g, "").toUpperCase();
  return (c || name.replace(/\s+/g, "")).slice(0, 3);
}
/** Deterministic 4-digit badge number from the id code. */
function badgeNo(idCode: string): string {
  let h = 0;
  for (let i = 0; i < idCode.length; i++) h = (h * 31 + idCode.charCodeAt(i)) >>> 0;
  return String(h % 10000).padStart(4, "0");
}

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

  const code = companyCode(card.company);
  const no = badgeNo(card.idCode);

  return (
    <div className="mwrap show" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="mbg" onClick={onClose} />
      <div className="modal" style={{ maxWidth: 380, padding: 16, background: "var(--bg, #f4f4f6)" }}>
        <button className="x" onClick={onClose} style={{ position: "absolute", right: 12, top: 12, zIndex: 2, color: "#fff" }}>✕</button>

        {/* the ID badge */}
        <div style={{ position: "relative", overflow: "hidden", borderRadius: 22, color: "#fff",
          background: "linear-gradient(150deg,#e9700f 0%,#d9640d 55%,#c85a0b 100%)",
          boxShadow: "0 18px 44px rgba(201,90,11,.34)", padding: "22px 24px 20px" }}>
          {/* decorative circle */}
          <div style={{ position: "absolute", top: -70, right: -50, width: 220, height: 220, borderRadius: "50%", background: "rgba(255,255,255,.10)" }} />

          {/* top row: brand + company */}
          <div style={{ position: "relative", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 9, fontWeight: 800, fontSize: 17, letterSpacing: ".02em" }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none"><rect x="3" y="13" width="4" height="8" rx="1.2" fill="#fff" /><rect x="10" y="8" width="4" height="13" rx="1.2" fill="#fff" /><rect x="17" y="4" width="4" height="17" rx="1.2" fill="#fff" /></svg>
              VAKTO
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: ".02em", textTransform: "uppercase", maxWidth: 160, textAlign: "right", lineHeight: 1.15 }}>{card.company}</span>
          </div>

          {/* avatar */}
          <div style={{ position: "relative", marginTop: 18 }}>
            {card.photoUrl
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={card.photoUrl} alt="" style={{ width: 96, height: 96, borderRadius: "50%", objectFit: "cover", border: "3px solid rgba(255,255,255,.35)" }} />
              : <span style={{ width: 96, height: 96, borderRadius: "50%", background: "rgba(255,255,255,.22)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 700, fontSize: 32 }}>{card.initials}</span>}
          </div>

          {/* name */}
          <div style={{ position: "relative", marginTop: 14 }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: "rgba(255,255,255,.72)" }}>{t("Starfsmaður")}</div>
            <div style={{ fontSize: 27, fontWeight: 800, letterSpacing: "-.02em", marginTop: 2 }}>{card.name}</div>
          </div>

          {/* fields: staða / deild / nr. */}
          <div style={{ position: "relative", marginTop: 16, display: "flex", gap: 26, flexWrap: "wrap" }}>
            <Field k={t("Staða")} v={t(card.role)} />
            {card.department && <Field k={t("Deild")} v={card.department} />}
            <Field k={t("Nr.")} v={`#${no}`} />
          </div>

          {/* fields: kennitölur */}
          {(card.employeeKt || card.companyKt) && (
            <div style={{ position: "relative", marginTop: 14, display: "flex", gap: 26, flexWrap: "wrap" }}>
              {card.employeeKt && <Field k={t("Kennitala")} v={card.employeeKt} />}
              {card.companyKt && <Field k={t("Kt. fyrirtækis")} v={card.companyKt} />}
            </div>
          )}

          {/* QR */}
          <div style={{ position: "relative", marginTop: 18, background: "#fff", borderRadius: 18, padding: 18, display: "flex", justifyContent: "center" }}>
            {qr
              // eslint-disable-next-line @next/next/no-img-element
              ? <img src={qr} alt="QR" style={{ width: 210, height: 210 }} />
              : <div style={{ width: 210, height: 210, background: "var(--line2)", borderRadius: 10 }} />}
          </div>

          {/* footer */}
          <div style={{ position: "relative", marginTop: 16, textAlign: "center", fontSize: 12, fontWeight: 600, color: "rgba(255,255,255,.85)", letterSpacing: ".01em" }}>
            VAKTO-{no}-{code} · {t("skannaðu á stimpilklukku")}
          </div>
        </div>

        {/* wallet buttons */}
        <div style={{ display: "flex", gap: 9, marginTop: 14 }}>
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
