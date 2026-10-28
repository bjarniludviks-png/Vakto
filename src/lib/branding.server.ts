import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_BRAND, isTone, type PdfBrand, type ToneKey } from "@/lib/branding";

// Útlit skjala fyrirtækis: companies.branding = { tone, logo_path } (0098). Merkið liggur í einka-
// fötunni `documents` undir branding/<fyrirtæki>/ og er sótt með þjónustulykli, svo það virkar líka í
// rafrænni undirritun (webhook án notanda). Þolir að 0098 vanti — þá gildir sjálfgefið útlit.

export type Branding = { tone: ToneKey; logoPath: string | null };
export const LOGO_BUCKET = "documents";

export async function companyBranding(companyId: string): Promise<Branding> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("companies").select("branding").eq("id", companyId).maybeSingle();
  if (error || !data) return { tone: "warm", logoPath: null };
  const b = (data.branding ?? {}) as { tone?: string; logo_path?: string | null };
  return { tone: isTone(b.tone) ? b.tone : "warm", logoPath: b.logo_path ?? null };
}

/** Merkið sem data-URL fyrir jsPDF (aðeins PNG/JPEG). null ef ekkert merki eða ekki hægt að sækja. */
export async function logoDataUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  try {
    const admin = createAdminClient();
    const { data } = await admin.storage.from(LOGO_BUCKET).download(path);
    if (!data) return null;
    const buf = Buffer.from(await data.arrayBuffer());
    const type = /\.jpe?g$/i.test(path) ? "image/jpeg" : "image/png";
    return `data:${type};base64,${buf.toString("base64")}`;
  } catch {
    return null;
  }
}

/** Útlit fyrir PDF-smiðina (ráðningarsamningur, launaseðill). */
export async function pdfBrandFor(companyId: string | null | undefined): Promise<PdfBrand> {
  if (!companyId) return DEFAULT_BRAND;
  const b = await companyBranding(companyId);
  return { tone: b.tone, logo: await logoDataUrl(b.logoPath) };
}
