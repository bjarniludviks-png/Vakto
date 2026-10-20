import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";
import { TermsBody, TERMS_META } from "@/components/legal/terms";

// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = { title: "VAKTO: Skilmálar", description: "Þjónustuskilmálar BGL Ventures ehf.", alternates: { canonical: "/skilmalar" } };

export default function TermsPage() {
  return (
    <AhLegal title={TERMS_META.title} updated={TERMS_META.updated}>
      <TermsBody />
    </AhLegal>
  );
}
