import { useCallback } from 'react';
import { Share } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useAuthStore } from '../stores/authStore';
import { track } from '../services/analytics';

/**
 * Opens the native share sheet with a localized invite message.
 * The referral "code" is the inviter's username — the invitee enters it
 * in Friends → invite box and both sides earn coins.
 */
export function useInviteShare(source: string) {
  const { t } = useTranslation();
  const username = useAuthStore((s) => s.user?.username);

  return useCallback(async () => {
    if (!username) return;
    track('invite_share_opened', { source });
    try {
      await Share.share({ message: t('invite.shareMessage', { username }) });
    } catch {
      /* share sheet dismissed */
    }
  }, [username, source, t]);
}
