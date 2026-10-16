import "server-only";
// Kerfisyfirlit fyrir /admin/kerfid — hvað VAKTO er byggt á og hvort hver þjónusta er tengd
// í ÞESSU umhverfi. Les aðeins hvort env-breytur eru til (aldrei gildin sjálf) og nokkrar
// talningar úr gagnagrunninum. Caller MUST have passed isVaktoAdmin().
import { createAdminClient } from "@/lib/supabase/admin";
import vercelConfig from "../../vercel.json";

const has = (...keys: string[]) => keys.every((k) => !!process.env[k]);

export type Service = {
  name: string; role: string; what: string;
  state: "on" | "off" | "na";      // na = þarf enga stillingu
  note?: string; link?: { href: string; label: string };
};
export type SystemStatus = {
  env: { name: string; isProd: boolean; commit: string | null; branch: string | null; message: string | null; region: string | null; url: string | null };
  supabase: { ref: string | null; label: string; reachable: boolean; latencyMs: number | null; counts: { label: string; n: number | null }[] };
  crons: { path: string; schedule: string; what: string }[];
  groups: { title: string; sub: string; services: Service[] }[];
};

const PROD_REF = "lsnthbnqcelfgeyuxgfn";
const STAGING_REF = "aptpckmrqepvcqhgkjoo";
const CRON_WHAT: Record<string, string> = {
  "/api/cron/punch-check": "Finnur opnar stimplanir sem gleymdist að loka og lætur vita",
  "/api/cron/billing": "Áminningar fyrir lok prufu, mánaðarreikningar og greiðslur af kortum",
  "/api/cron/integrations": "Sækir veltu og gögn úr tengdum kerfum (Inventra o.fl.)",
};

