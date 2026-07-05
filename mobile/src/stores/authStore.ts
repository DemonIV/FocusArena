import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { mmkvStorage } from '../utils/storage';
import { api } from '../services/api';
import { authService } from '../services/auth.service';
import { identifyUser, resetUser } from '../services/analytics';
import { loginBilling, logoutBilling } from '../services/billing';
import { useBillingStore } from './billingStore';
import type { User, AuthTokens } from '../types';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  refreshToken: string | null;
  isLoading: boolean;
  isHydrated: boolean;

  // Actions
  setAuth: (user: User, tokens: AuthTokens) => void;
  clearAuth: () => void;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, username: string) => Promise<void>;
  logout: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  refreshAccessToken: () => Promise<string | null>;
  setHydrated: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isLoading: false,
      isHydrated: false,

      setHydrated: () => set({ isHydrated: true }),

      setAuth: (user, tokens) => {
        api.setToken(tokens.accessToken);
        identifyUser(user.id, { username: user.username });
        // Tie RevenueCat to our user id, then sync Pro status (both no-op without keys).
        void loginBilling(user.id).then(() => useBillingStore.getState().refresh());
        set({ user, accessToken: tokens.accessToken, refreshToken: tokens.refreshToken });
      },

      clearAuth: () => {
        api.clearToken();
        resetUser();
        void logoutBilling();
        useBillingStore.getState().setPro(false);
        set({ user: null, accessToken: null, refreshToken: null });
      },

      login: async (email, password) => {
        set({ isLoading: true });
        try {
          const { user, accessToken, refreshToken } = await authService.login(email, password);
          get().setAuth(user, { accessToken, refreshToken });
        } finally {
          set({ isLoading: false });
        }
      },

      register: async (email, password, username) => {
        set({ isLoading: true });
        try {
          const { user, accessToken, refreshToken } = await authService.register(email, password, username);
          get().setAuth(user, { accessToken, refreshToken });
        } finally {
          set({ isLoading: false });
        }
      },

      logout: async () => {
        // Fire server-side logout best-effort (uses the still-current token),
        // but DON'T await it — clear local state immediately so the UI redirects
        // to the login screen instantly, even when offline or token is expired.
        void authService.logout().catch(() => { /* ignore */ });
        get().clearAuth();
      },

      deleteAccount: async () => {
        // Unlike logout this MUST succeed server-side first — clearing local
        // state on failure would leave the account alive while looking deleted.
        await authService.deleteAccount();
        get().clearAuth();
      },

      refreshAccessToken: async () => {
        const { refreshToken } = get();
        // No refresh token → session is unrecoverable. Clear auth so the
        // navigator redirects to login instead of leaving the app stuck.
        if (!refreshToken) { get().clearAuth(); return null; }
        try {
          const data = await authService.refresh(refreshToken);
          api.setToken(data.accessToken);
          set({ accessToken: data.accessToken, refreshToken: data.refreshToken });
          return data.accessToken;
        } catch {
          get().clearAuth();
          return null;
        }
      },
    }),
    {
      name: 'auth',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: (s) => ({ user: s.user, accessToken: s.accessToken, refreshToken: s.refreshToken }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Restore token into api client after hydration
          if (state.accessToken) api.setToken(state.accessToken);
          // Re-identify the restored user for analytics/crash reports
          if (state.user) identifyUser(state.user.id, { username: state.user.username });
          // Register refresh callback
          api.setOnRefresh(() => state.refreshAccessToken());
          state.setHydrated();
        }
      },
    },
  ),
);
