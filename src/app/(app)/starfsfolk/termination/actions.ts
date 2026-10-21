"use server";

// Starfslok / Ljúka ráðningu (migration 0088). Aðeins eigendur og vaktstjórar (athugað hér OG í RLS).
// Allar skrifaðgerðir stöðvast í opna demoinu (demoBlocked + RLS 0087). Allt er skráð í audit_log.
// VAKTO skráir það sem vinnuveitandinn velur — orðalag er hlutlaust og ekki lögfræðiráðgjöf.

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { buildContractPdf } from "@/lib/contract-pdf";
import { employerSign, metaFrom, notifyContractEmployee, startTaktikalSigning } from "@/lib/esign.server";
import { taktikalEnabled } from "@/lib/taktikal.server";
import { sendTerminationLetterEmail, sendTerminationSignEmail } from "@/lib/email";
import { todayIs } from "@/lib/terminations.server";
import {
  ACCESS_MONTHS, NOTE_REQUIRED, REASON_LABEL, addMonths, buildLetter, isDate, isReason, letterTitleIs, okIso, shiftCutoff,
  type DocumentMode, type NoticeUnit, type ShiftAction, type TerminationReason,
} from "@/lib/termination";

type Db = Awaited<ReturnType<typeof createClient>>;
export type TermResult = { ok: boolean; error?: string; demo?: boolean; id?: string; warning?: string; employerUrl?: string; needSigner?: { ssn: string; phone: string } };

async function managerCtx(supabase: Db): Promise<{ userId: string; company: string; name: string; email: string | null } | { error: string }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: "Ekki innskráð(ur)" };
  const { data: me } = await supabase.from("users").select("company_id, role, full_name").eq("id", user.id).maybeSingle();
  if (!me?.company_id) return { error: "Fyrirtæki fannst ekki" };
  if (me.role !== "owner" && me.role !== "manager") return { error: "Aðeins stjórnendur geta skráð starfslok" };
  return { userId: user.id, company: me.company_id as string, name: (me.full_name as string) || user.email || "Vinnuveitandi", email: user.email ?? null };
}

export type TerminationPrep = {
  ok: boolean; error?: string;
  employee?: { id: string; name: string; email: string | null; kennitala: string | null; title: string | null; address: string | null; union: string | null; hireDate: string | null; hasAccount: boolean; role: string };
  company?: { name: string; kennitala: string | null; address: string | null; taktikal: boolean };
  /** Dagsetningar komandi vakta starfsmannsins (frá og með deginum í dag). */
  shiftDates?: string[];
  /** Mappa í documents-fötunni sem stjórnandinn má hlaða eigin skjali í. */
  uploadPrefix?: string;
  today?: string;
};

