import { NextRequest, NextResponse } from "next/server";
import { syncAllIntegrations } from "@/lib/integrations/sync.server";

// Daglega: sækir veltu úr tengdum kerfum (Shopify, WooCommerce …) og lærir vikudagamynstur veltu.
export const maxDuration = 300;
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await syncAllIntegrations()) });
}
