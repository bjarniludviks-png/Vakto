import { createServerClient } from "@supabase/ssr";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies, headers } from "next/headers";

const JWT = /^[\w-]+\.[\w-]+\.[\w-]+$/;

/** Tengd forrit (/api/mcp): keyrir aðgerðir sem notandi tengingarinnar. Lykillinn kemur úr okkar
 *  grunni (lib/mcp.server.ts), aldrei frá kallaranum, og gengur fyrir hausum og kökum. */
export const actAs = new AsyncLocalStorage<string>();

/** Supabase client for use in Server Components, Route Handlers and Server Actions. */
export async function createClient() {
  const cookieStore = await cookies();

  // Appið (VAKTO AI o.fl. undir /api/app/) sendir Supabase-aðgangslykil starfsmannsins sem Bearer
  // í stað köku. Þá keyra sömu aðgerðir og á vefnum með þeim lykli: RLS og auth.getUser() sjá
  // notandann eins og hann væri innskráður í vafra. Kökulota gengur alltaf fyrir.
  const forced = actAs.getStore();
  const bearer = forced ?? (await headers()).get("authorization")?.match(/^Bearer\s+(\S+)$/i)?.[1];
  const cookieSession = !forced && cookieStore.getAll().some((c) => c.name.startsWith("sb-") && c.name.includes("-auth-token"));
  if (bearer && JWT.test(bearer) && !cookieSession) {
    const client = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: { getAll: () => [], setAll() {} },
        global: { headers: { Authorization: `Bearer ${bearer}` } },
      },
    );
    const getUser = client.auth.getUser.bind(client.auth);
    client.auth.getUser = (jwt?: string) => getUser(jwt ?? bearer);
    return client;
  }

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Called from a Server Component — safe to ignore when middleware
            // is refreshing the session.
          }
        },
      },
    },
  );
}
