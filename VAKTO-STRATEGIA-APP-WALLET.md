# VAKTO — Strategía, samkeppni (Sling), app & wallet

**Brutal honest útgáfa. Engin fegrun. Uppfært 19. sept 2026.**

---

## 0. TL;DR (lestu þetta fyrst)

1. **Þú getur selt í næstu viku — en EKKI með native app í App Store.** Selja á **vefnum/PWA** (Add to Home Screen). Native app + Apple Wallet er Fasi 2 (2–6 vikur), aðallega út af Apple.
2. **Byrjaðu STRAX á tvennu sem er flöskuháls og þú ræður ekki hraðanum á:** Apple Developer aðgangur og Google Play aðgangur. Allt annað getur beðið, ekki þetta.
3. **Sling er ódýrt ($2–$4/notanda).** Þú vinnur ekki á verði einu saman. Þú vinnur á: **laun sem % af veltu (arðsemi)**, íslensku/staðbundnu (Payday, launareglur, tunga, stuðningur), og **einfaldari UX + betra spjall**.
4. **Kerfið er of flókið ef það reynir að gera allt sem Sling gerir.** Skerum. Starfsmaður á að sjá 3 hluti. Eigandi á að sjá 1 tölu.

---

## 1. Brutal honest: af hverju "app í næstu viku" gengur ekki upp

| Hindrun | Rauntími | Þú ræður? |
|---|---|---|
| Apple Developer Program (fyrirtæki, þarf D-U-N-S nr.) | oft 1–2 vikur í staðfestingu | ❌ Apple ræður |
| Google Play Developer | ~1–2 dagar (+ $25 einu sinni) | ⚠️ hraðara |
| Byggja Expo app sem er nógu gott | 1–3 vikur | ✅ |
| App Store review (fyrsta innsending) | 1–3 dagar, oft höfnun fyrst | ❌ Apple ræður |
| Apple Wallet (Pass Type ID + cert) | háð Dev-aðgangi ↑ | ❌ |

**Niðurstaða:** stefndu á native app + wallet **live eftir 2–6 vikur**, ekki 1. Ekki lofa viðskiptavinum appi í búð í næstu viku.

### Hvað þú GETUR selt í næstu viku
- **Vefinn sem PWA** (vakto.is). Starfsfólk opnar í síma → "Bæta á heimaskjá" → lítur út og virkar eins og app.
- Push virkar á Android strax; á iPhone virkar web-push í PWA (iOS 16.4+) þegar notandi hefur bætt á heimaskjá.
- Þetta er **nóg fyrir pilot og fyrstu greiðandi viðskiptavini.** Native appið er fægingin, ekki forsenda sölunnar.

---

## 2. Sling — hvað þeir bjóða og hvað þeir rukka (2026)

**Verð (per notanda/mánuði, ~15% afsláttur árlega):**
- **Free** — allt að 30 notendur. Vaktaplan, frí-beiðnir, hópaspjall, fréttaveita. EKKI: tímaskráning, yfirvinnu-vöktun, launakostnaðar-skýrslur, kiosk.
- **Premium — $2** (~$1,70 árlega). Launakostnaðar-stjórnun, vaktaskipti, timesheet/plan sniðmát, SMS, lögbundin hlé, frí.
- **Business — $4** (~$3,40 árlega). POS-tenging, skýrslur, tags, verkefna-sniðmát, budget, geofencing, mæting.

**Það sem Sling gerir vel (afritaðu):** launakostnaður lagður **ofan á planið** (sér kostnað per vakt/dag/tímabil, setur budget-þak), hópaspjall + fréttaveita í einu appi, kiosk/stimpilklukka, geofencing.

**Veikleikar Sling = tækifæri VAKTO:**
- Sýnir launakostnað **í krónum**, en tengir hann **ekki við veltu** → VAKTO: *laun sem % af veltu*. Þetta er þitt vopn.
- Alþjóðlegt/enskt, engin íslensk launalógík, enginn Payday, enginn staðbundinn stuðningur.
- Margir eiginleikar = flókið. VAKTO getur unnið á einfaldleika.

---

## 3. VAKTO verð — "stela og gera betur"

