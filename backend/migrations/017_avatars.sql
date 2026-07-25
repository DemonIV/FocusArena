-- 017_avatars.sql — collectible avatar selection
-- Adds the user's currently equipped avatar (id from the AVATAR catalog).
-- NULL = no avatar picked (falls back to letter/photo, as before).

ALTER TABLE users ADD COLUMN IF NOT EXISTS selected_avatar text;
