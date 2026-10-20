// Mælir hraða og gæði AI-vaktaplans í VAKTO AI aðstoðarmanninum (staging).
//   node scripts/ai-plan-bench.mjs [base-url] [kitchen|company] [runs] [label]
// Skráir inn eiganda Kaffi Krónunnar (staging) með magic link (service role), sendir planbeiðnina
// á /api/assistant og mælir: tíma að fyrstu framvindu, tíma þar til tillagan (plan_week) er komin,
// og heildartíma. Athugar svo vaktirnar: ≥2 frídagar hver, nákvæmlega 3 á vakt hvern dag,
// engin vakt á samþykktu fríi, ≥11 klst hvíld, rétt deild. EKKERT er staðfest (engar vaktir skrifaðar).
// Niðurstöður fara í JSON-skrá (BENCH_OUT) ef hún er gefin.
import { createClient } from "@supabase/supabase-js";
import fs from "fs";

const env = Object.fromEntries(fs.readFileSync(".env.local", "utf8").split("\n").filter((l) => l.includes("=") && !l.startsWith("#")).map((l) => [l.slice(0, l.indexOf("=")), l.slice(l.indexOf("=") + 1)]));
const base = (process.argv[2] ?? "http://localhost:3000").replace(/\/$/, "");
const scenario = process.argv[3] === "company" ? "company" : "kitchen";
const runs = Number(process.argv[4] ?? 1);
const label = process.argv[5] ?? "run";
const COMPANY = process.env.BENCH_COMPANY ?? "00000000-0000-0000-0000-0000000000c0";
const PROMPTS = {
  kitchen: "Gerðu vaktaplan fyrir næstu viku í eldhúsinu. Allir fá að minnsta kosti tvo frídaga og alltaf þrír á vakt.",
  company: "Gerðu vaktaplan fyrir næstu viku fyrir allt fyrirtækið. Allir fá að minnsta kosti tvo frídaga og alltaf þrír á vakt.",
};

const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data: owner } = await admin.from("users").select("id").eq("company_id", COMPANY).eq("role", "owner").limit(1).single();
const { data: ou } = await admin.auth.admin.getUserById(owner.id);

async function login() {
  const { data, error } = await admin.auth.admin.generateLink({ type: "magiclink", email: ou.user.email });
  if (error) throw new Error(error.message);
  const res = await fetch(`${base}/auth/callback?token_hash=${data.properties.hashed_token}&type=magiclink&next=/vaktaplan`, { redirect: "manual" });
  return res.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
}

const iso = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const now = new Date();
const nextMon = new Date(now.getFullYear(), now.getMonth(), now.getDate() + ((8 - now.getDay()) % 7 || 7));
const dates = Array.from({ length: 7 }, (_, i) => iso(new Date(nextMon.getFullYear(), nextMon.getMonth(), nextMon.getDate() + i)));

// Starfsfólk + samþykkt frí fyrir athugunina.
const { data: emps } = await admin.from("employees").select("id, full_name, status, role, departments(name)").eq("company_id", COMPANY);
const staff = (emps ?? []).filter((e) => e.status !== "inactive" && e.role !== "contractor");
const { data: leave } = await admin.from("leave_requests").select("employee_id, from_date, to_date").eq("company_id", COMPANY).eq("status", "approved").lte("from_date", dates[6]).gte("to_date", dates[0]);
const findEmp = (name) => { const q = name.toLowerCase(); return staff.find((e) => e.full_name.toLowerCase() === q) ?? staff.find((e) => e.full_name.toLowerCase().startsWith(q)); };
const mins = (t) => Number(t.slice(0, 2)) * 60 + Number(t.slice(3, 5));

