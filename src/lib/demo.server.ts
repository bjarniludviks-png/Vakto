import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

// Opið demo (DEMO_COMPANY_ID): gestir skrá sig inn í EITT sameiginlegt gervifyrirtæki.
// Allt sem snertir umheiminn (póstur, push, rafræn undirritun, kort/greiðslur, boð,
// tengingar, API-lyklar) er stöðvað á þröskuldum (email.ts, push.ts, straumur.ts,
// taktikal.server.ts, invite.server.ts, integrations) — ekki í hverri aðgerð.
// Gögnin sjálf eru endurstillt á hverri nóttu (/api/cron/demo-reset).

export const DEMO_BLOCKED = "Þetta er ekki í boði í demo";
/** AI-spurningar á sólarhring fyrir allt demo-fyrirtækið (ai_usage núllstillt í næturkeyrslu). */
export const DEMO_AI_DAILY = 20;

export function demoCompanyId(): string | null {
  return process.env.DEMO_COMPANY_ID?.trim() || null;
}

/** „Prófa demo" er aðeins sýnt þegar demo-fyrirtækið OG innskráningin eru stillt (annars engar varnir). */
export function demoConfigured(): boolean {
  return !!(demoCompanyId() && process.env.DEMO_LOGIN_EMAIL && process.env.DEMO_LOGIN_PASSWORD);
}

export function isDemoCompany(companyId: string | null | undefined): boolean {
  const demo = demoCompanyId();
  return !!demo && !!companyId && companyId === demo;
}

/** Er innskráði notandinn (þessi beiðni) í demo-fyrirtækinu? Utan beiðni (cron) → false. */
export const currentUserIsDemo = cache(async (): Promise<boolean> => {
  const demo = demoCompanyId();
  if (!demo) return false;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return false;
    if (process.env.DEMO_LOGIN_EMAIL && user.email?.toLowerCase() === process.env.DEMO_LOGIN_EMAIL.toLowerCase()) return true;
    const { data: u } = await supabase.from("users").select("company_id").eq("id", user.id).maybeSingle();
    return u?.company_id === demo;
  } catch {
    return false;
  }
});

/** `if (await demoBlocked()) return demoResult();` efst í aðgerðum sem mega ekki keyra í demo. */
export async function demoBlocked(companyId?: string | null): Promise<boolean> {
  if (!demoCompanyId()) return false;
  return isDemoCompany(companyId) || (await currentUserIsDemo());
}

export function demoResult(): { ok: false; error: string } {
  return { ok: false, error: DEMO_BLOCKED };
}

/** Kastar DEMO_BLOCKED (íslenskur texti → userError hleypir honum óbreyttum í gegn). */
export async function assertNotDemo(companyId?: string | null): Promise<void> {
  if (await demoBlocked(companyId)) throw new Error(DEMO_BLOCKED);
}
