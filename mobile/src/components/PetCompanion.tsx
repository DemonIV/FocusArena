/**
 * PetCompanion — the user's animated pet living on the Home screen.
 * Egg → baby → adult evolution driven by focus minutes (server-computed).
 * Tapping the pet gives a happy bounce. No pet equipped → adoption teaser
 * that funnels into the pet shop on the Profile tab.
 */
import React, { useRef, useCallback } from 'react';
import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { getPetVisual, PET_EGG_LOTTIE } from '../constants/pets';
import { formatDuration } from '../utils/formatTime';
import type { PetStage } from '../types';

const CARD = '#131325';
const BORDER = 'rgba(255,255,255,0.08)';
const ACCENT = '#00d2ff';
const GREEN = '#22c55e';
const TEXT = '#e2e8f0';
const MUTED = '#64748b';
const MUTED2 = '#94a3b8';

// Mirror of the backend evolution thresholds (cosmetics.schema.ts)
const HATCH_MIN = 60;
const ADULT_MIN = 600;

interface Props {
  petId: string;
  stage: PetStage;
  minutesTogether: number;
}

export function PetCompanion({ petId, stage, minutesTogether }: Props) {
  const { t } = useTranslation();
  const visual = getPetVisual(petId);
  const lottieRef = useRef<LottieView>(null);

  // Happy bounce on tap
  const bounce = useSharedValue(0);
  const handleTap = useCallback(() => {
    bounce.value = withSequence(
      withTiming(1, { duration: 120 }),
      withSpring(0, { damping: 6, stiffness: 160 }),
    );
    lottieRef.current?.play();
  }, [bounce]);
  const bounceStyle = useAnimatedStyle(() => ({
    transform: [
      { translateY: bounce.value * -14 },
      { scale: 1 + bounce.value * 0.08 },
    ],
  }));

  if (!visual) return null;

  const isEgg = stage === 'egg';
  const nextAt = isEgg ? HATCH_MIN : ADULT_MIN;
  const progress = stage === 'adult' ? 1 : Math.min(1, minutesTogether / nextAt);
  const remaining = Math.max(0, nextAt - minutesTogether);

  return (
    <View style={styles.card}>
      <Pressable onPress={handleTap} hitSlop={8}>
        <Animated.View style={bounceStyle}>
          <LottieView
            ref={lottieRef}
            source={isEgg ? PET_EGG_LOTTIE : visual.lottie}
            autoPlay
            loop
            style={[styles.lottie, stage === 'baby' && styles.lottieBaby]}
          />
        </Animated.View>
      </Pressable>

      <View style={styles.info}>
        <View style={styles.nameRow}>
          <Text style={styles.name} numberOfLines={1}>
            {isEgg ? '🥚 ' : ''}{t(`pets.names.${petId}`)}
          </Text>
          <View style={[styles.stageChip, stage === 'adult' && styles.stageChipAdult]}>
            <Text style={[styles.stageText, stage === 'adult' && { color: GREEN }]}>
              {t(`pets.stage${stage === 'egg' ? 'Egg' : stage === 'baby' ? 'Baby' : 'Adult'}`)}
            </Text>
          </View>
        </View>

        {stage === 'adult' ? (
          <Text style={styles.hint}>{t('pets.together', { duration: formatDuration(minutesTogether) })}</Text>
        ) : (
          <>
            <View style={styles.track}>
              <View style={[styles.fill, { width: `${progress * 100}%` }]} />
            </View>
            <Text style={styles.hint}>
              {isEgg
                ? t('pets.hatchIn', { duration: formatDuration(remaining) })
                : t('pets.growIn', { duration: formatDuration(remaining) })}
            </Text>
          </>
        )}
      </View>
    </View>
  );
}

/** Empty state: no pet yet — sell the dream, link to the shop. */
export function PetAdoptTeaser({ onPress }: { onPress: () => void }) {
  const { t } = useTranslation();
  return (
    <TouchableOpacity style={styles.teaser} onPress={onPress} activeOpacity={0.8}>
      <Text style={styles.teaserIcon}>🐾</Text>
      <View style={{ flex: 1 }}>
        <Text style={styles.teaserTitle}>{t('pets.adopt')}</Text>
        <Text style={styles.teaserHint}>{t('pets.adoptHint')}</Text>
      </View>
      <Text style={styles.teaserArrow}>›</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 16,
    padding: 14,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    gap: 14,
  },
  lottie: { width: 96, height: 96 },
  lottieBaby: { width: 72, height: 72, margin: 12 },
  info: { flex: 1 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
  name: { color: TEXT, fontSize: 16, fontWeight: '800', flexShrink: 1 },
  stageChip: {
    backgroundColor: `${ACCENT}18`,
    borderWidth: 1,
    borderColor: `${ACCENT}40`,
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  stageChipAdult: {
    backgroundColor: 'rgba(34,197,94,0.12)',
    borderColor: 'rgba(34,197,94,0.4)',
  },
  stageText: { color: ACCENT, fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
  track: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  fill: {
    height: '100%',
    borderRadius: 3,
    backgroundColor: ACCENT,
    shadowColor: ACCENT,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.7,
    shadowRadius: 5,
  },
  hint: { color: MUTED2, fontSize: 12, lineHeight: 17 },

  // Adoption teaser
  teaser: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: 16,
    padding: 16,
    marginBottom: 24,
    borderWidth: 1,
    borderColor: BORDER,
    borderStyle: 'dashed',
    gap: 12,
  },
  teaserIcon: { fontSize: 26 },
  teaserTitle: { color: TEXT, fontSize: 14, fontWeight: '700' },
  teaserHint: { color: MUTED, fontSize: 12, marginTop: 2 },
  teaserArrow: { color: ACCENT, fontSize: 22, fontWeight: '300' },
});
