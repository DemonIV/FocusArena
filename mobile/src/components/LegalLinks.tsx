import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Linking, StyleSheet } from 'react-native';
import { useTranslation } from 'react-i18next';
import { LEGAL_URLS } from '../constants';

interface Props {
  /** Muted link colour; defaults to the paywall's fine-print grey. */
  color?: string;
  style?: object;
}

/**
 * Terms of Use + Privacy Policy links. Mandatory inside the subscription
 * purchase flow (App Store Guideline 3.1.2) — plain fine-print text is not
 * enough, the links have to be tappable.
 */
export function LegalLinks({ color = '#64748b', style }: Props) {
  const { t } = useTranslation();

  const open = useCallback((url: string) => {
    // Missing browser / malformed URL must never crash the paywall.
    Linking.openURL(url).catch(() => undefined);
  }, []);

  return (
    <View style={[styles.row, style]}>
      <TouchableOpacity onPress={() => open(LEGAL_URLS.terms)} hitSlop={8}>
        <Text style={[styles.link, { color }]}>{t('legal.terms')}</Text>
      </TouchableOpacity>
      <Text style={[styles.sep, { color }]}>·</Text>
      <TouchableOpacity onPress={() => open(LEGAL_URLS.privacy)} hitSlop={8}>
        <Text style={[styles.link, { color }]}>{t('legal.privacy')}</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', marginTop: 10 },
  link: { fontSize: 12, fontWeight: '600', textDecorationLine: 'underline' },
  sep: { fontSize: 12, marginHorizontal: 8 },
});
