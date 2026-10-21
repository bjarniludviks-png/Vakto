// Aðgangsstaða eftir starfslok (migration 0088). Grunnurinn framfylgir sjálfur (RLS + bann eftir lokun);
// appið notar þetta aðeins til að sýna réttan skjá: „readonly“ = aðeins skjöl og samningar, „closed“ = lokað.
import { supabase } from "../supabase";

// Áskriftarleið (0089): `app` false = fyrirtækið er á fríu leiðinni (aðeins vefur) → appið skráir út með skilaboðum.
export type AccessState = { state: "active" | "readonly" | "closed"; lastDay: string | null; accessUntil: string | null; app: boolean; role: string | null };

export async function getAccessState(): Promise<AccessState> {
  const { data, error } = await supabase.rpc("my_access_state");
  if (error || !data) return { state: "active", lastDay: null, accessUntil: null, app: true, role: null }; // fyrir 0088
  const d = data as { state?: string; last_day?: string | null; access_until?: string | null; app?: boolean; role?: string | null };
  return { state: d.state === "readonly" || d.state === "closed" ? d.state : "active", lastDay: d.last_day ?? null, accessUntil: d.access_until ?? null, app: d.app !== false, role: d.role ?? null };
}

/** Skilaboð sem innskráningarskjárinn sýnir eftir að lokaðri lotu var hent út. */
let closedNotice = false;
export const markAccessClosed = () => { closedNotice = true; };
export const takeAccessClosed = () => { const v = closedNotice; closedNotice = false; return v; };

/** Fría leiðin (0089): appið er ekki í boði. Stjórnendum bent á vefinn. */
export const APP_BLOCKED_EMPLOYEE = "Vinnuveitandinn þinn notar ekki VAKTO-appið. Hafðu samband við hann.";
export const APP_BLOCKED_MANAGER = "Fyrirtækið er á fríu leiðinni, sem inniheldur ekki VAKTO-appið. Skráðu þig inn á vakto.is til að halda áfram eða breyta um leið (Stillingar → Áskrift).";
export const appBlockedMsg = (role: string | null) => (role === "owner" || role === "manager" ? APP_BLOCKED_MANAGER : APP_BLOCKED_EMPLOYEE);
let blockedNotice: string | null = null;
export const markAppBlocked = (msg: string) => { blockedNotice = msg; };
export const takeAppBlocked = () => { const v = blockedNotice; blockedNotice = null; return v; };

export const ACCESS_CLOSED_MSG = "Aðgangur að VAKTO er lokaður. Ráðningu þinni er lokið og lesaðgangurinn sem vinnuveitandinn veitti er runninn út. Hafðu samband við vinnuveitandann ef þig vantar gögn.";

/** Skjáir sem fyrrverandi starfsmaður má opna á lesaðgangstímanum. */
export const READONLY_ROUTES = ["starfslok", "skjol", "samningur"];

export const isoToIs = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}.${m}.${y}`;
};
