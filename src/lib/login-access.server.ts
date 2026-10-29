import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { emailConfigured, sendInviteEmail, sendResetEmail } from "@/lib/email";
import { userError } from "@/lib/user-error";
import { demoBlocked, DEMO_BLOCKED } from "@/lib/demo.server";
import { createClient } from "@/lib/supabase/server";

// Innskráningaraðgangur notanda sem stjórnandi sér um: senda boð/innskráningartengil aftur
// og færa innskráninguna á nýtt netfang. Notað af starfsmannaspjaldinu og Stillingar → Notendur.

export type AccessStatus = { userId: string; email: string | null; signedIn: boolean };
export type AccessResult = { ok: boolean; error?: string; sentTo?: string; kind?: "invite" | "login" };

const ROLE_LABEL: Record<string, string> = { employee: "Starfsmaður", manager: "Vaktstjóri", owner: "Stjórnandi", contractor: "Verktaki" };
const validEmail = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);

/** Innskráður stjórnandi (eigandi/vaktstjóri) og fyrirtækið hans — annars villa. */
export async function managerContext(): Promise<{ ok: true; company: string; callerId: string; callerRole: string } | { ok: false; error: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Ekki innskráð(ur)" };
  const { data: me } = await supabase.from("users").select("company_id, role").eq("id", user.id).maybeSingle();
  const company = me?.company_id as string | undefined;
  if (!company || !["owner", "manager"].includes(me?.role as string)) return { ok: false, error: "Aðeins stjórnendur geta séð um aðgang" };
  return { ok: true, company, callerId: user.id, callerRole: me!.role as string };
}

/** Notandinn verður að vera í fyrirtækinu; vaktstjóri má ekki eiga við aðgang eiganda. */
async function target(company: string, callerRole: string, userId: string) {
  const admin = createAdminClient();
  const { data: mem } = await admin.from("company_members").select("role").eq("company_id", company).eq("user_id", userId).maybeSingle();
  const { data: u } = await admin.from("users").select("company_id, role").eq("id", userId).maybeSingle();
  const role = (mem?.role as string) ?? (u?.company_id === company ? (u?.role as string) : null);
  if (!role) return { ok: false as const, error: "Notandinn er ekki í fyrirtækinu" };
  if (role === "owner" && callerRole !== "owner") return { ok: false as const, error: "Aðeins eigandi getur breytt aðgangi eiganda" };
  return { ok: true as const, role, admin };
}

export async function accessStatus(company: string, callerRole: string, userId: string): Promise<AccessStatus | null> {
  const t = await target(company, callerRole, userId);
  if (!t.ok) return null;
  const { data } = await t.admin.auth.admin.getUserById(userId);
  if (!data?.user) return null;
  return { userId, email: data.user.email ?? null, signedIn: !!data.user.last_sign_in_at };
}

/** Sendir boð aftur (hefur aldrei skráð sig inn) eða innskráningartengil (gleymt lykilorð).
 *  Báðir tenglar opna /nytt-lykilord þar sem viðkomandi velur lykilorð. */
export async function sendAccessLink(company: string, callerRole: string, userId: string): Promise<AccessResult> {
  if (await demoBlocked(company)) return { ok: false, error: DEMO_BLOCKED };
  if (!emailConfigured()) return { ok: false, error: "Póstsending er ekki uppsett" };
  try {
    const t = await target(company, callerRole, userId);
    if (!t.ok) return t;
    const { data: au } = await t.admin.auth.admin.getUserById(userId);
    const email = au?.user?.email;
    if (!email) return { ok: false, error: "Ekkert netfang á aðganginum" };
    const { data: gen, error } = await t.admin.auth.admin.generateLink({ type: "recovery", email });
    if (error) return { ok: false, error: userError(error) };
    const hash = gen?.properties?.hashed_token;
    if (!hash) return { ok: false, error: "Tókst ekki að búa til tengil" };
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://vakto.is";
    const link = `${appUrl}/nytt-lykilord?token_hash=${hash}&type=recovery`;
    if (au?.user?.last_sign_in_at) {
      await sendResetEmail(email, link);
      return { ok: true, sentTo: email, kind: "login" };
    }
    const { data: comp } = await t.admin.from("companies").select("name").eq("id", company).maybeSingle();
    await sendInviteEmail(email, (comp?.name as string) ?? "VAKTO", ROLE_LABEL[t.role] ?? "Starfsmaður", link);
    return { ok: true, sentTo: email, kind: "invite" };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}

/** Færir innskráninguna á nýtt netfang (auth + users + starfsmannaprófíll) og sendir tengil þangað.
 *  Ekki leyft ef aðgangurinn er líka í öðru fyrirtæki — þá myndi breytingin hafa áhrif þar. */
export async function changeLoginEmail(company: string, callerRole: string, userId: string, emailRaw: string): Promise<AccessResult> {
  const email = emailRaw.trim().toLowerCase();
  if (!validEmail(email)) return { ok: false, error: "Ógilt netfang" };
  if (await demoBlocked(company)) return { ok: false, error: DEMO_BLOCKED };
  try {
    const t = await target(company, callerRole, userId);
    if (!t.ok) return t;
    const { count } = await t.admin.from("company_members").select("company_id", { count: "exact", head: true }).eq("user_id", userId).neq("company_id", company);
    if (count) return { ok: false, error: "Þessi aðgangur er líka í öðru fyrirtæki — viðkomandi þarf að breyta netfanginu sjálf(ur)" };
    const { data: taken } = await t.admin.from("users").select("id").ilike("email", email).neq("id", userId).limit(1).maybeSingle();
    if (taken) return { ok: false, error: "Annar aðgangur notar þegar þetta netfang" };
    const { error } = await t.admin.auth.admin.updateUserById(userId, { email, email_confirm: true });
    if (error) return { ok: false, error: userError(error) };
    await t.admin.from("users").update({ email }).eq("id", userId);
    await t.admin.from("employees").update({ email }).eq("company_id", company).eq("user_id", userId);
    const sent = await sendAccessLink(company, callerRole, userId);
    return { ok: true, sentTo: sent.ok ? email : undefined, kind: sent.kind };
  } catch (e) {
    return { ok: false, error: userError(e, "Villa") };
  }
}
