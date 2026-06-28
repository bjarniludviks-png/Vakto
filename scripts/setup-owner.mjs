// VAKTO — býr til (eða uppfærir) owner-prufuaðgang og tengir hann við demo-fyrirtækið.
// Þarf SUPABASE_SERVICE_ROLE_KEY í .env.local.
//
//   node scripts/setup-owner.mjs [netfang] [lykilorð]
//   sjálfgefið: bjarniludviks@icloud.com / Vakto!2026
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service || service.includes("YOUR")) {
  console.error("❌ Vantar SUPABASE_SERVICE_ROLE_KEY í .env.local."); process.exit(1);
}

const email = process.argv[2] || "bjarniludviks@icloud.com";
const password = process.argv[3] || "Vakto!2026";
const COMPANY = "00000000-0000-0000-0000-0000000000c0"; // Kaffi Krónan (seed)

const db = createClient(url, service, { auth: { persistSession: false } });

// 1. Staðfesta að fyrirtækið sé til (úr 0003_seed.sql).
const { data: company } = await db.from("companies").select("id, name").eq("id", COMPANY).maybeSingle();
if (!company) { console.error("❌ Demo-fyrirtæki vantar — keyrðu 0003_seed.sql."); process.exit(1); }
console.log("🏢 Fyrirtæki:", company.name);

// 2. Búa til auth-notanda (eða finna hann ef hann er til).
let userId;
const { data: created, error: cErr } = await db.auth.admin.createUser({
  email, password, email_confirm: true, user_metadata: { full_name: "Bjarni Lúðvíksson", role: "owner" },
});
if (cErr) {
  if (/already.*registered|already.*exists/i.test(cErr.message)) {
    const { data: list } = await db.auth.admin.listUsers();
    userId = list.users.find((u) => u.email === email)?.id;
    if (userId) await db.auth.admin.updateUserById(userId, { password, email_confirm: true });
    console.log("👤 Notandi var til — lykilorð uppfært.");
  } else { console.error("❌", cErr.message); process.exit(1); }
} else {
  userId = created.user.id;
  console.log("👤 Notandi stofnaður.");
}

// 3. Tengja public.users röðina við fyrirtækið sem owner (trigger bjó hana til).
const { error: uErr } = await db.from("users")
  .update({ company_id: COMPANY, role: "owner", full_name: "Bjarni Lúðvíksson" })
  .eq("id", userId);
if (uErr) {
  // ef trigger keyrði ekki, búa til röðina
  await db.from("users").upsert({ id: userId, email, company_id: COMPANY, role: "owner", full_name: "Bjarni Lúðvíksson" });
}
console.log("🔗 Tengt við Kaffi Krónan sem owner.");

console.log(`\n✅ Klárt! Skráðu þig inn á /login:\n   netfang:  ${email}\n   lykilorð: ${password}\n`);
