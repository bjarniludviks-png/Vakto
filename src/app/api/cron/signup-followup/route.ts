import { NextResponse, type NextRequest } from "next/server";
import { runSignupFollowups } from "@/lib/signup-followup.server";

// Virka daga kl. 10:00: persónulegur póstur daginn eftir nýskráningu. Sjá src/lib/signup-followup.server.ts.
export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({ ok: true, ...(await runSignupFollowups()) });
}
