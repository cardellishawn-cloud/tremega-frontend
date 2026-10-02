// src/components/StatusBadge.tsx — on-site / break / off-site dot + label.
import { StyleSheet, Text, View } from 'react-native';
import { colors } from '../lib/theme';

const CONFIG: Record<string, { color: string; label: string }> = {
  'on-site': { color: colors.success, label: 'On-site' },
  break: { color: colors.accent, label: 'Break' },
  'off-site': { color: colors.textDim, label: 'Off-site' },
  won: { color: colors.success, label: 'Won' },
  lost: { color: colors.danger, label: 'Lost' },
  pending: { color: colors.accent, label: 'Pending' },
};

export function StatusBadge({ status }: { status: string }) {
  const c = CONFIG[status] ?? CONFIG['off-site'];
  return (
    <View style={styles.row}>
      <View style={[styles.dot, { backgroundColor: c.color }]} />
      <Text style={[styles.label, { color: c.color }]}>{c.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  label: { fontSize: 12, fontWeight: '600' },
});
