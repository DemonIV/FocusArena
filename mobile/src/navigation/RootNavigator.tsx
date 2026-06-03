import React, { useRef } from 'react';
import { NavigationContainer, DarkTheme, useNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import type { RootStackParamList, AuthStackParamList } from '../types';
import { useAuthStore, useOnboardingStore } from '../stores';
import { LoginScreen, RegisterScreen, OnboardingScreen } from '../screens';
import { MainTabs } from './MainTabs';
import { track } from '../services/analytics';

const Root = createNativeStackNavigator<RootStackParamList>();
const Auth = createNativeStackNavigator<AuthStackParamList>();

const AppTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: '#00d2ff',
    background: '#1a1a2e',
    card: '#16213e',
    text: '#ffffff',
    border: '#0f3460',
    notification: '#e94560',
  },
};

function AuthStack() {
  return (
    <Auth.Navigator screenOptions={{ headerShown: false }}>
      <Auth.Screen name="Login" component={LoginScreen} />
      <Auth.Screen name="Register" component={RegisterScreen} />
    </Auth.Navigator>
  );
}

export function RootNavigator() {
  const user = useAuthStore((s) => s.user);
  const accessToken = useAuthStore((s) => s.accessToken);
  const isAuthenticated = !!user && !!accessToken;

  const onboardingDone = useOnboardingStore((s) => s.completed);

  const navRef = useNavigationContainerRef();
  const routeNameRef = useRef<string | undefined>(undefined);

  return (
    <NavigationContainer
      theme={AppTheme}
      ref={navRef}
      onReady={() => {
        routeNameRef.current = navRef.getCurrentRoute()?.name;
      }}
      onStateChange={() => {
        const current = navRef.getCurrentRoute()?.name;
        if (current && current !== routeNameRef.current) {
          track('screen_viewed', { screen: current });
        }
        routeNameRef.current = current;
      }}
    >
      <Root.Navigator screenOptions={{ headerShown: false }}>
        {!isAuthenticated ? (
          <Root.Screen name="Auth" component={AuthStack} />
        ) : !onboardingDone ? (
          <Root.Screen name="Onboarding" component={OnboardingScreen} />
        ) : (
          <Root.Screen name="Main" component={MainTabs} />
        )}
      </Root.Navigator>
    </NavigationContainer>
  );
}
