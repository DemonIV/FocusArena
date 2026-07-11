/**
 * PetDetailModal — the pet shop's showcase view.
 * Tapping a card in the shop opens this sheet: a big animated stage with a
 * rarity-tinted glow, personality bio, the egg → baby → adult evolution
 * journey, and the adopt/equip CTA. After a purchase it flips into a
 * celebration state (egg pop + vibration + "focus 1h to hatch it").
 */
import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Vibration,
} from 'react-native';
import LottieView from 'lottie-react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  withSequence,
  withTiming,
  withDelay,
} from 'react-native-reanimated';
import { useTranslation } from 'react-i18next';
import { getPetVisual, PET_EGG_LOTTIE, PET_RARITY_COLORS } from '../constants/pets';
import { formatDuration } from '../utils/formatTime';
import { track } from '../services/analytics';
import type { PetEntry, PetStage } from '../types';

const BG = '#0d0d1a';
const CARD = '#131325';
const ACCENT = '#00d2ff';
const GOLD = '#ffd700';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';
const MUTED3 = '#64748b';
const BORDER = 'rgba(255,255,255,0.08)';

// Mirror of the backend evolution thresholds (cosmetics.schema.ts)
const HATCH_MIN = 60;
const ADULT_MIN = 600;

const STAGES: { stage: PetStage; labelKey: string }[] = [
  { stage: 'egg', labelKey: 'pets.stageEgg' },
  { stage: 'baby', labelKey: 'pets.stageBaby' },
  { stage: 'adult', labelKey: 'pets.stageAdult' },
];

interface Props {
  /** Pet being showcased — null keeps the modal closed. */
  pet: PetEntry | null;
  equipped: boolean;
  coins: number;
  busy: boolean;
  /** Purchase just succeeded — show the egg celebration instead of the shop view. */
  celebrating: boolean;
  onClose: () => void;
  onBuy: () => void;
  onSelect: () => void;
  onProPress: () => void;
}

