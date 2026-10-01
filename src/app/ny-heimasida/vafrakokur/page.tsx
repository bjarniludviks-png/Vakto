import type { Metadata } from "next";
import "../home.css";
import "../legal.css";
import AhLegal from "../ah-legal";
import { CookiesBody, COOKIES_META } from "@/components/legal/cookies";

export const metadata: Metadata = { title: "VAKTO: Vafrakökur", robots: { index: false, follow: false } };

export default function Page() {
  return <AhLegal title={COOKIES_META.title} updated={COOKIES_META.updated}><CookiesBody /></AhLegal>;
}
