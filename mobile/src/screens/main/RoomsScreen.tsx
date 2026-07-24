import React, { useState, useEffect, useMemo } from 'react';
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
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { roomsService } from '../../services';
import { FramedAvatar } from '../../components';
import { getPetEmoji } from '../../constants';
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
  /** When set, the detail sheet shows this member's today-subject breakdown */
  const [subjectUserId, setSubjectUserId] = useState<string | null>(null);

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

  // Members decorated with live presence + sorted by today's minutes (the daily race)
  const members = useMemo(() => {
    const list = (detailQ.data?.members ?? []).map((m) => ({
      ...m,
      status: (friendStatuses[m.userId] as RoomMember['status']) ?? m.status,
    }));
    return list.sort((a, b) => b.todayMinutes - a.todayMinutes);
  }, [detailQ.data, friendStatuses]);

  const roomTodayTotal = members.reduce((s, m) => s + m.todayMinutes, 0);
  const liveCount = members.filter((m) => m.status === 'studying').length;
  const subjectMember = subjectUserId ? members.find((m) => m.userId === subjectUserId) ?? null : null;

  const closeDetail = () => { setDetailRoomId(null); setSubjectUserId(null); };

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
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Join by Invite Modal */}
      <Modal visible={inviteVisible} animationType="slide" transparent onRequestClose={() => setInviteVisible(false)}>
        <KeyboardAvoidingView style={styles.overlay} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
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
        </KeyboardAvoidingView>
      </Modal>

      {/* Room Detail Modal — live presence + today's focus + per-member subjects */}
      <Modal
        visible={!!detailRoomId}
        animationType="slide"
        transparent
        onRequestClose={closeDetail}
      >
        <View style={styles.overlay}>
          <View style={[styles.sheet, { maxHeight: '86%' }]}>
            {detailQ.isLoading || !detailQ.data ? (
              <ActivityIndicator color="#00d2ff" style={{ marginVertical: 40 }} />
            ) : subjectMember ? (
              <MemberSubjectsView
                member={subjectMember}
                isMe={subjectMember.userId === userId}
                onBack={() => setSubjectUserId(null)}
              />
            ) : (
              <>
                <View style={styles.grabber} />
                <View style={styles.titleRow}>
                  <Text style={[styles.sheetTitle, { fontSize: 20, fontWeight: '800', letterSpacing: -0.3, flexShrink: 1 }]} numberOfLines={1}>{detailQ.data.name}</Text>
                  <View style={styles.pill}>
                    <Text style={styles.pillTxt}>{detailQ.data.isPublic ? t('rooms.public') : t('rooms.private')}</Text>
                  </View>
                  <View style={styles.pill}>
                    <Text style={styles.pillTxt}>👥 {members.length}/{detailQ.data.maxMembers}</Text>
                  </View>
                </View>

                {detailQ.data.inviteCode ? (
                  <Text style={styles.codeLine}>
                    {t('profile.inviteCode')}  <Text style={styles.codeVal}>{detailQ.data.inviteCode}</Text>
                  </Text>
                ) : null}

                <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
                  {/* Hero — the room's focus today */}
                  <Text style={styles.eyebrow}>{t('rooms.todayFocus')}</Text>
                  <View style={styles.heroRow}>
                    <RichMinutes total={roomTodayTotal} big={styles.heroTotal} unit={styles.heroTotalUnit} />
                    <View style={styles.liveNow}>
                      <View style={[styles.liveDot, liveCount === 0 && { opacity: 0.4 }]} />
                      <Text style={[styles.liveTxt, liveCount === 0 && styles.liveTxtOff]}>
                        {liveCount > 0 ? t('rooms.liveHere', { count: liveCount }) : t('rooms.noneFocusing')}
                      </Text>
                    </View>
                  </View>
                  <PresenceBar members={members} total={roomTodayTotal} />
                  <Text style={styles.heroNote}>{t('rooms.everyMinuteNote')}</Text>

                  {/* Members — presence ladder, ranked by today's minutes */}
                  <View style={styles.secLabelRow}>
                    <Text style={styles.secLabel}>{t('rooms.members')}</Text>
                    <Text style={styles.secLabelSub}>{t('rooms.todayStudied')}</Text>
                  </View>

                  {members.length === 0 ? (
                    <Text style={styles.emptyText}>{t('rooms.noMembers')}</Text>
                  ) : (
                    members.map((m, index) => (
                      <MemberRow
                        key={m.userId}
                        member={m}
                        index={index}
                        isMe={m.userId === userId}
                        onPress={() => setSubjectUserId(m.userId)}
                      />
                    ))
                  )}
                  <Text style={styles.foot}>{t('rooms.tapMemberHint')}</Text>
                </ScrollView>
              </>
            )}

            <TouchableOpacity style={styles.cancelBtn} onPress={closeDetail}>
              <Text style={styles.cancelBtnText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

// ── Presence ladder — one colour system across rows, bars and rings ──
type Tier = 'focus' | 'online' | 'recent' | 'far';
const TIER_COLOR: Record<Tier, string> = { focus: '#22D3EE', online: '#34D399', recent: '#E0A458', far: '#64708A' };
const TIER_BAR: Record<Tier, string>   = { focus: '#22D3EE', online: '#34D399', recent: '#E0A458', far: '#3A4560' };
const RECENT_HOURS = 12; // within this window of the last session → "recent" (ember)

/** Human "x ago" for a timestamp, localized. */
function relTime(iso: string): string {
  const min = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (min < 1) return i18n.t('relative.justNow');
  if (min < 60) return i18n.t('relative.minutesAgo', { count: min });
  const hr = Math.floor(min / 60);
  if (hr < 24) return i18n.t('relative.hoursAgo', { count: hr });
  const days = Math.floor(hr / 24);
  if (days === 1) return i18n.t('relative.yesterday');
  return i18n.t('relative.daysAgo', { count: days });
}

/** Live status + last-seen → a presence tier and its status line. */
function deriveTier(m: RoomMember): { tier: Tier; label: string } {
  if (m.status === 'studying') return { tier: 'focus', label: i18n.t('rooms.focusingNow') };
  if (m.status === 'break') return { tier: 'online', label: i18n.t('rooms.onBreakNow') };
  if (m.lastSessionAt) {
    const ageHr = (Date.now() - new Date(m.lastSessionAt).getTime()) / 3_600_000;
    return {
      tier: ageHr < RECENT_HOURS ? 'recent' : 'far',
      label: i18n.t('rooms.wasOnline', { time: relTime(m.lastSessionAt) }),
    };
  }
  return { tier: 'far', label: i18n.t('status.offline') };
}

/** Minutes with small localized units, e.g. 75 → "1sa 15dk". */
function RichMinutes({ total, big, unit }: { total: number; big: any; unit: any }) {
  const min = i18n.t('common.minShort');
  const hr = i18n.t('common.hourShort');
  if (total < 60) {
    return <Text style={big}>{total}<Text style={unit}>{min}</Text></Text>;
  }
  const h = Math.floor(total / 60);
  const m = total % 60;
  return (
    <Text style={big}>
      {h}<Text style={unit}>{hr}</Text>
      {m > 0 ? <>{' '}{String(m).padStart(2, '0')}<Text style={unit}>{min}</Text></> : null}
    </Text>
  );
}

/** Stacked bar of each member's today-minutes, coloured by presence tier. */
function PresenceBar({ members, total }: { members: RoomMember[]; total: number }) {
  if (total <= 0) return <View style={styles.barEmpty} />;
  return (
    <View style={styles.shareBar}>
      {members.filter((m) => m.todayMinutes > 0).map((m) => (
        <View key={m.userId} style={{ flex: m.todayMinutes, backgroundColor: TIER_BAR[deriveTier(m).tier], borderRadius: 4 }} />
      ))}
    </View>
  );
}

/** One member row — presence ladder + today's minutes, taps into subjects. */
function MemberRow({ member, index, isMe, onPress }: {
  member: RoomMember; index: number; isMe: boolean; onPress: () => void;
}) {
  const { tier, label } = deriveTier(member);
  const color = TIER_COLOR[tier];
  const medal = index === 0 ? '🥇' : index === 1 ? '🥈' : index === 2 ? '🥉' : null;
  const away = tier === 'recent' || tier === 'far';
  return (
    <TouchableOpacity style={[styles.memberRow, isMe && styles.memberRowMe]} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.rankBox}>
        {medal ? <Text style={styles.rankMedal}>{medal}</Text> : <Text style={styles.rankNum}>{index + 1}</Text>}
      </View>
      {member.frame ? (
        <FramedAvatar username={member.username} avatarUrl={member.avatarUrl} frameId={member.frame} size={36} />
      ) : (
        <View style={[styles.memberAvatar, { borderColor: color }]}>
          <Text style={[styles.memberLetter, { color }]}>{member.username.charAt(0).toUpperCase()}</Text>
        </View>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.memberName} numberOfLines={1}>
          {member.username}
          {getPetEmoji(member.pet) ? ` ${getPetEmoji(member.pet)}` : ''}
          {isMe && <Text style={styles.youTag}>  {i18n.t('rooms.youTag')}</Text>}
        </Text>
        <View style={styles.stateRow}>
          <View style={[styles.stateDot, { backgroundColor: TIER_BAR[tier] }]} />
          <Text style={[styles.stateTxt, { color }]} numberOfLines={1}>{label}</Text>
        </View>
      </View>
      <View style={{ alignItems: 'flex-end' }}>
        <RichMinutes
          total={member.todayMinutes}
          big={[styles.memberMinutes, away && styles.memberMinutesAway]}
          unit={[styles.memberMinutesUnit, away && styles.memberMinutesUnitAway]}
        />
        <Text style={styles.memberAllTime}>{i18n.t('rooms.allTimeShort', { hours: Math.floor(member.totalMinutes / 60) })}</Text>
      </View>
      <Text style={styles.chev}>›</Text>
    </TouchableOpacity>
  );
}

/** Sub-page: what this member focused on today (subject breakdown). */
function MemberSubjectsView({ member, isMe, onBack }: {
  member: RoomMember; isMe: boolean; onBack: () => void;
}) {
  const { t } = useTranslation();
  const { tier, label } = deriveTier(member);
  const color = TIER_COLOR[tier];
  const subs = member.todaySubjects; // sorted desc by the backend
  const today = member.todayMinutes;
  return (
    <>
      <View style={styles.grabber} />
      <TouchableOpacity style={styles.backBtn} onPress={onBack} activeOpacity={0.7}>
        <Text style={styles.backTxt}>‹ {t('rooms.backToRoom')}</Text>
      </TouchableOpacity>

      <View style={styles.subHead}>
        {member.frame ? (
          <FramedAvatar username={member.username} avatarUrl={member.avatarUrl} frameId={member.frame} size={46} />
        ) : (
          <View style={[styles.subAvatar, { borderColor: color }]}>
            <Text style={[styles.subAvatarLetter, { color }]}>{member.username.charAt(0).toUpperCase()}</Text>
          </View>
        )}
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.subName} numberOfLines={1}>
            {member.username}
            {getPetEmoji(member.pet) ? ` ${getPetEmoji(member.pet)}` : ''}
            {isMe ? <Text style={styles.youTag}>  {t('rooms.youTag')}</Text> : null}
          </Text>
          <View style={styles.stateRow}>
            <View style={[styles.stateDot, { backgroundColor: TIER_BAR[tier] }]} />
            <Text style={[styles.stateTxt, { color }]} numberOfLines={1}>{label}</Text>
          </View>
        </View>
      </View>

      {subs.length === 0 ? (
        <View style={styles.subEmpty}>
          <Text style={styles.subEmptyEmoji}>🌙</Text>
          <Text style={styles.subEmptyTxt}>{t('rooms.noSubjectsToday')}</Text>
        </View>
      ) : (
        <ScrollView showsVerticalScrollIndicator={false} style={{ marginTop: 4 }}>
          <View style={styles.subTotalRow}>
            <RichMinutes total={today} big={styles.subTotalBig} unit={styles.subTotalUnit} />
            <Text style={styles.subTotalLbl}>{t('rooms.todayLabel')}</Text>
          </View>

          <View style={styles.subBar}>
            {subs.map((s, i) => (
              <View key={s.id ?? `none-${i}`} style={{ flex: s.minutes, backgroundColor: s.color ?? '#64708A', borderRadius: 4 }} />
            ))}
          </View>

          <View style={{ marginTop: 14 }}>
            {subs.map((s, i) => {
              const c = s.color ?? '#64708A';
              const pct = today > 0 ? Math.round((s.minutes / today) * 100) : 0;
              return (
                <View key={s.id ?? `none-${i}`} style={styles.subItem}>
                  <View style={[styles.subIcon, { backgroundColor: `${c}22` }]}>
                    <Text style={{ fontSize: 16 }}>{s.icon ?? '•'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={styles.subItemName} numberOfLines={1}>{s.name ?? t('monthly.noSubject')}</Text>
                    <Text style={styles.subItemPct}>{t('rooms.dayShare', { pct })}</Text>
                  </View>
                  <RichMinutes total={s.minutes} big={styles.subItemMin} unit={styles.subItemMinUnit} />
                </View>
              );
            })}
          </View>
          <View style={{ height: 16 }} />
        </ScrollView>
      )}
    </>
  );
}

const BG     = '#0d0d1a';
const CARD   = '#131325';
const CARD2  = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const FOCUS  = '#22D3EE';
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
  grabber: { width: 42, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.16)', alignSelf: 'center', marginBottom: 6 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, flexWrap: 'wrap' },
  pill: {
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.09)',
    borderRadius: 999, paddingHorizontal: 9, paddingVertical: 3.5,
  },
  pillTxt: { color: MUTED2, fontSize: 11, fontWeight: '700' },
  codeLine: { color: MUTED, fontSize: 12.5, fontWeight: '600', marginTop: -2 },
  codeVal: { color: FOCUS, fontSize: 13, fontWeight: '800', letterSpacing: 2 },

  // hero
  eyebrow: { color: MUTED, fontSize: 10.5, fontWeight: '800', letterSpacing: 2.4, marginTop: 14 },
  heroRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', marginTop: 8, gap: 10 },
  heroTotal: { color: '#CFEEFF', fontSize: 40, fontWeight: '800', letterSpacing: -1.5, fontVariant: ['tabular-nums'] },
  heroTotalUnit: { color: '#9fd8ef', fontSize: 18, fontWeight: '700' },
  liveNow: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingBottom: 6 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: FOCUS },
  liveTxt: { color: FOCUS, fontSize: 12.5, fontWeight: '700' },
  liveTxtOff: { color: MUTED },
  shareBar: { flexDirection: 'row', gap: 3, height: 9, marginTop: 14 },
  barEmpty: { height: 9, marginTop: 14, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.05)' },
  heroNote: { color: MUTED, fontSize: 11.5, fontWeight: '600', marginTop: 9 },

  // members section
  secLabelRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginTop: 22, marginBottom: 10 },
  secLabel: { color: MUTED, fontSize: 10.5, fontWeight: '800', letterSpacing: 2.4 },
  secLabelSub: { color: MUTED, fontSize: 11, fontWeight: '600' },

  memberRow: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingVertical: 11, paddingHorizontal: 12, marginBottom: 8,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.035)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  memberRowMe: {
    backgroundColor: `${FOCUS}1F`,
    borderColor: `${FOCUS}4D`,
  },
  rankBox: { width: 20, alignItems: 'center', justifyContent: 'center' },
  rankMedal: { fontSize: 17 },
  rankNum: { color: MUTED, fontSize: 14, fontWeight: '800' },
  youTag: { color: FOCUS, fontSize: 12, fontWeight: '800' },
  memberAvatar: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 2, borderColor: BORDER,
  },
  memberLetter: { fontSize: 15, fontWeight: '800' },
  memberName: { color: TEXT, fontSize: 15, fontWeight: '700' },
  stateRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2.5 },
  stateDot: { width: 6.5, height: 6.5, borderRadius: 3.5 },
  stateTxt: { fontSize: 11.5, fontWeight: '600', flexShrink: 1 },
  memberMinutes: { color: '#E6EDF8', fontSize: 16, fontWeight: '800', fontVariant: ['tabular-nums'] },
  memberMinutesUnit: { color: MUTED2, fontSize: 11.5, fontWeight: '700' },
  memberMinutesAway: { color: '#96A2B8' },
  memberMinutesUnitAway: { color: MUTED },
  memberAllTime: { color: MUTED, fontSize: 10.5, fontWeight: '600', marginTop: 1, fontVariant: ['tabular-nums'] },
  chev: { color: MUTED, fontSize: 20, marginLeft: 2 },
  foot: { color: MUTED, fontSize: 12, fontWeight: '600', textAlign: 'center', paddingVertical: 18 },

  // subject sub-page
  backBtn: { alignSelf: 'flex-start', paddingVertical: 2 },
  backTxt: { color: MUTED2, fontSize: 13, fontWeight: '700' },
  subHead: { flexDirection: 'row', alignItems: 'center', gap: 13, marginTop: 14 },
  subAvatar: {
    width: 46, height: 46, borderRadius: 23,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: BORDER,
  },
  subAvatarLetter: { fontSize: 17, fontWeight: '800' },
  subName: { color: TEXT, fontSize: 19, fontWeight: '800', letterSpacing: -0.3 },
  subTotalRow: { flexDirection: 'row', alignItems: 'baseline', gap: 9, marginTop: 20 },
  subTotalBig: { color: '#CFEEFF', fontSize: 32, fontWeight: '800', letterSpacing: -1, fontVariant: ['tabular-nums'] },
  subTotalUnit: { color: '#9fd8ef', fontSize: 15, fontWeight: '700' },
  subTotalLbl: { color: MUTED, fontSize: 11, fontWeight: '800', letterSpacing: 2 },
  subBar: { flexDirection: 'row', gap: 3, height: 11, marginTop: 16 },
  subItem: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  subIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  subItemName: { color: TEXT, fontSize: 14.5, fontWeight: '700' },
  subItemPct: { color: MUTED, fontSize: 11.5, fontWeight: '600', marginTop: 1 },
  subItemMin: { color: '#E6EDF8', fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  subItemMinUnit: { color: MUTED2, fontSize: 11, fontWeight: '700' },
  subEmpty: { alignItems: 'center', paddingVertical: 44, paddingHorizontal: 20 },
  subEmptyEmoji: { fontSize: 30, marginBottom: 10 },
  subEmptyTxt: { color: MUTED2, fontSize: 13.5, fontWeight: '600', textAlign: 'center', lineHeight: 20 },
});
