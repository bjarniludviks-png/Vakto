// VAKTO — refreshes the ONE seeded demo company ("Kaffi Krónan" on staging) with
// a realistic rolling window of data: published shifts for the last 4 weeks and
// the coming week, punches for past shifts (a few honest anomalies: late, left
// early, overtime, one forgotten clock-out), and daily revenue so laun % af veltu
// lands around 28–34 %. Idempotent: wipes and re-seeds only that window.
//
//   node scripts/seed-demo.mjs            # uses .env.local (service role)
//   node scripts/seed-demo.mjs --company <uuid>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Vantar NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const db = createClient(url, service, { auth: { persistSession: false } });

const argCo = process.argv.indexOf("--company");
const COMPANY = argCo > 0 ? process.argv[argCo + 1] : (process.env.DEMO_COMPANY_ID || "00000000-0000-0000-0000-0000000000c0");

const pad = (n) => String(n).padStart(2, "0");
const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d, n) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
// Deterministic pseudo-random so re-runs produce the same story.
let seed = 42; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
const pick = (arr) => arr[Math.floor(rnd() * arr.length)];

const today = new Date(); today.setHours(0, 0, 0, 0);
const from = addDays(today, -28), to = addDays(today, 7);

const { data: company } = await db.from("companies").select("id, name").eq("id", COMPANY).maybeSingle();
if (!company) { console.error("Fyrirtæki fannst ekki:", COMPANY); process.exit(1); }
const { data: emps } = await db.from("employees").select("id, full_name, pay_type, rate, status")
  .eq("company_id", COMPANY).in("status", ["active", "over_ratio"]).order("full_name");
if (!emps?.length) { console.error("Engir virkir starfsmenn í", company.name); process.exit(1); }
const { data: locs } = await db.from("locations").select("id").eq("company_id", COMPANY).order("created_at").limit(1);
const locationId = locs?.[0]?.id;
if (!locationId) { console.error("Engin staðsetning — stofnaðu stað í Stillingum fyrst"); process.exit(1); }
const { data: types } = await db.from("shift_types").select("id, name, start_time, end_time").eq("company_id", COMPANY);
const day = types?.find((t) => /dag|morg/i.test(t.name)) ?? null;
const eve = types?.find((t) => /kvöld|kvold|eve/i.test(t.name)) ?? null;

// ---- wipe the window
const fromISO = iso(from), toISO = iso(to);
await db.from("punches").delete().eq("company_id", COMPANY).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59");
await db.from("shifts").delete().eq("company_id", COMPANY).gte("date", fromISO).lte("date", toISO);
await db.from("revenue").delete().eq("location_id", locationId).gte("date", fromISO).lte("date", toISO);

// ---- shifts: a small café pattern. Weekdays 3 day + 2 evening, weekends 4 + 3.
const staff = emps.slice(0, 8);
const shifts = [], punches = [], revenue = [];
const PATTERNS = { day: ["07:00", "15:00"], mid: ["10:00", "18:00"], eve: ["15:00", "23:00"] };
for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
  const dateISO = iso(d), wd = d.getDay(); // 0=Sun
  const weekend = wd === 0 || wd === 6;
  const nDay = weekend ? 3 : 2, nMid = 1, nEve = weekend ? 3 : 2;
  // rotate who works so everyone gets days off
  const offset = Math.floor((d - from) / 864e5) % staff.length;
  const rota = [...staff.slice(offset), ...staff.slice(0, offset)];
  const plan = [
    ...rota.slice(0, nDay).map((e) => [e, "day"]),
    ...rota.slice(nDay, nDay + nMid).map((e) => [e, "mid"]),
    ...rota.slice(nDay + nMid, nDay + nMid + nEve).map((e) => [e, "eve"]),
  ];
  for (const [e, kind] of plan) {
    const [st, en] = PATTERNS[kind];
    shifts.push({ company_id: COMPANY, location_id: locationId, employee_id: e.id, shift_type_id: kind === "eve" ? eve?.id ?? null : day?.id ?? null,
      date: dateISO, start_time: st, end_time: en, status: "published", published: true, _kind: kind, _emp: e.id });
  }
  // revenue for past days (and today so far): weekends stronger
  if (d <= today) {
    const base = weekend ? 640_000 : 460_000;
    const amount = Math.round((base * (0.88 + rnd() * 0.24)) / 1000) * 1000;
    revenue.push({ location_id: locationId, date: dateISO, amount: d.getTime() === today.getTime() ? Math.round(amount * 0.55) : amount, source: "manual" });
  }
}

// ---- punches for past shifts, with a few honest deviations
const yesterdayISO = iso(addDays(today, -1));
for (const s of shifts) {
  if (s.date > iso(today)) continue;
  const isToday = s.date === iso(today);
  const [sh, sm] = s.start_time.split(":").map(Number), [eh, em] = s.end_time.split(":").map(Number);
  const startMin = sh * 60 + sm, endMin = eh * 60 + em;
  const r = rnd();
  let inMin = startMin + Math.round((rnd() - 0.5) * 8);      // ±4 min
  let outMin = endMin + Math.round((rnd() - 0.5) * 8);
  if (r < 0.08) inMin = startMin + 18 + Math.round(rnd() * 25);   // late
  else if (r < 0.14) outMin = endMin - 25 - Math.round(rnd() * 30); // left early
  else if (r < 0.24) outMin = endMin + 70 + Math.round(rnd() * 80); // overtime
  // minutes → ISO on the shift date, rolling past midnight when needed
  const ts = (min) => { const d0 = new Date(`${s.date}T00:00:00Z`); d0.setUTCMinutes(min); return d0.toISOString(); };
  const clockIn = ts(inMin);
  let clockOut = ts(outMin);
  const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
  if (isToday) {
    if (inMin > nowMin) continue;            // hasn't started yet
    if (outMin > nowMin) clockOut = null;    // still on shift
  }
  // one forgotten clock-out yesterday (evening shift) — the classic anomaly
  if (s.date === yesterdayISO && s._kind === "eve" && !punches.some((p) => p._forgot)) { clockOut = null; punches.push({ _forgot: true }); }
  punches.push({ company_id: COMPANY, employee_id: s._emp, clock_in: clockIn, clock_out: clockOut, source: rnd() < 0.85 ? "kiosk" : "web", approved: s.date < iso(addDays(today, -7)) });
}
const punchRows = punches.filter((p) => !p._forgot);

const shiftRows = shifts.map(({ _kind, _emp, ...rest }) => rest);
const ins = async (table, rows) => { const { error } = await db.from(table).insert(rows); if (error) { console.error(table, error.message); process.exit(1); } };
await ins("shifts", shiftRows);
// punches.approved needs migration 0008; fall back without it
{ const { error } = await db.from("punches").insert(punchRows); if (error) { await ins("punches", punchRows.map(({ approved, ...p }) => p)); } }
await ins("revenue", revenue);
// weekday averages so days without a row are estimated sensibly
await db.from("companies").update({ weekday_revenue: { 0: 640000, 1: 440000, 2: 450000, 3: 470000, 4: 480000, 5: 560000, 6: 660000 } }).eq("id", COMPANY);

console.log(`${company.name}: ${shiftRows.length} vaktir, ${punchRows.length} stimplanir, ${revenue.length} veltudagar (${fromISO} → ${toISO}), ${staff.length} starfsmenn`);
