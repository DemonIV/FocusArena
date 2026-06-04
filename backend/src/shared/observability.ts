import * as Sentry from '@sentry/node';
import { PostHog } from 'posthog-node';

// All observability is OPT-IN: with no env keys set, every helper here is a
// no-op so local/dev runs (and Expo Go) behave exactly as before.
const SENTRY_DSN = process.env.SENTRY_DSN?.trim();
const POSTHOG_KEY = process.env.POSTHOG_KEY?.trim();
const POSTHOG_HOST = process.env.POSTHOG_HOST?.trim() || 'https://us.i.posthog.com';

let posthog: PostHog | null = null;

export const sentryEnabled = Boolean(SENTRY_DSN);
export const analyticsEnabled = Boolean(POSTHOG_KEY);

/** Initialise Sentry + PostHog. Call once, as early as possible in bootstrap. */
export function initObservability(): void {
  if (SENTRY_DSN) {
    Sentry.init({
      dsn: SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
  }
  if (POSTHOG_KEY) {
    posthog = new PostHog(POSTHOG_KEY, {
      host: POSTHOG_HOST,
      // The backend runs on Fly with auto_stop_machines + min_machines_running=0,
      // so the process is suspended as soon as it goes idle — often before a
      // batched flush (or the kill-grace shutdown flush) can complete. Send each
      // event in its own request so it leaves the process during the live window.
      flushAt: 1,
      flushInterval: 10_000,
    });
  }
}

/** Report an exception to Sentry (no-op when Sentry isn't configured). */
export function captureException(err: unknown, extra?: Record<string, unknown>): void {
  if (sentryEnabled) Sentry.captureException(err, extra ? { extra } : undefined);
}

/**
 * Fire-and-forget product-analytics event. Buffered + flushed by posthog-node,
 * so this never blocks the request path. No-op when PostHog isn't configured.
 */
export function track(
  distinctId: string,
  event: string,
  properties?: Record<string, unknown>,
): void {
  posthog?.capture({ distinctId, event, properties });
}

/** Flush any buffered events. Call during graceful shutdown. */
export async function shutdownObservability(): Promise<void> {
  try {
    await posthog?.shutdown();
  } catch {
    /* best-effort */
  }
  if (sentryEnabled) {
    try {
      await Sentry.flush(2_000);
    } catch {
      /* best-effort */
    }
  }
}

export { Sentry };
