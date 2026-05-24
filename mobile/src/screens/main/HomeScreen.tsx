import React, { useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList } from '../../types';
import { useAuth } from '../../hooks';
import { useTimerStore } from '../../stores';
import { StatCard } from '../../components';
import { timerService, achievementsService } from '../../services';
import { formatDuration } from '../../utils/formatTime';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { user } = useAuth();
  const timerActive = useTimerStore((s) => s.isActive);

  const statsQ = useQuery({
    queryKey: ['timer-stats'],
    queryFn: () => timerService.getStats(),
  });

  const achievQ = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsService.mine(),
  });

  const stats = statsQ.data;
  const badges = achievQ.data?.earned ?? [];

  const xpToNextLevel = user ? (500 - (user.xp % 500)) : 500;
  const levelProgress = user ? (user.xp % 500) / 500 : 0;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={statsQ.isFetching || achievQ.isFetching}
          onRefresh={() => { statsQ.refetch(); achievQ.refetch(); }}
          tintColor="#00d2ff"
        />
      }
    >
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.greeting}>Welcome back,</Text>
          <Text style={styles.username}>{user?.username ?? '—'}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Lv {user?.level ?? 1}</Text>
        </View>
      </View>

      {/* XP Progress */}
      <View style={styles.xpCard}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>XP Progress</Text>
          <Text style={styles.xpVal}>{user?.xp ?? 0} XP</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${levelProgress * 100}%` }]} />
        </View>
        <Text style={styles.xpSub}>{xpToNextLevel} XP to level {(user?.level ?? 1) + 1}</Text>
      </View>

      {/* Quick Stats */}
      <Text style={styles.sectionTitle}>Today's Stats</Text>
      <View style={styles.statsRow}>
        <StatCard
          label="Sessions"
          value={stats?.totalSessions ?? '—'}
          style={styles.statFlex}
        />
        <StatCard
          label="Focus Time"
          value={stats ? formatDuration(stats.totalMinutes) : '—'}
          style={styles.statFlex}
          accent="#e94560"
        />
        <StatCard
          label="Streak"
          value={user ? `${user.streak}🔥` : '—'}
          style={styles.statFlex}
          accent="#f5a623"
        />
      </View>

      {/* Active Timer Banner */}
      {timerActive && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() => navigation.navigate('Timer')}
          activeOpacity={0.85}
        >
          <Text style={styles.activeDot}>●</Text>
          <Text style={styles.activeBannerText}>Session in progress — tap to open</Text>
          <Text style={styles.activeBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* Achievements */}
      <Text style={styles.sectionTitle}>Achievements ({badges.length})</Text>
      {badges.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>Complete your first session to unlock badges!</Text>
        </View>
      ) : (
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeItem}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={styles.badgeName}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 40 },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  greeting: { color: '#8a8a9a', fontSize: 14 },
  username: { color: '#fff', fontSize: 22, fontWeight: '700', marginTop: 2 },
  levelBadge: {
    backgroundColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
  },
  levelText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  xpCard: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 24,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  xpLabel: { color: '#8a8a9a', fontSize: 13 },
  xpVal: { color: '#00d2ff', fontSize: 13, fontWeight: '600' },
  xpTrack: {
    height: 6,
    backgroundColor: '#0f3460',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: '#00d2ff',
    borderRadius: 3,
  },
  xpSub: { color: '#8a8a9a', fontSize: 11, marginTop: 6 },

  sectionTitle: {
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 24 },
  statFlex: { flex: 1 },

  activeBanner: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderLeftWidth: 3,
    borderLeftColor: '#00d2ff',
  },
  activeDot: { color: '#00d2ff', fontSize: 12, marginRight: 10 },
  activeBannerText: { flex: 1, color: '#fff', fontSize: 14 },
  activeBannerArrow: { color: '#00d2ff', fontSize: 22, marginLeft: 8 },

  emptyCard: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 12,
  },
  emptyText: { color: '#8a8a9a', fontSize: 14, textAlign: 'center', lineHeight: 20 },

  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  badgeItem: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: 80,
  },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeName: { color: '#8a8a9a', fontSize: 10, textAlign: 'center', letterSpacing: 0.5 },
});
