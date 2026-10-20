import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee, notifyManagers } from "@/lib/push";
import { sendLeaveDecisionEmail } from "@/lib/email";
import { checkNoShows } from "@/lib/noshow.server";

// Push/email for actions the mobile app performs directly against Supabase.
// The app has no server actions, so it calls this after a successful write.
// Auth: the caller's Supabase access token (Bearer). We verify the caller is a
// party to the row before notifying anyone — this endpoint never writes data.

type Kind = "leave_request" | "leave_decided" | "swap_request" | "shift_claim" | "punch" | "content_report" | "work_overview";

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return NextResponse.json({ ok: false }, { status: 401 });
  let body: { kind?: Kind; id?: string };
  try { body = await req.json(); } catch { return NextResponse.json({ ok: false }, { status: 400 }); }
  const { kind } = body;
  const id = kind === "punch" ? "00000000-0000-0000-0000-000000000000" : body.id;
  if (!kind || !id || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: false }, { status: 400 });

  const admin = createAdminClient();
  const { data: auth } = await admin.auth.getUser(token);
  const uid = auth.user?.id;
  if (!uid) return NextResponse.json({ ok: false }, { status: 401 });
  const { data: me } = await admin.from("employees").select("id, company_id").eq("user_id", uid).maybeSingle();

  if (kind === "leave_request" || kind === "swap_request") {
    const table = kind === "leave_request" ? "leave_requests" : "shift_swaps";
    const owner = kind === "leave_request" ? "employee_id" : "requester_id";
    const { data: row } = await admin.from(table).select(`company_id, ${owner}, status`).eq("id", id).maybeSingle();
    const r = row as Record<string, string> | null;
    if (!r || !me || r[owner] !== me.id || r.status !== "pending") return NextResponse.json({ ok: false }, { status: 403 });
    after(() => notifyManagers(r.company_id, kind === "leave_request"
      ? { title: "Ný frí-beiðni", body: "Starfsmaður sótti um frí — samþykktu eða hafnaðu.", url: "/vaktaplan", tag: "requests" }
      : { title: "Beiðni um vaktaskipti", body: "Starfsmaður óskaði eftir vaktaskiptum.", url: "/vaktaplan", tag: "requests" }));
    return NextResponse.json({ ok: true });
  }

  // Umsókn um lausa vakt (shift_claims, 0082) → stjórnendur fá tilkynningu.
  if (kind === "shift_claim") {
    const { data: c } = await admin.from("shift_claims").select("company_id, employee_id, status").eq("id", id).maybeSingle();
    if (!c || !me || c.employee_id !== me.id || c.status !== "pending") return NextResponse.json({ ok: false }, { status: 403 });
    after(() => notifyManagers(c.company_id as string, { title: "Umsókn um lausa vakt", body: "Starfsmaður sótti um lausa vakt — úthlutaðu í Vaktaplani.", url: "/vaktaplan", tag: "open-shift" }));
    return NextResponse.json({ ok: true });
  }

  // Svar starfsmanns við vinnuyfirliti (0084, respond_work_overview) → stjórnendur fá tilkynningu.
  if (kind === "work_overview") {
    const { data: w } = await admin.from("work_overviews").select("company_id, employee_id, status").eq("id", id).maybeSingle();
    if (!w || !me || w.employee_id !== me.id || (w.status !== "employee_approved" && w.status !== "employee_flagged")) return NextResponse.json({ ok: false }, { status: 403 });
    const approved = w.status === "employee_approved";
    after(() => notifyManagers(w.company_id as string, approved
      ? { title: "Vinnuyfirlit staðfest af starfsmanni", body: "Starfsmaður staðfesti vinnuyfirlitið sitt — lokastaðfesting bíður þín.", url: "/timaskraning/vinnuyfirlit", tag: "work-overview" }
      : { title: "Athugasemd við vinnuyfirlit", body: "Starfsmaður gerði athugasemd við vinnuyfirlitið sitt.", url: "/timaskraning/vinnuyfirlit", tag: "work-overview" }));
    return NextResponse.json({ ok: true });
  }

  // Stimplun í appinu → athuga „mætti ekki“ fyrir fyrirtæki starfsmannsins (skrifar engin gögn notandans).
  if (kind === "punch") {
    if (!me) return NextResponse.json({ ok: false }, { status: 403 });
    after(() => checkNoShows(me.company_id as string));
    return NextResponse.json({ ok: true });
  }

  // Tilkynnt efni í spjalli/fréttaveitu → stjórnendur fá tilkynningu (efnið sjálft er ekki sent í push).
  if (kind === "content_report") {
    const { data: rep } = await admin.from("content_reports").select("company_id, reporter_id, status").eq("id", id).maybeSingle();
    if (!rep || rep.reporter_id !== uid || rep.status !== "open") return NextResponse.json({ ok: false }, { status: 403 });
    after(() => notifyManagers(rep.company_id as string, { title: "Efni tilkynnt", body: "Starfsmaður tilkynnti skilaboð eða færslu. Opnaðu Mælaborð í appinu til að skoða.", url: "/spjall", tag: "reports" }));
    return NextResponse.json({ ok: true });
  }

  if (kind === "leave_decided") {
    const { data: row } = await admin.from("leave_requests")
      .select("company_id, employee_id, status, employees(full_name, email)").eq("id", id).maybeSingle();
    if (!row || (row.status !== "approved" && row.status !== "rejected")) return NextResponse.json({ ok: false }, { status: 403 });
    const { data: u } = await admin.from("users").select("company_id, role").eq("id", uid).maybeSingle();
    const isMgr = u && u.company_id === row.company_id && (u.role === "owner" || u.role === "manager");
    if (!isMgr) return NextResponse.json({ ok: false }, { status: 403 });
    const approved = row.status === "approved";
    const emp = (Array.isArray(row.employees) ? row.employees[0] : row.employees) as { full_name?: string; email?: string } | null;
    after(async () => {
      await notifyEmployee(row.employee_id as string, {
        title: approved ? "Frí samþykkt" : "Frí hafnað",
        body: approved ? "Frí-beiðnin þín var samþykkt." : "Frí-beiðninni þinni var hafnað.",
        url: "/mitt-svaedi",
      });
      if (emp?.email) await sendLeaveDecisionEmail(emp.email, emp.full_name ?? "", approved);
    });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ ok: false }, { status: 400 });
}
