import { NextRequest, NextResponse } from "next/server";
import { syncOpenTaktikalContracts } from "@/lib/esign.server";

// Daglegt öryggisnet fyrir Taktikal: ef webhook misfórst (t.d. rangur lykill → 406, Taktikal
// reynir ekki aftur) er staða opinna undirritunarferla sótt beint frá Taktikal og sama stöðuvél
// keyrð (undirskriftir skráðar, starfsmanni boðið, undirritað PDF vistað). Idempotent.
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization");
  const isVercelCron = !!req.headers.get("x-vercel-cron") || (req.headers.get("user-agent") ?? "").includes("vercel-cron");
  if (secret ? auth !== `Bearer ${secret}` : !isVercelCron) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }
  const r = await syncOpenTaktikalContracts();
  return NextResponse.json({ ok: true, ...r });
}
