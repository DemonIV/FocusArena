import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Modal,
  TextInput,
  RefreshControl,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsService } from '../../services';
import { useSocketStore } from '../../stores';
import type { Room } from '../../types';

function RoomCard({
  room,
  onJoin,
  onLeave,
  isJoined,
}: {
  room: Room;
  onJoin: (id: string) => void;
  onLeave: (id: string) => void;
  isJoined: boolean;
}) {
  return (
    <View style={[styles.card, isJoined && styles.cardJoined]}>
      <View style={styles.cardHeader}>
        <Text style={styles.roomName}>{room.name}</Text>
        <View style={[styles.memberPill, room.isPublic ? styles.publicPill : styles.privatePill]}>
          <Text style={styles.pillText}>
            {room.isPublic ? '🌐 Public' : '🔒 Private'}
          </Text>
        </View>
      </View>

      {room.topic ? (
        <Text style={styles.topic}>{room.topic}</Text>
      ) : null}

      <View style={styles.cardFooter}>
        <Text style={styles.memberCount}>
          👥 {room.memberCount}/{room.maxMembers}
        </Text>

        {isJoined ? (
          <TouchableOpacity
            style={styles.leaveBtn}
            onPress={() => onLeave(room.id)}
            activeOpacity={0.8}
          >
            <Text style={styles.leaveBtnText}>Leave</Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={[
              styles.joinBtn,
              room.memberCount >= room.maxMembers && styles.joinBtnDisabled,
            ]}
            onPress={() => onJoin(room.id)}
            disabled={room.memberCount >= room.maxMembers}
            activeOpacity={0.8}
          >
            <Text style={styles.joinBtnText}>
              {room.memberCount >= room.maxMembers ? 'Full' : 'Join'}
            </Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
}

export function RoomsScreen() {
  const qc = useQueryClient();
  const { joinRoom, leaveRoom } = useSocketStore();

  const [createVisible, setCreateVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [roomTopic, setRoomTopic] = useState('');
  const [isPublic, setIsPublic] = useState(true);
  const [inviteCode, setInviteCode] = useState('');
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());

  const roomsQ = useQuery({
    queryKey: ['rooms'],
    queryFn: () => roomsService.list(),
  });

  const myRoomsQ = useQuery({
    queryKey: ['my-rooms'],
    queryFn: () => roomsService.mine(),
  });

  useEffect(() => {
    if (myRoomsQ.data) {
      setJoinedRoomIds(new Set(myRoomsQ.data.map((r) => r.id)));
    }
  }, [myRoomsQ.data]);

  const createMut = useMutation({
    mutationFn: () => roomsService.create({ name: roomName.trim(), topic: roomTopic.trim() || undefined, isPublic }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['rooms'] });
      qc.invalidateQueries({ queryKey: ['my-rooms'] });
      setCreateVisible(false);
      setRoomName('');
      setRoomTopic('');
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not create room'),
  });

  const joinMut = useMutation({
    mutationFn: (roomId: string) => roomsService.join(roomId),
    onSuccess: (_, roomId) => {
      joinRoom(roomId);
      setJoinedRoomIds((prev) => new Set([...prev, roomId]));
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not join room'),
  });

  const leaveMut = useMutation({
    mutationFn: (roomId: string) => roomsService.leave(roomId),
    onSuccess: (_, roomId) => {
      leaveRoom(roomId);
      setJoinedRoomIds((prev) => {
        const next = new Set(prev);
        next.delete(roomId);
        return next;
      });
      qc.invalidateQueries({ queryKey: ['rooms'] });
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Could not leave room'),
  });

  const joinInviteMut = useMutation({
    mutationFn: () => roomsService.joinByCode(inviteCode.trim().toUpperCase()),
    onSuccess: (data) => {
      joinRoom(data.roomId);
      setJoinedRoomIds((prev) => new Set([...prev, data.roomId]));
      setInviteVisible(false);
      setInviteCode('');
      qc.invalidateQueries({ queryKey: ['rooms'] });
      Alert.alert('Joined!', `You joined the room.`);
    },
    onError: (err: any) => Alert.alert('Error', err?.message ?? 'Invalid invite code'),
  });

  return (
    <View style={styles.root}>
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>+ Create Room</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => setInviteVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>🔗 Join by Code</Text>
        </TouchableOpacity>
      </View>

      {roomsQ.isLoading ? (
        <ActivityIndicator color="#00d2ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={roomsQ.data ?? []}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => (
            <RoomCard
              room={item}
              isJoined={joinedRoomIds.has(item.id)}
              onJoin={(id) => joinMut.mutate(id)}
              onLeave={(id) => leaveMut.mutate(id)}
            />
          )}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚪</Text>
              <Text style={styles.emptyText}>No rooms yet. Create one!</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={roomsQ.isFetching}
              onRefresh={() => roomsQ.refetch()}
              tintColor="#00d2ff"
            />
          }
        />
      )}

      {/* Create Room Modal */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Create Room</Text>

            <Text style={styles.fieldLabel}>Room Name *</Text>
            <TextInput
              style={styles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder="My Study Room"
              placeholderTextColor="#4a4a6a"
            />

            <Text style={styles.fieldLabel}>Topic (optional)</Text>
            <TextInput
              style={styles.input}
              value={roomTopic}
              onChangeText={setRoomTopic}
              placeholder="e.g. Math Finals"
              placeholderTextColor="#4a4a6a"
            />

            <TouchableOpacity
              style={styles.toggleRow}
              onPress={() => setIsPublic(!isPublic)}
              activeOpacity={0.8}
            >
              <Text style={styles.toggleLabel}>{isPublic ? '🌐 Public' : '🔒 Private'}</Text>
              <View style={[styles.toggle, isPublic ? styles.toggleOn : styles.toggleOff]}>
                <View style={[styles.toggleThumb, isPublic ? styles.thumbOn : styles.thumbOff]} />
              </View>
            </TouchableOpacity>

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!roomName.trim() || createMut.isPending) && styles.confirmBtnDisabled]}
                onPress={() => createMut.mutate()}
                disabled={!roomName.trim() || createMut.isPending}
              >
                {createMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>Create</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Join by Invite Modal */}
      <Modal visible={inviteVisible} animationType="slide" transparent onRequestClose={() => setInviteVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>Join by Invite Code</Text>
            <TextInput
              style={[styles.input, { letterSpacing: 4, textAlign: 'center', fontSize: 18, fontWeight: '700' }]}
              value={inviteCode}
              onChangeText={setInviteCode}
              placeholder="XXXXXX"
              placeholderTextColor="#4a4a6a"
              autoCapitalize="characters"
              maxLength={8}
            />
            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setInviteVisible(false)}>
                <Text style={styles.cancelBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!inviteCode.trim() || joinInviteMut.isPending) && styles.confirmBtnDisabled]}
                onPress={() => joinInviteMut.mutate()}
                disabled={!inviteCode.trim() || joinInviteMut.isPending}
              >
                {joinInviteMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>Join</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#1a1a2e' },

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 12,
    alignItems: 'center',
  },
  actionBtnSecondary: { backgroundColor: '#0f3460' },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    backgroundColor: '#16213e',
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
  },
  cardJoined: {
    borderWidth: 1,
    borderColor: '#00d2ff',
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  roomName: { color: '#fff', fontSize: 16, fontWeight: '700', flex: 1 },
  memberPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  publicPill: { backgroundColor: '#0f3460' },
  privatePill: { backgroundColor: '#2a1030' },
  pillText: { color: '#8a8a9a', fontSize: 11, fontWeight: '600' },
  topic: { color: '#8a8a9a', fontSize: 13, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  memberCount: { color: '#8a8a9a', fontSize: 13 },
  joinBtn: {
    backgroundColor: '#00d2ff',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinBtnDisabled: { backgroundColor: '#2a2a4a' },
  joinBtnText: { color: '#fff', fontWeight: '700' },
  leaveBtn: {
    backgroundColor: 'transparent',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#e94560',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveBtnText: { color: '#e94560', fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: '#8a8a9a', fontSize: 15 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
  },
  sheetTitle: { color: '#fff', fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: '#8a8a9a', fontSize: 12, textTransform: 'uppercase', letterSpacing: 1, marginBottom: -4 },
  input: {
    backgroundColor: '#0f3460',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: '#fff',
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#1a3060',
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#0f3460',
    borderRadius: 10,
    padding: 14,
  },
  toggleLabel: { color: '#fff', fontSize: 15 },
  toggle: {
    width: 44,
    height: 24,
    borderRadius: 12,
    padding: 2,
    justifyContent: 'center',
  },
  toggleOn: { backgroundColor: '#00d2ff' },
  toggleOff: { backgroundColor: '#2a2a4a' },
  toggleThumb: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#fff',
  },
  thumbOn: { alignSelf: 'flex-end' },
  thumbOff: { alignSelf: 'flex-start' },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: '#0f3460',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: { color: '#8a8a9a', fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: '#e94560',
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '700' },
});
