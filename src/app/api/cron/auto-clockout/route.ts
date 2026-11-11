import { NextRequest, NextResponse } from "next/server";
import { runAutoClockout } from "@/lib/auto-punch.server";

// Sjálfvirk útstimplun eftir X klst. (0112) — Vercel cron á 15 mín. fresti. Lokar opnum stimplunum á
// clock_in + X og sendir áminningar X−4 og X−2 klst. Gerir ekkert hjá fyrirtækjum sem hafa slökkt.
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const r = await runAutoClockout();
  return NextResponse.json({ ok: true, ...r });
}
