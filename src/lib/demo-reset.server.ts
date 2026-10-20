import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";
import { createAdminClient } from "@/lib/supabase/admin";
import { demoCompanyId } from "@/lib/demo.server";
import { PUBLIC_DEMO, PUBLIC_DEMO_NOTE, DEMO_EMAIL_DOMAIN, ensureDemoBase, seedDemoData, seedDemoRequests } from "@/lib/demo-seed";

// Næturendurstilling opna demo-fyrirtækisins (DEMO_COMPANY_ID) — /api/cron/demo-reset.
//
// 1. Öryggisnet: keyrir AÐEINS ef companies.admin_note = "public-demo" (bootstrap-public-demo.mjs).
// 2. Stillingar fyrirtækisins aftur á PUBLIC_DEMO (nafn, markmið, áskrift = free, engin AI-viðbót …).
// 3. Hendir öllu sem gestir bjuggu til: beiðnir, leiðréttingar, samningar, skjöl, launakeyrslur,
//    sniðmát, API-lyklar, tengingar, aðgerðaskrá, spjall/fréttir, push-áskriftir, AI-notkun.
// 4. Starfsfólk: aukafólk eytt, upprunalega fólkið virkt með sín gildi; aukastaðir/-deildir/-stöður út.
// 5. Allar vaktir/stimplanir/velta þurrkaðar og sáð upp á nýtt (demo-seed.ts) + nokkrar beiðnir.
// 6. Netfang + lykilorð demo-eigandans lagað EF innskráning með DEMO_LOGIN_* bregst (lykilorðsbreyting
//    hjá Supabase ógildir allar lotur — þ.e. alla gesti sem eru inni — svo aldrei að óþörfu).
//
// Frá 0087 er demoið aðeins til skoðunar (gestir geta ekkert skrifað — RLS, gikkur, server actions,
// þjónustulykill), svo meginhlutverk keyrslunnar er að sá gögnum með dagsetningum sem rúlla.
// Hreinsun gestagagna (3.–4.) er látin standa sem öryggisnet (t.d. eldri gögn eða ef vörn bilar).
// Takmörkun: breytingar á auth-lýsigögnum demo-notenda (supabase.auth.updateUser) ná ekki til RLS —
// lykilorð/netfang eigandans er lagað í lið 6 / demoLogin.

export type DemoResetResult = { ok: boolean; skipped?: string; seeded?: { shifts: number; punches: number; revenueDays: number }; removedEmployees?: number; warnings: string[] };

// Töflur með company_id sem gestir geta fyllt (röð: börn fyrst). Villur (tafla ekki til) eru hunsaðar.
const VISITOR_TABLES = [
  "shift_claims", "shift_tasks", "punch_corrections", "leave_requests", "shift_swaps", "availability", "timesheets",
  "contract_sign_codes", "contract_signatures", "contract_taktikal", "contracts", "documents",
  "payroll_runs", "rule_templates", "api_keys", "company_integrations", "integration_interest",
  "post_comments", "post_likes", "posts", "message_reactions", "messages", "noshow_alerts",
  "ai_conversations", "ai_usage", "push_subscriptions", "audit_log", "kiosk_fails", "content_reports",
];

