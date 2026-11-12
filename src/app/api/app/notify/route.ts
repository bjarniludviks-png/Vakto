import { NextResponse, after } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { notifyEmployee, notifyManagers } from "@/lib/push";
import { sendLeaveDecisionEmail } from "@/lib/email";
import { checkNoShows } from "@/lib/noshow.server";
import { pushChatMessage } from "@/lib/chat-push.server";
import { pushCommentMentions } from "@/lib/feed-push.server";

// Push/email for actions the mobile app performs directly against Supabase.
// The app has no server actions, so it calls this after a successful write.
// Auth: the caller's Supabase access token (Bearer). We verify the caller is a
// party to the row before notifying anyone — this endpoint never writes data.

type Kind = "leave_request" | "leave_decided" | "swap_request" | "shift_claim" | "punch" | "content_report" | "work_overview" | "chat_message" | "comment_mention" | "incident" | "handover" | "task_added";

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
    const cols = kind === "leave_request" ? "company_id, employee_id, status, type, from_date" : "company_id, requester_id, status, requester_shift_id, requestee_id";
    const { data: row } = await admin.from(table).select(cols).eq("id", id).maybeSingle();
    const r = row as Record<string, string> | null;
    if (!r || !me || r[owner] !== me.id || r.status !== "pending") return NextResponse.json({ ok: false }, { status: 403 });
    // Skýr skilaboð: hver, hvað og hvaða dag — veikindi af vakt eru brýn.
    const { data: emp } = await admin.from("employees").select("full_name").eq("id", r[owner]).maybeSingle();
    const first = String(emp?.full_name ?? "Starfsmaður").split(" ")[0];
    const dm = (iso?: string) => { if (!iso) return ""; const d = new Date(`${iso}T12:00:00`); return `${["sun", "mán", "þri", "mið", "fim", "fös", "lau"][d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };
    let payload: { title: string; body: string; url: string; tag: string };
    if (kind === "leave_request" && (r.type === "veikindi" || r.type === "veikindi_barns")) {
      payload = { title: r.type === "veikindi" ? "Tilkynnti veikindi" : "Veikt barn", body: `${first} getur ekki mætt ${dm(r.from_date)}. Samþykktu og vaktin verður laus vakt.`, url: "/vaktaplan", tag: "requests" };
    } else if (kind === "leave_request") {
      payload = { title: "Ný frí-beiðni", body: `${first} sótti um frí — samþykktu eða hafnaðu.`, url: "/vaktaplan", tag: "requests" };
    } else {
      let when = "";
      if (r.requester_shift_id) { const { data: sh } = await admin.from("shifts").select("date").eq("id", r.requester_shift_id).maybeSingle(); when = sh?.date ? ` ${dm(sh.date as string)}` : ""; }
      payload = r.requester_shift_id && !r.requestee_id
        ? { title: "Vill losna við vakt", body: `${first} getur ekki tekið vaktina${when}. Samþykktu og hún verður laus vakt.`, url: "/vaktaplan", tag: "requests" }
        : { title: "Beiðni um vaktaskipti", body: `${first} óskaði eftir vaktaskiptum${when}.`, url: "/vaktaplan", tag: "requests" };
    }
    after(() => notifyManagers(r.company_id, payload));
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

  // Skilaboð send úr appinu (fara beint í Supabase) → push til hinna í rásinni. Aðeins sendandinn
  // sjálfur, og aðeins nýleg skilaboð, svo ekki sé hægt að endursenda push fyrir gömul skilaboð.
  if (kind === "chat_message") {
    const { data: msg } = await admin.from("messages").select("sender_id, created_at").eq("id", id).maybeSingle();
    if (!msg || msg.sender_id !== uid || Date.now() - new Date(msg.created_at as string).getTime() > 5 * 60_000) return NextResponse.json({ ok: false }, { status: 403 });
    after(() => pushChatMessage(id));
    return NextResponse.json({ ok: true });
  }

  if (kind === "comment_mention") {
    const { data: cm } = await admin.from("post_comments").select("sender_id, created_at").eq("id", id).maybeSingle();
    if (!cm || cm.sender_id !== uid || Date.now() - new Date(cm.created_at as string).getTime() > 5 * 60_000) return NextResponse.json({ ok: false }, { status: 403 });
    after(() => pushCommentMentions(id));
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

  // Verkefni og ábyrgð (0111): frávik, færð ábyrgð og stakt verkefni úr appinu.
  if (kind === "incident") {
    const { data: i } = await admin.from("incidents").select("company_id, employee_id, title, note").eq("id", id).maybeSingle();
    if (!i || !me || i.employee_id !== me.id) return NextResponse.json({ ok: false }, { status: 403 });
    const { data: emp } = await admin.from("employees").select("full_name").eq("id", me.id).maybeSingle();
    const first = String(emp?.full_name ?? "Starfsmaður").split(" ")[0];
    after(() => notifyManagers(i.company_id as string, { title: `Frávik: ${i.title}`, body: `${first} skráði frávik${i.note ? ` — ${String(i.note).slice(0, 80)}` : ""}`, url: "/verkefni?tab=fravik", appUrl: "/verkefni?fravik=1", tag: "incident" }));
    return NextResponse.json({ ok: true });
  }
  if (kind === "handover") {
    const { data: h } = await admin.from("role_handovers").select("company_id, from_employee_id, to_employee_id, role_id, start_date, end_date, note, created_by").eq("id", id).maybeSingle();
    if (!h || h.created_by !== uid) return NextResponse.json({ ok: false }, { status: 403 });
    const { data: ppl } = await admin.from("employees").select("id, full_name").in("id", [h.from_employee_id, h.to_employee_id]);
    const nm = (x: string) => String((ppl ?? []).find((p) => p.id === x)?.full_name ?? "").split(" ")[0];
    let what = "allar ábyrgðir";
    if (h.role_id) { const { data: r } = await admin.from("work_roles").select("name").eq("id", h.role_id).maybeSingle(); what = String(r?.name ?? "hlutverk"); }
    const until = h.end_date ? (h.end_date === h.start_date ? "í dag" : `til ${String(h.end_date).slice(8, 10)}.${String(h.end_date).slice(5, 7)}.`) : "þar til skilað";
    after(async () => {
      await notifyEmployee(h.to_employee_id as string, { title: `${nm(h.from_employee_id as string)} færði ábyrgð til þín`, body: `${what} · ${until}${h.note ? ` — „${h.note}“` : ""}`, url: "/mitt-svaedi#verkefni", appUrl: "/verkefni", tag: "handover" });
      const { data: u } = await admin.from("users").select("role").eq("id", uid).maybeSingle();
      if (u?.role !== "owner" && u?.role !== "manager") await notifyManagers(h.company_id as string, { title: "Ábyrgð færð", body: `${nm(h.from_employee_id as string)} → ${nm(h.to_employee_id as string)}: ${what} · ${until}`, url: "/verkefni" });
    });
    return NextResponse.json({ ok: true });
  }
  if (kind === "task_added") {
    const { data: tk } = await admin.from("shift_tasks").select("company_id, employee_id, title, due_time, date, created_by").eq("id", id).maybeSingle();
    if (!tk || tk.created_by !== uid || !tk.employee_id) return NextResponse.json({ ok: false }, { status: 403 });
    after(() => notifyEmployee(tk.employee_id as string, { title: "Nýtt verkefni", body: `${tk.title}${tk.due_time ? ` · fyrir kl. ${String(tk.due_time).slice(0, 5)}` : ""}`, url: "/mitt-svaedi#verkefni", appUrl: "/verkefni", tag: "task" }));
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
