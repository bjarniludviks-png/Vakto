// VAKTO — gervigögn demo-fyrirtækja. Sameiginlegt fyrir scripts/seed-demo.mjs,
// scripts/bootstrap-public-demo.mjs og næturkeyrsluna /api/cron/demo-reset.
// Hreint TS (engin @/-slóð, ekkert server-only) svo Node 24 flytji það beint inn (type stripping).
//
//   seedDemoData()   — rúllandi gluggi: birtar vaktir síðustu 4 vikur + næstu viku, stimplanir
//                      fyrir liðnar vaktir (nokkur heiðarleg frávik), dagleg velta (laun % ~28–34 %),
//                      spjall + fréttir. Þurrkar og sáir aðeins gluggann (idempotent).
//   ensureDemoBase() — grunnur OPNA demo-fyrirtækisins (staðir, deildir, stöður, vaktategundir,
//                      starfsfólk, rásir) eftir PUBLIC_DEMO. Endurkeyranlegt; lagar breytt gildi.

import type { SupabaseClient } from "@supabase/supabase-js";

type Db = SupabaseClient;
type Log = (msg: string) => void;

const pad = (n: number) => String(n).padStart(2, "0");
const iso = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const slug = (n: string) => n.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]+/g, ".").replace(/^\.|\.$/g, "");

/* ============================================================
   Grunnur opna demo-fyrirtækisins
   ============================================================ */

export const PUBLIC_DEMO_NOTE = "public-demo";
/** Netföng demo-fólks: lén sem tekur ekki við pósti — email.ts sendir aldrei þangað. */
export const DEMO_EMAIL_DOMAIN = "demo.vakto.is";

export const PUBLIC_DEMO = {
  company: {
    name: "Kaffi Sól", location: "Reykjavík", country: "IS", address: "Laugavegur 12", postal_code: "101", city: "Reykjavík",
    plan: "vakto", billing_status: "free", card_required: false, ai_addon: false,
    geofence_mode: "off", labor_target: 30, feed_post_policy: "everyone", revenue_mode: "manual",
  },
  locations: ["Laugavegur", "Hafnartorg"],
  departments: [["Salur", "#e11d48"], ["Eldhús", "#0891b2"], ["Bakarí", "#ca8a04"]] as [string, string][],
  positions: [["Þjónn", 2900], ["Kokkur", 3100], ["Bakari", 3200], ["Vaktstjóri", 3400]] as [string, number][],
  shiftTypes: [
    { name: "Dagvakt", start_time: "07:00", end_time: "15:00", premium_pct: 0, premium_label: "Dagvinna", color: "#16a34a", bg: "#16a34a1f", border: "#16a34a59" },
    { name: "Kvöldvakt", start_time: "15:00", end_time: "23:00", premium_pct: 33, premium_label: "+33% álag", color: "#b06a12", bg: "#fff2e2", border: "#fbe2c4" },
  ],
  // [nafn, staður, deild, staða, litur, hlutfall %]
  staff: [
    ["Anna Björk Sigurðardóttir", 0, "Salur", "Vaktstjóri", "#e11d48", 100],
    ["Davíð Örn Jónsson", 0, "Eldhús", "Kokkur", "#0891b2", 100],
    ["Lóa Sif Pálsdóttir", 0, "Salur", "Þjónn", "#9333ea", 80],
    ["Mína Huong", 0, "Eldhús", "Kokkur", "#5b50e6", 100],
    ["Ha Vu", 0, "Eldhús", "Kokkur", "#18a06a", 60],
    ["Moon Park", 0, "Salur", "Þjónn", "#2563eb", 50],
    ["Fannar Freyr Ólafsson", 0, "Salur", "Þjónn", "#ca8a04", 100],
    ["Dalya Karim", 0, "Eldhús", "Kokkur", "#c2410c", 80],
    ["Kristín Lilja Hauksdóttir", 1, "Bakarí", "Bakari", "#db2777", 100],
    ["Tomasz Nowak", 1, "Bakarí", "Bakari", "#0d9488", 100],
    ["Guðrún Ýr Einarsdóttir", 1, "Salur", "Þjónn", "#7c3aed", 70],
    ["Jakub Kowalski", 1, "Salur", "Þjónn", "#65a30d", 50],
  ] as [string, number, string, string, string, number][],
  channels: [["Almennt", "general"], ["Eldhús-teymið", "group"]] as [string, string][],
};

