// src/components/QuickActionBar.tsx — horizontal starter chips (empty chat).
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';
import { colors, spacing } from '../lib/theme';

const ACTIONS = [
  'Order materials',
  "What's today's status?",
  'Create estimate',
];

export function QuickActionBar({ onPick, disabled }: { onPick: (text: string) => void; disabled?: boolean }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {ACTIONS.map((a) => (
        <Pressable
          key={a}
          style={[styles.chip, disabled && { opacity: 0.5 }]}
          disabled={disabled}
          onPress={() => onPick(a)}
        >
          <Text style={styles.chipText}>{a}</Text>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { gap: spacing.sm, paddingVertical: spacing.sm },
  chip: {
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.md,
  },
  chipText: { color: colors.accent, fontSize: 14, fontWeight: '600' },
});
