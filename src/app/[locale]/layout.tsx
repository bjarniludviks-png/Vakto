import { notFound } from "next/navigation";
import { SiteLocale } from "@/components/site/lang";
import { PREFIX, langFromPrefix } from "@/components/site/i18n";

// Markaðssíður á öðrum málum: /en, /da, /sv, /no (sjá components/site/i18n.ts). Málið er fest hér svo
// síðan er rétt strax í server-render (rót-layoutið heldur lang="is"; SiteNav uppfærir <html lang>).
export const dynamicParams = false;
export function generateStaticParams() {
  return Object.values(PREFIX).map((locale) => ({ locale }));
}

export default async function LocaleLayout({ children, params }: { children: React.ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  const lang = langFromPrefix(locale);
  if (!lang) notFound();
  return <SiteLocale lang={lang}>{children}</SiteLocale>;
}
