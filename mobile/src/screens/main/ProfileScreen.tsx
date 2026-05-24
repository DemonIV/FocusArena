import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '../../hooks';
import { StatCard } from '../../components';
import { timerService, achievementsService } from '../../services';
import { formatDuration } from '../../utils/formatTime';

export function ProfileScreen() {
  const { user, logout } = useAuth();

  const statsQ = useQuery({
    queryKey: ['timer-stats'],
    queryFn: () => timerService.getStats(),
  });

  const achievQ = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsService.mine(),
  });

  const stats = statsQ.data;
  const earned = achievQ.data?.earned ?? [];
  const locked = achievQ.data?.locked ?? [];

  const levelProgress = user ? (user.xp % 500) / 500 : 0;
  const xpToNext = user ? (500 - (user.xp % 500)) : 500;

  const handleLogout = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: () => logout() },
      ],
    );
  };

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
      {/* Avatar + Name */}
      <View style={styles.profileCard}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>
            {user?.username.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <Text style={styles.username}>{user?.username ?? '—'}</Text>
        <Text style={styles.email}>{user?.email ?? ''}</Text>

        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>Level {user?.level ?? 1}</Text>
        </View>
      </View>

      {/* XP Bar */}
      <View style={styles.xpSection}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>{user?.xp ?? 0} XP</Text>
          <Text style={styles.xpLabel}>{xpToNext} to Lv {(user?.level ?? 1) + 1}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${levelProgress * 100}%` }]} />
        </View>
      </View>

      {/* Stats Grid */}
      <Text style={styles.sectionTitle}>All-Time Stats</Text>
      <View style={styles.statsGrid}>
        <StatCard
          label="Sessions"
          value={stats?.totalSessions ?? '—'}
          style={styles.statCell}
        />
        <StatCard
          label="Focus Time"
          value={stats ? formatDuration(stats.totalMinutes) : '—'}
          style={styles.statCell}
          accent="#e94560"
        />
        <StatCard
          label="Streak"
          value={user ? `${user.streak}🔥` : '—'}
          style={styles.statCell}
          accent="#f5a623"
        />
        <StatCard
          label="Avg / Day"
          value={stats ? formatDuration(Math.round(stats.averageSessionMinutes)) : '—'}
          style={styles.statCell}
          accent="#9c27b0"
        />
      </View>

      {/* Achievements */}
      <Text style={styles.sectionTitle}>
        Badges {earned.length}/{earned.length + locked.length}
      </Text>

      {earned.length > 0 && (
        <View style={styles.badgesRow}>
          {earned.map((b) => (
            <View key={b.id} style={styles.badge}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={styles.badgeLabel}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}

      {locked.length > 0 && (
        <>
          <Text style={styles.lockedTitle}>Locked</Text>
          <View style={styles.badgesRow}>
            {locked.map((b) => (
              <View key={b.badge_type} style={[styles.badge, styles.badgeLocked]}>
                <Text style={[styles.badgeIcon, styles.badgeIconLocked]}>🔒</Text>
                <Text style={[styles.badgeLabel, styles.badgeLabelLocked]}>{b.label}</Text>
                <Text style={styles.badgeDesc}>{b.description}</Text>
              </View>
            ))}
          </View>
        </>
      )}

      {/* Sign Out */}
      <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Text style={styles.logoutBtnText}>Sign Out</Text>
      </TouchableOpacity>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },
  content: { paddingHorizontal: 20, paddingTop: 24, paddingBottom: 48 },

  profileCard: {
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
  },
  avatarCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#00d2ff',
    marginBottom: 12,
  },
  avatarLetter: { color: '#00d2ff', fontSize: 28, fontWeight: '700' },
  username: { color: '#fff', fontSize: 22, fontWeight: '700' },
  email: { color: '#8a8a9a', fontSize: 13, marginTop: 4, marginBottom: 12 },
  levelBadge: {
    backgroundColor: '#e94560',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 6,
  },
  levelText: { color: '#fff', fontWeight: '700', fontSize: 13 },

  xpSection: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 16,
    marginBottom: 24,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 10 },
  xpLabel: { color: '#8a8a9a', fontSize: 12 },
  xpTrack: {
    height: 6,
    backgroundColor: '#0f3460',
    borderRadius: 3,
    overflow: 'hidden',
  },
  xpFill: { height: '100%', backgroundColor: '#00d2ff', borderRadius: 3 },

  sectionTitle: {
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  statCell: { width: '47%' },

  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    width: 90,
  },
  badgeLocked: { opacity: 0.45 },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeIconLocked: { opacity: 0.5 },
  badgeLabel: {
    color: '#ffffff',
    fontSize: 10,
    textAlign: 'center',
    fontWeight: '600',
  },
  badgeLabelLocked: { color: '#8a8a9a' },
  badgeDesc: { color: '#4a4a6a', fontSize: 9, textAlign: 'center', marginTop: 2 },

  lockedTitle: {
    color: '#4a4a6a',
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2,
    marginBottom: 10,
  },

  logoutBtn: {
    marginTop: 16,
    backgroundColor: '#2a1020',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e94560',
  },
  logoutBtnText: { color: '#e94560', fontSize: 15, fontWeight: '700' },
});
