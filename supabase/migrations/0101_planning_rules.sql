-- 0101 — Planreglur fyrirtækisins fyrir AI-vaktaplan. Run after 0100.
--
-- Fastar reglur sem stjórnandi vill að gildi í hverju plani („Bach bara morgunvaktir“, „alltaf 3 í
-- eldhúsi um helgar“). VAKTO AI og „Gervigreind (AI) bestun“ í Vaktaplani nota virkar reglur sjálfkrafa.
-- Form: [{ id, text, active, createdAt, via: 'user' | 'ai' }]. Skrifað um sömu reglu og staffing_targets
-- (companies-update stjórnenda).

alter table public.companies add column if not exists planning_rules jsonb not null default '[]'::jsonb;
