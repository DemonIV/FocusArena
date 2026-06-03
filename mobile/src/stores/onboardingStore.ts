import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';

interface OnboardingState {
  completed: boolean;
  isHydrated: boolean;
  complete: () => void;
  reset: () => void;
  setHydrated: () => void;
}

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set) => ({
      completed: false,
      isHydrated: false,
      complete: () => set({ completed: true }),
      reset: () => set({ completed: false }),
      setHydrated: () => set({ isHydrated: true }),
    }),
    {
      name: 'onboarding',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ completed: s.completed }),
      onRehydrateStorage: () => (state) => {
        state?.setHydrated();
      },
    },
  ),
);
