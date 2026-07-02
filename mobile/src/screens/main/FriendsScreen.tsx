import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { friendsService } from '../../services';
import { FramedAvatar } from '../../components';
import { getPetEmoji } from '../../constants';
import { useSocketStore } from '../../stores';
import type { FriendEntry, FriendRequest, UserSearchResult } from '../../types';

const STATUS_COLOR: Record<string, string> = {
  studying: '#00d2ff',
  break: '#f5a623',
  offline: '#3a3a5a',
  online: '#4caf50',
};

const STATUS_ICON: Record<string, string> = {
  studying: '📖',
  break: '☕',
  offline: '💤',
  online: '✅',
};

type Tab = 'friends' | 'requests' | 'search';

export function FriendsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const friendStatuses = useSocketStore((s) => s.friendStatuses);

  const [tab, setTab] = useState<Tab>('friends');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);

  const friendsQ = useQuery({
    queryKey: ['friends'],
    queryFn: () => friendsService.list(),
  });

  const requestsQ = useQuery({
    queryKey: ['friend-requests'],
    queryFn: () => friendsService.listRequests(),
  });

  const pendingCount = requestsQ.data?.filter((r) => r.status === 'pending' && r.direction === 'incoming').length ?? 0;

  const sendMut = useMutation({
    mutationFn: (userId: string) => friendsService.sendRequest(userId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
      Alert.alert(t('friends.requestSentTitle'), t('friends.requestSent'));
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message ?? t('friends.sendFailed')),
  });

  const acceptMut = useMutation({
    mutationFn: (friendshipId: string) => friendsService.acceptRequest(friendshipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message),
  });

  const declineMut = useMutation({
    mutationFn: (friendshipId: string) => friendsService.declineRequest(friendshipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
    onError: (err: any) => Alert.alert(t('common.error'), err?.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => friendsService.remove(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
    onError: (err: any) => Alert.alert(t('common.error'), err?.message),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await friendsService.search(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('friends.searchFailed'));
    } finally {
      setSearching(false);
    }
  };

  const renderFriend = ({ item }: { item: FriendEntry }) => {
    const status = friendStatuses[item.friendId] ?? item.status ?? 'offline';
    return (
      <View style={styles.row}>
        {item.frame ? (
          // Frame trumps the status border — status stays visible in the text line
          <FramedAvatar username={item.username} avatarUrl={item.avatarUrl} frameId={item.frame} size={40} />
        ) : (
          <View style={[styles.avatarCircle, { borderColor: STATUS_COLOR[status] ?? '#3a3a5a' }]}>
            <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>
            {item.username}
            {getPetEmoji(item.pet) ? ` ${getPetEmoji(item.pet)}` : ''}
          </Text>
          <Text style={[styles.rowStatus, { color: STATUS_COLOR[status] ?? '#3a3a5a' }]}>
            {STATUS_ICON[status] ?? '💤'} {t(`status.${status}`, { defaultValue: status })}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              t('friends.removeFriend'),
              t('friends.removeFriendMsg', { name: item.username }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                { text: t('friends.remove'), style: 'destructive', onPress: () => removeMut.mutate(item.friendId) },
              ],
            )
          }
          hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
        >
          <Text style={styles.removeIcon}>✕</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const renderRequest = ({ item }: { item: FriendRequest }) => {
    const isIncoming = item.direction === 'incoming';
    return (
      <View style={styles.row}>
        <View style={styles.avatarCircle}>
          <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{item.username}</Text>
          <Text style={styles.rowSub}>
            {isIncoming ? t('friends.incoming') : t('friends.sent')}
          </Text>
        </View>
        {isIncoming && (
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => acceptMut.mutate(item.userId)}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => declineMut.mutate(item.userId)}
              activeOpacity={0.8}
            >
              <Text style={styles.declineBtnText}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderSearchResult = ({ item }: { item: UserSearchResult }) => (
    <View style={styles.row}>
      <View style={styles.avatarCircle}>
        <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
      </View>
      <View style={styles.rowInfo}>
        <Text style={styles.rowName}>{item.username}</Text>
        <Text style={styles.rowSub}>{t('home.level', { level: item.level })}</Text>
      </View>
      {item.relationship === 'none' && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => sendMut.mutate(item.id)}
          disabled={sendMut.isPending}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>{t('friends.add')}</Text>
        </TouchableOpacity>
      )}
      {item.relationship === 'friends' && (
        <Text style={styles.friendTag}>{t('friends.friendsTag')}</Text>
      )}
      {(item.relationship === 'pending_sent' || item.relationship === 'pending_received') && (
        <Text style={styles.pendingTag}>{t('friends.pending')}</Text>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['friends', 'requests', 'search'] as Tab[]).map((tb) => (
          <TouchableOpacity
            key={tb}
            style={[styles.tab, tab === tb && styles.tabActive]}
            onPress={() => setTab(tb)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === tb && styles.tabTextActive]}>
              {tb === 'friends'
                ? t('friends.friends')
                : tb === 'requests'
                  ? `${t('friends.requests')}${pendingCount > 0 ? ` (${pendingCount})` : ''}`
                  : t('friends.search')}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {tab === 'friends' && (
        <FlatList
          data={friendsQ.data ?? []}
          keyExtractor={(f) => f.friendId}
          renderItem={renderFriend}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !friendsQ.isLoading
              ? <View style={styles.empty}><Text style={styles.emptyText}>{t('friends.noFriends')}</Text></View>
              : null
          }
          refreshControl={
            <RefreshControl refreshing={friendsQ.isFetching} onRefresh={() => friendsQ.refetch()} tintColor="#00d2ff" />
          }
        />
      )}

      {tab === 'requests' && (
        <FlatList
          data={requestsQ.data ?? []}
          keyExtractor={(r) => `${r.direction}-${r.userId}`}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !requestsQ.isLoading
              ? <View style={styles.empty}><Text style={styles.emptyText}>{t('friends.noRequests')}</Text></View>
              : null
          }
          refreshControl={
            <RefreshControl refreshing={requestsQ.isFetching} onRefresh={() => requestsQ.refetch()} tintColor="#00d2ff" />
          }
        />
      )}

      {tab === 'search' && (
        <View style={styles.searchArea}>
          <View style={styles.searchRow}>
            <TextInput
              style={styles.searchInput}
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder={t('friends.searchPlaceholder')}
              placeholderTextColor="#4a4a6a"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>{t('friends.go')}</Text>}
            </TouchableOpacity>
          </View>
          <FlatList
            data={searchResults}
            keyExtractor={(r) => r.id}
            renderItem={renderSearchResult}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              searchQuery && !searching
                ? <View style={styles.empty}><Text style={styles.emptyText}>{t('friends.noUsers')}</Text></View>
                : null
            }
          />
        </View>
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

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: CARD2,
    borderRadius: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  tabActive: { backgroundColor: `${PINK}1f`, borderColor: PINK },
  tabText: { color: MUTED, fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: PINK },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: MUTED, fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
    gap: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: `${ACCENT}18`,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: BORDER,
  },
  avatarLetter: { color: ACCENT, fontSize: 16, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowName: { color: TEXT, fontSize: 15, fontWeight: '600' },
  rowStatus: { fontSize: 12, marginTop: 2 },
  rowSub: { color: MUTED, fontSize: 12, marginTop: 2 },
  removeIcon: { color: MUTED, fontSize: 16 },

  reqActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: ACCENT,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { color: '#000', fontWeight: '800', fontSize: 14 },
  declineBtn: {
    backgroundColor: CARD2,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  declineBtnText: { color: MUTED, fontWeight: '700', fontSize: 14 },

  addBtn: {
    backgroundColor: PINK,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  friendTag: { color: ACCENT, fontSize: 12, fontWeight: '600' },
  pendingTag: { color: '#f5a623', fontSize: 12, fontWeight: '600' },

  searchArea: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: TEXT,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchBtn: {
    backgroundColor: PINK,
    borderRadius: 12,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
