import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { todayIs } from "@/lib/terminations.server";

// Daglega (/api/cron/starfslok): framkvæmir það sem stjórnandinn valdi í starfslokum (0088).
//   1. Eftir síðasta starfsdag: starfsmaður óvirkjaður (ef valið) og stjórnendahlutverk notandans
//      lækkað í „employee“ (lesaðgangurinn er þá aðeins að eigin skjölum — RLS 0088).
//   2. Eftir access_until: innskráning bönnuð (Supabase Auth ban) og push-áskriftum eytt.
// Eigandi fyrirtækis er aldrei snertur. Allt skráð í audit_log.

const BAN = "876000h"; // ~100 ár

export async function runTerminationCron(): Promise<{ ok: boolean; deactivated: number; demoted: number; closed: number; errors: string[] }> {
  const admin = createAdminClient();
  const today = todayIs();
  const errors: string[] = [];
  let deactivated = 0, demoted = 0, closed = 0;

  // ---- 1. síðasti dagur liðinn ----
  const { data: ended, error: e1 } = await admin.from("employment_terminations")
    .select("id, company_id, employee_id, deactivate, deactivated_at, prior_role, employees(full_name, user_id, status)")
    .is("revoked_at", null).lt("last_day", today).is("deactivated_at", null).limit(500);
  if (e1) return { ok: false, deactivated, demoted, closed, errors: [e1.message] };
  for (const t of ended ?? []) {
    const emp = (Array.isArray(t.employees) ? t.employees[0] : t.employees) as { full_name?: string; user_id?: string | null; status?: string } | null;
    const detail: string[] = [];
    if (t.deactivate && emp?.status !== "inactive") {
      const { error } = await admin.from("employees").update({ status: "inactive" }).eq("id", t.employee_id);
      if (error) { errors.push(`deactivate ${t.id}: ${error.message}`); continue; }
      deactivated++; detail.push("óvirkjaður");
    }
    let prior: string | null = null;
    if (emp?.user_id) {
      const { data: u } = await admin.from("users").select("role, company_id").eq("id", emp.user_id).maybeSingle();
      if (u && u.company_id === t.company_id && u.role === "manager") {
        const { error } = await admin.from("users").update({ role: "employee" }).eq("id", emp.user_id);
        if (error) errors.push(`demote ${t.id}: ${error.message}`);
        else { prior = "manager"; demoted++; detail.push("vaktstjórahlutverk fellt niður"); }
      }
    }
    await admin.from("employment_terminations").update({ deactivated_at: new Date().toISOString(), prior_role: prior }).eq("id", t.id);
    await admin.from("audit_log").insert({
      company_id: t.company_id, user_id: null, action: "employee.terminate.ended", entity: "employee", entity_id: t.employee_id,
      detail: `Starfslok tóku gildi — ${emp?.full_name ?? ""}${detail.length ? `: ${detail.join(", ")}` : ""}`,
    }).then(() => {}, () => {});
  }

  // ---- 2. lesaðgangur útrunninn ----
  const { data: expired, error: e2 } = await admin.from("employment_terminations")
    .select("id, company_id, employee_id, employees(full_name, user_id)")
    .is("revoked_at", null).lt("access_until", today).is("access_closed_at", null).limit(500);
  if (e2) errors.push(e2.message);
  for (const t of expired ?? []) {
    const emp = (Array.isArray(t.employees) ? t.employees[0] : t.employees) as { full_name?: string; user_id?: string | null } | null;
    if (emp?.user_id) {
      const { data: u } = await admin.from("users").select("role").eq("id", emp.user_id).maybeSingle();
      if (u?.role === "owner") { await admin.from("employment_terminations").update({ access_closed_at: new Date().toISOString() }).eq("id", t.id); continue; }
      const { error } = await admin.auth.admin.updateUserById(emp.user_id, { ban_duration: BAN });
      if (error) { errors.push(`ban ${t.id}: ${error.message}`); continue; }
      await admin.from("push_subscriptions").delete().eq("user_id", emp.user_id).then(() => {}, () => {});
    }
    await admin.from("employment_terminations").update({ access_closed_at: new Date().toISOString() }).eq("id", t.id);
    closed++;
    await admin.from("audit_log").insert({
      company_id: t.company_id, user_id: null, action: "employee.access.closed", entity: "employee", entity_id: t.employee_id,
      detail: `Aðgangi að VAKTO lokað eftir starfslok — ${emp?.full_name ?? ""}`,
    }).then(() => {}, () => {});
  }
  return { ok: errors.length === 0, deactivated, demoted, closed, errors };
}

/** Starfsmaður sem var hættur er virkjaður aftur (endurráðinn): starfslokin falla úr gildi og
 *  innskráning opnast aftur. Kallað úr setEmployeeStatus eftir að RLS hefur staðfest aðganginn. */
export async function reopenAfterRehire(companyId: string, employeeId: string, byUserId: string | null): Promise<void> {
  const admin = createAdminClient();
  if (!byUserId) return;
  const { data: me } = await admin.from("users").select("role, company_id").eq("id", byUserId).maybeSingle();
  if (!me || me.company_id !== companyId || (me.role !== "owner" && me.role !== "manager")) return;
  const { data: t } = await admin.from("employment_terminations")
    .select("id, access_closed_at, prior_role, employees(user_id)").eq("company_id", companyId).eq("employee_id", employeeId).is("revoked_at", null).maybeSingle();
  if (!t) return;
  await admin.from("employment_terminations").update({ revoked_at: new Date().toISOString(), revoked_by: byUserId }).eq("id", t.id);
  await admin.from("employees").update({ end_date: null }).eq("id", employeeId).eq("company_id", companyId);
  const uid = ((Array.isArray(t.employees) ? t.employees[0] : t.employees) as { user_id?: string | null } | null)?.user_id;
  if (uid && t.access_closed_at) await admin.auth.admin.updateUserById(uid, { ban_duration: "none" });
  if (uid && t.prior_role === "manager") await admin.from("users").update({ role: "manager" }).eq("id", uid).eq("company_id", companyId);
  await admin.from("audit_log").insert({
    company_id: companyId, user_id: byUserId, action: "employee.rehire", entity: "employee", entity_id: employeeId,
    detail: "Starfsmaður virkjaður aftur — fyrri starfslok felld úr gildi og aðgangur opnaður",
  }).then(() => {}, () => {});
}
