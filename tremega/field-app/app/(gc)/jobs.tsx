// app/(gc)/jobs.tsx — My Jobs: work orders assigned to the contractor.
import { useCallback, useEffect, useState } from 'react';
import {
  FlatList, Pressable, RefreshControl, StyleSheet, Text, View,
} from 'react-native';
import { useRouter } from 'expo-router';
import { useWorkOrders, WorkOrder } from '../../src/stores/workOrders';
import { colors, spacing, touch, typography } from '../../src/lib/theme';

const STATUS_META: Record<string, { label: string; color: string }> = {
  assigned: { label: 'ASSIGNED', color: colors.info },
  in_progress: { label: 'IN PROGRESS', color: colors.accent },
  completed: { label: 'COMPLETED', color: colors.success },
};

export default function Jobs() {
  const router = useRouter();
  const { items, loading, fetchAll } = useWorkOrders();
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(null);
    try {
      await fetchAll();
    } catch (err: any) {
      const d = err?.response?.data;
      setError(d?.error?.message || d?.error || d?.errors?.[0]?.msg || 'Could not load jobs.');
    }
  }, [fetchAll]);

  useEffect(() => { load(); }, [load]);

  const renderItem = ({ item }: { item: WorkOrder }) => {
    const meta = STATUS_META[item.status] || STATUS_META.assigned;
    return (
      <Pressable
        style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}
        onPress={() => router.push(('/(gc)/job/' + item.id) as never)}
      >
        <Text style={styles.title}>{item.title}</Text>
        {item.job_address ? <Text style={styles.addr}>{item.job_address}</Text> : null}
        <View style={[styles.chip, { borderColor: meta.color }]}>
          <Text style={[styles.chipText, { color: meta.color }]}>{meta.label}</Text>
        </View>
      </Pressable>
    );
  };

  return (
    <View style={styles.root}>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <FlatList
        data={items}
        keyExtractor={(w) => w.id}
        renderItem={renderItem}
        refreshControl={(
          <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />
        )}
        ListEmptyComponent={!loading ? <Text style={styles.empty}>No jobs assigned yet.</Text> : null}
        contentContainerStyle={items.length === 0 ? styles.emptyGrow : undefined}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg, padding: spacing.lg },
  card: {
    backgroundColor: colors.card, borderColor: colors.cardBorder, borderWidth: 1,
    borderRadius: 12, padding: spacing.lg, marginBottom: spacing.md,
    minHeight: touch.minTarget, justifyContent: 'center',
  },
  cardPressed: { opacity: 0.75 },
  title: { ...typography.heading },
  addr: { ...typography.dim, marginTop: spacing.xs },
  chip: {
    alignSelf: 'flex-start', borderWidth: 1, borderRadius: 999,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs, marginTop: spacing.sm,
  },
  chipText: { fontSize: 12, fontWeight: '700', letterSpacing: 1 },
  empty: { ...typography.dim, textAlign: 'center', marginTop: spacing.xl },
  emptyGrow: { flexGrow: 1, justifyContent: 'center' },
  error: { ...typography.body, color: colors.danger, marginBottom: spacing.md, textAlign: 'center' },
});
