import { supabase } from '../../shared';
import { notifyReferralRedeemed } from '../notifications';

/** Coins granted to BOTH sides of a successful referral. */
export const REFERRAL_REWARD_COINS = 500;

/** A new account can redeem an invite within this window after signup. */
const REDEEM_WINDOW_DAYS = 7;

export class ReferralError extends Error {
  constructor(
    public code:
      | 'not_found'          // no user with that username
      | 'self'               // tried to redeem own username
      | 'already_redeemed'   // caller already used an invite
      | 'too_old'            // caller account is past the redeem window
      | 'reverse_pair',      // referrer was referred by the caller (farming guard)
  ) {
    super(code);
  }
}

export interface RedeemResult {
  coinsAwarded: number;
  referrerUsername: string;
  newCoins: number;
}

/**
 * Redeem a referral: the caller (a fresh account) names the friend who
 * invited them. Both get coins and become friends. One redemption per
 * user, enforced by the referrals PK.
 */
export async function redeemReferral(callerId: string, referrerUsername: string): Promise<RedeemResult> {
  // 1. Resolve the referrer by username (exact, case-insensitive)
  const { data: referrer } = await supabase
    .from('users')
    .select('id, username')
    .ilike('username', referrerUsername)
    .limit(1)
    .maybeSingle();

  if (!referrer) throw new ReferralError('not_found');
  if (referrer.id === callerId) throw new ReferralError('self');

  // 2. Caller must be inside the new-account window
  const { data: caller } = await supabase
    .from('users')
    .select('id, username, created_at')
    .eq('id', callerId)
    .single();
  if (!caller) throw new ReferralError('not_found');

  const ageMs = Date.now() - new Date(caller.created_at as string).getTime();
  if (ageMs > REDEEM_WINDOW_DAYS * 86_400_000) throw new ReferralError('too_old');

  // 3. Farming guard: block A→B when B→A already exists
  const { data: reverse } = await supabase
    .from('referrals')
    .select('referred_id')
    .eq('referred_id', referrer.id)
    .eq('referrer_id', callerId)
    .maybeSingle();
  if (reverse) throw new ReferralError('reverse_pair');

  // 4. Record the referral — the PK on referred_id rejects a second redemption
  const { error: insertErr } = await supabase.from('referrals').insert({
    referred_id: callerId,
    referrer_id: referrer.id,
    coins_awarded: REFERRAL_REWARD_COINS,
  });
  if (insertErr) {
    if (/duplicate|unique/i.test(insertErr.message)) throw new ReferralError('already_redeemed');
    throw new Error(insertErr.message);
  }

  // 5. Reward both sides (atomic add_coins; referral row is already the audit log)
  const [{ data: callerCoins }, _] = await Promise.all([
    supabase.rpc('add_coins', { p_user_id: callerId, p_amount: REFERRAL_REWARD_COINS }),
    supabase.rpc('add_coins', { p_user_id: referrer.id, p_amount: REFERRAL_REWARD_COINS }),
  ]);

  // 6. Auto-friend: insert accepted friendship if no relationship exists yet
  const { data: existing } = await supabase
    .from('friendships')
    .select('status, requester_id')
    .or(
      `and(requester_id.eq.${callerId},addressee_id.eq.${referrer.id}),` +
      `and(requester_id.eq.${referrer.id},addressee_id.eq.${callerId})`,
    )
    .limit(1)
    .maybeSingle();

  if (!existing) {
    await supabase
      .from('friendships')
      .insert({ requester_id: callerId, addressee_id: referrer.id, status: 'accepted' });
  } else if (existing.status === 'pending') {
    const addresseeId = existing.requester_id === callerId ? referrer.id : callerId;
    await supabase
      .from('friendships')
      .update({ status: 'accepted' })
      .eq('requester_id', existing.requester_id as string)
      .eq('addressee_id', addresseeId)
      .eq('status', 'pending');
  } // blocked → leave as is; coins were still granted

  void notifyReferralRedeemed(referrer.id, caller.username as string, REFERRAL_REWARD_COINS);

  return {
    coinsAwarded: REFERRAL_REWARD_COINS,
    referrerUsername: referrer.username as string,
    newCoins: (callerCoins as number | null) ?? 0,
  };
}
