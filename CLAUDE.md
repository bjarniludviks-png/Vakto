@AGENTS.md

# VAKTO — build rules

> **The four prototype HTML files in `prototypes/` are the design source of truth.
> Match them exactly. Do not redesign.** (`VAKTO-CLAUDE-CODE-BRIEF.md` has the full brief.)

- Font **General Sans** (Fontshare); brand **orange `#e9700f`**; neutrals/semantic per the token
  list in `src/app/globals.css`. **No emojis — line icons only** (lucide style).
- Generous spacing, 14px card radius, soft shadows (INVENTRA-like airiness).
- UI language is **Icelandic** (labels as in the prototypes); support EN. Everything mobile-friendly.
- Roles: owner (Stjórnandi) / manager (Vaktstjóri) / employee (Starfsmaður) + contractor + kiosk.
  Respect the access matrix — but **where the prototype's sidebar and the brief's matrix disagree,
  the prototype wins** (e.g. owners do not see Spjall in the sidebar).
- Labor % of revenue is the signature metric (lower is better; color-coded).
- AI scheduling and insights require user approval before applying.
- Never reproduce wrong pay: the kjarasamninga calc must be verified against real agreements.
- **Per screen: build → screenshot → compare to prototype → fix until identical.**

## Architecture / conventions

- **Stack:** Next.js 16 (App Router) + React 19 + Tailwind v4 + shadcn/ui + Supabase (cloud).
- **CSS strategy for pixel parity:** each prototype's `<style>` block is ported *verbatim* into a
  route-segment-scoped CSS file so class names never collide across surfaces:
  - `src/styles/app.css` → imported only in `src/app/(app)/layout.tsx` (shell + all app screens)
  - `src/app/login/login.css` → login route only
  - Global tokens + font live in `src/app/globals.css` (loaded everywhere).
- **Numbers:** use `src/lib/format.ts` (`nf`/`kr`/`dec1`) — deterministic Icelandic formatting.
  Never use `toLocaleString("is-IS")` in rendered output (server/client locale data differs →
  hydration mismatch).
- **Avatar initials:** first two letters of the first name (Mína→MÍ, Bach→BA). Account/topbar
  avatar uses first+last (Bjarni Lúðvíksson→BL).
- **Supabase:** `src/lib/supabase/{client,server,admin,middleware,config}.ts`. Server-only data
  fetchers end in `.server.ts` and must not be imported by Client Components. Before real keys are
  set, `isSupabaseConfigured()` is false → screens render demo data (`DEMO_EMPLOYEES`) and auth is
  not enforced, so the UI stays previewable. See `supabase/README.md` to connect.
- Routes (Icelandic slugs): `/maelabord /vaktaplan /timaskraning /launakeyrslur /starfsfolk
  /skyrslur /frammistada /mitt-svaedi /spjall /stillingar /hjalp` + public `/login` `/kiosk`.

## Status

- **Fasi 1 — ALL screens built & verified pixel-for-pixel with Playwright:** project setup,
  DB schema + RLS + seed, app shell, login, marketing homepage (`/`, IS/EN + auth modal), kiosk PIN
  clock (`/kiosk`), Mælaborð, Vaktaplan (drag-drop grid + day/month views + shift types + AI prompt),
  Tímaskráning, Launakeyrslur, Starfsfólk, Skýrslur, Frammistaða, Mitt svæði, Spjall, Stillingar.
  Shared chart primitives in `src/components/app/charts.tsx` (Bars/Stacked/Paired).
- **Fasi 2 in progress:** ✅ role-switch preview (owner can view as manager/employee via account menu),
  ✅ real AI scheduling — `Biðja AI` posts to `/api/ai/schedule`, which calls **Claude Opus 4.8**
  (`@anthropic-ai/sdk`, structured outputs via `output_config.format` json_schema, model id
  `claude-opus-4-8`) and returns a proposal the user confirms; falls back to a demo proposal when
  `ANTHROPIC_API_KEY` is unset (`src/lib/ai/schedule.ts` — server-only).
- ✅ **Starfsfólk persistence:** `Nýr starfsmaður` and the profile-modal `Vista` call Server Actions
  in `src/app/(app)/starfsfolk/actions.ts` (`createEmployee`/`updateEmployee`) that insert/update
  Supabase and `revalidatePath`. Resolves department/position/location ids by name within the user's
  company. Demo fallback (toast, no write) when Supabase unconfigured.
