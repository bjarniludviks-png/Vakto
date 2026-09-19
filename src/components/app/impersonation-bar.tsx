"use client";

// Slim orange bar at the very top of the customer app while the VAKTO admin
// is signed in as a customer (support). Display state comes from the
// non-httpOnly companion cookie "vakto-impersonating-ui" = "1|<company>";
// the real proof is the signed httpOnly cookie that endImpersonation checks.

import { useState, useSyncExternalStore } from "react";
import { endImpersonation } from "@/app/admin/actions";
import { toast } from "./toast";

const UI_COOKIE = "vakto-impersonating-ui=";

function readCompany(): string | null {
  try {
    const raw = document.cookie.split("; ").find((c) => c.startsWith(UI_COOKIE));
    if (!raw) return null;
    const v = decodeURIComponent(raw.slice(UI_COOKIE.length));
    return v.startsWith("1|") ? v.slice(2) : null;
  } catch {
    return null;
  }
}

// Cookies don't emit change events; the bar only needs the value at mount
// (a full navigation follows every change), so subscribe is a no-op.
const subscribe = () => () => {};
const serverSnapshot = () => null;

export function ImpersonationBar() {
  const company = useSyncExternalStore(subscribe, readCompany, serverSnapshot);
  const [busy, setBusy] = useState(false);
  if (!company) return null;

  async function back() {
    setBusy(true);
    try {
      const r = await endImpersonation(); // redirects on success (never returns)
      if (r && !r.ok) { toast(r.error ?? "Tókst ekki"); setBusy(false); }
    } catch (e) {
      // Next's redirect() surfaces as a thrown navigation — let it happen.
      if (!(e instanceof Error && e.message.includes("NEXT_REDIRECT"))) { toast("Tókst ekki"); setBusy(false); }
    }
  }

  return (
    <div
      role="status"
      style={{
        background: "#e9700f", color: "#fff", fontSize: 13, fontWeight: 500,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
        padding: "7px 16px", position: "relative", zIndex: 60,
      }}
    >
      <span>Þú ert skráð(ur) inn sem <b>{company}</b></span>
      <span aria-hidden style={{ opacity: 0.6 }}>—</span>
      <button
        onClick={back}
        disabled={busy}
        style={{
          font: "inherit", fontSize: 12.5, fontWeight: 650, color: "#e9700f", background: "#fff",
          border: 0, borderRadius: 8, padding: "5px 12px", cursor: busy ? "default" : "pointer", opacity: busy ? 0.7 : 1,
        }}
      >
        {busy ? "Augnablik…" : "Aftur í VAKTO Admin"}
      </button>
    </div>
  );
}
