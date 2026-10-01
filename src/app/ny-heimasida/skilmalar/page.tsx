import type { Metadata } from "next";
import "../home.css";
import "../legal.css";
import AhLegal from "../ah-legal";
import { TermsBody, TERMS_META } from "@/components/legal/terms";

export const metadata: Metadata = { title: "VAKTO: Skilmálar", robots: { index: false, follow: false } };

export default function Page() {
  return <AhLegal title={TERMS_META.title} updated={TERMS_META.updated}><TermsBody /></AhLegal>;
}
