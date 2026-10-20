// Opna demoið er AÐEINS til skoðunar. Sameiginlegt fyrir proxy, server og vafra (engin server-only háð).
//
// Varnir í lögum (sjá líka supabase/migrations/0087_demo_readonly.sql):
//  1. Proxy (lib/supabase/middleware.ts): skrifandi /api/**-köll demo-lotu → 403 nema DEMO_API_ALLOW.
//  2. Server actions: `if (await demoBlocked()) return demoResult();` efst í öllum skrifandi aðgerðum.
//  3. Þjónustulykill (lib/supabase/admin.ts): skrif á REST/Storage innan demo-beiðni → 403.
//  4. Gagnagrunnur: RESTRICTIVE RLS — demo-notandi getur ekki INSERT/UPDATE/DELETE (líka beint úr vafra).
//  5. Viðmót: DemoGuard sýnir vinalega tilkynningu með hlekk á /nyskraning.

export const DEMO_READONLY_MSG =
  "Demo er aðeins til skoðunar — stofnaðu eigið fyrirtæki til að prófa breytingar (14 daga frí prufa).";

/** Svarhaus á lokuðum köllum (proxy + þjónustulykill) svo vafrinn geti birt tilkynninguna. */
export const DEMO_READONLY_HEADER = "x-vakto-demo-readonly";

/** Skrifandi API-leiðir sem demo-lota MÁ kalla (allt annað undir /api/ er lokað fyrir demo). */
export const DEMO_API_ALLOW: { path: string; methods: string[]; prefix?: boolean }[] = [
  { path: "/api/assistant", methods: ["POST"] }, // VAKTO AI-spurningar (svör; tillögur keyrast ekki — /api/assistant/execute er lokað)
  { path: "/api/ai/schedule", methods: ["POST"] }, // AI-tillaga að vaktaplani (aðeins tillaga; „Birta" er lokað)
  { path: "/api/home-chat", methods: ["POST"], prefix: true }, // spjall á forsíðu (+ /handoff)
  { path: "/api/kynning", methods: ["POST"] }, // beiðni um kynningu
  { path: "/api/v", methods: ["POST"] }, // heimsóknatalning
  // Ekki lotubundið (eigin auðkenning), óháð demo-lotu í vafranum:
  { path: "/api/cron/", methods: ["GET", "POST"], prefix: true },
  { path: "/api/straumur/", methods: ["POST"], prefix: true },
  { path: "/api/taktikal/", methods: ["POST"], prefix: true },
  { path: "/api/v1/", methods: ["POST"], prefix: true },
];

export function demoApiAllowed(pathname: string, method: string): boolean {
  const m = method.toUpperCase();
  if (m === "GET" || m === "HEAD" || m === "OPTIONS") return true;
  return DEMO_API_ALLOW.some((a) => a.methods.includes(m) && (a.prefix ? pathname === a.path.replace(/\/$/, "") || pathname.startsWith(a.path.endsWith("/") ? a.path : a.path + "/") : pathname === a.path));
}
