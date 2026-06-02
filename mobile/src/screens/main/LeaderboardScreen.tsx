import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { leaderboardService } from '../../services';
import { useSocketStore } from '../../stores';
import type { LeaderboardPeriod, LeaderboardEntry } from '../../types';

const PERIODS: { key: LeaderboardPeriod; labelKey: string }[] = [
  { key: 'daily', labelKey: 'leaderboard.today' },
  { key: 'weekly', labelKey: 'leaderboard.week' },
  { key: 'monthly', labelKey: 'leaderboard.month' },
  { key: 'alltime', labelKey: 'leaderboard.allTime' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankRow({ entry }: { entry: LeaderboardEntry }) {
  const { t } = useTranslation();
  const medal = MEDAL[entry.rank];

  return (
    <View style={[styles.row, entry.isMe && styles.rowMe]}>
      <View style={styles.rankCol}>
        {medal
          ? <Text style={styles.medal}>{medal}</Text>
          : <Text style={styles.rankNum}>{entry.rank}</Text>
        }
      </View>

      {entry.avatarUrl
        ? <Image source={{ uri: entry.avatarUrl }} style={styles.avatar} />
        : (
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Text style={styles.avatarLetter}>
              {entry.username.charAt(0).toUpperCase()}
            </Text>
          </View>
        )
      }

      <View style={styles.userInfo}>
        <Text style={[styles.username, entry.isMe && styles.usernameMe]}>
          {entry.username}
          {entry.isMe ? t('leaderboard.you') : ''}
        </Text>
        <Text style={styles.score}>
          {entry.value.toLocaleString()} {entry.unit}
        </Text>
      </View>

      {entry.isMe && <View style={styles.meDot} />}
    </View>
  );
}

export function LeaderboardScreen() {
  const { t } = useTranslation();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const top10Live = useSocketStore((s) => s.top10);

  const globalQ = useQuery({
    queryKey: ['lb-global', period],
    queryFn: () => leaderboardService.getGlobal(period),
    staleTime: 60_000,
  });

  const friendsQ = useQuery({
    queryKey: ['lb-friends', period],
    queryFn: () => leaderboardService.getFriends(period),
    staleTime: 60_000,
  });

  const meQ = useQuery({
    queryKey: ['lb-me'],
    queryFn: () => leaderboardService.getMe(),
  });

  // Merge live socket updates (weekly only) with server data
  const globalData: LeaderboardEntry[] =
    period === 'weekly' && top10Live.length > 0
      ? top10Live
      : (globalQ.data ?? []);

  const isLoading = globalQ.isLoading;

  return (
    <View style={styles.root}>
      {/* Period tabs */}
      <View style={styles.tabRow}>
        {PERIODS.map((p) => (
          <TouchableOpacity
            key={p.key}
            style={[styles.tab, period === p.key && styles.tabActive]}
            onPress={() => setPeriod(p.key)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, period === p.key && styles.tabTextActive]}>
              {t(p.labelKey)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank card */}
      {meQ.data && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>{t('leaderboard.yourGlobalRank')}</Text>
          <Text style={styles.myRankVal}>
            {MEDAL[meQ.data.rank] ?? `#${meQ.data.rank}`}
          </Text>
          <Text style={styles.myRankScore}>
            {meQ.data.value.toLocaleString()} {meQ.data.unit}
          </Text>
        </View>
      )}

      {isLoading ? (
        <ActivityIndicator color="#00d2ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={globalData}
          keyExtractor={(item) => item.userId}
          renderItem={({ item }) => <RankRow entry={item} />}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={
            <Text style={styles.sectionLabel}>{t('leaderboard.globalTop10')}</Text>
          }
          ListFooterComponent={
            friendsQ.data && friendsQ.data.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('leaderboard.friends')}</Text>
                {friendsQ.data.map((entry) => (
                  <RankRow key={entry.userId} entry={entry} />
                ))}
              </>
            ) : null
          }
          refreshControl={
            <RefreshControl
              refreshing={globalQ.isFetching}
              onRefresh={() => { globalQ.refetch(); friendsQ.refetch(); }}
              tintColor="#00d2ff"
            />
          }
        />
      )}
    </View>
  );
}

const BG     = '#0d0d1a';
const CARD   = '#131325';
const CARD2  = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const PINK   = '#e94560';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const MUTED2 = '#94a3b8';

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: CARD2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: { backgroundColor: `${ACCENT}22`, borderColor: ACCENT },
  tabText: { color: MUTED, fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: ACCENT },

  myRankCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: PINK,
  },
  myRankLabel: { color: MUTED, fontSize: 12 },
  myRankVal: { fontSize: 24, color: TEXT, fontWeight: '800' },
  myRankScore: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  list: { padding: 16, paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 12,
    marginBottom: 8,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rowMe: {
    backgroundColor: `${PINK}14`,
    borderColor: PINK,
  },

  rankCol: { width: 32, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: MUTED, fontSize: 16, fontWeight: '700' },

  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    backgroundColor: `${ACCENT}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: ACCENT, fontSize: 16, fontWeight: '700' },

  userInfo: { flex: 1 },
  username: { color: TEXT, fontSize: 15, fontWeight: '600' },
  usernameMe: { color: PINK },
  score: { color: MUTED2, fontSize: 12, marginTop: 2 },

  meDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: PINK,
  },
});
