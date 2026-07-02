import React, { useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  Modal,
  FlatList,
  ActivityIndicator,
  Pressable,
  Platform,
  TextInput,
  Keyboard,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTimer } from '../../hooks';
import { useSocketStore, useBillingStore } from '../../stores';
import { TimerCircle, StudyReceiptModal, ZenModeModal } from '../../components';
import { PaywallModal } from '../../components/PaywallModal';
import { billingEnabled } from '../../services/billing';
import { timerService, cosmeticsService } from '../../services';
import i18n from '../../i18n';
import { formatDuration } from '../../utils/formatTime';

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATIONS = [5, 15, 25, 45, 60, 90, 120];

// Backend accepts 1–180 minutes (see StartTimerSchema)
const MIN_MIN = 1;
const MAX_MIN = 180;

const ACCENT   = '#00d2ff';
const PAUSE_C  = '#f59e0b';
const DANGER   = '#ef4444';
const BG       = '#0d0d1a';
const CARD     = 'rgba(255,255,255,0.05)';
const CARD_BORDER = 'rgba(255,255,255,0.08)';
const TEXT     = '#e2e8f0';
const MUTED    = '#64748b';

// ─── Component ────────────────────────────────────────────────────────────────

export function TimerScreen() {
  const { t } = useTranslation();
  const timer = useTimer();
  const qc = useQueryClient();
  const [selectedDuration, setSelectedDuration] = useState(25);
  const [subjectModalVisible, setSubjectModalVisible] = useState(false);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | undefined>();
  const [customModalVisible, setCustomModalVisible] = useState(false);
  const [customInput, setCustomInput] = useState('');
  const [receipt, setReceipt] = useState<{
    subjectName?: string;
    durationMinutes: number;
    xpEarned: number;
    streak: number;
  } | null>(null);

  // Zen Mode — Pro-exclusive immersive focus screen
  const isPro = useBillingStore((s) => s.isPro);
  const zenLocked = billingEnabled && !isPro;
  const [zenVisible, setZenVisible] = useState(false);
  const [zenPaywallVisible, setZenPaywallVisible] = useState(false);

  const isCustomDuration = !DURATIONS.includes(selectedDuration);

  const confirmCustomDuration = useCallback(() => {
    const n = parseInt(customInput, 10);
    if (isNaN(n) || n < MIN_MIN || n > MAX_MIN) {
      Alert.alert(t('timer.invalidDuration'), t('timer.invalidDurationMsg', { min: MIN_MIN, max: MAX_MIN }));
      return;
    }
    setSelectedDuration(n);
    setCustomModalVisible(false);
    Keyboard.dismiss();
  }, [customInput]);

  const subjectsQ = useQuery({
    queryKey: ['subjects'],
    queryFn: () => timerService.getSubjects(),
  });

  // Equipped cosmetic frame — shared cache with the Profile shop.
  const framesQ = useQuery({
    queryKey: ['frames'],
    queryFn: () => cosmeticsService.getFrames(),
    staleTime: 60_000,
  });
  const selectedFrame = framesQ.data?.selectedFrame ?? null;
  const subjects = subjectsQ.data ?? [];
  const selectedSubject = subjects.find((s) => s.id === selectedSubjectId);

  // Live global focus count (WebSocket) + today's best for motivation
  const activeCount = useSocketStore((s) => s.activeCount);
  const statsQ = useQuery({
    queryKey: ['timer-stats'],
    queryFn: () => timerService.getStats(),
  });
  const todayMinutes = statsQ.data?.today.totalMinutes ?? 0;

  // Ghost race vs. yesterday-you
  const ghostQ = useQuery({
    queryKey: ['timer-ghost'],
    queryFn: () => timerService.getGhost(),
    refetchInterval: 60_000,
  });
  const ghost = ghostQ.data;

  // ── Handlers ────────────────────────────────────────────────────────────────

  const handleStart = useCallback(async () => {
    try {
      await timer.start(selectedDuration, selectedSubjectId);
    } catch (err: any) {
      if (err?.statusCode === 409) {
        // Server has an active session — sync to restore it, then user can stop it
        Alert.alert(
          t('timer.activeSessionFound'),
          t('timer.activeSessionMsg'),
          [{ text: t('common.ok'), onPress: () => void timer.syncWithServer() }],
        );
      } else {
        Alert.alert(t('common.error'), err?.message ?? t('timer.startFailed'));
      }
    }
  }, [selectedDuration, selectedSubjectId, timer]);

  const handlePause = useCallback(async () => {
    try { await timer.pause(); }
    catch (err: any) {
      Alert.alert(t('timer.pauseError'), err?.message ?? t('timer.pauseErrorMsg'));
    }
  }, [timer]);

  const handleResume = useCallback(async () => {
    try { await timer.resume(); }
    catch (err: any) {
      Alert.alert(t('timer.resumeError'), err?.message ?? t('timer.resumeErrorMsg'));
    }
  }, [timer]);

  const handleZenPress = useCallback(() => {
    if (zenLocked) { setZenPaywallVisible(true); return; }
    setZenVisible(true);
  }, [zenLocked]);

  const handleStop = useCallback(() => {
    Alert.alert(
      t('timer.endSession'),
      t('timer.endSessionMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('timer.end'),
          style: 'destructive',
          onPress: async () => {
            try {
              const result = await timer.stop();
              setZenVisible(false);
              // Refresh anything that depends on the finished session
              qc.invalidateQueries({ queryKey: ['timer-stats'] });
              qc.invalidateQueries({ queryKey: ['timer-ghost'] });
              qc.invalidateQueries({ queryKey: ['subject-stats'] });
              qc.invalidateQueries({ queryKey: ['my-rooms'] });
              qc.invalidateQueries({ queryKey: ['lb-global'] });
              qc.invalidateQueries({ queryKey: ['lb-me'] });
              qc.invalidateQueries({ queryKey: ['lb-friends'] });
              if (result && result.xpEarned > 0) {
                // Celebrate with a shareable Study Receipt
                setReceipt({
                  subjectName: selectedSubject?.name,
                  durationMinutes: result.durationMinutes,
                  xpEarned: result.xpEarned,
                  streak: result.newStreak,
                });
              } else if (result) {
                Alert.alert(
                  t('timer.sessionEnded'),
                  t('timer.sessionEndedMsg', { duration: formatDuration(result.durationMinutes) }),
                );
              }
            } catch (err: any) {
              Alert.alert(
                t('timer.stopError'),
                err?.message ?? t('timer.stopErrorMsg'),
                [
                  { text: t('common.ok'), style: 'cancel' },
                  {
                    text: t('timer.forceReset'),
                    style: 'destructive',
                    onPress: () => timer.syncWithServer(),
                  },
                ],
              );
            }
          },
        },
      ],
    );
  }, [timer, selectedSubject]);

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        bounces={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{t('timer.title')}</Text>
          {timer.isActive && selectedSubject && (
            <View style={styles.subjectTag}>
              <View style={[styles.subjectDot, { backgroundColor: selectedSubject.color ?? ACCENT }]} />
              <Text style={styles.subjectTagText}>{selectedSubject.name}</Text>
            </View>
          )}
        </View>

        {/* ── Timer Circle ── */}
        <View style={styles.circleWrap}>
          <TimerCircle
            progress={timer.progress}
            remainingMs={timer.remainingMs}
            isActive={timer.isActive}
            isPaused={timer.isPaused}
            frameId={selectedFrame}
          />

          {/* Duration badge when idle */}
          {!timer.isActive && (
            <View style={styles.durationBadge}>
              <Text style={styles.durationBadgeText}>{selectedDuration} {t('common.minShort')}</Text>
            </View>
          )}
        </View>

        {/* ── Live motivation layer ── */}
        <View style={styles.motivationWrap}>
          {activeCount > 0 && (
            <View style={styles.liveCountRow}>
              <View style={styles.liveDot} />
              <Text style={styles.liveCountText}>
                {t('timer.peopleFocusing', { count: activeCount })}
              </Text>
            </View>
          )}
          {todayMinutes > 0 && (
            <Text style={styles.bestTodayText}>
              🔥 {t('timer.todayFocus', { duration: formatDuration(todayMinutes) })}
            </Text>
          )}
          {ghost?.hasGhost && (
            <Text style={[styles.ghostText, ghost.diff >= 0 ? styles.ghostAhead : styles.ghostBehind]}>
              👻 {ghost.diff > 0
                ? t('timer.ghostAhead', { duration: formatDuration(ghost.diff) })
                : ghost.diff < 0
                  ? t('timer.ghostBehind', { duration: formatDuration(-ghost.diff) })
                  : t('timer.ghostEven')}
            </Text>
          )}
        </View>

        {/* ── IDLE STATE ── */}
        {!timer.isActive && (
          <View style={styles.idleSection}>

            {/* Duration Row */}
            <Text style={styles.sectionLabel}>{t('timer.duration')}</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.durationRow}
            >
              {DURATIONS.map((d) => {
                const active = d === selectedDuration;
                return (
                  <Pressable
                    key={d}
                    style={({ pressed }) => [
                      styles.durationPill,
                      active && styles.durationPillActive,
                      pressed && { opacity: 0.75 },
                    ]}
                    onPress={() => setSelectedDuration(d)}
                  >
                    <Text style={[styles.durationPillText, active && styles.durationPillTextActive]}>
                      {d < 60 ? `${d}${t('common.minShort')}` : `${d / 60}${t('common.hourShort')}`}
                    </Text>
                  </Pressable>
                );
              })}

              {/* Selected custom value shows as its own active pill */}
              {isCustomDuration && (
                <Pressable
                  style={[styles.durationPill, styles.durationPillActive]}
                  onPress={() => { setCustomInput(String(selectedDuration)); setCustomModalVisible(true); }}
                >
                  <Text style={[styles.durationPillText, styles.durationPillTextActive]}>
                    {selectedDuration}{t('common.minShort')}
                  </Text>
                </Pressable>
              )}

              {/* Custom duration trigger */}
              <Pressable
                style={({ pressed }) => [
                  styles.durationPill,
                  styles.customPill,
                  pressed && { opacity: 0.75 },
                ]}
                onPress={() => { setCustomInput(isCustomDuration ? String(selectedDuration) : ''); setCustomModalVisible(true); }}
              >
                <Text style={styles.customPillText}>{t('timer.custom')}</Text>
              </Pressable>
            </ScrollView>

            {/* Subject Picker */}
            <Text style={[styles.sectionLabel, { marginTop: 20 }]}>{t('timer.subject')}</Text>
            <Pressable
              style={({ pressed }) => [styles.subjectCard, pressed && { opacity: 0.75 }]}
              onPress={() => setSubjectModalVisible(true)}
            >
              <View style={styles.subjectCardLeft}>
                {selectedSubject
                  ? <View style={[styles.subjectDot, { backgroundColor: selectedSubject.color ?? ACCENT, width: 10, height: 10 }]} />
                  : <Text style={styles.subjectIcon}>📚</Text>
                }
                <Text style={[styles.subjectCardText, selectedSubject && { color: TEXT }]}>
                  {selectedSubject ? selectedSubject.name : t('timer.selectSubject')}
                </Text>
              </View>
              <View style={styles.subjectCardRight}>
                {selectedSubjectId
                  ? (
                    <TouchableOpacity
                      onPress={() => setSelectedSubjectId(undefined)}
                      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                    >
                      <Text style={styles.clearBtn}>✕</Text>
                    </TouchableOpacity>
                  )
                  : <Text style={styles.chevron}>›</Text>
                }
              </View>
            </Pressable>

            {/* Start Button */}
            <TouchableOpacity
              style={[styles.startBtn, timer.isLoading && { opacity: 0.6 }]}
              onPress={handleStart}
              disabled={timer.isLoading}
              activeOpacity={0.85}
            >
              {timer.isLoading
                ? <ActivityIndicator color="#000" />
                : (
                  <>
                    <Text style={styles.startBtnIcon}>▶</Text>
                    <Text style={styles.startBtnText}>{t('timer.startSession')}</Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── ACTIVE STATE ── */}
        {timer.isActive && (
          <View style={styles.activeSection}>
            {/* Zen Mode — Pro-exclusive immersive focus screen */}
            <TouchableOpacity style={styles.zenBtn} onPress={handleZenPress} activeOpacity={0.8}>
              <Text style={styles.zenBtnText}>🧘 {t('timer.zenMode')}</Text>
              {zenLocked && (
                <View style={styles.zenProTag}>
                  <Text style={styles.zenProTagText}>👑 PRO</Text>
                </View>
              )}
            </TouchableOpacity>

            {/* Session info strip */}
            <View style={styles.sessionInfo}>
              <InfoChip label={t('timer.duration')} value={`${timer.duration}${t('common.minShort')}`} />
              <View style={styles.infoDivider} />
              <InfoChip
                label={t('timer.elapsed')}
                value={msToMin(timer.elapsedMs)}
              />
              <View style={styles.infoDivider} />
              <InfoChip
                label={t('timer.remaining')}
                value={msToMin(timer.remainingMs)}
                accent={timer.isPaused ? PAUSE_C : ACCENT}
              />
            </View>

            {/* Controls */}
            <View style={styles.controlsRow}>
              {timer.isPaused ? (
                <TouchableOpacity
                  style={[styles.controlBtn, styles.resumeBtn, timer.isLoading && { opacity: 0.6 }]}
                  onPress={handleResume}
                  disabled={timer.isLoading}
                  activeOpacity={0.85}
                >
                  {timer.isLoading
                    ? <ActivityIndicator color="#000" />
                    : <Text style={styles.controlBtnText}>{t('timer.resume')}</Text>
                  }
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  style={[styles.controlBtn, styles.pauseBtn, timer.isLoading && { opacity: 0.6 }]}
                  onPress={handlePause}
                  disabled={timer.isLoading}
                  activeOpacity={0.85}
                >
                  {timer.isLoading
                    ? <ActivityIndicator color={PAUSE_C} />
                    : <Text style={[styles.controlBtnText, { color: PAUSE_C }]}>{t('timer.pause')}</Text>
                  }
                </TouchableOpacity>
              )}

              <TouchableOpacity
                style={[styles.controlBtn, styles.stopBtn]}
                onPress={handleStop}
                activeOpacity={0.85}
              >
                <Text style={[styles.controlBtnText, { color: DANGER }]}>{t('timer.stop')}</Text>
              </TouchableOpacity>
            </View>

            {timer.isPaused && (
              <Text style={styles.pausedHint}>
                {t('timer.pausedHint')}
              </Text>
            )}
          </View>
        )}
      </ScrollView>

      {/* ── Subject Modal ── */}
      <Modal
        visible={subjectModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setSubjectModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('timer.selectSubjectTitle')}</Text>

            {subjectsQ.isLoading
              ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 32 }} />
              : (
                <FlatList
                  data={subjects}
                  keyExtractor={(s) => s.id}
                  renderItem={({ item }) => {
                    const sel = item.id === selectedSubjectId;
                    return (
                      <TouchableOpacity
                        style={[styles.subjectItem, sel && styles.subjectItemSel]}
                        onPress={() => {
                          setSelectedSubjectId(item.id);
                          setSubjectModalVisible(false);
                        }}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.subjectItemDot, { backgroundColor: item.color ?? ACCENT }]} />
                        <Text style={[styles.subjectItemText, sel && { color: ACCENT }]}>{item.name}</Text>
                        {sel && <Text style={styles.checkIcon}>✓</Text>}
                      </TouchableOpacity>
                    );
                  }}
                  ListEmptyComponent={
                    <Text style={styles.emptyText}>{t('timer.noSubjects')}</Text>
                  }
                  style={{ maxHeight: 360 }}
                />
              )
            }

            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setSubjectModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.close')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ── Custom Duration Modal ── */}
      <Modal
        visible={customModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setCustomModalVisible(false)}
      >
        <KeyboardAvoidingView
          style={styles.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        >
          <View style={styles.modalSheet}>
            <View style={styles.modalHandle} />
            <Text style={styles.modalTitle}>{t('timer.customDuration')}</Text>
            <Text style={styles.customHint}>{t('timer.customHint', { min: MIN_MIN, max: MAX_MIN })}</Text>

            <View style={styles.customInputRow}>
              <TextInput
                style={styles.customInput}
                value={customInput}
                onChangeText={(val) => setCustomInput(val.replace(/[^0-9]/g, ''))}
                keyboardType="numeric"
                placeholder={t('timer.customPlaceholder')}
                placeholderTextColor={MUTED}
                selectionColor={ACCENT}
                cursorColor={ACCENT}
                keyboardAppearance="dark"
                maxLength={3}
                autoFocus
                onSubmitEditing={confirmCustomDuration}
                returnKeyType="done"
              />
              <Text style={styles.customInputUnit}>{t('timer.minutesUnit')}</Text>
            </View>

            <TouchableOpacity style={styles.customConfirmBtn} onPress={confirmCustomDuration}>
              <Text style={styles.customConfirmText}>{t('timer.confirm')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalCancelBtn}
              onPress={() => setCustomModalVisible(false)}
            >
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* ── Study Receipt (shareable) ── */}
      {receipt && (
        <StudyReceiptModal
          visible={!!receipt}
          onClose={() => setReceipt(null)}
          subjectName={receipt.subjectName}
          durationMinutes={receipt.durationMinutes}
          xpEarned={receipt.xpEarned}
          streak={receipt.streak}
        />
      )}

      {/* ── Zen Mode (Pro) ── */}
      <ZenModeModal
        visible={zenVisible && timer.isActive}
        onClose={() => setZenVisible(false)}
        remainingMs={timer.remainingMs}
        progress={timer.progress}
        isPaused={timer.isPaused}
        isLoading={timer.isLoading}
        subjectName={selectedSubject?.name}
        frameId={selectedFrame}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
      />

      <PaywallModal
        visible={zenPaywallVisible}
        onClose={() => setZenPaywallVisible(false)}
        source="zen_mode"
      />
    </View>
  );
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function msToMin(ms: number) {
  const min = i18n.t('common.minShort');
  const hr = i18n.t('common.hourShort');
  const total = Math.ceil(ms / 60000);
  if (total < 60) return `${total}${min}`;
  const h = Math.floor(total / 60);
  const m = total % 60;
  return m > 0 ? `${h}${hr} ${m}${min}` : `${h}${hr}`;
}

