// app/(gc)/estimates.tsx — Estimates tab: bid history with status filter,
// amounts, and expandable scope/line-item detail (Phase 2 frontend spec).
import { ActivityIndicator, FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { useBids, type BidFilter } from '../../src/hooks/useBids';
import { BidCard } from '../../src/components/BidCard';
import { SkeletonList } from '../../src/components/Skeleton';
import { colors, spacing, typography } from '../../src/lib/theme';

const FILTERS: Array<{ key: BidFilter; label: string }> = [
  { key: 'all', label: 'All' },
  { key: 'won', label: 'Won' },
  { key: 'lost', label: 'Lost' },
  { key: 'pending', label: 'Pending' },
];

export default function EstimatesTab() {
  const { filtered, bids, filter, setFilter, loading, refreshing, error, refresh } = useBids();

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <Text style={typography.title}>Bid History</Text>
        <View style={styles.chips}>
          {FILTERS.map((f) => {
            const active = filter === f.key;
            const count = f.key === 'all' ? bids.length : bids.filter((b) => b.status === f.key).length;
            return (
              <Pressable
                key={f.key}
                style={[styles.chip, active && styles.chipActive]}
                onPress={() => setFilter(f.key)}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>
                  {f.label} ({count})
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {loading ? (
        <View style={styles.list}>
          <SkeletonList count={3} height={110} />
        </View>
      ) : error ? (
        <View style={styles.center}>
          <Text style={styles.errorText}>Failed to load bids</Text>
          <Text style={[typography.dim, { marginTop: spacing.xs, textAlign: 'center' }]}>{error}</Text>
          <Pressable style={styles.retry} onPress={refresh}>
            <Text style={styles.retryText}>Retry</Text>
          </Pressable>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(b) => b.id}
          renderItem={({ item }) => <BidCard bid={item} />}
          contentContainerStyle={filtered.length === 0 ? styles.emptyContainer : styles.list}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.accent} />}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Text style={styles.emptyGlyph}>💼</Text>
              <Text style={typography.title}>
                {filter === 'all' ? 'No bids yet' : `No ${filter} bids`}
              </Text>
              <Text style={[typography.dim, { marginTop: spacing.sm, textAlign: 'center' }]}>
                Bids you create will show up here with amounts, status, and scope.
              </Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { padding: spacing.lg, paddingBottom: spacing.sm, gap: spacing.md },
  chips: { flexDirection: 'row', gap: spacing.sm },
  chip: {
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 16,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.md,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.card },
  chipText: { ...typography.dim, fontSize: 13 },
  chipTextActive: { color: colors.accent, fontWeight: '700' },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  errorText: { ...typography.heading, color: colors.danger },
  retry: { marginTop: spacing.lg, paddingVertical: spacing.sm, paddingHorizontal: spacing.xl },
  retryText: { ...typography.body, color: colors.accent, fontWeight: '600' },
  list: { padding: spacing.lg, gap: spacing.md, paddingTop: spacing.sm },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  emptyGlyph: { fontSize: 40, marginBottom: spacing.md },
});
