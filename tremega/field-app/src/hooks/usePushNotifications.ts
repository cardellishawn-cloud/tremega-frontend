// src/hooks/usePushNotifications.ts — Expo push registration + tap routing (Slice 6).
//
// - Requests permission, fetches the Expo push token, registers it with
//   POST /api/push/token. Best-effort: any failure leaves the app fully
//   functional (notifications are optional).
// - Notification taps deep-link by payload: data.tab -> /(gc)/<tab>.
// - Needs a physical device for a real token; simulators/Expo Go degrade
//   gracefully (token null, nothing crashes).
import { useEffect, useRef } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { useRouter } from 'expo-router';
import { api } from '../lib/api';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

const routeForTab = (tab: unknown): string | null => {
  const known = ['home', 'jobs', 'checkins', 'activity', 'orders', 'crew', 'estimates', 'more'];
  return typeof tab === 'string' && known.includes(tab) ? `/(gc)/${tab}` : null;
};

export function usePushNotifications() {
  const router = useRouter();
  const registered = useRef(false);

  useEffect(() => {
    if (registered.current) return;
    registered.current = true;

    (async () => {
      try {
        if (!Device.isDevice) return; // simulators can't get push tokens

        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (existing !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted') return;

        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('default', {
            name: 'default',
            importance: Notifications.AndroidImportance.DEFAULT,
          }).catch(() => {});
        }

        const projectId =
          Constants.easConfig?.projectId ?? Constants.expoConfig?.extra?.eas?.projectId;
        const tokenResult = await Notifications.getExpoPushTokenAsync(
          projectId ? { projectId } : undefined,
        );
        const token = tokenResult?.data;
        if (!token) return;

        await api.post('/api/push/token', { token, platform: Platform.OS }).catch(() => {});
      } catch { /* push stays disabled; never crash for it */ }
    })();

    const sub = Notifications.addNotificationResponseReceivedListener((response) => {
      try {
        const data = response.notification.request.content.data || {};
        const route = routeForTab(data.tab);
        if (route) router.push(route as never);
      } catch { /* ignore malformed payloads */ }
    });
    return () => sub.remove();
  }, [router]);
}
