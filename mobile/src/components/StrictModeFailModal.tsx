import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Modal, ActivityIndicator } from 'react-native';
import { useTranslation } from 'react-i18next';
import { STRICT_RESCUE_COST } from '../hooks/useStrictMode';

const DANGER = '#ef4444';
const ACCENT = '#00d2ff';
const TEXT   = '#e2e8f0';
const MUTED  = '#64748b';
const CARD_BORDER = 'rgba(255,255,255,0.08)';

interface Props {
  visible: boolean;
  /** Caller's coin balance — gates the rescue button. */
  coins: number;
  /** Equipped pet's emoji, if any — it gets sad with you. */
  petEmoji?: string;
  rescuing: boolean;
  onRescue: () => void;
  onForfeit: () => void;
}

/**
 * Shown when a Strict Mode session was violated (user left the app past the
 * grace period). One last chance: pay coins to keep the session alive, or
 * forfeit it (stop with no rewards). Intentionally NOT dismissible any other
 * way — the whole point is that leaving has a cost.
 */
export function StrictModeFailModal({ visible, coins, petEmoji, rescuing, onRescue, onForfeit }: Props) {
  const { t } = useTranslation();
  const canAfford = coins >= STRICT_RESCUE_COST;

  return (
    <Modal visible={visible} animationType="fade" transparent onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.emoji}>{petEmoji ? `${petEmoji}💔` : '💔'}</Text>
          <Text style={styles.title}>{t('timer.strictFailTitle')}</Text>
          <Text style={styles.subtitle}>
            {petEmoji ? t('timer.strictFailMsgPet') : t('timer.strictFailMsg')}
          </Text>

          <TouchableOpacity
            style={[styles.rescueBtn, (!canAfford || rescuing) && { opacity: 0.5 }]}
            onPress={onRescue}
            disabled={!canAfford || rescuing}
            activeOpacity={0.85}
          >
            {rescuing
              ? <ActivityIndicator color="#000" />
              : (
                <Text style={styles.rescueBtnText}>
                  {t('timer.strictRescue', { coins: STRICT_RESCUE_COST })}
                </Text>
              )}
          </TouchableOpacity>
          {!canAfford && (
            <Text style={styles.noCoinsText}>{t('timer.strictNotEnough', { coins })}</Text>
          )}

          <TouchableOpacity style={styles.forfeitBtn} onPress={onForfeit} disabled={rescuing} activeOpacity={0.8}>
            <Text style={styles.forfeitBtnText}>{t('timer.strictForfeit')}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 28,
  },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#131325',
    borderRadius: 22,
    padding: 26,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: `${DANGER}40`,
  },
  emoji: { fontSize: 48, marginBottom: 10 },
  title: { color: TEXT, fontSize: 19, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: MUTED, fontSize: 14, textAlign: 'center', marginTop: 8, lineHeight: 20 },
  rescueBtn: {
    alignSelf: 'stretch',
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  rescueBtnText: { color: '#001018', fontSize: 15, fontWeight: '800' },
  noCoinsText: { color: MUTED, fontSize: 12, marginTop: 8 },
  forfeitBtn: {
    alignSelf: 'stretch',
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginTop: 10,
    borderWidth: 1,
    borderColor: CARD_BORDER,
  },
  forfeitBtnText: { color: DANGER, fontSize: 14, fontWeight: '700' },
});
