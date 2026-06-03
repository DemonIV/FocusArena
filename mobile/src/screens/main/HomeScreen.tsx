import React from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import type { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import type { MainTabParamList, FriendEntry } from '../../types';
import { useAuth } from '../../hooks';
import { useTimerStore, useSocketStore } from '../../stores';
import { StatCard } from '../../components';
import { timerService, achievementsService, friendsService } from '../../services';
import { formatDuration } from '../../utils/formatTime';

// ─── Palette ──────────────────────────────────────────────────────────────────

const BG     = '#0d0d1a';
const CARD   = '#131325';
const CARD2  = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const GREEN  = '#22c55e';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const MUTED2 = '#94a3b8';

const STATUS_COLOR: Record<string, string> = {
  studying: ACCENT,
  break: '#f5a623',
  offline: '#3a3a5a',
};
const STATUS_ICON: Record<string, string> = {
  studying: '📖',
  break: '☕',
  offline: '💤',
};

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
  const { user } = useAuth();
  const timerActive = useTimerStore((s) => s.isActive);
  const friendStatuses = useSocketStore((s) => s.friendStatuses);

  const statsQ = useQuery({
    queryKey: ['timer-stats'],
    queryFn: () => timerService.getStats(),
  });

  const achievQ = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsService.mine(),
  });

  const friendsQ = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsService.list(),
  });

  const stats = statsQ.data;
  const badges = achievQ.data?.earned ?? [];

  // Live values from stats.allTime (authStore `user` goes stale after earning XP)
  const at = stats?.allTime;
  const xp            = at?.xp ?? 0;
  const level         = at?.level ?? user?.level ?? 1;
  const streak        = at?.streak ?? 0;
  const xpToNextLevel = 500 - (xp % 500);
  const levelProgress = (xp % 500) / 500;

  // Daily goal progress
  const todayMin = stats?.today.totalMinutes ?? 0;
  const goalMin  = stats?.today.goalMinutes ?? 0;
  const goalPct  = goalMin > 0 ? Math.min(todayMin / goalMin, 1) : 0;
  const goalReached = goalMin > 0 && todayMin >= goalMin;

  // Friends: socket status overrides the (possibly stale) REST status
  const friends: FriendEntry[] = (friendsQ.data ?? [])
    .map((f) => ({ ...f, status: (friendStatuses[f.friendId] as FriendEntry['status']) ?? f.status }))
    .sort((a, b) => statusRank(a.status) - statusRank(b.status))
    .slice(0, 5);

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={statsQ.isFetching || achievQ.isFetching || friendsQ.isFetching}
          onRefresh={() => { statsQ.refetch(); achievQ.refetch(); friendsQ.refetch(); }}
          tintColor={ACCENT}
        />
      }
    >
      {/* ── Hero Header ── */}
      <View style={styles.header}>
        <View style={styles.avatarRing}>
          <Text style={styles.avatarLetter}>
            {user?.username?.charAt(0).toUpperCase() ?? '?'}
          </Text>
        </View>
        <View style={styles.headerInfo}>
          <Text style={styles.greeting}>{t('home.welcomeBack')}</Text>
          <Text style={styles.username} numberOfLines={1}>{user?.username ?? '—'}</Text>
        </View>
        <View style={styles.levelBadge}>
          <Text style={styles.levelText}>{t('home.level', { level })}</Text>
        </View>
      </View>

      {/* ── Active Timer Banner ── */}
      {timerActive && (
        <TouchableOpacity
          style={styles.activeBanner}
          onPress={() => navigation.navigate('Timer')}
          activeOpacity={0.85}
        >
          <Text style={styles.activeDot}>●</Text>
          <Text style={styles.activeBannerText}>{t('home.sessionInProgress')}</Text>
          <Text style={styles.activeBannerArrow}>›</Text>
        </TouchableOpacity>
      )}

      {/* ── Daily Goal ── */}
      <View style={styles.goalCard}>
        <View style={styles.goalHeader}>
          <Text style={styles.goalLabel}>{t('home.dailyGoal')}</Text>
          <Text style={[styles.goalPct, goalReached && { color: GREEN }]}>
            {Math.round(goalPct * 100)}%
          </Text>
        </View>
        <Text style={styles.goalValue}>
          {formatDuration(todayMin)} <Text style={styles.goalValueMuted}>/ {formatDuration(goalMin)}</Text>
        </Text>
        <View style={styles.goalTrack}>
          <View
            style={[
              styles.goalFill,
              { width: `${goalPct * 100}%`, backgroundColor: goalReached ? GREEN : ACCENT, shadowColor: goalReached ? GREEN : ACCENT },
            ]}
          />
        </View>
        {goalReached && <Text style={styles.goalReached}>{t('home.goalReached')}</Text>}
      </View>

      {/* ── Quick Stats ── */}
      <Text style={styles.sectionTitle}>{t('home.todaysStats')}</Text>
      <View style={styles.statsRow}>
        <StatCard
          label={t('home.sessions')}
          value={stats?.today.sessionsCount ?? '—'}
          style={styles.statFlex}
        />
        <StatCard
          label={t('home.focusTime')}
          value={stats ? formatDuration(stats.today.totalMinutes) : '—'}
          style={styles.statFlex}
          accent="#e94560"
        />
        <StatCard
          label={t('home.streak')}
          value={stats ? `${streak}🔥` : '—'}
          style={styles.statFlex}
          accent="#f5a623"
        />
      </View>

      {/* ── This Week ── */}
      <Text style={styles.sectionTitle}>{t('home.thisWeek')}</Text>
      <WeekChart
        breakdown={stats?.week.dailyBreakdown ?? []}
        totalLabel={t('home.weekTotal', { duration: formatDuration(stats?.week.totalMinutes ?? 0) })}
        weekdays={t('home.weekdaysShort')}
      />

      {/* ── XP Progress ── */}
      <View style={styles.xpCard}>
        <View style={styles.xpRow}>
          <Text style={styles.xpLabel}>{t('home.xpProgress')}</Text>
          <Text style={styles.xpVal}>{t('home.xpValue', { xp: xp.toLocaleString() })}</Text>
        </View>
        <View style={styles.xpTrack}>
          <View style={[styles.xpFill, { width: `${levelProgress * 100}%` }]} />
        </View>
        <View style={styles.xpFooter}>
          <Text style={styles.xpSub}>{t('home.xpToLevel', { xp: xpToNextLevel, level: level + 1 })}</Text>
          {streak > 0 && <Text style={styles.streakChip}>🔥 {streak}</Text>}
        </View>
      </View>

      {/* ── Friends (live) ── */}
      <View style={styles.sectionRow}>
        <Text style={styles.sectionTitle}>{t('home.friendsLive')}</Text>
        <TouchableOpacity onPress={() => navigation.navigate('Friends')} activeOpacity={0.7}>
          <Text style={styles.seeAll}>›</Text>
        </TouchableOpacity>
      </View>
      {friends.length === 0 ? (
        <TouchableOpacity
          style={styles.emptyCard}
          onPress={() => navigation.navigate('Friends')}
          activeOpacity={0.8}
        >
          <Text style={styles.emptyIcon}>👥</Text>
          <Text style={styles.emptyText}>{t('home.noFriendsHome')}</Text>
        </TouchableOpacity>
      ) : (
        <View style={styles.friendsCard}>
          {friends.map((f) => (
            <View key={f.friendId} style={styles.friendRow}>
              <View style={[styles.friendDot, { backgroundColor: STATUS_COLOR[f.status] ?? MUTED }]} />
              <Text style={styles.friendName} numberOfLines={1}>{f.username}</Text>
              <Text style={styles.friendStatus}>
                {STATUS_ICON[f.status] ?? ''} {t(`home.status${cap(f.status)}`)}
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* ── Achievements ── */}
      <Text style={styles.sectionTitle}>{t('home.achievements', { count: badges.length })}</Text>
      {badges.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyIcon}>🏆</Text>
          <Text style={styles.emptyText}>{t('home.noBadges')}</Text>
        </View>
      ) : (
        <View style={styles.badgesGrid}>
          {badges.map((b) => (
            <View key={b.id} style={styles.badgeItem}>
              <Text style={styles.badgeIcon}>{b.icon}</Text>
              <Text style={styles.badgeName} numberOfLines={2}>{b.label}</Text>
            </View>
          ))}
        </View>
      )}
    </ScrollView>
  );
}

