import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

interface SettingsState {
  /** User's push-notification opt-in (mirrored to the backend on toggle). */
  pushEnabled: boolean;
  setPushEnabled: (enabled: boolean) => void;

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
