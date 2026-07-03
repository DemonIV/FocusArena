import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

interface SettingsState {
  /** User's push-notification opt-in (mirrored to the backend on toggle). */
  pushEnabled: boolean;
  setPushEnabled: (enabled: boolean) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      pushEnabled: true,
      setPushEnabled: (enabled) => set({ pushEnabled: enabled }),
    }),
    {
      name: 'settings',
      storage: createJSONStorage(() => mmkvStorage),
    },
  ),
);
