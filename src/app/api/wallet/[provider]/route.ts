import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appleConfigured, googleConfigured, buildApplePass, buildGoogleSaveUrl, type PassEmployee } from "@/lib/wallet";

// GET /api/wallet/apple  or  /api/wallet/google — the signed staff ID pass for the
// currently signed-in employee. Returns 501 with a hint until certs are configured.
export async function GET(req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Ekki tengt" }, { status: 400 });

  // Vefur: innskráningarkaka. App: Supabase-aðgangslykill í Authorization-haus (fær þá JSON með slóðinni).
  const bearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || null;
  let supabase: Awaited<ReturnType<typeof createClient>> | ReturnType<typeof createAdminClient>;
  let user: { id: string } | null = null;
  if (bearer) {
    const admin = createAdminClient();
    user = (await admin.auth.getUser(bearer)).data.user;
    supabase = admin;
  } else {
    supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }
  if (!user) return NextResponse.json({ error: "Ekki innskráð(ur)" }, { status: 401 });

  // Employee linked to this user (+ company name).
  const { data: emp } = await supabase
    .from("employees")
    .select("id, full_name, position, department:departments(name), photo_url, clock_token, companies(name), positions(name)")
    .eq("user_id", user.id).maybeSingle();
  if (!emp) return NextResponse.json({ error: "Starfsmannaprófíll fannst ekki" }, { status: 404 });

  const dept = (Array.isArray(emp.department) ? emp.department[0] : emp.department) as { name?: string } | null;
  const pos = (Array.isArray(emp.positions) ? emp.positions[0] : emp.positions) as { name?: string } | null;
  const comp = (Array.isArray(emp.companies) ? emp.companies[0] : emp.companies) as { name?: string } | null;
  const passEmp: PassEmployee = {
    id: emp.id as string,
    name: (emp.full_name as string) ?? "Starfsmaður",
    role: pos?.name ?? "Starfsmaður",
    department: dept?.name ?? "",
    company: comp?.name ?? "VAKTO",
    token: (emp.clock_token as string) ?? (emp.id as string),
    photoUrl: (emp.photo_url as string) ?? null,
  };

  try {
    if (provider === "apple") {
      if (!appleConfigured()) return NextResponse.json({ error: "Apple Wallet er ekki uppsett enn.", needs: "apple" }, { status: 501 });
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
