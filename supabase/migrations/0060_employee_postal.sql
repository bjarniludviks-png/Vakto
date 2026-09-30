-- 0060 — heimilisfang starfsmanns í þremur reitum (gata, póstnúmer, staður). Run after 0059.
alter table public.employees
  add column if not exists postal_code text,
  add column if not exists city text;

-- Eldri heimilisföng á forminu „Gata 1, 101 Reykjavík“ → gata / póstnúmer / staður.
update public.employees
   set postal_code = substring(address from ',\s*(\d{3})\s+[^,]+$'),
       city        = trim(substring(address from ',\s*\d{3}\s+([^,]+)$')),
       address     = trim(regexp_replace(address, ',\s*\d{3}\s+[^,]+$', ''))
 where postal_code is null and city is null and address ~ ',\s*\d{3}\s+[^,]+$';
