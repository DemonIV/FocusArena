/**
 * Live Activity — iOS lock-screen / Dynamic Island countdown for a running
 * focus session. The native timer ticks itself from a fixed end date, so the
 * student sees the remaining time without unlocking (and without us pushing a
 * per-second update). iOS 16.2+ only; a no-op everywhere else.
 *
 * Wrapped so the rest of the app never imports the native module directly and
 * never has to platform-guard: every call here is inert off iOS.
 */
import { Platform } from 'react-native';
import * as LiveActivity from 'expo-live-activity';

const BG = '#0d0d1a';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';
const ACCENT = '#00d2ff';
const PAUSE = '#f59e0b';

const isIOS = Platform.OS === 'ios';

// One session → one activity. Kept module-local so start/update/end line up.
let activeId: string | undefined;

interface StartOpts {
  title: string;
  subtitle?: string;
  /** Epoch ms when the session ends — drives the self-ticking countdown. */
  endDate: number;
}

export function startFocusActivity({ title, subtitle, endDate }: StartOpts): void {
  if (!isIOS) return;
  // Replace any stale activity first so we never leak one.
  endFocusActivity();
  try {
    const id = LiveActivity.startActivity(
      { title, subtitle, progressBar: { date: endDate } },
      {
        backgroundColor: BG,
        titleColor: TEXT,
        subtitleColor: MUTED,
        progressViewTint: ACCENT,
        progressViewLabelColor: TEXT,
        timerType: 'digital',
        deepLinkUrl: 'studysquad://timer',
      },
    );
    activeId = typeof id === 'string' ? id : undefined;
  } catch {
    // Unsupported iOS version, Live Activities disabled in Settings, etc.
    activeId = undefined;
  }
}

/** Countdown resumed / restarted with a fresh end date. */
export function runningFocusActivity(title: string, subtitle: string | undefined, endDate: number): void {
  if (!isIOS || !activeId) return;
  try {
    LiveActivity.updateActivity(activeId, { title, subtitle, progressBar: { date: endDate } });
  } catch { /* ignore */ }
}

/** Paused — swap the ticking timer for a frozen progress bar. */
export function pausedFocusActivity(title: string, subtitle: string | undefined, progress: number): void {
  if (!isIOS || !activeId) return;
  try {
    LiveActivity.updateActivity(activeId, {
      title,
      subtitle,
      progressBar: { progress: Math.max(0, Math.min(1, progress)) },
    });
  } catch { /* ignore */ }
}

export function endFocusActivity(finalTitle?: string): void {
  if (!isIOS || !activeId) return;
  try {
    LiveActivity.stopActivity(activeId, { title: finalTitle ?? '', progressBar: { progress: 1 } });
  } catch { /* ignore */ }
  activeId = undefined;
}

// The paused bar uses amber to match the app's pause colour; exported so the
// hook doesn't hard-code palette values.
export const LIVE_ACTIVITY_PAUSE_COLOR = PAUSE;
