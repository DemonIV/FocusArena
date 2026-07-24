import React, { useState, useCallback, useEffect, useRef } from 'react';
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
  Switch,
  Vibration,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useTimer } from '../../hooks';
import {
  useSocketStore,
  useBillingStore,
  useTimerStore,
  usePomodoroStore,
  useSettingsStore,
  POMODORO_PRESETS,
  ROUNDS_PER_CYCLE,
} from '../../stores';
import { TimerCircle, StudyReceiptModal, ZenModeModal } from '../../components';
import { PaywallModal } from '../../components/PaywallModal';
import { billingEnabled } from '../../services/billing';
import {
  timerService,
  cosmeticsService,
  maybeRequestReview,
  scheduleLocalNotification,
  cancelScheduledNotification,
  dismissPomodoroNotifications,
} from '../../services';
import i18n from '../../i18n';
import { formatDuration } from '../../utils/formatTime';
import type { FocusScoreBreakdown } from '../../types';

// ─── Constants ────────────────────────────────────────────────────────────────

const DURATIONS = [5, 15, 25, 45, 60, 90, 120];

// Haptic buzz for pomodoro phase transitions (wait, buzz, pause, buzz).
const BUZZ_PATTERN = [0, 300, 200, 300];

// Backend accepts 1–180 minutes (see StartTimerSchema)
const MIN_MIN = 1;
const MAX_MIN = 180;