Þú vinnur ekki með því að vera ódýrari en $2. Þú vinnur með **skýrari virði (arðsemi) + local**. Þrír valkostir:

**A) Per-notanda (eins og Sling, samanburðarhæft):**
- Free: allt að 10–15 notendur, grunn-vaktaplan + spjall + stimpla.
- Pro: ~**490–690 kr/notanda/mán** — arðsemi (laun % af veltu), timesheets, launaútreikningur, wallet-skírteini.
- Business: ~**990 kr/notanda/mán** — Payday/POS-tenging, ítarlegar skýrslur, margir staðir.

**B) Per-stað (flatt gjald — margir litlir íslenskir vinnustaðir kjósa þetta):**
- t.d. **9.900 kr/mán per stað** að X starfsmönnum, síðan þrep upp. Fyrirsjáanlegt, engin "per haus" hræðsla.

**C) Blanda:** Free til að fá fólk inn (fjarlægir núning eins og Sling gerir) → flatt per-stað fyrir SMB → per-notanda fyrir stærri.

**Ráðlegging:** Byrjaðu á **A** með **frían tier** (til að slá Sling í núningi) og settu **laun-%-af-veltu í Pro** sem headline sem Sling hefur ekki. Ekki fara í verðstríð niður á við — Toast (á bak við Sling) niðurgreiðir.

> Muna: 14 daga frí prufa á öllum greiddum → svo áskrift. Stripe sér um það (sjá fyrri skilaboð).

---

## 4. Kerfis-yfirferð: WASTE, einföldun, UX

**Meginregla:** VAKTO gerir EITT betur en allir aðrir = **sýnir eigandanum arðsemi (laun % af veltu) og hjálpar honum að stýra henni.** Allt annað er stuðningur við það. Ef eiginleiki styður ekki þetta eða daglega notkun starfsmanns → íhugaðu að sleppa.

**Starfsmaður á að sjá bara 3 hluti (annað er WASTE fyrir hann):**
1. **Vaktir** — mínar vaktir, næsta vakt, skipti/framboð.
2. **Stimpla** — inn/út (GPS/PIN).
3. **Laun & spjall** — launaseðill/réttindi + Messenger-spjall + fréttir.

**Eigandi/stjórnandi á að sjá bara 1 tölu efst:** **laun sem % af veltu í gær/þessa viku**, með lit (grænt/gult/rautt). Allt annað er drill-down.

**Mögulegt WASTE að skera/fela (brutal honest):**
- Of margir vakta-tegundir/stillingar sem enginn notar → default sniðmát, fela restina.
- Skýrslur sem líta flott út en enginn les → haltu 2–3 sem skipta máli (arðsemi, launakostnaður, mæting).
- Tvöföld yfirlit/hnappar sem gera það sama → eitt.
- „Sýndar"-eiginleikar (flottir en ónotaðir) → út, þar til einhver biður um þá.

**Spjall — verður að vera eins og Messenger:**
- Supabase Realtime, **typing indicator, read receipts, myndir/skrár, push**, hópar per staður/deild + bein skilaboð, ólesið-merki.
- Opnast strax, engin bið, engin síða-endurhleðsla. Þetta er stór ástæða þess að fólk opnar appið daglega.

**UX-hönnun — hvar og hvernig:**
- Native útlit: notaðu **NativeWind** (Tailwind fyrir RN) svo það er sama útlit og vefurinn.
- Til að hanna/prófa útlit hratt: **Figma** (eða láttu Claude Code + þínar Sling-skjámyndir sem viðmið). Þú átt Sling-skjáskot → gefðu Claude Code þau sem „svona á flæðið að vera, en einfaldara og í okkar lit".
- Meginregla: **færri skjáir, stærri snerti-svæði, minna af texta, meira af einum skýrum hnappi per skjá.**

---

## 5. Worldwide-readiness (svo þetta virki utan Íslands)

