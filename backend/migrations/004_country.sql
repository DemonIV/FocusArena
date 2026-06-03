-- ───────────────────────────────────────────────────────────────
-- Migration 004: Country Wars
-- Stores each user's country (ISO 3166-1 alpha-2, e.g. 'TR') so weekly
-- focus minutes can be aggregated per country. Auto-populated from the
-- device region on app start.
-- Run this in the Supabase SQL editor.
-- ───────────────────────────────────────────────────────────────

alter table users
  add column if not exists country text;

create index if not exists idx_users_country
  on users (country)
  where country is not null;
