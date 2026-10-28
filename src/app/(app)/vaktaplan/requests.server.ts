import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { getOrlofBalances } from "@/lib/orlof.server";
import { leaveWorkdays } from "@/lib/orlof";

export type ReqItem = {
  id: string | null; // null = demo entry (no DB row to act on)
  kind: "leave" | "swap" | "avail";
  title: string;
  detail: string;
  /** Extra context for the manager, e.g. orlof balance vs. the request. */
  hints?: { text: string; warn?: boolean }[];
};
export type Requests = { items: ReqItem[]; live: boolean };

const LEAVE_LABEL: Record<string, string> = { orlof: "orlof", veikindi: "veikindi", veikindi_barns: "veikindi barns", olaunad: "ólaunað" };
const DOW = ["sun", "mán", "þri", "mið", "fim", "fös", "lau"];
const dmy = (iso: string) => { const d = new Date(`${iso}T12:00:00`); return `${DOW[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };

const DEMO: ReqItem[] = [
  { id: null, kind: "leave", title: "Frí-beiðni: Bach", detail: "27.–28. júní · orlof" },
  { id: null, kind: "swap", title: "Vaktaskipti: Mína ↔ Phong", detail: "laugardagur 12–20 — báðir samþykktu" },
  { id: null, kind: "avail", title: "Óframboð: Ómar", detail: "getur ekki unnið fimmtudaga í júlí" },
];

/** Pending leave + swap requests and recorded unavailability, with demo fallback. */
export async function getPendingRequests(): Promise<Requests> {
  if (!isSupabaseConfigured()) return { items: DEMO, live: false };
  try {
    const supabase = await createClient();
    // Demo only before sign-in; a signed-in company shows its real (maybe empty) requests.
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { items: DEMO, live: false };
    const [leave, swaps, avail] = await Promise.all([
      supabase.from("leave_requests")
        .select("id, type, from_date, to_date, employee_id, note, employees(full_name)")
        .eq("status", "pending").order("from_date", { ascending: true }).limit(10)
        .then((r) => (r.error ? supabase.from("leave_requests").select("id, type, from_date, to_date, employee_id, employees(full_name)") // fyrir 0096
          .eq("status", "pending").order("from_date", { ascending: true }).limit(10) : r)),
      supabase.from("shift_swaps")
        .select("id, note, requester_shift_id, requestee_id, requester:requester_id(full_name), shift:requester_shift_id(date, start_time, end_time)")
        .eq("status", "pending").order("created_at", { ascending: false }).limit(10),
      supabase.from("availability")
        .select("id, reason, employee:employee_id(full_name)")
        .eq("available", false).order("created_at", { ascending: false }).limit(10),
    ]);

    const name = (v: unknown): string => {
      const e = Array.isArray(v) ? v[0] : v;
      return (e as { full_name?: string } | null)?.full_name?.split(" ")[0] ?? "Starfsmaður";
    };

    const items: ReqItem[] = [];
    // Orlof balance for everyone with a pending orlof request (tolerant — no hint on failure).
    const orlofIds = (leave.data ?? []).filter((r) => r.type === "orlof").map((r) => r.employee_id as string);
    const balances = await getOrlofBalances(supabase, orlofIds).catch(() => new Map());
    for (const r of leave.data ?? []) {
      const hints: ReqItem["hints"] = [];
      const b = r.type === "orlof" ? balances.get(r.employee_id as string) : undefined;
      if (b?.tracksDays) {
        const n = leaveWorkdays(r.from_date as string, r.to_date as string);
        // remainingDays already subtracts pending requests (incl. this one) — show what's left before it.
        const before = Math.round((b.remainingDays + n) * 10) / 10;
        hints.push({ text: `Á eftir ${String(before).replace(".", ",")} daga orlofs · beiðnin er ${n} ${n === 1 ? "dagur" : "dagar"}`, warn: n > before });
      }
      const sick = r.type === "veikindi" || r.type === "veikindi_barns";
      const note = (r as { note?: string | null }).note;
      if (sick) hints.push({ text: "Við samþykki skráist veikindadagurinn og vaktin verður laus vakt" });
      items.push({
        id: r.id as string, kind: "leave",
        title: sick ? `${r.type === "veikindi_barns" ? "Veikt barn" : "Tilkynnti veikindi"}: ${name(r.employees)}` : `Frí-beiðni: ${name(r.employees)}`,
        detail: `${dmy(r.from_date as string)}${r.to_date !== r.from_date ? ` – ${dmy(r.to_date as string)}` : ""} · ${LEAVE_LABEL[r.type as string] ?? r.type}${note ? ` · ${note}` : ""}`,
        hints,
      });
    }
    for (const r of swaps.data ?? []) {
      const sh = (Array.isArray(r.shift) ? r.shift[0] : r.shift) as { date?: string; start_time?: string; end_time?: string } | null;
      const release = !!r.requester_shift_id && !r.requestee_id;
      items.push({
        id: r.id as string, kind: "swap",
        title: release ? `Vill losna við vakt: ${name(r.requester)}` : `Vaktaskipti: ${name(r.requester)}`,
        detail: [sh?.date ? `${dmy(sh.date)} ${String(sh.start_time ?? "").slice(0, 5)}–${String(sh.end_time ?? "").slice(0, 5)}` : "", (r.note as string) ?? ""].filter(Boolean).join(" · ") || "vaktaskipti",
        hints: release ? [{ text: "Við samþykki verður vaktin laus vakt sem aðrir geta sótt um" }] : undefined,
      });
    }
    for (const r of avail.data ?? []) {
      items.push({
        id: r.id as string, kind: "avail",
        title: `Óframboð: ${name(r.employee)}`,
        detail: (r.reason as string) ?? "óframboð skráð",
      });
    }
    return { items, live: true };
  } catch {
    return { items: DEMO, live: false };
  }
}
