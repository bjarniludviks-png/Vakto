"use client";

// Mjó rönd efst í appinu þegar gestur skoðar opna demo-fyrirtækið (DEMO_COMPANY_ID).
// „Heimasíða" og „Stofna eigið fyrirtæki" skrá demo-lotuna út (aðeins þessa lotu, scope
// „local" — aðrir gestir deila sama aðgangi) og opna forsíðuna / nýskráningu.

import { useState } from "react";
import { useLang } from "./lang";
import { createClient } from "@/lib/supabase/client";

export function DemoBar() {
  const { t } = useLang();
  const [busy, setBusy] = useState(false);

  async function leave(dest: string) {
    setBusy(true);
    try { await createClient().auth.signOut({ scope: "local" }); } catch { /* ignore */ }
    window.location.assign(dest);
  }

  return (
    <div role="status" className="demobar">
      <button className="demobar-home" onClick={() => leave("/")} disabled={busy}>
        <span aria-hidden>←</span> {t("Heimasíða")}
      </button>
      <span className="demobar-txt">{t("Þú ert í demo — gögnin eru gervigögn og núllstillast á hverri nóttu.")}</span>
      <button className="demobar-cta" onClick={() => leave("/nyskraning")} disabled={busy}>
        {t("Stofna eigið fyrirtæki")} <span aria-hidden>→</span>
      </button>
    </div>
  );
}
