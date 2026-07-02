import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Pressable,
  Alert,
  RefreshControl,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useAuth } from '../../hooks';
import { StatCard, StreakHeatmap, StudyDnaCard } from '../../components';
import { PaywallModal } from '../../components/PaywallModal';
import { CoinShopModal } from '../../components/CoinShopModal';
import { billingEnabled } from '../../services/billing';
import { useBillingStore } from '../../stores';
import { timerService, achievementsService, roomsService, cosmeticsService } from '../../services';
import { FRAMES, getFrameVisual } from '../../constants';
import i18n from '../../i18n';
import { formatDuration } from '../../utils/formatTime';
import type { SubjectStat, FrameEntry } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const BG      = '#0d0d1a';
const CARD    = '#131325';
const CARD2   = 'rgba(255,255,255,0.04)';
const BORDER  = 'rgba(255,255,255,0.08)';
const ACCENT  = '#00d2ff';
const DANGER  = '#ef4444';
const TEXT    = '#e2e8f0';
const MUTED   = '#64748b';
const MUTED2  = '#94a3b8';

const SUBJECT_COLORS = [
  '#00d2ff', '#ef4444', '#f59e0b', '#10b981',
  '#8b5cf6', '#ec4899', '#f97316', '#14b8a6',
  '#6366f1', '#84cc16', '#fb7185', '#a78bfa',
];

