import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { reportStall } from '../services/analytics';

const BEAT_MS = 1_000;
/** Below this, drift is just normal scheduling noise. */
const STALL_MS = 4_000;
/** Don't spam Sentry while a long stall keeps repeating. */
const QUIET_MS = 60_000;

/**
 * Measures how late a 1-second heartbeat actually fires. A timer that should
 * run every second but arrives 8 seconds late means the JS thread was busy (or
 * blocked in a synchronous native call) for those 8 seconds — which is exactly
 * what a user sees as "the clock froze but the animations kept playing", since
 * Reanimated runs on the UI thread.
 *
 * Reports to Sentry with the last `trace()` breadcrumb attached, so the event
 * names what was running when the thread went away. Backgrounding also stops
 * timers, so spells that span a background transition are ignored.
 */
export function useJsThreadWatchdog() {
  const lastBeat = useRef(Date.now());
  const lastReport = useRef(0);
  const backgroundedAt = useRef<number | null>(
    AppState.currentState === 'active' ? null : Date.now(),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      if (next === 'active') {
        backgroundedAt.current = null;
        lastBeat.current = Date.now(); // ignore the gap we spent suspended
      } else {
        backgroundedAt.current = Date.now();
      }
    });

    const iv = setInterval(() => {
      const now = Date.now();
      const drift = now - lastBeat.current - BEAT_MS;
      lastBeat.current = now;

      if (backgroundedAt.current !== null) return; // suspended, not stalled
      if (drift < STALL_MS) return;
      if (now - lastReport.current < QUIET_MS) return;

      lastReport.current = now;
      reportStall(drift, { appState: AppState.currentState });
    }, BEAT_MS);

    return () => {
      clearInterval(iv);
      sub.remove();
    };
  }, []);
}
