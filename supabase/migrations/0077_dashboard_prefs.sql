-- 0077 — Sérsniðið mælaborð: hvaða spjöld hver notandi sér og í hvaða röð. Run after 0076.
-- Skrifað með service-role í maelabord/actions.ts (saveDashboardPrefs) — notendur skrifa ekki
-- beint í users (0076). { "order": ["labor", …], "hidden": ["cost", …] }
alter table public.users add column if not exists dashboard_prefs jsonb;
