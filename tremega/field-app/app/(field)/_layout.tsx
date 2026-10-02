// app/(field)/_layout.tsx — field worker tabs: Home, Time, Tasks, Photos, More.
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import type { ColorValue } from 'react-native';
import { colors } from '../../src/lib/theme';

// Text-glyph tab icons for the skeleton (icon library lands with the design pass).
const glyph = (char: string) =>
  function TabGlyph({ color }: { color: ColorValue }) {
    return <Text style={{ color, fontSize: 20 }}>{char}</Text>;
  };

export default function FieldLayout() {
  return (
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
      <Tabs.Screen name="time" options={{ title: 'Time', tabBarIcon: glyph('◷') }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks', tabBarIcon: glyph('☑') }} />
      <Tabs.Screen name="photos" options={{ title: 'Photos', tabBarIcon: glyph('📷') }} />
      <Tabs.Screen name="more" options={{ title: 'More', tabBarIcon: glyph('☰') }} />
    </Tabs>
  );
}
