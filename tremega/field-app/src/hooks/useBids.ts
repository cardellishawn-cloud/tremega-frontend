// src/hooks/useBids.ts — bid history for the Estimates tab.
// GET /api/bids returns an ARRAY of bids (contractor-scoped server-side);
// statuses are draft/sent/accepted/rejected/expired, mapped to the spec's
// pending/won/lost buckets for display + filtering.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { api } from '../lib/api';

export type BidStatus = 'won' | 'lost' | 'pending';
export type BidFilter = 'all' | BidStatus;

export interface BidLineItem {
  id: string;
  description: string;
  quantity: number | null;
  unit: string | null;
  unit_price: number | null;
  amount: number | null;
}

export interface Bid {
  id: string;
  date: string;
  job_name: string;
  customer: string | null;
  amount: number | null;
  status: BidStatus;
  rawStatus: string;
  scope: string | null;
  materials: BidLineItem[];
  labor_hours: number | null;
  pdf_url: string | null;
  notes: string | null;
}

const toSpecStatus = (raw: string): BidStatus => {
  if (raw === 'accepted') return 'won';
  if (raw === 'rejected' || raw === 'expired') return 'lost';
  return 'pending'; // draft, sent, anything else
};

interface BidsState {
  bids: Bid[];
  filtered: Bid[];
  filter: BidFilter;
  setFilter: (f: BidFilter) => void;
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

export function useBids(): BidsState {
  const [bids, setBids] = useState<Bid[]>([]);
  const [filter, setFilter] = useState<BidFilter>('all');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchBids = useCallback(async () => {
    try {
      setError(null);
      const { data } = await api.get('/api/bids');
      const list = Array.isArray(data) ? data : data?.bids || [];
      setBids(list.map((b: any): Bid => ({
        id: b.id,
        date: b.created_at || b.sent_at || '',
        job_name: b.title || 'Untitled bid',
        customer: b.customer_name || null,
        amount: b.total != null ? Number(b.total) : (b.estimated_amount != null ? Number(b.estimated_amount) : null),
        status: toSpecStatus(String(b.status || 'draft')),
        rawStatus: String(b.status || 'draft'),
        scope: b.description || null,
        materials: Array.isArray(b.line_items) ? b.line_items : (Array.isArray(b.lineItems) ? b.lineItems : []),
        labor_hours: b.labor_hours ?? null,
        pdf_url: b.pdf_url ?? null,
        notes: b.notes ?? null,
      })));
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || err?.response?.data?.error || err.message || 'Failed to load bids');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => { fetchBids(); }, [fetchBids]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await fetchBids();
  }, [fetchBids]);

  const filtered = useMemo(
    () => (filter === 'all' ? bids : bids.filter((b) => b.status === filter)),
    [bids, filter],
  );

  return { bids, filtered, filter, setFilter, loading, refreshing, error, refresh };
}
