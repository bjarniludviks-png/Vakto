-- Department color (shown in Settings, schedule and staff lists).
alter table departments add column if not exists color text;
