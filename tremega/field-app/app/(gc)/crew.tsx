// app/(gc)/crew.tsx — Crew tab: team roster with location/status + call/text.
// Data: /api/crews (users table roster + latest-checkin location/status).
import { useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useCrew, type CrewMember } from '../../src/hooks/useCrew';
import { CrewCard } from '../../src/components/CrewCard';
import { CrewDetailSheet } from '../../src/components/CrewDetailSheet';
import { SkeletonList } from '../../src/components/Skeleton';
import { useWorkOrders } from '../../src/stores/workOrders';
import { colors, spacing, typography } from '../../src/lib/theme';

export default function CrewTab() {
  const { items } = useWorkOrders();
  const job = useMemo(
    () => items.find((w) => w.status !== 'completed') ?? items[0] ?? null,
    [items],
  );
  const { crew, loading, refreshing, error, gpsAvailable, refresh } = useCrew(job?.id ?? null);
  const [selected, setSelected] = useState<CrewMember | null>(null);

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={typography.title} numberOfLines={1}>
          {job ? `${job.title} Crew` : 'Crew'}
        </Text>
        <View style={styles.countBadge}>
          <Text style={styles.countText}>{crew.length} member{crew.length === 1 ? '' : 's'}</Text>
        </View>
      </View>

      {!gpsAvailable && (
        <Text style={styles.gpsNote}>Enable location to see distances to crew.</Text>
      )}
      {error && <Text style={styles.errorText}>{error}</Text>}

      {loading ? (
        <View style={styles.loadingWrap}>
          <SkeletonList count={4} height={76} />
        </View>
      ) : (
        <FlatList
          data={crew}
          keyExtractor={(m) => m.id}
          renderItem={({ item }) => <CrewCard member={item} onPress={setSelected} />}
          contentContainerStyle={crew.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyGlyph}>👷</Text>
              <Text style={typography.title}>No crew assigned to this job</Text>
              <Text style={[typography.dim, { marginTop: spacing.sm, textAlign: 'center' }]}>
                Crew members appear here once they're part of your team.
              </Text>
            </View>
          }
        />
      )}

      <CrewDetailSheet member={selected} onClose={() => setSelected(null)} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.sm,
  },
  countBadge: {
    backgroundColor: colors.card,
    borderColor: colors.accent,
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 2,
    paddingHorizontal: spacing.sm,
  },
  countText: { color: colors.accent, fontSize: 12, fontWeight: '700' },
  gpsNote: { ...typography.dim, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  errorText: { ...typography.dim, color: colors.danger, paddingHorizontal: spacing.lg, marginBottom: spacing.xs },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  loadingWrap: { padding: spacing.lg, paddingTop: spacing.sm },
  list: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.sm },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyGlyph: { fontSize: 40, marginBottom: spacing.md },
});
