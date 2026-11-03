import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateLeaveRequest, approveShiftSwap, rejectShiftSwap } from "@/app/(app)/vaktaplan/actions";

// Appið (Mælaborð → „Samþykkja“/„Hafna“): sama ákvörðun og í Vaktaplani á vefnum — með öllum afleiðingum
// (vakt losnar við samþykkt vaktaskipti/veikindi, starfsfólk fær push o.s.frv.). Áður breytti appið aðeins
// stöðunni og ekkert annað gerðist. createClient les Bearer-lykil appsins, svo RLS og hlutverk gilda eins og á vef.
export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false, error: "Ekki innskráð(ur)" }, { status: 401 });
  const { data: me } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle();
  if (me?.role !== "owner" && me?.role !== "manager") return NextResponse.json({ ok: false, error: "Aðeins stjórnendur geta afgreitt beiðnir" }, { status: 403 });
  let body: { kind?: string; id?: string; approve?: boolean } = {};
  try { body = await request.json(); } catch { /* tómt */ }
  const id = String(body.id ?? "");
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false, error: "Ógild beiðni" }, { status: 400 });
  const approve = body.approve === true;
  const res = body.kind === "leave"
    ? await updateLeaveRequest(id, approve)
    : approve ? await approveShiftSwap(id) : await rejectShiftSwap(id);
  return NextResponse.json({ ok: res.ok, error: res.ok ? undefined : (res.error ?? "Tókst ekki") });
}
