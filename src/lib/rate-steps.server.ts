import "server-only";

// Dagleg keyrsla taxtahækkana (employees.rate_steps, 0107) — kölluð úr /api/cron/punch-check.
//  • 7 dögum fyrir gildisdag: stjórnendur fá áminningu (push + póstur), einu sinni (notifiedAt).
//  • Á gildisdegi: mode 'auto' → employees.rate uppfærður + aðgerðaskrá; báðar gerðir → tilkynning (doneAt).
// Þrep sem vantar gögn fyrir (kennitölu / ráðningardag) bíða — spjaldið varar við því.
// Þrep sem gleymdust lengur en 60 daga aftur í tímann eru aðeins merkt, ekki framkvæmd (t.d. nýskráð þrep).

import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { allRows } from "@/lib/supabase/all-rows";
import { notifyManagers } from "@/lib/push";
import { sendEmail, template } from "@/lib/email";
import { isoDate } from "@/lib/entitlements";
import { normalizeSteps, stepDueDate, stepTrigger, isDisplay, NOTICE_DAYS, type RateStep } from "@/lib/rate-steps";
import { nf } from "@/lib/format";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
const STALE_DAYS = 60;
const esc = (x: string) => x.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]!));

function addDays(iso: string, n: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  return isoDate(new Date(y, m - 1, d + n));
}

type Msg = { companyId: string; employeeId: string; title: string; body: string };

export async function runRateSteps(today = isoDate(new Date())): Promise<{ applied: number; notified: number }> {
  if (!isSupabaseConfigured()) return { applied: 0, notified: 0 };
  let applied = 0, notified = 0;
  try {
    const admin = createAdminClient();
    const { data: emps, error } = await allRows((a, b) => admin.from("employees")
      .select("id, company_id, full_name, kennitala, hire_date, prior_service_months, pay_type, rate, status, end_date, rate_steps")
      .eq("status", "active").neq("rate_steps", "[]").order("id").range(a, b));
    if (error) return { applied, notified }; // 0107 ekki keyrð
    const msgs: Msg[] = [];
    for (const e of emps ?? []) {
      const steps = normalizeSteps(e.rate_steps);
      if (!steps.length) continue;
      if (e.end_date && String(e.end_date) < today) continue;
      const person = { kennitala: e.kennitala as string | null, hireDate: e.hire_date as string | null, priorServiceMonths: e.prior_service_months as number | null };
      const unit = e.pay_type === "monthly" ? "kr/mán" : "kr/klst";
      let changed = false;
      let newRate: number | null = null;
      const nowIso = new Date().toISOString();
      const next: RateStep[] = steps.map((s) => {
        if (s.doneAt) return s;
        const due = stepDueDate(s, person);
        if (!due) return s;
        if (due <= today) {
          changed = true;
          if (due < addDays(today, -STALE_DAYS)) return { ...s, doneAt: nowIso }; // of gamalt — ekki hækka afturvirkt
          const why = s.label ? `${s.label} (${stepTrigger(s)})` : stepTrigger(s);
          if (s.mode === "auto" && s.rate > 0) {
            newRate = s.rate;
            msgs.push({ companyId: e.company_id as string, employeeId: e.id as string, title: `Taxti hækkaður: ${e.full_name}`,
              body: `${e.full_name} ${why} — taxtinn er nú ${nf(s.rate)} ${unit} (var ${nf(Number(e.rate) || 0)}).` });
          } else {
            msgs.push({ companyId: e.company_id as string, employeeId: e.id as string, title: `Athugaðu taxtann: ${e.full_name}`,
              body: `${e.full_name} ${why} í dag (${isDisplay(due)}).${s.rate > 0 ? ` Skráður nýr taxti: ${nf(s.rate)} ${unit}.` : ""} Taxtanum hefur ekki verið breytt.` });
          }
          return { ...s, doneAt: nowIso };
        }
        if (!s.notifiedAt && due <= addDays(today, NOTICE_DAYS)) {
          changed = true;
          const why = s.label ? `${s.label} (${stepTrigger(s)})` : stepTrigger(s);
          msgs.push({ companyId: e.company_id as string, employeeId: e.id as string, title: `Taxtabreyting framundan: ${e.full_name}`,
            body: s.mode === "auto" && s.rate > 0
              ? `${e.full_name} ${why} ${isDisplay(due)}. VAKTO hækkar taxtann þá sjálfkrafa í ${nf(s.rate)} ${unit}.`
              : `${e.full_name} ${why} ${isDisplay(due)}. Athugaðu hvort taxtinn eigi að breytast.` });
          return { ...s, notifiedAt: nowIso };
        }
        return s;
      });
      if (!changed) continue;
      const patch: Record<string, unknown> = { rate_steps: next };
      if (newRate != null) patch.rate = newRate;
      const { error: upErr } = await admin.from("employees").update(patch).eq("id", e.id as string);
      if (upErr) { console.error("runRateSteps", upErr.message); continue; }
      if (newRate != null) {
        applied++;
        await admin.from("audit_log").insert({
          company_id: e.company_id, user_id: null, action: "employee.rate_step", entity: "employee", entity_id: e.id,
          detail: `Taxti hækkaður sjálfkrafa: ${e.full_name} — ${nf(newRate)} ${unit} (var ${nf(Number(e.rate) || 0)})`,
        });
      }
    }
    // Tilkynningar: push til stjórnenda + einn póstur á fyrirtæki með öllum atriðum dagsins.
    const byCompany = new Map<string, Msg[]>();
    for (const m of msgs) { if (!byCompany.has(m.companyId)) byCompany.set(m.companyId, []); byCompany.get(m.companyId)!.push(m); }
    for (const [companyId, list] of byCompany) {
      for (const m of list) {
        notified++;
        await notifyManagers(companyId, { title: m.title, body: m.body, url: `/starfsfolk/${m.employeeId}`, tag: "rate-step" });
      }
      const { data: mgrs } = await admin.from("users").select("email").eq("company_id", companyId).in("role", ["owner", "manager"]);
      const items = list.map((m) => `<li style="margin:0 0 8px"><b>${esc(m.title)}</b><br>${esc(m.body)}</li>`).join("");
      for (const u of mgrs ?? []) {
        if (!u.email) continue;
        await sendEmail({
          to: u.email as string,
          subject: list.length === 1 ? list[0].title : `Taxtabreytingar (${list.length})`,
          html: template({
            preheader: esc(list[0].body),
            heading: "Taxtabreytingar starfsfólks",
            body: `<ul style="padding-left:18px;margin:0">${items}</ul>`,
            headingEn: "Pay rate changes",
            bodyEn: "One or more of your employees reached a scheduled pay rate change. Open VAKTO to review.",
            ctaLabel: "Opna starfsfólk",
            ctaLabelEn: "Open employees",
            ctaHref: `${APP_URL}/starfsfolk`,
          }),
        });
      }
    }
  } catch (e) {
    console.error("runRateSteps", e);
  }
  return { applied, notified };
}
