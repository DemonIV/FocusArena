import { useEffect, useRef, useState, useCallback } from 'react';
import { AppState } from 'react-native';
import * as Notifications from 'expo-notifications';
import { useSettingsStore } from '../stores/settingsStore';
import { useTimerStore } from '../stores/timerStore';
import { track } from '../services/analytics';
import i18n from '../i18n';

/** How long the user may stay outside the app before the session burns. */
export const STRICT_GRACE_MS = 30_000;
/** Coins to rescue a burned session — keep in sync with backend RESCUE_COST. */
export const STRICT_RESCUE_COST = 200;

/**
 * A session can only "burn" while it is genuinely running: active, not
 * paused (pausing first is the legitimate way to leave), and not already
 * past its planned duration (then it completed while the user was away —
 * be generous and let the normal completion flow handle it).
 */
function sessionBurnable(): boolean {
  const s = useTimerStore.getState();
  if (!s.isActive || s.isPaused) return false;
  const elapsed = s.accumulatedMs + (Date.now() - s.startTime);
  return elapsed < s.duration * 60_000;
}

/**
 * Forest-style Strict Mode: while a session is running and the toggle is on,
 * backgrounding the app starts a grace countdown. A local notification warns
 * the user; if they come back after the grace period the session is "burned"
 * and `violated` flips true so the screen can offer a coin rescue or forfeit.
 *
 * `strictLeftAt` is persisted, so killing the app while away still counts as
 * a violation on the next launch (checked once the server session is synced).
 */
export function useStrictMode() {
  const [violated, setViolated] = useState(false);
  const warnIdRef = useRef<string | null>(null);
  // Violation carried over from a killed process, waiting for the timer
  // store to re-sync with the server before it can be confirmed.
  const pendingKillViolationRef = useRef(false);

  const cancelWarning = useCallback(() => {
    const id = warnIdRef.current;
    warnIdRef.current = null;
    if (id) void Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  }, []);

  // App-kill recovery, step 1: consume the persisted leftAt.
  useEffect(() => {
    const { strictLeftAt, strictMode, setStrictLeftAt } = useSettingsStore.getState();
    if (strictLeftAt === null) return;
    setStrictLeftAt(null);
    if (strictMode && Date.now() - strictLeftAt > STRICT_GRACE_MS) {
      pendingKillViolationRef.current = true;
    }
  }, []);

  // App-kill recovery, step 2: once syncWithServer restores the session,
  // confirm the pending violation (no session restored → nothing to burn).
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);
  useEffect(() => {
    if (pendingKillViolationRef.current && isActive) {
      pendingKillViolationRef.current = false;
      if (sessionBurnable()) {
        track('strict_violation', { afterKill: true });
        setViolated(true);
      }
    }
  }, [isActive, isPaused]);

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      const { strictMode, strictLeftAt, setStrictLeftAt } = useSettingsStore.getState();

      if (next === 'background') {
        if (!strictMode || strictLeftAt !== null || !sessionBurnable()) return;
        setStrictLeftAt(Date.now());
        track('strict_left_app');
        void Notifications.scheduleNotificationAsync({
          content: {
            title: i18n.t('timer.strictWarnTitle'),
            body: i18n.t('timer.strictWarnBody'),
            sound: true,
          },
          trigger: {
            type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
            seconds: Math.round(STRICT_GRACE_MS / 2000), // warn halfway through the grace window
            channelId: 'default',
          },
        })
          .then((id) => { warnIdRef.current = id; })
          .catch(() => { /* Expo Go / permission denied — mechanic still works */ });
        return;
      }

      if (next === 'active') {
        cancelWarning();
        if (strictLeftAt === null) return;
        const away = Date.now() - strictLeftAt;
        setStrictLeftAt(null);
        if (strictMode && away > STRICT_GRACE_MS && sessionBurnable()) {
          track('strict_violation', { awayMs: away });
          setViolated(true);
        }
      }
    });

    return () => {
      sub.remove();
      cancelWarning();
    };
  }, [cancelWarning]);

  return { violated, clearViolation: useCallback(() => setViolated(false), []) };
}
