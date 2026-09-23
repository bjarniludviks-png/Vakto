# VAKTO appið — Expo / React Native

Starfsmanna-appið (útlit samþykkt 23.9.2026, sjá frumgerð í spjallinu): Heim með
stimplun og næstu vakt, Vaktir (Mínar · Allar · Lausar) með áætluðum launum á
vakt, Spjall í Messenger-stíl (realtime, viðbrögð, svör, „séð af“), Fréttaveita
með myndum og festingum, og Ég: laun (unnið + áætlað), skírteini, skjöl, beiðnir,
tímar, samstarfsfólk, stillingar. Talar beint við sama Supabase og vefurinn
(RLS-varið, anon key + innskráning notanda).

## Keyra í símanum (Expo Go) — í dag

```bash
cd mobile
npm install
cp .env.staging .env        # eða .env.production fyrir alvöru gögn (BM Veitingar)
npx expo start              # QR-kóði → skannaðu með Expo Go (iOS: myndavélin, Android: Expo Go)
```

Síminn og tölvan þurfa að vera á sama neti (eða `npx expo start --tunnel`).
Innskráning: netfang + lykilorð starfsmanns. Notandinn þarf tengdan starfsmann
(`employees.user_id`) — annars birtist „Enginn starfsmannaprófíll tengdur“.
Boð úr Stillingar → Notendur / „Stofna & senda boð“ á vefnum tengir þetta sjálfkrafa.

`.env`, `.env.staging` og `.env.production` eru ekki í git. Staging =
aptpckmrqepvcqhgkjoo, prod = lsnthbnqcelfgeyuxgfn (sömu gildi og
NEXT_PUBLIC_SUPABASE_* í Vercel).

## Púsh-tilkynningar

Appið skráir Expo push-token í `push_subscriptions` (endpoint `expo:<token>`).
Þjónninn (`src/lib/push.ts`) sendir á Expo push API fyrir þau endpoint — sömu
köll og vefpush (ný skilaboð, ný færsla frá stjórnanda, svör við beiðnum).
Í Expo Go virka tilkynningar ekki að fullu; í EAS-byggingu (TestFlight/búðir)
þarf `EXPO_ACCESS_TOKEN` í Vercel (valfrjálst, hækkar kvóta).

## Búðirnar (App Store / Play Store)

Þegar Apple Developer (DUNS) + Google Play Console eru komin:

```bash
npm i -g eas-cli && eas login          # Expo-aðgangur @bjarniludviks (verkefni þegar tengt)
cd mobile
node scripts/setup-eas-env.mjs         # eða: eas env:create fyrir EXPO_PUBLIC_SUPABASE_* (production = prod-grunnur)
eas build --platform ios --profile production   # fyrsta sinn: býr til vottorð sjálfkrafa
eas submit --platform ios              # TestFlight → App Store Connect
eas build --platform android --profile production && eas submit --platform android
```

- Bundle id / package: **is.vakto.app**. Íkonar/splash í `assets/`.
- Uppfærslur á JS án nýrrar búðarútgáfu: `eas update --branch production`.

## Arkitektúr

- `app/` — expo-router: `(tabs)/` (index=Heim, vaktir, spjall, frettir, meira=Ég),
  `spjall/[id]`, `laun`, `timar`, `skirteini`, `skjol`, `samningur`, `beidnir`,
  `profill`, `samstarfsfolk`, `starfsmadur/[id]`, `stillingar`, `login`
- `src/lib/api/` — beinar Supabase-fyrirspurnir: `me`, `home`, `pay`, `schedule`,
  `punches`, `requests`, `chat` (realtime + RPC `chat_unread_counts`), `feed`, `docs`
- `src/lib/payroll.ts`, `payrules.ts` — afrit af launavél vefsins (sömu reglur)
- `src/components/ui.tsx` — hönnunarkerfið (Card, Row, Sheet, Seg, Pill, Toast…),
  `screen.tsx`, `request-sheets.tsx` (frí, bjóða vakt, leiðrétting, forföll)
- `src/theme.ts` — VAKTO-tokens (sömu litir og vefurinn, General Sans)

Krafa á grunn: migration 0041 (starfsmenn stimpla sjálfir, lesa eigin skjöl) —
komin á staging og prod.
