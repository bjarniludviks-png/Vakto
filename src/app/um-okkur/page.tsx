import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "@/components/site/um.css";
import AboutClient from "@/components/site/about-client";

// viewport-fit=cover + ljós theme-color fyrir opna vefinn (iOS 26 Safari, sjá components/site/viewport.ts).
export const viewport = siteViewport;
export const metadata: Metadata = {
  title: "VAKTO: Um okkur",
  description: "VAKTO er búið til af rekstraraðila sem fann aldrei einfalt kerfi fyrir vaktir, laun og starfsfólk.",
  alternates: { canonical: "/um-okkur" },
  openGraph: { url: "/um-okkur", images: ["/showcase/forsida/um/bjarni-wide.jpg"] },
};

export default function Page() {
  return <AboutClient />;
}