/** Gögn fyrir hjálparann: starfsmaður, fyrirtæki, komandi vaktir. */
export async function prepareTermination(employeeId: string): Promise<TerminationPrep> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Ekki tengt" };
  try {
    const supabase = await createClient();
    const ctx = await managerCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const today = todayIs();
    const [{ data: e }, { data: co }, { data: sh }, ex] = await Promise.all([
      supabase.from("employees").select("id, full_name, email, kennitala, title, address, postal_code, city, union_agreement, hire_date, user_id, role, company_id, positions(name)").eq("id", employeeId).maybeSingle(),
      supabase.from("companies").select("name, kennitala, address, esign_provider").eq("id", ctx.company).maybeSingle(),
      supabase.from("shifts").select("date").eq("employee_id", employeeId).gte("date", today).order("date").limit(500),
      supabase.from("employment_terminations").select("id").eq("employee_id", employeeId).is("revoked_at", null).maybeSingle(),
    ]);
    if (!e || e.company_id !== ctx.company) return { ok: false, error: "Starfsmaður fannst ekki" };
    if (e.role === "owner") return { ok: false, error: "Ekki er hægt að skrá starfslok eiganda fyrirtækisins" };
    if (ex.error) return { ok: false, error: "Starfslok eru ekki komin í gagnagrunninn enn (migration 0088)" };
    if (ex.data) return { ok: false, error: "Starfslok eru þegar skráð fyrir þennan starfsmann" };
    const pos = (Array.isArray(e.positions) ? e.positions[0] : e.positions) as { name?: string } | null;
    const addr = [e.address, [e.postal_code, e.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null;
    return {
      ok: true, today,
      employee: {
        id: e.id as string, name: e.full_name as string, email: (e.email as string | null) ?? null, kennitala: (e.kennitala as string | null) ?? null,
        title: (e.title as string | null) || pos?.name || null, address: addr, union: (e.union_agreement as string | null) ?? null,
        hireDate: (e.hire_date as string | null) ?? null, hasAccount: !!e.user_id, role: e.role as string,
      },
      company: {
        name: (co?.name as string) || "Fyrirtækið", kennitala: (co?.kennitala as string | null) ?? null, address: (co?.address as string | null) ?? null,
        taktikal: taktikalEnabled() && co?.esign_provider === "taktikal",
      },
      shiftDates: (sh ?? []).map((s) => String(s.date)),
      uploadPrefix: `${ctx.company}/${employeeId}/`,
    };
  } catch (err) {
    console.error("[prepareTermination]", err);
    return { ok: false, error: "Tókst ekki að sækja gögn starfsmannsins" };
  }
}

export type CreateTerminationInput = {
  employeeId: string;
  reason: TerminationReason;
  noticeDate: string;
  noticeValue: number;
  noticeUnit: NoticeUnit;
  lastDay: string;
  gardenLeave: boolean;
  gardenFrom?: string | null;
  note?: string;
  documentMode: DocumentMode;
  upload?: { path: string; name: string } | null;
  signer?: { ssn: string; phone?: string } | null;
  shiftAction: ShiftAction;
  payrollReminder: boolean;
  deactivate: boolean;
  accessMonths: number;
};

const UNITS: NoticeUnit[] = ["none", "days", "weeks", "months"];
const MODES: DocumentMode[] = ["sign", "send", "upload", "none"];
const SHIFT_ACTIONS: ShiftAction[] = ["keep", "unassign", "delete"];

export async function createTermination(input: CreateTerminationInput): Promise<TermResult> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  // ---- sannprófun ----
  if (!isReason(input.reason)) return { ok: false, error: "Veldu ástæðu" };
  if (!okIso(input.noticeDate) || !okIso(input.lastDay)) return { ok: false, error: "Ógild dagsetning" };
  if (input.lastDay < input.noticeDate) return { ok: false, error: "Síðasti starfsdagur getur ekki verið á undan tilkynningardegi" };
  if (!UNITS.includes(input.noticeUnit)) return { ok: false, error: "Ógildur uppsagnarfrestur" };
  const noticeValue = input.noticeUnit === "none" ? 0 : Math.max(0, Math.min(60, Math.round(Number(input.noticeValue) || 0)));
  if (!MODES.includes(input.documentMode)) return { ok: false, error: "Veldu skjal" };
  if (!SHIFT_ACTIONS.includes(input.shiftAction)) return { ok: false, error: "Ógilt val um vaktir" };
  if (!(ACCESS_MONTHS as readonly number[]).includes(input.accessMonths)) return { ok: false, error: "Ógilt val um aðgang" };
  const note = (input.note ?? "").trim().slice(0, 4000);
  if (NOTE_REQUIRED.includes(input.reason) && !note) return { ok: false, error: "Skráðu innri athugasemd (skylda fyrir þessa ástæðu)" };
  const gardenFrom = input.gardenLeave ? (okIso(input.gardenFrom) ? input.gardenFrom! : input.noticeDate) : null;
  if (gardenFrom && (gardenFrom < input.noticeDate || gardenFrom > input.lastDay)) return { ok: false, error: "Lausn undan vinnuskyldu verður að vera á uppsagnarfrestinum" };

  try {
    const supabase = await createClient();
    const ctx = await managerCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: emp } = await supabase.from("employees")
      .select("id, full_name, email, kennitala, title, address, postal_code, city, phone, role, company_id, user_id, positions(name)").eq("id", input.employeeId).maybeSingle();
    if (!emp || emp.company_id !== ctx.company) return { ok: false, error: "Starfsmaður fannst ekki" };
    if (emp.role === "owner") return { ok: false, error: "Ekki er hægt að skrá starfslok eiganda fyrirtækisins" };
    const { data: co } = await supabase.from("companies").select("name, kennitala, address, esign_provider").eq("id", ctx.company).maybeSingle();
    const useTaktikal = input.documentMode === "sign" && taktikalEnabled() && co?.esign_provider === "taktikal";

    // Skjal valið → forsendur athugaðar ÁÐUR en nokkuð er vistað.
    if (input.documentMode === "sign") {
      if (!emp.email) return { ok: false, error: `Netfang vantar hjá ${emp.full_name} — skráðu það í flipanum Persónulegt eða veldu annan kost` };
      if (useTaktikal) {
        if (!input.signer?.ssn || input.signer.ssn.replace(/\D/g, "").length !== 10) {
          const { data: me } = await supabase.from("employees").select("kennitala, phone").eq("user_id", ctx.userId).maybeSingle();
          return { ok: false, needSigner: { ssn: (me?.kennitala as string) ?? "", phone: (me?.phone as string) ?? "" } };
        }
        if (!emp.kennitala || emp.kennitala.replace(/\D/g, "").length !== 10) return { ok: false, error: "Kennitölu starfsmanns vantar — hún þarf fyrir rafræn skilríki" };
      }
    }
    if (input.documentMode === "upload") {
      const p = input.upload?.path ?? "";
      if (!p.startsWith(`${ctx.company}/${input.employeeId}/`) || p.includes("..")) return { ok: false, error: "Hladdu upp skjalinu fyrst" };
    }

    const accessUntil = input.accessMonths > 0 ? addMonths(input.lastDay, input.accessMonths) : input.lastDay;
    const { data: row, error: insErr } = await supabase.from("employment_terminations").insert({
      company_id: ctx.company, employee_id: input.employeeId, reason: input.reason,
      notice_date: input.noticeDate, notice_value: noticeValue, notice_unit: input.noticeUnit, last_day: input.lastDay,
      garden_leave: input.gardenLeave, garden_leave_from: gardenFrom, note: note || null,
      document_mode: input.documentMode, shift_action: input.shiftAction,
      payroll_reminder: input.payrollReminder, deactivate: input.deactivate,
      access_months: input.accessMonths, access_until: accessUntil, created_by: ctx.userId,
    }).select("id").maybeSingle();
    if (insErr || !row) {
      if (insErr && /duplicate|unique/i.test(insErr.message)) return { ok: false, error: "Starfslok eru þegar skráð fyrir þennan starfsmann" };
      console.error("[createTermination] insert", insErr);
      return { ok: false, error: insErr ? userError(insErr) : "Tókst ekki að vista" };
    }
    const id = row.id as string;
    const warnings: string[] = [];

    // Síðasti starfsdagur á starfsmanninn sjálfan (launakeyrsla, laun % og skýrslur telja til og með honum).
    const { error: endErr } = await supabase.from("employees").update({ end_date: input.lastDay }).eq("id", input.employeeId).eq("company_id", ctx.company);
    if (endErr) console.error("[createTermination] end_date", endErr.message);

    // Vaktir eftir síðasta dag (eða frá upphafi lausnar undan vinnuskyldu).
    let shiftCount = 0;
    if (input.shiftAction !== "keep") {
      const from = [todayIs(), shiftCutoff(input.lastDay, input.gardenLeave, gardenFrom)].sort()[1];
      const { data: shifts } = await supabase.from("shifts").select("*").eq("employee_id", input.employeeId).eq("company_id", ctx.company).gte("date", from);
      const list = shifts ?? [];
      if (list.length) {
        const ids = list.map((s) => s.id as string);
        const { error: shErr } = input.shiftAction === "delete"
          ? await supabase.from("shifts").delete().in("id", ids)
          : await supabase.from("shifts").update({ employee_id: null }).in("id", ids);
        if (shErr) { console.error("[createTermination] shifts", shErr.message); warnings.push("Ekki tókst að taka vaktirnar af — gerðu það í Vaktaplani"); }
        else {
          shiftCount = list.length;
          await supabase.from("employment_terminations").update({ shifts_affected: list }).eq("id", id);
        }
      }
    }

    // Skjal.
    const pos = (Array.isArray(emp.positions) ? emp.positions[0] : emp.positions) as { name?: string } | null;
    const letterInput = {
      reason: input.reason,
      company: { name: (co?.name as string) || "Fyrirtækið", kennitala: (co?.kennitala as string | null) ?? null, address: (co?.address as string | null) ?? null },
      employee: {
        name: emp.full_name as string, kennitala: (emp.kennitala as string | null) ?? null, title: (emp.title as string | null) || pos?.name || null,
        address: [emp.address, [emp.postal_code, emp.city].filter(Boolean).join(" ")].filter(Boolean).join(", ") || null,
      },
      noticeDate: input.noticeDate, noticeValue, noticeUnit: input.noticeUnit, lastDay: input.lastDay,
      gardenLeave: input.gardenLeave, gardenFrom,
    };
    const title = letterTitleIs(input.reason);
    let employerUrl: string | undefined;
    if (input.documentMode === "sign") {
      const content = buildLetter({ ...letterInput, signed: true });
      const { data: c, error: cErr } = await supabase.from("contracts").insert({
        company_id: ctx.company, employee_id: input.employeeId, template: "starfslok-2026",
        title: `${title} — ${emp.full_name}`, content, status: "sent", sent_at: new Date().toISOString(), created_by: ctx.userId,
      }).select("id").maybeSingle();
      if (cErr || !c) { console.error("[createTermination] contract", cErr); warnings.push("Ekki tókst að búa til skjalið til undirritunar"); }
      else {
        await supabase.from("employment_terminations").update({ contract_id: c.id }).eq("id", id);
        if (useTaktikal && input.signer) {
          try {
            const r = await startTaktikalSigning(c.id as string, { userId: ctx.userId, name: ctx.name, email: ctx.email ?? "", ssn: input.signer.ssn, phone: input.signer.phone });
            if (r.ok) employerUrl = r.employerUrl;
            else { await supabase.from("contracts").update({ status: "void" }).eq("id", c.id); warnings.push(r.error ?? "Tókst ekki að stofna undirritun hjá Taktikal"); }
          } catch (err) {
            console.error("[createTermination] taktikal", err);
            await supabase.from("contracts").update({ status: "void" }).eq("id", c.id);
            warnings.push("Tókst ekki að stofna undirritun hjá Taktikal");
          }
        } else {
          try { await employerSign(c.id as string, { userId: ctx.userId, name: ctx.name, email: ctx.email }, metaFrom(await headers())); }
          catch (err) { console.error("[createTermination] employerSign", err); }
          await sendTerminationSignEmail(emp.email as string, emp.full_name as string, letterInput.company.name, title);
          await notifyContractEmployee(c.id as string, "sign"); // push í appið; kastar aldrei
        }
      }
    } else if (input.documentMode === "send") {
      const content = buildLetter({ ...letterInput, signed: false });
      const doc = await buildContractPdf(content, [], { noSignatures: true });
      const bytes = Buffer.from(doc.output("arraybuffer"));
      const safe = String(emp.full_name).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w]+/g, "_");
      const ascii = title.normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/ð/g, "d").replace(/þ/g, "th").replace(/æ/g, "ae").replace(/[^A-Za-z0-9]+/g, "_");
      const filename = `${ascii}_${safe}.pdf`;
      const path = `${ctx.company}/${input.employeeId}/${Date.now()}-${filename}`;
      const { error: upErr } = await supabase.storage.from("documents").upload(path, bytes, { contentType: "application/pdf", upsert: false });
      if (upErr) { console.error("[createTermination] upload", upErr.message); warnings.push("Ekki tókst að vista bréfið í skjalasafni"); }
      else {
        const { data: d } = await supabase.from("documents").insert({ company_id: ctx.company, employee_id: input.employeeId, name: `${title}.pdf`, type: "Starfslok", url: path }).select("id").maybeSingle();
        if (d) await supabase.from("employment_terminations").update({ document_id: d.id }).eq("id", id);
        if (emp.email) await sendTerminationLetterEmail(emp.email as string, { name: emp.full_name as string, company: letterInput.company.name, title, pdfBase64: bytes.toString("base64"), filename });
        else warnings.push("Ekkert netfang skráð — bréfið er í skjalasafni starfsmannsins en var ekki sent");
      }
    } else if (input.documentMode === "upload" && input.upload) {
      const name = input.upload.name.trim().slice(0, 160) || "Starfslok.pdf";
      const { data: d, error: dErr } = await supabase.from("documents").insert({ company_id: ctx.company, employee_id: input.employeeId, name, type: "Starfslok", url: input.upload.path }).select("id").maybeSingle();
      if (dErr || !d) { console.error("[createTermination] doc", dErr); warnings.push("Ekki tókst að skrá skjalið"); }
      else await supabase.from("employment_terminations").update({ document_id: d.id }).eq("id", id);
    }

    const parts = [
      REASON_LABEL[input.reason], `tilkynnt ${isDate(input.noticeDate)}`, `síðasti dagur ${isDate(input.lastDay)}`,
      input.gardenLeave ? `laus undan vinnuskyldu frá ${isDate(gardenFrom)}` : null,
      `skjal: ${{ sign: "til undirritunar", send: "sent án undirritunar", upload: "eigið skjal", none: "ekkert" }[input.documentMode]}`,
      input.shiftAction !== "keep" ? `${shiftCount} vaktir ${input.shiftAction === "delete" ? "fjarlægðar" : "gerðar lausar"}` : null,
      input.payrollReminder ? "áminning um lokauppgjör" : null,
      input.deactivate ? "óvirkjaður eftir síðasta dag" : null,
      `lesaðgangur ${input.accessMonths} mán. (til ${isDate(accessUntil)})`,
    ].filter(Boolean).join(" · ");
    await logAudit(supabase, ctx.company, ctx.userId, { action: "employee.terminate", entity: "employee", entityId: input.employeeId, detail: `Starfslok skráð — ${emp.full_name}: ${parts}` });
    revalidatePath("/starfsfolk", "layout");
    revalidatePath("/launakeyrslur");
    return { ok: true, id, employerUrl, warning: warnings.join(" · ") || undefined };
  } catch (err) {
    console.error("[createTermination]", err);
    return { ok: false, error: userError(err, "Tókst ekki að skrá starfslok") };
  }
}

