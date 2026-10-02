// src/components/Placeholder.tsx — scaffolding screen body for Week 2-3 builds.
import { StyleSheet, Text, View } from 'react-native';
import { colors, spacing, typography } from '../lib/theme';

export default function Placeholder({ title, note }: { title: string; note: string }) {
  return (
    <View style={styles.root}>
      <View style={styles.card}>
        <Text style={typography.heading}>{title}</Text>
        <Text style={[typography.dim, { marginTop: spacing.sm }]}>{note}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.md },
  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: spacing.lg,
  },
});
