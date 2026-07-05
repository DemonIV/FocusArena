import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { leaderboardService } from '../../services';
import { FramedAvatar } from '../../components';
import { getPetEmoji } from '../../constants';
import { useSocketStore } from '../../stores';
import { useInviteShare } from '../../hooks';
import { formatDuration } from '../../utils/formatTime';
import i18n from '../../i18n';
import type { LeaderboardPeriod, LeaderboardEntry, MyRankInfo, CountryEntry } from '../../types';

const PERIODS: { key: LeaderboardPeriod; labelKey: string }[] = [
  { key: 'daily', labelKey: 'leaderboard.today' },
  { key: 'weekly', labelKey: 'leaderboard.week' },
  { key: 'monthly', labelKey: 'leaderboard.month' },
  { key: 'alltime', labelKey: 'leaderboard.allTime' },
];

const MEDAL: Record<number, string> = { 1: '🥇', 2: '🥈', 3: '🥉' };

function unitLabel(unit: string, t: (k: string) => string): string {
  return unit === 'min' ? t('common.minShort') : unit;
}

/** ISO 3166-1 alpha-2 → flag emoji (regional indicator symbols). */
function flagEmoji(iso: string): string {
  const cc = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(cc)) return '🏳️';
  return String.fromCodePoint(...[...cc].map((c) => 0x1f1e6 + c.charCodeAt(0) - 65));
}

/** Localized country name, falling back to the ISO code on unsupported engines. */
function countryName(iso: string): string {
  try {
    const dn = new Intl.DisplayNames([i18n.language], { type: 'region' });
    return dn.of(iso.toUpperCase()) ?? iso.toUpperCase();
  } catch {
    return iso.toUpperCase();
  }
}

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

      <FramedAvatar
        username={entry.username}
        avatarUrl={entry.avatarUrl}
        frameId={entry.frame}
        size={40}
      />

      <View style={styles.userInfo}>
        <Text style={[styles.username, entry.isMe && styles.usernameMe]}>
          {entry.username}
          {getPetEmoji(entry.pet) ? ` ${getPetEmoji(entry.pet)}` : ''}
          {entry.isMe ? t('leaderboard.you') : ''}
        </Text>
        <Text style={styles.score}>
          {entry.value.toLocaleString()} {unitLabel(entry.unit, t)}
        </Text>
      </View>

      {entry.isMe && <View style={styles.meDot} />}
    </View>
  );
}

