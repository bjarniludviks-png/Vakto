import type { Metadata } from "next";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";
import { CookiesBody, COOKIES_META } from "@/components/legal/cookies";

export const metadata: Metadata = { title: "VAKTO: Vafrakökur", description: "Hvaða vafrakökur og geymslu vakto.is notar.", alternates: { canonical: "/vafrakokur" } };

export default function CookiesPage() {
  return (
    <AhLegal title={COOKIES_META.title} updated={COOKIES_META.updated}>
      <CookiesBody />
    </AhLegal>
  );
}