// ─── Week mini bar chart ───────────────────────────────────────────────────────

function WeekChart({
  breakdown,
  totalLabel,
  weekdays,
}: {
  breakdown: { date: string; totalMinutes: number }[];
  totalLabel: string;
  weekdays: string;
}) {
  const labels = weekdays.split(',');
  const today = new Date().toISOString().slice(0, 10);
  const max = Math.max(1, ...breakdown.map((d) => d.totalMinutes));

  return (
    <View style={styles.weekCard}>
      <View style={styles.weekBars}>
        {breakdown.map((d, i) => {
          const h = Math.max(0.06, d.totalMinutes / max);
          const isToday = d.date === today;
          return (
            <View key={d.date} style={styles.weekCol}>
              <View style={styles.weekBarTrack}>
                <View
                  style={[
                    styles.weekBar,
                    {
                      height: `${h * 100}%`,
                      backgroundColor: d.totalMinutes > 0 ? (isToday ? ACCENT : `${ACCENT}80`) : 'rgba(255,255,255,0.06)',
                    },
                  ]}
                />
              </View>
              <Text style={[styles.weekDay, isToday && { color: ACCENT, fontWeight: '800' }]}>
                {labels[i] ?? ''}
              </Text>
            </View>
          );
        })}
      </View>
      <Text style={styles.weekTotal}>{totalLabel}</Text>
    </View>
  );
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function statusRank(s: string): number {
  return s === 'studying' ? 0 : s === 'break' ? 1 : 2;
}
function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 40,
  },

  // Hero header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 20,
    gap: 14,
  },
  avatarRing: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: `${ACCENT}22`,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: ACCENT, fontSize: 22, fontWeight: '800' },
  headerInfo: { flex: 1 },
  greeting: { color: MUTED, fontSize: 13 },
  username: { color: TEXT, fontSize: 22, fontWeight: '700', marginTop: 2 },
  levelBadge: {
    backgroundColor: `${ACCENT}22`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${ACCENT}50`,
  },
  levelText: { color: ACCENT, fontWeight: '700', fontSize: 13 },

  // Daily goal card
  goalCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  goalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  goalLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  goalPct: { color: ACCENT, fontSize: 18, fontWeight: '800' },
  goalValue: { color: TEXT, fontSize: 20, fontWeight: '800', marginBottom: 12 },
  goalValueMuted: { color: MUTED, fontSize: 15, fontWeight: '600' },
  goalTrack: {
    height: 10,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 5,
    overflow: 'hidden',
  },
  goalFill: {
    height: '100%',
    borderRadius: 5,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 6,
  },
  goalReached: { color: GREEN, fontSize: 13, fontWeight: '700', marginTop: 10 },

  // XP card
  xpCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  xpRow: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12, alignItems: 'center' },
  xpLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  xpVal: { color: ACCENT, fontSize: 15, fontWeight: '800' },
  xpTrack: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  xpFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 4,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  xpFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 10,
  },
  xpSub: { color: MUTED2, fontSize: 12 },
  streakChip: { color: '#f5a623', fontSize: 13, fontWeight: '700' },

  // Section title
  sectionTitle: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  seeAll: { color: ACCENT, fontSize: 22, fontWeight: '300', paddingHorizontal: 6, marginBottom: 12 },
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statFlex: { flex: 1 },

  // Week chart
  weekCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 18,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  weekBars: { flexDirection: 'row', height: 90, alignItems: 'flex-end' },
  weekCol: { flex: 1, alignItems: 'center' },
  weekBarTrack: {
    width: 14,
    flex: 1,
    justifyContent: 'flex-end',
    borderRadius: 7,
    overflow: 'hidden',
  },
  weekBar: { width: '100%', borderRadius: 7, minHeight: 4 },
  weekDay: { color: MUTED, fontSize: 10, fontWeight: '600', marginTop: 8 },
  weekTotal: { color: MUTED2, fontSize: 12, fontWeight: '600', marginTop: 14, textAlign: 'center' },

  // Friends card
  friendsCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    paddingHorizontal: 16,
    paddingVertical: 6,
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  friendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 12,
  },
  friendDot: { width: 9, height: 9, borderRadius: 5 },
  friendName: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '600' },
  friendStatus: { color: MUTED2, fontSize: 12 },

  // Active banner
  activeBanner: {
    backgroundColor: `${ACCENT}14`,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  activeDot: { color: ACCENT, fontSize: 12, marginRight: 10 },
  activeBannerText: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '500' },
  activeBannerArrow: { color: ACCENT, fontSize: 22, marginLeft: 8 },

  // Empty card
  emptyCard: {
    backgroundColor: CARD2,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 20 },

  // Badges grid
  badgesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 12,
  },
  badgeItem: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    width: 86,
    borderWidth: 1,
    borderColor: BORDER,
  },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeName: { color: MUTED2, fontSize: 10, textAlign: 'center', letterSpacing: 0.3, fontWeight: '600' },
});
