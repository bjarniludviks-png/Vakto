import type { Metadata } from "next";
import AppleHome from "@/components/site/home-client";
import "@/components/site/home.css";
import { SITE_URL } from "@/lib/site";

// Forsíða vakto.is (okt. 2026): Apple-leg síða með alvöru skjámyndum úr kerfinu og appinu.
// Komponentar og stílar síðunnar eru í src/components/site/.
const DESC = "Vaktakerfi fyrir íslenska vinnustaði: vaktaplan, stimpilklukka, launakeyrsla eftir kjarasamningi og rafrænir ráðningarsamningar. Laun sem hlutfall af veltu í rauntíma. 14 daga frí prufa.";

export const metadata: Metadata = {
  title: "VAKTO: vaktakerfi, vaktaplan, stimpilklukka og laun",
  description: DESC,
  alternates: { canonical: "/" },
  openGraph: { url: "/", title: "VAKTO: vaktakerfi, vaktaplan, stimpilklukka og laun", description: DESC },
};

// Skipulögð gögn fyrir Google (fyrirtæki, vefur og hugbúnaðurinn með verði).
const LD = [
  {
    "@context": "https://schema.org", "@type": "Organization", "@id": `${SITE_URL}/#org`,
    name: "VAKTO", legalName: "BGL Ventures ehf.", url: SITE_URL, logo: `${SITE_URL}/icon.svg`, email: "hallo@vakto.is",
    taxID: "490806-0400", address: { "@type": "PostalAddress", addressCountry: "IS" },
    sameAs: ["https://www.instagram.com/vakto.is", "https://www.facebook.com/vakto.is", "https://www.linkedin.com/company/vakto"],
  },
  { "@context": "https://schema.org", "@type": "WebSite", "@id": `${SITE_URL}/#website`, url: SITE_URL, name: "VAKTO", inLanguage: "is-IS", publisher: { "@id": `${SITE_URL}/#org` } },
  {
    "@context": "https://schema.org", "@type": "SoftwareApplication", name: "VAKTO", url: SITE_URL,
    applicationCategory: "BusinessApplication", operatingSystem: "Web, iOS, Android", inLanguage: ["is", "en"],
    description: DESC, publisher: { "@id": `${SITE_URL}/#org` },
    offers: { "@type": "Offer", price: "9990", priceCurrency: "ISK", description: "Á mánuði án VSK, 5 virkir starfsmenn innifaldir, 1.490 kr á hvern virkan starfsmann umfram. 14 daga frí prufa." },
  },
];

export default function Page() {
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(LD).replace(/</g, "\\u003c") }} />
      <AppleHome />
    </>
  );
}
