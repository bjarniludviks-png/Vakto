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

// ---------------------------------------------------------------------------
// Team chat + news: link a few employees to demo auth users (so bubbles come
// from real people) and seed a short, realistic conversation + one news post.
// Idempotent: replaces this week's seeded messages/posts only.
// ---------------------------------------------------------------------------
const owner = (await db.from("users").select("id").eq("company_id", COMPANY).eq("role", "owner").limit(1)).data?.[0]?.id;
const slug = (n) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");
const demoUsers = [];
for (const e of staff.slice(0, 4)) {
  let uid = (await db.from("employees").select("user_id").eq("id", e.id).maybeSingle()).data?.user_id;
  if (!uid) {
    const email = `demo.${slug(e.full_name)}@vakto.is`;
    const found = (await db.auth.admin.listUsers({ perPage: 200 })).data?.users?.find((u) => u.email === email);
    uid = found?.id;
    if (!uid) {
      const pw = "Demo-" + Math.random().toString(36).slice(2, 10) + "!";
      const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: e.full_name, role: "employee", company_id: COMPANY } });
      if (error) { console.error("createUser", email, error.message); continue; }
      uid = data.user.id;
    }
    await db.from("users").upsert({ id: uid, email, full_name: e.full_name, role: "employee", company_id: COMPANY });
    await db.from("employees").update({ user_id: uid }).eq("id", e.id);
  }
  demoUsers.push({ uid, name: e.full_name });
}
const chans = (await db.from("channels").select("id, name, kind").eq("company_id", COMPANY)).data ?? [];
const general = chans.find((c) => c.kind === "general");
const group = chans.find((c) => c.kind === "group");
for (const c of chans) for (const u of demoUsers) await db.from("channel_members").upsert({ channel_id: c.id, user_id: u.uid });
const at = (daysAgo, hm) => { const d = addDays(today, -daysAgo); const [h, m] = hm.split(":").map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
const u = (i) => demoUsers[i]?.uid ?? owner;
const first = (i) => (demoUsers[i]?.name ?? "").split(" ")[0];
const convo = [
  [general, u(0), 1, "16:05", `Getur einhver tekið laugardagsvaktina mína 15–23? Er komin með flensu.`],
  [general, u(1), 1, "16:09", `Ég get það — er laus á laugardaginn.`],
  [general, u(0), 1, "16:10", `Takk ${first(1)}, þú ert bjargvættur!`],
  [general, owner, 1, "16:22", `Búinn að samþykkja vaktaskiptin, planið er uppfært. Góðan bata ${first(0)}.`],
  [general, u(2), 0, "08:14", `Mjólkin er að klárast — panta ég í dag?`],
  [general, owner, 0, "08:16", `Já takk, tvo kassa. Og minnið á nýja matseðilinn sem fer í loftið á fimmtudag.`],
  [group, u(2), 2, "14:40", `Súpan í dag er sætkartöflu — uppskriftin er í handbókinni undir „Súpur".`],
  [group, u(3), 2, "14:41", `Frábært, hvað gerum við margar skammta?`],
  [group, u(2), 2, "14:43", `40 skammta, það seldist upp síðast.`],
];
if (general) {
  await db.from("messages").delete().eq("company_id", COMPANY).gte("created_at", addDays(today, -3).toISOString());
  const rows = convo.filter(([c]) => c).map(([c, sender, dAgo, hm, body]) => ({ company_id: COMPANY, channel_id: c.id, sender_id: sender, body, kind: "text", created_at: at(dAgo, hm) }));
  const { error } = await db.from("messages").insert(rows); if (error) console.error("messages", error.message);
  await db.from("posts").delete().eq("company_id", COMPANY).gte("created_at", addDays(today, -3).toISOString());
  const { error: pe } = await db.from("posts").insert([
    { company_id: COMPANY, sender_id: owner, body: `Nýr matseðill fer í loftið á fimmtudag. Handbókin er uppfærð — lesið kaflann „Ofnæmisvaldar" og staðfestið lesturinn í appinu fyrir miðvikudag.`, pinned: true, created_at: at(1, "09:30") },
    { company_id: COMPANY, sender_id: u(1), body: `Takk fyrir helgina öll — metsala á laugardag og laun % af veltu 29,4 %. Vel gert!`, pinned: false, created_at: at(2, "10:05") },
  ]); if (pe) console.error("posts", pe.message);
  console.log(`spjall: ${rows.length} skilaboð, 2 fréttir, ${demoUsers.length} demo-notendur tengdir`);
}
