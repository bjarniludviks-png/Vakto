import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";
import { PrivacyBody, PRIVACY_META } from "@/components/legal/privacy";

// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = { title: "VAKTO: Persónuvernd", description: "Hvernig BGL Ventures ehf. vinnur með persónuupplýsingar.", alternates: { canonical: "/personuvernd" } };

export default function PrivacyPage() {
  return (
    <AhLegal title={PRIVACY_META.title} updated={PRIVACY_META.updated}>
      <PrivacyBody />
    </AhLegal>
  );
}
