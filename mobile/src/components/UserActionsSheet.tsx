import React, { useCallback, useEffect, useState } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  StyleSheet,
  Alert,
  ScrollView,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { friendsService } from '../services';
import type { ReportReason } from '../types';

// Palette — matches ProfileScreen / CoinShopModal
const BG = '#0d0d1a';
const CARD = '#131325';
const TEXT = '#e2e8f0';
const MUTED = '#94a3b8';
const DANGER = '#ef4444';

const REASONS: { id: ReportReason; icon: string }[] = [
  { id: 'harassment', icon: '🚫' },
  { id: 'inappropriate_name', icon: '🔤' },
  { id: 'spam', icon: '📢' },
  { id: 'impersonation', icon: '🎭' },
  { id: 'other', icon: '❓' },
];

export type ActionContext = 'friends' | 'search' | 'room' | 'leaderboard';

interface Props {
  /** The user the sheet acts on. `null` keeps the sheet closed. */
  user: { id: string; username: string } | null;
  onClose: () => void;
  /** Where the sheet was opened from — stored with the report for triage. */
  context?: ActionContext;
  /** Friend-only actions are hidden for strangers found through search. */
  isFriend?: boolean;
  muted?: boolean;
  onToggleMute?: () => void;
  onRemoveFriend?: () => void;
  /** Fired after a successful block so the caller can refetch its lists. */
  onBlocked?: () => void;
}

/**
 * Per-user moderation sheet: mute, report, block, remove.
 *
 * Block and report are App Store Guideline 1.2 requirements for apps with
 * user-generated content, so they have to be reachable from every place one
 * user can see another — hence a shared sheet rather than inline buttons.
 *
 * A plain Alert would have been shorter, but Android's dialog only renders
 * three buttons, and this list needs four.
 */
