-- ───────────────────────────────────────────────────────────────
-- Migration 003: Push notifications
-- Stores each user's Expo push token, preferred language for the
-- notification copy, and an opt-out flag.
-- Run this in the Supabase SQL editor.
-- ───────────────────────────────────────────────────────────────

alter table users
  add column if not exists expo_push_token text,
  add column if not exists push_language   text    not null default 'en',
  add column if not exists push_enabled     boolean not null default true;

-- Fast lookup of users we can actually notify (token present + opted-in)
create index if not exists idx_users_push_enabled
  on users (push_enabled)
  where expo_push_token is not null;
