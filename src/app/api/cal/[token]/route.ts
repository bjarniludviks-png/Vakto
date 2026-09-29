import { createAdminClient } from "@/lib/supabase/admin";
import { isSupabaseConfigured } from "@/lib/supabase/config";

// Vaktir starfsmanns sem dagatalsáskrift (ICS) — iPhone/Google/Outlook sækja
// þetta reglulega. Leynitengillinn er employees.calendar_token (0057); hann er
// eini aðgangurinn, svo ekkert annað en vaktir (tími, staður, tegund) fer út.
// Íslenskur tími = UTC, svo tímar eru skrifaðir með Z.

const esc = (s: string) => s.replace(/[\;,]/g, (c) => `\\${c}`).replace(/\r?\n/g, "\\n");
const stamp = (date: string, time: string) => `${date.replace(/-/g, "")}T${time.slice(0, 5).replace(":", "")}00Z`;
const addDay = (date: string) => { const d = new Date(`${date}T00:00:00Z`); d.setUTCDate(d.getUTCDate() + 1); return d.toISOString().slice(0, 10); };

export async function GET(_req: Request, ctx: { params: Promise<{ token: string }> }) {
  const { token: raw } = await ctx.params;
  const token = raw.replace(/\.ics$/i, "");
  if (!isSupabaseConfigured() || !/^[0-9a-f-]{36}$/i.test(token)) return new Response("Not found", { status: 404 });

  const admin = createAdminClient();
  const { data: emp } = await admin.from("employees")
    .select("id, full_name, status, companies(name)").eq("calendar_token", token).maybeSingle();
  if (!emp || emp.status === "inactive") return new Response("Not found", { status: 404 });
  const company = (Array.isArray(emp.companies) ? emp.companies[0] : emp.companies) as { name?: string } | null;

  const now = new Date();
  const from = new Date(now.getTime() - 30 * 86400e3).toISOString().slice(0, 10);
  const to = new Date(now.getTime() + 120 * 86400e3).toISOString().slice(0, 10);
  const { data: shifts } = await admin.from("shifts")
    .select("id, date, start_time, end_time, locations(name), shift_types(name)")
    .eq("employee_id", emp.id).eq("published", true).gte("date", from).lte("date", to).order("date");

  const dtstamp = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}/, "");
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//VAKTO//Vaktir//IS", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    `X-WR-CALNAME:${esc(`Vaktir — ${company?.name ?? "VAKTO"}`)}`, "X-WR-TIMEZONE:Atlantic/Reykjavik",
    "REFRESH-INTERVAL;VALUE=DURATION:PT2H", "X-PUBLISHED-TTL:PT2H",
  ];
  for (const s of shifts ?? []) {
    const date = String(s.date).slice(0, 10);
    const start = String(s.start_time), end = String(s.end_time);
    const endDate = end.slice(0, 5) <= start.slice(0, 5) ? addDay(date) : date; // næturvakt
    const loc = (Array.isArray(s.locations) ? s.locations[0] : s.locations) as { name?: string } | null;
    const typ = (Array.isArray(s.shift_types) ? s.shift_types[0] : s.shift_types) as { name?: string } | null;
    lines.push(
      "BEGIN:VEVENT", `UID:${s.id}@vakto.is`, `DTSTAMP:${dtstamp}`,
      `DTSTART:${stamp(date, start)}`, `DTEND:${stamp(endDate, end)}`,
      `SUMMARY:${esc(typ?.name ? `Vakt · ${typ.name}` : "Vakt")}`,
      ...(loc?.name ? [`LOCATION:${esc(loc.name)}`] : []),
      "END:VEVENT",
    );
  }
  lines.push("END:VCALENDAR");
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/calendar; charset=utf-8",
      "Content-Disposition": 'inline; filename="vaktir.ics"',
      "Cache-Control": "private, max-age=900",
      "X-Robots-Tag": "noindex",
    },
  });
}
