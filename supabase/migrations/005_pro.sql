-- ============================================================
-- 005_pro.sql — Pro subscription (RevenueCat) columns
-- ============================================================
-- is_pro / pro_expires_at are kept fresh by the RevenueCat webhook
-- (POST /billing/webhook). streak_freezes is a consumable Pro perk:
-- the nightly streak-reset job spends one to protect a missed day.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS is_pro          bool        NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pro_expires_at  timestamptz,
  ADD COLUMN IF NOT EXISTS streak_freezes  int         NOT NULL DEFAULT 0 CHECK (streak_freezes >= 0);

-- Small partial index — most users are free, so this stays tiny.
CREATE INDEX IF NOT EXISTS idx_users_pro ON users(id) WHERE is_pro = true;
