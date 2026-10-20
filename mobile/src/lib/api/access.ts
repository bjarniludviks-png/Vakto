// Aðgangsstaða eftir starfslok (migration 0088). Grunnurinn framfylgir sjálfur (RLS + bann eftir lokun);
// appið notar þetta aðeins til að sýna réttan skjá: „readonly“ = aðeins skjöl og samningar, „closed“ = lokað.
import { supabase } from "../supabase";

export type AccessState = { state: "active" | "readonly" | "closed"; lastDay: string | null; accessUntil: string | null };

export async function getAccessState(): Promise<AccessState> {
  const { data, error } = await supabase.rpc("my_access_state");
  if (error || !data) return { state: "active", lastDay: null, accessUntil: null }; // fyrir 0088
  const d = data as { state?: string; last_day?: string | null; access_until?: string | null };
  return { state: d.state === "readonly" || d.state === "closed" ? d.state : "active", lastDay: d.last_day ?? null, accessUntil: d.access_until ?? null };
}

/** Skilaboð sem innskráningarskjárinn sýnir eftir að lokaðri lotu var hent út. */
let closedNotice = false;
export const markAccessClosed = () => { closedNotice = true; };
export const takeAccessClosed = () => { const v = closedNotice; closedNotice = false; return v; };

export const ACCESS_CLOSED_MSG = "Aðgangur að VAKTO er lokaður. Ráðningu þinni er lokið og lesaðgangurinn sem vinnuveitandinn veitti er runninn út. Hafðu samband við vinnuveitandann ef þig vantar gögn.";

/** Skjáir sem fyrrverandi starfsmaður má opna á lesaðgangstímanum. */
export const READONLY_ROUTES = ["starfslok", "skjol", "samningur"];

export const isoToIs = (iso: string | null) => {
  if (!iso) return "—";
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return `${d}.${m}.${y}`;
};
