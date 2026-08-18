# VAKTO mobile — Expo / React Native

Starfsmanna-appið: stimplun, vaktir, beiðnir, launamat, spjall, fréttaveita,
skjalasafn, ráðningarsamningur og skírteini. Talar beint við sama Supabase og
vefurinn (RLS-varið, anon key + innskráning notanda).

## Uppsetning (þróun)

```bash
cd mobile
npm install
# .env er þegar til staðar og bendir á STAGING (aptpckmrqepvcqhgkjoo):
#   EXPO_PUBLIC_SUPABASE_URL=…
#   EXPO_PUBLIC_SUPABASE_ANON_KEY=…
npx expo start          # QR-kóði fyrir Expo Go, eða i/a fyrir hermi
```

Innskráning í þróun: staging-notandi (t.d. bjarniludviks@icloud.com — sjá CLAUDE.md).
**Athugið:** notandinn þarf tengdan starfsmann (`employees.user_id`) — annars birtist
„Enginn starfsmannaprófíll tengdur“.

## Krafa á gagnagrunn

Migration **0041_mobile_employee_access.sql** verður að vera keyrð
(fyrst á staging, á prod við release):
- starfsmenn mega lesa eigin `employees`-röð (auth-tenging)
- starfsmenn mega stimpla sig inn/út (`punches` self insert/update)
- starfsmenn mega lesa sameiginleg skjöl + eigin möppu í `documents`-bucketinu
  (þarf fyrir signed URLs í skjalasafninu)

## Búðirnar (App Store / Play Store)

Þegar App Store Connect + Google Play Console aðgangar eru til:

```bash
npm i -g eas-cli
eas login                      # Expo-aðgangur
cd mobile
eas init                       # skrifar extra.eas.projectId í app.json
# Framleiðslu-lyklar (PROD Supabase lsnthbnqcelfgeyuxgfn) sem EAS env vars:
eas env:create --name EXPO_PUBLIC_SUPABASE_URL --environment production
eas env:create --name EXPO_PUBLIC_SUPABASE_ANON_KEY --environment production
# (preview-environment má vísa á staging með sömu skipunum)

eas build --platform all --profile production
eas submit --platform ios      # spyr um App Store Connect aðgang/API key
eas submit --platform android  # þarf service-account JSON frá Play Console
```

- Bundle id / package: **is.vakto.app** (bæði kerfi) — stofna appið með því id
  í App Store Connect og Play Console.
- Íkonar/splash eru í `assets/` (VAKTO-súlurnar), útgáfa hækkar sjálfkrafa
  (`autoIncrement` í eas.json).

## Arkitektúr

- `app/` — expo-router skjáir: `(tabs)/` (Heim, Vaktir, Spjall, Fréttir, Meira),
  `login`, `beidnir`, `skjol`, `samningur`, `skirteini`, `profill`, `spjall/[id]`
- `src/lib/api/` — beinar Supabase-fyrirspurnir (me/punches/requests/chat/feed/docs);
  spegla server-actions vefsins
- `src/lib/payroll.ts` + `payrules.ts` — sami launaútreikningur og vefurinn
  (afrit; haldið samstíga við `src/lib/` í rótinni)
- `src/theme.ts` — VAKTO tókar (General Sans, appelsínugult `#e9700f`, 14px kort)
- Spjall/fréttir polla (4 s / 10 s) eins og vefurinn — ekkert realtime á verkefninu

## Næstu skref (ekki í v1)

- Push-tilkynningar (expo-notifications + EAS credentials — þarf búðaraðganga)
- Prófílmynd tekin í appinu (expo-image-picker er þegar í dependencies)
- Undirritun ráðningarsamnings í appinu (er á vefnum í dag)
- Apple Wallet / Google Wallet skírteini (WalletButtons til á vefnum)