Til að VAKTO sé nothæft í „western world", ekki bara á Íslandi — **ekki hardcode-a íslenskar reglur inn í kjarnann:**
- **Tungumál (i18n):** IS + EN fyrst. Allur texti í þýðingaskrár, ekki fastur í kóða.
- **Gjaldmiðill:** ISK/EUR/USD/GBP — stilling per fyrirtæki, ekki fast „kr.".
- **Tímabelti:** vaktir og stimplun í tímabelti staðarins, ekki UTC-rugl.
- **Launareglur:** íslensku álögin (33%/45%/90%, orlof, lífeyrir, staðgreiðsla) eiga að vera **„Ísland-pakki"**, ekki kjarninn. Önnur lönd = önnur regla-pakkar síðar.
- **Dags/tíma snið, vikubyrjun (mán/sun), 24h vs AM/PM** — stilling.
- **GDPR/persónuvernd:** þú ert að vinna með laun og starfsmannagögn margra fyrirtækja → DPA, gagnavistun í EU (Supabase Frankfurt ✅), aðgangsstýring per fyrirtæki (RLS ✅), audit-log.

---

## 6. PUNKT-FYRIR-PUNKT: klára Apple Wallet + bæði app stores

### A. Það sem ÞÚ þarft að útvega (Claude Code getur ekki — krefst auðkennis/greiðslu)
1. **Apple Developer Program** — developer.apple.com → Enroll. Fyrir fyrirtæki þarf **D-U-N-S númer** (fáanlegt frítt hjá D&B, getur tekið daga). $99/ár. **Byrjaðu í dag** — þetta er flöskuhálsinn.
2. **Google Play Developer** — play.google.com/console → $25 einu sinni. Fljótlegt.
3. **Expo/EAS aðgangur** — expo.dev, ókeypis til að byrja (fyrir byggingar).

### B. Apple Wallet (starfsmannaskírteini) — röð
1. Í Apple Developer: búðu til **Pass Type ID** + **Pass Type ID Certificate** (.p12).
2. Claude Code byggir **PassKit template** (.pkpass): VAKTO-útlit, nafn, staða, deild, QR.
3. Server (Next.js API route) **undirritar og býr til .pkpass** per starfsmann með certinu.
4. „**Add to Apple Wallet**" hnappur í starfsmannasvæðinu → hleður .pkpass.
5. QR í skírteininu tengist **kiosk/stimpilklukku** (skanna = stimpla inn).
6. **Google Wallet** hliðstætt: Google Wallet API + service account (JSON key) → sami QR-strengur.

> Þú átt nú þegar sýnishorn: `vakto-wallet-card.html`. Það er útlitið — Claude Code smíðar virku .pkpass útgáfuna ofan á það.

### C. Native app í báðar búðir (Expo) — röð
1. **Fasi 0:** Expo app í `/mobile` (sama repo), deilir Supabase-client + týpum við vefinn. Prófa í **Expo Go** í símanum þínum. (Sjá `VAKTO-APP-BRIEF.md`.)
2. Byggja 5 flipa: **Heim (stimpla) · Vaktir · Spjall · Fréttir · Mitt** — einfalt, eins og hér að ofan.
3. **App icon + splash + skjámyndir** fyrir búðirnar (ég get hannað þau).
4. **EAS build** → `eas build -p ios` og `-p android`.
5. **iOS:** hlaða í **TestFlight** (innri prófun) → svo App Store Connect → submit → review.
6. **Android:** internal testing track → svo Production → submit → review.
7. **Push:** Expo Notifications (APNs + FCM lyklar úr dev-aðgöngunum).

### D. Realistísk tímalína
- **Vika 1 (núna):** Selja á vefnum/PWA. Sækja Apple Dev + Google Play + D-U-N-S. Merge dev→main. Stripe/verð.
- **Vika 2–4:** Expo app Fasi 0–1 + prófa í Expo Go. Hanna icon/splash.
- **Vika 3–6:** EAS build → TestFlight/internal → wallet → submit í báðar búðir → review → live.

---

## 7. COMMAND FYRIR CLAUDE CODE (límdu þetta heilt)

> Claude Code **veit ekki sjálfkrafa** hvað Sling býður né hvað við ætlum að gera. Þetta command gefur honum allt. (Það vísar líka í `VAKTO-APP-BRIEF.md` og þessa skrá.)

