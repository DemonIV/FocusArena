import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import i18n from '../i18n';
import { useSettingsStore } from '../stores/settingsStore';

// Foreground behaviour: show an alert + play a sound when a push arrives.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Resolve the EAS projectId required by getExpoPushTokenAsync (if configured). */
function getProjectId(): string | undefined {
  return (
    Constants.expoConfig?.extra?.eas?.projectId ??
    (Constants as unknown as { easConfig?: { projectId?: string } }).easConfig?.projectId
  );
}

/**
 * Ask for permission, obtain the Expo push token, and register it with the
 * backend (together with the current UI language so reminders are localized).
 *
 * Fully best-effort: any failure (Expo Go limitations, missing projectId,
 * denied permission, simulator) is swallowed and returns null.
 */
export async function registerForPushNotifications(): Promise<string | null> {
  try {
    if (!Device.isDevice) return null;

    // Registering server-side re-enables delivery — never do it when the user
    // has switched notifications off in the app.
    if (!useSettingsStore.getState().pushEnabled) return null;

    // Android needs an explicit channel for notifications to show.
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('default', {
        name: 'default',
        importance: Notifications.AndroidImportance.DEFAULT,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#00d2ff',
      });
    }

    const { status: existing } = await Notifications.getPermissionsAsync();
    let status = existing;
    if (status !== 'granted') {
      const req = await Notifications.requestPermissionsAsync();
      status = req.status;
    }
    if (status !== 'granted') return null;

    const projectId = getProjectId();
    const tokenResponse = await Notifications.getExpoPushTokenAsync(
      projectId ? { projectId } : undefined,
    );
    const token = tokenResponse.data;
    if (!token) return null;

    await api.post('/notifications/register', {
      token,
      language: i18n.language?.split('-')[0],
    });

    return token;
  } catch (err) {
    console.warn('[push] registration skipped:', (err as Error).message);
    return null;
  }
}

/** Tell the backend to stop notifying this device (logout / opt-out). */
export async function unregisterPushNotifications(): Promise<void> {
  try {
    await api.post('/notifications/unregister');
  } catch {
    /* best-effort */
  }
}

/**
 * Toggle push delivery server-side without dropping the token. When turning
 * ON, also (re)registers in case no token is on file yet.
 */
export async function setPushEnabled(enabled: boolean): Promise<void> {
  await api.post('/notifications/settings', { enabled });
  if (enabled) void registerForPushNotifications();
}

// ─── Tap handling / deep links ────────────────────────────────

/** Which main tab a tapped notification should land on, by data.type. */
const TAP_TARGET: Record<string, string> = {
  streak_danger: 'Timer',
  winback: 'Timer',
  friend_request: 'Friends',
  friend_accepted: 'Friends',
  friend_studying: 'Timer', // "join them" — land ready to start a session
  referral_redeemed: 'Friends',
};

/**
 * Route notification taps (both cold-start and while running) to the right
 * tab. Returns an unsubscribe function.
 */
export function subscribeNotificationTaps(navigate: (tab: string) => void): () => void {
  const handle = (response: Notifications.NotificationResponse | null) => {
    const type = response?.notification.request.content.data?.type;
    const tab = typeof type === 'string' ? TAP_TARGET[type] : undefined;
    if (tab) navigate(tab);
  };

  // App was launched by tapping a notification
  Notifications.getLastNotificationResponseAsync()
    .then(handle)
    .catch(() => { /* best-effort */ });

  // Taps while the app is foregrounded/backgrounded
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}
