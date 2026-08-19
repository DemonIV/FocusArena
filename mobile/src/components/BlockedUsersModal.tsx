import React, { useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { friendsService } from '../services';
import type { BlockedUser } from '../types';

// Palette — matches ProfileScreen / CoinShopModal
const BG = '#0d0d1a';
const CARD = '#131325';
const ACCENT = '#00d2ff';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';

interface Props {
  visible: boolean;
  onClose: () => void;
}

/**
 * The list of people the user has blocked, with a way back out.
 *
 * Apple asks blocking to be reversible by the person who applied it, so the
 * list is part of the same requirement as the block action itself.
 */
export function BlockedUsersModal({ visible, onClose }: Props) {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const blockedQ = useQuery({
    queryKey: ['blockedUsers'],
    queryFn: () => friendsService.listBlocked(),
    enabled: visible,
  });

  const unblockMut = useMutation({
    mutationFn: (userId: string) => friendsService.unblock(userId),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['blockedUsers'] });
      // A lifted block makes the user searchable and addable again.
      void qc.invalidateQueries({ queryKey: ['friends'] });
    },
    onError: (err: any) => Alert.alert(t('common.error'), err?.message ?? t('moderation.unblockFailed')),
  });

  const confirmUnblock = useCallback(
    (item: BlockedUser) => {
      Alert.alert(
        t('moderation.unblockTitle'),
        t('moderation.unblockMsg', { name: item.username }),
        [
          { text: t('common.cancel'), style: 'cancel' },
          { text: t('moderation.unblock'), onPress: () => unblockMut.mutate(item.userId) },
        ],
      );
    },
    [t, unblockMut],
  );

  const renderItem = ({ item }: { item: BlockedUser }) => (
    <View style={styles.row}>
      <View style={styles.avatar}>
        <Text style={styles.avatarLetter}>{item.username.charAt(0).toUpperCase()}</Text>
      </View>
      <Text style={styles.name}>{item.username}</Text>
      <TouchableOpacity
        style={styles.unblockBtn}
        onPress={() => confirmUnblock(item)}
        disabled={unblockMut.isPending}
        activeOpacity={0.8}
      >
        <Text style={styles.unblockText}>{t('moderation.unblock')}</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.handle} />
          <Text style={styles.title}>{t('moderation.blockedUsers')}</Text>
          <Text style={styles.subtitle}>{t('moderation.blockedUsersHint')}</Text>

          {blockedQ.isLoading ? (
            <ActivityIndicator color={ACCENT} style={styles.loader} />
          ) : (
            <FlatList
              data={blockedQ.data ?? []}
              keyExtractor={(item) => item.userId}
              renderItem={renderItem}
              style={styles.list}
              ListEmptyComponent={<Text style={styles.empty}>{t('moderation.noBlockedUsers')}</Text>}
            />
          )}

          <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
            <Text style={styles.close}>{t('common.close')}</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
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
    paddingBottom: 34,
    maxHeight: '80%',
    borderTopWidth: 1,
    borderColor: '#1e1e35',
  },
  handle: {
    width: 40, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignSelf: 'center', marginBottom: 20,
  },
  title: { fontSize: 20, fontWeight: '700', color: TEXT, marginBottom: 4 },
  subtitle: { fontSize: 13, color: MUTED, marginBottom: 18 },
  list: { flexGrow: 0 },
  loader: { marginVertical: 32 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  avatar: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: '#1e1e35',
    alignItems: 'center', justifyContent: 'center',
  },
  avatarLetter: { color: TEXT, fontSize: 16, fontWeight: '700' },
  name: { flex: 1, color: TEXT, fontSize: 16, fontWeight: '600' },
  unblockBtn: {
    backgroundColor: 'rgba(0,210,255,0.12)',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: ACCENT,
    paddingVertical: 8,
    paddingHorizontal: 14,
  },
  unblockText: { color: ACCENT, fontSize: 13, fontWeight: '700' },
  empty: { color: MUTED, textAlign: 'center', marginVertical: 28, fontSize: 14 },
  close: { color: MUTED, textAlign: 'center', marginTop: 16, fontSize: 15, fontWeight: '600' },
});