- ✅ **Punches persistence:** kiosk PIN punch → `kioskPunch` (service-role admin client, since kiosk
  is unauthenticated) and Mitt svæði clock in/out → `myPunch` (auth) both write `punches`. Tímaskráning
  reads live "Á vakt núna" from open punches (`attendance.server.ts`). Demo fallback throughout.
- ✅ **Schedule persistence:** `Birta plan` → `publishSchedule` (`vaktaplan/actions.ts`) replaces the
  week's `shifts` rows (employee + shift-type resolved by name). Demo fallback (counts grid shifts).
- ✅ **Payroll + Payday export:** `Keyra launakeyrslu` → `runPayroll` (`launakeyrslur/actions.ts`)
  persists `payroll_runs` + `payroll_lines` using the shared Icelandic calc in `src/lib/payroll.ts`.
  Export buttons download CSV from `/api/payroll/export?format=payday|excel` (Payday-compatible,
  `;`-separated, UTF-8 BOM). Demo fallback computes from DEMO_EMPLOYEES.
- ✅ **Inventra → real-time labor%:** `src/lib/revenue.server.ts` `getLaborMetrics()` computes
  laun% = labor cost ÷ revenue from the `revenue` table (fed by Inventra) + latest payroll run;
  wired into the dashboard ring KPI. Settings → INVENTRA row triggers `syncInventraRevenue`
  (mock pull → inserts a `revenue` row → labor% updates). Demo fallback throughout.
- ✅ **EN i18n (app shell):** `src/components/app/lang.tsx` — `LangProvider` (context, localStorage
  persistence) + `useLang()` + DICT. Globe menu toggles IS/EN; nav groups/items, footer, topbar,
  account menu, support chat and cookie banner all translate. Per-screen *content* is still IS —
  extend by having screens `useLang()` (framework is in place).
- ✅ **Verktaki (contractor) access:** 4th option in the role-switch preview → contractor identity;
  nav already grants Mitt svæði + Spjall for `contractor` (see `nav.ts`). New-employee form maps
  "Verktaki" → `contractor` enum.
- ✅ **EN extended to screens:** `PageHeader` is now language-aware (translates every screen's
  title/subtitle via DICT keyed by the IS string); **Starfsfólk** is fully bilingual (KPIs, table
  headers, pills, footer). Other screens' inner content is still IS — extend by adding DICT keys +
  `useLang()` per screen.
- ✅ **Audit log:** `audit_log` table + RLS (`supabase/migrations/0004_audit.sql`). `logAudit()`
  (`src/lib/audit.ts`) is called from createEmployee/updateEmployee/runPayroll/publishSchedule/
  syncInventra. Settings shows an owner-only "Aðgerðaskrá / Audit log" card (`getAuditLog` server
  fetch, demo fallback). **Run migration 0004 after the earlier three.**
- ✅ **EN complete across every screen:** all per-screen inner content is now bilingual via
  `useLang()`/DICT — including the last/largest screen **Vaktaplan** (grid cells, shift-type
  legend + names, Day/Month views, the requests card, and all four modals: Shift types, Add
  employee, New shift, Ask AI). Globe toggle flips the whole app IS⇄EN.
- ✅ **Requests persistence:** new tables `shift_swaps` + `availability` and employee self-service
  RLS in `supabase/migrations/0005_requests.sql` (adds `auth_employee_id()`, employee-insert
  policies for leave_requests/shift_swaps/availability, employee self-update on employees).
  Mitt svæði `ReqModal` now captures inputs and calls Server Actions in `mitt-svaedi/actions.ts`:
  `submitLeaveRequest`, `requestShiftSwap`, `setAvailability`. Vaktaplan's "Beiðnir & opnar vaktir"
  card is now data-driven from `vaktaplan/requests.server.ts` (`getPendingRequests`, demo fallback);
  approve/reject call `updateLeaveRequest`/`approveShiftSwap` (`vaktaplan/actions.ts`) with real ids.
- ✅ **Timesheet approvals:** `timaskraning/actions.ts` (`approveTimesheet`, `approveAllTimesheets`).
  "Samþykkja allt" sets all pending `timesheets` → approved for the company. Demo fallback.
