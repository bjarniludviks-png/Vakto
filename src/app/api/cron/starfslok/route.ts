import { NextResponse, type NextRequest } from "next/server";
import { runTerminationCron } from "@/lib/terminations-cron.server";

// Daglega kl. 00:30: starfslok taka gildi (óvirkjun, hlutverk) og lesaðgangi er lokað (0088).
export const runtime = "nodejs";
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json(await runTerminationCron());
}
