import "server-only";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export type ReqItem = {
  id: string | null; // null = demo entry (no DB row to act on)
  kind: "leave" | "swap" | "avail";
  title: string;
  detail: string;
};
export type Requests = { items: ReqItem[]; live: boolean };

const LEAVE_LABEL: Record<string, string> = { orlof: "orlof", veikindi: "veikindi", olaunad: "ólaunað" };

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
    const [leave, swaps, avail] = await Promise.all([
      supabase.from("leave_requests")
        .select("id, type, from_date, to_date, employees(full_name)")
        .eq("status", "pending").order("from_date", { ascending: true }).limit(10),
      supabase.from("shift_swaps")
        .select("id, note, requester:requester_id(full_name)")
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
    for (const r of leave.data ?? []) {
      items.push({
        id: r.id as string, kind: "leave",
        title: `Frí-beiðni: ${name(r.employees)}`,
        detail: `${r.from_date} – ${r.to_date} · ${LEAVE_LABEL[r.type as string] ?? r.type}`,
      });
    }
    for (const r of swaps.data ?? []) {
      items.push({
        id: r.id as string, kind: "swap",
        title: `Vaktaskipti: ${name(r.requester)}`,
        detail: (r.note as string) ?? "vaktaskipti",
      });
    }
    for (const r of avail.data ?? []) {
      items.push({
        id: r.id as string, kind: "avail",
        title: `Óframboð: ${name(r.employee)}`,
        detail: (r.reason as string) ?? "óframboð skráð",
      });
    }
    if (!items.length) return { items: DEMO, live: false };
    return { items, live: true };
  } catch {
    return { items: DEMO, live: false };
  }
}
