import { NextResponse, type NextRequest } from "next/server";
import { runAlerts } from "@/lib/alerts.server";

// Daglega kl. 08:00: vaktarar og sjálfvirkar skýrslur (alert_rules, 0086). Sjá src/lib/alerts.server.ts.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runAlerts());
}
