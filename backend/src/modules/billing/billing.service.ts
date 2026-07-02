import { supabase } from '../../shared';
import { track } from '../../shared/observability';

// ─── Tunables ─────────────────────────────────────────────────

/** Free plan is capped to this many active subjects; Pro is unlimited. */
export const FREE_SUBJECT_LIMIT = 3;
/** Streak freezes a Pro user is topped up to on each purchase/renewal. */
export const STREAK_FREEZE_MAX = 2;

/** Shared secret configured in the RevenueCat dashboard's webhook settings. */
const WEBHOOK_SECRET = process.env.REVENUECAT_WEBHOOK_SECRET?.trim();

/**
 * Billing is OPT-IN: with no webhook secret configured every paywall/limit is
 * off, so local dev (Expo Go) behaves exactly as before. The moment the secret
 * is set, free-tier limits and Pro perks switch on.
 */
export const billingEnabled = Boolean(WEBHOOK_SECRET);

// ─── Webhook auth ─────────────────────────────────────────────

/** Verify a RevenueCat webhook's Authorization header against the shared secret. */
export function verifyWebhookAuth(header?: string): boolean {
  if (!WEBHOOK_SECRET) return false;
  return header === `Bearer ${WEBHOOK_SECRET}` || header === WEBHOOK_SECRET;
}

// ─── Pro status ───────────────────────────────────────────────

export interface ProStatus {
  isPro: boolean;
  proExpiresAt: string | null;
  streakFreezes: number;
}

/**
 * Read a user's Pro status. The DB (kept fresh by the webhook) is the source of
 * truth; an elapsed expiry counts as not-Pro even if the flag is still set.
 */
export async function getProStatus(userId: string): Promise<ProStatus> {
  const { data } = await supabase
    .from('users')
    .select('is_pro, pro_expires_at, streak_freezes')
    .eq('id', userId)
    .single();

  if (!data) return { isPro: false, proExpiresAt: null, streakFreezes: 0 };

  const expired = data.pro_expires_at
    ? new Date(data.pro_expires_at).getTime() < Date.now()
    : false;

  return {
    isPro: Boolean(data.is_pro) && !expired,
    proExpiresAt: data.pro_expires_at ?? null,
    streakFreezes: data.streak_freezes ?? 0,
  };
}

/**
 * True if the user may use Pro features. When billing is disabled this returns
 * `true` (no paywall ⇒ no limits) so dev/Expo Go keeps working unchanged.
 */
export async function isUserPro(userId: string): Promise<boolean> {
  if (!billingEnabled) return true;
  return (await getProStatus(userId)).isPro;
}

// ─── Entitlement updates (from the webhook) ───────────────────

/**
 * Apply an entitlement change. Activating tops up streak freezes (the Pro perk);
 * deactivating just flips the flag (freezes are left to drain naturally).
 */
export async function applyEntitlement(
  userId: string,
  active: boolean,
  expiresAtMs: number | null,
): Promise<void> {
  if (active) {
    await supabase
      .from('users')
      .update({
        is_pro: true,
        pro_expires_at: expiresAtMs ? new Date(expiresAtMs).toISOString() : null,
        streak_freezes: STREAK_FREEZE_MAX,
      })
      .eq('id', userId);
  } else {
    await supabase.from('users').update({ is_pro: false }).eq('id', userId);
  }
}

// ─── Coin packs (consumables) ─────────────────────────────────

/**
 * RevenueCat product id → coins granted. Keep in sync with the products
 * configured in the RC dashboard (offering: "coins"). Consumables arrive
 * as NON_RENEWING_PURCHASE webhook events.
 */
export const COIN_PACKS: Record<string, number> = {
  coins_1000: 1000,
  coins_5500: 5500,
  coins_12000: 12000,
};

/** Atomically credit purchased coins (add_coins() DB function). */
async function grantCoins(userId: string, amount: number): Promise<void> {
  const { error } = await supabase.rpc('add_coins', {
    p_user_id: userId,
    p_amount: amount,
  });
  if (error) throw new Error(`grantCoins failed: ${error.message}`);
}

// ─── Webhook event handling ───────────────────────────────────

interface RevenueCatEvent {
  type?: string;
  app_user_id?: string;
  product_id?: string;
  expiration_at_ms?: number | null;
}

/** Event types that grant/keep access. */
const ACTIVE_EVENTS = new Set([
  'INITIAL_PURCHASE',
  'RENEWAL',
  'UNCANCELLATION',
  'NON_RENEWING_PURCHASE',
  'SUBSCRIPTION_EXTENDED',
  'PRODUCT_CHANGE',
]);
/** Event types that revoke access. */
const INACTIVE_EVENTS = new Set(['EXPIRATION']);
// CANCELLATION / BILLING_ISSUE keep access until the current period ends, so we
// intentionally ignore them and wait for EXPIRATION.

export async function processWebhookEvent(event: RevenueCatEvent): Promise<void> {
  const userId = event.app_user_id;
  // Ignore anonymous ids — we always call Purchases.logIn(user.id) on the client,
  // so a real event carries our UUID.
  if (!userId || userId.startsWith('$RCAnonymousID')) return;

  // Coin packs are consumables, NOT a Pro entitlement — handle them first so a
  // NON_RENEWING_PURCHASE of a coin product never flips is_pro.
  const coinAmount = COIN_PACKS[event.product_id ?? ''];
  if (coinAmount) {
    if (event.type === 'NON_RENEWING_PURCHASE') {
      await grantCoins(userId, coinAmount);
      track(userId, 'coins_purchased', { productId: event.product_id, coins: coinAmount });
    }
    return;
  }

  if (ACTIVE_EVENTS.has(event.type ?? '')) {
    await applyEntitlement(userId, true, event.expiration_at_ms ?? null);
  } else if (INACTIVE_EVENTS.has(event.type ?? '')) {
    await applyEntitlement(userId, false, null);
  }
}
