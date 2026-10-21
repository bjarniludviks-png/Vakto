import Link from "next/link";
import { PageHeader } from "@/components/app/page-header";
import { FEATURE_IS, upgradeLabel, type Feature } from "@/lib/plan-features";

// Sýnt í stað skjás þegar eiginleiki er utan áskriftarleiðar fyrirtækisins (0089).
// Þjónninn og grunnurinn framfylgja líka — þetta er bara vingjarnlega viðmótið.

/** Lítill borði: „Í boði í Grunni — sjá verð“ (hlekkur á /verd). */
export function UpgradeHint({ feature }: { feature: Feature }) {
  return (
    <span style={{ fontSize: 12.5, color: "var(--ink3)" }}>
      {upgradeLabel(feature)} — <Link href="/verd" style={{ color: "var(--brand)", fontWeight: 600 }}>sjá verð</Link>
    </span>
  );
}

/** Heill skjár fyrir læstan eiginleika. */
export function UpgradePrompt({ feature, title }: { feature: Feature; title?: string }) {
  return (
    <>
      <PageHeader title={title ?? FEATURE_IS[feature]} />
      <div className="card" style={{ maxWidth: 560 }}>
        <div className="cb" style={{ display: "grid", gap: 12 }}>
          <div style={{ fontSize: 15, fontWeight: 650 }}>{FEATURE_IS[feature]} — {upgradeLabel(feature).toLowerCase()}</div>
          <p style={{ margin: 0, color: "var(--ink2)", fontSize: 13.5, lineHeight: 1.55 }}>
            Þessi hluti VAKTO fylgir ekki áskriftarleið fyrirtækisins. Stjórnandi getur skipt um leið hvenær sem er í
            Stillingum → Áskrift og breytingin tekur gildi strax.
          </p>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            <Link className="btn" href="/verd">Sjá verð</Link>
            <Link className="btn ghost" href="/stillingar?tab=askrift">Stillingar → Áskrift</Link>
          </div>
        </div>
      </div>
    </>
  );
}
