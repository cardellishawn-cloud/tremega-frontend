// src/components/DailyTotal.tsx — "Total Today: X h Y m" footer.
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';
import { fmtDuration } from '../lib/time';
import type { ActivityEntry } from '../hooks/useActivity';

export function DailyTotal({ logs, elapsedMs }: { logs: ActivityEntry[]; elapsedMs: number }) {
  const totalMs = logs.reduce((sum, e) => sum + e.duration, 0) + elapsedMs;
  return (
    <View style={styles.row}>
      <Text style={styles.label}>Total Today</Text>
      <Text style={styles.value}>{fmtDuration(totalMs)}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    marginTop: spacing.sm,
  },
  label: { ...typography.body, fontWeight: '600' },
  value: { ...typography.heading, color: colors.accent },
});
