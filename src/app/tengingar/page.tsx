import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "@/components/site/verd.css";
import "@/components/site/tengingar.css";
import TengClient from "@/components/site/teng-client";
import { pageMetadata } from "@/components/site/site-meta";

// Tengingar (nóv. 2026): aðeins það sem VAKTO tengist í alvöru, með skrefum úr Stillingum. Texti í teng-text.ts.
export const viewport = siteViewport;
export const metadata = pageMetadata("integrations", "is");

export default function Page() {
  return <TengClient />;
}
