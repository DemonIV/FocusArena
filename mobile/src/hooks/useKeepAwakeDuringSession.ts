import { useEffect } from 'react';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { useTimerStore } from '../stores/timerStore';

const TAG = 'focus-session';

/**
 * Keep the screen on while a focus session is actively running.
 *
 * Auto-lock (OS screen timeout) fires AppState 'background' — which Strict Mode
 * reads as "left the app" (burning the session) and the Focus Score reads as an
 * exit (tanking presence/steadiness), even though the student never left. For a
 * study app, putting the phone down IS the goal, so a session that dies because
 * the screen dimmed is the worst possible failure. Holding the screen awake for
 * the duration removes the involuntary lock entirely. A pause releases it (the
 * legitimate way to step away), as does stopping or the app being torn down.
 *
 * Mounted once at the app root so it survives tab switches during a session.
 */
export function useKeepAwakeDuringSession() {
  const isActive = useTimerStore((s) => s.isActive);
  const isPaused = useTimerStore((s) => s.isPaused);

  useEffect(() => {
    if (!isActive || isPaused) return;
    void activateKeepAwakeAsync(TAG).catch(() => {});
    return () => { void deactivateKeepAwake(TAG).catch(() => {}); };
  }, [isActive, isPaused]);
}
