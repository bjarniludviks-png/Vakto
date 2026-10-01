import type { Metadata } from "next";
import "../login/login.css";
import "@/components/site/home.css";
import "@/components/site/auth.css";
import { SignupPage } from "@/components/site/auth-pages";

// Nýskráning („Prófa frítt“) í útliti forsíðunnar (IS/EN, okt. 2026).
export const metadata: Metadata = { title: "VAKTO: Prófa frítt" };

export default function Page() {
  return <SignupPage />;
}
