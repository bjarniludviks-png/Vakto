// One-time: push the web-push VAPID keys from .env.local to Vercel
// (production + preview). Without them pushConfigured() is false in prod and
// every notification silently no-ops. Run: node scripts/setup-vercel-push-env.mjs
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

const env = Object.fromEntries(
  readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n").filter((l) => l.includes("="))
    .map((l) => l.split(/=(.*)/s).slice(0, 2).map((s) => s.trim()))
);

const NAMES = ["NEXT_PUBLIC_VAPID_PUBLIC_KEY", "VAPID_PRIVATE_KEY", "VAPID_SUBJECT"];
for (const target of ["production", "preview"]) {
  for (const name of NAMES) {
    const value = env[name];
    if (!value) { console.log(`SKIP ${name} — vantar í .env.local`); continue; }
    spawnSync("vercel", ["env", "rm", name, target, "--yes"], { stdio: "ignore" });
    const r = spawnSync("vercel", ["env", "add", name, target], { input: value, stdio: ["pipe", "pipe", "pipe"] });
    console.log(`${r.status === 0 ? "OK  " : "FAIL"} ${target} ${name}`);
  }
}
