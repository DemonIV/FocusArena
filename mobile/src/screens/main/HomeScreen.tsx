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
import type { MainTabParamList } from '../../types';
import { useAuth } from '../../hooks';
import { useTimerStore } from '../../stores';
import { StatCard } from '../../components';
import { timerService, achievementsService } from '../../services';
import { formatDuration } from '../../utils/formatTime';

// ─── Palette ──────────────────────────────────────────────────────────────────

const BG     = '#0d0d1a';
const CARD   = '#131325';
const CARD2  = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const MUTED2 = '#94a3b8';

type Props = BottomTabScreenProps<MainTabParamList, 'Home'>;

export function HomeScreen({ navigation }: Props) {
  const { t } = useTranslation();
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

  // Live values from stats.allTime (authStore `user` goes stale after earning XP)
  const at = stats?.allTime;
  const xp            = at?.xp ?? 0;
  const level         = at?.level ?? user?.level ?? 1;
  const streak        = at?.streak ?? 0;
  const xpToNextLevel = 500 - (xp % 500);
  const levelProgress = (xp % 500) / 500;

  return (
    <ScrollView
      style={styles.root}
      contentContainerStyle={styles.content}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={statsQ.isFetching || achievQ.isFetching}
          onRefresh={() => { statsQ.refetch(); achievQ.refetch(); }}
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
          {streak > 0 && (
            <Text style={styles.streakChip}>🔥 {streak}</Text>
          )}
        </View>
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
    marginBottom: 24,
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
  statsRow: { flexDirection: 'row', gap: 10, marginBottom: 28 },
  statFlex: { flex: 1 },

  // Active banner
  activeBanner: {
    backgroundColor: `${ACCENT}14`,
    borderRadius: 14,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 28,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  activeDot: { color: ACCENT, fontSize: 12, marginRight: 10 },
  activeBannerText: { flex: 1, color: TEXT, fontSize: 14, fontWeight: '500' },
  activeBannerArrow: { color: ACCENT, fontSize: 22, marginLeft: 8 },

  // Empty achievements
  emptyCard: {
    backgroundColor: CARD2,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 12,
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
