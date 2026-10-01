import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { googleConfigured, buildGoogleSaveUrl, walletEmployee } from "@/lib/wallet";

// Starfsmannaskírteini í Google Wallet úr appinu. Appið er ekki innskráð í vafranum, svo það
// sendir Supabase-aðgangslykil sinn (Bearer) og fær „Save to Google Wallet“-hlekkinn til baka.
// Apple Wallet (.pkpass) bíður vottorða frá Apple.
export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  let body: { provider?: string };
  try { body = await req.json(); } catch { body = {}; }
  const { data: auth } = await createAdminClient().auth.getUser(token);
  if (!auth.user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });

  if (body.provider !== "google") return NextResponse.json({ ok: false, error: "Apple Wallet kemur fljótlega." }, { status: 501 });
  if (!googleConfigured()) return NextResponse.json({ ok: false, error: "Google Wallet er ekki uppsett enn." }, { status: 501 });
  const emp = await walletEmployee(auth.user.id);
  if (!emp) return NextResponse.json({ ok: false, error: "Starfsmannaprófíll fannst ekki" }, { status: 404 });
  try {
    return NextResponse.json({ ok: true, url: await buildGoogleSaveUrl(emp) });
  } catch (e) {
    console.error("google wallet", e);
    return NextResponse.json({ ok: false, error: "Tókst ekki að búa til skírteinið" }, { status: 500 });
  }
}
