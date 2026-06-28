# VAKTO — Build Brief for Claude Code

> **READ THIS FIRST. The design is finished. Do not redesign anything.**
> Four prototype HTML files define exactly how VAKTO looks and works. They are the
> single source of truth. Open each file in a browser (or screenshot it) and
> **replicate it pixel‑for‑pixel** in the real app. When in doubt, match the prototype.
> Hönnunin er heilög — engin ágiskun, engin „endurhönnun". Hermdu eftir.

---

## 0. The package (what you were given)

| File | What it is | Build as |
|---|---|---|
| `vakto-heimasida.html` | Marketing website (IS/EN, hero, features, pricing, FAQ, signup modal) | Public site, route `/` |
| `vakto-login.html` | Staff login (split screen, social + Auðkenni) | Route `/login` |
| `vakto-app.html` | **The whole app** — every screen for every role (dashboard, schedule, attendance, payroll, employees, reports, performance, employee self‑service, chat, help, settings) | The product, behind auth |
| `vakto-kiosk.html` | Shared on‑site time clock with **PIN** | Route `/kiosk`, runs on a shared tablet, no login |
| `VAKTO-DESIGN-SYSTEM.md` | Token recipe (font, colors, spacing) | Reference |
| `vakto-stefna.html` | Market analysis & strategy (context only) | Read for context |

**Workflow per screen:** open the prototype → build the real screen to match → screenshot your build → compare to prototype → fix until identical. 1–2 passes per screen.

---

## 1. Product in one line

VAKTO is a **workforce‑profitability platform** for Icelandic businesses (small → 1000‑person chains, internationally scalable): scheduling → attendance → payroll → profitability, in one beautiful system. Signature metric: **labor cost as % of revenue**, real‑time, color‑coded. Sibling product to INVENTRA (same skeleton, orange instead of green).

Three+ roles, each with a different view: **Stjórnandi** (owner), **Vaktstjóri** (manager), **Starfsmaður** (employee), and **Verktaki** (contractor — phase 2). Plus the **kiosk** (no login).

---

## 2. Design system — use these EXACT tokens

```
Font:   General Sans (Fontshare) — weights 400,500,600,700 (700 is the heaviest; never use 800)
        <link href="https://api.fontshare.com/v2/css?f[]=general-sans@400,500,600,700&display=swap">
        stack: "General Sans","Plus Jakarta Sans",ui-sans-serif,system-ui,-apple-system,sans-serif
        letter-spacing: body -.011em; headings -.02em to -.03em

Brand (orange):  --brand #e9700f  --brand-2 #f59331  --brand-deep #cf5f0c  --brand-soft #fdf1e6
Ink/neutral:     --ink #1a1a1f  --ink2 #5f6470  --ink3 #9296a6
Lines/bg:        --line #e6e6e9  --line2 #f3f3f5  --bg #f4f4f6  --panel #fff
Semantic:        --good #1f9d6b  --warn #bf8f3a  --bad #d8483a  --teal #1f9e9e

Radius:   cards 14px, buttons 10–12px, pills 999px
Shadow:   card 0 1px 2px rgba(18,18,40,.04), 0 12px 30px -16px rgba(18,18,40,.14)
Spacing:  card padding ~22px, grid gaps 20px, section margins ~32px (generous / airy — like INVENTRA)
Logo:     three ascending bars (orange #f59331/#e9700f/#cf5f0c) + "VAKTO" wordmark, weight 700, letter-spacing .04em
Icons:    line icons only (lucide style). **NO EMOJIS anywhere.**
```

Positive money deltas use `--good` (green); high labor% uses `--warn`/`--bad`. Labor% is the one metric where **lower is better**.

---

## 3. App shell (vakto-app.html)

