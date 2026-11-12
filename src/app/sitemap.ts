import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";
import { HREFLANG, PAGE_KEYS, PATHS, SITE_LANGS, type PageKey } from "@/components/site/i18n";

// Markaðssíðurnar á öllum málum (IS á rótinni, /en, /da, /sv, /no), hver með hreflang-tengla á hin málin.
const PRIORITY: Record<PageKey, number> = { home: 1, price: 0.9, integrations: 0.8, contractors: 0.7, about: 0.7 };
const FREQ: Record<PageKey, "weekly" | "monthly"> = { home: "weekly", price: "monthly", integrations: "monthly", contractors: "monthly", about: "monthly" };

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const url = (p: string) => `${SITE_URL}${p === "/" ? "/" : p}`;
  const site: MetadataRoute.Sitemap = PAGE_KEYS.flatMap((page) => {
    const languages = Object.fromEntries([...SITE_LANGS.map((l) => [HREFLANG[l], url(PATHS[l][page])]), ["x-default", url(PATHS.is[page])]]);
    return SITE_LANGS.map((l) => ({
      url: url(PATHS[l][page]), lastModified: now, changeFrequency: FREQ[page],
      priority: l === "is" ? PRIORITY[page] : Math.round(PRIORITY[page] * 8) / 10,
      alternates: { languages },
    }));
  });
  return [
    ...site,
    { url: `${SITE_URL}/ai`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/nyskraning`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/personuvernd`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/skilmalar`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/vafrakokur`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
