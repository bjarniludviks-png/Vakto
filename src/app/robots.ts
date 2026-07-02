import type { MetadataRoute } from "next";

const BASE = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      // Public marketing/auth pages are crawlable; the authenticated app is not.
      { userAgent: "*", allow: ["/", "/login", "/nyskraning"], disallow: ["/maelabord", "/vaktaplan", "/timaskraning", "/launakeyrslur", "/starfsfolk", "/skyrslur", "/frammistada", "/mitt-svaedi", "/spjall", "/stillingar", "/hjalp", "/kiosk", "/api/"] },
    ],
    sitemap: `${BASE}/sitemap.xml`,
  };
}
