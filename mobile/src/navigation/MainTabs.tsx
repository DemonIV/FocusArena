import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text } from 'react-native';
import type { MainTabParamList } from '../types';
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

export function MainTabs() {
  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: '#16213e' },
        headerTintColor: '#ffffff',
        headerTitleStyle: { fontWeight: '700', letterSpacing: 0.5 },
        tabBarStyle: {
          backgroundColor: '#16213e',
          borderTopColor: '#0f3460',
          borderTopWidth: 1,
          height: 60,
          paddingBottom: 8,
          paddingTop: 4,
        },
        tabBarActiveTintColor: '#00d2ff',
        tabBarInactiveTintColor: '#4a4a6a',
        tabBarLabel: route.name,
        tabBarIcon: ({ focused }) => (
          <Text style={{ fontSize: focused ? 20 : 16, opacity: focused ? 1 : 0.6 }}>
            {ICONS[route.name] ?? '◉'}
          </Text>
        ),
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'FocusArena' }} />
      <Tab.Screen name="Timer" component={TimerScreen} options={{ title: 'Timer' }} />
      <Tab.Screen name="Leaderboard" component={LeaderboardScreen} options={{ title: 'Leaderboard' }} />
      <Tab.Screen name="Rooms" component={RoomsScreen} options={{ title: 'Rooms' }} />
      <Tab.Screen name="Friends" component={FriendsScreen} options={{ title: 'Friends' }} />
      <Tab.Screen name="Profile" component={ProfileScreen} options={{ title: 'Profile' }} />
    </Tab.Navigator>
  );
}
