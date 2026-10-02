// app/(gc)/orders.tsx — materials orders list (Phase 2 frontend spec, Orders tab).
// Read-only for now: status badges + ETA. The request-via-chat flow lands
// with the Claude chat bubble slice.
import { useEffect, useState } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { api } from '../../src/lib/api';
import { cacheGet, cacheSet, TTL } from '../../src/lib/offline';
import { SkeletonList } from '../../src/components/Skeleton';
import { colors, spacing, typography } from '../../src/lib/theme';

interface Order {
  id: string;
  status: string;
  supplier?: string | null;
  total?: number | null;
  created_at: string;
  submitted_at?: string | null;
  items?: Array<{ name?: string; quantity?: number }>;
}

const STATUS_COLORS: Record<string, string> = {
  draft: colors.textDim,
  pending_approval: colors.warning,
  approved: colors.success,
  submitted: colors.info,
  rejected: colors.danger,
  delivered: colors.success,
};

const badgeColor = (status: string) => STATUS_COLORS[status] ?? colors.textDim;

export default function OrdersTab() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);

  const load = async () => {
    try {
      setError(null);
      const { data } = await api.get('/api/orders');
      const list = (data.orders || []).slice(0, 20);
      setOrders(list);
      setFromCache(false);
      cacheSet('orders_cache_all', list);
    } catch (err: any) {
      const cached = await cacheGet<Order[]>('orders_cache_all', TTL.orders);
      if (cached) {
        setOrders(cached.data);
        setFromCache(true);
      } else {
        setError(err?.response?.data?.error?.message || err.message || 'Failed to load orders');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  return (
    <View style={styles.root}>
      <FlatList
        data={orders}
        keyExtractor={(o) => o.id}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.accent} />}
        contentContainerStyle={orders.length === 0 && !loading ? styles.emptyContainer : styles.list}
        ListEmptyComponent={
          loading ? (
            <SkeletonList count={4} height={96} />
          ) : (
            <View style={styles.empty}>
              <Text style={typography.title}>No orders yet</Text>
              <Text style={[typography.dim, { marginTop: spacing.sm, textAlign: 'center' }]}>
                {error ? `Couldn't load orders: ${error}` : 'Material requests you make through Claude will show up here with approval status.'}
              </Text>
            </View>
          )
        }
        renderItem={({ item }) => (
          <View style={styles.card}>
            <View style={styles.row}>
              <Text style={styles.cardTitle} numberOfLines={1}>
                {item.supplier || 'Material order'}
              </Text>
              <View style={[styles.badge, { borderColor: badgeColor(item.status) }]}>
                <Text style={[styles.badgeText, { color: badgeColor(item.status) }]}>
                  {item.status.replace(/_/g, ' ')}
                </Text>
              </View>
            </View>
            {item.items?.slice(0, 3).map((line, i) => (
              <Text key={i} style={typography.dim} numberOfLines={1}>
                • {line.name ?? 'item'}{line.quantity != null ? ` ×${line.quantity}` : ''}
              </Text>
            ))}
            <Text style={[typography.dim, styles.meta]}>
              {new Date(item.created_at).toLocaleDateString()}
              {item.total != null ? ` · $${Number(item.total).toFixed(2)}` : ''}
            </Text>
          </View>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { padding: spacing.lg, gap: spacing.md },
  emptyContainer: { flex: 1 },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },
  card: {
    backgroundColor: colors.card,
    borderColor: colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: spacing.lg,
    gap: spacing.xs,
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardTitle: { ...typography.heading, flex: 1 },
  badge: { borderWidth: 1, borderRadius: 10, paddingVertical: 2, paddingHorizontal: spacing.sm },
  badgeText: { fontSize: 12, fontWeight: '600', textTransform: 'capitalize' },
  meta: { marginTop: spacing.xs, fontSize: 13 },
});
