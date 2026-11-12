import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { siteViewport } from "@/components/site/viewport";
import "@/components/site/home.css";
import "@/components/site/verd.css";
import "@/components/site/um.css";
import "@/components/site/tengingar.css";
import "@/app/verktakar/verktakar.css";
import { SitePage } from "@/components/site/site-page";
import { PATHS, PREFIX, langFromPrefix, pageFromSlug, type PrefixedLang } from "@/components/site/i18n";
import { pageMetadata } from "@/components/site/site-meta";

// Undirsíður á öðrum málum, með staðbundnum slóðum (/da/priser, /sv/integrationer …). Slóðirnar eru í i18n.ts.
export const viewport = siteViewport;
export const dynamicParams = false;

export function generateStaticParams() {
  return (Object.keys(PREFIX) as PrefixedLang[]).flatMap((lang) =>
    Object.entries(PATHS[lang]).filter(([k]) => k !== "home").map(([, path]) => ({ locale: PREFIX[lang], slug: path.split("/").pop()! })));
}

async function resolve(params: Promise<{ locale: string; slug: string }>) {
  const { locale, slug } = await params;
  const lang = langFromPrefix(locale);
  const page = lang ? pageFromSlug(lang, slug) : null;
  return lang && page ? { lang, page } : null;
}

export async function generateMetadata({ params }: { params: Promise<{ locale: string; slug: string }> }): Promise<Metadata> {
  const r = await resolve(params);
  if (!r) return {};
  return pageMetadata(r.page, r.lang, r.page === "about" ? { images: ["/showcase/forsida/um/bjarni-wide.jpg"] } : undefined);
}

export default async function Page({ params }: { params: Promise<{ locale: string; slug: string }> }) {
  const r = await resolve(params);
  if (!r) notFound();
  return <SitePage page={r.page} />;
}
