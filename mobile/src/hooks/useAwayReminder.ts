import { useEffect, useRef } from 'react';
import { AppState, Alert } from 'react-native';
import { useTimerStore } from '../stores/timerStore';
import i18n from '../i18n';
import { resetLockFlag, consumeScreenLocked } from '../services/screenLock';

/** Ignore quick glances — only nudge after a real detour into another app. */
const AWAY_THRESHOLD_MS = 15_000;

/**
 * Gentle "come back to focus" nudge when the user leaves to ANOTHER APP during
 * a running session — but never when they just lock the phone to study.
 *
 * iOS suspends JS in the background, so we can't reliably act while away; we
 * decide on return instead: if the absence was long enough AND the screen never
 * locked (native ScreenLock flag), it was an app-switch → nudge. Locking, or an
 * unknown/unsupported platform, stays silent (fail-safe). Non-destructive.
 * Mounted once at the app root.
 */
export function useAwayReminder() {
  const leftAt = useRef<number | null>(null);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'background') {
        const s = useTimerStore.getState();
        if (s.isActive && !s.isPaused) {
          leftAt.current = Date.now();
          resetLockFlag(); // begin watching for a lock during this absence
        } else {
          leftAt.current = null;
        }
        return;
      }

      if (next === 'active') {
        const since = leftAt.current;
        leftAt.current = null;
        if (since == null) return;
        if (Date.now() - since < AWAY_THRESHOLD_MS) return; // quick glance
        if (consumeScreenLocked()) return;                  // locked → focusing, fine
        if (!useTimerStore.getState().isActive) return;     // session ended while away
        Alert.alert(i18n.t('focusReminder.title'), i18n.t('focusReminder.body'));
      }
    });

    return () => sub.remove();
  }, []);
}
