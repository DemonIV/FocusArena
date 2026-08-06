import * as Sentry from '@sentry/react-native';
import PostHog from 'posthog-react-native';

// Observability is OPT-IN: with no EXPO_PUBLIC keys set every helper is a no-op,
// so Expo Go / local runs behave exactly as before (no crashes, no warnings).
const SENTRY_DSN = process.env.EXPO_PUBLIC_SENTRY_DSN?.trim();
const POSTHOG_KEY = process.env.EXPO_PUBLIC_POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.EXPO_PUBLIC_POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

export const sentryEnabled = Boolean(SENTRY_DSN);

/** JSON-serialisable analytics property bag (matches PostHog's accepted values). */
type Props = Record<string, string | number | boolean | null>;

let posthog: PostHog | null = null;

/** Initialise Sentry + PostHog. Call once, as early as possible (App module load). */
export function initAnalytics(): void {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: __DEV__ ? 'development' : 'production',
      tracesSampleRate: 0.1,
    });
  }
  if (POSTHOG_KEY) {
    posthog = new PostHog(POSTHOG_KEY, { host: POSTHOG_HOST });
  }
}

/** Product-analytics event. No-op when PostHog isn't configured. */
export function track(event: string, properties?: Props): void {
  posthog?.capture(event, properties);
}

/**
 * Marker for work that could block the JS thread — native module calls above
 * all. Cheap (in-memory) and it rides along on any Sentry event, so when the
 * watchdog reports a stall the last marker names what was running.
 */
export function trace(step: string, data?: Props): void {
  if (!sentryEnabled) return;
  Sentry.addBreadcrumb({ category: 'jsblock', message: step, level: 'info', data: data ?? undefined });
}

/** Report a JS-thread stall with the drift that was measured. */
export function reportStall(driftMs: number, context: Props): void {
  if (!sentryEnabled) return;
  Sentry.captureMessage(`js-thread-stall ${Math.round(driftMs / 1000)}s`, {
    level: 'warning',
    extra: { driftMs, ...context },
  });
}

/** Tie subsequent events to a user (call on login / auth restore). */
export function identifyUser(id: string, properties?: Props): void {
  posthog?.identify(id, properties);
  if (sentryEnabled) Sentry.setUser({ id });
}

/** Clear user association (call on logout). */
export function resetUser(): void {
  posthog?.reset();
  if (sentryEnabled) Sentry.setUser(null);
}

export { Sentry };