export type DemoBase = { locations: string[]; departments: Record<string, string>; positions: Record<string, string>; employees: string[]; staffNames: string[] };

async function one(db: Db, table: string, match: Record<string, unknown>, row: Record<string, unknown> = {}): Promise<string> {
  let q = db.from(table).select("id");
  for (const [k, v] of Object.entries(match)) q = q.eq(k, v as string);
  const ex = (await q.limit(1)).data?.[0];
  if (ex) {
    if (Object.keys(row).length) await db.from(table).update(row).eq("id", ex.id);
    return ex.id as string;
  }
  const { data, error } = await db.from(table).insert({ ...match, ...row }).select("id").single();
  if (error) throw new Error(`${table}: ${error.message}`);
  return data.id as string;
}

/** Stofnar/lagar grunn opna demo-fyrirtækisins. ownerId: eigandinn (fyrir rásir). */
export async function ensureDemoBase(db: Db, companyId: string, ownerId: string | null): Promise<DemoBase> {
  const C = companyId, P = PUBLIC_DEMO;
  const locations: string[] = [];
  for (const name of P.locations) locations.push(await one(db, "locations", { company_id: C, name }, { timezone: "Atlantic/Reykjavik" }));
  const departments: Record<string, string> = {};
  for (const [name, color] of P.departments) departments[name] = await one(db, "departments", { location_id: locations[name === "Bakarí" ? 1 : 0], name }, { color });
  const positions: Record<string, string> = {};
  for (const [name, base_rate] of P.positions) positions[name] = await one(db, "positions", { company_id: C, name }, { base_rate });
  for (const st of P.shiftTypes) { const { name, ...rest } = st; await one(db, "shift_types", { company_id: C, name }, rest); }

  const employees: string[] = [];
  for (const [full_name, loc, dept, pos, avatar_color, ratio] of P.staff) {
    const rate = P.positions.find(([n]) => n === pos)?.[1] ?? 2900;
    employees.push(await one(db, "employees", { company_id: C, full_name }, {
      location_id: locations[loc], department_id: departments[dept], position_id: positions[pos], avatar_color,
      pay_type: "hourly", rate, employment_ratio: ratio, union_agreement: "Efling", role: pos === "Vaktstjóri" ? "manager" : "employee",
      status: "active", hire_date: "2025-03-01", email: `${slug(full_name)}@${DEMO_EMAIL_DOMAIN}`,
    }));
  }
  for (const [name, kind] of P.channels) {
    const id = await one(db, "channels", { company_id: C, name }, { kind, ...(ownerId ? { created_by: ownerId } : {}) });
    if (ownerId) await db.from("channel_members").upsert({ channel_id: id, user_id: ownerId });
  }
  return { locations, departments, positions, employees, staffNames: P.staff.map(([n]) => n) };
}

/* ============================================================
   Rúllandi gervigögn (sama saga og scripts/seed-demo.mjs sáði áður)
   ============================================================ */

export type SeedOptions = { now?: Date; emailDomain?: string; log?: Log };
export type SeedSummary = { shifts: number; punches: number; revenueDays: number; staff: number; messages: number };

type Emp = { id: string; full_name: string; location_id: string | null };
type ShiftRow = { company_id: string; location_id: string; employee_id: string; shift_type_id: string | null; date: string; start_time: string; end_time: string; status: string; published: boolean };

