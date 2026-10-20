#!/usr/bin/env node
// Leitar að lestri á stórum töflum sem gæti farið yfir 1.000 raða þak PostgREST (max_rows).
// Ráðgefandi (exit 0) — hver ábending þarf mat: er fyrirspurnin bundin við einn dag/viku/starfsmann?
// Lagfæring: allRows() úr src/lib/supabase/all-rows.ts (eða count/head-fyrirspurn).
//
//   node scripts/check-row-caps.mjs            # src + mobile/src/lib/api
//   node scripts/check-row-caps.mjs --strict   # exit 1 ef eitthvað finnst (fyrir CI)
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// employees/users sleppt: <1.000 per fyrirtæki (en fyrirspurnir yfir ÖLL fyrirtæki þarf að síða — sjá birthday/vakto-admin).
const BIG = ["punches", "shifts", "revenue", "billing_usage", "payroll_lines", "leave_requests", "audit_log", "messages"];
const ROOTS = ["src", "mobile/src/lib/api"];
// Takmarkandi merki: síðun, talning, eins-raðar svör, limit, fyrirspurn á eitt id — eða skrifun.
const SAFE = /\.range\(|count:\s*"exact"|\.maybeSingle\(|\.single\(|\.limit\(|\.eq\("id",|\.insert\(|\.update\(|\.delete\(|\.upsert\(|rowcap-ok/;

const files = [];
const walk = (d) => { for (const f of readdirSync(d)) { const p = join(d, f); const s = statSync(p); if (s.isDirectory()) { if (f !== "node_modules") walk(p); } else if (/\.(ts|tsx|mjs)$/.test(f)) files.push(p); } };
for (const r of ROOTS) { try { walk(r); } catch { /* vantar möppu */ } }

const re = new RegExp(`\\.from\\("(${BIG.join("|")})"\\)`, "g");
let hits = 0;
for (const f of files) {
  const src = readFileSync(f, "utf8");
  for (const m of src.matchAll(re)) {
    // Fyrirspurnin = frá .from( að næsta ; eða línu sem endar á ),/ ]) (lok Promise.all-liðar).
    const rest = src.slice(m.index, m.index + 600);
    const end = rest.search(/;|\),\s*\n|\)\)\s*,?\s*\n/);
    const stmt = end > 0 ? rest.slice(0, end + 2) : rest;
    const before = src.slice(Math.max(0, m.index - 160), m.index);
    if (!stmt.includes(".select(") || SAFE.test(stmt) || /allRows/.test(before.split("\n").slice(-2).join("\n"))) continue;
    const line = src.slice(0, m.index).split("\n").length;
    console.log(`${f}:${line}  ${m[1]}  ${stmt.split("\n").map((s) => s.trim()).join(" ").slice(0, 150)}`);
    hits++;
  }
}
console.log(`\n${hits} ómerktar lestrarfyrirspurnir á stórum töflum (metið hverja: bundin við lítinn glugga? annars allRows).`);
if (process.argv.includes("--strict") && hits) process.exit(1);
