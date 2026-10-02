// src/components/OfflineBanner.tsx — "No internet — using cached data" strip.
// NetInfo-driven, dismissible. Mounted once in app/(gc)/_layout.tsx.
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { subscribeOnline } from '../lib/offline';
import { colors, spacing } from '../lib/theme';

export function OfflineBanner() {
  const [online, setOnline] = useState(true);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => subscribeOnline((nowOnline) => {
    setOnline(nowOnline);
    if (!nowOnline) setDismissed(false); // re-show on each new outage
  }), []);

  if (online || dismissed) return null;

  return (
    <View style={styles.banner}>
      <Text style={styles.text}>📡 No internet — using cached data. Sends will queue.</Text>
      <Pressable onPress={() => setDismissed(true)} hitSlop={12}>
        <Text style={styles.close}>✕</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.accent,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
    gap: spacing.sm,
  },
  text: { color: colors.accentText, fontSize: 13, fontWeight: '600', flex: 1 },
  close: { color: colors.accentText, fontSize: 14, fontWeight: '700' },
});
