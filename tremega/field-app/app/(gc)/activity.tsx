// app/(gc)/activity.tsx — Activity tab: "Today's Work Log" (Phase 2 frontend spec).
// Phase selector + clock in/out with live timer + collapsible per-phase log.
import { useMemo } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useActivity } from '../../src/hooks/useActivity';
import { PhaseSelector } from '../../src/components/PhaseSelector';
import { ClockButton } from '../../src/components/ClockButton';
import { WorkLogCard } from '../../src/components/WorkLogCard';
import { DailyTotal } from '../../src/components/DailyTotal';
import { SkeletonList } from '../../src/components/Skeleton';
import { useWorkOrders } from '../../src/stores/workOrders';
import { colors, spacing, typography } from '../../src/lib/theme';

export default function ActivityTab() {
  const { items, fetchAll } = useWorkOrders();
  const job = useMemo(
    () => items.find((w) => w.status !== 'completed') ?? items[0] ?? null,
    [items],
  );
  const activity = useActivity(job?.id ?? null);

  const grouped = useMemo(() => {
    const byPhase = new Map<string, typeof activity.todayLogs>();
    for (const entry of activity.todayLogs) {
      const list = byPhase.get(entry.phase) ?? [];
      list.push(entry);
      byPhase.set(entry.phase, list);
    }
    return [...byPhase.entries()];
  }, [activity.todayLogs]);

  if (!job) {
    return (
      <View style={styles.center}>
        <Text style={typography.title}>No job assigned</Text>
        <Text style={[typography.dim, { marginTop: spacing.sm, textAlign: 'center' }]}>
          Time logging needs an active job. Pull to refresh on the Jobs tab once one is assigned.
        </Text>
        <Pressable style={styles.retry} onPress={() => fetchAll().catch(() => {})}>
          <Text style={styles.retryText}>Retry</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <Text style={typography.title}>Today's Work Log</Text>
      <Text style={typography.dim} numberOfLines={1}>{job.title}</Text>

      {activity.loading ? (
        <View style={{ marginTop: spacing.md }}>
          <SkeletonList count={3} height={96} />
        </View>
      ) : (
        <>
          <PhaseSelector
            phases={activity.phases.length ? activity.phases : ['framing', 'electrical', 'concrete', 'finish', 'break', 'off-site']}
            value={activity.currentPhase}
            onChange={activity.setPhase}
            disabled={activity.isClocked}
          />

          <ClockButton
            isClocked={activity.isClocked}
            elapsedMs={activity.elapsedMs}
            busy={activity.busy}
            onClockIn={activity.clockIn}
            onClockOut={activity.clockOut}
          />

          {activity.error && (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>{activity.error}</Text>
              <Pressable onPress={activity.refresh}>
                <Text style={styles.retryText}>Retry</Text>
              </Pressable>
            </View>
          )}

          {grouped.map(([phase, entries]) => (
            <WorkLogCard key={phase} phase={phase} entries={entries} />
          ))}

          <DailyTotal logs={activity.todayLogs} elapsedMs={activity.elapsedMs} />
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  content: { padding: spacing.lg, gap: spacing.md, paddingBottom: spacing.xl },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  retry: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  retryText: { ...typography.body, color: colors.accent, fontWeight: '600' },
  errorBox: {
    borderColor: colors.danger,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.md,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  errorText: { ...typography.dim, color: colors.danger, flex: 1 },
});
