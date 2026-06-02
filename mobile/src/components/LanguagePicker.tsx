import React, { useState } from 'react';
import {
  View,
  Text,
  Modal,
  Pressable,
  FlatList,
  StyleSheet,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { LANGUAGES, setLanguage, type LanguageCode } from '../i18n';

/**
 * Compact language selector — a pill showing the current flag/label that opens
 * a bottom-sheet list. Works before login (no auth required).
 */
export function LanguagePicker() {
  const { i18n, t } = useTranslation();
  const [open, setOpen] = useState(false);

  const current = LANGUAGES.find((l) => l.code === i18n.language) ?? LANGUAGES[0];

  return (
    <>
      <Pressable style={styles.pill} onPress={() => setOpen(true)} hitSlop={8}>
        <Text style={styles.pillText}>{current.flag} {current.label}</Text>
        <Text style={styles.chevron}>▾</Text>
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable style={styles.overlay} onPress={() => setOpen(false)}>
          <Pressable style={styles.sheet} onPress={(e) => e.stopPropagation()}>
            <View style={styles.handle} />
            <Text style={styles.title}>{t('language.title')}</Text>
            <FlatList
              data={LANGUAGES}
              keyExtractor={(l) => l.code}
              style={{ maxHeight: 360 }}
              renderItem={({ item }) => {
                const selected = item.code === i18n.language;
                return (
                  <Pressable
                    style={[styles.row, selected && styles.rowSelected]}
                    onPress={async () => {
                      await setLanguage(item.code as LanguageCode);
                      setOpen(false);
                    }}
                  >
                    <Text style={styles.flag}>{item.flag}</Text>
                    <Text style={[styles.label, selected && styles.labelSelected]}>{item.label}</Text>
                    {selected && <Text style={styles.check}>✓</Text>}
                  </Pressable>
                );
              }}
            />
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'center',
    backgroundColor: '#16213e',
    borderWidth: 1,
    borderColor: '#0f3460',
    borderRadius: 20,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  pillText: { color: '#e2e8f0', fontSize: 14, fontWeight: '600' },
  chevron: { color: '#8a8a9a', fontSize: 12 },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#16213e',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    paddingBottom: 36,
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 16,
  },
  title: { color: '#fff', fontSize: 18, fontWeight: '700', marginBottom: 12 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 10,
  },
  rowSelected: { backgroundColor: '#0f3460' },
  flag: { fontSize: 22 },
  label: { flex: 1, color: '#e2e8f0', fontSize: 16 },
  labelSelected: { color: '#00d2ff', fontWeight: '700' },
  check: { color: '#00d2ff', fontSize: 16, fontWeight: '700' },
});
