// app/(gc)/_layout.tsx — GC tabs: Home, Jobs, Map, Orders, More.
// Job detail stays routable but hidden from the tab bar.
import { Tabs } from 'expo-router';
import { Text, View } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors } from '../../src/lib/theme';
import { ChatWidget } from '../../src/components/ChatWidget';
import { OfflineBanner } from '../../src/components/OfflineBanner';
import { usePushNotifications } from '../../src/hooks/usePushNotifications';

const glyph = (char: string) =>
  function TabGlyph({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{char}</Text>;
  };

export default function GcLayout() {
  usePushNotifications();
  return (
    <View style={{ flex: 1 }}>
      <OfflineBanner />
      <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.text,
        tabBarStyle: { backgroundColor: colors.card, borderTopColor: colors.cardBorder, minHeight: 64 },
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.textDim,
      }}
    >
      <Tabs.Screen name="index" options={{ title: 'Home', tabBarIcon: glyph('⌂') }} />
      <Tabs.Screen name="jobs" options={{ title: 'Jobs', tabBarIcon: glyph('☑') }} />
      <Tabs.Screen name="checkins" options={{ title: 'Map', tabBarIcon: glyph('◎') }} />
      <Tabs.Screen name="activity" options={{ title: 'Activity', tabBarIcon: glyph('◷') }} />
      <Tabs.Screen name="orders" options={{ title: 'Orders', tabBarIcon: glyph('▤') }} />
      <Tabs.Screen name="crew" options={{ title: 'Crew', tabBarIcon: glyph('👷') }} />
      <Tabs.Screen name="estimates" options={{ title: 'Estimates', tabBarIcon: glyph('💼') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: glyph('☰') }} />
      <Tabs.Screen name="job/[id]" options={{ href: null }} />
      </Tabs>
      <ChatWidget />
    </View>
  );
}
