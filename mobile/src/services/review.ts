import * as StoreReview from 'expo-store-review';
import { useSettingsStore } from '../stores/settingsStore';
import { track } from './analytics';

/**
 * In-app store-review ask, gated so it only fires at a happy moment and never
 * nags: at least MIN_SESSIONS completed sessions on this device, and at most
 * once per COOLDOWN. The OS applies its own quota on top (iOS ~3/year, Play
 * Store similar), so a swallowed request simply shows nothing.
 */
const MIN_SESSIONS = 3;
const COOLDOWN_MS = 45 * 24 * 60 * 60 * 1000; // 45 days

/**
 * Call right after the Study Receipt closes (i.e. a completed session was
 * just celebrated). Counts the session, then asks for a rating when the
 * gates allow it. Fully best-effort — never throws, no-ops in Expo Go.
 */
export async function maybeRequestReview(): Promise<void> {
  try {
    const store = useSettingsStore.getState();
    store.recordCompletedSession();

    const { completedSessions, lastReviewPromptAt } = useSettingsStore.getState();
    if (completedSessions < MIN_SESSIONS) return;
    if (lastReviewPromptAt !== null && Date.now() - lastReviewPromptAt < COOLDOWN_MS) return;
    if (!(await StoreReview.isAvailableAsync())) return;

    // Mark BEFORE requesting: the OS gives no feedback on whether a dialog
    // was actually shown, and we'd rather under-ask than loop on failures.
    useSettingsStore.getState().markReviewPrompted();
    track('review_prompted', { sessions: completedSessions });
    await StoreReview.requestReview();
  } catch {
    /* best-effort */
  }
}
