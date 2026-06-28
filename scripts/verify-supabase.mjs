// VAKTO — Supabase tengiprófun.  Keyrt með:  node scripts/verify-supabase.mjs
// Les .env.local, staðfestir lykla og telur raðir í lykiltöflum.
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

function loadEnv(path) {
  try {
    for (const line of readFileSync(path, "utf8").split("\n")) {
      const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  } catch { /* engin skrá */ }
}
loadEnv(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
const placeholder = (v) => !v || v.includes("YOUR") || v.trim() === "";

console.log("\n🔑 Lyklar í .env.local");
console.log("  URL     :", placeholder(url) ? "❌ vantar/placeholder" : "✅ " + url);
console.log("  anon    :", placeholder(anon) ? "❌ vantar/placeholder" : "✅ settur");
console.log("  service :", placeholder(service) ? "❌ vantar/placeholder" : "✅ settur");
if (placeholder(url) || placeholder(anon) || placeholder(service)) {
  console.log("\n→ Settu raunverulega lykla í .env.local og keyrðu aftur.\n");
  process.exit(1);
}

const db = createClient(url, service, { auth: { persistSession: false } });
const tables = ["companies", "locations", "employees", "shift_types", "shifts",
  "leave_requests", "shift_swaps", "availability", "audit_log", "revenue"];

console.log("\n📊 Töflur (fjöldi raða)");
let missing = 0;
for (const t of tables) {
  const { count, error } = await db.from(t).select("*", { count: "exact", head: true });
  if (error) { console.log(`  ${t.padEnd(16)} ❌ ${error.message}`); missing++; }
  else console.log(`  ${t.padEnd(16)} ✅ ${count}`);
}

console.log("\n🗄️  Storage-fötur");
const { data: buckets, error: bErr } = await db.storage.listBuckets();
if (bErr) console.log("  ❌ " + bErr.message);
else for (const id of ["documents", "avatars"]) {
  const b = buckets.find((x) => x.id === id);
  console.log(`  ${id.padEnd(16)} ${b ? "✅ til (" + (b.public ? "opið" : "lokað") + ")" : "❌ vantar — keyrðu 0006_storage.sql + kveiktu á Storage"}`);
}

console.log(missing ? "\n⚠️  Sumar töflur vantar — keyrðu RUN_ALL.sql í SQL Editor.\n"
  : "\n✅ Allt klárt! Skráðu þig inn og tengdu eigandaröðina (sjá supabase/README.md §3).\n");