/** Athugar plan_week-inntak. Skilar lista af brotum (tómt = stenst). */
function check(input) {
  const errs = [];
  const shifts = (input?.shifts ?? []).map((s) => { const [employee, date, start, end] = String(s).split("|").map((x) => x.trim()); return { employee, date, start: start?.padStart(5, "0"), end: end?.padStart(5, "0") }; });
  if (!shifts.length) return { errs: ["engar vaktir"], n: 0 };
  const per = new Map();
  for (const s of shifts) {
    const e = findEmp(s.employee ?? "");
    if (!e) { errs.push(`óþekkt nafn ${s.employee}`); continue; }
    if (!dates.includes(s.date)) errs.push(`${s.employee} ${s.date} utan vikunnar`);
    if (scenario === "kitchen" && e.departments?.name !== "Eldhús") errs.push(`${s.employee} er ekki í eldhúsi`);
    for (const l of leave ?? []) if (l.employee_id === e.id && s.date >= l.from_date && s.date <= l.to_date) errs.push(`${s.employee} á vakt ${s.date} í samþykktu fríi`);
    per.set(e.id, [...(per.get(e.id) ?? []), s]);
  }
  for (const [, list] of per) {
    if (new Set(list.map((s) => s.date)).size !== list.length) errs.push(`${list[0].employee}: tvær vaktir sama dag`);
    if (list.length > 5) errs.push(`${list[0].employee}: ${list.length} vaktir (<2 frídagar)`);
    const abs = list.map((s) => { const d = dates.indexOf(s.date); const a = d * 1440 + mins(s.start); let b = d * 1440 + mins(s.end); if (b <= a) b += 1440; return [a, b]; }).sort((x, y) => x[0] - y[0]);
    for (let i = 1; i < abs.length; i++) if (abs[i][0] - abs[i - 1][1] < 11 * 60) errs.push(`${list[0].employee}: hvíld < 11 klst`);
  }
  // Mönnun. Eldhús: nákvæmlega 3 á dag. Allt fyrirtækið: „alltaf þrír á vakt" má lesa sem 3 alls á dag (A)
  // eða 3 á dag í hverri deild sem getur það (B: deildir með ≥5 manns 3/dag, minni deildir jafnt alla daga).
  const perDay = (pred) => dates.map((d) => shifts.filter((s) => s.date === d && pred(findEmp(s.employee ?? ""))).length);
  let interp = "A";
  if (scenario === "kitchen") {
    perDay((e) => e?.departments?.name === "Eldhús").forEach((n, i) => { if (n !== 3) errs.push(`Eldhús ${dates[i]}: ${n} á vakt`); });
  } else {
    const total = perDay(() => true);
    if (!total.every((n) => n === 3)) {
      interp = "B";
      for (const g of [...new Set(staff.map((e) => e.departments?.name ?? "—"))]) {
        const n = staff.filter((e) => (e.departments?.name ?? "—") === g).length;
        const c = perDay((e) => (e?.departments?.name ?? "—") === g);
        if (n >= 5 ? !c.every((x) => x === 3) : (c.some((x) => x > 3) || (c.some((x) => x > 0) && new Set(c).size > 1 && Math.max(...c) - Math.min(...c) > 1)))
          errs.push(`${g}: ${c.join("/")} á vakt (mán–sun)`);
      }
    }
  }
  return { errs, n: shifts.length, interp };
}

// BENCH_ROUTE=schedule → „Biðja AI“ á Vaktaplani (/api/ai/schedule) með samhengi eins og skjárinn byggir það.
const route = process.env.BENCH_ROUTE === "schedule" ? "schedule" : "assistant";
async function scheduleContext() {
  const DAYS = ["mán", "þri", "mið", "fim", "fös", "lau", "sun"];
  const { data: sh } = await admin.from("shifts").select("employee_id, date, start_time, end_time").eq("company_id", COMPANY).gte("date", dates[0]).lte("date", dates[6]);
  const { data: types } = await admin.from("shift_types").select("name, start_time, end_time, premium_pct").eq("company_id", COMPANY);
  const vis = scenario === "kitchen" ? staff.filter((e) => e.departments?.name === "Eldhús") : staff;
  const lines = vis.map((e) => {
    const cells = (sh ?? []).filter((s) => s.employee_id === e.id).sort((a, b) => a.date.localeCompare(b.date)).map((s) => `${DAYS[dates.indexOf(s.date)]} ${s.start_time.slice(0, 5)}–${s.end_time.slice(0, 5)}`).join(", ");
    return `- ${e.full_name} (${e.departments?.name ?? ""}): ${cells || "engar vaktir"}`;
  }).join("\n");
  return `Vikan sem er opin: ${dates[0]}–${dates[6]} (mánudagur = ${dates[0]}, day 0=mán … 6=sun).\n`
    + `Starfsmenn á plani: ${vis.map((e) => `${e.full_name} (${e.departments?.name ?? ""})`).join(", ")}.\n`
    + `Núverandi plan vikunnar:\n${lines}\n`
    + `Vaktategundir: ${(types ?? []).map((t) => `${t.name} ${String(t.start_time).slice(0, 5)}–${String(t.end_time).slice(0, 5)} +${t.premium_pct ?? 0}%`).join("; ")}.`;
}
const schedCtx = route === "schedule" ? await scheduleContext() : "";

