-- ============================================================
-- 009_pets.sql — animated pet companions (coin cosmetics)
-- ============================================================
-- Pets are bought with coins like frames, but also evolve: the pet
-- "grows" with the focus minutes earned while owning it. XP is 1:1
-- with coins-earned-per-minute×10, so we snapshot xp at purchase and
-- derive minutes-together as (users.xp - xp_at_purchase) / 10.

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS selected_pet text;

-- One row per owned pet. Ids/prices live in the backend catalog
-- (cosmetics.schema.ts) — the DB only records ownership + the XP
-- snapshot that drives evolution.
CREATE TABLE IF NOT EXISTS user_pets (
  user_id         uuid        NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  pet_id          text        NOT NULL,
  purchased_at    timestamptz NOT NULL DEFAULT now(),
  xp_at_purchase  int         NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, pet_id)
);

-- Atomic purchase: deduct coins + record ownership (with XP snapshot)
-- in one function so concurrent buys can't double-spend or double-own.
CREATE OR REPLACE FUNCTION buy_pet(p_user_id uuid, p_pet_id text, p_price int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins int;
  v_xp    int;
BEGIN
  SELECT coins, xp INTO v_coins, v_xp FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF EXISTS (SELECT 1 FROM user_pets WHERE user_id = p_user_id AND pet_id = p_pet_id) THEN
    RAISE EXCEPTION 'already_owned';
  END IF;

  IF v_coins < p_price THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE users SET coins = coins - p_price WHERE id = p_user_id;
  INSERT INTO user_pets (user_id, pet_id, xp_at_purchase) VALUES (p_user_id, p_pet_id, v_xp);

  RETURN v_coins - p_price;
END;
$$;
