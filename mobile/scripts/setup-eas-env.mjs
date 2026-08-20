// One-time EAS environment setup: pushes the Supabase URL + anon key to Expo
//   production  → PROD  (lsnthbnqcelfgeyuxgfn, from ../.env.local.PROD-BACKUP)
//   preview     → STAGING (aptpckmrqepvcqhgkjoo, from mobile/.env)
// Anon keys are publishable (they ship inside every client bundle) — but we
// still keep them out of git and out of terminal history; this script reads
// them from the local env files and hands them straight to `eas env:create`.
// Run from mobile/:  node scripts/setup-eas-env.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const read = (p) =>
  Object.fromEntries(
    readFileSync(p, "utf8").split("\n").filter((l) => l.includes("="))
      .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
  );

const prod = read(resolve(here, "../../.env.local.PROD-BACKUP"));
const stag = read(resolve(here, "../.env"));

const jobs = [
  ["production", "EXPO_PUBLIC_SUPABASE_URL", prod.NEXT_PUBLIC_SUPABASE_URL],
  ["production", "EXPO_PUBLIC_SUPABASE_ANON_KEY", prod.NEXT_PUBLIC_SUPABASE_ANON_KEY],
  ["preview", "EXPO_PUBLIC_SUPABASE_URL", stag.EXPO_PUBLIC_SUPABASE_URL],
  ["preview", "EXPO_PUBLIC_SUPABASE_ANON_KEY", stag.EXPO_PUBLIC_SUPABASE_ANON_KEY],
];

for (const [envName, name, value] of jobs) {
  if (!value) { console.error(`SKIP ${envName}/${name} — value not found`); continue; }
  const r = spawnSync(
    "eas",
    ["env:create", "--environment", envName, "--name", name, "--value", value,
     "--visibility", "plaintext", "--type", "string", "--non-interactive", "--force"],
    { cwd: resolve(here, ".."), stdio: ["ignore", "pipe", "pipe"] }
  );
  const out = (r.stdout + "" + r.stderr).trim().split("\n").pop();
  console.log(`${r.status === 0 ? "OK  " : "FAIL"} ${envName} ${name} — ${out}`);
}