export function PetDetailModal({
  pet, equipped, coins, busy, celebrating, onClose, onBuy, onSelect, onProPress,
}: Props) {
  const { t } = useTranslation();
  const visible = pet !== null;

  // Stage entrance: the pet pops in with a spring — the "alive" feel the
  // flat cards can't give.
  const pop = useSharedValue(0);
  useEffect(() => {
    if (!visible) { pop.value = 0; return; }
    pop.value = 0;
    pop.value = withDelay(80, withSpring(1, { damping: 12, stiffness: 140 }));
  }, [visible, celebrating, pop]);
  const popStyle = useAnimatedStyle(() => ({
    opacity: pop.value,
    transform: [{ scale: 0.4 + pop.value * 0.6 }],
  }));

  // Idle float so the stage never sits still.
  const float = useSharedValue(0);
  useEffect(() => {
    if (!visible) return;
    float.value = 0;
    float.value = withSequence(
      withTiming(1, { duration: 1600 }),
      withTiming(0, { duration: 1600 }),
    );
    const id = setInterval(() => {
      float.value = withSequence(
        withTiming(1, { duration: 1600 }),
        withTiming(0, { duration: 1600 }),
      );
    }, 3200);
    return () => clearInterval(id);
  }, [visible, float]);
  const floatStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: float.value * -6 }],
  }));

  useEffect(() => {
    if (visible && pet) track('pet_detail_viewed', { petId: pet.id });
  }, [visible, pet?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (celebrating) Vibration.vibrate(80);
  }, [celebrating]);

  if (!pet) return null;
  const visual = getPetVisual(pet.id);
  if (!visual) return null;

  const rarityColor = PET_RARITY_COLORS[visual.rarity];
  const name = t(`pets.names.${pet.id}`);
  const stage = pet.stage ?? 'egg';
  const minutes = pet.minutesTogether ?? 0;
  const canAfford = coins >= pet.price;

  // ── Celebration view ────────────────────────────────────────────────────────
  if (celebrating) {
    return (
      <Modal visible transparent animationType="fade" onRequestClose={onClose}>
        <View style={styles.backdrop}>
          <View style={styles.sheet}>
            <View style={styles.handle} />
            <Animated.View style={[styles.stage, popStyle]}>
              <View style={[styles.glow, { backgroundColor: `${rarityColor}1a`, borderColor: `${rarityColor}55` }]} />
              <Animated.View style={floatStyle}>
                <LottieView source={PET_EGG_LOTTIE} autoPlay loop style={styles.stageLottie} />
              </Animated.View>
            </Animated.View>
            <Text style={styles.congratsTitle}>{t('pets.congratsTitle', { name })}</Text>
            <Text style={styles.congratsMsg}>{t('pets.congratsMsg')}</Text>
            <TouchableOpacity style={[styles.cta, { borderColor: `${rarityColor}66`, backgroundColor: `${rarityColor}1f` }]} onPress={onClose} activeOpacity={0.85}>
              <Text style={[styles.ctaText, { color: rarityColor }]}>{t('pets.congratsBtn')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  }

  // ── Showcase view ───────────────────────────────────────────────────────────
  const currentIdx = !pet.owned ? -1 : stage === 'egg' ? 0 : stage === 'baby' ? 1 : 2;
  const nextAt = stage === 'egg' ? HATCH_MIN : ADULT_MIN;
  const progress = stage === 'adult' ? 1 : Math.min(1, minutes / nextAt);

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />

          {/* Stage */}
          <Animated.View style={[styles.stage, popStyle]}>
            <View style={[styles.glow, { backgroundColor: `${rarityColor}1a`, borderColor: `${rarityColor}55` }]} />
            <Animated.View style={floatStyle}>
              <LottieView
                source={pet.owned && stage === 'egg' ? PET_EGG_LOTTIE : visual.lottie}
                autoPlay
                loop
                style={styles.stageLottie}
              />
            </Animated.View>
          </Animated.View>

          {/* Name + rarity */}
          <View style={styles.nameRow}>
            <Text style={styles.name}>{name}</Text>
            <View style={[styles.rarityChip, { borderColor: `${rarityColor}66`, backgroundColor: `${rarityColor}1a` }]}>
              <Text style={[styles.rarityText, { color: rarityColor }]}>
                {t(`pets.rarity.${visual.rarity}`)}
              </Text>
            </View>
          </View>

          <Text style={styles.bio}>{t(`pets.bios.${pet.id}`)}</Text>

          {/* Evolution journey */}
          <Text style={styles.evoTitle}>{t('pets.evolutionTitle')}</Text>
          <View style={styles.evoRow}>
            {STAGES.map((s, i) => {
              const reached = currentIdx >= i;
              const isCurrent = currentIdx === i;
              return (
                <React.Fragment key={s.stage}>
                  {i > 0 && (
                    <View style={styles.evoConnector}>
                      <View style={[styles.evoLine, currentIdx >= i && { backgroundColor: rarityColor }]} />
                      <Text style={styles.evoThreshold}>
                        {formatDuration(i === 1 ? HATCH_MIN : ADULT_MIN)}
                      </Text>
                    </View>
                  )}
                  <View
                    style={[
                      styles.evoStep,
                      reached && { borderColor: `${rarityColor}88`, backgroundColor: `${rarityColor}14` },
                      isCurrent && { borderColor: rarityColor },
                    ]}
                  >
                    <Text style={styles.evoEmoji}>
                      {s.stage === 'egg' ? '🥚' : visual.emoji}
                    </Text>
                    <Text style={[styles.evoLabel, reached && { color: TEXT }]}>{t(s.labelKey)}</Text>
                  </View>
                </React.Fragment>
              );
            })}
          </View>

          {/* Owned & still growing → progress to the next stage */}
          {pet.owned && stage !== 'adult' && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${progress * 100}%`, backgroundColor: rarityColor }]} />
              </View>
              <Text style={styles.progressHint}>
                {stage === 'egg'
                  ? t('pets.hatchIn', { duration: formatDuration(Math.max(0, nextAt - minutes)) })
                  : t('pets.growIn', { duration: formatDuration(Math.max(0, nextAt - minutes)) })}
              </Text>
            </View>
          )}
          {pet.owned && stage === 'adult' && (
            <Text style={styles.progressHint}>{t('pets.together', { duration: formatDuration(minutes) })}</Text>
          )}

          {/* CTA */}
          {equipped ? (
            <View style={[styles.cta, styles.ctaDisabled]}>
              <Text style={[styles.ctaText, { color: ACCENT }]}>✓ {t('shop.selected')}</Text>
            </View>
          ) : pet.owned ? (
            <TouchableOpacity style={[styles.cta, { borderColor: `${ACCENT}66`, backgroundColor: `${ACCENT}1f` }]} onPress={onSelect} disabled={busy} activeOpacity={0.85}>
              {busy
                ? <ActivityIndicator size="small" color={ACCENT} />
                : <Text style={[styles.ctaText, { color: ACCENT }]}>{t('shop.select')}</Text>}
            </TouchableOpacity>
          ) : pet.pro ? (
            <TouchableOpacity style={[styles.cta, { borderColor: 'rgba(245,158,11,0.55)', backgroundColor: 'rgba(245,158,11,0.14)' }]} onPress={onProPress} disabled={busy} activeOpacity={0.85}>
              <Text style={[styles.ctaText, { color: '#f59e0b' }]}>👑 {t('pets.proCta')}</Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.cta, { borderColor: `${GOLD}55`, backgroundColor: `${GOLD}14` }, !canAfford && styles.ctaDim]}
              onPress={onBuy}
              disabled={busy}
              activeOpacity={0.85}
            >
              {busy
                ? <ActivityIndicator size="small" color={GOLD} />
                : (
                  <Text style={[styles.ctaText, { color: GOLD }]}>
                    🪙 {pet.price.toLocaleString()} · {t('pets.adoptBtn')}
                  </Text>
                )}
            </TouchableOpacity>
          )}
          {!pet.owned && !pet.pro && !canAfford && (
            <Text style={styles.affordHint}>
              {t('pets.missingCoins', { coins: (pet.price - coins).toLocaleString() })}
            </Text>
          )}

          <TouchableOpacity onPress={onClose} disabled={busy}>
            <Text style={styles.close}>{t('common.close')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    padding: 24,
    paddingBottom: 28,
    borderTopWidth: 1,
    borderColor: '#1e1e35',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 16,
  },

  stage: {
    alignSelf: 'center',
    width: 172,
    height: 172,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  glow: {
    position: 'absolute',
    width: 172,
    height: 172,
    borderRadius: 86,
    borderWidth: 1.5,
  },
  stageLottie: { width: 140, height: 140 },

  nameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 8,
  },
  name: { color: TEXT, fontSize: 22, fontWeight: '800' },
  rarityChip: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 3,
  },
  rarityText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.8, textTransform: 'uppercase' },

  bio: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    textAlign: 'center',
    marginBottom: 18,
    paddingHorizontal: 8,
  },

  evoTitle: {
    color: MUTED3,
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 10,
    textAlign: 'center',
  },
  evoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 14,
  },
  evoStep: {
    width: 76,
    alignItems: 'center',
    backgroundColor: CARD,
    borderWidth: 1.5,
    borderColor: BORDER,
    borderRadius: 14,
    paddingVertical: 10,
  },
  evoEmoji: { fontSize: 24, marginBottom: 4 },
  evoLabel: { color: MUTED3, fontSize: 10, fontWeight: '700' },
  evoConnector: { alignItems: 'center', width: 44 },
  evoLine: {
    height: 2,
    alignSelf: 'stretch',
    marginHorizontal: 4,
    borderRadius: 1,
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  evoThreshold: { color: MUTED3, fontSize: 9, fontWeight: '700', marginTop: 3 },

  progressWrap: { marginBottom: 4 },
  progressTrack: {
    height: 6,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 3,
    overflow: 'hidden',
    marginBottom: 6,
  },
  progressFill: { height: '100%', borderRadius: 3 },
  progressHint: { color: MUTED, fontSize: 12, textAlign: 'center', marginBottom: 4 },

  cta: {
    borderWidth: 1.5,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 12,
  },
  ctaDisabled: { borderColor: `${ACCENT}40`, backgroundColor: `${ACCENT}0d` },
  ctaDim: { opacity: 0.65 },
  ctaText: { fontSize: 15, fontWeight: '800' },
  affordHint: { color: MUTED3, fontSize: 11, textAlign: 'center', marginTop: 8 },

  congratsTitle: { color: TEXT, fontSize: 20, fontWeight: '800', textAlign: 'center', marginBottom: 8 },
  congratsMsg: { color: MUTED, fontSize: 13, lineHeight: 19, textAlign: 'center', marginBottom: 6 },

  close: { color: MUTED, textAlign: 'center', marginTop: 16, fontSize: 14 },
});