- ✅ **Documents & photos → Supabase Storage:** `supabase/migrations/0006_storage.sql` creates a
  private `documents` bucket + a public `avatars` bucket with company-scoped RLS. `uploadDocument`
  (`starfsfolk/actions.ts`, also persists a `documents` row) wired into DocsTab + the New-employee
  modal (staged files upload after create — `createEmployee` now returns the new id). `uploadPhoto`
  (`mitt-svaedi/actions.ts`) uploads the profile photo and saves `employees.photo_url`. Demo
  fallback throughout. **Run migrations 0005 then 0006 after 0001–0004; 0006 needs Storage enabled.**
- ✅ **Settings CRUD:** `stillingar/actions.ts` now has `addLocation`, `addPosition`, `inviteUser`
  (admin auth invite + company link). Settings buttons open a shared `SettingsFormModal`; the topbar
  "Búa til stað" + account-menu location deep-link via `/stillingar?new=location` (page reads
  `searchParams.new` → opens the right modal). Demo fallback throughout.
- ✅ **Manual revenue entry:** `addRevenue` (`stillingar/actions.ts`) inserts a `revenue` row
  (`source: 'manual'`) so businesses **without Inventra** can type in velta and see laun%. Opened
  from a new "Skrá veltu handvirkt" row in Settings → Tengingar and a "Skrá veltu" link on the
  dashboard labor% ring (both via `/stillingar?new=revenue`).
