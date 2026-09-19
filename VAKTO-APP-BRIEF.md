# VAKTO — Mobile app brief (Expo / React Native)

Undirbúningur fyrir VAKTO starfsmanna-/teymisappið. Þú gefur Claude Code þetta skjal þegar þú ert
tilbúin/n. Appið deilir Supabase-gagnagrunni, innskráningu og vörumerki með vefnum (vakto.is).

> Hönnun er heilög: sama vörumerki og vefurinn (appelsínugult #E9700F, General Sans, engin emoji).

---

## 1. Hvað & fyrir hvern

Native app fyrir **starfsfólk og teymi** (iOS + Android). Stjórnendur nota mest desktop; **appið er
fyrir starfsfólkið.** Meira en „self-service" — það er **teymis-app**: vaktir, stimpla inn/út, laun,
réttindi, beiðnir, **spjall**, **fréttaveita**, og Wallet-skírteini.

---

## 2. Tæknistafli

- **Expo (React Native + TypeScript)** — eitt kóðasafn, iOS + Android.
- **Expo Router** (file-based routing) + **bottom tab bar**.
- **Supabase** — sami client, innskráning og gögn og vefurinn (deilt).
- **NativeWind** (Tailwind fyrir RN) svo brand-tókenar séu þeir sömu og á vefnum.
- **Expo Notifications** — push-tilkynningar.
- **Expo Location** — GPS við stimplun.
- **Expo Camera / ImagePicker** — prófílmynd + (síðar) skanna QR á kiosk.
- **Expo SecureStore** — geyma innskráningu örugglega.
- **Supabase Realtime** — spjall og fréttaveita í rauntíma.

**Uppbygging (monorepo):** haltu vef + appi í sama GitHub-repo. `/` = Next.js vefur, `/mobile` =
Expo app. Deildu Supabase-client + TypeScript-týpum í `/packages/shared` (eða `/lib`).

---

## 3. Vörumerki í appinu

- Litir og tókenar úr brand kit (appelsínugult #E9700F, hlutlausir, semantic).
- **General Sans** — bundla `.ttf` skránum og hlaða með `expo-font`.
- Ávalir hnappar, mjúkir skuggar, mikið pláss — mobile-first (eins og starfsmannasvæðið á vefnum).
- **Engin emoji** — lína-ikon (t.d. `lucide-react-native`).

---

## 4. Skjáir (bottom tab bar, 5 flipar)

1. **Heim** — stimpilklukka (inn/út), næsta vakt, verkefni vaktarinnar, flýtihnappar (frí, skipti).
2. **Vaktir** — mitt vaktaplan (vika/mánuður), opnar vaktir, skrá framboð, vaktaskipti.
3. **Spjall** — teymis-/fyrirtækjaspjall (rásir + bein skilaboð), rauntíma.
4. **Fréttir** — fréttaveita: tilkynningar/póstar frá stjórnendum (like/comment valfrjálst), rauntíma.
5. **Mitt** — prófíll (mynd), laun/launaseðill, réttindi (orlof, tímabanki, veikindi), **Wallet-skírteini**, stillingar, útskrá.

---

## 5. Kjarna-eiginleikar

- **Stimpla inn/út** — með **GPS** (staðfestir staðsetningu) og/eða PIN. Uppfærir stjórnanda-sýn strax.
- **Push-tilkynningar** — nýtt vaktaplan birt, vaktaskipti samþykkt, ný frétt, skilaboð í spjalli, áminning fyrir vakt.
- **Spjall** — Supabase Realtime; rásir per staður/deild + bein skilaboð.
- **Fréttaveita** — stjórnendur pósta tilkynningum; starfsfólk sér í rauntíma.
- **Laun** — launaseðill + saga; réttindi (orlof, tímabanki).
- **Wallet-skírteini** — Apple/Google Wallet (Fasi 3), QR sem stimplar inn á kiosk.
- **Prófílmynd** — upphal með myndavél/albúmi.

---

## 6. Gagnalíkan (viðbætur við núverandi Supabase-skema)

```
push_tokens(id, user_id, token, platform)                 -- fyrir push
chat_channels(id, company_id, name, type)                 -- deild/staður/DM
chat_members(channel_id, user_id)
chat_messages(id, channel_id, user_id, body, created_at)  -- Realtime
news_posts(id, company_id, author_id, title, body, image_url, created_at)
news_reactions(post_id, user_id, type)                    -- valfrjálst
```
Endurnýttu: users, employees, shifts, punches, leave_requests, payroll_lines o.fl. (þegar til).

---

## 7. Innskráning

- Supabase Auth (sömu aðgangar og vefurinn). Geymdu session í **SecureStore**.
- Hlutverk: employee / contractor sjá appið; manager/owner geta líka skráð sig inn (en nota mest vef).

---

## 8. Það sem þú þarft að útvega (Claude Code getur ekki gert sjálft)

- **Apple Developer aðgangur** — $99/ár (fyrir iOS + push + Wallet).
- **Google Play Developer** — $25 einu sinni.
- **Expo / EAS aðgangur** (ókeypis til að byrja) — fyrir byggingar og innsendingu.
- Ikon + splash + skjámyndir fyrir búðirnar (ég get hannað þau).

---

## 9. Byggingarröð (fasar)

- **Fasi 0 — Grunnur:** Expo verkefni í `/mobile`, Supabase-client + auth + SecureStore, brand-tókenar + General Sans, tab-skel (5 flipar tómir). Prófa í **Expo Go**.
- **Fasi 1 — Kjarninn:** Heim (stimpilklukka + GPS), Vaktir (mitt plan + opnar vaktir + framboð), Mitt (prófíll + laun + réttindi).
- **Fasi 2 — Teymi:** Spjall (Realtime), Fréttaveita (Realtime), **push-tilkynningar** (Expo Notifications).
- **Fasi 3 — Fínpússun & útgáfa:** Wallet-skírteini + NFC/QR-stimplun, ikon/skjámyndir, EAS build, innsending í App Store + Google Play.

---

## 10. Settu í `/mobile/CLAUDE.md`

```
VAKTO mobile app rules:
- Expo (React Native + TypeScript) + Expo Router. Deilir Supabase-client og týpum með vefnum.
- Sama vörumerki og vakto.is: appelsínugult #E9700F, General Sans (bundlað), engin emoji, lína-ikon.
- Mobile-first, ávalt, mjúkir skuggar, mikið pláss — eins og starfsmannasvæðið á vefnum.
- 5 flipar: Heim · Vaktir · Spjall · Fréttir · Mitt.
- Push, GPS-stimplun, Realtime spjall/fréttir. Auth í SecureStore.
- Per skjá: byggja → prófa í Expo Go → bera saman við brand → laga.
```

---

## 11. Kickoff-prompt (þegar þú ert tilbúin/n)

```
Lestu VAKTO-APP-BRIEF.md. Búðu til Fasa 0: nýtt Expo (React Native + TypeScript) app í /mobile
í sama repo, sem deilir Supabase-client og týpum með vefnum. Settu upp Expo Router með bottom tab
bar (Heim, Vaktir, Spjall, Fréttir, Mitt — tómir í bili), Supabase Auth með SecureStore, og
brand-tókenana + General Sans (bundlað). Segðu mér nákvæmlega hvernig ég prófa það í Expo Go í
símanum mínum.
```
