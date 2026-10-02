import type { Metadata } from "next";
import "@/components/site/home.css";
import "@/components/site/um.css";
import AboutClient from "@/components/site/about-client";

export const metadata: Metadata = {
  title: "VAKTO: Um okkur",
  description: "VAKTO er búið til af rekstraraðila sem fann aldrei einfalt kerfi fyrir vaktir, laun og starfsfólk.",
  alternates: { canonical: "/um-okkur" },
  openGraph: { url: "/um-okkur", images: ["/showcase/forsida/um/bjarni-wide.jpg"] },
};

export default function Page() {
  return <AboutClient />;
}
