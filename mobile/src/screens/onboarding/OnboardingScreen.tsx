import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  Pressable,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Alert,
  Platform,
  KeyboardAvoidingView,
} from 'react-native';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useOnboardingStore } from '../../stores';
import { timerService, friendsService } from '../../services';
import { billingEnabled } from '../../services/billing';
import { track } from '../../services/analytics';
import { PaywallModal } from '../../components/PaywallModal';
import { formatDuration } from '../../utils/formatTime';
import type { UserSearchResult } from '../../types';

// ─── Palette ──────────────────────────────────────────────────────────────────

const BG     = '#0d0d1a';
const CARD   = '#131325';
const CARD2  = 'rgba(255,255,255,0.04)';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';

const COLORS = ['#00d2ff', '#ef4444', '#f59e0b', '#10b981', '#8b5cf6', '#ec4899', '#f97316', '#14b8a6'];
const ICONS  = ['📚', '💻', '🔬', '🎨', '🏃', '🎵', '🗣️', '✏️', '📊', '🏆', '🌍', '🧪'];
const GOALS  = [30, 60, 90, 120, 180, 240];

const MOTIVATIONS = [
  { id: 'exam', icon: '📝', labelKey: 'onboarding.motivExam' },
  { id: 'habit', icon: '🎯', labelKey: 'onboarding.motivHabit' },
  { id: 'procrastination', icon: '🚀', labelKey: 'onboarding.motivProcrastination' },
  { id: 'friends', icon: '👥', labelKey: 'onboarding.motivFriends' },
] as const;

const TOTAL_STEPS = 5;