const SUBJECT_ICONS = ['📚', '💻', '🔬', '🎨', '🏃', '🎵', '🗣️', '✏️', '📊', '🏆', '🌍', '🧪'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function fmtMinutes(m: number): string {
  if (m === 0) return '—';
  const min = i18n.t('common.minShort');
  const hr = i18n.t('common.hourShort');
  if (m < 60) return `${m}${min}`;
  const h = Math.floor(m / 60);
  const rem = m % 60;
  return rem > 0 ? `${h}${hr} ${rem}${min}` : `${h}${hr}`;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function ProfileScreen() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const queryClient = useQueryClient();

  // ── Queries ──────────────────────────────────────────────────────────────────

  const statsQ = useQuery({
    queryKey: ['timer-stats'],
    queryFn: () => timerService.getStats(),
  });

  const achievQ = useQuery({
    queryKey: ['achievements'],
    queryFn: () => achievementsService.mine(),
  });

  const subjectStatsQ = useQuery({
    queryKey: ['subject-stats'],
    queryFn: () => timerService.getSubjectStats(),
  });

  const heatmapQ = useQuery({
    queryKey: ['timer-heatmap'],
    queryFn: () => timerService.getHeatmap(30),
  });

  const myRoomsQ = useQuery({
    queryKey: ['my-rooms'],
    queryFn: () => roomsService.mine(),
  });

  // Rooms the user owns (these carry the invite code)
  const ownedRooms = (myRoomsQ.data ?? []).filter((r) => r.ownerId === user?.id);

  const stats    = statsQ.data;
  const earned   = achievQ.data?.earned  ?? [];
  const locked   = achievQ.data?.locked  ?? [];
  const subjects: SubjectStat[] = subjectStatsQ.data?.subjects ?? [];

  // ── Modal state ───────────────────────────────────────────────────────────────

  const [modalVisible,   setModalVisible]   = useState(false);
  const [paywallVisible, setPaywallVisible] = useState(false);
  const [paywallSource,  setPaywallSource]  = useState('profile');
  const isPro = useBillingStore((s) => s.isPro);
  const [editingId,      setEditingId]      = useState<string | null>(null);
  const [subjectName,    setSubjectName]    = useState('');
  const [selectedColor,  setSelectedColor]  = useState(SUBJECT_COLORS[0]);
  const [selectedIcon,   setSelectedIcon]   = useState(SUBJECT_ICONS[0]);

  // ── Mutations ─────────────────────────────────────────────────────────────────

  const invalidateSubjects = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['subject-stats'] });
    queryClient.invalidateQueries({ queryKey: ['subjects'] }); // keep Timer list in sync
  }, [queryClient]);

  const createMut = useMutation({
    mutationFn: (body: { name: string; color: string; icon: string }) =>
      timerService.createSubject({ ...body, daily_goal_minutes: 60 }),
    onSuccess: () => { invalidateSubjects(); closeModal(); },
    onError:   (e: any) => {
      // 402 = free-plan subject cap reached → offer Pro instead of an error.
      if (e?.statusCode === 402) { closeModal(); setPaywallSource('subject_limit'); setPaywallVisible(true); return; }
      Alert.alert(t('common.error'), e?.message ?? t('profile.subjectAddFailed'));
    },
  });

  const updateMut = useMutation({
    mutationFn: ({ id, body }: { id: string; body: { name: string; color: string; icon: string } }) =>
      timerService.updateSubject(id, body),
    onSuccess: () => { invalidateSubjects(); closeModal(); },
    onError:   (e: any) => Alert.alert(t('common.error'), e?.message ?? t('profile.subjectUpdateFailed')),
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => timerService.deleteSubject(id),
    onSuccess:  invalidateSubjects,
    onError:    (e: any) => Alert.alert(t('common.error'), e?.message ?? t('profile.subjectDeleteFailed')),
  });

  // ── Handlers ─────────────────────────────────────────────────────────────────

  const openAdd = useCallback(() => {
    setEditingId(null);
    setSubjectName('');
    setSelectedColor(SUBJECT_COLORS[0]);
    setSelectedIcon(SUBJECT_ICONS[0]);
    setModalVisible(true);
  }, []);

  const openEdit = useCallback((s: SubjectStat) => {
    setEditingId(s.id);
    setSubjectName(s.name);
    setSelectedColor(SUBJECT_COLORS.includes(s.color) ? s.color : SUBJECT_COLORS[0]);
    setSelectedIcon(SUBJECT_ICONS.includes(s.icon) ? s.icon : SUBJECT_ICONS[0]);
    setModalVisible(true);
  }, []);

  const closeModal = useCallback(() => setModalVisible(false), []);

  const handleSave = useCallback(() => {
    const trimmed = subjectName.trim();
    if (!trimmed) { Alert.alert(t('common.warning'), t('profile.subjectNameEmpty')); return; }
    const body = { name: trimmed, color: selectedColor, icon: selectedIcon };
    if (editingId) {
      updateMut.mutate({ id: editingId, body });
    } else {
      createMut.mutate(body);
    }
  }, [subjectName, selectedColor, selectedIcon, editingId]);

  const handleDelete = useCallback((s: SubjectStat) => {
    Alert.alert(
      t('profile.deleteSubject'),
      t('profile.deleteSubjectMsg', { name: s.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('common.delete'), style: 'destructive', onPress: () => deleteMut.mutate(s.id) },
      ],
    );
  }, []);

  const handleLogout = () => {
    Alert.alert(
      t('profile.signOut'),
      t('profile.signOutConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('profile.signOut'), style: 'destructive', onPress: () => logout() },
      ],
    );
  };

  // ── Derived ───────────────────────────────────────────────────────────────────

  // XP/level/streak come from stats.allTime (live DB) — the authStore `user`
  // is only set at login and goes stale after earning XP.
  const at = stats?.allTime;
  const xp            = at?.xp ?? 0;
  const level         = at?.level ?? user?.level ?? 1;
  const streak        = at?.streak ?? 0;
  const longestStreak = at?.longestStreak ?? 0;
  const levelProgress = (xp % 500) / 500;
  const xpToNext      = 500 - (xp % 500);
  const avgMinutes    = at && at.totalSessions > 0 ? Math.round(at.totalMinutes / at.totalSessions) : 0;
  const maxMinutes    = subjects.reduce((m, s) => Math.max(m, s.totalMinutes), 1);
  const isSaving      = createMut.isPending || updateMut.isPending;

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <>
      <ScrollView
        style={styles.root}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={statsQ.isFetching || achievQ.isFetching || subjectStatsQ.isFetching}
            onRefresh={() => {
              statsQ.refetch();
              achievQ.refetch();
              subjectStatsQ.refetch();
              heatmapQ.refetch();
            }}
            tintColor={ACCENT}
          />
        }
      >

        {/* ── Profile Card ── */}
        <View style={styles.profileCard}>
          <View style={styles.avatarRing}>
            <Text style={styles.avatarLetter}>
              {user?.username.charAt(0).toUpperCase() ?? '?'}
            </Text>
          </View>
          <View style={styles.profileInfo}>
            <Text style={styles.username}>{user?.username ?? '—'}</Text>
            <Text style={styles.email}>{user?.email ?? ''}</Text>
          </View>
          <View style={styles.levelBadge}>
            <Text style={styles.levelText}>{t('profile.level', { level })}</Text>
          </View>
        </View>

        {/* ── XP Bar ── */}
        <View style={styles.xpCard}>
          <View style={styles.xpRow}>
            <View>
              <Text style={styles.xpAmount}>{xp.toLocaleString()} XP</Text>
              <Text style={styles.xpSub}>{t('profile.levelN', { level })}</Text>
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.xpAmount}>{xpToNext} XP</Text>
              <Text style={styles.xpSub}>{t('profile.nextLevel')}</Text>
            </View>
          </View>
          <View style={styles.xpTrack}>
            <View style={[styles.xpFill, { width: `${levelProgress * 100}%` }]} />
          </View>
          <View style={styles.streakRow}>
            <Text style={styles.streakText}>{t('profile.dayStreak', { count: streak })}</Text>
            <Text style={styles.streakText}>{t('profile.longestStreak', { count: longestStreak })}</Text>
          </View>
        </View>

        {/* ── Pro ── */}
        {isPro ? (
          <View style={styles.proActive}>
            <Text style={styles.proActiveText}>👑 {t('pro.activeMember')}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={styles.proCard}
            onPress={() => { setPaywallSource('profile'); setPaywallVisible(true); }}
            activeOpacity={0.85}
          >
            <View style={{ flex: 1 }}>
              <Text style={styles.proTitle}>👑 {t('pro.upgradeTitle')}</Text>
              <Text style={styles.proSub}>{t('pro.upgradeSub')}</Text>
            </View>
            <Text style={styles.proChevron}>›</Text>
          </TouchableOpacity>
        )}

        {/* ── Frame Shop ── */}
        <FrameShopSection />

        {/* ── Streak Heat Map ── */}
        {heatmapQ.data && heatmapQ.data.days.length > 0 && (
          <StreakHeatmap
            days={heatmapQ.data.days}
            currentStreak={heatmapQ.data.currentStreak}
            longestStreak={heatmapQ.data.longestStreak}
          />
        )}

        {/* ── Study DNA ── */}
        <Text style={styles.sectionLabel}>{t('dna.title')}</Text>
        <StudyDnaCard />

        {/* ── Stats Grid ── */}
        <Text style={styles.sectionLabel}>{t('profile.statistics')}</Text>
        <View style={styles.statsGrid}>
          <StatCard
            label={t('profile.totalSessions')}
            value={at?.totalSessions ?? '—'}
            style={styles.statCell}
          />
          <StatCard
            label={t('profile.focusTime')}
            value={at ? formatDuration(at.totalMinutes) : '—'}
            style={styles.statCell}
            accent="#e94560"
          />
          <StatCard
            label={t('profile.completed')}
            value={at?.completedSessions ?? '—'}
            style={styles.statCell}
            accent="#10b981"
          />
          <StatCard
            label={t('profile.avgDuration')}
            value={at ? formatDuration(avgMinutes) : '—'}
            style={styles.statCell}
            accent="#8b5cf6"
          />
        </View>

        {/* ── Konularım ── */}
        <View style={styles.sectionRow}>
          <Text style={styles.sectionLabel}>{t('profile.mySubjects')}</Text>
          <TouchableOpacity style={styles.addButton} onPress={openAdd} activeOpacity={0.75}>
            <Text style={styles.addButtonText}>{t('profile.addShort')}</Text>
          </TouchableOpacity>
        </View>

        {subjectStatsQ.isLoading ? (
          <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
        ) : subjects.length === 0 ? (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>📚</Text>
            <Text style={styles.emptyTitle}>{t('profile.noSubjects')}</Text>
            <Text style={styles.emptyHint}>{t('profile.noSubjectsHint')}</Text>
            <TouchableOpacity style={styles.emptyAddBtn} onPress={openAdd} activeOpacity={0.8}>
              <Text style={styles.emptyAddBtnText}>{t('profile.addFirstSubject')}</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.subjectList}>
            {subjects.map((s) => (
              <SubjectCard
                key={s.id}
                subject={s}
                maxMinutes={maxMinutes}
                onEdit={() => openEdit(s)}
                onDelete={() => handleDelete(s)}
                isDeleting={deleteMut.isPending && (deleteMut.variables as string) === s.id}
              />
            ))}
          </View>
        )}

        {/* ── Achievements ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>
          {t('profile.badges')} {earned.length > 0 ? `${earned.length}/${earned.length + locked.length}` : ''}
        </Text>

        {earned.length > 0 && (
          <View style={styles.badgesRow}>
            {earned.map((b) => {
              const pro = b.badge_type.startsWith('pro_');
              return (
                <View key={b.id} style={[styles.badge, pro && styles.badgePro]}>
                  {pro && <Text style={styles.badgeProTag}>PRO</Text>}
                  <Text style={styles.badgeIcon}>{b.icon}</Text>
                  <Text style={styles.badgeLabel}>{b.label}</Text>
                </View>
              );
            })}
          </View>
        )}

        {locked.length > 0 && (
          <>
            <Text style={styles.lockedLabel}>{t('profile.locked')}</Text>
            <View style={styles.badgesRow}>
              {locked.map((b) => {
                const pro = b.badge_type.startsWith('pro_');
                return (
                  <Pressable
                    key={b.badge_type}
                    style={[styles.badge, pro ? styles.badgeLockedPro : styles.badgeLocked, pro && styles.badgePro]}
                    // Locked Pro badge → sell the subscription
                    onPress={pro && !isPro
                      ? () => { setPaywallSource('pro_badge'); setPaywallVisible(true); }
                      : undefined}
                  >
                    {pro && <Text style={styles.badgeProTag}>PRO</Text>}
                    <Text style={[styles.badgeIcon, { opacity: 0.4 }]}>{pro ? '👑' : '🔒'}</Text>
                    <Text style={[styles.badgeLabel, { color: MUTED }]}>{b.label}</Text>
                    <Text style={styles.badgeDesc}>{b.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </>
        )}

        {earned.length === 0 && locked.length === 0 && (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🏆</Text>
            <Text style={styles.emptyTitle}>{t('profile.noBadges')}</Text>
            <Text style={styles.emptyHint}>{t('profile.noBadgesHint')}</Text>
          </View>
        )}

        {/* ── My Rooms / Invite Codes ── */}
        <Text style={[styles.sectionLabel, { marginTop: 8 }]}>{t('profile.myRooms')}</Text>
        {ownedRooms.length > 0 ? (
          ownedRooms.map((r) => (
            <View key={r.id} style={styles.roomCodeRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.roomCodeName}>🔒 {r.name}</Text>
                <Text style={styles.roomCodeMeta}>👥 {r.memberCount}/{r.maxMembers}</Text>
              </View>
              <View style={styles.roomCodeBox}>
                <Text style={styles.roomCodeLabel}>{t('profile.inviteCode')}</Text>
                <Text style={styles.roomCodeText}>{r.inviteCode ?? '—'}</Text>
              </View>
            </View>
          ))
        ) : (
          <View style={styles.emptyBox}>
            <Text style={styles.emptyIcon}>🚪</Text>
            <Text style={styles.emptyTitle}>{t('profile.noOwnedRooms')}</Text>
            <Text style={styles.emptyHint}>{t('profile.noOwnedRoomsHint')}</Text>
          </View>
        )}

        {/* ── Sign Out ── */}
        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
          <Text style={styles.logoutText}>{t('profile.signOut')}</Text>
        </TouchableOpacity>

      </ScrollView>

      {/* ── Add / Edit Subject Modal ── */}
      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent
        onRequestClose={closeModal}
      >
        <View style={modal.overlay}>
          <View style={modal.sheet}>
            <View style={modal.handle} />

            <Text style={modal.title}>
              {editingId ? t('profile.editSubject') : t('profile.newSubject')}
            </Text>

            {/* Preview */}
            <View style={[modal.preview, { borderColor: `${selectedColor}40` }]}>
              <View style={[modal.previewDot, { backgroundColor: selectedColor }]}>
                <Text style={modal.previewIcon}>{selectedIcon}</Text>
              </View>
              <Text style={modal.previewName} numberOfLines={1}>
                {subjectName.trim() || t('profile.subjectNameDefault')}
              </Text>
            </View>

            {/* Name input */}
            <Text style={modal.label}>{t('profile.subjectName')}</Text>
            <TextInput
              style={modal.input}
              placeholder={t('profile.subjectNamePlaceholder')}
              placeholderTextColor={MUTED}
              value={subjectName}
              onChangeText={setSubjectName}
              maxLength={50}
              returnKeyType="done"
            />

            {/* Icon picker */}
            <Text style={modal.label}>{t('profile.icon')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={modal.iconRow}
            >
              {SUBJECT_ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  style={[
                    modal.iconBtn,
                    selectedIcon === ic && { borderColor: selectedColor, backgroundColor: `${selectedColor}22` },
                  ]}
                  onPress={() => setSelectedIcon(ic)}
                >
                  <Text style={modal.iconText}>{ic}</Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Color picker */}
            <Text style={modal.label}>{t('profile.color')}</Text>
            <View style={modal.colorGrid}>
              {SUBJECT_COLORS.map((c) => (
                <Pressable
                  key={c}
                  style={[modal.colorDot, { backgroundColor: c }]}
                  onPress={() => setSelectedColor(c)}
                >
                  {selectedColor === c && <Text style={modal.colorCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>

            {/* Buttons */}
            <View style={modal.btnRow}>
              <TouchableOpacity style={modal.cancelBtn} onPress={closeModal} activeOpacity={0.75}>
                <Text style={modal.cancelText}>{t('common.cancel')}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  modal.saveBtn,
                  { backgroundColor: selectedColor },
                  (!subjectName.trim() || isSaving) && { opacity: 0.45 },
                ]}
                onPress={handleSave}
                disabled={!subjectName.trim() || isSaving}
                activeOpacity={0.85}
              >
                {isSaving
                  ? <ActivityIndicator color="#fff" size="small" />
                  : <Text style={modal.saveText}>{t('common.save')}</Text>
                }
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      <PaywallModal
        visible={paywallVisible}
        onClose={() => setPaywallVisible(false)}
        source={paywallSource}
      />
    </>
  );
}

// ─── FrameShopSection ─────────────────────────────────────────────────────────
// Coin balance + horizontal frame shop. Frames are bought with coins
// (earned 1:1 with XP) and equip onto the focus timer ring.

function FrameShopSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [coinShopVisible, setCoinShopVisible] = useState(false);
  const [coinShopSource, setCoinShopSource] = useState('shop_chip');
  const [framePaywallVisible, setFramePaywallVisible] = useState(false);

  const framesQ = useQuery({
    queryKey: ['frames'],
    queryFn: () => cosmeticsService.getFrames(),
  });

  const coins = framesQ.data?.coins ?? 0;
  const selected = framesQ.data?.selectedFrame ?? null;

  // Server list drives what's on sale (seasonal frames drop out after their
  // cutoff); before it loads, fall back to the static catalog.
  const serverFrames = framesQ.data?.frames;
  const shopList: FrameEntry[] = serverFrames && serverFrames.length > 0
    ? serverFrames
    : FRAMES.map((v) => ({ id: v.id, price: v.price, owned: false, pro: v.pro }));

  const invalidate = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['frames'] });
  }, [queryClient]);

  // "Not enough coins" → offer the coin IAP when billing is live, plain alert otherwise.
  const showNotEnough = useCallback(() => {
    if (billingEnabled) {
      Alert.alert(t('shop.notEnoughTitle'), t('shop.notEnoughMsg'), [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: `🪙 ${t('coinShop.title')}`,
          onPress: () => { setCoinShopSource('not_enough_coins'); setCoinShopVisible(true); },
        },
      ]);
    } else {
      Alert.alert(t('shop.notEnoughTitle'), t('shop.notEnoughMsg'));
    }
  }, [t]);

  // Buy + auto-equip in one flow — nobody buys a frame not to wear it.
  const buyMut = useMutation({
    mutationFn: async (frameId: string) => {
      await cosmeticsService.buyFrame(frameId);
      await cosmeticsService.selectFrame(frameId);
    },
    onSuccess: invalidate,
    onError: (e: any) => {
      if (e?.statusCode === 402) { showNotEnough(); return; }
      if (e?.statusCode === 409) { invalidate(); return; } // already owned — just refresh
      Alert.alert(t('common.error'), e?.message ?? t('shop.buyFailed'));
    },
  });

  const selectMut = useMutation({
    mutationFn: (frameId: string | null) => cosmeticsService.selectFrame(frameId),
    onSuccess: invalidate,
    onError: (e: any) => Alert.alert(t('common.error'), e?.message ?? t('shop.buyFailed')),
  });

  const isBusy = buyMut.isPending || selectMut.isPending;

  const handlePress = useCallback((frame: FrameEntry) => {
    if (isBusy) return;
    if (selected === frame.id) return; // already equipped
    if (frame.owned) {
      selectMut.mutate(frame.id);
      return;
    }
    if (frame.pro) {
      // Pro-exclusive — sell the subscription, not the frame.
      setFramePaywallVisible(true);
      return;
    }
    if (coins < frame.price) {
      showNotEnough();
      return;
    }
    const name = t(`shop.frames.${frame.id}`);
    Alert.alert(
      t('shop.buyTitle'),
      t('shop.buyMsg', { name, price: frame.price.toLocaleString() }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        { text: t('shop.buy'), onPress: () => buyMut.mutate(frame.id) },
      ],
    );
  }, [isBusy, selected, coins, t, showNotEnough]);

  return (
    <View style={shop.container}>
      <View style={shop.headerRow}>
        <Text style={styles.sectionLabel}>{t('shop.title')}</Text>
        <TouchableOpacity
          style={shop.coinChip}
          onPress={() => {
            if (!billingEnabled) return;
            setCoinShopSource('shop_chip');
            setCoinShopVisible(true);
          }}
          activeOpacity={billingEnabled ? 0.75 : 1}
        >
          <Text style={shop.coinText}>
            🪙 {coins.toLocaleString()}{billingEnabled ? '  +' : ''}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={shop.row}
      >
        {/* Default (no frame) */}
        <Pressable
          style={[shop.card, selected === null && shop.cardSelected]}
          onPress={() => { if (!isBusy && selected !== null) selectMut.mutate(null); }}
        >
          <View style={shop.previewWrap}>
            <View style={[shop.preview, { borderColor: ACCENT }]} />
          </View>
          <Text style={shop.name} numberOfLines={1}>{t('shop.default')}</Text>
          <Text style={[shop.state, selected === null && { color: ACCENT }]}>
            {selected === null ? `✓ ${t('shop.selected')}` : t('shop.select')}
          </Text>
        </Pressable>

        {shopList.map((entry) => {
          const v = getFrameVisual(entry.id);
          if (!v) return null; // unknown id from a newer backend — skip gracefully
          const isSel = selected === entry.id;
          // Seasonal countdown (days left until the frame leaves the shop)
          const daysLeft = entry.availableUntil
            ? Math.max(0, Math.ceil((new Date(entry.availableUntil).getTime() - Date.now()) / 86_400_000))
            : null;
          return (
            <Pressable
              key={entry.id}
              style={[
                shop.card,
                isSel && shop.cardSelected,
                !entry.owned && shop.cardLocked,
                entry.pro && shop.cardPro,
              ]}
              onPress={() => handlePress(entry)}
            >
              {daysLeft !== null && !entry.owned && (
                <View style={shop.seasonBadge}>
                  <Text style={shop.seasonBadgeText}>⏳ {t('shop.daysLeftShort', { count: daysLeft })}</Text>
                </View>
              )}
              <View style={shop.previewWrap}>
                {v.outer2 && <View style={[shop.previewOuter, { borderColor: `${v.outer2}88` }]} />}
                <View style={[shop.preview, { borderColor: v.ring, shadowColor: v.glow }]} />
              </View>
              <Text style={shop.name} numberOfLines={1}>{t(`shop.frames.${entry.id}`)}</Text>
              {isSel ? (
                <Text style={[shop.state, { color: ACCENT }]}>✓ {t('shop.selected')}</Text>
              ) : entry.owned ? (
                <Text style={shop.state}>{t('shop.select')}</Text>
              ) : entry.pro ? (
                <Text style={shop.proTag}>👑 Pro</Text>
              ) : (
                <Text style={[shop.price, coins < entry.price && { color: MUTED }]}>
                  🪙 {entry.price.toLocaleString()}
                </Text>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <Text style={shop.hint}>{t('shop.earnHint')}</Text>

      <CoinShopModal
        visible={coinShopVisible}
        onClose={() => setCoinShopVisible(false)}
        source={coinShopSource}
      />

      <PaywallModal
        visible={framePaywallVisible}
        onClose={() => { setFramePaywallVisible(false); invalidate(); }}
        source="pro_frame"
      />
    </View>
  );
}

// ─── SubjectCard ──────────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  maxMinutes,
  onEdit,
  onDelete,
  isDeleting,
}: {
  subject: SubjectStat;
  maxMinutes: number;
  onEdit: () => void;
  onDelete: () => void;
  isDeleting: boolean;
}) {
  const { t } = useTranslation();
  const pct = maxMinutes > 0 ? Math.min(subject.totalMinutes / maxMinutes, 1) : 0;

  return (
    <View style={subj.card}>
      {/* Color accent bar */}
      <View style={[subj.accent, { backgroundColor: subject.color }]} />

      {/* Icon bubble */}
      <View style={[subj.iconWrap, { backgroundColor: `${subject.color}22` }]}>
        <Text style={subj.icon}>{subject.icon}</Text>
      </View>

      {/* Info */}
      <View style={subj.info}>
        <Text style={subj.name} numberOfLines={1}>{subject.name}</Text>
        <View style={subj.metaRow}>
          <Text style={[subj.time, { color: subject.color }]}>{fmtMinutes(subject.totalMinutes)}</Text>
          {subject.sessionsCount > 0 && (
            <Text style={subj.sessions}> · {t('profile.sessionsUnit', { count: subject.sessionsCount })}</Text>
          )}
        </View>
        {/* Relative progress bar */}
        <View style={subj.track}>
          <View
            style={[
              subj.fill,
              { width: `${pct * 100}%`, backgroundColor: subject.color },
            ]}
          />
        </View>
      </View>

      {/* Actions */}
      <View style={subj.actions}>
        <TouchableOpacity
          onPress={onEdit}
          style={subj.actionBtn}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 6 }}
        >
          <Text style={subj.editIcon}>✏️</Text>
        </TouchableOpacity>
        {isDeleting
          ? <ActivityIndicator size="small" color={DANGER} style={{ marginTop: 4 }} />
          : (
            <TouchableOpacity
              onPress={onDelete}
              style={subj.actionBtn}
              hitSlop={{ top: 6, bottom: 10, left: 10, right: 6 }}
            >
              <Text style={subj.deleteIcon}>🗑</Text>
            </TouchableOpacity>
          )
        }
      </View>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  content: {
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 56,
  },

  // Profile card
  profileCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 18,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  avatarRing: {
    width: 60,
    height: 60,
    borderRadius: 30,
    backgroundColor: `${ACCENT}22`,
    borderWidth: 2,
    borderColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarLetter: { color: ACCENT, fontSize: 24, fontWeight: '800' },
  profileInfo: { flex: 1 },
  username: { color: TEXT, fontSize: 18, fontWeight: '700' },
  email: { color: MUTED, fontSize: 12, marginTop: 2 },
  levelBadge: {
    backgroundColor: `${ACCENT}22`,
    borderRadius: 20,
    paddingHorizontal: 12,
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
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  xpRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  xpAmount: { color: TEXT, fontSize: 16, fontWeight: '700' },
  xpSub: { color: MUTED, fontSize: 11, marginTop: 2 },
  xpTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 12,
  },
  xpFill: {
    height: '100%',
    backgroundColor: ACCENT,
    borderRadius: 3,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius: 6,
  },
  streakRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  streakText: { color: MUTED2, fontSize: 12 },

  // Pro upsell
  proCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 16,
    padding: 18,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
  },
  proTitle: { color: '#f59e0b', fontSize: 16, fontWeight: '800' },
  proSub: { color: MUTED2, fontSize: 12, marginTop: 3 },
  proChevron: { color: '#f59e0b', fontSize: 28, fontWeight: '300', marginLeft: 8 },
  proActive: {
    backgroundColor: 'rgba(245,158,11,0.10)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.45)',
    alignItems: 'center',
  },
  proActiveText: { color: '#f59e0b', fontSize: 15, fontWeight: '800' },

  // Section labels & rows
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 12,
  },
  sectionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: `${ACCENT}18`,
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  addButtonText: { color: ACCENT, fontSize: 13, fontWeight: '700' },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 28,
  },
  statCell: { width: '47.5%' },

  // Subjects list
  subjectList: { marginBottom: 28 },

  // Empty state
  emptyBox: {
    backgroundColor: CARD2,
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 28,
  },
  emptyIcon: { fontSize: 36, marginBottom: 10 },
  emptyTitle: { color: TEXT, fontSize: 16, fontWeight: '600', marginBottom: 6 },
  emptyHint: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 19 },
  emptyAddBtn: {
    marginTop: 18,
    backgroundColor: `${ACCENT}18`,
    borderRadius: 20,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  emptyAddBtnText: { color: ACCENT, fontWeight: '700', fontSize: 14 },

  // Badges
  badgesRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 16,
  },
  badge: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 14,
    alignItems: 'center',
    width: 86,
    borderWidth: 1,
    borderColor: BORDER,
  },
  badgeLocked: { opacity: 0.4 },
  badgeLockedPro: { opacity: 0.65 },
  badgePro: {
    borderColor: 'rgba(245,158,11,0.45)',
    backgroundColor: 'rgba(245,158,11,0.06)',
  },
  badgeProTag: {
    position: 'absolute',
    top: 5,
    right: 7,
    color: '#f59e0b',
    fontSize: 8,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  badgeIcon: { fontSize: 28, marginBottom: 6 },
  badgeLabel: { color: TEXT, fontSize: 10, textAlign: 'center', fontWeight: '600' },
  badgeDesc: { color: MUTED, fontSize: 9, textAlign: 'center', marginTop: 3 },
  lockedLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 2,
    textTransform: 'uppercase',
    marginBottom: 10,
  },

  // Room invite codes
  roomCodeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
    gap: 12,
  },
  roomCodeName: { color: TEXT, fontSize: 15, fontWeight: '700' },
  roomCodeMeta: { color: MUTED2, fontSize: 12, marginTop: 3 },
  roomCodeBox: {
    backgroundColor: `${ACCENT}14`,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    alignItems: 'center',
  },
  roomCodeLabel: { color: MUTED, fontSize: 9, fontWeight: '700', letterSpacing: 1 },
  roomCodeText: { color: ACCENT, fontSize: 18, fontWeight: '800', letterSpacing: 3, marginTop: 2 },

  // Logout
  logoutBtn: {
    marginTop: 8,
    backgroundColor: `${DANGER}12`,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${DANGER}40`,
  },
  logoutText: { color: DANGER, fontSize: 15, fontWeight: '700' },
});

// ─── SubjectCard Styles ───────────────────────────────────────────────────────

const subj = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    marginBottom: 10,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: BORDER,
    paddingRight: 14,
  },
  accent: {
    width: 4,
    alignSelf: 'stretch',
  },
  iconWrap: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: 12,
  },
  icon: { fontSize: 22 },
  info: {
    flex: 1,
    paddingVertical: 14,
    paddingRight: 8,
  },
  name: {
    color: TEXT,
    fontSize: 15,
    fontWeight: '600',
    marginBottom: 3,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 7,
  },
  time: {
    fontSize: 13,
    fontWeight: '700',
  },
  sessions: {
    color: MUTED,
    fontSize: 12,
  },
  track: {
    height: 3,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
    opacity: 0.75,
  },
  actions: {
    flexDirection: 'column',
    alignItems: 'center',
    gap: 6,
  },
  actionBtn: { padding: 4 },
  editIcon: { fontSize: 17 },
  deleteIcon: { fontSize: 17 },
});

// ─── Frame Shop Styles ────────────────────────────────────────────────────────

const shop = StyleSheet.create({
  container: { marginBottom: 24 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  coinChip: {
    backgroundColor: 'rgba(255,215,0,0.10)',
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderWidth: 1,
    borderColor: 'rgba(255,215,0,0.35)',
    marginBottom: 12,
  },
  coinText: { color: '#ffd700', fontSize: 13, fontWeight: '800' },
  row: { gap: 10, paddingVertical: 4 },
  card: {
    width: 96,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  cardSelected: { borderColor: ACCENT, backgroundColor: `${ACCENT}0d` },
  cardLocked: { opacity: 0.75 },
  cardPro: { borderColor: 'rgba(245,158,11,0.45)', backgroundColor: 'rgba(245,158,11,0.06)', opacity: 1 },
  previewWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  previewOuter: {
    position: 'absolute',
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 1.5,
  },
  preview: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 3.5,
    backgroundColor: 'rgba(255,255,255,0.03)',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 8,
    elevation: 6,
  },
  name: { color: TEXT, fontSize: 12, fontWeight: '700', marginBottom: 4 },
  state: { color: MUTED2, fontSize: 11, fontWeight: '600' },
  price: { color: '#ffd700', fontSize: 11, fontWeight: '800' },
  proTag: { color: '#f59e0b', fontSize: 11, fontWeight: '800' },
  seasonBadge: {
    position: 'absolute',
    top: -8,
    right: 6,
    backgroundColor: '#ff6b1a',
    borderRadius: 9,
    paddingHorizontal: 7,
    paddingVertical: 2,
    zIndex: 1,
  },
  seasonBadgeText: { color: '#fff', fontSize: 9, fontWeight: '800' },
  hint: { color: MUTED, fontSize: 11, marginTop: 10 },
});

// ─── Modal Styles ─────────────────────────────────────────────────────────────

const modal = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: '#131325',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 48 : 32,
    borderTopWidth: 1,
    borderColor: BORDER,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  title: {
    color: TEXT,
    fontSize: 20,
    fontWeight: '700',
    marginBottom: 20,
  },

  // Preview
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    borderWidth: 1,
  },
  previewDot: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewIcon: { fontSize: 22 },
  previewName: { color: TEXT, fontSize: 16, fontWeight: '600', flex: 1 },

  // Fields
  label: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 8,
  },
  input: {
    backgroundColor: CARD2,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    color: TEXT,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 20,
  },

  // Icon row
  iconRow: {
    gap: 8,
    marginBottom: 20,
    paddingBottom: 4,
  },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: CARD2,
  },
  iconText: { fontSize: 22 },

  // Color grid
  colorGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 24,
  },
  colorDot: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  colorCheck: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '800',
    textShadowColor: 'rgba(0,0,0,0.4)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },

  // Buttons
  btnRow: {
    flexDirection: 'row',
    gap: 12,
  },
  cancelBtn: {
    flex: 1,
    paddingVertical: 16,
    alignItems: 'center',
    backgroundColor: CARD2,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
  },
  cancelText: { color: MUTED2, fontSize: 15, fontWeight: '600' },
  saveBtn: {
    flex: 2,
    paddingVertical: 16,
    alignItems: 'center',
    borderRadius: 14,
  },
  saveText: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
