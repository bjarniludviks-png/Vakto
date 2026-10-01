import type { Metadata } from "next";
import AhLegal from "@/components/site/ah-legal";
import "@/components/site/home.css";
import "@/components/site/legal.css";
import { TermsBody, TERMS_META } from "@/components/legal/terms";

export const metadata: Metadata = { title: "VAKTO — Skilmálar", description: "Þjónustuskilmálar VAKTO ehf." };

export default function TermsPage() {
  return (
    <AhLegal title={TERMS_META.title} updated={TERMS_META.updated}>
      <TermsBody />
    </AhLegal>
  );
}
