import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore, useOnboardingStore } from './src/stores';
import { RootNavigator } from './src/navigation';
import { initAnalytics, Sentry } from './src/services/analytics';
import './src/i18n'; // initialise i18next (device language + saved preference)

// Initialise Sentry + PostHog once, before the app renders (no-op without keys).
initAnalytics();

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
      gcTime: 5 * 60_000,
    },
  },
});

function AppInner() {
  const isHydrated = useAuthStore((s) => s.isHydrated);
  const onbHydrated = useOnboardingStore((s) => s.isHydrated);

  useEffect(() => {
    // Trigger MMKV → Zustand hydration
    void useAuthStore.persist.rehydrate();
    void useOnboardingStore.persist.rehydrate();
  }, []);

  if (!isHydrated || !onbHydrated) {
    // Wait for persisted state to load before rendering navigator
    return null;
  }

  return (
    <>
      <StatusBar style="light" backgroundColor="#1a1a2e" />
      <RootNavigator />
    </>
  );
}

function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}

// Sentry.wrap adds crash/error boundary + performance context (no-op without DSN).
export default Sentry.wrap(App);