export async function resetDemoCompany(): Promise<DemoResetResult> {
  const C = demoCompanyId();
  const warnings: string[] = [];
  if (!C) return { ok: true, skipped: "DEMO_COMPANY_ID ekki stillt", warnings };
  const db = createAdminClient();

  const { data: co } = await db.from("companies").select("id, admin_note").eq("id", C).maybeSingle();
  if (!co) return { ok: false, skipped: "Demo-fyrirtæki fannst ekki", warnings };
  if (co.admin_note !== PUBLIC_DEMO_NOTE) return { ok: false, skipped: `admin_note er ekki "${PUBLIC_DEMO_NOTE}" — endurstilli ekki`, warnings };

  const warn = (where: string, e: { message: string } | null) => { if (e) warnings.push(`${where}: ${e.message}`); };

  // ---- 2. stillingar fyrirtækisins
  const far = new Date(Date.now() + 3650 * 864e5).toISOString();
  const { error: coErr } = await db.from("companies").update({ ...PUBLIC_DEMO.company, trial_ends_at: far }).eq("id", C);
  warn("companies", coErr);
  // Stillingar sem gestir geta breytt (dálkar úr síðari migrations — sér uppfærsla svo ein vöntun felli ekki hinar).
  warn("companies extras", (await db.from("companies").update({
    billing_interval: "month", ai_addon_since: null, contract_terms: null,
    leave_cap: null, pay_defaults: null, pay_period_start: 1, staffing_targets: null, weekday_revenue_learned: false,
  }).eq("id", C)).error);
  warn("companies esign", (await db.from("companies").update({ esign_provider: "vakto" }).eq("id", C)).error);

  // ---- 3. gögn gesta
  for (const t of VISITOR_TABLES) {
    const { error } = await db.from(t).delete().eq("company_id", C);
    if (error && !/does not exist|schema cache|column/i.test(error.message)) warn(t, error);
  }
  // shifts/punches: allt út (gestir geta sett vaktir utan sáðgluggans)
  warn("punches", (await db.from("punches").delete().eq("company_id", C)).error);
  warn("shifts", (await db.from("shifts").delete().eq("company_id", C)).error);

  // ---- 4. grunnur + starfsfólk
  const { data: owners } = await db.from("users").select("id, email").eq("company_id", C).eq("role", "owner");
  const ownerId = (owners?.[0]?.id as string | undefined) ?? null;
  const base = await ensureDemoBase(db, C, ownerId);

  // Upprunalegt fólk + fólk tengt demo-spjallnotendum (seed) heldur; annað út.
  const { data: emps } = await db.from("employees").select("id, full_name").eq("company_id", C);
  const extra = (emps ?? []).filter((e) => !base.staffNames.includes(e.full_name as string)).map((e) => e.id as string);
  if (extra.length) warn("employees", (await db.from("employees").delete().in("id", extra)).error);

  const keep = async (table: string, ids: string[], scope: [string, string | string[]]) => {
    let q = db.from(table).delete().not("id", "in", `(${ids.join(",")})`);
    q = Array.isArray(scope[1]) ? q.in(scope[0], scope[1]) : q.eq(scope[0], scope[1]);
    warn(table, (await q).error);
  };
  const { data: locs } = await db.from("locations").select("id").eq("company_id", C);
  await keep("departments", Object.values(base.departments), ["location_id", (locs ?? []).map((l) => l.id as string)]);
  await keep("locations", base.locations, ["company_id", C]);
  await keep("positions", Object.values(base.positions), ["company_id", C]);
  const { data: types } = await db.from("shift_types").select("id, name").eq("company_id", C);
  const typeNames = PUBLIC_DEMO.shiftTypes.map((s) => s.name);
  const keepTypes = (types ?? []).filter((t) => typeNames.includes(t.name as string)).map((t) => t.id as string);
  if (keepTypes.length) await keep("shift_types", keepTypes, ["company_id", C]);

  // Rásir: aðeins upprunalegu rásirnar (skilaboð þeirra fóru út í skrefi 3).
  const { data: chans } = await db.from("channels").select("id, name").eq("company_id", C);
  const chanNames = PUBLIC_DEMO.channels.map(([n]) => n);
  const extraChans = (chans ?? []).filter((c) => !chanNames.includes(c.name as string)).map((c) => c.id as string);
  if (extraChans.length) warn("channels", (await db.from("channels").delete().in("id", extraChans)).error);

  // ---- 5. gervigögn. Velta: öll út — glugginn rúllar mánaðarlega og eldri raunvelta án launa
  // myndi annars sýna mánuði með veltu en 0 kr launakostnaði.
  const { data: seedLocs } = await db.from("locations").select("id").eq("company_id", C);
  const seedLocIds = (seedLocs ?? []).map((l) => l.id as string);
  if (seedLocIds.length) warn("revenue", (await db.from("revenue").delete().in("location_id", seedLocIds)).error);
  let seeded: DemoResetResult["seeded"];
  try {
    const s = await seedDemoData(db, C, { emailDomain: DEMO_EMAIL_DOMAIN, log: (m) => console.log("[demo-reset]", m) });
    seeded = { shifts: s.shifts, punches: s.punches, revenueDays: s.revenueDays };
    await seedDemoRequests(db, C, new Date(), (m) => warnings.push(m));
  } catch (e) {
    warnings.push(`seed: ${e instanceof Error ? e.message : String(e)}`);
  }

  // ---- 6. demo-eigandinn: netfang + lykilorð aftur á env (gestur gæti hafa breytt þeim gegnum Supabase)
  const email = process.env.DEMO_LOGIN_EMAIL, password = process.env.DEMO_LOGIN_PASSWORD;
  const owner = owners?.find((o) => (o.email as string | null)?.toLowerCase() === email?.toLowerCase());
  if (owner && email && password) {
    if (!(await demoLoginWorks(email, password))) {
      const { error } = await db.auth.admin.updateUserById(owner.id as string, { email, password, email_confirm: true, user_metadata: { full_name: "Demo Stjórnandi", role: "owner", company_id: C } });
      warn("owner auth", error);
    }
    warn("owner profile", (await db.from("users").update({ full_name: "Demo Stjórnandi", role: "owner", company_id: C }).eq("id", owner.id as string)).error);
  } else if (email) warnings.push("demo-eigandi með DEMO_LOGIN_EMAIL fannst ekki í fyrirtækinu");

  if (warnings.length) console.warn("[demo-reset]", warnings.join(" | "));
  return { ok: true, seeded, removedEmployees: extra.length, warnings };
}

/** Virkar demo-innskráningin óbreytt? (Prufulotunni er strax lokað — aðeins henni.) */
async function demoLoginWorks(email: string, password: string): Promise<boolean> {
  try {
    const anon = createSupabase(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { auth: { persistSession: false, autoRefreshToken: false } });
    const { error } = await anon.auth.signInWithPassword({ email, password });
    if (error) return false;
    await anon.auth.signOut({ scope: "local" });
    return true;
  } catch {
    return false;
  }
}
