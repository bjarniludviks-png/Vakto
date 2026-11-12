import type { Metadata } from "next";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "./verktakar.css";
import VerktakarClient from "./verktakar-client";
import { pageMetadata } from "@/components/site/site-meta";

export const viewport = siteViewport;
export const metadata: Metadata = pageMetadata("contractors", "is");

export default function Page() {
  return <VerktakarClient />;
}
