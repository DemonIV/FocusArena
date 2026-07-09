-- ============================================================
-- 016_user_timezone.sql — per-user UTC offset for local day/week boundaries
-- ============================================================
-- Streak, daily goal and weekly windows were all computed in UTC, so the
-- "day" reset at 03:00 for a UTC+3 user (Turkey) and late-night sessions
-- landed on the wrong day. The client reports its current offset (minutes to
-- ADD to UTC to get local time, e.g. UTC+3 = 180); the backend uses it to
-- compute day/week windows in local time. Default 0 = the previous UTC
-- behaviour, so older clients that never report are unaffected.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS utc_offset_minutes smallint NOT NULL DEFAULT 0;
