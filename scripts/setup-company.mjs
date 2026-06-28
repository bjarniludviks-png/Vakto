// VAKTO — býr til nýtt (tómt) fyrirtæki + owner-aðgang. Þarf service_role.
//   node scripts/setup-company.mjs "<fyrirtæki>" <netfang> <lykilorð> "<fullt nafn>"
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service || service.includes("YOUR")) { console.error("❌ Vantar service_role."); process.exit(1); }

const name = process.argv[2];
const email = process.argv[3];
const password = process.argv[4];
const fullName = process.argv[5] || email.split("@")[0];
if (!name || !email || !password) { console.error('Notkun: node scripts/setup-company.mjs "<fyrirtæki>" <netfang> <lykilorð> "<nafn>"'); process.exit(1); }

const db = createClient(url, service, { auth: { persistSession: false } });

// 1. Fyrirtæki (idempotent á heiti).
let companyId;
const { data: existing } = await db.from("companies").select("id").eq("name", name).maybeSingle();
if (existing) { companyId = existing.id; console.log("🏢 Fyrirtæki var til:", name); }
else {
  const { data, error } = await db.from("companies").insert({ name, location: "Reykjavík", currency: "ISK" }).select("id").single();
  if (error) { console.error("❌", error.message); process.exit(1); }
  companyId = data.id; console.log("🏢 Fyrirtæki stofnað:", name);
}

// 2. Auth-notandi.
let userId;
const { data: created, error: cErr } = await db.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { full_name: fullName, role: "owner" },
});
if (cErr) {
  if (/already.*(registered|exists)/i.test(cErr.message)) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)?.id;
    if (userId) await db.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log("👤 Notandi var til — lykilorð uppfært.");
  } else { console.error("❌", cErr.message); process.exit(1); }
} else { userId = created.user.id; console.log("👤 Notandi stofnaður."); }

// 3. Tengja public.users við fyrirtækið sem owner.
const { error: uErr } = await db.from("users")
  .update({ company_id: companyId, role: "owner", full_name: fullName }).eq("id", userId);
if (uErr || true) {
  await db.from("users").upsert({ id: userId, email, company_id: companyId, role: "owner", full_name: fullName });
}
console.log("🔗 Tengt sem owner.");
console.log(`\n✅ Klárt!\n   fyrirtæki: ${name}\n   netfang:   ${email}\n   lykilorð:  ${password}\n`);