export async function seedDemoData(db: Db, companyId: string, opts: SeedOptions = {}): Promise<SeedSummary> {
  const COMPANY = companyId, log = opts.log ?? (() => {});
  const emailDomain = opts.emailDomain ?? "vakto.is";
  // Ákvörðunarbundin slembitala svo endurkeyrslur segi sömu sögu.
  let seed = 42; const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };

  const now = opts.now ?? new Date();
  const today = new Date(now); today.setHours(0, 0, 0, 0);
  const from = addDays(today, -28), to = addDays(today, 7);

  const { data: company } = await db.from("companies").select("id, name").eq("id", COMPANY).maybeSingle();
  if (!company) throw new Error(`Fyrirtæki fannst ekki: ${COMPANY}`);
  const { data: empRows } = await db.from("employees").select("id, full_name, location_id, status")
    .eq("company_id", COMPANY).in("status", ["active", "over_ratio"]).order("full_name");
  const emps = (empRows ?? []) as Emp[];
  if (!emps.length) throw new Error(`Engir virkir starfsmenn í ${company.name}`);
  const { data: locRows } = await db.from("locations").select("id").eq("company_id", COMPANY).order("created_at");
  const locs = (locRows ?? []).map((l) => l.id as string);
  if (!locs.length) throw new Error("Engin staðsetning — stofnaðu stað í Stillingum fyrst");
  const { data: types } = await db.from("shift_types").select("id, name").eq("company_id", COMPANY);
  const day = types?.find((t) => /dag|morg/i.test(t.name as string)) ?? null;
  const eve = types?.find((t) => /kvöld|kvold|eve/i.test(t.name as string)) ?? null;

  // Hópar per stað (aðalstaður fullt mynstur, aðrir minna). Starfsmaður án staðar → aðalstaður.
  const groups = locs.map((id, i) => ({ id, primary: i === 0, staff: emps.filter((e) => (e.location_id ?? locs[0]) === id).slice(0, 8) }))
    .filter((g) => g.staff.length >= 3);
  if (!groups.length) groups.push({ id: locs[0], primary: true, staff: emps.slice(0, 8) });
  const staffCount = groups.reduce((n, g) => n + g.staff.length, 0);

  // ---- þurrka gluggann
  const fromISO = iso(from), toISO = iso(to);
  await db.from("punches").delete().eq("company_id", COMPANY).gte("clock_in", fromISO).lte("clock_in", toISO + "T23:59:59");
  await db.from("shifts").delete().eq("company_id", COMPANY).gte("date", fromISO).lte("date", toISO);
  await db.from("revenue").delete().in("location_id", locs).gte("date", fromISO).lte("date", toISO);

  // ---- vaktir: lítið kaffihús. Virkir dagar 2 dag + 1 mið + 2 kvöld, helgar 3 + 1 + 3 (aukastaðir minna).
  const shifts: (ShiftRow & { _kind: string })[] = [];
  const revenue: { location_id: string; date: string; amount: number; source: string }[] = [];
  const PATTERNS: Record<string, [string, string]> = { day: ["07:00", "15:00"], mid: ["10:00", "18:00"], eve: ["15:00", "23:00"] };
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const dateISO = iso(d), wd = d.getDay(); // 0=sun
    const weekend = wd === 0 || wd === 6;
    for (const g of groups) {
      const nDay = g.primary ? (weekend ? 3 : 2) : (weekend ? 2 : 1), nMid = g.primary ? 1 : (weekend ? 0 : 1), nEve = g.primary ? (weekend ? 3 : 2) : (weekend ? 2 : 1);
      // róterum svo allir fái frídaga
      const offset = Math.floor((d.getTime() - from.getTime()) / 864e5) % g.staff.length;
      const rota = [...g.staff.slice(offset), ...g.staff.slice(0, offset)];
      const plan: [Emp, string][] = [
        ...rota.slice(0, nDay).map((e): [Emp, string] => [e, "day"]),
        ...rota.slice(nDay, nDay + nMid).map((e): [Emp, string] => [e, "mid"]),
        ...rota.slice(nDay + nMid, nDay + nMid + nEve).map((e): [Emp, string] => [e, "eve"]),
      ];
      for (const [e, kind] of plan) {
        const [st, en] = PATTERNS[kind];
        shifts.push({ company_id: COMPANY, location_id: g.id, employee_id: e.id, shift_type_id: kind === "eve" ? (eve?.id as string) ?? null : (day?.id as string) ?? null,
          date: dateISO, start_time: st, end_time: en, status: "published", published: true, _kind: kind });
      }
      // velta liðinna daga (og í dag hingað til): helgar sterkari
      if (d <= today) {
        const base = (weekend ? 640_000 : 460_000) * (g.primary ? 1 : 0.55);
        const amount = Math.round((base * (0.88 + rnd() * 0.24)) / 1000) * 1000;
        revenue.push({ location_id: g.id, date: dateISO, amount: d.getTime() === today.getTime() ? Math.round(amount * 0.55) : amount, source: "manual" });
      }
    }
  }

  // ---- stimplanir fyrir liðnar vaktir, með nokkrum heiðarlegum frávikum
  const todayISO = iso(today), yesterdayISO = iso(addDays(today, -1)), weekAgoISO = iso(addDays(today, -7));
  const nowMin = now.getHours() * 60 + now.getMinutes();
  const punchRows: Record<string, unknown>[] = [];
  let forgot = false;
  for (const s of shifts) {
    if (s.date > todayISO) continue;
    const [sh, sm] = s.start_time.split(":").map(Number), [eh, em] = s.end_time.split(":").map(Number);
    const startMin = sh * 60 + sm, endMin = eh * 60 + em;
    const r = rnd();
    let inMin = startMin + Math.round((rnd() - 0.5) * 8);      // ±4 mín
    let outMin = endMin + Math.round((rnd() - 0.5) * 8);
    if (r < 0.08) inMin = startMin + 18 + Math.round(rnd() * 25);          // seint
    else if (r < 0.14) outMin = endMin - 25 - Math.round(rnd() * 30);      // fór snemma
    else if (r < 0.24) outMin = endMin + 70 + Math.round(rnd() * 80);      // yfirvinna
    const ts = (min: number) => { const d0 = new Date(`${s.date}T00:00:00Z`); d0.setUTCMinutes(min); return d0.toISOString(); };
    let clockOut: string | null = ts(outMin);
    if (s.date === todayISO) {
      if (inMin > nowMin) continue;           // ekki byrjuð
      if (outMin > nowMin) clockOut = null;   // enn á vakt
    }
    // ein gleymd útstimplun í gær (kvöldvakt) — klassíska frávikið
    if (!forgot && s.date === yesterdayISO && s._kind === "eve") { forgot = true; clockOut = null; }
    punchRows.push({ company_id: COMPANY, employee_id: s.employee_id, clock_in: ts(inMin), clock_out: clockOut, source: rnd() < 0.85 ? "kiosk" : "web", approved: s.date < weekAgoISO });
  }

  const shiftRows: ShiftRow[] = shifts.map(({ _kind, ...rest }) => { void _kind; return rest; });
  const ins = async (table: string, rows: Record<string, unknown>[]) => {
    for (let i = 0; i < rows.length; i += 500) {
      const { error } = await db.from(table).insert(rows.slice(i, i + 500));
      if (error) throw new Error(`${table}: ${error.message}`);
    }
  };
  await ins("shifts", shiftRows);
  // punches.approved þarf 0008; án hennar sleppt
  try { await ins("punches", punchRows); } catch { await ins("punches", punchRows.map(({ approved, ...p }) => { void approved; return p; })); }
  await ins("revenue", revenue);
  // meðalvelta vikudaga svo dagar án raða áætlist skynsamlega
  await db.from("companies").update({ weekday_revenue: { 0: 640000, 1: 440000, 2: 450000, 3: 470000, 4: 480000, 5: 560000, 6: 660000 } }).eq("id", COMPANY);
  log(`${company.name}: ${shiftRows.length} vaktir, ${punchRows.length} stimplanir, ${revenue.length} veltudagar (${fromISO} → ${toISO}), ${staffCount} starfsmenn`);

  // ---- spjall + fréttir: nokkrir starfsmenn tengdir demo-notendum (bólur frá alvöru fólki).
  const staff = groups[0].staff;
  const owner = (await db.from("users").select("id").eq("company_id", COMPANY).eq("role", "owner").limit(1)).data?.[0]?.id as string | undefined;
  const demoUsers: { uid: string; name: string }[] = [];
  for (const e of staff.slice(0, 4)) {
    let uid = (await db.from("employees").select("user_id").eq("id", e.id).maybeSingle()).data?.user_id as string | undefined;
    if (!uid) {
      const email = `demo.${slug(e.full_name)}@${emailDomain}`;
      const found = (await db.auth.admin.listUsers({ perPage: 1000 })).data?.users?.find((u) => u.email === email);
      uid = found?.id;
      if (!uid) {
        const pw = "Demo-" + Math.random().toString(36).slice(2, 10) + "!" + Math.random().toString(36).slice(2, 8);
        const { data, error } = await db.auth.admin.createUser({ email, password: pw, email_confirm: true, user_metadata: { full_name: e.full_name, role: "employee", company_id: COMPANY } });
        if (error) { log(`createUser ${email}: ${error.message}`); continue; }
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
  const at = (daysAgo: number, hm: string) => { const d = addDays(today, -daysAgo); const [h, m] = hm.split(":").map(Number); d.setHours(h, m, 0, 0); return d.toISOString(); };
  const u = (i: number) => demoUsers[i]?.uid ?? owner;
  const first = (i: number) => (demoUsers[i]?.name ?? "").split(" ")[0];
  const convo: [typeof general, string | undefined, number, string, string][] = [
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
  let messages = 0;
  if (general) {
    await db.from("messages").delete().eq("company_id", COMPANY).gte("created_at", addDays(today, -3).toISOString());
    const rows = convo.filter(([c]) => c).map(([c, sender, dAgo, hm, body]) => ({ company_id: COMPANY, channel_id: c!.id, sender_id: sender, body, kind: "text", created_at: at(dAgo, hm) }));
    const { error } = await db.from("messages").insert(rows); if (error) log(`messages: ${error.message}`); else messages = rows.length;
    await db.from("posts").delete().eq("company_id", COMPANY).gte("created_at", addDays(today, -3).toISOString());
    const { error: pe } = await db.from("posts").insert([
      { company_id: COMPANY, sender_id: owner, body: `Nýr matseðill fer í loftið á fimmtudag. Handbókin er uppfærð — lesið kaflann „Ofnæmisvaldar" og staðfestið lesturinn í appinu fyrir miðvikudag.`, pinned: true, created_at: at(1, "09:30") },
      { company_id: COMPANY, sender_id: u(1), body: `Takk fyrir helgina öll — metsala á laugardag og laun % af veltu 29,4 %. Vel gert!`, pinned: false, created_at: at(2, "10:05") },
    ]); if (pe) log(`posts: ${pe.message}`);
    log(`spjall: ${messages} skilaboð, 2 fréttir, ${demoUsers.length} demo-notendur tengdir`);
  }

  return { shifts: shiftRows.length, punches: punchRows.length, revenueDays: revenue.length, staff: staffCount, messages };
}

/** Nokkrar opnar beiðnir svo „Beiðnir"-spjaldið sé lifandi (aðeins opna demóið). Þolir að dálka vanti. */
export async function seedDemoRequests(db: Db, companyId: string, now = new Date(), log: Log = () => {}): Promise<void> {
  const { data: emps } = await db.from("employees").select("id").eq("company_id", companyId).eq("status", "active").order("full_name").limit(6);
  const e = (emps ?? []).map((r) => r.id as string);
  if (e.length < 4) return;
  const d = (n: number) => iso(addDays(now, n));
  const { error } = await db.from("leave_requests").insert([
    { company_id: companyId, employee_id: e[1], type: "orlof", from_date: d(12), to_date: d(16), status: "pending" },
    { company_id: companyId, employee_id: e[3], type: "veikindi", from_date: d(-2), to_date: d(-1), status: "approved" },
  ]);
  if (error) log(`leave_requests: ${error.message}`);
  const { error: se } = await db.from("shift_swaps").insert({ company_id: companyId, requester_id: e[2], requestee_id: e[4], note: "laugardagur 15–23", status: "pending" });
  if (se) log(`shift_swaps: ${se.message}`);
}
