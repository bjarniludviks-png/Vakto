import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoBlocked } from "@/lib/demo.server";
import { decideSuggestion, getAutoPunchState, handleGeoEvent, setConsent, type AutoPunchCtx } from "@/lib/auto-punch.server";

// Sjálfvirk stimplun (0112) — appið kallar hingað með Supabase-aðgangslykli starfsmannsins (Bearer).
//   GET                                   → hamur, samþykki, svæði (staðir á korti) og ósvaraðar tillögur
//   POST { action: "event", type, locationId, lat, lng, acc, at } → síminn kom á/fór af vinnustað (bakgrunnsverk)
//   POST { action: "consent", on }        → starfsmaður kveikir/slekkur sjálfur
//   POST { action: "decide", id, confirm, at? } → staðfesta/hafna tillögu (má aðeins stytta tímann)
// Reglurnar og skrifin eru í lib/auto-punch.server.ts (þjónustulykill), en notandinn og aðgangsstaða hans
// (starfslok, leið með appi) eru staðfest hér með HANS lykli.

const UUID = /^[0-9a-f-]{36}$/i;

async function context(): Promise<AutoPunchCtx | NextResponse> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  const { data: access } = await supabase.rpc("my_access_state");
  const a = (access ?? {}) as { state?: string; app?: boolean };
  if (a.state && a.state !== "active") return NextResponse.json({ ok: false, error: "Aðgangurinn er aðeins til skoðunar" }, { status: 403 });
  if (a.app === false) return NextResponse.json({ ok: false, error: "Appið er ekki í áskriftinni" }, { status: 403 });
  const admin = createAdminClient();
  const { data: emp } = await admin.from("employees").select("id, company_id, status").eq("user_id", user.id).limit(1).maybeSingle();
  if (!emp || emp.status === "inactive") return NextResponse.json({ ok: false, error: "Enginn starfsmannaprófíll" }, { status: 403 });
  return { employeeId: emp.id as string, companyId: emp.company_id as string, userId: user.id };
}

export async function GET() {
  const ctx = await context();
  if (ctx instanceof NextResponse) return ctx;
  try {
    return NextResponse.json({ ok: true, ...(await getAutoPunchState(ctx)) });
  } catch (e) {
    console.error("auto-punch GET", e);
    return NextResponse.json({ ok: false, error: "Tókst ekki" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const ctx = await context();
  if (ctx instanceof NextResponse) return ctx;
  if (await demoBlocked(ctx.companyId)) return NextResponse.json({ ok: false, error: "Opið demo er aðeins til skoðunar" }, { status: 403 });
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch { /* tómt */ }
  try {
    if (body.action === "event") {
      const type = body.type === "enter" || body.type === "exit" ? body.type : null;
      const locationId = String(body.locationId ?? "");
      if (!type || !UUID.test(locationId)) return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 });
      const num = (v: unknown) => (typeof v === "number" && Number.isFinite(v) ? v : undefined);
      const r = await handleGeoEvent(ctx, { type, locationId, lat: num(body.lat), lng: num(body.lng), acc: num(body.acc), at: typeof body.at === "string" ? body.at : undefined });
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (body.action === "consent") {
      const r = await setConsent(ctx, body.on === true);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    if (body.action === "decide") {
      const id = String(body.id ?? "");
      if (!UUID.test(id)) return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 });
      const r = await decideSuggestion(ctx, id, body.confirm === true, typeof body.at === "string" ? body.at : null);
      return NextResponse.json(r, { status: r.ok ? 200 : 400 });
    }
    return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 });
  } catch (e) {
    console.error("auto-punch POST", e);
    return NextResponse.json({ ok: false, error: "Tókst ekki" }, { status: 500 });
  }
}
