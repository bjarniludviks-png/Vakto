import { createHash } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

// Heimsóknatalning á opnu síðunum (0079). Vafrakökulaus: engin IP-tala geymd, aðeins daglegt
// fingrafar svo hægt sé að telja einstaka gesti dagsins. Lesið í morgunyfirlitinu.
export const runtime = "nodejs";

const BOT = /bot|crawl|spider|slurp|preview|facebookexternalhit|vercel|headless|lighthouse|monitor|curl|wget|python|node-fetch/i;
const clip = (v: unknown, n: number) => (typeof v === "string" && v.trim() ? v.trim().slice(0, n) : null);

export async function POST(req: NextRequest) {
  const ua = req.headers.get("user-agent") ?? "";
  if (!ua || BOT.test(ua)) return new NextResponse(null, { status: 204 });
  let body: Record<string, unknown> = {};
  try { body = JSON.parse(await req.text()); } catch { return new NextResponse(null, { status: 204 }); }
  const path = clip(body.path, 200);
  if (!path || !path.startsWith("/")) return new NextResponse(null, { status: 204 });
  let refHost: string | null = null;
  try { const r = clip(body.ref, 500); if (r) { const h = new URL(r).hostname.replace(/^www\./, ""); if (h && !h.endsWith("vakto.is")) refHost = h; } } catch { /* ógild slóð */ }
  const day = new Date().toISOString().slice(0, 10);
  const ip = (req.headers.get("x-forwarded-for") ?? "").split(",")[0].trim();
  const salt = process.env.CRON_SECRET ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? "vakto";
  const visitor = createHash("sha256").update(`${ip}|${ua}|${day}|${salt}`).digest("hex").slice(0, 20);
  try {
    await createAdminClient().from("site_visits").insert({
      day, path, referrer_host: refHost, visitor,
      utm_source: clip(body.utm_source, 60), utm_campaign: clip(body.utm_campaign, 80), utm_content: clip(body.utm_content, 80),
    });
  } catch (e) { console.error("[visit]", e instanceof Error ? e.message : e); }
  return new NextResponse(null, { status: 204 });
}
