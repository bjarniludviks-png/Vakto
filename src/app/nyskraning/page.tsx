import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "../login/login.css";
import "@/components/site/home.css";
import "@/components/site/auth.css";
import { SignupPage } from "@/components/site/auth-pages";

// Nýskráning („Prófa frítt“) í útliti forsíðunnar (IS/EN, okt. 2026).
// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = {
  title: "Prófa VAKTO frítt í 14 daga",
  description: "Stofnaðu aðgang að VAKTO og settu upp fyrsta vaktaplanið í dag. 14 daga frí prufa, engin binding.",
  alternates: { canonical: "/nyskraning" },
};

export default function Page() {
  return <SignupPage />;
}
