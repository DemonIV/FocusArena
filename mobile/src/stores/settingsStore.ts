import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

interface SettingsState {
  /** User's push-notification opt-in (mirrored to the backend on toggle). */
  pushEnabled: boolean;
  setPushEnabled: (enabled: boolean) => void;

  /** Pomodoro: when a focus round finishes, start the break automatically. */
  pomodoroAutoBreak: boolean;
  setPomodoroAutoBreak: (enabled: boolean) => void;
  /** Pomodoro: when a break ends, start the next focus round automatically. */
  pomodoroAutoFocus: boolean;
  setPomodoroAutoFocus: (enabled: boolean) => void;

  /** Completed focus sessions on this device — gates the store-review ask. */
  completedSessions: number;
  recordCompletedSession: () => void;
  /** When we last showed (or tried to show) the native review prompt. */
  lastReviewPromptAt: number | null;
  markReviewPrompted: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushEnabled: true,
      setPushEnabled: (enabled) => set({ pushEnabled: enabled }),

      // Defaults preserve the original flow: breaks auto-start, focus rounds don't.
      pomodoroAutoBreak: true,
      setPomodoroAutoBreak: (enabled) => set({ pomodoroAutoBreak: enabled }),
      pomodoroAutoFocus: false,
      setPomodoroAutoFocus: (enabled) => set({ pomodoroAutoFocus: enabled }),

      completedSessions: 0,
      recordCompletedSession: () =>
        set((s) => ({ completedSessions: s.completedSessions + 1 })),
      lastReviewPromptAt: null,
      markReviewPrompted: () => set({ lastReviewPromptAt: Date.now() }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
