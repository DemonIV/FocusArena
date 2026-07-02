-- ============================================================
-- 008_pro_badges.sql — Pro-exclusive achievement badges
-- ============================================================
-- Extends the achievements.badge_type CHECK constraint with the
-- three Pro badges (pro_member / pro_marathon / pro_streak_14).
-- Keep in sync with backend/src/modules/achievements/achievements.schema.ts.

ALTER TABLE achievements
  DROP CONSTRAINT IF EXISTS achievements_badge_type_check;

ALTER TABLE achievements
  ADD CONSTRAINT achievements_badge_type_check CHECK (badge_type IN (
    'first_session', 'streak_3', 'streak_7', 'streak_30',
    'hours_10', 'hours_100', 'level_5', 'level_10',
    'room_host', 'social_butterfly',
    'pro_member', 'pro_marathon', 'pro_streak_14'
  ));
