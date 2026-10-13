// VAKTO — prufuaðgangar fyrir App Review (Apple/Google): einn starfsmaður og einn vaktstjóri
// í prufufyrirtækinu. Má keyra aftur — finnur þá aðgangana og setur ný lykilorð.
//
//   node scripts/setup-app-review.mjs [env-skrá] [nafn eða auðkenni fyrirtækis]
//   sjálfgefið: ../vakto/.env.local.PROD-BACKUP  "Kaffi Krónan"
//
// Lykilorðin eru ALDREI prentuð — þau fara í ~/.vakto-app-review.txt (aðeins læsileg þér).
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { homedir } from "node:os";
import { join } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envFile = process.argv[2] || "../vakto/.env.local.PROD-BACKUP";
const companyName = process.argv[3] || "Kaffi Krónan";
const env = {};
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const url = env.NEXT_PUBLIC_SUPABASE_URL;
const service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error(`Vantar NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY í ${envFile}`); process.exit(1); }
const ref = url.match(/https:\/\/([a-z0-9]+)\./)?.[1];
console.log(`Gagnagrunnur: ${ref}${ref === "lsnthbnqcelfgeyuxgfn" ? " (PROD)" : ref === "aptpckmrqepvcqhgkjoo" ? " (staging)" : ""}`);

const db = createClient(url, service, { auth: { persistSession: false } });
const die = (msg) => { console.error(msg); process.exit(1); };

// Annað viðfangið má vera nafn EÐA auðkenni (uuid) fyrirtækis.
const isId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(companyName);
const base = db.from("companies").select("id, name, created_at");
const { data: companies, error: coErr } = await (isId ? base.eq("id", companyName) : base.ilike("name", companyName));
if (coErr) die(coErr.message);
if (companies.length !== 1) {
  console.error(`Fann ${companies.length} fyrirtæki sem heita „${companyName}“.`);
  for (const c of companies) {
    const n = async (t, extra = (q) => q) => (await extra(db.from(t).select("*", { count: "exact", head: true }).eq("company_id", c.id))).count ?? "?";
    const soon = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
    console.error(`  ${c.id}  stofnað ${String(c.created_at).slice(0, 10)} · ${await n("users")} notendur · ${await n("employees")} starfsmenn · ${await n("posts")} færslur · ${await n("shifts", (q) => q.gte("date", new Date().toISOString().slice(0, 10)).lte("date", soon))} vaktir næstu 7 daga`);
  }
  die(`Keyrðu aftur með auðkenninu:  node scripts/setup-app-review.mjs ${envFile} <auðkenni>`);
}
const company = companies[0];
console.log(`Fyrirtæki: ${company.name}`);

// 20 stafa handahófskennt lykilorð (stenst 12+ og lekaathugun Supabase).
const password = () => randomBytes(15).toString("base64url");

const ACCOUNTS = [
  { key: "Starfsmaður", email: "appreview.starfsmadur@vakto.is", name: "Anna Prufa", role: "employee", title: "Þjónn" },
  { key: "Vaktstjóri", email: "appreview.vaktstjori@vakto.is", name: "Jón Prufa", role: "manager", title: "Vaktstjóri" },
];

async function findAuthUser(email) {
  for (let page = 1; page <= 20; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 200 });
    if (error) die(error.message);
    const hit = data.users.find((u) => (u.email ?? "").toLowerCase() === email);
    if (hit) return hit.id;
    if (data.users.length < 200) return null;
  }
  return null;
}

const lines = [`VAKTO — prufuaðgangar fyrir App Review (${company.name}, ${ref})`, `Búið til ${new Date().toISOString()}`, ""];
for (const a of ACCOUNTS) {
  const pw = password();
  let userId = await findAuthUser(a.email);
  if (userId) {
    const { error } = await db.auth.admin.updateUserById(userId, { password: pw, email_confirm: true });
    if (error) die(`${a.email}: ${error.message}`);
    console.log(`${a.key}: aðgangur var til — nýtt lykilorð sett`);
  } else {
    const { data, error } = await db.auth.admin.createUser({
      email: a.email, password: pw, email_confirm: true,
      user_metadata: { full_name: a.name, role: a.role, company_id: company.id },
    });
    if (error) die(`${a.email}: ${error.message}`);
    userId = data.user.id;
    console.log(`${a.key}: aðgangur stofnaður`);
  }

  // public.users (trigger býr röðina til) + aðild að fyrirtækinu.
  const profile = { company_id: company.id, role: a.role, full_name: a.name };
  const { data: updated, error: uErr } = await db.from("users").update(profile).eq("id", userId).select("id");
  if (uErr) die(uErr.message);
  if (!updated.length) {
    const { error } = await db.from("users").insert({ id: userId, email: a.email, ...profile });
    if (error) die(error.message);
  }
  const { error: mErr } = await db.from("company_members").upsert({ user_id: userId, company_id: company.id, role: a.role });
  if (mErr) console.log(`  (aðild ekki skráð: ${mErr.message})`);

  // Starfsmannaprófíll — án hans er appið tómt (vaktir, stimplun, laun).
  const { data: emp } = await db.from("employees").select("id").eq("company_id", company.id).eq("user_id", userId).maybeSingle();
  if (!emp) {
    const { error } = await db.from("employees").insert({
      company_id: company.id, user_id: userId, full_name: a.name, email: a.email, title: a.title, role: a.role, status: "active",
      hire_date: new Date().toISOString().slice(0, 10),
    });
    if (error) die(`starfsmannaprófíll ${a.email}: ${error.message}`);
    console.log("  starfsmannaprófíll stofnaður");
  }
  lines.push(`${a.key}`, `  netfang:  ${a.email}`, `  lykilorð: ${pw}`, "");
}

const out = join(homedir(), ".vakto-app-review.txt");
writeFileSync(out, lines.join("\n"), { mode: 0o600 });
console.log(`\nLykilorð vistuð í ${out}`);

// Lítur prufufyrirtækið út fyrir að vera í notkun? (Apple vill sjá efni, ekki tóma skjái.)
const today = new Date().toISOString().slice(0, 10);
const week = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
const count = async (table, build) => {
  const { count: n, error } = await build(db.from(table).select("*", { count: "exact", head: true }).eq("company_id", company.id));
  return error ? `? (${error.message})` : n;
};
console.log("\nEfni í prufufyrirtækinu:");
console.log(`  starfsmenn:              ${await count("employees", (q) => q)}`);
console.log(`  vaktir næstu 7 daga:     ${await count("shifts", (q) => q.gte("date", today).lte("date", week))}`);
console.log(`  færslur í fréttaveitu:   ${await count("posts", (q) => q)}`);
console.log(`  spjallrásir:             ${await count("channels", (q) => q)}`);
console.log("\nNýju aðgangarnir eiga engar vaktir enn — settu þá á vaktir í Vaktaplani áður en upptakan er tekin.");
