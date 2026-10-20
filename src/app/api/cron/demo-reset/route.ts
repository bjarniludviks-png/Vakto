import { NextResponse, type NextRequest } from "next/server";
import { resetDemoCompany } from "@/lib/demo-reset.server";

// Á hverri nóttu: opna demo-fyrirtækið (DEMO_COMPANY_ID) endurstillt. Sjá src/lib/demo-reset.server.ts.
// Keyrir á undan punch-check (03:00) og billing (05:00) svo þær sjái hreint demo.
export const runtime = "nodejs";
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  try {
    const result = await resetDemoCompany();
    return NextResponse.json(result, { status: result.ok ? 200 : 409 });
  } catch (e) {
    console.error("[demo-reset]", e);
    return NextResponse.json({ ok: false, error: "Endurstilling mistókst" }, { status: 500 });
  }
}
