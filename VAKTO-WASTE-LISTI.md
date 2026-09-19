# VAKTO — WASTE-listi (úttekt 19. sept 2026)

Úttekt á öllum skjáum vefsins fyrir UX-einföldun. Ekkert hefur verið breytt. Skráartilvísanir eru
`skrá:lína`. Flokkar: **A** = falskt/skreyting sem villir um fyrir notanda · **B** = tvöfalt ·
**C** = of flókið / lítið notað · **D** = öryggi/persónuvernd (fannst í leiðinni, ekki WASTE en verður að laga fyrir sölu).

Tillaga um meðferð: **SKERA** (eyða kóða) · **FELA** (halda kóða, taka úr sjálfgefnu viðmóti, aðgengilegt undir „Ítarlegt") · **SAMEINA** (ein útfærsla).

---

## A. Falskt eða skreyting sem lítur út fyrir að virka — SKERA

| # | Hvað | Hvar | Tillaga |
|---|---|---|---|
| A1 | Fljótandi „aðstoðar-spjall" FAB neðst til hægri: tvö föst svarbubblur, innsláttur gerir ekkert, „Senda" = toast, fast rautt „1" ólesið-merki á ÖLLUM skjám fyrir ALLA notendur | `app-shell.tsx:317-342` | SKERA. Hjálp vísar líka í hann (`help-screen.tsx:193-205`) — fjarlægja línuna. |
| A2 | Tilkynningabjalla sýnir alltaf „Engar nýjar tilkynningar", engin gagnalind | `app-shell.tsx:216-222, 267-274` | SKERA þar til raunveruleg tilkynningaskrá er til (push-sagan gæti orðið hún). |
| A3 | Áskrift-flipi í Stillingum: fast „virk", „Næsta greiðsla 13. júlí 2026", falskt kort „VISA •••• 1817", „Uppfæra kort"/„Reikningar" = toast | `settings-screen.tsx:237-247` | SKERA og setja inn raunverulegan Stripe-hluta þegar hann kemur (liður 4). |
| A4 | „Forskoða" launakeyrslu = toast | `payroll-screen.tsx:133` | SKERA hnappinn. |
| A5 | INVENTRA merkt „tengt" (fast) og „sync" býr til mock-veltulínu | `settings-screen.tsx:140`, `stillingar/actions.ts:33` | Merkja „ekki tengt" / „væntanlegt", slökkva á mock-sync í prod. |
| A6 | „Land & launareglur: Ísland (virkt)" — fast HTML, ekki lesið úr neinu | `settings-screen.tsx:69-88` | SKERA; kemur aftur sem raunveruleg stilling í lið 3. |
| A7 | Tryggingagjald 6,35% / lífeyrir 11,5% / orlof 10,17% sýnt sem statlines í Stillingum og „Byrði"-kort í Launakeyrslum — hvorugt lesið úr launavélinni og passar ekki við `BURDEN=0.302` | `settings-screen.tsx:76-78`, `payroll-screen.tsx:211-230` | SKERA „Byrði"-kortið; statlines koma úr Ísland-pakkanum í lið 3. |
| A8 | „Samþykktir tímar" grænt merki alltaf sýnt, líka þegar ósamþykktir tímar eru í tímabilinu | `payroll-screen.tsx:119-123` | Gera skilyrt eða skera. |
| A9 | AI-vaktaplan: `/api/ai/schedule` skilar fastri demo-tillögu (14 vaktir, „Ómar 2-2-3") með HTTP 200 við hvaða villu sem er | `api/ai/schedule/route.ts` | Skila villu, ekki fölsuðum gögnum. Halda AI-hnappnum aðeins ef lykillinn er stilltur. |
| A10 | „Úthluta" opinni vakt skrifar aðeins audit-línu, úthlutar engu | `vaktaplan/actions.ts:290-304` | SKERA demo-hlutann; live-leiðin (`applyForShift`) er til. |
| A11 | „Hvíldartími (11 klst): Í lagi" — alltaf „Í lagi" | `employee-screen.tsx:550` | SKERA þar til reiknað. |
| A12 | Apple/Google Wallet hnappar sýna „væntanlegt" á TVEIMUR stöðum (Prófíll-flipi og Skírteini-modal) | `employee-screen.tsx:619`, `staff-card.tsx:133-146` | Einn staður (skírteinið). Virkjast í lið 6. |
| A13 | `/api/wallet/pass` — dautt scaffold, skilar 501; `/api/wallet/[provider]` er sú raunverulega | `api/wallet/pass/route.ts` | SKERA. |
| A14 | „Sérsníða" á demo-mælaborði = toast; PRESETS-fylki sem ekkert birtir | `dashboard-screen.tsx:425-433, 91-94` | SKERA. |
| A15 | Excel/PDF í demo-Frammistöðu = toast | `performance-screen.tsx:256-257` | SKERA með demo-trénu (C1). |
| A16 | `coming-soon.tsx` — hvergi notað | `components/app/coming-soon.tsx` | SKERA. |
| A17 | POS „Óska eftir tengingu" = setTimeout + toast | `settings-screen.tsx:770-803` | SKERA eða tengja við raunverulegt form/póst. |
| A18 | Villuskilaboð sem leka „Keyrðu migration 0042 í Supabase" til endanotenda | `spjall/actions.ts:343`, `mitt-svaedi/actions.ts:86`, `timaskraning/*`, o.fl. | Ein almenn villa; migration-texti aðeins í logg. |
| A19 | Hjálp: 8 af 10 leiðbeiningum eru um eigendaskjái en starfsmenn eru einu sem sjá síðuna í nav | `help-screen.tsx:14-128` | Sía eftir hlutverki eða skera niður í 3 leiðbeiningar fyrir starfsfólk. |

## B. Tvöfalt — SAMEINA

| # | Hvað | Hvar | Tillaga |
|---|---|---|---|
| B1 | **Laun % af veltu reiknað á 4 vegu** með 4 formúlum (mánuður-til-dags með 32,1% demo-fallbacki; tímabil með áætlaðri veltu; per mánuð; samningsbundnir tímar) | `lib/revenue.server.ts:14-51`, `maelabord/actions.ts:149-194`, `frammistada/perf.server.ts:105`, `lib/analytics.server.ts:97-117` | EIN fall `laborPct(company, from, to)` í `src/lib/labor.ts`. Allt annað kallar í hana. Forsenda fyrir „einni tölu" á mælaborði. |
| B2 | **Launaútreikningur útfærður 4 sinnum** (lib/payroll.ts, `payrollPreview` í Starfsfólki með 173 í stað 173,33, „Byrði"-kort, analytics.server) | `employees-screen.tsx:31-47`, `payroll-screen.tsx:216-227`, `analytics.server.ts:76-83` | Ein vél í `lib/payroll.ts`. |
| B3 | „Vaktaplan vs raun-tímar" tafla á 3 stöðum (Tímaskráning, Innsýn/Tímar live, Innsýn demo) | `attendance-screen.tsx:268+`, `reports-screen.tsx:314-335, 194-213` | Halda í Tímaskráningu; Innsýn vísar þangað. |
| B4 | „Á vakt núna" á 3 stöðum (mælaborð KPI + mælaborð kort + Tímaskráning) | `dashboard-screen.tsx:316-320, 367-381` | Mælaborð: aðeins KPI sem drill-down í Tímaskráningu. |
| B5 | Áætlað vs raun tímar þrisvar á mælaborðinu (hero + línurit + tafla) | `dashboard-screen.tsx:275-279, 330-337, 384-406` | Eitt. |
| B6 | Opnar vaktir + „Sækja um" frá 4 leiðum (Mitt svæði x2, Planið flipi, Planið modal) | `employee-screen.tsx:626, 391`, `plan-screen.tsx:213, 307` | Ein: Vaktir → „Lausar". |
| B7 | `QuickActions` tvisvar á sama skjá; mitt vaktaplan bæði í Mitt svæði og Planið; næsta vakt á 3 stöðum; unnir tímar í tveimur flipum | `employee-screen.tsx:323, 391, 363, 302, 325` | Leysist með nýju 3-hluta starfsmannaviðmóti. |
| B8 | Excel-útflutningur 3 hnappar, Payday 2 hnappar á Launakeyrslum | `payroll-screen.tsx:101-105, 156, 231-241` | Ein „Flytja út" valmynd. „Útflutningur"-kortið burt. |
| B9 | Excel/PDF bæði í haus og í FilterBar á Innsýn | `reports-screen.tsx:280-281, 292-293` | Eitt. |
| B10 | `StaffingCard` birt þrisvar (tvisvar í live-tré) | `performance-screen.tsx:235, 248, 365` | Villa — laga. |
| B11 | Allt að 3 óháðir tímabilsveljarar á einum Innsýn-flipa (FilterBar + PeriodPicker + AI-kort) | `reports-screen.tsx`, `performance-screen.tsx:146`, `ai-report.tsx` | Einn per skjá. |
| B12 | Vaktaplan: vakt breytt frá 6 leiðum, eytt frá 6 leiðum, vaktategund frá 3, tvö klemmuspjöld (`clip`, `monthClip`), AI frá 2 stöðum | `schedule-screen.tsx` | Vikusýn + ein vaktar-modal. Sjá C2. |
| B13 | Hjálparföll afrituð: `codeForStart` x3, `companyOf` x6, mánudags-fall x5, ísl. mánaða/vikudaga-fylki í 10+ skrám | sjá úttekt | `lib/dates.ts` + `lib/company.server.ts`. Forsenda i18n/tímabelta í lið 3. |
| B14 | Tvö algjörlega aðskilin viðmótstré (demo + live) á Mælaborði, Vaktaplani, Innsýn (báðir flipar), Launakeyrslum, Mitt svæði, Tímaskráningu — ~1.500+ línur eingöngu fyrir útskráð demo | `dashboard-screen.tsx:419-537`, `schedule-screen.tsx:25-57`, `reports-screen.tsx:169-234`, `performance-screen.tsx:252-367`, `attendance-screen.tsx:30-160` o.fl. | SKERA demo-trén. Demo-upplifun = seed-fyrirtæki í staging („Kaffi Krónan") sem prufunotendur fá. Stærsti einstaki sparnaðurinn. |
| B15 | Emoji-viðbrögð: 3 mismunandi pallettur (spjall 6, spjall-stika 16, fréttaveita 6 aðrar); afmælispóstur með 🎂 sem avatar (brýtur „engin emoji"-reglu) | `chat-screen.tsx:15-16`, `feed-screen.tsx:16`, `spjall/actions.ts:474` | Ein palletta; afmælispóstur með línu-ikoni. |

## C. Of flókið eða lítið notað — FELA eða SKERA

| # | Hvað | Hvar | Tillaga |
|---|---|---|---|
| C1 | Mælaborð: 9 KPI + 4 widgets + „Sérsníða"-ham + onboarding-strip + línurit sem er fast við 7 daga og hunsar tímabilsvalið + tómt „Mánaðaryfirlit" | `dashboard-screen.tsx:198-417` | EIN tala efst (laun%), 3 stuðnings-KPI, allt annað drill-down. Sérsníða + Mánaðaryfirlit SKERA. |
| C2 | Vaktaplan: Dagsýn og Mánaðarsýn eru þriðja og fjórða kóðaleiðin fyrir sömu aðgerðir; mánaðar-KPI eru margfaldaðir ×4,33 (falskir); `COST_HR = 3752` fast í stað taxta starfsmanna | `schedule-screen.tsx:898-940, 1112-1234, 25, 368-374` | FELA Dag/Mánuð (halda kóða, taka úr segment), kostnaður úr raunverulegum töxtum eða sleppa. |
| C3 | Vaktaplan: 3 fastar AI-prompt kort, raddinnsláttur (is-IS), „Stilla þörf"-modal, AI-vísbending í demo | `schedule-screen.tsx:943-957, 1438-1460, 1329-1350` | FELA undir „…" valmynd. AI aðeins ef lykill stilltur. |
| C4 | Innsýn: `CustomSections` (endurröðun í localStorage), ReportLibrary með 7 skýrslum, AI-skýrslukort sem fýrar 7 server-köll per spurningu | `reports-screen.tsx:298`, `performance-screen.tsx:153`, `ai-report.ts:30-41` | Halda 3 skýrslum (arðsemi, launakostnaður, mæting). Fjarlægja CustomSections. AI-kort undir „Ítarlegt". |
| C5 | Starfsfólk → Laun-flipi: sérálagabönd, yfirvinnumörk, hlunnindi-listi, „Reiknaður mánaðarkostnaður" — 330 línur | `employees-screen.tsx:378-711` | FELA undir „Sérreglur" (aðeins þegar „Eigin reglur" er valið). |
| C6 | Starfsfólk: `DEMO_DOCS` birtast þar til gögn hlaðast; „Orlof & frí: —" placeholder; „Tímabelti: Atlantic/Reykjavik" fast | `employees-screen.tsx:878-882, 871-872, 806` | SKERA demo-skjöl og placeholder; tímabelti kemur úr stað í lið 3. |
| C7 | Mitt svæði: 5 flipar + 2 QuickActions + demo-gátlisti + demo-línur í öllum flipum | `employee-screen.tsx` | Kemur í stað: 3 hlutir (sjá tillögu neðar). |
| C8 | Stillingar: 6 flipar, 857 línur; „Sjálfvirkt gegnum API" er bara flipaskipti | `settings-screen.tsx:143` | 4 flipar: Fyrirtæki · Launareglur · Tengingar · Notendur. Áskrift kemur með Stripe. |
| C9 | Topbar „Búa til"-valmynd sýnd starfsmönnum sem er svo hent út af `canAccess` | `app-shell.tsx:259-266` | Fela fyrir employee/contractor. |
| C10 | Hlutverks-forskoðun með fölsuðum auðkennum („Jón G.", „Mína Huong") | `app-shell.tsx:348-390` | Halda virkninni, nota raunverulegan starfsmann úr fyrirtækinu. |
| C11 | Fréttaveita: afmælispóstur keyrður á hverri síðuhleðslu (`checkBirthdays()` í page.tsx) auk cron | `frettaveita/page.tsx:9` | Aðeins cron. |
| C12 | Kiosk PIN = síðustu 4 í kennitölu og 10-stafa kennitölu-stimplun | `kiosk/actions.ts:15, 88` | Ísland-pakki (liður 3); almennt = 4-stafa PIN úr `employees.pin`. |

## D. Öryggi og persónuvernd — LAGA áður en selt er (fundið í leiðinni)

| # | Hvað | Hvar | Áhætta |
|---|---|---|---|
| D1 | `chat` storage-bucket: `chat_read` hefur enga fyrirtækja-afmörkun → hver innskráður notandi getur lesið spjall-viðhengi ANNARRA fyrirtækja | `0014_chat_media.sql:39` | Há. Bæta `channel_company()`-skilyrði. |
| D2 | Kiosk: `company`-UUID í URL, engin leynd → hver sem hefur UUID sér nöfn, upphafsstafi og hver er á vakt | `kiosk/page.tsx:12-14` | Miðlungs. Kiosk-token per fyrirtæki (þegar til `api_keys`-mynstur). |
| D3 | Nýir auth-notendur fá sjálfgefið hlutverkið **owner** í trigger | `0002_rls.sql:27-43` | Há ef nýskráning er opin. Sjálfgefið `employee`, owner aðeins við stofnun fyrirtækis. |
| D4 | `avatars`-bucket opinn (myndir starfsfólks aðgengilegar með URL) | `0006:43` | Lág–miðlungs (GDPR). Signed URLs. |
| D5 | „Skrá inn sem" í admin skiptir út admin-lotunni, engin leið til baka; audit fer aðeins í tenant-log, ekkert platform-log | `admin/actions.ts:81-119` | Laga í lið 4: sér platform-audit + „aftur í admin". |
| D6 | Kiosk-stimplanir og `/api/v1/revenue` skrifa ekki í audit_log; enginn logg á útflutningi/lestri launagagna | `kiosk/actions.ts`, `api/v1/revenue` | GDPR: logga útflutning launagagna. |
| D7 | `mobile/scripts/verify-data.mjs` með staging-lykilorð í klartexta í repo; `mobile/.env` committ-að | `mobile/scripts/verify-data.mjs:18-19` | Færa í env. |

---

## Tillaga: starfsmaður sér 3 hluti

Nav fyrir employee/contractor í dag: Mitt svæði (5 flipar) · Planið (4 flipar) · Fréttaveita · Spjall · Hjálp = 5 síður, 9 flipar.

Nýtt (vefur og app eins):
1. **Vaktir** — mínar vaktir í viku, næsta vakt efst, „Lausar", framboð/skipti/frí sem EINN „Beiðni"-hnappur. (= Planið + Mínar vaktir + QuickActions sameinað.)
2. **Stimpla** — heimaskjár: stór inn/út hnappur með teljara, verkefni vaktarinnar, GPS/PIN. (= PunchCard + TasksCard.)
3. **Laun & spjall** — launamat mánaðarins, réttindi, skírteini/Wallet; spjall og fréttaveita sem tveir flipar inni í sama hluta.
Hjálp og prófíll fara undir avatar-valmynd. Samstarfsfólk-listi fer í spjallið (fólk-leit er þegar þar).

## Tillaga: eigandi sér 1 tölu

Efst á mælaborði: **Laun % af veltu** — í gær og þessi vika hlið við hlið, litur grænt ≤ markmið / gult ≤ markmið+3 / rautt. Markmiðið (nú fast 30% á 3 stöðum) verður stilling per fyrirtæki. Undir: 3 KPI (velta, launakostnaður, á vakt núna) og listi „Þarf athygli" (ekki mætt, opnar stimplanir, beiðnir). Allt annað drill-down. Krefst B1 (ein `laborPct`-fall) og nýrrar „í gær"-reiknunar sem er ekki til live í dag.
