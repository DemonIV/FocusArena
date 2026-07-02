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
import { useTranslation } from 'react-i18next';
import { roomsService } from '../../services';
import { FramedAvatar } from '../../components';
import { useSocketStore, useAuthStore } from '../../stores';
import i18n from '../../i18n';
import type { Room, RoomMember } from '../../types';

function RoomCard({
  room,
  onLeave,
  onOpen,
  isOwner,
}: {
  room: Room;
  onLeave: (id: string) => void;
  onOpen: (id: string) => void;
  isOwner: boolean;
}) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity
      style={[styles.card, styles.cardJoined]}
      onPress={() => onOpen(room.id)}
      activeOpacity={0.85}
    >
      <View style={styles.cardHeader}>
        <Text style={styles.roomName}>{room.name}</Text>
        <View style={[styles.memberPill, styles.privatePill]}>
          <Text style={styles.pillText}>{isOwner ? t('rooms.owner') : t('rooms.private')}</Text>
        </View>
      </View>

      <View style={styles.cardFooter}>
        <Text style={styles.memberCount}>
          👥 {room.memberCount}/{room.maxMembers}  ·  {t('rooms.tapForDetails')}
        </Text>

        <TouchableOpacity
          style={styles.leaveBtn}
          onPress={() => onLeave(room.id)}
          activeOpacity={0.8}
        >
          <Text style={styles.leaveBtnText}>{isOwner ? t('rooms.delete') : t('rooms.leave')}</Text>
        </TouchableOpacity>
      </View>
    </TouchableOpacity>
  );
}