- **Sidebar 250px**, white, right border. Logo top. Grouped nav with small gray uppercase headers: **Dagleg vinna** (Mælaborð, Vaktaplan, Tímaskráning), **Laun & fólk** (Launakeyrslur, Starfsfólk), **Greining** (Skýrslur, Frammistaða). **Active item = light‑gray pill bg + orange icon + bold dark text** (not an orange fill). **Stillingar + Hjálp pinned at the very bottom**, separated by a top border.
- **Topbar 66px**: search **centered** (wide), right cluster flush to the edge: globe (language), **`+ Búa til`** (orange, with chevron), bell (with dot), account (avatar + company + chevron → dropdown: Skipta um hlutverk, Velja fyrirtæki/stað, Stillingar, Hjálp, Dökkt útlit, Útskrá).
- **Floating support chat bubble** bottom‑right (orange). **Cookie consent banner** bottom‑left.
- In‑content page header: big title + gray subtitle (left), primary actions (right). Help page hides this header (it has its own centered hero).
- **Everything is mobile‑friendly.** Sidebar collapses off‑canvas under ~760px; the employee self‑service area and kiosk are mobile‑first. Scheduling grid scrolls horizontally on phones (sticky name column).

---

## 4. Screen inventory (build every one — match the prototype)

**Marketing site** (`vakto-heimasida.html`): nav + IS/EN toggle, hero with 3D app mock, trust row, 6 feature cards, 4‑step flow (Vaktaplan→Mæting→Laun→Arðsemi), integrations row, pricing (Frítt / **Pró 990 kr/notanda** / Verk 1.290 / Enterprise), FAQ accordion, CTA, footer, signup/login modal.