- ✅ **More persistence flows (no dead buttons in core flows):**
  - Vaktaplan: `saveShift` (ShiftEditModal "Vista"), `assignOpenShift` ("Úthluta"), and the AI
    result "Samþykkja & birta" now calls `publishSchedule`.
  - Mitt svæði: `updateMyProfile` (profile "Vista breytingar"), `applyForShift` (open-shift "Sækja
    um"), and a read-only **payslip modal** (`src/components/app/payslip-modal.tsx`) for "Sækja
    launaseðil".
  - Launakeyrslur: clicking a row opens the shared payslip modal; header "Flytja í Payday" now
    triggers the real CSV export.
  - Tímaskráning: single "Samþykkja" → `approveTimesheet(id)`, "Setja útstimplun" → `setClockOut`
    (fills the latest open punch's clock-out).
- ✅ **Supabase Auth + role-based route protection (§5):** email+password login
  (`login-form.tsx`), logout (`app-shell` → `/login`). `src/proxy.ts` → `updateSession`
  (`lib/supabase/middleware.ts`) redirects unauthenticated → `/login` AND enforces role access via
  `src/lib/access.ts` (`canAccess`/`homeFor`, derived from `nav.ts`; owner = superuser so the
  "view as role" preview still works). Roles: owner=all; manager=Mælaborð/Vaktaplan/Tímaskráning/
  Starfsfólk/Skýrslur/Stillingar; employee+contractor=Mitt svæði/Spjall. `scripts/setup-owner.mjs`
  (service-role) creates+links the owner; `scripts/verify-supabase.mjs` checks keys/tables/buckets.
- ✅ **Live data wiring (screens read from Supabase, demo fallback):**
  - Starfsfólk (`getEmployees`), labor% ring (`getLaborMetrics`), Beiðnir-spjald
    (`requests.server`), "Á vakt núna" (`attendance.server`), Aðgerðaskrá (`getAuditLog`) — already live.
  - **Launakeyrslur** (`payroll.server` — latest run lines, else `computeLine` over real employees),
    **Vaktaplan grid** (`schedule.server` — real employees + published shifts mapped into the grid),
    **Mælaborð KPIs** (`dashboard.server` — weekly labor cost/hours from employees), **Stillingar
    listar** (`settings.server` — locations/positions/users + employee counts). All verified
    logged-in against the connected project.
  - Still demo per-employee until those tables fill with use: Tímaskráning rows, Mitt svæði detail,
    dashboard charts.
- ✅ **Period-aware toggles:** Vaktaplan's top KPIs follow the Vika/Dagur/Mánuður view (hours,
  cost, shift count recomputed from the visible grid + selected day). Skýrslur and Frammistaða
  period segments (Dagur/Vika/Mánuður/Ársfj./Ár) now scale the period-extensive figures (revenue,
  cost, hours, time-bank) by a period factor while true rates/ratios (laun%, per-hour, attendance %)
  stay stable; comparison badges update per period. Demo-grade scaling until real period
  aggregations are wired.
- ✅ **UX-hreinsun & stjórnendagögn (júlí 2026):** dedup á mælaborði (hero-röndin á tölurnar, KPI-röðin
  sýnir bara NÝJAR upplýsingar: laun%-hringur, yfirvinnukostnaður, álagstímar, launatengd gjöld, kr/klst);
  **Skýrslusafnið er alvöru** — `skyrslur/actions.ts` `getManagerReport()` (hours/overtime/attendance/
  timebank) + generic `exportTableXlsx/Pdf` í `export-report.ts`, birt í BÆÐI demo- og live-view með
  tímabili síunnar; **Frammistaða live** — `frammistada/perf.server.ts` `getPerfHistory()` (velta/kostn./
  laun% per mánuð + deildaskipting), samanburðartafla mán vs mán, KPI-haus fylgir nýjasta mánuði;
  **chart-hover** — `.ctip` tooltip í `charts.tsx` (Bars/Stacked/Paired taka `labels`); **Stillingar** —
  "Fyrirtækið mitt" spjald (nafn/kt/heimilisfang/sími/netfang → `saveCompanyInfo`, migration **0026**),
  Aðgerðaskrá-flipinn fjarlægður (logAudit skrifar áfram í töfluna); **Mitt svæði live** —
  `mitt-svaedi/my.server.ts` `getMyArea()` (vikuplan, næstu vaktir, opin stimplun í PunchCard, launamat
  úr punches m. classifyPay, orlof/tímabanki, prófílgögn, opnar vaktir) + innskráður án starfsmannaprófíls
  fær tómstöður en ALDREI demo; **Spjall** — ólesin merki (localStorage seen), tímastimplar, röðun eftir
  virkni (Almennt fest efst), listi endurhlaðast í pollinu; **getDashboardPeriod** — 40-daga þakið →370,
  áætluð vikudagsvelta fyllir daga ÁN rauntalna (raun vinnur alltaf per dag) svo sérsniðið tímabil
  summar velta/laun% rétt; **AI-vaktaplan skilar nú `shifts`** (employee/day/start/end) sem
  `approveAiProposal` setur í gridið og birtir — samhengið inniheldur núverandi plan + raunveltu vikunnar.
  Öll ný UI-strengir í DICT (IS/EN). Migration 0025+0026 bætt í RUN_ALL.
- ⚠️ **AI er EKKI virkt:** `ANTHROPIC_API_KEY` er tómur í `.env.local` og EKKI settur á Vercel —
  `/api/ai/schedule` fellur á demo-tillögu. Setja lykil (console.anthropic.com) + `vercel env add`.
- **Still remaining:** contractor billable-vs-cost/GPS job tracking, a signed-URL viewer for the
  private `documents` bucket, Google/Microsoft/Auðkenni OAuth (scaffolded in `login-form`).
- ✅ **VAKTO Admin (ofurstjórnborð SaaS-eigandans):** `/admin` — aðgangur EINGÖNGU fyrir netföng í
  `VAKTO_ADMIN_EMAILS` (default bjarniludviks@icloud.com; síðan redirect-ar aðra á /maelabord).
  `src/lib/vakto-admin.server.ts` (`isVaktoAdmin`, `getAdminOverview` — service-role yfir ÖLL fyrirtæki:
  notendur/starfsmenn/staðir/síðasta virkni/plan/prufa/greiðslustaða/MRR). KPI: fyrirtæki, notendur,
  borga, MRR (9.990 + 990×umfram-notanda, telur bara „paying"). Aðgerðir í `admin/actions.ts`:
  `setBillingStatus` (paying/unpaid/free/auto — handvirkt þar til Teya) + `extendTrial` (+14 d, þolið
  án 0027). Migration **0027** (`billing_status` á companies). „VAKTO Admin" hlekkur í account-valmynd
  (shield-íkon) fyrir admin. Sannreynt e2e á prod-gögnum (2 fyrirtæki, trial-framlenging virkar).
  **Næsti fasi (ákveðið af eiganda):** mobile app (eigandi með ákveðna leið — SPYRJA hann), Apple
  Wallet skírteini (WalletButtons til), alvöru stuðningsspjall við eigandann, Teya-áskriftir tengdar
  Payday (mánaðarreikningar sjálfvirkt — kveikja þá á sjálfvirkri greiðslustöðu í /admin).
