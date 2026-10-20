// VAKTO — refreshes a seeded demo company (staging "Kaffi Krónan", or the public demo) with
// a realistic rolling window of data: published shifts for the last 6 full months,
// the current month and the coming week, punches for past shifts (a few honest
// anomalies: late, left early, overtime, sick days, one forgotten clock-out), and
// daily revenue so laun % af veltu lands around 27–33 % with a summer bump. Idempotent: wipes and re-seeds only that window.
// The logic lives in src/lib/demo-seed.ts (shared with /api/cron/demo-reset).
//
//   node scripts/seed-demo.mjs            # uses .env.local (service role)
//   node scripts/seed-demo.mjs --company <uuid>
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";
import { seedDemoData } from "../src/lib/demo-seed.ts";

for (const line of readFileSync(".env.local", "utf8").split("\n")) {
  const m = /^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/.exec(line);
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL, service = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !service) { console.error("Vantar NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY"); process.exit(1); }
const db = createClient(url, service, { auth: { persistSession: false } });

const argCo = process.argv.indexOf("--company");
const COMPANY = argCo > 0 ? process.argv[argCo + 1] : (process.env.DEMO_COMPANY_ID || "00000000-0000-0000-0000-0000000000c0");

try {
  await seedDemoData(db, COMPANY, { log: (m) => console.log(m) });
} catch (e) {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
}
