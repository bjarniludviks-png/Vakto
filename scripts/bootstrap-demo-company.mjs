// VAKTO — stofnar sjálfstætt demo-fyrirtæki með gervigögnum og einum prófunarstarfsmanni
// (fyrir yfirferð App Store / Google Play). Snertir ENGIN önnur fyrirtæki.
//
//   node scripts/bootstrap-demo-company.mjs --out <skrá fyrir innskráningu>
//   ENV_FILE=~/vakto/.env.local.PROD-BACKUP node scripts/bootstrap-demo-company.mjs --prod --out <skrá>
//
// Endurkeyranlegt: finnur fyrirtækið á admin_note og endurnýtir það (lykilorð prófunaraðgangs endurstillt).
// Lykilorðið er aðeins skrifað í --out skrána, aldrei prentað.
import { readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

const args = process.argv.slice(2);
const arg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : undefined; };
const envFile = (process.env.ENV_FILE || ".env.local").replace(/^~/, process.env.HOME);
const env = {};
for (const line of readFileSync(envFile, "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*"?(.*?)"?\s*$/.exec(line);
  if (m) env[m[1]] = m[2];
}
const url = env.NEXT_PUBLIC_SUPABASE_URL, service = env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Vantar NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY í", envFile); process.exit(1); }
const isStaging = url.includes("aptpckmrqepvcqhgkjoo");
if (!isStaging && !args.includes("--prod")) { console.error("Þetta er ekki staging. Bættu við --prod til að staðfesta."); process.exit(1); }
const out = arg("--out");
if (!out) { console.error("Vantar --out <skrá>"); process.exit(1); }

const db = createClient(url, service, { auth: { persistSession: false } });
const NOTE = "app-review-demo";
const NAME = arg("--name") || "Kaffi Krónan";
const OWNER_EMAIL = arg("--owner") || "demo-eigandi@vakto.is";
const REVIEW_EMAIL = arg("--review") || "app-review@vakto.is";
const pw = () => "Vk-" + randomBytes(9).toString("base64url") + "-7a";
const die = (what, error) => { console.error(what, error?.message ?? error); process.exit(1); };

async function authUser(email, password, meta) {
  const list = (await db.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? [];
  const found = list.find((u) => u.email === email);
  if (found) {
    const { error } = await db.auth.admin.updateUserById(found.id, { password, email_confirm: true, user_metadata: meta });
    if (error) die("updateUser " + email, error);
    return found.id;
  }
  const { data, error } = await db.auth.admin.createUser({ email, password, email_confirm: true, user_metadata: meta });
  if (error) die("createUser " + email, error);
  return data.user.id;
}

// ---- fyrirtæki
let company = (await db.from("companies").select("id, name").eq("admin_note", NOTE).maybeSingle()).data;
if (!company) {
  const far = new Date(Date.now() + 3650 * 864e5).toISOString();
  const { data, error } = await db.from("companies").insert({
    name: NAME, location: "Reykjavík", country: "IS", address: "Laugavegur 1", postal_code: "101", city: "Reykjavík",
    plan: "vakto", trial_ends_at: far, billing_status: "free", card_required: false, admin_note: NOTE,
    geofence_mode: "off", labor_target: 30, feed_post_policy: "everyone", revenue_mode: "manual",
  }).select("id, name").single();
  if (error) die("companies", error);
  company = data;
}
const C = company.id;

// ---- eigandi (gervi) + grunnur
const ownerId = await authUser(OWNER_EMAIL, pw(), { full_name: "Jón Þór (demo)", role: "owner", company_id: C });
{ const { error } = await db.from("users").upsert({ id: ownerId, email: OWNER_EMAIL, full_name: "Jón Þór Demo", role: "owner", company_id: C }); if (error) die("users owner", error); }

const one = async (table, match, row) => {
  let q = db.from(table).select("id"); for (const [k, v] of Object.entries(match)) q = q.eq(k, v);
  const ex = (await q.limit(1)).data?.[0];
  if (ex) return ex.id;
  const { data, error } = await db.from(table).insert({ ...match, ...row }).select("id").single();
  if (error) die(table, error);
  return data.id;
};
const loc = await one("locations", { company_id: C, name: "Laugavegur" }, { timezone: "Atlantic/Reykjavik" });
const dSal = await one("departments", { location_id: loc, name: "Salur" }, { color: "#e11d48" });
const dEld = await one("departments", { location_id: loc, name: "Eldhús" }, { color: "#0891b2" });
const pTh = await one("positions", { company_id: C, name: "Þjónn" }, { base_rate: 2900 });
const pKo = await one("positions", { company_id: C, name: "Kokkur" }, { base_rate: 3100 });
await one("shift_types", { company_id: C, name: "Dagvakt" }, { start_time: "07:00", end_time: "15:00", premium_pct: 0, premium_label: "Dagvinna", color: "#16a34a", bg: "#16a34a1f", border: "#16a34a59" });
await one("shift_types", { company_id: C, name: "Kvöldvakt" }, { start_time: "15:00", end_time: "23:00", premium_pct: 33, premium_label: "+33% álag", color: "#b06a12", bg: "#fff2e2", border: "#fbe2c4" });

const STAFF = [
  ["Anna Björk", dSal, pTh, "#e11d48"], ["Davíð Örn", dEld, pKo, "#0891b2"], ["Lóa Sif", dSal, pTh, "#9333ea"],
  ["Mína Huong", dEld, pKo, "#5b50e6"], ["Ha Vu", dEld, pKo, "#18a06a"], ["Moon Park", dSal, pTh, "#2563eb"],
  ["Fannar Freyr", dSal, pTh, "#ca8a04"], ["Dalya Karim", dEld, pKo, "#c2410c"],
];
const empIds = [];
for (const [full_name, department_id, position_id, avatar_color] of STAFF) {
  empIds.push(await one("employees", { company_id: C, full_name }, {
    location_id: loc, department_id, position_id, avatar_color, pay_type: "hourly", rate: position_id === pKo ? 3100 : 2900,
    employment_ratio: 100, union_agreement: "Efling", role: "employee", status: "active", hire_date: "2025-03-01",
  }));
}

// ---- rásir (Almennt + eldhúshópur)
const gen = await one("channels", { company_id: C, kind: "general" }, { name: "Almennt", created_by: ownerId });
const grp = await one("channels", { company_id: C, name: "Eldhús-teymið" }, { kind: "group", created_by: ownerId });

// ---- prófunarstarfsmaðurinn = Anna Björk
const reviewPw = pw();
const reviewId = await authUser(REVIEW_EMAIL, reviewPw, { full_name: STAFF[0][0], role: "employee", company_id: C });
{ const { error } = await db.from("users").upsert({ id: reviewId, email: REVIEW_EMAIL, full_name: STAFF[0][0], role: "employee", company_id: C }); if (error) die("users review", error); }
{ const { error } = await db.from("employees").update({ user_id: reviewId, email: REVIEW_EMAIL }).eq("id", empIds[0]); if (error) die("link review employee", error); }
for (const ch of [gen, grp]) for (const uid of [ownerId, reviewId]) await db.from("channel_members").upsert({ channel_id: ch, user_id: uid });

// ---- gervigögn: vaktir, stimplanir, velta, spjall, fréttir (sama skrifta og á staging)
const r = spawnSync(process.execPath, ["scripts/seed-demo.mjs", "--company", C], {
  stdio: "inherit", env: { ...process.env, NEXT_PUBLIC_SUPABASE_URL: url, SUPABASE_SERVICE_ROLE_KEY: service },
});
if (r.status !== 0) die("seed-demo", "mistókst");

writeFileSync(out.replace(/^~/, process.env.HOME),
  `VAKTO — prófunaraðgangur fyrir App Store / Google Play yfirferð\n\nNetfang (User name): ${REVIEW_EMAIL}\nLykilorð (Password):  ${reviewPw}\n\nFyrirtæki: ${company.name} (demo, gervigögn) — ${isStaging ? "STAGING" : "raunkerfi"}\nStarfsmaður: ${STAFF[0][0]}\n`, { mode: 0o600 });
console.log(`Demo-fyrirtæki tilbúið: ${company.name} (${C}) · ${STAFF.length} starfsmenn · innskráning skrifuð í ${out}`);
