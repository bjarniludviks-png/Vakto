import type { MetadataRoute } from "next";

import { SITE_URL as BASE } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Public marketing/auth pages are crawlable; the authenticated app is not.
      { userAgent: "*", allow: ["/", "/um-okkur", "/login", "/nyskraning", "/personuvernd", "/skilmalar", "/vafrakokur"], disallow: ["/admin", "/maelabord", "/vaktaplan", "/timaskraning", "/launakeyrslur", "/starfsfolk", "/skyrslur", "/frammistada", "/mitt-svaedi", "/spjall", "/stillingar", "/hjalp", "/kiosk", "/api/", "/og/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
