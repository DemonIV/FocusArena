import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useTimerStore } from '../stores/timerStore';

/**
 * App-wide AppState listener that feeds the Focus Score: it records when the
 * app leaves/returns to the foreground so the timer store can tally how many
 * times and how long the user stepped away mid-session. The store self-gates
 * (only counts while a session is actively running), so this is safe to mount
 * once at the app root regardless of which tab is on screen.
 */
export function useFocusTracking() {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (next) => {
      // Only 'background'/'active' — ignore the brief 'inactive' iOS emits for
      // the app switcher / control center, which would over-count exits.
      const store = useTimerStore.getState();
      if (next === 'background') {
        store.noteBackground();
      } else if (next === 'active') {
        store.noteForeground();
      }
    });
    return () => sub.remove();
  }, []);
}
