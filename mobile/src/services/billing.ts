import { Platform } from 'react-native';

// Billing is OPT-IN, just like analytics: with no EXPO_PUBLIC RevenueCat key the
// whole module is a no-op (isPro stays false, paywall never appears) so Expo Go /
// local runs behave exactly as before.
const IOS_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY?.trim();
const ANDROID_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY?.trim();
const API_KEY = Platform.OS === 'ios' ? IOS_KEY : ANDROID_KEY;

/** Entitlement identifier configured in the RevenueCat dashboard. */
const ENTITLEMENT_ID = 'pro';

export const billingEnabled = Boolean(API_KEY);

/**
 * Minimal shape of a purchasable package we surface to the UI. Kept local so the
 * app type-checks before the native `react-native-purchases` package is installed.
 */
export interface ProPackage {
  identifier: string;
  priceString: string;
  title: string;
  /** RevenueCat period type: 'MONTHLY' | 'ANNUAL' | … (best-effort). */
  period: string;
  /** Numeric price in the store currency (0 when unknown) — for savings math only. */
  price: number;
  /** Free-trial length in days (0 = no trial). Trial itself is configured per-product in the stores. */
  trialDays: number;
  /** Opaque RC package handed straight back to purchase(). */
  raw: unknown;
}

/** Days in a free introductory offer, 0 when there is none (best-effort across platforms). */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function trialDaysFromProduct(product: any): number {
  const intro = product?.introPrice;
  if (!intro || (intro.price ?? 0) > 0) return 0;
  const units = intro.periodNumberOfUnits ?? 0;
  switch (intro.periodUnit) {
    case 'DAY': return units;
    case 'WEEK': return units * 7;
    case 'MONTH': return units * 30;
    case 'YEAR': return units * 365;
    default: return 0;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Purchases: any = null;

/** Lazily require the native SDK so Expo Go / web bundles don't choke on it. */
function load(): unknown | null {
  if (!billingEnabled) return null;
  if (Purchases) return Purchases;
  try {
    // Indirect id so the bundler/TS doesn't hard-resolve the native module
    // (keeps Expo Go + pre-install type-checking happy).
    const moduleId = 'react-native-purchases';
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Purchases = require(moduleId).default;
    return Purchases;
  } catch {
    return null;
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function hasPro(info: any): boolean {
  return Boolean(info?.entitlements?.active?.[ENTITLEMENT_ID]);
}

/** Configure RevenueCat once, as early as possible. No-op without a key. */
export function initBilling(): void {
  const P = load() as any;
  if (!P || !API_KEY) return;
  try {
    P.configure({ apiKey: API_KEY });
  } catch {
    /* native module unavailable (e.g. Expo Go) — ignore */
  }
}

/** Tie purchases to our backend user id (call on login / auth restore). */
export async function loginBilling(userId: string): Promise<void> {
  const P = load() as any;
  if (!P) return;
  try {
    await P.logIn(userId);
  } catch {
    /* ignore */
  }
}

/** Detach the user (call on logout). */
export async function logoutBilling(): Promise<void> {
  const P = load() as any;
  if (!P) return;
  try {
    await P.logOut();
  } catch {
    /* ignore */
  }
}

/** Whether the user currently holds the "pro" entitlement (per the store). */
export async function checkProEntitlement(): Promise<boolean> {
  const P = load() as any;
  if (!P) return false;
  try {
    return hasPro(await P.getCustomerInfo());
  } catch {
    return false;
  }
}

/** Available Pro packages (monthly / annual) from the current offering. */
export async function getProPackages(): Promise<ProPackage[]> {
  const P = load() as any;
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const pkgs = offerings?.current?.availablePackages ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return pkgs.map((pkg: any) => ({
      identifier: pkg.identifier,
      priceString: pkg.product?.priceString ?? '',
      title: pkg.product?.title ?? '',
      period: pkg.packageType ?? '',
      price: pkg.product?.price ?? 0,
      trialDays: trialDaysFromProduct(pkg.product),
      raw: pkg,
    }));
  } catch {
    return [];
  }
}

/**
 * Purchase a package. Returns true if it resulted in an active "pro" entitlement.
 * Throws on real errors; a user-cancelled purchase resolves to false.
 */
export async function purchaseProPackage(pkg: ProPackage): Promise<boolean> {
  const P = load() as any;
  if (!P) return false;
  try {
    const { customerInfo } = await P.purchasePackage(pkg.raw);
    return hasPro(customerInfo);
  } catch (e: unknown) {
    // RevenueCat sets userCancelled on deliberate cancellation — treat as no-op.
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

// ─── Coin packs (consumables) ─────────────────────────────────

/** A purchasable coin pack from the RC "coins" offering. */
export interface CoinPackage {
  identifier: string;
  priceString: string;
  /** Coins granted — parsed from the product id (e.g. "coins_5500" → 5500). */
  coins: number;
  /** Opaque RC package handed straight back to purchase(). */
  raw: unknown;
}

/** "coins_5500" → 5500; 0 when the id doesn't follow the convention. */
function coinsFromProductId(id: string): number {
  const m = /(\d+)\s*$/.exec(id);
  return m ? parseInt(m[1], 10) : 0;
}

/** Coin packs from the RC offering named "coins" (empty when billing is off). */
export async function getCoinPackages(): Promise<CoinPackage[]> {
  const P = load() as any;
  if (!P) return [];
  try {
    const offerings = await P.getOfferings();
    const pkgs = offerings?.all?.coins?.availablePackages ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return pkgs
      .map((pkg: any) => ({
        identifier: pkg.identifier,
        priceString: pkg.product?.priceString ?? '',
        coins: coinsFromProductId(pkg.product?.identifier ?? pkg.identifier ?? ''),
        raw: pkg,
      }))
      .filter((p: CoinPackage) => p.coins > 0)
      .sort((a: CoinPackage, b: CoinPackage) => a.coins - b.coins);
  } catch {
    return [];
  }
}

/**
 * Purchase a coin pack. Returns true on success; a user-cancelled purchase
 * resolves to false. Coins are credited by the backend webhook (may take a
 * few seconds), so refetch the balance after this resolves.
 */
export async function purchaseCoinPackage(pkg: CoinPackage): Promise<boolean> {
  const P = load() as any;
  if (!P) return false;
  try {
    await P.purchasePackage(pkg.raw);
    return true;
  } catch (e: unknown) {
    if ((e as { userCancelled?: boolean })?.userCancelled) return false;
    throw e;
  }
}

/** Restore previous purchases. Returns true if "pro" is now active. */
export async function restoreProPurchases(): Promise<boolean> {
  const P = load() as any;
  if (!P) return false;
  try {
    return hasPro(await P.restorePurchases());
  } catch {
    return false;
  }
}