export function RoomsScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { joinRoom, leaveRoom } = useSocketStore();
  const friendStatuses = useSocketStore((s) => s.friendStatuses);
  const userId = useAuthStore((s) => s.user?.id);

  const [createVisible, setCreateVisible] = useState(false);
  const [inviteVisible, setInviteVisible] = useState(false);
  const [roomName, setRoomName] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [joinedRoomIds, setJoinedRoomIds] = useState<Set<string>>(new Set());
  const [detailRoomId, setDetailRoomId] = useState<string | null>(null);

  const myRoomsQ = useQuery({
    queryKey: ['my-rooms'],
    queryFn: () => roomsService.mine(),
  });

  const detailQ = useQuery({
    queryKey: ['room', detailRoomId],
    queryFn: () => roomsService.get(detailRoomId as string),
    enabled: !!detailRoomId,
  });

  useEffect(() => {
    if (myRoomsQ.data) {
      setJoinedRoomIds(new Set(myRoomsQ.data.map((r) => r.id)));
    }
  }, [myRoomsQ.data]);

  const createMut = useMutation({
    mutationFn: () => roomsService.create({ name: roomName.trim() }),
    onSuccess: (room) => {
      qc.invalidateQueries({ queryKey: ['my-rooms'] });
      setCreateVisible(false);
      setRoomName('');
      if (room.inviteCode) {
        Alert.alert(
          t('rooms.roomCreated'),
          t('rooms.roomCreatedMsg', { code: room.inviteCode }),
        );
      }
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message ?? t('rooms.createFailed')),
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
      qc.invalidateQueries({ queryKey: ['my-rooms'] });
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message ?? t('rooms.leaveFailed')),
  });

  const joinInviteMut = useMutation({
    mutationFn: () => roomsService.joinByCode(inviteCode.trim().toUpperCase()),
    onSuccess: (data) => {
      joinRoom(data.roomId);
      setJoinedRoomIds((prev) => new Set([...prev, data.roomId]));
      setInviteVisible(false);
      setInviteCode('');
      qc.invalidateQueries({ queryKey: ['my-rooms'] });
      Alert.alert(t('rooms.joined'), t('rooms.joinedMsg'));
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message ?? t('rooms.invalidCode')),
  });

  // Rooms the user is a member of (all rooms are private/invite-only)
  const myRooms = myRoomsQ.data ?? [];

  return (
    <View style={styles.root}>
      {/* Action Bar */}
      <View style={styles.actionBar}>
        <TouchableOpacity
          style={styles.actionBtn}
          onPress={() => setCreateVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>{t('rooms.createRoom')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.actionBtn, styles.actionBtnSecondary]}
          onPress={() => setInviteVisible(true)}
          activeOpacity={0.8}
        >
          <Text style={styles.actionBtnText}>{t('rooms.joinByCode')}</Text>
        </TouchableOpacity>
      </View>

      {myRoomsQ.isLoading ? (
        <ActivityIndicator color="#00d2ff" style={{ marginTop: 40 }} />
      ) : (
        <FlatList
          data={myRooms}
          keyExtractor={(r) => r.id}
          renderItem={({ item }) => {
            const isOwner = item.ownerId === userId;
            return (
              <RoomCard
                room={item}
                isOwner={isOwner}
                onOpen={(id) => setDetailRoomId(id)}
                onLeave={(id) =>
                  Alert.alert(
                    isOwner ? t('rooms.deleteRoom') : t('rooms.leaveRoom'),
                    isOwner ? t('rooms.deleteRoomMsg') : t('rooms.leaveRoomMsg'),
                    [
                      { text: t('common.cancel'), style: 'cancel' },
                      { text: isOwner ? t('rooms.transferDelete') : t('rooms.leave'), style: 'destructive', onPress: () => leaveMut.mutate(id) },
                    ],
                  )
                }
              />
            );
          }}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🚪</Text>
              <Text style={styles.emptyText}>{t('rooms.noRooms')}</Text>
            </View>
          }
          refreshControl={
            <RefreshControl
              refreshing={myRoomsQ.isFetching}
              onRefresh={() => myRoomsQ.refetch()}
              tintColor="#00d2ff"
            />
          }
        />
      )}

      {/* Create Room Modal */}
      <Modal visible={createVisible} animationType="slide" transparent onRequestClose={() => setCreateVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle}>{t('rooms.createTitle')}</Text>
            <Text style={styles.detailSub}>{t('rooms.createSub')}</Text>

            <Text style={styles.fieldLabel}>{t('rooms.roomName')}</Text>
            <TextInput
              style={styles.input}
              value={roomName}
              onChangeText={setRoomName}
              placeholder={t('rooms.roomNamePlaceholder')}
              placeholderTextColor="#4a4a6a"
            />

            <View style={styles.sheetActions}>
              <TouchableOpacity style={styles.cancelBtn} onPress={() => setCreateVisible(false)}>
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!roomName.trim() || createMut.isPending) && styles.confirmBtnDisabled]}
                onPress={() => createMut.mutate()}
                disabled={!roomName.trim() || createMut.isPending}
              >
                {createMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>{t('rooms.create')}</Text>
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
            <Text style={styles.sheetTitle}>{t('rooms.joinTitle')}</Text>
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
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.confirmBtn, (!inviteCode.trim() || joinInviteMut.isPending) && styles.confirmBtnDisabled]}
                onPress={() => joinInviteMut.mutate()}
                disabled={!inviteCode.trim() || joinInviteMut.isPending}
              >
                {joinInviteMut.isPending
                  ? <ActivityIndicator color="#fff" />
                  : <Text style={styles.confirmBtnText}>{t('rooms.join')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Room Detail Modal — members + study minutes */}
      <Modal
        visible={!!detailRoomId}
        animationType="slide"
        transparent
        onRequestClose={() => setDetailRoomId(null)}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '80%' }]}>
            {detailQ.isLoading || !detailQ.data ? (
              <ActivityIndicator color="#00d2ff" style={{ marginVertical: 40 }} />
            ) : (
              <>
                <Text style={styles.sheetTitle}>{detailQ.data.name}</Text>
                <Text style={styles.detailSub}>
                  {detailQ.data.isPublic ? t('rooms.public') : t('rooms.private')} · 👥 {detailQ.data.members.length}/{detailQ.data.maxMembers}
                </Text>

                {detailQ.data.inviteCode ? (
                  <View style={styles.inviteBox}>
                    <Text style={styles.inviteBoxLabel}>{t('profile.inviteCode')}</Text>
                    <Text style={styles.inviteBoxCode}>{detailQ.data.inviteCode}</Text>
                  </View>
                ) : null}

                {/* Collective focus — the "library" feel */}
                <View style={styles.libraryBox}>
                  <Text style={styles.libraryIcon}>📚</Text>
                  <Text style={styles.libraryText}>
                    {t('rooms.libraryFocus', {
                      duration: fmtMinutes(detailQ.data.members.reduce((s, m) => s + m.totalMinutes, 0)),
                    })}
                  </Text>
                </View>

                <Text style={styles.membersHeader}>{t('rooms.members')}</Text>
                <FlatList
                  data={[...detailQ.data.members]
                    .map((m) => ({ ...m, status: (friendStatuses[m.userId] as RoomMember['status']) ?? m.status }))
                    .sort((a, b) => b.totalMinutes - a.totalMinutes)}
                  keyExtractor={(m) => m.userId}
                  style={{ maxHeight: 380 }}
                  renderItem={({ item, index }) => {
                    const isMe = item.userId === userId;
                    const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
                    return (
                      <View style={[styles.memberRow, isMe && styles.memberRowMe]}>
                        <View style={styles.rankBox}>
                          {medal
                            ? <Text style={styles.rankMedal}>{medal}</Text>
                            : <Text style={styles.rankNum}>{index + 1}</Text>}
                        </View>
                        {item.frame ? (
                          <FramedAvatar username={item.username} avatarUrl={item.avatarUrl} frameId={item.frame} size={36} />
                        ) : (
                          <View style={[styles.memberAvatar, { borderColor: MEMBER_STATUS_COLOR[item.status] }]}>
                            <Text style={styles.memberLetter}>{item.username.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={{ flex: 1 }}>
                          <Text style={styles.memberName} numberOfLines={1}>
                            {item.username}
                            {isMe && <Text style={styles.youTag}>  {t('rooms.youTag')}</Text>}
                          </Text>
                          <Text style={[styles.memberStatus, { color: MEMBER_STATUS_COLOR[item.status] }]}>
                            {MEMBER_STATUS_ICON[item.status]} {t(`status.${item.status}`, { defaultValue: item.status })}
                          </Text>
                        </View>
                        <Text style={styles.memberMinutes}>{fmtMinutes(item.totalMinutes)}</Text>
                      </View>
                    );
                  }}
                  ListEmptyComponent={<Text style={styles.emptyText}>{t('rooms.noMembers')}</Text>}
                />
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={() => setDetailRoomId(null)}>
              <Text style={styles.cancelBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const MEMBER_STATUS_COLOR: Record<string, string> = {
  studying: '#00d2ff',
  break: '#f5a623',
  offline: '#4a4a6a',
};
const MEMBER_STATUS_ICON: Record<string, string> = {
  studying: '📖',
  break: '☕',
  offline: '💤',
};

/** 75 → "1h 15min", 40 → "40min" (units localized) */
function fmtMinutes(total: number): string {
  const min = i18n.t('common.minShort');
  const hr = i18n.t('common.hourShort');
  if (total < 60) return `${total}${min}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}${hr} ${m}${min}` : `${h}${hr}`;
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

  actionBar: {
    flexDirection: 'row',
    gap: 10,
    padding: 16,
  },
  actionBtn: {
    flex: 1,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
  },
  actionBtnSecondary: {
    backgroundColor: `${ACCENT}18`,
    borderWidth: 1,
    borderColor: `${ACCENT}50`,
  },
  actionBtnText: { color: '#fff', fontWeight: '700', fontSize: 14 },

  list: { paddingHorizontal: 16, paddingBottom: 40 },

  card: {
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cardJoined: {
    borderColor: `${ACCENT}55`,
  },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  roomName: { color: TEXT, fontSize: 16, fontWeight: '700', flex: 1 },
  memberPill: { borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginLeft: 8 },
  publicPill: { backgroundColor: CARD2 },
  privatePill: { backgroundColor: `${ACCENT}18` },
  pillText: { color: MUTED2, fontSize: 11, fontWeight: '600' },
  topic: { color: MUTED, fontSize: 13, marginBottom: 12 },
  cardFooter: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  memberCount: { color: MUTED, fontSize: 13, flex: 1 },
  joinBtn: {
    backgroundColor: ACCENT,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  joinBtnDisabled: { backgroundColor: CARD2 },
  joinBtnText: { color: '#000', fontWeight: '700' },
  leaveBtn: {
    backgroundColor: 'transparent',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: `${PINK}66`,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  leaveBtnText: { color: PINK, fontWeight: '700' },

  emptyState: { alignItems: 'center', marginTop: 60 },
  emptyIcon: { fontSize: 48, marginBottom: 12 },
  emptyText: { color: MUTED, fontSize: 15, textAlign: 'center', paddingHorizontal: 32 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#131325',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: 40,
    gap: 12,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  sheetTitle: { color: TEXT, fontSize: 18, fontWeight: '700' },
  fieldLabel: { color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1.5, marginBottom: -4 },
  input: {
    backgroundColor: CARD2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  sheetActions: { flexDirection: 'row', gap: 10, marginTop: 8 },
  cancelBtn: {
    flex: 1,
    backgroundColor: CARD2,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelBtnText: { color: MUTED2, fontWeight: '600' },
  confirmBtn: {
    flex: 1,
    backgroundColor: PINK,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  confirmBtnDisabled: { opacity: 0.5 },
  confirmBtnText: { color: '#fff', fontWeight: '700' },

  // ── Room detail ──
  detailSub: { color: MUTED2, fontSize: 13, marginTop: -4 },
  inviteBox: {
    backgroundColor: `${ACCENT}14`,
    borderRadius: 12,
    padding: 14,
    alignItems: 'center',
    marginTop: 4,
  },
  inviteBoxLabel: { color: MUTED, fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 1 },
  inviteBoxCode: { color: ACCENT, fontSize: 22, fontWeight: '800', letterSpacing: 4, marginTop: 4 },
  membersHeader: {
    color: MUTED, fontSize: 11, fontWeight: '700', letterSpacing: 2,
    marginTop: 8, marginBottom: 4,
  },
  libraryBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD2,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginTop: 4,
    borderWidth: 1,
    borderColor: BORDER,
  },
  libraryIcon: { fontSize: 20 },
  libraryText: { color: TEXT, fontSize: 14, fontWeight: '600', flex: 1 },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  memberRowMe: {
    backgroundColor: `${ACCENT}12`,
    borderBottomColor: 'transparent',
  },
  rankBox: { width: 24, alignItems: 'center', justifyContent: 'center' },
  rankMedal: { fontSize: 18 },
  rankNum: { color: MUTED, fontSize: 14, fontWeight: '800' },
  youTag: { color: ACCENT, fontSize: 12, fontWeight: '700' },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: `${ACCENT}18`,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BORDER,
  },
  memberLetter: { color: ACCENT, fontSize: 15, fontWeight: '700' },
  memberName: { color: TEXT, fontSize: 15, fontWeight: '600' },
  memberStatus: { fontSize: 12, marginTop: 2 },
  memberMinutes: { color: ACCENT, fontSize: 14, fontWeight: '700' },
});