/** Afturkalla starfslok — leyft til og með síðasta starfsdegi. Vaktir sem voru teknar koma aftur. */
export async function revokeTermination(id: string): Promise<TermResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await managerCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: t } = await supabase.from("employment_terminations")
      .select("id, employee_id, last_day, contract_id, shift_action, shifts_affected, revoked_at, employees(full_name)").eq("id", id).eq("company_id", ctx.company).maybeSingle();
    if (!t || t.revoked_at) return { ok: false, error: "Starfslok fundust ekki" };
    if (String(t.last_day) < todayIs()) return { ok: false, error: "Síðasti starfsdagur er liðinn — ekki er hægt að afturkalla starfslokin. Skráðu nýja ráðningu ef starfsmaðurinn kemur aftur." };
    const { error } = await supabase.from("employment_terminations").update({ revoked_at: new Date().toISOString(), revoked_by: ctx.userId }).eq("id", id).is("revoked_at", null);
    if (error) return { ok: false, error: userError(error) };
    await supabase.from("employees").update({ end_date: null }).eq("id", t.employee_id).eq("company_id", ctx.company);

    // Vaktir aftur (aðeins þær sem eru ekki liðnar og enginn annar hefur tekið).
    let restored = 0;
    const snap = (Array.isArray(t.shifts_affected) ? t.shifts_affected : []) as Record<string, unknown>[];
    const today = todayIs();
    const future = snap.filter((s) => String(s.date) >= today);
    if (future.length) {
      if (t.shift_action === "delete") {
        const { error: rErr } = await supabase.from("shifts").insert(future);
        if (!rErr) restored = future.length; else console.error("[revokeTermination] restore", rErr.message);
      } else if (t.shift_action === "unassign") {
        const { data: back } = await supabase.from("shifts").update({ employee_id: t.employee_id }).in("id", future.map((s) => s.id as string)).is("employee_id", null).select("id");
        restored = back?.length ?? 0;
      }
    }
    // Bréf í undirritunarferli fellur úr gildi.
    if (t.contract_id) await supabase.from("contracts").update({ status: "void" }).eq("id", t.contract_id).eq("status", "sent");

    const emp = (Array.isArray(t.employees) ? t.employees[0] : t.employees) as { full_name?: string } | null;
    await logAudit(supabase, ctx.company, ctx.userId, {
      action: "employee.terminate.revoke", entity: "employee", entityId: t.employee_id as string,
      detail: `Starfslok afturkölluð — ${emp?.full_name ?? ""}${restored ? ` · ${restored} vaktir settar aftur á plan` : ""}${t.contract_id ? " · skjal í undirritun ógilt" : ""}`,
    });
    revalidatePath("/starfsfolk", "layout");
    revalidatePath("/launakeyrslur");
    return { ok: true, warning: future.length && restored < future.length ? `${future.length - restored} vaktir komust ekki aftur á planið (aðrir tóku þær)` : undefined };
  } catch (err) {
    console.error("[revokeTermination]", err);
    return { ok: false, error: userError(err, "Tókst ekki að afturkalla") };
  }
}