```
Lestu VAKTO-STRATEGIA-APP-WALLET.md og VAKTO-APP-BRIEF.md. Við erum að fara í sölu og keppum við
Sling. Markmið: einfaldara, hraðara, með arðsemi (laun % af veltu) sem aðgreini. Gerðu eftirfarandi
í forgangsröð, og spurðu mig áður en þú tekur stórar ákvarðanir:

1) UX-EINFÖLDUN (vefur + undirbúningur fyrir app):
   - Starfsmanna-upplifun: bara 3 hlutir — Vaktir, Stimpla, Laun&Spjall. Fela allt annað fyrir starfsmanni.
   - Eigenda-dashboard: EIN tala efst = laun sem % af veltu (í gær/vika) með grænt/gult/rautt. Allt annað drill-down.
   - Farðu yfir alla skjái og LISTAÐU hvað er WASTE (tvöfalt, ónotað, of flókið) og leggðu til hvað á að
     skera/fela. Ekki eyða strax — sýndu mér listann fyrst.
   - Færri skjáir, stærri snertisvæði, einn skýr aðgerðahnappur per skjá.

2) SPJALL EINS OG MESSENGER (Supabase Realtime):
   - Typing indicator, read receipts, myndir/skrár, push, ólesið-merki, hópar per staður/deild + DM.
   - Opnast strax, engin síða-endurhleðsla. Þetta á að vera jafn þægilegt og Messenger.

3) WORLDWIDE-READY (ekki hardcode-a Ísland):
   - i18n (IS+EN), gjaldmiðill/tímabelti/dagsetningasnið per fyrirtæki.
   - Íslensku launareglurnar sem aðskilinn "Ísland-pakka", ekki í kjarnanum.
   - Haltu RLS per fyrirtæki + audit-log (persónuvernd).

4) SUPER-ADMIN (platform admin) fyrir mig sem eiganda — sjá fyrri brief (öll fyrirtæki, skráningar,
   prufur, MRR-kró fyrir Stripe, "skrá sig inn sem" með audit).

5) UNDIRBÚNINGUR FYRIR NATIVE APP: Expo í /mobile (Fasi 0) sem deilir Supabase-client og týpum,
   5 flipar (Heim/Vaktir/Spjall/Fréttir/Mitt), prófanlegt í Expo Go. Segðu mér nákvæmlega hvernig ég prófa.

6) APPLE/GOOGLE WALLET: undirbúðu .pkpass smíði (server undirritar með Pass Type ID cert sem ég útvega),
   "Add to Wallet" hnapp, QR tengt kiosk. Google Wallet hliðstætt. Skildu eftir kró fyrir certin mín.

Byrjaðu á lið 1 (WASTE-listi) og sýndu mér áður en þú breytir.
```

---

## 8. Hvað ég (þetta spjall) get gert næst
- Hannað **app icon + splash + store-skjámyndir** fyrir Expo appið.
- Hannað **Stripe verð-/áskriftar-flæðið** (þegar þú ert tilbúin/n).
- Farið **skjá-fyrir-skjá** yfir Sling-skjáskotin þín og gert nákvæman „svona einföldum við" lista.
- Skrifað **persónuverndar-yfirlýsingu + DPA** (þú þarft það fyrir alvöru sölu).

---

## 9. HEIMASÍÐA (vakto.is) — fókus á það sem HIN hafa ekki

**Meginskilaboð:** „Allt sem þú þekkir úr vaktakerfum — **plús það sem enginn annar gerir.**"
Ekki byrja á „við erum með vaktaplan" (allir eru með það). Byrjaðu á aðgreinunum.

**Hero:** arðsemin. *„Sjáðu launakostnaðinn þinn sem % af veltu — í rauntíma."* Ein skýr tala, lifandi.

