import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee, notifyManagers } from "@/lib/push";
import { sendLeaveDecisionEmail } from "@/lib/email";
import { checkNoShows } from "@/lib/noshow.server";

// Push/email for actions the mobile app performs directly against Supabase.
// The app has no server actions, so it calls this after a successful write.
// Auth: the caller's Supabase access token (Bearer). We verify the caller is a
// party to the row before notifying anyone — this endpoint never writes data.

type Kind = "leave_request" | "leave_decided" | "swap_request" | "punch";

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

  // Stimplun í appinu → athuga „mætti ekki“ fyrir fyrirtæki starfsmannsins (skrifar engin gögn notandans).
  if (kind === "punch") {
    if (!me) return NextResponse.json({ ok: false }, { status: 403 });
    after(() => checkNoShows(me.company_id as string));
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
