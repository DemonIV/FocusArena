import { useEffect } from 'react';
import { useTimerStore } from '../stores/timerStore';
import i18n from '../i18n';
import {
  startFocusActivity,
  runningFocusActivity,
  pausedFocusActivity,
  endFocusActivity,
} from '../services/liveActivity';

/**
 * Drives the iOS Live Activity from the timer store: one activity per session,
 * a self-ticking countdown while running, a frozen bar while paused, dismissed
 * on stop. Mounted once at the app root so it survives tab switches. Inert off
 * iOS (the service no-ops).
 */
export function useFocusLiveActivity() {
  const sessionId = useTimerStore((s) => s.sessionId);
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);

  // Start on a new session (incl. one restored at launch); end when it stops.
  useEffect(() => {
    if (!isActive || !sessionId) return;
    const s = useTimerStore.getState();
    startFocusActivity({
      title: i18n.t('liveActivity.title'),
      subtitle: i18n.t('liveActivity.subtitle'),
      endDate: Date.now() + s.remainingMs,
    });
    return () => endFocusActivity(i18n.t('liveActivity.done'));
  }, [sessionId, isActive]);

  // Reflect pause ↔ resume onto the activity.
  useEffect(() => {
    if (!isActive || !sessionId) return;
    const s = useTimerStore.getState();
    if (isPaused) {
      const progress = s.duration > 0 ? s.elapsedMs / (s.duration * 60_000) : 0;
      pausedFocusActivity(i18n.t('liveActivity.pausedTitle'), i18n.t('liveActivity.subtitle'), progress);
    } else {
      runningFocusActivity(i18n.t('liveActivity.title'), i18n.t('liveActivity.subtitle'), Date.now() + s.remainingMs);
    }
  }, [isPaused, sessionId, isActive]);
}
