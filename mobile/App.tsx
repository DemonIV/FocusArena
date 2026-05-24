import React, { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useAuthStore } from './src/stores';
import { RootNavigator } from './src/navigation';

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

  useEffect(() => {
    // Trigger MMKV → Zustand hydration
    void useAuthStore.persist.rehydrate();
  }, []);

  if (!isHydrated) {
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

export default function App() {
  return (
    <SafeAreaProvider>
      <QueryClientProvider client={queryClient}>
        <AppInner />
      </QueryClientProvider>
    </SafeAreaProvider>
  );
}
