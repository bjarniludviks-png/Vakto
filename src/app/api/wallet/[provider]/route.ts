import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { appleConfigured, googleConfigured, buildApplePass, buildGoogleSaveUrl, type PassEmployee } from "@/lib/wallet";

// GET /api/wallet/apple  or  /api/wallet/google — the signed staff ID pass for the
// currently signed-in employee. Returns 501 with a hint until certs are configured.
export async function GET(_req: Request, { params }: { params: Promise<{ provider: string }> }) {
  const { provider } = await params;
  if (!isSupabaseConfigured()) return NextResponse.json({ error: "Ekki tengt" }, { status: 400 });

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
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
      return NextResponse.redirect(url);
    }
    return NextResponse.json({ error: "Óþekkt veski" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Villa" }, { status: 500 });
  }
}
