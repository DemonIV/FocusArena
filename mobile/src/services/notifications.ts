import { Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { api } from './api';
import i18n from '../i18n';

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
