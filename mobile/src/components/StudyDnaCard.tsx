import React, { useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { captureRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { timerService } from '../services';
import { track } from '../services/analytics';
import { formatDuration } from '../utils/formatTime';
import type { DnaInfo } from '../types';

const ACCENT = '#00d2ff';
const CARD   = '#131325';
const BORDER = 'rgba(255,255,255,0.10)';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const VIOLET = '#8b5cf6';

const CHRONO: Record<DnaInfo['chronotype'], { icon: string; key: string }> = {
  night_owl:  { icon: '🦉', key: 'dna.chronoNightOwl' },
  early_bird: { icon: '🌅', key: 'dna.chronoEarlyBird' },
  daytime:    { icon: '☀️', key: 'dna.chronoDaytime' },
};
const STYLE: Record<DnaInfo['focusStyle'], { icon: string; key: string }> = {
  deep:     { icon: '🎯', key: 'dna.styleDeep' },
  sprinter: { icon: '⚡', key: 'dna.styleSprinter' },
  steady:   { icon: '📚', key: 'dna.styleSteady' },
};
const POWER: Record<DnaInfo['superpower'], { icon: string; key: string }> = {
  streak:      { icon: '🔥', key: 'dna.powerStreak' },
  volume:      { icon: '💪', key: 'dna.powerVolume' },
  finisher:    { icon: '✅', key: 'dna.powerFinisher' },
  consistency: { icon: '📈', key: 'dna.powerConsistency' },
};

const pad = (n: number) => String(n).padStart(2, '0');

/** Shareable "Study DNA" personality card for the profile screen. */
export function StudyDnaCard() {
  const { t } = useTranslation();
  const cardRef = useRef<View>(null);
  const [sharing, setSharing] = useState(false);

  const dnaQ = useQuery({
    queryKey: ['study-dna'],
    queryFn: () => timerService.getDNA(),
  });
  const dna = dnaQ.data;

  const handleShare = useCallback(async () => {
    try {
      setSharing(true);
      if (!(await Sharing.isAvailableAsync())) {
        Alert.alert(t('receipt.shareUnavailable'));
        return;
      }
      const uri = await captureRef(cardRef, { format: 'png', quality: 1 });
      await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: t('dna.share') });
      track('dna_shared');
    } catch (e: any) {
      Alert.alert(t('common.error'), e?.message ?? t('receipt.shareFailed'));
    } finally {
      setSharing(false);
    }
  }, [t]);

  if (dnaQ.isLoading) {
    return <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />;
  }
  if (!dna || !dna.hasData) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyIcon}>🧬</Text>
        <Text style={styles.emptyText}>{t('dna.noData')}</Text>
      </View>
    );
  }

  const chrono = CHRONO[dna.chronotype];
  const style  = STYLE[dna.focusStyle];
  const power  = POWER[dna.superpower];
  const peak = `${pad(dna.peakHour)}:00–${pad((dna.peakHour + 1) % 24)}:00`;

  return (
    <>
      <View ref={cardRef} collapsable={false} style={styles.card}>
        <View style={styles.glow} />
        <Text style={styles.brand}>🧬 {t('dna.title')}</Text>
        <View style={styles.divider} />

        {/* Traits */}
        <View style={styles.trait}>
          <Text style={styles.traitIcon}>{chrono.icon}</Text>
          <Text style={styles.traitText}>{t(chrono.key)}</Text>
        </View>
        <View style={styles.trait}>
          <Text style={styles.traitIcon}>{style.icon}</Text>
          <Text style={styles.traitText}>{t(style.key)}</Text>
        </View>
        {dna.topSubject && (
          <View style={styles.trait}>
            <Text style={styles.traitIcon}>📐</Text>
            <Text style={styles.traitText}>{dna.topSubject}</Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>{t('dna.peakHours')}</Text>
            <Text style={styles.statValue}>{peak}</Text>
          </View>
          <View style={styles.statCell}>
            <Text style={styles.statLabel}>{t('dna.avgSession')}</Text>
            <Text style={styles.statValue}>{formatDuration(dna.avgSessionMinutes)}</Text>
          </View>
        </View>

        <View style={styles.powerBox}>
          <Text style={styles.powerLabel}>{t('dna.superpower')}</Text>
          <Text style={styles.powerValue}>{power.icon} {t(power.key)}</Text>
        </View>

        <Text style={styles.url}>studysquad.app</Text>
      </View>

      <TouchableOpacity
        style={[styles.shareBtn, sharing && { opacity: 0.6 }]}
        onPress={handleShare}
        disabled={sharing}
        activeOpacity={0.85}
      >
        {sharing ? <ActivityIndicator color="#000" /> : <Text style={styles.shareBtnText}>{t('dna.share')}</Text>}
      </TouchableOpacity>
    </>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    paddingVertical: 28,
    paddingHorizontal: 24,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: VIOLET,
    overflow: 'hidden',
  },
  glow: {
    position: 'absolute',
    top: -90,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: `${VIOLET}1f`,
  },
  brand: { color: VIOLET, fontSize: 16, fontWeight: '800', letterSpacing: 0.5 },
  divider: { width: 44, height: 3, borderRadius: 2, backgroundColor: `${VIOLET}55`, marginTop: 14, marginBottom: 18 },

  trait: { flexDirection: 'row', alignItems: 'center', gap: 12, alignSelf: 'stretch', marginBottom: 12 },
  traitIcon: { fontSize: 22, width: 28, textAlign: 'center' },
  traitText: { color: TEXT, fontSize: 16, fontWeight: '700', flex: 1 },

  statsRow: { flexDirection: 'row', alignSelf: 'stretch', marginTop: 10, gap: 12 },
  statCell: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  statLabel: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
  statValue: { color: TEXT, fontSize: 16, fontWeight: '800', marginTop: 4 },

  powerBox: {
    alignSelf: 'stretch',
    backgroundColor: `${VIOLET}18`,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginTop: 12,
    borderWidth: 1,
    borderColor: `${VIOLET}40`,
    alignItems: 'center',
  },
  powerLabel: { color: MUTED, fontSize: 10, fontWeight: '700', letterSpacing: 1.5, textTransform: 'uppercase' },
  powerValue: { color: VIOLET, fontSize: 16, fontWeight: '800', marginTop: 4 },

  url: { color: MUTED, fontSize: 12, fontWeight: '600', letterSpacing: 0.5, marginTop: 20 },

  shareBtn: {
    marginTop: 14,
    marginBottom: 24,
    backgroundColor: VIOLET,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shareBtnText: { color: '#fff', fontSize: 15, fontWeight: '800', letterSpacing: 0.3 },

  emptyBox: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 28,
    alignItems: 'center',
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyIcon: { fontSize: 34, marginBottom: 10 },
  emptyText: { color: MUTED, fontSize: 13, textAlign: 'center', lineHeight: 19 },
});
