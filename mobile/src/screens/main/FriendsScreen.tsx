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
import { friendsService } from '../../services';
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
      Alert.alert('Sent!', 'Friend request sent.');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not send request'),
  });

  const acceptMut = useMutation({
    mutationFn: (friendshipId: string) => friendsService.acceptRequest(friendshipId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['friends'] });
      qc.invalidateQueries({ queryKey: ['friend-requests'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message),
  });

  const declineMut = useMutation({
    mutationFn: (friendshipId: string) => friendsService.declineRequest(friendshipId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friend-requests'] }),
    onError: (err: any) => Alert.alert('Error', err?.message),
  });

  const removeMut = useMutation({
    mutationFn: (userId: string) => friendsService.remove(userId),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['friends'] }),
    onError: (err: any) => Alert.alert('Error', err?.message),
  });

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const results = await friendsService.search(searchQuery.trim());
      setSearchResults(results);
    } catch (err: any) {
      Alert.alert('Error', err?.message ?? 'Search failed');
    } finally {
      setSearching(false);
    }
  };

  const renderFriend = ({ item }: { item: FriendEntry }) => {
    const status = friendStatuses[item.friendId] ?? item.status ?? 'offline';
    return (
      <View style={styles.row}>
        <View style={[styles.avatarCircle, { borderColor: STATUS_COLOR[status] ?? '#3a3a5a' }]}>
          <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.rowInfo}>
          <Text style={styles.rowName}>{item.username}</Text>
          <Text style={[styles.rowStatus, { color: STATUS_COLOR[status] ?? '#3a3a5a' }]}>
            {STATUS_ICON[status] ?? '💤'} {status}
          </Text>
        </View>
        <TouchableOpacity
          onPress={() =>
            Alert.alert(
              'Remove Friend',
              `Remove ${item.username}?`,
              [
                { text: 'Cancel', style: 'cancel' },
                { text: 'Remove', style: 'destructive', onPress: () => removeMut.mutate(item.friendId) },
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
            {isIncoming ? '⬇ Incoming' : '⬆ Sent'}
          </Text>
        </View>
        {isIncoming && (
          <View style={styles.reqActions}>
            <TouchableOpacity
              style={styles.acceptBtn}
              onPress={() => acceptMut.mutate(item.id)}
              activeOpacity={0.8}
            >
              <Text style={styles.acceptBtnText}>✓</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.declineBtn}
              onPress={() => declineMut.mutate(item.id)}
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
        <Text style={styles.rowSub}>Lv {item.level} · {item.xp} XP</Text>
      </View>
      {item.relationship === 'none' && (
        <TouchableOpacity
          style={styles.addBtn}
          onPress={() => sendMut.mutate(item.id)}
          disabled={sendMut.isPending}
          activeOpacity={0.8}
        >
          <Text style={styles.addBtnText}>+ Add</Text>
        </TouchableOpacity>
      )}
      {item.relationship === 'friends' && (
        <Text style={styles.friendTag}>Friends</Text>
      )}
      {(item.relationship === 'pending_sent' || item.relationship === 'pending_received') && (
        <Text style={styles.pendingTag}>Pending</Text>
      )}
    </View>
  );

  return (
    <View style={styles.root}>
      {/* Tabs */}
      <View style={styles.tabRow}>
        {(['friends', 'requests', 'search'] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            style={[styles.tab, tab === t && styles.tabActive]}
            onPress={() => setTab(t)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, tab === t && styles.tabTextActive]}>
              {t === 'friends' ? '👥 Friends' : t === 'requests' ? `🔔 Requests${pendingCount > 0 ? ` (${pendingCount})` : ''}` : '🔍 Search'}
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
              ? <View style={styles.empty}><Text style={styles.emptyText}>No friends yet. Search for people!</Text></View>
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
          keyExtractor={(r) => r.id}
          renderItem={renderRequest}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            !requestsQ.isLoading
              ? <View style={styles.empty}><Text style={styles.emptyText}>No friend requests.</Text></View>
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
              placeholder="Search by username…"
              placeholderTextColor="#4a4a6a"
              onSubmitEditing={handleSearch}
              returnKeyType="search"
            />
            <TouchableOpacity style={styles.searchBtn} onPress={handleSearch} activeOpacity={0.8}>
              {searching ? <ActivityIndicator color="#fff" size="small" /> : <Text style={styles.searchBtnText}>Go</Text>}
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
                ? <View style={styles.empty}><Text style={styles.emptyText}>No users found.</Text></View>
                : null
            }
          />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },

  tabRow: { flexDirection: 'row', paddingHorizontal: 16, paddingTop: 16, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: '#16213e',
    borderRadius: 8,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: '#0f3460', borderBottomWidth: 2, borderBottomColor: '#e94560' },
  tabText: { color: '#8a8a9a', fontSize: 12, fontWeight: '600' },
  tabTextActive: { color: '#e94560' },

  list: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: 40 },
  empty: { alignItems: 'center', marginTop: 60 },
  emptyText: { color: '#8a8a9a', fontSize: 14 },

  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#16213e',
    borderRadius: 12,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#0f3460',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#3a3a5a',
  },
  avatarLetter: { color: '#00d2ff', fontSize: 16, fontWeight: '700' },
  rowInfo: { flex: 1 },
  rowName: { color: '#fff', fontSize: 15, fontWeight: '600' },
  rowStatus: { fontSize: 12, marginTop: 2 },
  rowSub: { color: '#8a8a9a', fontSize: 12, marginTop: 2 },
  removeIcon: { color: '#4a4a6a', fontSize: 16 },

  reqActions: { flexDirection: 'row', gap: 8 },
  acceptBtn: {
    backgroundColor: '#00d2ff',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  acceptBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },
  declineBtn: {
    backgroundColor: '#2a2a4a',
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineBtnText: { color: '#8a8a9a', fontWeight: '700', fontSize: 14 },

  addBtn: {
    backgroundColor: '#e94560',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  addBtnText: { color: '#fff', fontWeight: '700', fontSize: 13 },
  friendTag: { color: '#00d2ff', fontSize: 12, fontWeight: '600' },
  pendingTag: { color: '#f5a623', fontSize: 12, fontWeight: '600' },

  searchArea: { flex: 1 },
  searchRow: { flexDirection: 'row', gap: 10, paddingHorizontal: 16, paddingTop: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: '#16213e',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 12,
    color: '#fff',
    fontSize: 15,
    borderWidth: 1,
    borderColor: '#0f3460',
  },
  searchBtn: {
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: 'center',
  },
  searchBtnText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
