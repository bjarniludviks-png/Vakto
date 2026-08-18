// Verifies the mobile app's data layer against STAGING with the documented
// seed test account (CLAUDE.md). Mirrors the queries in mobile/src/lib/api/*.
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";

const env = Object.fromEntries(
  readFileSync("/Users/bjarniludviksson/vakto/mobile/.env", "utf8")
    .split("\n")
    .filter(Boolean)
    .map((l) => l.split(/=(.*)/s).slice(0, 2))
);
const supabase = createClient(env.EXPO_PUBLIC_SUPABASE_URL, env.EXPO_PUBLIC_SUPABASE_ANON_KEY);

const ok = (label, pass, extra = "") =>
  console.log(`${pass ? "PASS" : "FAIL"}  ${label}${extra ? " — " + extra : ""}`);

const { data: auth, error: authErr } = await supabase.auth.signInWithPassword({
  email: process.env.VAKTO_TEST_EMAIL ?? "bjarniludviks@icloud.com",
  password: process.env.VAKTO_TEST_PASSWORD ?? "Vakto!2026", // staging seed login (see CLAUDE.md)
});
ok("auth signInWithPassword", !authErr, authErr?.message);
if (authErr) process.exit(1);
const uid = auth.user.id;

// getMe
const { data: emp, error: empErr } = await supabase
  .from("employees")
  .select(
    "id, company_id, full_name, title, kennitala, phone, email, bank_account, rate, pay_type, union_agreement, employment_ratio, photo_url, avatar_color, pay_rule, departments(name), positions(name)"
  )
  .eq("user_id", uid)
  .limit(1)
  .maybeSingle();
ok("employees self row (getMe)", !!emp && !empErr, empErr?.message ?? (emp ? emp.full_name : "no row linked"));

let me = emp ? { empId: emp.id, companyId: emp.company_id } : null;
if (!me) {
  // fall back: pick any employee in company via users row (owner session can read company-wide)
  const { data: u } = await supabase.from("users").select("company_id").eq("id", uid).maybeSingle();
  if (u?.company_id) {
    const { data: any } = await supabase
      .from("employees")
      .select("id, company_id, full_name")
      .eq("company_id", u.company_id)
      .limit(1);
    if (any?.[0]) {
      me = { empId: any[0].id, companyId: any[0].company_id };
      console.log(`  (using employee "${any[0].full_name}" for read tests)`);
    }
  }
}
if (!me) process.exit(1);

// shifts week query
const { data: shifts, error: shErr } = await supabase
  .from("shifts")
  .select("date, start_time, end_time")
  .eq("employee_id", me.empId)
  .limit(3);
ok("shifts read", !shErr, shErr?.message ?? `${shifts?.length ?? 0} rows`);

// punches read
const { data: punches, error: pErr } = await supabase
  .from("punches")
  .select("clock_in, clock_out")
  .eq("employee_id", me.empId)
  .limit(3);
ok("punches read", !pErr, pErr?.message ?? `${punches?.length ?? 0} rows`);

// punch INSERT + cleanup (requires migration 0041 unless session is manager)
const { data: ins, error: insErr } = await supabase
  .from("punches")
  .insert({ company_id: me.companyId, employee_id: me.empId, clock_in: new Date().toISOString(), source: "app" })
  .select("id")
  .maybeSingle();
ok("punches insert (clock-in)", !!ins && !insErr, insErr?.message ?? ins?.id);
if (ins?.id) await supabase.from("punches").delete().eq("id", ins.id);

// channels + messages
const { data: chs, error: chErr } = await supabase
  .from("channels")
  .select("id, name, kind")
  .eq("company_id", me.companyId);
ok("channels read", !chErr, chErr?.message ?? (chs ?? []).map((c) => c.name).join(", "));
if (chs?.[0]) {
  const { data: msgs, error: mErr } = await supabase
    .from("messages")
    .select("id, body")
    .eq("channel_id", chs[0].id)
    .limit(3);
  ok("messages read", !mErr, mErr?.message ?? `${msgs?.length ?? 0} rows`);
}

// posts (newsfeed) incl. embeds
const { data: posts, error: poErr } = await supabase
  .from("posts")
  .select("id, body, pinned, post_likes(user_id, reaction), post_comments(id, body)")
  .eq("company_id", me.companyId)
  .limit(3);
ok("posts read (with likes/comments embed)", !poErr, poErr?.message ?? `${posts?.length ?? 0} rows`);

// documents rows
const { data: docs, error: dErr } = await supabase
  .from("documents")
  .select("id, name, url, employee_id")
  .eq("company_id", me.companyId)
  .or(`employee_id.is.null,employee_id.eq.${me.empId}`)
  .limit(5);
ok("documents rows read", !dErr, dErr?.message ?? `${docs?.length ?? 0} rows`);

// storage signed URL for a shared doc
const shared = (docs ?? []).find((d) => !d.employee_id);
if (shared) {
  const { data: su, error: suErr } = await supabase.storage.from("documents").createSignedUrl(shared.url, 60);
  ok("storage signed URL (shared doc)", !!su?.signedUrl && !suErr, suErr?.message ?? "ok");
} else {
  console.log("SKIP  storage signed URL — no shared docs in staging");
}

// contracts own read
const { data: con, error: cErr } = await supabase
  .from("contracts")
  .select("id, title, status")
  .eq("employee_id", me.empId)
  .limit(1);
ok("contracts read", !cErr, cErr?.message ?? `${con?.length ?? 0} rows`);

// leave request insert path (dry check: table accessible)
const { error: lrErr } = await supabase.from("leave_requests").select("id").eq("employee_id", me.empId).limit(1);
ok("leave_requests read", !lrErr, lrErr?.message);

await supabase.auth.signOut();
