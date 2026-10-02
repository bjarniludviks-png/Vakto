import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE_URL}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE_URL}/um-okkur`, lastModified: now, changeFrequency: "monthly", priority: 0.7 },
    { url: `${SITE_URL}/nyskraning`, lastModified: now, changeFrequency: "monthly", priority: 0.8 },
    { url: `${SITE_URL}/login`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/personuvernd`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/skilmalar`, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/vafrakokur`, changeFrequency: "yearly", priority: 0.2 },
  ];
}
