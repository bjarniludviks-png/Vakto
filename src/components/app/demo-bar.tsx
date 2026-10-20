"use client";

// Mjó rönd efst í appinu þegar gestur skoðar opna demo-fyrirtækið (DEMO_COMPANY_ID).
// „Stofna eigið fyrirtæki" skráir demo-lotuna út (aðeins þessa lotu) og opnar nýskráningu.

import { useState } from "react";
import { useLang } from "./lang";
import { createClient } from "@/lib/supabase/client";

export function DemoBar() {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function signup() {
    setBusy(true);
    try { await createClient().auth.signOut({ scope: "local" }); } catch { /* ignore */ }
    window.location.assign("/nyskraning");
  }

  return (
    <div
      role="status"
      style={{
        background: "#1d1d1f", color: "#fff", fontSize: 13, fontWeight: 500,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 10, flexWrap: "wrap",
        padding: "7px 16px", position: "relative", zIndex: 60, textAlign: "center",
      }}
    >
      <span>{t("Þú ert í demo — gögnin eru gervigögn og núllstillast á hverri nóttu.")}</span>
      <button
        onClick={signup}
        disabled={busy}
        style={{
          background: "#e9700f", color: "#fff", border: 0, borderRadius: 999, padding: "4px 12px",
          fontSize: 13, fontWeight: 600, cursor: "pointer", opacity: busy ? 0.6 : 1,
        }}
      >
        {t("Stofna eigið fyrirtæki")} →
      </button>
    </div>
  );
}
