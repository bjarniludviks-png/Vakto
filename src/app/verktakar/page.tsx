import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "./verktakar.css";
import VerktakarClient from "./verktakar-client";

export const viewport = siteViewport;
export const metadata: Metadata = {
  title: "VAKTO Verk: tímaskráning, verkskýrslur og samþykkt fyrir verktaka",
  description: "Tímataka með staðsetningu á verkstað, myndir, efni og akstur — og viðskiptavinurinn samþykkir verkskýrsluna með einum smelli. Fyrir verktaka og einyrkja. 2.990 kr. á mánuði.",
  alternates: { canonical: "/verktakar" },
  openGraph: { url: "/verktakar", title: "VAKTO Verk — fyrir verktaka", description: "Verkið, tíminn og samþykktin. Í einu appi." },
};

export default function Page() {
  return <VerktakarClient />;
}
