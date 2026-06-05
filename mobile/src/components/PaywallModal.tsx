import React, { useEffect, useState, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  getProPackages,
  purchaseProPackage,
  restoreProPurchases,
  type ProPackage,
} from '../services/billing';
import { useBillingStore } from '../stores';
import { track } from '../services/analytics';

// Palette — matches ProfileScreen
const BG = '#0d0d1a';
const CARD = '#131325';
const ACCENT = '#00d2ff';
const GOLD = '#f59e0b';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Optional context for analytics ("subject_limit" | "profile" | …). */
  source?: string;
}

export function PaywallModal({ visible, onClose, source = 'unknown' }: Props) {
  const { t } = useTranslation();
  const setPro = useBillingStore((s) => s.setPro);

  const [packages, setPackages] = useState<ProPackage[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!visible) return;
    track('paywall_viewed', { source });
    setLoading(true);
    getProPackages()
      .then((pkgs) => {
        setPackages(pkgs);
        // Default to the annual plan if present (best value), else the first.
        const annual = pkgs.find((p) => p.period === 'ANNUAL');
        setSelected((annual ?? pkgs[0])?.identifier ?? null);
      })
      .finally(() => setLoading(false));
  }, [visible, source]);

  const handlePurchase = useCallback(async () => {
    const pkg = packages.find((p) => p.identifier === selected);
    if (!pkg) return;
    setBusy(true);
    track('purchase_started', { source, package: pkg.identifier });
    try {
      const ok = await purchaseProPackage(pkg);
      if (ok) {
        setPro(true);
        track('purchase_completed', { source, package: pkg.identifier });
        Alert.alert(t('pro.successTitle'), t('pro.successMsg'));
        onClose();
      }
    } catch (e: unknown) {
      Alert.alert(t('common.error'), (e as Error)?.message ?? t('pro.purchaseFailed'));
    } finally {
      setBusy(false);
    }
  }, [packages, selected, source, setPro, onClose, t]);

  const handleRestore = useCallback(async () => {
    setBusy(true);
    try {
      const ok = await restoreProPurchases();
      if (ok) {
        setPro(true);
        Alert.alert(t('pro.restoredTitle'), t('pro.restoredMsg'));
        onClose();
      } else {
        Alert.alert(t('pro.nothingTitle'), t('pro.nothingMsg'));
      }
    } finally {
      setBusy(false);
    }
  }, [setPro, onClose, t]);

  const benefits = [
    { icon: '📚', text: t('pro.benefitSubjects') },
    { icon: '🛡️', text: t('pro.benefitFreeze') },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.sheet}>
          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={styles.crown}>👑</Text>
            <Text style={styles.title}>FocusArena Pro</Text>
            <Text style={styles.subtitle}>{t('pro.tagline')}</Text>

            {/* Benefits */}
            <View style={styles.benefits}>
              {benefits.map((b) => (
                <View key={b.text} style={styles.benefitRow}>
                  <Text style={styles.benefitIcon}>{b.icon}</Text>
                  <Text style={styles.benefitText}>{b.text}</Text>
                </View>
              ))}
            </View>

            {/* Packages */}
            {loading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : packages.length === 0 ? (
              <Text style={styles.empty}>{t('pro.unavailable')}</Text>
            ) : (
              packages.map((p) => {
                const isSel = p.identifier === selected;
                return (
                  <TouchableOpacity
                    key={p.identifier}
                    style={[styles.pkg, isSel && styles.pkgSel]}
                    onPress={() => setSelected(p.identifier)}
                    activeOpacity={0.8}
                  >
                    <Text style={[styles.pkgTitle, isSel && { color: TEXT }]}>
                      {p.period === 'ANNUAL'
                        ? t('pro.yearly')
                        : p.period === 'MONTHLY'
                          ? t('pro.monthly')
                          : p.title || p.identifier}
                    </Text>
                    <Text style={[styles.pkgPrice, isSel && { color: ACCENT }]}>{p.priceString}</Text>
                  </TouchableOpacity>
                );
              })
            )}

            {/* CTA */}
            <TouchableOpacity
              style={[styles.cta, (busy || !selected) && styles.ctaDisabled]}
              onPress={handlePurchase}
              disabled={busy || !selected}
              activeOpacity={0.85}
            >
              {busy ? (
                <ActivityIndicator color="#001018" />
              ) : (
                <Text style={styles.ctaText}>{t('pro.subscribe')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity onPress={handleRestore} disabled={busy}>
              <Text style={styles.restore}>{t('pro.restore')}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} disabled={busy}>
              <Text style={styles.close}>{t('common.cancel')}</Text>
            </TouchableOpacity>

            <Text style={styles.legal}>{t('pro.legal')}</Text>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: BG,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '88%',
    borderTopWidth: 1,
    borderColor: '#1e1e35',
  },
  crown: { fontSize: 44, textAlign: 'center', marginBottom: 4 },
  title: { fontSize: 26, fontWeight: '800', color: TEXT, textAlign: 'center' },
  subtitle: { fontSize: 14, color: MUTED, textAlign: 'center', marginTop: 6, marginBottom: 20 },
  benefits: { marginBottom: 20 },
  benefitRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8 },
  benefitIcon: { fontSize: 22, width: 36 },
  benefitText: { fontSize: 15, color: TEXT, flex: 1 },
  empty: { color: MUTED, textAlign: 'center', marginVertical: 24 },
  pkg: {
    backgroundColor: CARD,
    borderRadius: 14,
    padding: 16,
    marginBottom: 12,
    borderWidth: 2,
    borderColor: 'transparent',
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pkgSel: { borderColor: ACCENT },
  pkgTitle: { fontSize: 16, fontWeight: '700', color: MUTED },
  pkgPrice: { fontSize: 16, fontWeight: '800', color: MUTED },
  cta: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  ctaDisabled: { opacity: 0.5 },
  ctaText: { color: '#001018', fontSize: 17, fontWeight: '800' },
  restore: { color: ACCENT, textAlign: 'center', marginTop: 16, fontSize: 14, fontWeight: '600' },
  close: { color: MUTED, textAlign: 'center', marginTop: 14, fontSize: 14 },
  legal: { color: '#475569', fontSize: 11, textAlign: 'center', marginTop: 16, lineHeight: 16 },
});
