// Útlit fyrirtækisins fyrir PDF sem er búið til í vafranum (niðurhal á samningi eða launaseðli).
// Á þjóninum (rafræn undirritun) er útlitið sótt beint með pdfBrandFor í branding.server.ts.
import { DEFAULT_BRAND, type PdfBrand } from "@/lib/branding";

export async function loadMyPdfBrand(): Promise<PdfBrand> {
  if (typeof window === "undefined") return DEFAULT_BRAND;
  try {
    const { getMyPdfBrand } = await import("@/app/(app)/stillingar/branding-actions");
    return await getMyPdfBrand();
  } catch {
    return DEFAULT_BRAND;
  }
}
