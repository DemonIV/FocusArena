-- ============================================================
-- 014_weekly_challenge.sql — weekly personal-goal reward claims
-- ============================================================
-- Replaces the global "Boss Battle" with a personal weekly focus goal that
-- pays out coins once per week. The (user_id, week_start) primary key is the
-- dedup guard: a second claim for the same week fails with unique_violation,
-- which the API maps to "already claimed". week_start = that week's Monday (UTC).

CREATE TABLE IF NOT EXISTS weekly_goal_claims (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  week_start date        NOT NULL,
  coins      int         NOT NULL CHECK (coins >= 0),
  claimed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, week_start)
);