const results = [];
for (let r = 0; r < runs; r++) {
  const cookie = await login();
  const t0 = performance.now();
  const res = route === "schedule"
    ? await fetch(`${base}/api/ai/schedule`, { method: "POST", headers: { "Content-Type": "application/json", cookie }, body: JSON.stringify({ prompt: PROMPTS[scenario], context: schedCtx, lang: "is", weekStart: dates[0] }) })
    : await fetch(`${base}/api/assistant`, {
    method: "POST", headers: { "Content-Type": "application/json", cookie },
    body: JSON.stringify({ path: "/vaktaplan", lang: "is", messages: [{ role: "user", content: PROMPTS[scenario] }] }),
  });
  const ndjson = (res.headers.get("content-type") ?? "").includes("ndjson");
  const reader = res.body.getReader(); const dec = new TextDecoder();
  let buf = "", firstProgress = null, proposal = null, done = null, final = null, stages = [], textFirst = null, planEvents = 0, planFirst = null, planShifts = 0, planTotal = null;
  for (;;) {
    const { value, done: end } = await reader.read();
    if (end) break;
    buf += dec.decode(value, { stream: true });
    const t = performance.now() - t0;
    if (!ndjson) { if (buf.trim() && firstProgress === null && buf.trim().startsWith("{")) firstProgress = t; continue; }
    let i;
    while ((i = buf.indexOf("\n")) >= 0) {
      const line = buf.slice(0, i).trim(); buf = buf.slice(i + 1);
      if (!line) continue;
      const ev = JSON.parse(line);
      if (firstProgress === null && ev.t !== "ping") firstProgress = t;
      if (ev.t === "stage") stages.push(`${(t / 1000).toFixed(1)}s ${ev.stage}${ev.tool ? `:${ev.tool}` : ""}`);
      if (ev.t === "text" && textFirst === null) textFirst = t;
      if (ev.t === "plan") { planEvents++; planFirst ??= t; planShifts += ev.add.length; planTotal = ev.total ?? planTotal; }
      if (ev.t === "action" && ev.action?.tool === "plan_week" && proposal === null) proposal = t;
      if (ev.t === "progress" && ev.shifts > 0 && proposal === null) proposal = -1; // fyrsta vaktin komin
      if (ev.t === "done") { done = t; final = ev; }
    }
  }
  const tEnd = performance.now() - t0;
  if (!ndjson) { final = JSON.parse(buf); done = tEnd; firstProgress = tEnd; }
  if (route === "schedule") { final = final?.proposal ?? final; if (proposal === -1) proposal = null; }
  const plan = route === "schedule"
    ? (final?.shifts?.length ? { input: { shifts: final.shifts.map((x) => `${x.employee}|${dates[x.day]}|${x.start}|${x.end}`) } } : null)
    : (final?.actions ?? []).find((a) => a.tool === "plan_week");
  if (plan && proposal === null) proposal = done;
  const c = plan ? check(plan.input) : { errs: [final?.ok === false ? `villa: ${final.error}` : "engin plan_week-tillaga"], n: 0 };
  const row = { label, route, scenario, run: r + 1, firstProgressS: +(firstProgress / 1000).toFixed(1), proposalS: proposal ? +(proposal / 1000).toFixed(1) : null, doneS: +(done / 1000).toFixed(1), textFirstS: textFirst ? +(textFirst / 1000).toFixed(1) : null, planFirstS: planFirst ? +(planFirst / 1000).toFixed(1) : null, planEvents, planShifts, planTotal, shifts: c.n, interp: c.interp, pass: c.errs.length === 0, errs: c.errs, stages, dept: plan?.input?.department ?? null, conversationId: final?.conversationId ?? null };
  results.push(row);
  console.log(JSON.stringify({ ...row, stages: stages.join(" · ") }));
}
if (process.env.BENCH_OUT) {
  const prev = fs.existsSync(process.env.BENCH_OUT) ? JSON.parse(fs.readFileSync(process.env.BENCH_OUT, "utf8")) : [];
  fs.writeFileSync(process.env.BENCH_OUT, JSON.stringify([...prev, ...results], null, 2));
}