export function OnboardingScreen() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const complete = useOnboardingStore((s) => s.complete);

  // Existing users (already have subjects) skip onboarding entirely.
  const subjectsQ = useQuery({
    queryKey: ['subjects'],
    queryFn: () => timerService.getSubjects(),
  });
  useEffect(() => {
    if (subjectsQ.data && subjectsQ.data.length > 0) complete();
  }, [subjectsQ.data, complete]);

  const [step, setStep] = useState(0);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState(ICONS[0]);
  const [color, setColor] = useState(COLORS[0]);
  const [goal, setGoal] = useState(60);
  const [submitting, setSubmitting] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    track('onboarding_step_viewed', { step });
  }, [step]);

  // Friends search
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserSearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [sent, setSent] = useState<Set<string>>(new Set());

  const handleSearch = useCallback(async () => {
    if (!query.trim()) return;
    setSearching(true);
    try {
      setResults(await friendsService.search(query.trim()));
    } catch {
      /* ignore */
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleAdd = useCallback(async (userId: string) => {
    setSent((prev) => new Set(prev).add(userId));
    try {
      await friendsService.sendRequest(userId);
    } catch {
      setSent((prev) => { const n = new Set(prev); n.delete(userId); return n; });
    }
  }, []);

  const finish = useCallback(async () => {
    setSubmitting(true);
    try {
      await timerService.createSubject({ name: name.trim(), color, icon, daily_goal_minutes: goal });
      qc.invalidateQueries({ queryKey: ['subjects'] });
      qc.invalidateQueries({ queryKey: ['subject-stats'] });
      qc.invalidateQueries({ queryKey: ['timer-stats'] });
      if (billingEnabled) {
        // Funnel finale: trial paywall right after the commitment moment.
        // complete() runs when it closes (purchase or dismiss).
        setSubmitting(false);
        setShowPaywall(true);
      } else {
        complete();
      }
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('onboarding.createFailed'));
      setSubmitting(false);
    }
  }, [name, color, icon, goal, complete, qc, t]);

  const next = useCallback(() => {
    if (step === 1 && !name.trim()) {
      Alert.alert(t('common.warning'), t('onboarding.nameRequired'));
      return;
    }
    if (step < TOTAL_STEPS - 1) setStep((s) => s + 1);
    else void finish();
  }, [step, name, finish, t]);

  // While we don't yet know whether to skip, show a spinner.
  if (subjectsQ.isLoading) {
    return (
      <View style={[styles.root, styles.center]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {/* Progress dots + skip */}
      <View style={styles.topBar}>
        <View style={styles.dots}>
          {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
            <View key={i} style={[styles.dot, i <= step && styles.dotActive]} />
          ))}
        </View>
        {step < TOTAL_STEPS - 1 && (
          <TouchableOpacity onPress={complete} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Text style={styles.skip}>{t('onboarding.skip')}</Text>
          </TouchableOpacity>
        )}
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {/* ── Step 1: Motivation ── */}
        {step === 0 && (
          <>
            <Text style={styles.title}>{t('onboarding.step0Title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.step0Subtitle')}</Text>

            {MOTIVATIONS.map((m) => {
              const isSel = motivation === m.id;
              return (
                <Pressable
                  key={m.id}
                  style={[styles.motivCard, isSel && styles.motivCardSel]}
                  onPress={() => {
                    setMotivation(m.id);
                    track('onboarding_motivation', { choice: m.id });
                  }}
                >
                  <Text style={styles.motivIcon}>{m.icon}</Text>
                  <Text style={[styles.motivText, isSel && { color: TEXT }]}>{t(m.labelKey)}</Text>
                  {isSel && <Text style={styles.motivCheck}>✓</Text>}
                </Pressable>
              );
            })}
          </>
        )}

        {/* ── Step 2: First subject ── */}
        {step === 1 && (
          <>
            <Text style={styles.title}>{t('onboarding.step1Title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.step1Subtitle')}</Text>

            <View style={[styles.preview, { borderColor: `${color}40` }]}>
              <View style={[styles.previewDot, { backgroundColor: color }]}>
                <Text style={styles.previewIcon}>{icon}</Text>
              </View>
              <Text style={styles.previewName} numberOfLines={1}>
                {name.trim() || t('onboarding.subjectExample')}
              </Text>
            </View>

            <TextInput
              style={styles.input}
              placeholder={t('onboarding.subjectPlaceholder')}
              placeholderTextColor={MUTED}
              value={name}
              onChangeText={setName}
              maxLength={50}
              autoFocus
              returnKeyType="done"
            />

            <Text style={styles.pickerLabel}>{t('onboarding.icon')}</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.iconRow}>
              {ICONS.map((ic) => (
                <Pressable
                  key={ic}
                  style={[styles.iconBtn, icon === ic && { borderColor: color, backgroundColor: `${color}22` }]}
                  onPress={() => setIcon(ic)}
                >
                  <Text style={styles.iconText}>{ic}</Text>
                </Pressable>
              ))}
            </ScrollView>

            <Text style={styles.pickerLabel}>{t('onboarding.color')}</Text>
            <View style={styles.colorRow}>
              {COLORS.map((c) => (
                <Pressable key={c} style={[styles.colorDot, { backgroundColor: c }]} onPress={() => setColor(c)}>
                  {color === c && <Text style={styles.colorCheck}>✓</Text>}
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ── Step 3: Daily goal ── */}
        {step === 2 && (
          <>
            <Text style={styles.title}>{t('onboarding.step2Title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.step2Subtitle')}</Text>

            <View style={styles.goalDisplay}>
              <Text style={styles.goalBig}>{formatDuration(goal)}</Text>
              <Text style={styles.goalPerDay}>{t('onboarding.perDay')}</Text>
            </View>

            <View style={styles.goalGrid}>
              {GOALS.map((g) => (
                <Pressable
                  key={g}
                  style={[styles.goalChip, goal === g && styles.goalChipActive]}
                  onPress={() => setGoal(g)}
                >
                  <Text style={[styles.goalChipText, goal === g && styles.goalChipTextActive]}>
                    {formatDuration(g)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </>
        )}

        {/* ── Step 4: Find friends ── */}
        {step === 3 && (
          <>
            <Text style={styles.title}>{t('onboarding.step3Title')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.step3Subtitle')}</Text>

            <View style={styles.searchRow}>
              <TextInput
                style={styles.searchInput}
                placeholder={t('friends.searchPlaceholder')}
                placeholderTextColor={MUTED}
                value={query}
                onChangeText={setQuery}
                onSubmitEditing={handleSearch}
                returnKeyType="search"
                autoCapitalize="none"
              />
              <TouchableOpacity style={styles.searchBtn} onPress={handleSearch}>
                <Text style={styles.searchBtnText}>{t('friends.go')}</Text>
              </TouchableOpacity>
            </View>

            {searching ? (
              <ActivityIndicator color={ACCENT} style={{ marginTop: 24 }} />
            ) : (
              results.map((u) => {
                const isSent = sent.has(u.id) || u.relationship === 'pending_sent';
                const isFriend = u.relationship === 'friends';
                return (
                  <View key={u.id} style={styles.userRow}>
                    <View style={styles.userAvatar}>
                      <Text style={styles.userAvatarText}>{u.username.charAt(0).toUpperCase()}</Text>
                    </View>
                    <Text style={styles.userName} numberOfLines={1}>{u.username}</Text>
                    <TouchableOpacity
                      style={[styles.addBtn, (isSent || isFriend) && styles.addBtnDone]}
                      onPress={() => !isSent && !isFriend && handleAdd(u.id)}
                      disabled={isSent || isFriend}
                    >
                      <Text style={[styles.addBtnText, (isSent || isFriend) && styles.addBtnTextDone]}>
                        {isFriend ? t('friends.friendsTag') : isSent ? t('friends.pending') : t('friends.add')}
                      </Text>
                    </TouchableOpacity>
                  </View>
                );
              })
            )}
          </>
        )}

        {/* ── Step 5: Plan ready (commitment moment before the paywall) ── */}
        {step === 4 && (
          <>
            <Text style={styles.title}>{t('onboarding.planTitle')}</Text>
            <Text style={styles.subtitle}>{t('onboarding.planSubtitle')}</Text>

            <View style={styles.planCard}>
              <View style={[styles.preview, { borderColor: `${color}40`, marginBottom: 0 }]}>
                <View style={[styles.previewDot, { backgroundColor: color }]}>
                  <Text style={styles.previewIcon}>{icon}</Text>
                </View>
                <Text style={styles.previewName} numberOfLines={1}>{name.trim()}</Text>
              </View>

              <View style={styles.planRow}>
                <Text style={styles.planLabel}>{t('onboarding.planDailyGoal')}</Text>
                <Text style={styles.planValue}>{formatDuration(goal)}</Text>
              </View>
              <View style={styles.planRow}>
                <Text style={styles.planLabel}>{t('onboarding.planWeekly')}</Text>
                <Text style={[styles.planValue, { color: ACCENT }]}>{formatDuration(goal * 7)}</Text>
              </View>
              {motivation && (
                <View style={[styles.planRow, { borderBottomWidth: 0 }]}>
                  <Text style={styles.planLabel}>{t('onboarding.planWhy')}</Text>
                  <Text style={styles.planValue}>
                    {t(MOTIVATIONS.find((m) => m.id === motivation)!.labelKey)}
                  </Text>
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>

      {/* Footer nav */}
      <View style={styles.footer}>
        {step > 0 && (
          <TouchableOpacity style={styles.backBtn} onPress={() => setStep((s) => s - 1)} disabled={submitting}>
            <Text style={styles.backText}>{t('onboarding.back')}</Text>
          </TouchableOpacity>
        )}
        <TouchableOpacity
          style={[styles.nextBtn, (submitting || (step === 0 && !motivation)) && { opacity: 0.5 }]}
          onPress={next}
          disabled={submitting || (step === 0 && !motivation)}
          activeOpacity={0.85}
        >
          {submitting
            ? <ActivityIndicator color="#000" />
            : <Text style={styles.nextText}>{step < TOTAL_STEPS - 1 ? t('onboarding.continue') : t('onboarding.startPlan')}</Text>}
        </TouchableOpacity>
      </View>

      <PaywallModal
        visible={showPaywall}
        onClose={complete}
        source="onboarding"
        dismissLabel={t('onboarding.continueFree')}
      />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  center: { alignItems: 'center', justifyContent: 'center' },

  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: Platform.OS === 'ios' ? 60 : 40,
    paddingBottom: 8,
  },
  dots: { flexDirection: 'row', gap: 8 },
  dot: { width: 24, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)' },
  dotActive: { backgroundColor: ACCENT },
  skip: { color: MUTED, fontSize: 14, fontWeight: '600' },

  body: { paddingHorizontal: 24, paddingTop: 24, paddingBottom: 24 },
  title: { color: TEXT, fontSize: 26, fontWeight: '800', letterSpacing: -0.3 },
  subtitle: { color: MUTED, fontSize: 15, marginTop: 8, marginBottom: 28, lineHeight: 21 },

  // Subject preview
  preview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD2,
    borderRadius: 14,
    padding: 14,
    marginBottom: 18,
    borderWidth: 1,
  },
  previewDot: { width: 44, height: 44, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  previewIcon: { fontSize: 22 },
  previewName: { color: TEXT, fontSize: 17, fontWeight: '600', flex: 1 },

  input: {
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 15,
    color: TEXT,
    fontSize: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 22,
  },
  pickerLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 10,
    textTransform: 'uppercase',
  },
  iconRow: { gap: 8, marginBottom: 22, paddingBottom: 4 },
  iconBtn: {
    width: 46,
    height: 46,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: BORDER,
    backgroundColor: CARD,
  },
  iconText: { fontSize: 22 },
  colorRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  colorDot: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  colorCheck: { color: '#fff', fontSize: 18, fontWeight: '800' },

  // Motivation step
  motivCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 1.5,
    borderColor: BORDER,
  },
  motivCardSel: { borderColor: ACCENT, backgroundColor: `${ACCENT}12` },
  motivIcon: { fontSize: 26 },
  motivText: { color: MUTED, fontSize: 16, fontWeight: '600', flex: 1 },
  motivCheck: { color: ACCENT, fontSize: 18, fontWeight: '800' },

  // Plan-ready step
  planCard: {
    backgroundColor: CARD2,
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 4,
  },
  planRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  planLabel: { color: MUTED, fontSize: 14, fontWeight: '600' },
  planValue: { color: TEXT, fontSize: 15, fontWeight: '700' },

  // Goal step
  goalDisplay: { alignItems: 'center', marginBottom: 32 },
  goalBig: { color: ACCENT, fontSize: 48, fontWeight: '900', letterSpacing: -1 },
  goalPerDay: { color: MUTED, fontSize: 14, marginTop: 4 },
  goalGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, justifyContent: 'center' },
  goalChip: {
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    minWidth: 92,
    alignItems: 'center',
  },
  goalChipActive: { backgroundColor: `${ACCENT}22`, borderColor: ACCENT },
  goalChipText: { color: MUTED, fontSize: 15, fontWeight: '700' },
  goalChipTextActive: { color: ACCENT },

  // Friends step
  searchRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  searchInput: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 13,
    color: TEXT,
    fontSize: 15,
    borderWidth: 1,
    borderColor: BORDER,
  },
  searchBtn: {
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingHorizontal: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchBtnText: { color: '#000', fontSize: 15, fontWeight: '800' },
  userRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  userAvatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: `${ACCENT}22`,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userAvatarText: { color: ACCENT, fontSize: 16, fontWeight: '800' },
  userName: { flex: 1, color: TEXT, fontSize: 15, fontWeight: '600' },
  addBtn: {
    backgroundColor: `${ACCENT}18`,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
  },
  addBtnDone: { backgroundColor: CARD2, borderColor: BORDER },
  addBtnText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  addBtnTextDone: { color: MUTED },

  // Footer
  footer: {
    flexDirection: 'row',
    gap: 12,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: Platform.OS === 'ios' ? 36 : 24,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  backBtn: {
    paddingVertical: 16,
    paddingHorizontal: 24,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: { color: MUTED, fontSize: 15, fontWeight: '700' },
  nextBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
});
