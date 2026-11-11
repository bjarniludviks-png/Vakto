import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "./ai.css";
import AiClient from "./ai-client";

export const viewport = siteViewport;
export const metadata: Metadata = {
  title: "VAKTO AI: gervigreind sem gerir hlutina í vaktaplani, tímaskráningu og launum",
  description: "Spurðu um laun % af veltu, yfirvinnu og veikindi og fáðu svar með þínum tölum. Biddu VAKTO AI að setja upp vaktaplan, samþykkja beiðnir eða laga stimplanir. Ekkert breytist fyrr en þú staðfestir.",
  alternates: { canonical: "/ai" },
  openGraph: { url: "/ai", title: "VAKTO AI — gervigreind sem gerir hlutina", description: "Spyrðu, biddu um breytingu og staðfestu. Með þínum gögnum." },
};

export default function Page() {
  return <AiClient />;
}
