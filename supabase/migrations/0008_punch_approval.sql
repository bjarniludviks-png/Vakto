-- 0008 — manager approval of clocked punches.
-- Run after 0001–0007. Idempotent.

alter table punches add column if not exists approved boolean not null default false;
alter table punches add column if not exists approved_by uuid references auth.users(id) on delete set null;
alter table punches add column if not exists approved_at timestamptz;

create index if not exists punches_approved_idx on punches (company_id, approved);
