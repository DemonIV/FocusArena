import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import {
  billingEnabled,
  getCoinPackages,
  purchaseCoinPackage,
  type CoinPackage,
} from '../services/billing';
import { track } from '../services/analytics';

// Palette — matches ProfileScreen / PaywallModal
const BG = '#0d0d1a';
const CARD = '#131325';
const ACCENT = '#00d2ff';
const GOLD = '#ffd700';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';

const PACK_ICON = ['🪙', '💰', '🏆'];


interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional context for analytics ("shop_chip" | "not_enough_coins" | …). */
  source?: string;
}

export function CoinShopModal({ visible, onClose, source = 'unknown' }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const [packages, setPackages] = useState<CoinPackage[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) return;
    track('coin_shop_viewed', { source });
    setLoading(true);
    getCoinPackages()
      .then(setPackages)
      .finally(() => setLoading(false));
  }, [visible, source]);

  // Coins are credited by the backend webhook — refetch the balance a couple
  // of times to pick it up without making the user pull-to-refresh.
  const refreshBalanceSoon = useCallback(() => {
    const invalidate = () => queryClient.invalidateQueries({ queryKey: ['frames'] });
    setTimeout(invalidate, 2_000);
    setTimeout(invalidate, 6_000);
  }, [queryClient]);

  const handleBuy = useCallback(async (pkg: CoinPackage) => {
    setBusy(pkg.identifier);
    track('coin_purchase_started', { source, package: pkg.identifier });
    try {
      const ok = await purchaseCoinPackage(pkg);
      if (ok) {
        track('coin_purchase_completed', { source, package: pkg.identifier });
        refreshBalanceSoon();
        Alert.alert(t('coinShop.successTitle'), t('coinShop.successMsg', { coins: pkg.coins.toLocaleString() }));
        onClose();
      }
    } catch (e: unknown) {
      Alert.alert(t('common.error'), (e as Error)?.message ?? t('coinShop.failed'));
    } finally {
      setBusy(null);
    }
  }, [source, refreshBalanceSoon, onClose, t]);

  // Largest pack = best value (highlighted like the design mock).
  const bestId = packages.length > 1 ? packages[packages.length - 1].identifier : null;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <View style={styles.handle} />
          <Text style={styles.title}>🪙 {t('coinShop.title')}</Text>
          <Text style={styles.subtitle}>{t('coinShop.sub')}</Text>

          {loading ? (
            <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
          ) : packages.length === 0 ? (
            <Text style={styles.empty}>
              {billingEnabled ? t('coinShop.unavailable') : t('coinShop.comingSoon')}
            </Text>
          ) : (
            packages.map((p, i) => {
              const isBest = p.identifier === bestId;
              const isBusy = busy === p.identifier;
              return (
                <TouchableOpacity
                  key={p.identifier}
                  style={[styles.pack, isBest && styles.packBest]}
                  onPress={() => handleBuy(p)}
                  disabled={busy !== null}
                  activeOpacity={0.8}
                >
                  {isBest && (
                    <View style={styles.bestBadge}>
                      <Text style={styles.bestBadgeText}>{t('coinShop.bestValue')}</Text>
                    </View>
                  )}
                  <Text style={styles.packIcon}>{PACK_ICON[Math.min(i, PACK_ICON.length - 1)]}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.packCoins}>{p.coins.toLocaleString()} {t('coinShop.coins')}</Text>
                  </View>
                  <View style={[styles.buyBtn, isBest && styles.buyBtnBest]}>
                    {isBusy
                      ? <ActivityIndicator size="small" color={isBest ? GOLD : ACCENT} />
                      : <Text style={[styles.buyText, isBest && { color: GOLD }]}>{p.priceString}</Text>
                    }
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          <Text style={styles.footer}>{t('coinShop.footer')}</Text>

          <TouchableOpacity onPress={onClose} disabled={busy !== null}>
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
    borderTopWidth: 1,
    borderColor: '#1e1e35',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 6 },
  subtitle: { fontSize: 13, color: MUTED, marginBottom: 20 },
  empty: { color: MUTED, textAlign: 'center', marginVertical: 24 },
  pack: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    padding: 16,
    marginBottom: 12,
  },
  packBest: {
    borderColor: 'rgba(255,215,0,0.5)',
    backgroundColor: 'rgba(255,215,0,0.06)',
  },
  bestBadge: {
    position: 'absolute',
    top: -9,
    right: 14,
    backgroundColor: GOLD,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  bestBadgeText: { color: '#131325', fontSize: 10, fontWeight: '800', letterSpacing: 1 },
  packIcon: { fontSize: 30 },
  packCoins: { fontSize: 17, fontWeight: '800', color: GOLD },
  buyBtn: {
    backgroundColor: `${ACCENT}18`,
    borderWidth: 1,
    borderColor: `${ACCENT}55`,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    minWidth: 88,
    alignItems: 'center',
  },
  buyBtnBest: { backgroundColor: `${GOLD}20`, borderColor: `${GOLD}66` },
  buyText: { color: ACCENT, fontSize: 14, fontWeight: '800' },
  footer: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 6 },
  close: { color: MUTED, textAlign: 'center', marginTop: 16, fontSize: 14 },
});