**Aðgreinar-grid (þetta er kjarninn á síðunni — það sem HIN hafa ekki eða fela):**
1. **Ráðningarsamningar gerðir og undirritaðir í appinu** — enginn pappír, allt á einum stað.
2. **Starfsmannaskírteini í Apple/Google Wallet** — stimpla inn með QR, ekkert plastkort.
3. **Innbyggt spjall (eins og Messenger) + fréttaveita** — ekkert Slack/SMS á hliðinni.
4. **Tímafrávik í rauntíma** — sérð strax ef einhver er of lengi/of stutt á vakt og **launaáhrifin** um leið.
5. **Handbækur / starfsmannahandbók beint í appinu** — starfsfólk les og **staðfestir lestur**.
6. **Reiknireglur eftir stéttarfélagi** — veldu kjarasamning, álögin reiknast rétt sjálfkrafa.
7. **Laun sem % af veltu (arðsemi)** — aðgreinirinn sem Sling & co. hafa ekki.

**Svo:** lítill kafli „**Auðvitað líka allt það klassíska**": vaktaplan, stimpilklukka, frí-beiðnir, vaktaskipti,
launaútreikningur, skýrslur, kiosk — „…en miklu meira." (Sýnir að þú ert ekki að sleppa grunninum.)

**Sýna RAUNVERULEGA úr kerfinu:** ekki bara teikningar — **alvöru skjáskot** af dashboard (arðsemi), vaktaplani,
spjalli, wallet-skírteini, tímafrávikum. (Ég í þessu spjalli get tekið alvöru skjáskot af live-appinu í Chrome og
afhent þér í fullri upplausn fyrir síðuna.)

**Uppbygging síðu (röð):** Hero (arðsemi) → Aðgreinar-grid (7 að ofan) → „allt klassíska + meira" → alvöru
skjáskot/þrautaganga → verð (Free + Pro) → CTA „Prófa frítt í 14 daga". IS + EN.

### Command fyrir Claude Code — heimasíðan
```
Endurhannaðu vakto.is heimasíðuna til að fókusa á AÐGREINA okkar, ekki grunninn (allir eru með vaktaplan).
Röð: (1) Hero = arðsemi, "Sjáðu launakostnaðinn sem % af veltu í rauntíma" með lifandi tölu.
(2) Aðgreinar-grid — 7 hlutir sem hin hafa ekki: ráðningarsamningar+undirritun í appinu, starfsmannaskírteini
í Wallet, innbyggt Messenger-spjall + fréttaveita, tímafrávik í rauntíma með launaáhrifum, handbækur í appinu
með lestrar-staðfestingu, reiknireglur eftir stéttarfélagi/kjarasamningi, laun sem % af veltu.
(3) Stuttur kafli "auðvitað líka allt það klassíska" (vaktaplan, stimpilklukka, frí, vaktaskipti, launaútreikningur,
skýrslur, kiosk) — "…en miklu meira."
(4) Alvöru skjáskot úr kerfinu (ekki teikningar) — dashboard, vaktaplan, spjall, wallet, tímafrávik.
(5) Verð (Free + Pro með 14 daga prufu) → CTA. IS + EN. Sama vörumerki (General Sans, appelsínugult, engin emoji).
Notaðu Apple-UI-design skillinn fyrir hreint, native-legt útlit ef hann er tiltækur.
```

---

## 10. Apple-UI-design skill fyrir Claude Code

Þú vilt bæta `npx skillfish add barissozen/claude apple-ui-design` inn í Claude Code — **já, það passar vel**
því markmiðið er native/Apple-legt, hreint útlit.

**Hvernig:** keyrðu skipunina í Terminal **inni í vakto-möppunni** (svo skillið lendi í `.claude/skills/` fyrir
verkefnið):
```
cd ~/vakto
npx skillfish add barissozen/claude apple-ui-design
```
Svo sér Claude Code skillið sjálfkrafa næst þegar hann keyrir. Þú getur vísað í hann: *"notaðu apple-ui-design
skillið fyrir þennan skjá."*

**Öryggis-athugasemd (mikilvægt):** skill = leiðbeiningar sem Claude Code fylgir. Bættu aðeins við skillum frá
aðilum sem þú treystir (þetta er þriðja-aðila repo). Skoðaðu innihaldið (`.claude/skills/apple-ui-design/SKILL.md`)
eftir uppsetningu áður en þú treystir honum fyrir alvöru. Fyrir útlit-skill er áhættan lítil, en gott að vita.