export function UserActionsSheet({
  user,
  onClose,
  context = 'friends',
  isFriend = false,
  muted = false,
  onToggleMute,
  onRemoveFriend,
  onBlocked,
}: Props) {
  const { t } = useTranslation();
  const [mode, setMode] = useState<'actions' | 'report'>('actions');
  const [reason, setReason] = useState<ReportReason | null>(null);
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);

  // Every open starts on the action list with an empty form.
  useEffect(() => {
    if (user) {
      setMode('actions');
      setReason(null);
      setDetails('');
      setBusy(false);
    }
  }, [user]);

  const handleBlock = useCallback(() => {
    if (!user) return;
    Alert.alert(
      t('moderation.blockTitle'),
      t('moderation.blockMsg', { name: user.username }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('moderation.block'),
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await friendsService.block(user.id);
              onBlocked?.();
              onClose();
              Alert.alert(t('moderation.blockedTitle'), t('moderation.blockedMsg', { name: user.username }));
            } catch (err: any) {
              Alert.alert(t('common.error'), err?.message ?? t('moderation.blockFailed'));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  }, [user, t, onBlocked, onClose]);

  const submitReport = useCallback(async () => {
    if (!user || !reason) return;
    setBusy(true);
    try {
      await friendsService.report(user.id, reason, details, context);
      onClose();
      Alert.alert(t('moderation.reportedTitle'), t('moderation.reportedMsg'));
    } catch (err: any) {
      Alert.alert(t('common.error'), err?.message ?? t('moderation.reportFailed'));
    } finally {
      setBusy(false);
    }
  }, [user, reason, details, context, t, onClose]);

  if (!user) return null;

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <TouchableOpacity style={styles.backdrop} activeOpacity={1} onPress={busy ? undefined : onClose}>
        <TouchableOpacity style={styles.sheet} activeOpacity={1}>
          <View style={styles.handle} />

          {mode === 'actions' ? (
            <>
              <Text style={styles.title}>{user.username}</Text>
              <Text style={styles.subtitle}>{t('moderation.sheetSubtitle')}</Text>

              {isFriend && onToggleMute && (
                <TouchableOpacity style={styles.action} onPress={onToggleMute} activeOpacity={0.8}>
                  <Text style={styles.actionIcon}>{muted ? '🔔' : '🔕'}</Text>
                  <Text style={styles.actionLabel}>
                    {muted ? t('friends.unmute') : t('friends.mute')}
                  </Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity style={styles.action} onPress={() => setMode('report')} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>🚩</Text>
                <Text style={styles.actionLabel}>{t('moderation.report')}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.action} onPress={handleBlock} disabled={busy} activeOpacity={0.8}>
                <Text style={styles.actionIcon}>🚫</Text>
                <Text style={[styles.actionLabel, styles.danger]}>{t('moderation.block')}</Text>
              </TouchableOpacity>

              {isFriend && onRemoveFriend && (
                <TouchableOpacity style={styles.action} onPress={onRemoveFriend} activeOpacity={0.8}>
                  <Text style={styles.actionIcon}>✕</Text>
                  <Text style={[styles.actionLabel, styles.danger]}>{t('friends.removeFriend')}</Text>
                </TouchableOpacity>
              )}

              <TouchableOpacity onPress={onClose} activeOpacity={0.7}>
                <Text style={styles.close}>{t('common.cancel')}</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <Text style={styles.title}>{t('moderation.reportTitle', { name: user.username })}</Text>
              <Text style={styles.subtitle}>{t('moderation.reportSubtitle')}</Text>

              <ScrollView keyboardShouldPersistTaps="handled" style={styles.reasonList}>
                {REASONS.map((r) => {
                  const selected = reason === r.id;
                  return (
                    <TouchableOpacity
                      key={r.id}
                      style={[styles.action, selected && styles.actionSelected]}
                      onPress={() => setReason(r.id)}
                      activeOpacity={0.8}
                    >
                      <Text style={styles.actionIcon}>{r.icon}</Text>
                      <Text style={styles.actionLabel}>{t(`moderation.reason.${r.id}`)}</Text>
                      {selected && <Text style={styles.check}>✓</Text>}
                    </TouchableOpacity>
                  );
                })}

                <TextInput
                  style={styles.details}
                  value={details}
                  onChangeText={setDetails}
                  placeholder={t('moderation.detailsPlaceholder')}
                  placeholderTextColor="#4a4a6a"
                  multiline
                  maxLength={500}
                />
              </ScrollView>

              <TouchableOpacity
                style={[styles.submit, (!reason || busy) && styles.submitDisabled]}
                onPress={submitReport}
                disabled={!reason || busy}
                activeOpacity={0.85}
              >
                {busy ? (
                  <ActivityIndicator color="#0d0d1a" />
                ) : (
                  <Text style={styles.submitText}>{t('moderation.sendReport')}</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity onPress={() => setMode('actions')} disabled={busy} activeOpacity={0.7}>
                <Text style={styles.close}>{t('common.back')}</Text>
              </TouchableOpacity>
            </>
          )}
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
    maxHeight: '85%',
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
  reasonList: { flexGrow: 0 },
  action: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    paddingVertical: 15,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  actionSelected: { borderColor: DANGER },
  actionIcon: { fontSize: 20, width: 26, textAlign: 'center' },
  actionLabel: { flex: 1, fontSize: 16, fontWeight: '600', color: TEXT },
  danger: { color: DANGER },
  check: { color: DANGER, fontSize: 18, fontWeight: '800' },
  details: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.08)',
    color: TEXT,
    fontSize: 15,
    padding: 14,
    minHeight: 88,
    textAlignVertical: 'top',
    marginBottom: 4,
  },
  submit: {
    backgroundColor: DANGER,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 14,
  },
  submitDisabled: { opacity: 0.45 },
  submitText: { color: '#ffffff', fontSize: 16, fontWeight: '800' },
  close: { color: MUTED, textAlign: 'center', marginTop: 16, fontSize: 15, fontWeight: '600' },
});
