-- 0098 — útlit skjala fyrirtækis: litatónn + merki á ráðningarsamningum og launaseðlum. Run after 0097.
-- companies.branding = { "tone": "warm|red|blue|green|purple|gray", "logo_path": "branding/<fyrirtæki>/logo-….png" }
-- null = sjálfgefið (ljósgult + VAKTO-merkið). Skrifað og lesið með þjónustulykli (stillingar/branding-actions.ts),
-- merkið liggur í einkafötunni `documents`.
alter table public.companies add column if not exists branding jsonb;
