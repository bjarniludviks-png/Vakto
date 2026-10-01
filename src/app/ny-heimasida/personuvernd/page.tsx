import type { Metadata } from "next";
import "../home.css";
import "../legal.css";
import AhLegal from "../ah-legal";
import { PrivacyBody, PRIVACY_META } from "@/components/legal/privacy";

export const metadata: Metadata = { title: "VAKTO: Persónuvernd", robots: { index: false, follow: false } };

export default function Page() {
  return <AhLegal title={PRIVACY_META.title} updated={PRIVACY_META.updated}><PrivacyBody /></AhLegal>;
}
