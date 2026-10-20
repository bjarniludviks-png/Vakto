// VAKTO — stofnar OPNA demo-fyrirtækið („Prófa demo" á vakto.is) með gervigögnum og einum
// demo-eiganda sem gestir skrá sig inn sem. Sjálfstætt fyrirtæki: snertir ENGIN önnur fyrirtæki
// (hvorki App Store-demóið „app-review-demo" né raunveruleg fyrirtæki).
//
//   node scripts/bootstrap-public-demo.mjs --out <skrá>                                  # staging (.env.local)
//   ENV_FILE=~/vakto/.env.local.PROD-BACKUP node scripts/bootstrap-public-demo.mjs --prod --out <skrá>
//
// Valkvætt: --owner <netfang> (sjálfgefið demo@demo.vakto.is), --name <nafn fyrirtækis>.
// Endurkeyranlegt: finnur fyrirtækið á admin_note = "public-demo" og endurnýtir það (lykilorð
// demo-eigandans endurnýjað). Lykilorðið og env-gildin eru AÐEINS skrifuð í --out skrána, aldrei prentuð.
// Á eftir: setja DEMO_COMPANY_ID / DEMO_LOGIN_EMAIL / DEMO_LOGIN_PASSWORD í Vercel (sjá --out skrána).
import { readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { PUBLIC_DEMO, PUBLIC_DEMO_NOTE, DEMO_EMAIL_DOMAIN, ensureDemoBase, seedDemoData, seedDemoRequests } from "../src/lib/demo-seed.ts";

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
const OWNER_EMAIL = (arg("--owner") || `demo@${DEMO_EMAIL_DOMAIN}`).toLowerCase();
const NAME = arg("--name") || PUBLIC_DEMO.company.name;
const pw = () => "Vd-" + randomBytes(12).toString("base64url") + "-9k";
const die = (what, error) => { console.error(what, error?.message ?? error); process.exit(1); };

// Öryggisnet: eigandinn má ekki vera til í ÖÐRU fyrirtæki (t.d. raunverulegur aðgangur eða App Store-demóið).
const list = (await db.auth.admin.listUsers({ perPage: 1000 })).data?.users ?? [];
const existingAuth = list.find((u) => u.email?.toLowerCase() === OWNER_EMAIL);

// ---- fyrirtæki
let company = (await db.from("companies").select("id, name").eq("admin_note", PUBLIC_DEMO_NOTE).maybeSingle()).data;
if (existingAuth) {
  const { data: prof } = await db.from("users").select("company_id").eq("id", existingAuth.id).maybeSingle();
  if (prof?.company_id && prof.company_id !== company?.id) die("Hætt:", `${OWNER_EMAIL} tilheyrir þegar öðru fyrirtæki — veldu annað netfang með --owner`);
}
if (!company) {
  const far = new Date(Date.now() + 3650 * 864e5).toISOString();
  const { data, error } = await db.from("companies").insert({ ...PUBLIC_DEMO.company, name: NAME, trial_ends_at: far, admin_note: PUBLIC_DEMO_NOTE })
    .select("id, name").single();
  if (error) die("companies", error);
  company = data;
}
const C = company.id;

// ---- demo-eigandinn (gestirnir)
const ownerPw = pw();
const meta = { full_name: "Demo Stjórnandi", role: "owner", company_id: C };
let ownerId = existingAuth?.id;
if (ownerId) {
  const { error } = await db.auth.admin.updateUserById(ownerId, { password: ownerPw, email_confirm: true, user_metadata: meta });
  if (error) die("updateUser", error);
} else {
  const { data, error } = await db.auth.admin.createUser({ email: OWNER_EMAIL, password: ownerPw, email_confirm: true, user_metadata: meta });
  if (error) die("createUser", error);
  ownerId = data.user.id;
}
{ const { error } = await db.from("users").upsert({ id: ownerId, email: OWNER_EMAIL, full_name: "Demo Stjórnandi", role: "owner", company_id: C }); if (error) die("users owner", error); }

// ---- grunnur (staðir, deildir, stöður, vaktategundir, starfsfólk, rásir) + gervigögn
try {
  const base = await ensureDemoBase(db, C, ownerId);
  await seedDemoData(db, C, { emailDomain: DEMO_EMAIL_DOMAIN, log: (m) => console.log(m) });
  await seedDemoRequests(db, C, new Date(), (m) => console.log(m));
  console.log(`${base.locations.length} staðir · ${base.employees.length} starfsmenn`);
} catch (e) { die("seed", e); }

writeFileSync(out.replace(/^~/, process.env.HOME),
  `VAKTO — opið demo („Prófa demo") — ${isStaging ? "STAGING" : "RAUNKERFI"}\n` +
  `Fyrirtæki: ${company.name} (gervigögn)\n\n` +
  `Setja í Vercel (${isStaging ? "Preview" : "Production"}):\n` +
  `DEMO_COMPANY_ID=${C}\nDEMO_LOGIN_EMAIL=${OWNER_EMAIL}\nDEMO_LOGIN_PASSWORD=${ownerPw}\n`, { mode: 0o600 });
console.log(`Opið demo tilbúið: ${company.name} (${C}) · env-gildi skrifuð í ${out}`);
