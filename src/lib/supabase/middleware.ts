import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { canAccess, homeFor } from "@/lib/access";
import type { Role } from "@/components/app/nav";

/**
 * Refreshes the Supabase auth session on every request and guards the
 * authenticated app routes. Public routes: "/", "/login", "/kiosk".
 * Also enforces role-based access (brief §5) — a role hitting a screen it
 * may not see is redirected to its home screen.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // If Supabase isn't configured yet (or still the .env.example placeholder),
  // don't block local development — screens render with demo data.
  if (!url || !key || url.includes("YOUR-PROJECT") || key.includes("YOUR-")) {
    return supabaseResponse;
  }

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) =>
          request.cookies.set(name, value),
        );
        supabaseResponse = NextResponse.next({ request });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options),
        );
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // ---------- VAKTO Platform host (admin.vakto.is) ----------
  // Its own surface with its own session (cookies are host-scoped, so a
  // BM-Veitingar login on vakto.is never leaks over here — and vice versa).
  const host = (request.headers.get("host") ?? "").toLowerCase();
  const isAdminHost = host === "admin.vakto.is" || host.startsWith("admin.localhost");
  const adminAllowlist = (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com")
    .split(",").map((s) => s.trim().toLowerCase()).filter(Boolean);
  if (isAdminHost) {
    const adminPublic = pathname.startsWith("/login") || pathname.startsWith("/auth/") ||
      pathname.startsWith("/nytt-lykilord") || pathname.startsWith("/_next") ||
      pathname === "/favicon.ico" || pathname.startsWith("/icon") || pathname.startsWith("/apple-icon") ||
      pathname === "/manifest.webmanifest" || pathname === "/robots.txt";
    if (user && !adminAllowlist.includes((user.email ?? "").toLowerCase())) {
      // Signed in but not VAKTO staff → back to the customer product.
      return NextResponse.redirect("https://vakto.is/maelabord");
    }
    if (!user && !adminPublic) {
      const loginUrl = request.nextUrl.clone();
      loginUrl.pathname = "/login";
      return NextResponse.redirect(loginUrl);
    }
    if (user && !pathname.startsWith("/admin") && !adminPublic) {
      const dest = request.nextUrl.clone();
      dest.pathname = "/admin";
      return NextResponse.redirect(dest);
    }
    if (pathname === "/") {
      const dest = request.nextUrl.clone();
      dest.pathname = user ? "/admin" : "/login";
      return NextResponse.redirect(dest);
    }
    return supabaseResponse;
  }
  // Production main host: the platform area lives on its own subdomain.
  if (pathname.startsWith("/admin") && (host === "vakto.is" || host === "www.vakto.is")) {
    return NextResponse.redirect("https://admin.vakto.is/admin");
  }

  const isPublic =
    pathname === "/" ||
    pathname.startsWith("/login") ||
    pathname.startsWith("/nyskraning") ||
    pathname.startsWith("/ny") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/nytt-lykilord") ||
    pathname.startsWith("/adgangur-lokadur") ||
    pathname.startsWith("/kiosk") ||
    // PWA / icon assets must be reachable without auth (home-screen install).
    pathname === "/manifest.webmanifest" ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
    pathname.startsWith("/api/splash") ||
    // Open Revenue API — authenticated by per-company API keys, not sessions.
    pathname.startsWith("/api/v1/") ||
    pathname.startsWith("/api/cron/") ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname === "/favicon.ico";

  if (!user && !isPublic) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = "/login";
    return NextResponse.redirect(loginUrl);
  }

  // Role-based access (brief §5). Only for authenticated, guarded app routes.
  if (user && !isPublic && !pathname.startsWith("/api") && !pathname.startsWith("/hjalp")) {
    const { data: profile } = await supabase
      .from("users").select("role, companies(billing_status)").eq("id", user.id).maybeSingle();

    // Suspended company → everyone locked out (except the VAKTO admin allowlist).
    const co = (Array.isArray(profile?.companies) ? profile?.companies[0] : profile?.companies) as { billing_status?: string | null } | null;
    if (co?.billing_status === "suspended" && pathname !== "/adgangur-lokadur") {
      const adminList = (process.env.VAKTO_ADMIN_EMAILS || "bjarniludviks@icloud.com")
        .split(",").map((s) => s.trim().toLowerCase());
      if (!adminList.includes((user.email ?? "").toLowerCase())) {
        const dest = request.nextUrl.clone();
        dest.pathname = "/adgangur-lokadur";
        return NextResponse.redirect(dest);
      }
    }

    const role = (profile?.role as Role) ?? "owner";
    if (!canAccess(role, pathname)) {
      const dest = request.nextUrl.clone();
      dest.pathname = homeFor(role);
      return NextResponse.redirect(dest);
    }
  }

  return supabaseResponse;
}
