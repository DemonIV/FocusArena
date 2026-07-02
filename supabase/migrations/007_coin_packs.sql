-- ============================================================
-- 007_coin_packs.sql — atomic coin grant for IAP coin packs
-- ============================================================
-- Called by the RevenueCat webhook when a coin-pack consumable is
-- purchased. Atomic increment so concurrent webhook retries can't
-- interleave with shop purchases.

CREATE OR REPLACE FUNCTION add_coins(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE sql
SECURITY DEFINER
AS $$
  UPDATE users SET coins = coins + p_amount WHERE id = p_user_id
  RETURNING coins;
$$;