**Login** (`vakto-login.html`): left form (Netfang, Lykilorð, Muna mig, Skrá inn, Google/Microsoft/**Auðkenni** rafræn skilríki, Stofna aðgang), right orange hero panel.

**App screens** (in `vakto-app.html`):

1. **Mælaborð (Dashboard)** — orange "Í gær" hero strip (Áætlaðir tímar → Raun → Frávik → Yfirvinna, + big "Launakostnaður gærdagsins"); labor KPIs with vs‑comparison; **Launakostnaður — samanburður** chart (this vs prev, Vika/Mánuður/Ár toggle); **"Vinnum við eftir plani?"** card listing who's over/under plan; **Þarf athygli** (overtime/rest/missing punch); monthly KPIs vs last month. Customizable via **Sérsníða** button. "Komdu þér af stað með VAKTO" onboarding card (5 steps).
2. **Vaktaplan (Schedule)** — week/day/month views. Drag‑drop grid (sticky name column, today column highlighted, colored shift chips with left accent, dashed "add" cells). Toolbar: week nav, **department filter**, **`Biðja AI`** (natural‑language scheduling), `+ Vakt`. Page header: `Afrita viku` + `Birta plan`. **Vaktategundir** manager (create custom shift types: name, time, premium, color). **Add/remove employees on the plan** (`+ Bæta starfsmanni` row below totals; ✕ on row hover). **Copy/paste shifts** (copy in editor → paste‑mode banner → click cells). AI‑vaktaplan presets + **"Tímar eftir dögum"** breakdown. Open shifts / swap / leave requests to approve. **No revenue/labor% here — schedule is plan & hours focused.**
3. **Tímaskráning (Attendance)** — KPIs (á vakt, of seint, vantar útstimplun, frávik); "Fer yfir áætlun" list; "Áætlað vs raun í dag"; **timesheet table** (planned vs actual, status, approve) with **Samþykkja allt**. Search + department filter + CSV export.
4. **Launakeyrslur (Payroll)** — pay‑run header (period 21st→20th, status Drög, **Keyra launakeyrslu** → Payday); KPIs (útborgað, heildarkostnaður/byrði, staðgreiðsla, tryggingagjald); **per‑employee table** (tímar, brúttó, staðgreiðsla, lífeyrir+félag, útborgað) → click for payslip; monthly stacked chart; **byrði breakdown**; export (Payday / Excel).
5. **Starfsfólk (Employees)** — list with wage profile (taxti, starfshlutfall, kjarasamningur, status); click → profile modal with tabs **Laun / Vinna / Frí / Skjöl / Persónulegt**. **`+ Búa til` → Nýr starfsmaður**: full form (Persónulegt incl. kennitala/banki, Starf & aðgangur incl. role + **Verktaki**, Laun, **Skjöl with document upload** — ráðningarsamningur etc.). Per‑employee **document upload + list**.
6. **Skýrslur (Reports)** — period toggle + employee search + department filter + **vs‑previous comparison**; planned‑vs‑actual table; **tímabanki** table; **report library** (one‑click PDF/Excel: launatímar, yfirvinna, mæting, orlof/réttindi). Export in page header.
7. **Frammistaða (Performance)** — **owner business view**: KPIs with deltas (Velta, Launakostnaður, Laun%, Framlegð); **period comparison table** (this / last / last‑year, incl. **Velta vs spá** and **Unnið eftir áætlun**); velta‑vs‑labor chart; labor% trend; **per‑location comparison**; department breakdown; launasundurliðun. Export in page header.
8. **Mitt svæði (Employee self‑service)** — mobile‑first; profile header with **photo upload**; tabs **Yfirlit** (clock in/out, next shifts, tasks, quick actions), **Mínar vaktir** (week + open shifts/availability/swap), **Laun** (full payslip breakdown + history + download), **Réttindi** (orlof, tímabanki, veikindi, hvíldartími), **Prófíll** (photo + editable info).
9. **Spjall (Chat)** — team/manager messaging (employee‑facing).
10. **Hjálp (Help)** — centered "Hvernig getum við aðstoðað?" hero + search + 6 topic cards + "Opna spjall". (No standard page header.)
11. **Stillingar (Settings)** — company info, kjarasamninga/premium rules, deductions, integrations, locations, positions, users & access, subscription/billing.
12. **Kiosk** — see §6.

---

## 5. Roles & access matrix

| Screen | Stjórnandi (owner) | Vaktstjóri (manager) | Starfsmaður (employee) | Verktaki (contractor)* |
|---|---|---|---|---|
| Mælaborð, Vaktaplan, Tímaskráning | ✓ | ✓ | — | — |
| Launakeyrslur, Frammistaða | ✓ | — | — | — |
| Starfsfólk, Skýrslur | ✓ | ✓ | — | — |
| Stillingar, Áskrift/greiðslur | ✓ | — | — | — |
| Mitt svæði (own shifts/pay/rights) | — | — | ✓ | ✓ (own hours & jobs) |
| Spjall | ✓ | ✓ | ✓ | ✓ |

Role is chosen when creating an employee. Owner can switch role to preview (account menu → Skipta um hlutverk). *Verktaki = phase 2: own time + job/GPS tracking, billable vs cost.

---

## 6. Kiosk (`vakto-kiosk.html`)

Standalone page on a shared workplace tablet/computer (no login). Header: VAKTO logo + company + live clock/date. Grid of employee tiles (avatar, name, "Á vakt"/"Ekki á vakt"). Tap a tile → **4‑digit PIN pad** (per‑employee PIN prevents clocking in as someone else) → on correct PIN, punch in/out with confirmation; wrong PIN shakes + "Rangur kóði". Options to support later: photo capture, GPS, IP‑lock to location. Clock‑ins must flow live into the manager **Tímaskráning** view.

---

## 7. AI — everywhere (this is the differentiator)

- **Natural‑language scheduling** (`Biðja AI`): user types e.g. *"Settu Ómar á 2‑2‑3 vaktir 11:00–22:00 yfir allan maí"* → AI generates the shifts, respects rest‑time, flags overtime, shows labor% impact → user approves & publishes. Also presets: lower labor cost 10%, minimize overtime, keep labor under 30% of revenue.
- **Dashboard AI insights** ("AI ábending: hádegismönnun á þriðjudögum of þung…").
- **Attention/anomaly detection**: overtime risk, rest‑time violations, missing punch, who's over/under plan.
- **Demand‑based staffing** suggestions from revenue forecast.
Implement with an LLM tool‑calling layer that reads schedule + rules + revenue and returns a proposed shift set the user confirms. AI never auto‑applies without approval.

---

## 8. Data model (Postgres / Supabase suggested)

```
companies(id, name, location, currency, default_burden)
locations(id, company_id, name, timezone)
departments(id, location_id, name)            -- Eldhús, Sal, Stjórnun
positions(id, company_id, name, base_rate)    -- Kokkur, Þjónn, Bílstjóri
users(id, company_id, email, role)            -- owner|manager|employee|contractor
employees(id, user_id, company_id, location_id, department_id, position_id,
          kennitala, phone, bank_account, pay_type, rate, employment_ratio,
          union_agreement, hire_date, photo_url, status)
shift_types(id, company_id, name, start, end, premium_pct, color)   -- editable
shifts(id, company_id, location_id, employee_id, date, start, end, shift_type_id, status, published)
punches(id, employee_id, shift_id, clock_in, clock_out, source)     -- kiosk|app|web ; source PIN/GPS
timesheets(id, employee_id, period, planned_hours, actual_hours, status)  -- pending|approved
leave_requests(id, employee_id, type, from, to, status)             -- orlof|veikindi|ólaunað
shift_swaps(id, from_employee, to_employee, shift_id, status)
availability(id, employee_id, weekday, available)
open_shifts(id, shift_id, applicants[])
time_bank(id, employee_id, period, required_hours, worked_hours, balance)
payroll_runs(id, company_id, period_start, period_end, status)      -- draft|approved|sent
payroll_lines(id, run_id, employee_id, hours, gross, day_pay, premiums, overtime,
              withholding, pension, union, net)
documents(id, employee_id, name, type, url, signed_at)              -- ráðningarsamningur, skattkort…
integrations(id, company_id, kind, status)                          -- payday|dk|inventra|pos
revenue(id, location_id, date, amount, source)                      -- for labor% (manual or Inventra)
audit_log(id, company_id, user_id, action, entity, before, after, at)
```

---

## 9. Icelandic payroll logic (the hard core — build carefully or buy)

- Base example **2.900 kr/hr**. Premiums: **+33%** morning (weekdays before 07:00) / evening, **+45%** weekend, **+90%** overtime (>43 h/week). **Only the highest applicable premium applies**, never stacked.
- Employee deductions: **pension 4% + union 1% + staðgreiðsla** (withholding) with **personal allowance 68.691 kr** ("persónuafsláttur").
- Employer burden ~**30.2%**: orlof **10.17%**, mótframlag lífeyris **11.5%**, tryggingagjald **6.35%**, union ~1.5%.
- **Labor % of revenue = total labor cost (incl. burden) ÷ revenue.** Target ~30%; green ≤30, amber ≤33, red >33.
- Respect red/public holidays (affect premiums) and 11‑hour rest rule. Support multiple **kjarasamningar** (Efling/SGS, VR, Matvís…) selectable per employee; this rules engine is the main competitive moat — **consider buying/licensing or hiring a payroll specialist** rather than reinventing it. Get it right; wrong pay destroys trust fastest.

---

## 10. Integrations (build order)

1. **Payday** (payroll export — first, most important). 2. **Inventra / POS** (revenue in → real‑time labor%). 3. **DK, Uniconta, H3** (accounting/payroll). All via API; design as pluggable connectors (see Stillingar → Tengingar in the prototype).

---

## 11. Recommended stack & build order

**Stack:** TanStack Start (or Next.js) + Tailwind + shadcn/ui + Supabase (Auth incl. social + e‑ID later, Postgres, Storage for documents/photos). Host on the `vakto.is` domain; `vakto.io` for international.

**Phase 1 — sellable MVP (restaurant/retail pilot = your own business):** auth + company/locations + employees (wage profile, docs, roles) + scheduling (drag‑drop, shift types, AI prompt, publish) + kiosk (PIN) + attendance (punch → approve) + payroll run with the core kjarasamninga calc + **Payday export** + dashboard/reports. Mobile employee area.

**Phase 2:** Inventra/revenue → labor%, deeper rights/time‑bank, GPS job tracking + **Verktaki** access, more integrations, audit log, automatic/scheduled reports, push notifications.

**Phase 3:** complex public‑sector agreements, AI shift optimization, multi‑language / international payroll, SSO/enterprise.

---

## 12. Drop this into the repo as `CLAUDE.md`

```
VAKTO build rules:
- The four prototype HTML files are the design source of truth. Match them exactly. Do not redesign.
- Font General Sans; brand orange (#e9700f); neutrals/semantic per the token list. No emojis — line icons only.
- Generous spacing, 14px card radius, soft shadows (INVENTRA‑like airiness).
- UI language is Icelandic (labels as in the prototypes); support EN. Everything mobile‑friendly.
- Three roles (owner/manager/employee) + contractor + kiosk; respect the access matrix.
- Labor % of revenue is the signature metric (lower is better; color‑coded).
- AI scheduling and insights require user approval before applying.
- Never reproduce wrong pay: the kjarasamninga calc must be verified against real agreements.
- Per screen: build → screenshot → compare to prototype → fix until identical.
```
