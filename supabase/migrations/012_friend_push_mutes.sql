-- ============================================================
-- 012_friend_push_mutes.sql — per-friend "started studying" push opt-out
-- ============================================================
-- A row means: user_id does NOT want "friend started studying" pushes
-- about friend_id. Default (no row) = notifications on. Deleting either
-- account cleans up automatically.

CREATE TABLE IF NOT EXISTS friend_push_mutes (
  user_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  friend_id  uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, friend_id)
);

-- Lookup on session start: "who muted this starter?"
CREATE INDEX IF NOT EXISTS idx_friend_push_mutes_friend ON friend_push_mutes(friend_id);