/** Caller's own rank card + local context window (shown atop the list) */
function MyRankHeader({ info }: { info: MyRankInfo }) {
  const { t } = useTranslation();
  const unit = unitLabel(info.unit, t);
  const rank = info.rank as number; // non-null whenever info exists
  const showWindow = rank > 10 && info.neighbors.length > 0;

  return (
    <View style={styles.myRankBlock}>
      <View style={styles.myRankCard}>
        <View style={{ flex: 1 }}>
          <Text style={styles.myRankLabel}>{t('leaderboard.yourGlobalRank')}</Text>
          {rank === 1 ? (
            <Text style={styles.myRankHint}>{t('leaderboard.atTop')}</Text>
          ) : info.pointsToNextRank != null && info.nextRank != null ? (
            <Text style={styles.myRankHint}>
              {t('leaderboard.reachNext', {
                rank: info.nextRank,
                points: info.pointsToNextRank.toLocaleString(),
                unit,
              })}
            </Text>
          ) : info.ahead != null && info.ahead > 0 ? (
            <Text style={styles.myRankHint}>
              {t('leaderboard.peopleAhead', { count: info.ahead })}
            </Text>
          ) : null}
        </View>
        <View style={{ alignItems: 'flex-end' }}>
          <Text style={styles.myRankVal}>{MEDAL[rank] ?? `#${rank}`}</Text>
          <Text style={styles.myRankScore}>
            {info.score.toLocaleString()} {unit}
          </Text>
        </View>
      </View>

      {showWindow && (
        <View style={styles.windowWrap}>
          <Text style={styles.sectionLabel}>{t('leaderboard.yourPosition')}</Text>
          {info.neighbors.map((n) => (
            <RankRow key={n.userId} entry={n} />
          ))}
          {info.ahead != null && info.ahead > 0 && (
            <Text style={styles.windowCaption}>
              {t('leaderboard.peopleAhead', { count: info.ahead })}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

function CountryRow({ entry, isMine }: { entry: CountryEntry; isMine: boolean }) {
  const medal = MEDAL[entry.rank];
  return (
    <View style={[styles.row, isMine && styles.rowMe]}>
      <View style={styles.rankCol}>
        {medal ? <Text style={styles.medal}>{medal}</Text> : <Text style={styles.rankNum}>{entry.rank}</Text>}
      </View>
      <Text style={styles.flag}>{flagEmoji(entry.country)}</Text>
      <View style={styles.userInfo}>
        <Text style={styles.username} numberOfLines={1}>{countryName(entry.country)}</Text>
        <Text style={styles.score}>{formatDuration(entry.totalMinutes)}</Text>
      </View>
      {isMine && <View style={styles.meDot} />}
    </View>
  );
}

export function LeaderboardScreen() {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'players' | 'countries'>('players');
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const top10Live = useSocketStore((s) => s.top10);
  const shareInvite = useInviteShare('leaderboard');

  const countriesQ = useQuery({
    queryKey: ['lb-countries'],
    queryFn: () => leaderboardService.getCountries(),
    staleTime: 60_000,
    enabled: mode === 'countries',
  });

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
    queryKey: ['lb-me', period],
    queryFn: () => leaderboardService.getMe(period),
  });

  // Merge live socket updates (weekly only) with server data
  const globalData: LeaderboardEntry[] =
    period === 'weekly' && top10Live.length > 0
      ? top10Live
      : (globalQ.data ?? []);

  const isLoading = globalQ.isLoading;

  return (
    <View style={styles.root}>
      {/* Mode toggle: Players ↔ Countries */}
      <View style={styles.modeRow}>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'players' && styles.modeTabActive]}
          onPress={() => setMode('players')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeText, mode === 'players' && styles.modeTextActive]}>
            🏆 {t('leaderboard.players')}
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, mode === 'countries' && styles.modeTabActive]}
          onPress={() => setMode('countries')}
          activeOpacity={0.7}
        >
          <Text style={[styles.modeText, mode === 'countries' && styles.modeTextActive]}>
            🌍 {t('leaderboard.countries')}
          </Text>
        </TouchableOpacity>
      </View>

      {mode === 'players' ? (
        <>
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
                <>
                  {meQ.data && <MyRankHeader info={meQ.data} />}
                  <Text style={styles.sectionLabel}>{t('leaderboard.globalTop10')}</Text>
                </>
              }
              ListFooterComponent={
                friendsQ.data && friendsQ.data.length > 0 ? (
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('leaderboard.friends')}</Text>
                    {friendsQ.data.map((entry) => (
                      <RankRow key={entry.userId} entry={entry} />
                    ))}
                  </>
                ) : friendsQ.data ? (
                  // No friends yet → invite CTA instead of a silently missing section
                  <>
                    <Text style={[styles.sectionLabel, { marginTop: 24 }]}>{t('leaderboard.friends')}</Text>
                    <View style={styles.inviteFooter}>
                      <Text style={styles.inviteFooterText}>{t('invite.leaderboardEmpty')}</Text>
                      <TouchableOpacity style={styles.inviteFooterBtn} onPress={shareInvite} activeOpacity={0.85}>
                        <Text style={styles.inviteFooterBtnText}>{t('invite.inviteButton')}</Text>
                      </TouchableOpacity>
                    </View>
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
        </>
      ) : (
        countriesQ.isLoading ? (
          <ActivityIndicator color="#00d2ff" style={{ marginTop: 40 }} />
        ) : (
          <FlatList
            data={countriesQ.data?.entries ?? []}
            keyExtractor={(c) => c.country}
            renderItem={({ item }) => (
              <CountryRow entry={item} isMine={item.country === countriesQ.data?.myCountry} />
            )}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={
              <>
                {countriesQ.data?.myCountry && (
                  <View style={styles.myCountryCard}>
                    <Text style={styles.myCountryFlag}>{flagEmoji(countriesQ.data.myCountry)}</Text>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.myRankLabel}>{t('leaderboard.yourCountry')}</Text>
                      <Text style={styles.myRankHint}>
                        {t('leaderboard.countryContribution', {
                          duration: formatDuration(countriesQ.data.myContribution),
                        })}
                      </Text>
                    </View>
                    {countriesQ.data.myCountryRank != null && (
                      <Text style={styles.myRankVal}>
                        {MEDAL[countriesQ.data.myCountryRank] ?? `#${countriesQ.data.myCountryRank}`}
                      </Text>
                    )}
                  </View>
                )}
                <Text style={styles.sectionLabel}>{t('leaderboard.countryWars')}</Text>
              </>
            }
            ListEmptyComponent={
              <Text style={styles.emptyCountries}>{t('leaderboard.noCountryData')}</Text>
            }
            refreshControl={
              <RefreshControl
                refreshing={countriesQ.isFetching}
                onRefresh={() => countriesQ.refetch()}
                tintColor="#00d2ff"
              />
            }
          />
        )
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

  modeRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 16,
    gap: 8,
  },
  modeTab: {
    flex: 1,
    paddingVertical: 12,
    backgroundColor: CARD,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  modeTabActive: { backgroundColor: `${ACCENT}22`, borderColor: ACCENT },
  modeText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  modeTextActive: { color: ACCENT },

  tabRow: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingTop: 12,
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

  myRankBlock: { marginBottom: 16 },
  myRankCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: PINK,
  },
  myRankLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
  },
  myRankHint: { color: MUTED2, fontSize: 13, fontWeight: '600', marginTop: 4, lineHeight: 18 },
  myRankVal: { fontSize: 24, color: TEXT, fontWeight: '800' },
  myRankScore: { color: ACCENT, fontSize: 13, fontWeight: '700', marginTop: 2 },

  windowWrap: { marginTop: 16 },
  windowCaption: {
    color: MUTED2,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },

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

  inviteFooter: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
  },
  inviteFooterText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  inviteFooterBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingVertical: 10,
    paddingHorizontal: 20,
    marginTop: 12,
  },
  inviteFooterBtnText: { color: '#001018', fontSize: 13, fontWeight: '800' },

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

  // Country Wars
  flag: { fontSize: 28, width: 40, textAlign: 'center' },
  myCountryCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: BORDER,
    borderLeftWidth: 3,
    borderLeftColor: ACCENT,
  },
  myCountryFlag: { fontSize: 34 },
  emptyCountries: { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 40, paddingHorizontal: 32 },
});
