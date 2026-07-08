-- ============================================================
-- 013_focus_score.sql — per-session Focus Score (0–100)
-- ============================================================
-- A quality score for each session, computed server-side at stop time from
-- completion + in-app presence (time spent away) + steadiness (app switches
-- and pauses). Distinct from XP/coins (which reward volume) — this rewards
-- undistracted focus. Nullable: sessions logged before this migration, and
-- zero-minute sessions, have no score. Never feeds leaderboards.

ALTER TABLE sessions ADD COLUMN IF NOT EXISTS focus_score smallint;

COMMENT ON COLUMN sessions.focus_score IS
  '0–100 focus quality score (completion + presence + steadiness); NULL if not scored.';
