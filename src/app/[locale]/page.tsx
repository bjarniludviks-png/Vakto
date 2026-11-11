import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import { SitePage } from "@/components/site/site-page";
import { langFromPrefix } from "@/components/site/i18n";
import { pageMetadata } from "@/components/site/site-meta";

// Forsíða á öðru máli (/en, /da, /sv, /no).
export const viewport = siteViewport;

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const lang = langFromPrefix((await params).locale);
  return lang ? pageMetadata("home", lang) : {};
}

export default async function Page({ params }: { params: Promise<{ locale: string }> }) {
  if (!langFromPrefix((await params).locale)) notFound();
  return <SitePage page="home" />;
}
