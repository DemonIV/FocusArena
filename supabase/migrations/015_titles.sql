-- ============================================================
-- 015_titles.sql — selectable profile titles (ünvanlar)
-- ============================================================
-- Titles are unlocked by earning the matching achievement badge and are a
-- pure display flourish shown on the profile. The chosen title id is stored
-- on the user row (null = the default "novice" title). The backend validates
-- that the chosen title is actually unlocked before writing it here.

ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_title text;
