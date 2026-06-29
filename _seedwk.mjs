import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
const env = Object.fromEntries(readFileSync(".env.local","utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const company = "00000000-0000-0000-0000-0000000000c0";
const { data: emps } = await sb.from("employees").select("id, full_name").eq("company_id", company).order("full_name").limit(3);
console.log("emps:", emps?.map(e=>e.full_name).join(", ") || "(engir)");
if (!emps?.length) { console.log("engir starfsmenn í Kaffi"); process.exit(0); }
// clear test weeks then insert: 1 shift in wk0 (06-23), 2 shifts in wk-1 (06-16,06-17)
await sb.from("shifts").delete().eq("company_id", company).in("date", ["2026-06-23","2026-06-16","2026-06-17"]);
const mk = (eid,date) => ({ company_id: company, employee_id: eid, date, start_time:"07:00", end_time:"15:00", status:"published", published:true });
const rows = [ mk(emps[0].id,"2026-06-23"), mk(emps[0].id,"2026-06-16"), mk(emps[1]?.id ?? emps[0].id,"2026-06-17") ];
const { error } = await sb.from("shifts").insert(rows);
console.log(error ? "INSERT ERR: "+error.message : "✅ sett inn: wk0=1, wk-1=2");
