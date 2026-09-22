import { NextResponse, type NextRequest } from "next/server";
import { runBillingDay } from "@/lib/billing.server";

// Daglega: prufu-áminningar, reikningar, gjaldtaka af korti, lokun. Sjá src/lib/billing.server.ts.
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const result = await runBillingDay();
  return NextResponse.json({ ok: true, ...result });
}
