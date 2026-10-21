import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isDemoCompany } from "@/lib/demo.server";
import { PUBLIC_DEMO_NOTE } from "@/lib/demo-seed";
import { DEMO_READONLY_MSG } from "@/lib/demo-readonly";
import { sendEmail, template } from "@/lib/email";

// Eyðing aðgangs úr appinu (Apple App Store 5.1.1(v)). Auth: Supabase access token (Bearer).
// Aðganginum er lokað STRAX (Supabase Auth ban, sama og starfslok — terminations-cron.server.ts),
// starfsmaðurinn óvirkjaður, beiðnin skráð í audit_log og hjalp@ + eigendum fyrirtækisins sent bréf.
// Persónuupplýsingum er svo eytt handvirkt innan 30 daga; launa- og tímagögn eru geymd skv. lögum.
// Eigandi fyrirtækis getur ekki eytt sér hér (þá þyrfti að loka fyrirtækinu) — hann skrifar hjalp@.

const BAN = "876000h"; // ~100 ár — sama og /api/cron/starfslok
const HELP = "hjalp@vakto.is";
const OWNER_MSG = `Þú ert eigandi fyrirtækisins. Til að eyða fyrirtækinu og aðganginum skrifaðu okkur á ${HELP}`;
const APP_REVIEW_NOTE = "app-review-demo";

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(req: Request) {
  const token = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!token) return json({ ok: false, error: "Ekki innskráð(ur)" }, 401);
  const admin = createAdminClient();
  const { data: auth } = await admin.auth.getUser(token);
  const user = auth.user;
  if (!user) return json({ ok: false, error: "Ekki innskráð(ur)" }, 401);

  // Idempotent: þegar bannaður → ekkert meira gert (enginn annar póstur).
  const { data: full } = await admin.auth.admin.getUserById(user.id);
  const bannedUntil = (full.user as { banned_until?: string | null } | null)?.banned_until;
  if (bannedUntil && new Date(bannedUntil).getTime() > Date.now()) return json({ ok: true, already: true });

  const { data: u } = await admin.from("users").select("role, company_id, full_name, email").eq("id", user.id).maybeSingle();
  const { data: emp } = await admin.from("employees").select("id, company_id, full_name, email, status").eq("user_id", user.id).limit(1).maybeSingle();
  const companyId = (u?.company_id as string | null) ?? (emp?.company_id as string | null) ?? null;
  const { data: co } = companyId
    ? await admin.from("companies").select("id, name, admin_note").eq("id", companyId).maybeSingle()
    : { data: null };

  // Opið demo er aðeins til skoðunar — sameiginlegur notandi sem má ekki loka.
  if (isDemoCompany(companyId) || co?.admin_note === PUBLIC_DEMO_NOTE) {
    return json({ ok: false, error: DEMO_READONLY_MSG }, 403);
  }

  // Prufuaðgangar Apple App Review („Kaffi Krónan“, scripts/bootstrap-demo-company.mjs): yfirferðarmaðurinn
  // á að sjá allt flæðið (staðfesting → útskráning → skilaboð á innskráningarskjá) en aðgangarnir verða að
  // lifa af svo næsta yfirferð geti skráð sig inn. Því er HÉR ekkert bannað, óvirkjað, skráð né sent.
  if (co?.admin_note === APP_REVIEW_NOTE) return json({ ok: true });

  if (u?.role === "owner") return json({ ok: false, error: OWNER_MSG, owner: true }, 400);

  const { error: banErr } = await admin.auth.admin.updateUserById(user.id, { ban_duration: BAN });
  if (banErr) {
    console.error("[delete-request] ban", banErr.message);
    return json({ ok: false, error: `Tókst ekki að loka aðganginum. Reyndu aftur eða skrifaðu á ${HELP}` }, 500);
  }
  // Ógilda lotur (endurnýjunarlykla) strax; bannið stöðvar hvort eð er nýjar innskráningar.
  await admin.auth.admin.signOut(token, "global").then(() => {}, () => {});
  await admin.from("push_subscriptions").delete().eq("user_id", user.id).then(() => {}, () => {});
  if (emp?.id) {
    const { error } = await admin.from("employees").update({ status: "inactive" }).eq("user_id", user.id).neq("status", "inactive");
    if (error) console.error("[delete-request] deactivate", error.message);
  }

  const name = (emp?.full_name as string) || (u?.full_name as string) || "";
  const email = user.email || (u?.email as string) || (emp?.email as string) || "";
  const who = `${name || "Notandi"} (${email || "ekkert netfang"})`;
  if (companyId) {
    await admin.from("audit_log").insert({
      company_id: companyId, user_id: user.id, action: "account.delete_request", entity: "employee", entity_id: emp?.id ?? user.id,
      detail: `${who} bað um eyðingu aðgangs í appinu — aðgangi lokað, persónuupplýsingum eytt innan 30 daga`,
    }).then(() => {}, () => {});
  }

  // Póstur: hjalp@ + eigendur. Bilun í pósti stöðvar aldrei beiðnina.
  try {
    const owners = companyId
      ? ((await admin.from("users").select("email").eq("company_id", companyId).eq("role", "owner")).data ?? [])
          .map((o) => (o.email as string | null)?.trim()).filter((e): e is string => !!e)
      : [];
    const company = (co?.name as string) || "";
    const body = `<b>${esc(name || "Notandi")}</b> (${esc(email || "ekkert netfang")})${company ? ` hjá <b>${esc(company)}</b>` : ""} hefur beðið um að aðgangi sínum í VAKTO verði eytt. Aðganginum hefur verið lokað. VAKTO eyðir persónuupplýsingum innan 30 daga; launagögn eru geymd skv. lögum.`;
    const bodyEn = `<b>${esc(name || "A user")}</b> (${esc(email || "no email")}) has requested deletion of their VAKTO account. The account has been closed. VAKTO deletes personal data within 30 days; payroll records are retained as required by law.`;
    const html = template({
      preheader: `${name || "Notandi"} hefur beðið um eyðingu aðgangs.`,
      heading: "Beiðni um eyðingu aðgangs",
      body, headingEn: "Account deletion request", bodyEn,
    });
    const subject = `Beiðni um eyðingu aðgangs: ${name || email} / Account deletion request`;
    const to = Array.from(new Set([HELP, ...owners.map((e) => e.toLowerCase())]));
    await Promise.all(to.map((addr) => sendEmail({ to: addr, subject, html, internal: true }).then((r) => {
      if (!r.ok) console.error("[delete-request] email", addr, r.error);
    }, (e) => console.error("[delete-request] email", addr, e))));
  } catch (e) {
    console.error("[delete-request] email", e);
  }

  return json({ ok: true });
}
