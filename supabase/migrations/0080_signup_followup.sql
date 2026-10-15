-- 0080 — persónulegur póstur daginn eftir nýskráningu (src/lib/signup-followup.server.ts).
alter table companies add column if not exists followup_sent_at timestamptz;

-- Velkomin-kynning Mitt svæðis vistuð á aðganginum (ekki bara localStorage, sem gildir per vafra og lén).
alter table users add column if not exists welcome_seen_at timestamptz;
