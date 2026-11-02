-- 0105 — Útgefið plan helst þar til nýtt er gefið út. Run after 0104.
--
-- Þegar vaktstjóri eyðir, færir eða breytir tímum á ÚTGEFINNI vakt er henni ekki eytt strax:
-- hún fær pending_delete = true og starfsfólk sér hana áfram (published = true). Vaktstjóri sér hana
-- ekki í vinnuplaninu. Við næstu útgáfu er merktum vöktum eytt og drögin verða útgefin.
alter table public.shifts add column if not exists pending_delete boolean not null default false;
create index if not exists shifts_pending_delete_idx on public.shifts (company_id, date) where pending_delete;
