import { NextRequest, NextResponse } from "next/server";
import { checkLongPunches } from "@/lib/punch-check.server";
import { checkBirthdays } from "@/lib/birthday.server";
import { sendDigests } from "@/lib/digest.server";

// Daily backstop for forgotten clock-outs (Vercel cron). Managers opening
// Tímaskráning trigger the same check opportunistically during the day.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const [reminded, birthdays, digests] = await Promise.all([checkLongPunches(), checkBirthdays(), sendDigests()]);
  return NextResponse.json({ ok: true, reminded, birthdays, digests });
}
