import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "@/components/site/verd.css";
import PricingClient from "@/components/site/pricing-client";
import { PRICING_TEXT } from "@/components/site/pricing-text";
import { PLANS } from "@/lib/plans";
import { SITE_URL } from "@/lib/site";

// Verðsíðan (okt. 2026): fjórar leiðir, reiknivél, viðbætur, samanburður og spurningar.
// Tölur í src/lib/plans.ts, texti í components/site/pricing-text.ts.
const T = PRICING_TEXT.is;

export const viewport = siteViewport;
export const metadata: Metadata = {
  title: T.metaTitle,
  description: T.metaDesc,
  alternates: { canonical: "/verd" },
  openGraph: { url: "/verd", title: T.metaTitle, description: T.metaDesc },
};

// Skipulögð gögn: hver leið sem Offer (verð á mánuði án VSK).
const LD = {
  "@context": "https://schema.org", "@type": "SoftwareApplication", name: "VAKTO", url: `${SITE_URL}/verd`,
  applicationCategory: "BusinessApplication", operatingSystem: "Web, iOS, Android",
  offers: PLANS.map((p) => ({
    "@type": "Offer", name: T.plans[p.id].name, price: String(p.base), priceCurrency: "ISK",
    description: p.extraPerEmployee === null
      ? `Allt að ${p.included} starfsmenn, 1 staður. Án VSK.`
      : `Á mánuði án VSK, ${p.included} virkir starfsmenn innifaldir, ${p.extraPerEmployee} kr á hvern umfram. VAKTO AI: ${p.aiQuestions} spurningar á mánuði.`,
  })),
};

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD).replace(/</g, "\\u003c") }} />
      <PricingClient />
    </>
  );
}
