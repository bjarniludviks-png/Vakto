-- 0079 — Heimsóknatalning á opnu síðunum (vakto.is), vafrakökulaus. Run after 0078.
-- Engin IP-tala er geymd: visitor er SHA-256 af (IP, vafra, degi, leyndarmáli) og breytist daglega,
-- svo ekki er hægt að rekja einstakling milli daga. Skrifað og lesið með service-role eingöngu.
create table if not exists site_visits (
  id bigserial primary key,
  day date not null default ((now() at time zone 'utc')::date),
  path text not null,
  referrer_host text,
  utm_source text,
  utm_campaign text,
  utm_content text,
  visitor text not null,
  created_at timestamptz not null default now()
);
create index if not exists site_visits_day_idx on site_visits(day);
alter table site_visits enable row level security;
revoke all on table site_visits from anon, authenticated;
