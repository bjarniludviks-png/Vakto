# VAKTO — Supabase uppsetning

## 1. Stofna verkefni

1. Farðu á https://supabase.com → **New project**.
2. Project Settings → **API**: afritaðu `Project URL`, `anon` lykil og `service_role` lykil.
3. Settu þá í `.env.local` (sjá `.env.example`).

## 2. Keyra migrations

**Fljótlegast:** límdu `migrations/RUN_ALL.sql` (allar 6 samansettar) í **SQL Editor**
og keyrðu í einu lagi. Kveiktu samt á **Storage** í Supabase fyrst (fyrir 0006).

Eða keyrðu hverja fyrir sig í þessari röð:

1. `migrations/0001_init.sql` — töflur + enums
2. `migrations/0002_rls.sql` — Row Level Security + tröggerar
3. `migrations/0003_seed.sql` — demo-gögn (Kaffi Krónan, 12 starfsmenn)
4. `migrations/0004_audit.sql` — aðgerðaskrá (audit log)
5. `migrations/0005_requests.sql` — vaktaskipti + framboð + sjálfsafgreiðsla starfsmanna (RLS)
6. `migrations/0006_storage.sql` — Storage-fötur fyrir skjöl (`documents`, lokað) og
   prófílmyndir (`avatars`, opið). Kveiktu á **Storage** í Supabase áður en þú keyrir hana.

> Seinna er hægt að nota Supabase CLI (`supabase db push`) þegar Docker er uppsett.

**Staðfesting:** keyrðu `node scripts/verify-supabase.mjs` — það athugar lyklana, telur
raðir í lykiltöflum og staðfestir Storage-föturnar.

## 3. Tengja eigandareikninginn þinn

Þegar þú skráir þig inn í fyrsta sinn býr trigger til röð í `public.users`
(með `role = owner`, en `company_id = null`). Tengdu hann við demo-fyrirtækið:

```sql
update public.users
set company_id = '00000000-0000-0000-0000-0000000000c0',  -- Kaffi Krónan
    role = 'owner'
where email = 'bjarniludviks@icloud.com';
```

Eftir þetta sérðu starfsfólkið og restina af appinu.

## Gagnamódel

Sjá `VAKTO-CLAUDE-CODE-BRIEF.md` §8. Allar töflur eru fyrirtækja-skorðaðar
(`company_id`) með RLS svo gögn leka ekki milli fyrirtækja.
