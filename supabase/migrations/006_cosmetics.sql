-- ============================================================
-- 006_cosmetics.sql — coin currency + timer frame cosmetics
-- ============================================================
-- Coins are a spendable currency earned 1:1 alongside XP on every
-- completed session. XP stays untouched (it drives level +
-- leaderboard); coins are what the cosmetics shop deducts.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS coins           int  NOT NULL DEFAULT 0 CHECK (coins >= 0),
  ADD COLUMN IF NOT EXISTS selected_frame  text;

-- Backfill: existing users get coins equal to their lifetime XP so
-- long-time players can shop immediately instead of starting at 0.
UPDATE users SET coins = xp WHERE coins = 0 AND xp > 0;

-- ── user_frames ──────────────────────────────────────────────
-- One row per owned frame. Frame ids/prices live in the backend
-- catalog (single source of truth) — the DB only records ownership.
CREATE TABLE IF NOT EXISTS user_frames (
  user_id       uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  frame_id      text        NOT NULL,
  purchased_at  timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, frame_id)
);

-- ── buy_frame ────────────────────────────────────────────────
-- Atomic purchase: deduct coins + record ownership in one function
-- so concurrent buys can't double-spend or double-own.
-- Returns the new coin balance; raises on insufficient funds /
-- already owned so the API layer can map to 4xx.
CREATE OR REPLACE FUNCTION buy_frame(p_user_id uuid, p_frame_id text, p_price int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins int;
BEGIN
  -- Lock the user row to serialize concurrent purchases.
  SELECT coins INTO v_coins FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM user_frames WHERE user_id = p_user_id AND frame_id = p_frame_id) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  IF v_coins < p_price THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE users SET coins = coins - p_price WHERE id = p_user_id;
  INSERT INTO user_frames (user_id, frame_id) VALUES (p_user_id, p_frame_id);

  RETURN v_coins - p_price;
END;
$$;
