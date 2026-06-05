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
  /** Opaque RC package handed straight back to purchase(). */
  raw: unknown;
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