const ACCENT   = '#00d2ff';
const BREAK_C  = '#10b981';
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
    coinsEarned: number;
    streak: number;
    focus?: FocusScoreBreakdown | null;
  } | null>(null);

  // Zen Mode — Pro-exclusive immersive focus screen
  const isPro = useBillingStore((s) => s.isPro);
  const zenLocked = billingEnabled && !isPro;
  const [zenVisible, setZenVisible] = useState(false);
  const [zenPaywallVisible, setZenPaywallVisible] = useState(false);


  // ── Pomodoro cycle ───────────────────────────────────────────────────────────
  const pomo = usePomodoroStore();
  const preset = POMODORO_PRESETS[pomo.presetId];
  const inPomodoro = pomo.mode === 'pomodoro';
  const [breakRemainingMs, setBreakRemainingMs] = useState(0);
  const sendPresence = useSocketStore((s) => s.sendPresence);

  // Pomodoro auto-advance preferences
  const autoBreak = useSettingsStore((s) => s.pomodoroAutoBreak);
  const setAutoBreak = useSettingsStore((s) => s.setPomodoroAutoBreak);
  const autoFocus = useSettingsStore((s) => s.pomodoroAutoFocus);
  const setAutoFocus = useSettingsStore((s) => s.setPomodoroAutoFocus);

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

  const invalidateAfterStop = useCallback(() => {
    qc.invalidateQueries({ queryKey: ['timer-stats'] });
    qc.invalidateQueries({ queryKey: ['timer-ghost'] });
    qc.invalidateQueries({ queryKey: ['subject-stats'] });
    qc.invalidateQueries({ queryKey: ['my-rooms'] });
    qc.invalidateQueries({ queryKey: ['lb-global'] });
    qc.invalidateQueries({ queryKey: ['lb-me'] });
    qc.invalidateQueries({ queryKey: ['lb-friends'] });
    qc.invalidateQueries({ queryKey: ['frames'] }); // coin balance
    qc.invalidateQueries({ queryKey: ['pets'] });
  }, [qc]);

  // Pre-schedule the "round over / cycle done" notification for the running
  // focus round. JS timers are suspended while the phone is locked, so firing
  // at the moment of completion (the old notifyNow path) silently did nothing
  // there — a notification scheduled at round start is delivered by the OS
  // regardless. Cancelled on pause/manual stop, rescheduled on resume.
  const scheduleRoundEnd = useCallback(async (remainingMs: number) => {
    const p = usePomodoroStore.getState();
    if (p.mode !== 'pomodoro') return;
    if (p.roundNotifId) {
      await cancelScheduledNotification(p.roundNotifId);
      p.setRoundNotifId(null);
    }
    if (remainingMs < 1500) return;
    const last = p.round >= ROUNDS_PER_CYCLE;
    const id = await scheduleLocalNotification(
      remainingMs / 1000,
      i18n.t(last ? 'timer.cycleDoneTitle' : 'timer.roundOverTitle'),
      last
        ? i18n.t('timer.cycleDoneBody')
        : i18n.t('timer.roundOverBody', { min: POMODORO_PRESETS[p.presetId].brk }),
    );
    usePomodoroStore.getState().setRoundNotifId(id);
  }, []);

  // Cancel any pending pomodoro notifications (round-end + break-over) — used
  // wherever the cycle is dropped, so no stale notification fires afterwards.
  const cancelPomodoroNotifs = useCallback(() => {
    const p = usePomodoroStore.getState();
    void cancelScheduledNotification(p.breakNotifId);
    void cancelScheduledNotification(p.roundNotifId);
  }, []);

  // Classic-mode "time's up" notification — same rationale as scheduleRoundEnd:
  // JS timers are suspended while the phone is locked, so the in-app auto-stop
  // can't fire there. Scheduling at start means the OS alerts the user the
  // moment their set duration elapses, even locked. Cancelled on pause/stop/
  // complete; rescheduled with the remaining time on resume.
  const classicNotifId = useRef<string | null>(null);
  const scheduleClassicEnd = useCallback(async (remainingMs: number) => {
    if (usePomodoroStore.getState().mode !== 'classic') return;
    if (classicNotifId.current) {
      await cancelScheduledNotification(classicNotifId.current);
      classicNotifId.current = null;
    }
    if (remainingMs < 1500) return;
    classicNotifId.current = await scheduleLocalNotification(
      remainingMs / 1000,
      i18n.t('timer.sessionDoneTitle'),
      i18n.t('timer.sessionDoneBody', { min: useTimerStore.getState().duration }),
    );
  }, []);
  const cancelClassicEnd = useCallback(() => {
    if (classicNotifId.current) {
      void cancelScheduledNotification(classicNotifId.current);
      classicNotifId.current = null;
    }
  }, []);

  // ── Natural session completion (countdown hit zero) ────────────────────────
  // In a pomodoro cycle: advance the round. In classic mode: celebrate with the
  // receipt (manual stops already do; natural completions used to end silently).
  useEffect(() => {
    useTimerStore.getState().setOnComplete((result) => {
      const p = usePomodoroStore.getState();
      invalidateAfterStop();
      setZenVisible(false);
      cancelClassicEnd(); // completed in-app → drop the pending "time's up" alert
      if (p.mode === 'pomodoro' && p.phase === 'focus') {
        if (result) {
          p.completeRound(
            {
              durationMinutes: result.durationMinutes,
              xpEarned: result.xpEarned,
              coinsEarned: result.coinsEarned ?? 0,
              newStreak: result.newStreak,
            },
            useSettingsStore.getState().pomodoroAutoBreak,
          );
          // Foreground buzz; the round-end notification was scheduled at round
          // start, so the OS delivers it on time even if the phone is locked.
          Vibration.vibrate(BUZZ_PATTERN);
        } else {
          // Session vanished server-side — nothing to continue.
          cancelPomodoroNotifs();
          p.abortCycle();
        }
      } else if (result && result.xpEarned > 0) {
        Vibration.vibrate(BUZZ_PATTERN); // classic session hit its set time
        setReceipt({
          subjectName: selectedSubject?.name,
          durationMinutes: result.durationMinutes,
          xpEarned: result.xpEarned,
          coinsEarned: result.coinsEarned ?? 0,
          streak: result.newStreak,
          focus: result.focus,
        });
      }
    });
    return () => useTimerStore.getState().setOnComplete(null);
  }, [invalidateAfterStop, selectedSubject, cancelPomodoroNotifs, cancelClassicEnd]);

  // ── Recover from an orphaned pomodoro cycle ────────────────────────────────
  // The pomodoro store is persisted. A mid-round "focus" phase means "a session
  // is running" — but after an app reinstall (new build) or an expired session,
  // syncWithServer finds nothing to restore, leaving phase='focus' with no
  // active timer. That combination renders NONE of the screen sections except
  // the empty 00:00 circle. Once we're confident no session exists, drop the
  // orphaned cycle back to idle so the normal timer screen returns.
  useEffect(() => {
    if (!(inPomodoro && pomo.phase === 'focus' && !timer.isActive && !timer.isLoading)) return;
    // Give any in-flight server sync (mount / foreground) time to restore a
    // genuinely active session before we decide the cycle is orphaned.
    const t = setTimeout(() => {
      const stillGone = !useTimerStore.getState().isActive && !useTimerStore.getState().isLoading;
      if (stillGone && usePomodoroStore.getState().phase === 'focus') {
        cancelPomodoroNotifs();
        usePomodoroStore.getState().abortCycle();
      }
    }, 2500);
    return () => clearTimeout(t);
  }, [inPomodoro, pomo.phase, timer.isActive, timer.isLoading, cancelPomodoroNotifs]);

  // ── Break countdown + "break over" local notification ──────────────────────
  useEffect(() => {
    if (pomo.phase !== 'break' || !pomo.breakEndsAt) return;

    // Schedule the notification once per break (survives app relaunch — the
    // persisted breakNotifId guards against double-scheduling).
    if (!pomo.breakNotifId) {
      const secs = (pomo.breakEndsAt - Date.now()) / 1000;
      if (secs > 1) {
        void scheduleLocalNotification(
          secs,
          t('timer.breakOverTitle'),
          t('timer.breakOverBody', { round: pomo.round + 1 }),
        ).then((id) => usePomodoroStore.getState().setBreakNotifId(id));
      }
    }

    sendPresence('break');
    setBreakRemainingMs(Math.max(0, pomo.breakEndsAt - Date.now()));
    const iv = setInterval(() => {
      const endsAt = usePomodoroStore.getState().breakEndsAt;
      const rem = (endsAt ?? 0) - Date.now();
      if (rem <= 0) {
        // Foreground buzz; the scheduled "break over" notification (with its
        // channel vibration) covers the backgrounded case.
        Vibration.vibrate(BUZZ_PATTERN);
        usePomodoroStore.getState().breakOver();
      } else {
        setBreakRemainingMs(rem);
      }
    }, 500);
    return () => clearInterval(iv);
  }, [pomo.phase, pomo.breakEndsAt]);

  const handleStartCycle = useCallback(async () => {
    void dismissPomodoroNotifications();
    pomo.beginCycle();
    try {
      await timer.start(preset.focus, selectedSubjectId);
      void scheduleRoundEnd(preset.focus * 60_000);
    } catch (err: any) {
      usePomodoroStore.getState().abortCycle();
      if (err?.statusCode === 409) {
        Alert.alert(
          t('timer.activeSessionFound'),
          t('timer.activeSessionMsg'),
          [{ text: t('common.ok'), onPress: () => void timer.syncWithServer() }],
        );
      } else {
        Alert.alert(t('common.error'), err?.message ?? t('timer.startFailed'));
      }
    }
  }, [pomo, preset.focus, selectedSubjectId, timer, t, scheduleRoundEnd]);

  const startNextRound = useCallback(async () => {
    void dismissPomodoroNotifications();
    await timer.start(preset.focus, selectedSubjectId);
    usePomodoroStore.getState().startedNextRound();
    void scheduleRoundEnd(preset.focus * 60_000);
  }, [preset.focus, selectedSubjectId, timer, scheduleRoundEnd]);

  const handleStartNextRound = useCallback(async () => {
    try {
      await startNextRound();
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('timer.startFailed'));
    }
  }, [startNextRound, t]);

  const handleSkipBreak = useCallback(() => {
    void cancelScheduledNotification(usePomodoroStore.getState().breakNotifId);
    void dismissPomodoroNotifications();
    usePomodoroStore.getState().skipBreak();
  }, []);

  const handleStartBreak = useCallback(() => {
    void dismissPomodoroNotifications();
    usePomodoroStore.getState().startBreak();
  }, []);

  // Auto-start the next focus round when the break ends, if the user opted in.
  // The first attempt often runs right after the app returns to the foreground
  // (break-over notification tap) where the network isn't up yet — so failures
  // retry silently before bothering the user with an alert. The busy ref keeps
  // re-renders (isLoading toggles) from spawning a second attempt chain.
  const autoStartBusy = useRef(false);
  useEffect(() => {
    if (!inPomodoro || pomo.phase !== 'awaitNext' || !autoFocus) return;
    if (timer.isActive || timer.isLoading || autoStartBusy.current) return;
    autoStartBusy.current = true;
    const attempt = async (n: number): Promise<void> => {
      // Re-check the world before each try — the user may have started the
      // round manually, left the cycle, or turned auto-start off while we
      // waited to retry.
      const ts = useTimerStore.getState();
      if (
        usePomodoroStore.getState().phase !== 'awaitNext' ||
        !useSettingsStore.getState().pomodoroAutoFocus ||
        ts.isActive || ts.isLoading
      ) {
        autoStartBusy.current = false;
        return;
      }
      try {
        await startNextRound();
        autoStartBusy.current = false;
      } catch (err: any) {
        if (err?.statusCode === 409) {
          // A session already exists server-side — restore it instead of retrying.
          autoStartBusy.current = false;
          void timer.syncWithServer();
        } else if (n < 3) {
          setTimeout(() => void attempt(n + 1), 2000);
        } else {
          autoStartBusy.current = false;
          Alert.alert(t('common.error'), err?.message ?? t('timer.startFailed'));
        }
      }
    };
    void attempt(1);
  }, [inPomodoro, pomo.phase, autoFocus, timer.isActive, timer.isLoading, startNextRound, timer, t]);

  const handleExitCycle = useCallback(() => {
    Alert.alert(
      t('timer.exitCycleTitle'),
      t('timer.exitCycleMsg'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('timer.exitCycle'),
          style: 'destructive',
          onPress: () => {
            cancelPomodoroNotifs();
            usePomodoroStore.getState().abortCycle();
            sendPresence('offline');
          },
        },
      ],
    );
  }, [t, sendPresence, cancelPomodoroNotifs]);


  const handleStart = useCallback(async () => {
    void dismissPomodoroNotifications();
    try {
      await timer.start(selectedDuration, selectedSubjectId);
      void scheduleClassicEnd(selectedDuration * 60_000);
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
  }, [selectedDuration, selectedSubjectId, timer, scheduleClassicEnd]);

  const handlePause = useCallback(async () => {
    try {
      await timer.pause();
      // A paused round no longer ends at the scheduled time — cancel the
      // round-end notification; resume reschedules it with the new remaining.
      const p = usePomodoroStore.getState();
      if (p.mode === 'pomodoro' && p.phase === 'focus' && p.roundNotifId) {
        void cancelScheduledNotification(p.roundNotifId);
        p.setRoundNotifId(null);
      } else if (p.mode === 'classic') {
        cancelClassicEnd();
      }
    } catch (err: any) {
      Alert.alert(t('timer.pauseError'), err?.message ?? t('timer.pauseErrorMsg'));
    }
  }, [timer, cancelClassicEnd]);

  const handleResume = useCallback(async () => {
    try {
      await timer.resume();
      const p = usePomodoroStore.getState();
      if (p.mode === 'pomodoro' && p.phase === 'focus') {
        void scheduleRoundEnd(useTimerStore.getState().remainingMs);
      } else if (p.mode === 'classic') {
        void scheduleClassicEnd(useTimerStore.getState().remainingMs);
      }
    } catch (err: any) {
      Alert.alert(t('timer.resumeError'), err?.message ?? t('timer.resumeErrorMsg'));
    }
  }, [timer, scheduleRoundEnd, scheduleClassicEnd]);

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
              // A manual stop drops any pending completion notification
              cancelClassicEnd();
              // A manual stop mid-cycle drops the pomodoro cycle
              cancelPomodoroNotifs();
              usePomodoroStore.getState().abortCycle();
              setZenVisible(false);
              // Refresh anything that depends on the finished session
              invalidateAfterStop();
              if (result && result.xpEarned > 0) {
                // Celebrate with a shareable Study Receipt
                setReceipt({
                  subjectName: selectedSubject?.name,
                  durationMinutes: result.durationMinutes,
                  xpEarned: result.xpEarned,
                  coinsEarned: result.coinsEarned ?? 0,
                  streak: result.newStreak,
                  focus: result.focus,
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
  }, [timer, selectedSubject, invalidateAfterStop, cancelPomodoroNotifs, cancelClassicEnd]);

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

        {/* ── Timer Circle / Break Circle ── */}
        <View style={styles.circleWrap}>
          {inPomodoro && !timer.isActive && pomo.phase === 'break' ? (
            <View style={styles.breakCircle}>
              <Text style={styles.breakTime}>{msToClock(breakRemainingMs)}</Text>
              <View style={styles.breakTagPill}>
                <Text style={styles.breakTagText}>{t('timer.breakTag')}</Text>
              </View>
            </View>
          ) : inPomodoro && !timer.isActive && (pomo.phase === 'awaitNext' || pomo.phase === 'done') ? null : (
            <TimerCircle
              progress={timer.progress}
              remainingMs={timer.remainingMs}
              isActive={timer.isActive}
              isPaused={timer.isPaused}
              frameId={selectedFrame}
              idleMs={(inPomodoro ? preset.focus : selectedDuration) * 60_000}
            />
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
        {!timer.isActive && (!inPomodoro || pomo.phase === 'idle') && (
          <View style={styles.idleSection}>

            {/* Mode: classic single session ↔ pomodoro cycle */}
            <View style={styles.modeSeg}>
              {(['classic', 'pomodoro'] as const).map((m) => {
                const on = pomo.mode === m;
                return (
                  <Pressable
                    key={m}
                    style={[styles.modeSegBtn, on && styles.modeSegBtnOn]}
                    onPress={() => pomo.setMode(m)}
                  >
                    <Text style={[styles.modeSegText, on && styles.modeSegTextOn]}>
                      {m === 'classic' ? t('timer.modeClassic') : `🍅 ${t('timer.modePomodoro')}`}
                    </Text>
                  </Pressable>
                );
              })}
            </View>

            {inPomodoro && (
              <>
                <Text style={styles.sectionLabel}>{t('timer.duration')}</Text>
                <View style={styles.presetRow}>
                  {(['classic', 'deep'] as const).map((id) => {
                    const p = POMODORO_PRESETS[id];
                    const on = pomo.presetId === id;
                    return (
                      <Pressable
                        key={id}
                        style={[styles.durationPill, styles.presetChip, on && styles.durationPillActive]}
                        onPress={() => pomo.setPresetId(id)}
                      >
                        <Text style={[styles.durationPillText, on && styles.durationPillTextActive]}>
                          {p.focus} / {p.brk} · {t(id === 'classic' ? 'timer.presetClassicName' : 'timer.presetDeepName')}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>
                <RoundDots completed={0} />
                <Text style={styles.pomoInfo}>
                  {t('timer.pomodoroInfo', { rounds: ROUNDS_PER_CYCLE, brk: preset.brk, long: preset.longBrk })}
                </Text>

                {/* Auto-advance preferences */}
                <View style={styles.autoToggle}>
                  <View style={styles.autoToggleText}>
                    <Text style={styles.autoToggleLabel}>{t('timer.autoStartBreaks')}</Text>
                    <Text style={styles.autoToggleHint}>{t('timer.autoStartBreaksHint')}</Text>
                  </View>
                  <Switch
                    value={autoBreak}
                    onValueChange={setAutoBreak}
                    trackColor={{ false: '#334155', true: `${BREAK_C}80` }}
                    thumbColor={autoBreak ? BREAK_C : '#94a3b8'}
                  />
                </View>
                <View style={styles.autoToggle}>
                  <View style={styles.autoToggleText}>
                    <Text style={styles.autoToggleLabel}>{t('timer.autoStartFocus')}</Text>
                    <Text style={styles.autoToggleHint}>{t('timer.autoStartFocusHint')}</Text>
                  </View>
                  <Switch
                    value={autoFocus}
                    onValueChange={setAutoFocus}
                    trackColor={{ false: '#334155', true: `${ACCENT}80` }}
                    thumbColor={autoFocus ? ACCENT : '#94a3b8'}
                  />
                </View>
              </>
            )}

            {/* Duration Row (classic mode) */}
            {!inPomodoro && (<>
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
            </>)}

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
              onPress={inPomodoro ? handleStartCycle : handleStart}
              disabled={timer.isLoading}
              activeOpacity={0.85}
            >
              {timer.isLoading
                ? <ActivityIndicator color="#000" />
                : (
                  <>
                    <Text style={styles.startBtnIcon}>▶</Text>
                    <Text style={styles.startBtnText}>
                      {inPomodoro ? t('timer.startCycle') : t('timer.startSession')}
                    </Text>
                  </>
                )
              }
            </TouchableOpacity>
          </View>
        )}

        {/* ── POMODORO: FOCUS ROUND DONE — waiting to start the break ── */}
        {!timer.isActive && inPomodoro && pomo.phase === 'awaitBreak' && (
          <View style={styles.pomoSection}>
            <Text style={styles.awaitEmoji}>✅</Text>
            <Text style={styles.awaitTitle}>{t('timer.roundDoneTitle', { round: pomo.round })}</Text>
            <RoundDots completed={pomo.round} active={pomo.round + 1} activeColor={BREAK_C} />
            <View style={styles.breakCard}>
              <Text style={styles.breakCardTitle}>{t('timer.breakCardTitle')}</Text>
              <Text style={styles.breakCardBody}>{t('timer.breakCardBody')}</Text>
            </View>
            <TouchableOpacity
              style={[styles.startBtn, { marginTop: 4 }]}
              onPress={handleStartBreak}
              activeOpacity={0.85}
            >
              <Text style={styles.startBtnIcon}>☕</Text>
              <Text style={styles.startBtnText}>{t('timer.startBreak', { min: preset.brk })}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExitCycle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.exitCycleText}>{t('timer.exitCycle')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── POMODORO: BREAK ── */}
        {!timer.isActive && inPomodoro && pomo.phase === 'break' && (
          <View style={styles.pomoSection}>
            <RoundDots completed={pomo.round} active={pomo.round + 1} activeColor={BREAK_C} />
            <Text style={styles.pomoInfo}>
              {t('timer.breakInfo', { count: pomo.round, next: pomo.round + 1 })}
            </Text>
            <View style={styles.breakCard}>
              <Text style={styles.breakCardTitle}>{t('timer.breakCardTitle')}</Text>
              <Text style={styles.breakCardBody}>{t('timer.breakCardBody')}</Text>
            </View>
            <Text style={styles.breakFreeHint}>{t('timer.breakFreeHint')}</Text>
            <TouchableOpacity style={styles.ghostBtn} onPress={handleSkipBreak} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>{t('timer.skipBreak')}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExitCycle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.exitCycleText}>{t('timer.exitCycle')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── POMODORO: BREAK OVER — waiting for the next round ── */}
        {!timer.isActive && inPomodoro && pomo.phase === 'awaitNext' && (
          <View style={styles.pomoSection}>
            <Text style={styles.awaitEmoji}>🔥</Text>
            <Text style={styles.awaitTitle}>{t('timer.breakOverTitle')}</Text>
            <RoundDots completed={pomo.round} active={pomo.round + 1} activeColor={BREAK_C} />
            <TouchableOpacity
              style={[styles.startBtn, { marginTop: 12 }, timer.isLoading && { opacity: 0.6 }]}
              onPress={handleStartNextRound}
              disabled={timer.isLoading}
              activeOpacity={0.85}
            >
              {timer.isLoading
                ? <ActivityIndicator color="#000" />
                : (
                  <>
                    <Text style={styles.startBtnIcon}>▶</Text>
                    <Text style={styles.startBtnText}>{t('timer.startNextRound', { round: pomo.round + 1 })}</Text>
                  </>
                )
              }
            </TouchableOpacity>
            <TouchableOpacity onPress={handleExitCycle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <Text style={styles.exitCycleText}>{t('timer.exitCycle')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── POMODORO: CYCLE DONE — summary ── */}
        {!timer.isActive && inPomodoro && pomo.phase === 'done' && (
          <View style={styles.pomoSection}>
            <Text style={styles.doneEmoji}>🎉</Text>
            <Text style={styles.doneTitle}>{t('timer.cycleDoneTitle')}</Text>
            <Text style={styles.doneSub}>
              {t('timer.cycleDoneSub', { rounds: ROUNDS_PER_CYCLE, focus: preset.focus })}
            </Text>
            <RoundDots completed={ROUNDS_PER_CYCLE} />
            <View style={styles.doneStats}>
              <View style={styles.doneStat}>
                <Text style={styles.doneStatValue}>{formatDuration(pomo.totalMinutes)}</Text>
                <Text style={styles.doneStatLabel}>{t('timer.cycleStatFocus')}</Text>
              </View>
              <View style={styles.doneStat}>
                <Text style={styles.doneStatValue}>+{pomo.totalXp}</Text>
                <Text style={styles.doneStatLabel}>XP</Text>
              </View>
              <View style={styles.doneStat}>
                <Text style={[styles.doneStatValue, { color: PAUSE_C }]}>+{pomo.totalCoins}</Text>
                <Text style={styles.doneStatLabel}>🪙 COIN</Text>
              </View>
            </View>
            <TouchableOpacity
              style={styles.startBtn}
              activeOpacity={0.85}
              onPress={() =>
                setReceipt({
                  subjectName: selectedSubject?.name,
                  durationMinutes: pomo.totalMinutes,
                  xpEarned: pomo.totalXp,
                  coinsEarned: pomo.totalCoins,
                  streak: pomo.lastStreak,
                })
              }
            >
              <Text style={styles.startBtnText}>📤 {t('timer.cycleShare')}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.ghostBtn} onPress={() => pomo.finishCycle()} activeOpacity={0.8}>
              <Text style={styles.ghostBtnText}>{t('timer.newCycle')}</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* ── ACTIVE STATE ── */}
        {timer.isActive && (
          <View style={styles.activeSection}>
            {/* Pomodoro round indicator */}
            {inPomodoro && pomo.phase === 'focus' && (
              <View style={styles.focusRounds}>
                <RoundDots completed={pomo.round - 1} active={pomo.round} />
                <Text style={styles.pomoInfo}>
                  {t('timer.roundOf', { current: pomo.round, total: ROUNDS_PER_CYCLE })}
                </Text>
              </View>
            )}

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
          onClose={() => {
            setReceipt(null);
            // Happy moment just ended — maybe ask for a store rating.
            void maybeRequestReview();
          }}
          subjectName={receipt.subjectName}
          durationMinutes={receipt.durationMinutes}
          xpEarned={receipt.xpEarned}
          coinsEarned={receipt.coinsEarned}
          streak={receipt.streak}
          focus={receipt.focus}
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

/** ms → "MM:SS" for the break countdown */
function msToClock(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

/** Pomodoro round progress dots: done → filled, active → enlarged + colored. */
function RoundDots({
  completed,
  active,
  activeColor,
}: {
  completed: number;
  active?: number;
  activeColor?: string;
}) {
  return (
    <View style={dotStyles.row}>
      {Array.from({ length: ROUNDS_PER_CYCLE }, (_, i) => {
        const n = i + 1;
        const isActive = n === active;
        const isDone = n <= completed;
        return (
          <View
            key={n}
            style={[
              dotStyles.dot,
              isDone && dotStyles.done,
              isActive && [dotStyles.active, { backgroundColor: activeColor ?? ACCENT }],
            ]}
          />
        );
      })}
    </View>
  );
}

const dotStyles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 12,
  },
  dot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: 'rgba(255,255,255,0.10)',
  },
  done: { backgroundColor: ACCENT },
  active: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.18)',
  },
});

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

  // ── Pomodoro ──
  modeSeg: {
    flexDirection: 'row',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 4,
    gap: 4,
    marginBottom: 20,
  },
  modeSegBtn: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: 9,
    borderRadius: 9,
  },
  modeSegBtnOn: {
    backgroundColor: `${ACCENT}1f`,
    borderWidth: 1,
    borderColor: `${ACCENT}73`,
  },
  modeSegText: { color: MUTED, fontSize: 13, fontWeight: '700' },
  modeSegTextOn: { color: ACCENT },

  presetRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  presetChip: { flex: 1, alignItems: 'center' },
  pomoInfo: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    marginTop: 10,
    marginBottom: 4,
  },

  autoToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 10,
    paddingHorizontal: 14,
    marginTop: 10,
    gap: 12,
  },
  autoToggleText: { flex: 1 },
  autoToggleLabel: { color: TEXT, fontSize: 14, fontWeight: '600' },
  autoToggleHint: { color: MUTED, fontSize: 11, marginTop: 2, lineHeight: 15 },

  pomoSection: {
    paddingHorizontal: 24,
    paddingTop: 8,
    gap: 14,
  },

  breakCircle: {
    width: 220,
    height: 220,
    borderRadius: 110,
    borderWidth: 10,
    borderColor: `${BREAK_C}44`,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: BREAK_C,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 8,
  },
  breakTime: { color: TEXT, fontSize: 44, fontWeight: '800', letterSpacing: -0.5 },
  breakTagPill: {
    marginTop: 8,
    backgroundColor: `${BREAK_C}1f`,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 8,
  },
  breakTagText: { color: BREAK_C, fontSize: 11, fontWeight: '800', letterSpacing: 2 },

  breakCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    padding: 16,
  },
  breakCardTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  breakCardBody: { color: MUTED, fontSize: 12.5, marginTop: 4, lineHeight: 18 },
  breakFreeHint: { textAlign: 'center', color: BREAK_C, fontSize: 13, fontWeight: '700' },

  ghostBtn: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    backgroundColor: CARD,
  },
  ghostBtnText: { color: MUTED, fontSize: 14, fontWeight: '700' },
  exitCycleText: {
    textAlign: 'center',
    color: MUTED,
    fontSize: 12,
    textDecorationLine: 'underline',
    marginTop: 2,
  },

  awaitEmoji: { textAlign: 'center', fontSize: 40 },
  awaitTitle: { textAlign: 'center', color: TEXT, fontSize: 20, fontWeight: '800' },

  doneEmoji: { textAlign: 'center', fontSize: 44 },
  doneTitle: { textAlign: 'center', color: TEXT, fontSize: 22, fontWeight: '800' },
  doneSub: { textAlign: 'center', color: MUTED, fontSize: 13, marginTop: -6 },
  doneStats: { flexDirection: 'row', gap: 10 },
  doneStat: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: CARD_BORDER,
    paddingVertical: 14,
    alignItems: 'center',
  },
  doneStatValue: { color: ACCENT, fontSize: 17, fontWeight: '800' },
  doneStatLabel: { color: MUTED, fontSize: 10, marginTop: 4, letterSpacing: 0.5 },

  focusRounds: { alignItems: 'center', gap: 2, marginBottom: -6 },

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
