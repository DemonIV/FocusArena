import React, { useEffect } from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import { useTranslation } from 'react-i18next';
import type { MainTabParamList } from '../types';
import * as Localization from 'expo-localization';
import { registerForPushNotifications, leaderboardService } from '../services';
import {
  HomeScreen,
  TimerScreen,
  LeaderboardScreen,
  RoomsScreen,
  FriendsScreen,
  ProfileScreen,
} from '../screens';

const Tab = createBottomTabNavigator<MainTabParamList>();

const ICONS: Record<string, string> = {
  Home: '🏠',
  Timer: '⏱',
  Leaderboard: '🏆',
  Rooms: '🚪',
  Friends: '👥',
  Profile: '👤',
};

const NAV_KEY: Record<string, string> = {
  Home: 'nav.home',
  Timer: 'nav.timer',
  Leaderboard: 'nav.leaderboard',
  Rooms: 'nav.rooms',
  Friends: 'nav.friends',
  Profile: 'nav.profile',
};

export function MainTabs() {
  const { t } = useTranslation();

  // Register this device for push notifications once the user is in the app.
  useEffect(() => {
    void registerForPushNotifications();

    // Auto-report the device's country for Country Wars (best-effort).
    const region = Localization.getLocales()[0]?.regionCode;
    if (region && /^[A-Za-z]{2}$/.test(region)) {
      leaderboardService.setCountry(region).catch(() => { /* ignore */ });
    }
  }, []);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#131325' },
        headerTintColor: '#e2e8f0',
        headerShadowVisible: false,
        headerTitleStyle: { fontWeight: '700', letterSpacing: 0.5 },
        tabBarStyle: {
          backgroundColor: '#131325',
          borderTopColor: 'rgba(255,255,255,0.08)',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#00d2ff',
        tabBarInactiveTintColor: '#64748b',
        tabBarLabel: t(NAV_KEY[route.name] ?? route.name),
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 20 : 16, opacity: focused ? 1 : 0.6 }}>
            {ICONS[route.name] ?? '◉'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'FocusArena' }} />
      <Tab.Screen name="Timer" component={TimerScreen} options={{ title: t('nav.timer') }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: t('nav.leaderboard') }} />
      <Tab.Screen name="Rooms" component={RoomsScreen} options={{ title: t('nav.rooms') }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: t('nav.friends') }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: t('nav.profile') }} />
    </Tab.Navigator>
  );
}
