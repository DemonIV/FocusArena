-- ───────────────────────────────────────────────────────────────
-- Migration 002: Per-room study minutes
-- Tracks how many minutes each member has studied WHILE a member of a room.
-- Run this in the Supabase SQL editor.
-- ───────────────────────────────────────────────────────────────

-- 1. Accumulation table (one row per room+member)
create table if not exists room_member_minutes (
  room_id       uuid        not null references rooms(id) on delete cascade,
  user_id       uuid        not null references users(id) on delete cascade,
  total_minutes integer     not null default 0,
  updated_at    timestamptz not null default now(),
  primary key (room_id, user_id)
);

-- 2. Atomic helper: add `p_minutes` to every room the user is an ACTIVE member of.
--    Called once per completed/stopped focus session.
create or replace function add_study_minutes_to_rooms(p_user_id uuid, p_minutes integer)
returns void
language sql
as $$
  insert into room_member_minutes (room_id, user_id, total_minutes, updated_at)
  select rm.room_id, p_user_id, p_minutes, now()
  from room_members rm
  where rm.user_id = p_user_id
    and rm.is_active = true
  on conflict (room_id, user_id)
  do update set
    total_minutes = room_member_minutes.total_minutes + excluded.total_minutes,
    updated_at    = now();
$$;
