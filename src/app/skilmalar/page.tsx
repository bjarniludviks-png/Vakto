import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";
import { TermsBody, TERMS_META } from "@/components/legal/terms";

export const metadata: Metadata = { title: "VAKTO — Skilmálar", description: "Þjónustuskilmálar VAKTO ehf." };

export default function TermsPage() {
  return (
    <LegalShell title={TERMS_META.title} updated={TERMS_META.updated}>
      <TermsBody />
    </LegalShell>
  );
}
