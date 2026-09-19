-- 0047 — VAKTO platform admin (the SaaS owner's /admin): a platform-wide audit
-- trail of everything the owner does across tenants, plus a free-text admin
-- note per company (billing/sales context until Stripe/Teya exists).
-- Run after 0046 (staging first, prod at release).

-- Every admin action: billing change, trial extension, suspension,
-- impersonation start/end, note, login-link send. Written ONLY through the
-- service-role client from src/app/admin/actions.ts — never by tenants.
create table if not exists platform_audit (
  id uuid primary key default gen_random_uuid(),
  admin_email text not null,                                   -- who (allowlisted VAKTO_ADMIN_EMAILS)
  action text not null,                                        -- billing.set | trial.extend | suspend | unsuspend |
                                                               -- impersonate.start | impersonate.end | note.save | login_link.send
  company_id uuid references companies(id) on delete set null, -- which tenant (null = platform-level)
  target text,                                                 -- e.g. the user email acted on
  detail text,                                                 -- human-readable description
  at timestamptz not null default now()
);
create index if not exists platform_audit_at_idx on platform_audit(at desc);
create index if not exists platform_audit_company_at_idx on platform_audit(company_id, at desc);

-- Deny-all RLS: no policies at all, so anon/authenticated can neither read nor
-- write. The service role bypasses RLS and is the only writer/reader.
alter table platform_audit enable row level security;
revoke all on table platform_audit from anon, authenticated;

-- Free-text note the admin keeps per company ("Athugasemd" in /admin):
-- who they are, what was agreed, when to follow up on payment, etc.
alter table companies add column if not exists admin_note text;
