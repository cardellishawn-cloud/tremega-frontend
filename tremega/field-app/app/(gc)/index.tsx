// app/(gc)/index.tsx — GC dashboard home (dark command center, Week 3-4 fills it).
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Link } from 'expo-router';
import { useAuth } from '../../src/stores/auth';
import { colors, spacing, typography } from '../../src/lib/theme';

const StatCard = ({ label, value }: { label: string; value: string }) => (
  <View style={styles.stat}>
    <Text style={styles.statValue}>{value}</Text>
    <Text style={styles.statLabel}>{label}</Text>
  </View>
);

export default function GcHome() {
  const { user } = useAuth();
  return (
    <View style={styles.root}>
      <Text style={typography.title}>Command Center</Text>
      <Text style={[typography.dim, { marginTop: spacing.xs }]}>
        {user?.full_name || user?.email} · {user?.role}
      </Text>
      <View style={styles.grid}>
        <StatCard label="Crew on site" value="—" />
        <StatCard label="Open approvals" value="—" />
        <StatCard label="Active orders" value="—" />
        <StatCard label="Flags today" value="—" />
      </View>
      <Link href="/(gc)/jobs" asChild>
        <Pressable style={styles.jobsCard}>
          <Text style={styles.jobsCardTitle}>My Jobs →</Text>
          <Text style={typography.dim}>Work orders assigned to you: check in on site, start work, mark complete.</Text>
        </Pressable>
      </Link>
      <Text style={[typography.dim, { marginTop: spacing.lg }]}>
        Live crew map, approvals inbox, and budget overview land here in Week 3-4.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  grid: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.xl,
  },
  stat: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: spacing.lg, minWidth: '45%', flexGrow: 1,
  },
  statValue: { ...typography.title, color: colors.accent },
  statLabel: { ...typography.dim, marginTop: spacing.xs },
  jobsCard: {
    backgroundColor: colors.card, borderColor: colors.accent, borderWidth: 1,
    borderRadius: 12, padding: spacing.lg, marginTop: spacing.xl, gap: spacing.xs,
  },
  jobsCardTitle: { ...typography.title, color: colors.accent },
});