function InfoChip({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <View style={infoStyles.wrap}>
      <Text style={infoStyles.label}>{label}</Text>
      <Text style={[infoStyles.value, accent ? { color: accent } : null]}>{value}</Text>
    </View>
  );
}

const infoStyles = StyleSheet.create({
  wrap: { alignItems: 'center', flex: 1 },
  label: { fontSize: 10, fontWeight: '700', letterSpacing: 1.5, color: MUTED, marginBottom: 4 },
  value: { fontSize: 16, fontWeight: '700', color: TEXT },
});

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },

  scroll: {
    paddingBottom: 60,
  },

  // Header
  header: {
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 16 : 24,
    paddingBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: TEXT,
    letterSpacing: -0.3,
  },
  subjectTag: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    paddingHorizontal: 12,
    paddingVertical: 6,
    gap: 6,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  subjectTagText: { fontSize: 12, color: TEXT, fontWeight: '600' },

  // Circle
  circleWrap: {
    alignItems: 'center',
    marginTop: 24,
    marginBottom: 8,
  },
  durationBadge: {
    marginTop: 12,
    paddingHorizontal: 20,
    paddingVertical: 8,
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  durationBadgeText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: 0.5,
  },

  // Live motivation layer
  motivationWrap: {
    alignItems: 'center',
    marginTop: 4,
    marginBottom: 8,
    gap: 8,
  },
  liveCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(0,210,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(0,210,255,0.25)',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 7,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#22c55e',
  },
  liveCountText: {
    color: ACCENT,
    fontSize: 13,
    fontWeight: '600',
  },
  bestTodayText: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
  },
  ghostText: {
    fontSize: 13,
    fontWeight: '700',
  },
  ghostAhead: { color: '#22c55e' },
  ghostBehind: { color: '#f59e0b' },

  // Section label
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 10,
  },

  // ── IDLE ──
  idleSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
  },

  durationRow: {
    gap: 8,
    paddingRight: 24,
  },
  durationPill: {
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 30,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  durationPillActive: {
    backgroundColor: `${ACCENT}22`,
    borderColor: ACCENT,
  },
  durationPillText: {
    color: MUTED,
    fontSize: 14,
    fontWeight: '600',
  },
  durationPillTextActive: {
    color: ACCENT,
  },
  customPill: {
    borderStyle: 'dashed',
    borderColor: `${ACCENT}66`,
  },
  customPillText: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '600',
  },

  subjectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    marginBottom: 4,
  },
  subjectCardLeft: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  subjectCardRight: { padding: 4 },
  subjectIcon: { fontSize: 16 },
  subjectDot: { width: 8, height: 8, borderRadius: 4 },
  subjectCardText: { color: MUTED, fontSize: 15, fontWeight: '500' },
  clearBtn: { color: DANGER, fontSize: 15, fontWeight: '700', paddingHorizontal: 4 },
  chevron: { color: MUTED, fontSize: 20, fontWeight: '300' },

  startBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginTop: 28,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 18,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  startBtnIcon: { fontSize: 18, color: '#000' },
  startBtnText: { fontSize: 17, fontWeight: '800', color: '#000', letterSpacing: 0.3 },

  // ── ACTIVE ──
  activeSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 20,
  },

  zenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(139,92,246,0.10)',
    borderWidth: 1,
    borderColor: 'rgba(139,92,246,0.35)',
  },
  zenBtnText: {
    color: '#a78bfa',
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
  zenProTag: {
    backgroundColor: 'rgba(245,158,11,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245,158,11,0.4)',
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  zenProTagText: {
    color: '#f59e0b',
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.5,
  },

  sessionInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    paddingVertical: 18,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  infoDivider: {
    width: 1,
    height: 32,
    backgroundColor: CARD_BORDER,
  },

  controlsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  controlBtn: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  pauseBtn: {
    backgroundColor: `${PAUSE_C}12`,
    borderColor: `${PAUSE_C}40`,
  },
  resumeBtn: {
    backgroundColor: ACCENT,
    borderColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  stopBtn: {
    backgroundColor: `${DANGER}12`,
    borderColor: `${DANGER}40`,
    flex: 0,
    paddingHorizontal: 24,
  },
  controlBtnText: {
    fontSize: 15,
    fontWeight: '700',
    color: '#000',
    letterSpacing: 0.3,
  },

  pausedHint: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 13,
    lineHeight: 20,
    marginTop: -4,
  },

  // ── Modal ──
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'flex-end',
  },
  modalSheet: {
    backgroundColor: '#131325',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    paddingBottom: Platform.OS === 'ios' ? 44 : 28,
    borderTopWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    color: TEXT,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 16,
  },
  subjectItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: CARD_BORDER,
    gap: 12,
  },
  subjectItemSel: {
    backgroundColor: `${ACCENT}0a`,
  },
  subjectItemDot: { width: 10, height: 10, borderRadius: 5 },
  subjectItemText: { flex: 1, color: TEXT, fontSize: 15 },
  checkIcon: { color: ACCENT, fontSize: 16, fontWeight: '700' },
  emptyText: { color: MUTED, textAlign: 'center', marginVertical: 24, fontSize: 14 },

  modalCancelBtn: {
    marginTop: 16,
    paddingVertical: 15,
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  modalCancelText: { color: MUTED, fontSize: 15, fontWeight: '600' },

  // ── Custom duration modal ──
  customHint: { color: MUTED, fontSize: 13, marginBottom: 16 },
  customInputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingHorizontal: 16,
  },
  customInput: {
    flex: 1,
    color: TEXT,
    fontSize: 28,
    fontWeight: '800',
    paddingVertical: 14,
  },
  customInputUnit: { color: MUTED, fontSize: 15, fontWeight: '600' },
  customConfirmBtn: {
    marginTop: 20,
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  customConfirmText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
