-- ============================================================
-- 010_referrals.sql — referral rewards (invite a friend → both get coins)
-- ============================================================
-- The referral "code" is the referrer's username. A new user (account
-- ≤ 7 days old) redeems it once; both sides get coins and become friends.
-- PK on referred_id enforces the one-redemption-per-user rule in the DB.

CREATE TABLE IF NOT EXISTS referrals (
  referred_id    uuid        PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  referrer_id    uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  coins_awarded  int         NOT NULL CHECK (coins_awarded >= 0),
  created_at     timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT referrals_no_self CHECK (referred_id <> referrer_id)
);

CREATE INDEX IF NOT EXISTS idx_referrals_referrer ON referrals(referrer_id);
