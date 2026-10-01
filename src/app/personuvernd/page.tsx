import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";
import { PrivacyBody, PRIVACY_META } from "@/components/legal/privacy";

export const metadata: Metadata = { title: "VAKTO — Persónuvernd", description: "Hvernig VAKTO ehf. vinnur með persónuupplýsingar." };

export default function PrivacyPage() {
  return (
    <LegalShell title={PRIVACY_META.title} updated={PRIVACY_META.updated}>
      <PrivacyBody />
    </LegalShell>
  );
}
