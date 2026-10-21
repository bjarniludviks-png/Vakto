import { createClient } from "@supabase/supabase-js";
import { DEMO_READONLY_HEADER, DEMO_READONLY_MSG } from "@/lib/demo-readonly";

// Opið demo er aðeins til skoðunar. Þjónustulykillinn fer framhjá RLS (migration 0087), svo hér er
// sjálfgefin lokun: skrif á REST/Storage innan beiðni demo-notanda fá 403 — nema þetta (talning
// AI-spurninga, forsíðuspjall, lesköll sem nota POST).
const DEMO_WRITE_ALLOW = [
  /\/rest\/v1\/rpc\/(ai_usage_bump|ai_usage_count|ai_cost_since|plan_allows|chat_unread_counts|company_has_card|is_platform_admin|my_geofence_mode)(\?|$)/,
  /\/rest\/v1\/(audit_log|ai_conversations|ai_messages|ai_usage_calls|support_threads|support_messages|site_visits)(\?|$)/,
  /\/storage\/v1\/object\/(sign|list)\//,
];

async function demoGuardedFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  if (method !== "GET" && method !== "HEAD" && process.env.DEMO_COMPANY_ID) {
    const url = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    if (/\/(rest|storage)\/v1\//.test(url) && !DEMO_WRITE_ALLOW.some((re) => re.test(url))) {
      // Utan beiðni (cron, næturkeyrsla) skilar currentUserIsDemo false.
      const { currentUserIsDemo } = await import("@/lib/demo.server");
      if (await currentUserIsDemo()) {
        return new Response(JSON.stringify({ message: DEMO_READONLY_MSG, code: "42501" }), {
          status: 403,
          headers: { "content-type": "application/json", [DEMO_READONLY_HEADER]: "1" },
        });
      }
    }
  }
  return fetch(input, init);
}

/**
 * Service-role Supabase client — SERVER ONLY. Bypasses RLS.
 * Use for admin actions like provisioning a new employee + auth user.
 * Never import this into a Client Component.
 */
export function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false }, global: { fetch: demoGuardedFetch } },
  );
}
