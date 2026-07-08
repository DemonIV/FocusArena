import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import { leaderboardService } from '../services';
import { track } from '../services/analytics';

import type { FocusScoreBreakdown } from '../types';

interface Props {
  visible: boolean;
  onClose: () => void;
  subjectName?: string;
  durationMinutes: number;
  xpEarned: number;
  /** Coins earned this session — shown alongside XP */
  coinsEarned?: number;
  streak: number;
  /** Focus Score breakdown for this session (omitted for aggregated cycle receipts) */
  focus?: FocusScoreBreakdown | null;
}

/** Score → colour tier for the Focus Score badge. */
function scoreColor(score: number): string {
  if (score >= 85) return '#10b981'; // green — dialed in
  if (score >= 60) return '#fbbf24'; // amber — decent
  return '#f87171';                  // red — distracted
}

const ACCENT = '#00d2ff';
const CARD = '#131325';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const PINK = '#e94560';

/** Shareable "Study Receipt" card shown when a focus session completes. */
export function StudyReceiptModal({
  visible,
  onClose,
  subjectName,
  durationMinutes,
  xpEarned,
  coinsEarned = 0,
  streak,
  focus,
}: Props) {
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  // Reuse the weekly rank cache (TimerScreen invalidates 'lb-me' on stop → refetched)
  const rankQ = useQuery({
    queryKey: ['lb-me', 'weekly'],
    queryFn: () => leaderboardService.getMe('weekly'),
    enabled: visible,
  });
  const rank = rankQ.data?.rank ?? null;

  const fmtDuration = useCallback(
    (min: number) => {
      const hr = t('common.hourShort');
      const mn = t('common.minShort');
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h > 0) return m > 0 ? `${h}${hr} ${m}${mn}` : `${h}${hr}`;
      return `${m}${mn}`;
    },
    [t],
  );

  const handleShare = useCallback(async () => {
    try {
      setSharing(true);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('receipt.shareUnavailable'));
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, {
        mimeType: 'image/png',
        dialogTitle: t('receipt.shareTitle'),
      });
      track('receipt_shared');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('receipt.shareFailed'));
    } finally {
      setSharing(false);
    }
  }, [t]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          {/* ── Captured card ── */}
          <View ref={cardRef} collapsable={false} style={styles.card}>
            <View style={styles.glow} />
            <Text style={styles.brand}>⚡ StudySquad</Text>
            <View style={styles.divider} />

            {subjectName ? <Text style={styles.subject}>{subjectName}</Text> : null}
            <Text style={styles.duration}>{fmtDuration(durationMinutes)}</Text>
            <Text style={styles.focusedLabel}>{t('receipt.focused')}</Text>

            <View style={styles.statsRow}>
              <Text style={styles.xp}>+{xpEarned.toLocaleString()} XP</Text>
              {coinsEarned > 0 && (
                <Text style={styles.coins}>🪙 +{coinsEarned.toLocaleString()}</Text>
              )}
              {streak > 0 && (
                <Text style={styles.streak}>🔥 {t('receipt.dayN', { count: streak })}</Text>
              )}
            </View>

            {focus && (
              <View style={styles.focusBox}>
                <View style={styles.focusHead}>
                  <Text style={styles.focusLabel}>🎯 {t('receipt.focusScore')}</Text>
                  <Text style={[styles.focusScore, { color: scoreColor(focus.score) }]}>
                    {focus.score}
                    <Text style={styles.focusScoreMax}>/100</Text>
                  </Text>
                </View>
                <FocusBar label={t('receipt.focusCompletion')} value={focus.completion} />
                <FocusBar label={t('receipt.focusPresence')} value={focus.presence} />
                <FocusBar label={t('receipt.focusSteadiness')} value={focus.steadiness} />
              </View>
            )}

            {rank != null && (
              <Text style={styles.rank}>{t('receipt.globalRank', { rank })}</Text>
            )}

            <Text style={styles.url}>studysquad.app</Text>
          </View>

          {/* ── Actions ── */}
          <TouchableOpacity
            style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
            onPress={handleShare}
            disabled={sharing}
            activeOpacity={0.85}
          >
            {sharing ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={styles.shareBtnText}>{t('receipt.share')}</Text>
            )}
          </TouchableOpacity>

          <TouchableOpacity style={styles.closeBtn} onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.closeBtnText}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

/** One labelled 0–100 bar in the Focus Score breakdown. */
function FocusBar({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.barRow}>
      <Text style={styles.barLabel}>{label}</Text>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${Math.max(3, value)}%`, backgroundColor: scoreColor(value) }]} />
      </View>
      <Text style={styles.barValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  sheet: { width: '100%', maxWidth: 360, alignItems: 'stretch' },

  // ── Card ──
  card: {
    backgroundColor: CARD,
    borderRadius: 24,
    paddingVertical: 36,
    paddingHorizontal: 28,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: ACCENT,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: `${ACCENT}1f`,
  },
  brand: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  divider: {
    width: 48,
    height: 3,
    borderRadius: 2,
    backgroundColor: `${ACCENT}55`,
    marginTop: 16,
    marginBottom: 20,
  },
  subject: {
    color: MUTED,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: 6,
    textAlign: 'center',
  },
  duration: {
    color: TEXT,
    fontSize: 44,
    fontWeight: '900',
    letterSpacing: -1,
  },
  focusedLabel: {
    color: MUTED,
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 1,
    marginTop: 2,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    marginTop: 24,
  },
  xp: {
    color: ACCENT,
    fontSize: 18,
    fontWeight: '800',
  },
  coins: {
    color: '#fbbf24',
    fontSize: 15,
    fontWeight: '700',
  },
  streak: {
    color: PINK,
    fontSize: 15,
    fontWeight: '700',
  },
  rank: {
    color: TEXT,
    fontSize: 14,
    fontWeight: '700',
    marginTop: 14,
  },

  // ── Focus Score ──
  focusBox: {
    marginTop: 24,
    width: '100%',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 8,
  },
  focusHead: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  focusLabel: { color: TEXT, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 },
  focusScore: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5 },
  focusScoreMax: { color: MUTED, fontSize: 12, fontWeight: '700' },
  barRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  barLabel: { color: MUTED, fontSize: 11, fontWeight: '600', width: 78 },
  barTrack: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.08)',
    overflow: 'hidden',
  },
  barFill: { height: '100%', borderRadius: 3 },
  barValue: { color: TEXT, fontSize: 11, fontWeight: '700', width: 24, textAlign: 'right' },
  url: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginTop: 22,
  },

  // ── Actions ──
  shareBtn: {
    marginTop: 24,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 16,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.45,
    shadowRadius: 16,
    elevation: 8,
  },
  shareBtnText: { color: '#000', fontSize: 16, fontWeight: '800', letterSpacing: 0.3 },
  closeBtn: { marginTop: 12, paddingVertical: 14, alignItems: 'center' },
  closeBtnText: { color: MUTED, fontSize: 15, fontWeight: '600' },
});