export async function getSystemStatus(): Promise<SystemStatus> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const ref = url.match(/^https:\/\/([a-z0-9]+)\.supabase\.co/)?.[1] ?? null;
  const vEnv = process.env.VERCEL_ENV ?? null;

  const tables: [string, string][] = [
    ["companies", "Fyrirtæki"], ["users", "Notendur"], ["employees", "Starfsmenn"], ["shifts", "Vaktir"],
    ["punches", "Stimplanir"], ["messages", "Skilaboð í spjalli"], ["contracts", "Samningar"], ["invoices", "Reikningar"],
  ];
  let reachable = false;
  let latencyMs: number | null = null;
  let counts: { label: string; n: number | null }[] = tables.map(([, label]) => ({ label, n: null }));
  try {
    const db = createAdminClient();
    const t0 = Date.now();
    const res = await Promise.all(tables.map(([t]) => db.from(t).select("*", { count: "exact", head: true })));
    latencyMs = Date.now() - t0;
    reachable = res.some((r) => !r.error);
    counts = tables.map(([, label], i) => ({ label, n: res[i].error ? null : res[i].count ?? 0 }));
  } catch { /* óaðgengilegt → reachable=false */ }

  const sb = (path: string) => (ref ? `https://supabase.com/dashboard/project/${ref}${path}` : "https://supabase.com/dashboard");
  return {
    env: {
      name: vEnv === "production" ? "Production" : vEnv === "preview" ? "Preview" : "Staðbundið",
      isProd: vEnv === "production",
      commit: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
      branch: process.env.VERCEL_GIT_COMMIT_REF ?? null,
      message: process.env.VERCEL_GIT_COMMIT_MESSAGE?.split("\n")[0].slice(0, 140) ?? null,
      region: process.env.VERCEL_REGION ?? (vercelConfig.regions?.[0] ?? null),
      url: process.env.VERCEL_URL ?? null,
    },
    supabase: {
      ref, reachable, latencyMs, counts,
      label: ref === PROD_REF ? "VAKTO (prod)" : ref === STAGING_REF ? "VAKTO Staging" : ref ? "Óþekkt verkefni" : "Ekki tengt",
    },
    crons: (vercelConfig.crons ?? []).map((c) => ({ path: c.path, schedule: c.schedule, what: CRON_WHAT[c.path] ?? "" })),
    groups: [
      {
        title: "Grunnurinn", sub: "Það sem allt hitt stendur á",
        services: [
          { name: "Vercel", role: "Hýsing og keyrsla", state: "na", what: "Keyrir vefinn (Next.js), API-endapunkta og cron-verk. Hver grein fær eigin preview-slóð; main er vakto.is og admin.vakto.is. Föllin keyra í Dublin, við hlið gagnagrunnsins.", link: { href: "https://vercel.com/dashboard", label: "Opna Vercel" } },
          { name: "Supabase", role: "Gagnagrunnur, innskráning, skrár", state: has("NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY") ? "on" : "off", what: "Postgres með RLS svo hvert fyrirtæki sér aðeins sín gögn, Auth fyrir innskráningu, Storage fyrir skjöl og myndir, Realtime fyrir spjallið. Tvö verkefni: staging (preview og þróun) og prod.", link: { href: sb(""), label: "Opna Supabase" } },
          { name: "GitHub", role: "Kóðinn", state: "na", what: "Öll vinna fer á grein → preview á Vercel → samþykki → main. Aldrei beint á main." },
        ],
      },
      {
        title: "Greiðslur og samningar", sub: "Það sem snertir peninga og undirskriftir",
        services: [
          { name: "Straumur", role: "Kortagreiðslur áskrifta", state: has("STRAUMUR_API_KEY", "STRAUMUR_BASE_URL") ? "on" : "off", what: "Kort er skráð á greiðslusíðu Straums við nýskráningu; aðeins tegund og síðustu fjórir stafir eru geymdir hjá okkur. Daglegt cron-verk rukkar mánaðarlega.", note: has("STRAUMUR_TERMINAL_PAGE") ? undefined : "Greiðslusíðu-útstöð (STRAUMUR_TERMINAL_PAGE) vantar — kort er ekki skylda fyrr en hún er komin." },
          { name: "Taktikal", role: "Fullgild rafræn undirskrift", state: process.env.TAKTIKAL_ENABLED === "1" && has("TAKTIKAL_API_KEY", "TAKTIKAL_COMPANY_KEY") ? "on" : "off", what: "Ráðningarsamningar undirritaðir með rafrænum skilríkjum. Fyrirtæki velja þetta í stillingum; annars er innbyggða undirritunin (kóði í tölvupósti) notuð." },
          { name: "Payday", role: "Launakerfi viðskiptavina", state: "na", what: "Fyrirtæki tengja eigin Payday-aðgang í Stillingum og senda tímaskrá beint í launakeyrslu. Lyklar þeirra eru dulkóðaðir." },
        ],
      },
      {
        title: "Samskipti", sub: "Póstur, tilkynningar og gervigreind",
        services: [
          { name: "Resend", role: "Tölvupóstur", state: has("RESEND_API_KEY") ? "on" : "off", what: "Allur póstur frá VAKTO: staðfestingarkóðar, boð, lykilorð, kvittanir, áminningar og undirritaðir samningar." },
          { name: "Anthropic (Claude)", role: "VAKTO AI", state: has("ANTHROPIC_API_KEY") ? "on" : "off", what: "Vaktaplan með AI, lestur kjarasamninga, sérákvæði í samninga og spjallgaurinn á vakto.is. AI leggur aðeins til — stjórnandi samþykkir alltaf." },
          { name: "Expo Push og vefpush", role: "Tilkynningar", state: has("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY") ? "on" : "off", what: "Tilkynningar í símaappið (Expo → Apple og Google) og í vafra (VAPID): ný skilaboð, nýtt plan, svör við beiðnum.", note: has("EXPO_ACCESS_TOKEN") ? undefined : "EXPO_ACCESS_TOKEN er ekki sett (valfrjálst — hækkar kvóta)." },
          { name: "Cloudflare Turnstile", role: "Vörn gegn bottum", state: has("NEXT_PUBLIC_TURNSTILE_SITE_KEY", "TURNSTILE_SECRET_KEY") ? "on" : "off", what: "Ósýnileg athugun á nýskráningu sem stoppar ruslskráningar." },
        ],
      },
      {
        title: "Appið og annað", sub: "Símaappið, skírteini, kort og mælingar",
        services: [
          { name: "Expo / EAS", role: "Símaappið (iOS og Android)", state: "na", what: "Starfsmannaappið er Expo-verkefni í mobile/. EAS byggir og sendir í App Store og Google Play; minni breytingar fara út sem OTA-uppfærslur án nýrrar búðarútgáfu.", link: { href: "https://expo.dev", label: "Opna Expo" } },
          { name: "Apple Wallet", role: "Starfsmannaskírteini", state: has("APPLE_PASS_TYPE_ID", "APPLE_TEAM_ID") && (has("APPLE_PASS_CERT_B64") || has("APPLE_PASS_CERT")) ? "on" : "off", what: "Starfsmannaskírteini í Wallet á iPhone." },
          { name: "Google Wallet", role: "Starfsmannaskírteini", state: has("GOOGLE_WALLET_ISSUER_ID", "GOOGLE_WALLET_SA_EMAIL", "GOOGLE_WALLET_SA_KEY") ? "on" : "off", what: "Starfsmannaskírteini í Google Wallet á Android." },
          { name: "Kort (MapLibre, OpenFreeMap, Nominatim)", role: "Staðsetning við stimplun", state: "na", what: "Kortið í stillingum vinnustaðar og leit að heimilisfangi. Opnar þjónustur, engir lyklar." },
          { name: "Google Analytics", role: "Umferð á vakto.is", state: has("NEXT_PUBLIC_GA_ID") ? "on" : "off", what: "Mælir heimsóknir á markaðssíðuna — ekki inni í kerfinu sjálfu." },
          { name: "Meta Pixel", role: "Árangur auglýsinga", state: has("NEXT_PUBLIC_META_PIXEL_ID") ? "on" : "off", what: "PageView og nýskráningar (CompleteRegistration) á opna vefnum, aðeins með samþykki gests." },
          { name: "Meta auglýsingar", role: "Auglýsingayfirlit í admin", state: has("META_ACCESS_TOKEN", "META_AD_ACCOUNT_ID") ? "on" : "off", what: "Les lykiltölur herferða fyrir síðuna Auglýsingar. Eingöngu lestur." },
        ],
      },
    ],
  };
}
