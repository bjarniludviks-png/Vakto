import { NextResponse } from "next/server";
import { verifyWebhook, type TaktikalWebhook } from "@/lib/taktikal.server";
import { handleTaktikalEvent } from "@/lib/esign.server";

// Webhook frá Taktikal (skráð á flæðið í Taktikal-stjórnborðinu: Stillingar → Flæði).
// Sannreynt með TAKTIKAL_WEBHOOK_KEY (HMAC-SHA256), CompanyKey og tímastimpli; hvert
// event aðeins unnið einu sinni. 200 = móttekið, 406 = hafnað (Taktikal reynir ekki aftur).
export const maxDuration = 60;

export async function POST(req: Request) {
  let p: TaktikalWebhook;
  try { p = (await req.json()) as TaktikalWebhook; } catch { return new NextResponse(null, { status: 406 }); }
  if (!verifyWebhook(p)) {
    console.warn("taktikal webhook: signature rejected", p?.Id);
    return new NextResponse(null, { status: 406 });
  }
  try {
    const known = await handleTaktikalEvent(p);
    if (!known) console.warn("taktikal webhook: unknown process", p.EventData?.ProcessKey);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("taktikal webhook", e);
    return new NextResponse(null, { status: 500 }); // Taktikal reynir aftur
  }
}
