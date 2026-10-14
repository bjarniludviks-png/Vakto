import { NextResponse, type NextRequest } from "next/server";
import { runDailyDigest } from "@/lib/daily-digest.server";

// Daglega kl. 08:00: yfirlit gærdagsins á OWNER_ALERT_EMAIL. Sjá src/lib/daily-digest.server.ts.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runDailyDigest()) });
}
