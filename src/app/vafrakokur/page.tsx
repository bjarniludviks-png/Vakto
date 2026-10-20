import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";
import { CookiesBody, COOKIES_META } from "@/components/legal/cookies";

// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = { title: "VAKTO: Vafrakökur", description: "Hvaða vafrakökur og geymslu vakto.is notar.", alternates: { canonical: "/vafrakokur" } };

export default function CookiesPage() {
  return (
    <AhLegal title={COOKIES_META.title} updated={COOKIES_META.updated}>
      <CookiesBody />
    </AhLegal>
  );
}
