"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLang } from "./lang";
import { toast } from "./toast";
import { saveCompanyKennitala } from "@/app/(app)/stillingar/payment-actions";
import type { BillingNotice as Notice } from "@/lib/billing-notice.server";

const ddmm = (iso: string) => { const d = new Date(iso); return `${String(d.getUTCDate()).padStart(2, "0")}.${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };

/** Eigandi: kennitölu-gluggi (lokar ekki fyrr en gild kennitala er vistuð) eða borði um greiðsluleið á síðustu dögum prufu. */
export function BillingNotice({ notice }: { notice: Notice }) {
  const { t } = useLang();
  const router = useRouter();
  const [kt, setKt] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  if (!notice) return null;

  if (notice.kind === "choose") {
    return (
      <div role="status" style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", background: "var(--warn-soft)", color: "var(--ink)", borderRadius: 12, padding: "11px 16px", margin: "0 0 16px", fontSize: 13.5 }}>
        <span style={{ marginRight: "auto" }}><b>{t("Prufan rennur út")} {ddmm(notice.endsOn)}</b>: {t("skráðu kort eða veldu kröfu í heimabanka.")}</span>
        <Link className="btn sm" href="/stillingar?tab=askrift">{t("Velja greiðsluleið")}</Link>
      </div>
    );
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setErr(null);
    const r = await saveCompanyKennitala(kt);
    setBusy(false);
    if (!r.ok) { setErr(r.error ?? t("Tókst ekki")); return; }
    toast(t("Kennitala vistuð"));
    router.refresh();
  }

  return (
    <div className="mwrap show" role="dialog" aria-modal="true" aria-labelledby="kt-h">
      <div className="mbg" />
      <form className="modal" style={{ maxWidth: 440 }} onSubmit={save}>
        <div className="mh"><div id="kt-h" style={{ fontSize: 16, fontWeight: 700 }}>{t("Kennitala fyrirtækisins")}</div></div>
        <div className="mb">
          <p style={{ margin: "0 0 14px", fontSize: 14, lineHeight: 1.55 }}>{t("Reikningar fyrir áskriftina fara á kennitölu fyrirtækisins. Skráðu hana til að halda áfram.")}</p>
          <div className="field"><input aria-label={t("Kennitala fyrirtækisins")} value={kt} onChange={(e) => setKt(e.target.value.replace(/[^\d-]/g, "").slice(0, 11))} placeholder="000000-0000" inputMode="numeric" autoComplete="off" autoFocus required /></div>
          {err && <div style={{ color: "var(--bad)", fontSize: 13, fontWeight: 600, marginTop: 10 }}>{err}</div>}
          <div style={{ display: "flex", gap: 9, marginTop: 18 }}>
            <button className="btn" type="submit" disabled={busy}>{busy ? t("Augnablik…") : t("Vista")}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
