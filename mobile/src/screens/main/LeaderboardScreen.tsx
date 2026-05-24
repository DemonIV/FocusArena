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
import { leaderboardService } from '../../services';
import { useSocketStore } from '../../stores';
import type { LeaderboardPeriod, LeaderboardEntry } from '../../types';

const PERIODS: { key: LeaderboardPeriod; label: string }[] = [
  { key: 'daily', label: 'Today' },
  { key: 'weekly', label: 'Week' },
  { key: 'monthly', label: 'Month' },
  { key: 'alltime', label: 'All Time' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function RankRow({ entry }: { entry: LeaderboardEntry }) {
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
          {entry.isMe ? ' (you)' : ''}
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
              {p.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* My rank card */}
      {meQ.data && (
        <View style={styles.myRankCard}>
          <Text style={styles.myRankLabel}>Your Global Rank</Text>
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
            <Text style={styles.sectionLabel}>Global Top 10</Text>
          }
          ListFooterComponent={
            friendsQ.data && friendsQ.data.length > 0 ? (
              <>
                <Text style={[styles.sectionLabel, { marginTop: 24 }]}>Friends</Text>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#16213e',
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#0f3460', borderBottomWidth: 2, borderBottomColor: '#00d2ff' },
  tabText: { color: '#8a8a9a', fontSize: 13, fontWeight: '600' },
  tabTextActive: { color: '#00d2ff' },

  myRankCard: {
    backgroundColor: '#0f3460',
    borderRadius: 12,
    marginHorizontal: 16,
    marginTop: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderLeftWidth: 3,
    borderLeftColor: '#e94560',
  },
  myRankLabel: { color: '#8a8a9a', fontSize: 12 },
  myRankVal: { fontSize: 24, color: '#fff', fontWeight: '700' },
  myRankScore: { color: '#00d2ff', fontSize: 13, fontWeight: '600' },

  sectionLabel: {
    color: '#8a8a9a',
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },

  list: { padding: 16, paddingBottom: 40 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
    gap: 12,
  },
  rowMe: {
    backgroundColor: '#0f3460',
    borderWidth: 1,
    borderColor: '#e94560',
  },

  rankCol: { width: 32, alignItems: 'center' },
  medal: { fontSize: 22 },
  rankNum: { color: '#8a8a9a', fontSize: 16, fontWeight: '700' },

  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: {
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: '#00d2ff', fontSize: 16, fontWeight: '700' },

  userInfo: { flex: 1 },
  username: { color: '#fff', fontSize: 15, fontWeight: '600' },
  usernameMe: { color: '#e94560' },
  score: { color: '#8a8a9a', fontSize: 12, marginTop: 2 },

  meDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#e94560',
  },
});
