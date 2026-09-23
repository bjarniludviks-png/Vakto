-- 0053: staðfesting netfangs með 6 stafa kóða við nýskráningu + samþykki skilmála.
create table if not exists email_verifications (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  code_hash text not null,                 -- sha256(email:kóði)
  attempts int not null default 0,         -- rangar tilraunir (læsist við 5)
  verified_at timestamptz,
  proof text,                              -- handahófstoken sem nýskráningin framvísar
  created_at timestamptz not null default now(),
  expires_at timestamptz not null
);
create index if not exists email_verifications_email_idx on email_verifications(email, created_at desc);
-- Aðeins service-role les/skrifar (engar policies).
alter table email_verifications enable row level security;

alter table companies add column if not exists terms_accepted_at timestamptz;
alter table companies add column if not exists terms_version text;
