"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { logAudit } from "@/lib/audit";
import { userError } from "@/lib/user-error";
import { demoBlocked, demoResult } from "@/lib/demo.server";
import { DEFAULT_BRAND, TONES, isTone, type PdfBrand, type ToneKey } from "@/lib/branding";
import { companyBranding, logoDataUrl, pdfBrandFor, LOGO_BUCKET } from "@/lib/branding.server";

// Stillingar → Fyrirtæki → Útlit skjala: litatónn og merki á ráðningarsamningum og launaseðlum.
// Lestur: allir innskráðir í fyrirtækinu (starfsmaður sækir eigin launaseðil). Breyting: aðeins eigandi.

type Result = { ok: boolean; demo?: boolean; error?: string };
const MAX_LOGO_BYTES = 600 * 1024;

async function me() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  return data?.company_id ? { supabase, userId: user.id, company: data.company_id as string, role: data.role as string } : null;
}

/** Útlit fyrir PDF sem notandinn sækir (vafri). Fellur á sjálfgefið útlit ef eitthvað bregst. */
export async function getMyPdfBrand(): Promise<PdfBrand> {
  if (!isSupabaseConfigured()) return DEFAULT_BRAND;
  try {
    const m = await me();
    return m ? await pdfBrandFor(m.company) : DEFAULT_BRAND;
  } catch {
    return DEFAULT_BRAND;
  }
}

export async function getBrandingSettings(): Promise<{ tone: ToneKey; logo: string | null; canEdit: boolean } | null> {
  if (!isSupabaseConfigured()) return { tone: "warm", logo: null, canEdit: true };
  try {
    const m = await me();
    if (!m) return null;
    const b = await companyBranding(m.company);
    return { tone: b.tone, logo: await logoDataUrl(b.logoPath), canEdit: m.role === "owner" };
  } catch {
    return null;
  }
}

async function ownerCtx() {
  const m = await me();
  if (!m) return { error: "Ekki innskráð(ur)" as const };
  if (m.role !== "owner") return { error: "Aðeins eigandi getur breytt útliti skjala" as const };
  return m;
}

async function writeBranding(company: string, patch: { tone?: ToneKey; logo_path?: string | null }) {
  const admin = createAdminClient();
  const cur = await companyBranding(company);
  const next = { tone: patch.tone ?? cur.tone, logo_path: patch.logo_path !== undefined ? patch.logo_path : cur.logoPath };
  const { error } = await admin.from("companies").update({ branding: next }).eq("id", company);
  if (error) throw error;
  return { prev: cur, next };
}

export async function saveBrandingTone(tone: string): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isTone(tone)) return { ok: false, error: "Veldu lit" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const c = await ownerCtx();
    if ("error" in c) return { ok: false, error: c.error };
    await writeBranding(c.company, { tone });
    await logAudit(c.supabase, c.company, c.userId, { action: "company.branding", entity: "companies", detail: `Litur skjala: ${TONES[tone].label}` });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að vista lit") };
  }
}

/** Merki sem data-URL (PNG eða JPEG, mest 600 KB). Kemur í stað eldra merkis. */
export async function uploadBrandLogo(dataUrl: string): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  const m = /^data:image\/(png|jpeg);base64,(.+)$/.exec(dataUrl ?? "");
  if (!m) return { ok: false, error: "Merkið þarf að vera PNG eða JPG" };
  const bytes = Buffer.from(m[2], "base64");
  if (bytes.length > MAX_LOGO_BYTES) return { ok: false, error: "Merkið má mest vera 600 KB" };
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const c = await ownerCtx();
    if ("error" in c) return { ok: false, error: c.error };
    const admin = createAdminClient();
    const path = `branding/${c.company}/logo-${Date.now()}.${m[1] === "jpeg" ? "jpg" : "png"}`;
    const { error: upErr } = await admin.storage.from(LOGO_BUCKET).upload(path, bytes, { contentType: `image/${m[1]}`, upsert: false });
    if (upErr) return { ok: false, error: userError(upErr, "Tókst ekki að hlaða upp merkinu") };
    const { prev } = await writeBranding(c.company, { logo_path: path });
    if (prev.logoPath && prev.logoPath !== path) await admin.storage.from(LOGO_BUCKET).remove([prev.logoPath]);
    await logAudit(c.supabase, c.company, c.userId, { action: "company.branding", entity: "companies", detail: "Nýtt merki á skjölum" });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að vista merkið") };
  }
}

export async function removeBrandLogo(): Promise<Result> {
  if (await demoBlocked()) return demoResult(); // opið demo: aðeins til skoðunar
  if (!isSupabaseConfigured()) return { ok: true, demo: true };
  try {
    const c = await ownerCtx();
    if ("error" in c) return { ok: false, error: c.error };
    const { prev } = await writeBranding(c.company, { logo_path: null });
    if (prev.logoPath) await createAdminClient().storage.from(LOGO_BUCKET).remove([prev.logoPath]);
    await logAudit(c.supabase, c.company, c.userId, { action: "company.branding", entity: "companies", detail: "Merki fjarlægt af skjölum — VAKTO-merkið aftur" });
    revalidatePath("/stillingar");
    return { ok: true };
  } catch (e) {
    return { ok: false, error: userError(e, "Tókst ekki að fjarlægja merkið") };
  }
}
