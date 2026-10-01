import type { Metadata } from "next";
import LegalShell from "@/components/legal/legal-shell";
import { CookiesBody, COOKIES_META } from "@/components/legal/cookies";

export const metadata: Metadata = { title: "VAKTO — Vafrakökur", description: "Hvaða vafrakökur og geymslu vakto.is notar." };

export default function CookiesPage() {
  return (
    <LegalShell title={COOKIES_META.title} updated={COOKIES_META.updated}>
      <CookiesBody />
    </LegalShell>
  );
}
