import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { useTimerStore } from '../stores/timerStore';
import { useSocketStore } from '../stores/socketStore';
import { msToDisplay } from '../utils/formatTime';

export function useTimer() {
  const store = useTimerStore();
  const { sendPresence } = useSocketStore();

  // Sync with server when app comes to foreground
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next: AppStateStatus) => {
      if (next === 'active') void store.syncWithServer();
    });
    return () => sub.remove();
  }, []);

  // Update presence when timer state changes
  useEffect(() => {
    if (store.isActive && !store.isPaused) sendPresence('studying');
    else if (store.isPaused) sendPresence('break');
  }, [store.isActive, store.isPaused]);

  const start = async (duration: number, subjectId?: string) => {
    await store.start(duration, subjectId);
    sendPresence('studying');
  };

  const pause = async () => {
    await store.pause();
    sendPresence('break');
  };

  const resume = async () => {
    await store.resume();
    sendPresence('studying');
  };

  const stop = async () => {
    const result = await store.stop();
    sendPresence('offline');
    return result;
  };

  return {
    // State
    isActive: store.isActive,
    isPaused: store.isPaused,
    isLoading: store.isLoading,
    elapsedMs: store.elapsedMs,
    remainingMs: store.remainingMs,
    duration: store.duration,
    sessionId: store.sessionId,
    subjectId: store.subjectId,

    // Derived display values
    timeDisplay: msToDisplay(store.remainingMs),
    progress: store.duration > 0
      ? Math.min(1, store.elapsedMs / (store.duration * 60_000))
      : 0,

    // Actions
    start,
    pause,
    resume,
    stop,
    syncWithServer: store.syncWithServer,
  };
}
