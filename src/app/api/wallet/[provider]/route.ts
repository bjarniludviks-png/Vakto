import { NextResponse } from "next/server";
import { createHmac, timingSafeEqual } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appleConfigured, googleConfigured, buildApplePass, buildGoogleSaveUrl, type PassEmployee } from "@/lib/wallet";

const linkSecret = () => process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || "";
const sigOf = (payload: string) => createHmac("sha256", linkSecret() + ":wallet-link").update(payload).digest("base64url");
function signLink(uid: string): string {
  const payload = `${uid}.${Math.floor(Date.now() / 1000) + 120}`;
  return `${payload}.${sigOf(payload)}`;
}
function verifyLink(t: string): string | null {
  const [uid, exp, sig] = t.split(".");
  if (!uid || !exp || !sig || !linkSecret() || Number(exp) < Date.now() / 1000) return null;
  const want = Buffer.from(sigOf(`${uid}.${exp}`)), got = Buffer.from(sig);
  return want.length === got.length && timingSafeEqual(want, got) ? uid : null;
}

// GET /api/wallet/apple  or  /api/wallet/google — the signed staff ID pass for the
// currently signed-in employee. Returns 501 with a hint until certs are configured.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Ekki tengt" }, { status: 400 });

  // Vefur: innskráningarkaka. App: Supabase-aðgangslykill í Authorization-haus (fær þá JSON með slóð).
  // Apple-passinn þarf að opnast í Safari, svo appið fær skammlífa (2 mín) undirritaða slóð með ?t=.
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  const linkToken = new URL(req.url).searchParams.get("t");
  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
  let user: { id: string } | null = null;
  if (linkToken) {
    const uid = verifyLink(linkToken);
    if (!uid) return NextResponse.json({ error: "Slóðin er útrunnin — opnaðu skírteinið aftur í appinu." }, { status: 401 });
    user = { id: uid };
    supabase = createAdminClient();
  } else if (bearer) {
    const admin = createAdminClient();
    user = (await admin.auth.getUser(bearer)).data.user;
    supabase = admin;
  } else {
    supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }
  if (!user) return NextResponse.json({ error: "Ekki innskráð(ur)" }, { status: 401 });

  // Employee linked to this user (+ company name).
  const { data: emp, error: empErr } = await supabase
    .from("employees")
    .select("id, full_name, title, kennitala, department:departments(name), photo_url, clock_token, companies(name, kennitala), positions(name)")
    .eq("user_id", user.id).maybeSingle();
  if (empErr) console.error("[wallet] employee", empErr.message);
  if (!emp) return NextResponse.json({ error: "Starfsmannaprófíll fannst ekki" }, { status: 404 });

  const dept = (Array.isArray(emp.department) ? emp.department[0] : emp.department) as { name?: string } | null;
  const pos = (Array.isArray(emp.positions) ? emp.positions[0] : emp.positions) as { name?: string } | null;
  const comp = (Array.isArray(emp.companies) ? emp.companies[0] : emp.companies) as { name?: string; kennitala?: string | null } | null;
  const passEmp: PassEmployee = {
    id: emp.id as string,
    name: (emp.full_name as string) ?? "Starfsmaður",
    role: (emp.title as string | null) || pos?.name || "Starfsmaður",
    department: dept?.name ?? "",
    company: comp?.name ?? "VAKTO",
    token: (emp.clock_token as string) ?? (emp.id as string),
    photoUrl: (emp.photo_url as string) ?? null,
    kennitala: (emp.kennitala as string | null) ?? null,
    companyKt: comp?.kennitala ?? null,
  };

  try {
    if (provider === "apple") {
      if (!appleConfigured()) return NextResponse.json({ error: "Apple Wallet er ekki uppsett enn.", needs: "apple" }, { status: 501 });
      if (bearer) return NextResponse.json({ url: `${new URL(req.url).origin}/api/wallet/apple?t=${signLink(user.id)}` });
      const buf = await buildApplePass(passEmp);
      return new NextResponse(new Uint8Array(buf), {
        headers: {
          "Content-Type": "application/vnd.apple.pkpass",
          "Content-Disposition": `attachment; filename="vakto-${passEmp.id}.pkpass"`,
        },
      });
    }
    if (provider === "google") {
      if (!googleConfigured()) return NextResponse.json({ error: "Google Wallet er ekki uppsett enn.", needs: "google" }, { status: 501 });
      const url = await buildGoogleSaveUrl(passEmp);
      return bearer ? NextResponse.json({ url }) : NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Óþekkt veski" }, { status: 400 });
  } catch (e) {
    console.error("[wallet]", e);
    return NextResponse.json({ error: "Tókst ekki að búa til skírteinið — reyndu aftur." }, { status: 500 });
  }
}
