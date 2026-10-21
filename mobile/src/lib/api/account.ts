// Eyðing aðgangs (Apple 5.1.1(v)) — fer um vefþjóninn (/api/account/delete-request), sem lokar
// aðganginum strax (Auth-bann), óvirkjar starfsmanninn og lætur hjalp@ + eigendur vita.
import { supabase } from "../supabase";

const API = (process.env.EXPO_PUBLIC_API_URL ?? "https://www.vakto.is").replace(/\/$/, "");

export const HELP_EMAIL = "hjalp@vakto.is";
export const OWNER_DELETE_MSG = "Þú ert eigandi fyrirtækisins. Til að eyða fyrirtækinu og aðganginum skrifaðu okkur á hjalp@vakto.is";
export const ACCOUNT_DELETED_MSG = "Aðgangi þínum hefur verið lokað og beiðni um eyðingu móttekin.";

/** Hlutverk innskráða notandans (users.role) — eigandi getur ekki eytt sér úr appinu. */
export async function myRole(): Promise<string | null> {
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("users").select("role").eq("id", auth.user.id).maybeSingle();
  return (data?.role as string) ?? null;
}

export async function requestAccountDeletion(): Promise<{ ok: boolean; owner?: boolean; error?: string }> {
  try {
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    if (!token) return { ok: false, error: "Ekki innskráð(ur)" };
    const r = await fetch(`${API}/api/account/delete-request`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: "{}",
    });
    const j = (await r.json().catch(() => null)) as { ok?: boolean; owner?: boolean; error?: string } | null;
    if (!j) return { ok: false, error: "Tókst ekki" };
    return { ok: !!j.ok, owner: j.owner, error: j.error };
  } catch {
    return { ok: false, error: "Engin tenging — reyndu aftur" };
  }
}

/** Skilaboð sem innskráningarskjárinn sýnir eftir að aðgangi var eytt. */
let deletedNotice = false;
export const markAccountDeleted = () => { deletedNotice = true; };
export const takeAccountDeleted = () => { const v = deletedNotice; deletedNotice = false; return v; };