/** Lokauppgjör launa og orlofs afgreitt (eða opnað aftur). */
export async function setSettled(id: string, settled: boolean): Promise<TermResult> {
  if (await demoBlocked()) return demoResult();
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const supabase = await createClient();
    const ctx = await managerCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data, error } = await supabase.from("employment_terminations")
      .update({ settled_at: settled ? new Date().toISOString() : null, settled_by: settled ? ctx.userId : null })
      .eq("id", id).eq("company_id", ctx.company).select("employee_id, employees(full_name)").maybeSingle();
    if (error || !data) return { ok: false, error: error ? userError(error) : "Fannst ekki" };
    const emp = (Array.isArray(data.employees) ? data.employees[0] : data.employees) as { full_name?: string } | null;
    await logAudit(supabase, ctx.company, ctx.userId, { action: settled ? "employee.settled" : "employee.settled.reopen", entity: "employee", entityId: data.employee_id as string, detail: `Lokauppgjör ${settled ? "merkt afgreitt" : "opnað aftur"} — ${emp?.full_name ?? ""}` });
    revalidatePath("/launakeyrslur");
    revalidatePath("/maelabord");
    revalidatePath("/starfsfolk", "layout");
    return { ok: true };
  } catch (err) {
    return { ok: false, error: userError(err, "Villa") };
  }
}

/** Opnar starfslokaskjalið (undirritað eintak eða sent/hlaðið bréf) — stutt signed URL. */
export async function terminationDocUrl(id: string): Promise<{ ok: boolean; url?: string; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false };
  try {
    const supabase = await createClient();
    const ctx = await managerCtx(supabase);
    if ("error" in ctx) return { ok: false, error: ctx.error };
    const { data: t } = await supabase.from("employment_terminations").select("document_id, documents(url)").eq("id", id).eq("company_id", ctx.company).maybeSingle();
    const d = (Array.isArray(t?.documents) ? t?.documents[0] : t?.documents) as { url?: string } | null;
    if (!d?.url) return { ok: false, error: "Ekkert skjal" };
    const { data, error } = await supabase.storage.from("documents").createSignedUrl(d.url, 120);
    if (error || !data?.signedUrl) return { ok: false, error: "Tókst ekki að opna skjalið" };
    return { ok: true, url: data.signedUrl };
  } catch {
    return { ok: false, error: "Tókst ekki að opna skjalið" };
  }
}
