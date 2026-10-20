import { NextResponse, type NextRequest } from "next/server";
import { runMonthlyReports } from "@/lib/monthly-report.server";

// 1.–3. hvers mánaðar kl. 07:00 (UTC = Ísland): mánaðarskýrsla fyrri mánaðar til eigenda.
// Keyrt þrjá daga í röð sem varnagli; „sent“-merkið (0085) kemur í veg fyrir tvísendingu.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  if (new Date().getUTCDate() > 3) return NextResponse.json({ ok: true, skipped: "only runs on the 1st–3rd" });
  return NextResponse.json(await runMonthlyReports());
}
