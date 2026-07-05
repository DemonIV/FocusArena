-- ============================================================
-- 011_spend_coins.sql — atomic coin spend (strict-mode rescue etc.)
-- ============================================================
-- Generic counterpart of buy_frame/buy_pet for purchases that don't
-- create an ownership row (e.g. rescuing a strict-mode session).
-- Row lock serializes concurrent spends; raises on insufficient funds
-- so the API layer can map to 4xx. Returns the new balance.

CREATE OR REPLACE FUNCTION spend_coins(p_user_id uuid, p_amount int)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_coins int;
BEGIN
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'invalid_amount';
  END IF;

  SELECT coins INTO v_coins FROM users WHERE id = p_user_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;

  IF v_coins < p_amount THEN
    RAISE EXCEPTION 'insufficient_coins';
  END IF;

  UPDATE users SET coins = coins - p_amount WHERE id = p_user_id;
  RETURN v_coins - p_amount;
END;
$$;
