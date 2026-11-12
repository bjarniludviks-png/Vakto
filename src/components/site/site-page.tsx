// Ein leið til að birta markaðssíðu á hvaða máli sem er (íslensku slóðirnar og /en, /da, /sv, /no).
// Server-íhlutur: síðurnar sjálfar eru client-íhlutir sem lesa málið úr SiteLocale (eða vali á IS-slóðum).
import AppleHome from "./home-client";
import PricingClient from "./pricing-client";
import AboutClient from "./about-client";
import TengClient from "./teng-client";
import VerktakarClient from "@/app/verktakar/verktakar-client";
import { demoConfigured } from "@/lib/demo.server";
import type { PageKey } from "./i18n";

export function SitePage({ page }: { page: PageKey }) {
  switch (page) {
    case "home": return <AppleHome demo={demoConfigured()} />;
    case "price": return <PricingClient />;
    case "about": return <AboutClient />;
    case "contractors": return <VerktakarClient />;
    case "integrations": return <TengClient />;
  }
}
