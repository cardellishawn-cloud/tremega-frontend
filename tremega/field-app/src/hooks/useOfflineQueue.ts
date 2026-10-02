// src/hooks/useOfflineQueue.ts — offline message queue (Slice 6).
// Failed network sends land in an AsyncStorage-backed queue; NetInfo
// reconnect (or manual syncQueue) replays them. Max 3 retries per item.
import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../lib/api';
import { subscribeOnline } from '../lib/offline';

const QUEUE_KEY = 'offline_queue_v1';
const MAX_RETRIES = 3;

export interface QueueItem {
  id: string;
  type: 'message';
  payload: { projectId: string; message: string };
  endpoint: string;
  status: 'pending' | 'synced' | 'error';
  createdAt: string;
  retries: number;
}

let nextQid = 1;
const qid = () => `q-${Date.now()}-${nextQid++}`;

async function loadQueue(): Promise<QueueItem[]> {
  try {
    const raw = await AsyncStorage.getItem(QUEUE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((i) => i.status !== 'synced') : [];
  } catch {
    return [];
  }
}

async function saveQueue(items: QueueItem[]): Promise<void> {
  try {
    await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(items.filter((i) => i.status !== 'synced')));
  } catch { /* best-effort */ }
}

export interface SyncResult {
  item: QueueItem;
  ok: boolean;
  response?: any;
  error?: string;
}

interface QueueState {
  queue: QueueItem[];
  isOnline: boolean;
  isSyncing: boolean;
  add: (item: Omit<QueueItem, 'id' | 'status' | 'createdAt' | 'retries'>) => Promise<QueueItem>;
  remove: (id: string) => Promise<void>;
  markError: (id: string) => Promise<void>;
  syncQueue: () => Promise<SyncResult[]>;
}

export function useOfflineQueue(): QueueState {
  const [queue, setQueue] = useState<QueueItem[]>([]);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncingRef = useRef(false);

  useEffect(() => {
    loadQueue().then(setQueue);
    return subscribeOnline((nowOnline) => {
      setIsOnline(nowOnline);
      if (nowOnline) syncQueue();
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persist = useCallback(async (items: QueueItem[]) => {
    setQueue(items);
    await saveQueue(items);
  }, []);

  const add = useCallback<QueueState['add']>(async (item) => {
    const full: QueueItem = {
      ...item,
      id: qid(),
      status: 'pending',
      createdAt: new Date().toISOString(),
      retries: 0,
    };
    const items = [...(await loadQueue()), full];
    await persist(items);
    return full;
  }, [persist]);

  const remove = useCallback(async (id: string) => {
    await persist((await loadQueue()).filter((i) => i.id !== id));
  }, [persist]);

  const markError = useCallback(async (id: string) => {
    const items = (await loadQueue()).map((i) => (i.id === id ? { ...i, status: 'error' as const } : i));
    await persist(items);
  }, [persist]);

  const syncQueue = useCallback(async (): Promise<SyncResult[]> => {
    if (syncingRef.current) return [];
    syncingRef.current = true;
    setIsSyncing(true);
    const results: SyncResult[] = [];
    try {
      let items = await loadQueue();
      for (const item of items) {
        if (item.status === 'synced') continue;
        if (item.retries >= MAX_RETRIES) {
          if (item.status !== 'error') {
            item.status = 'error';
            results.push({ item, ok: false, error: 'max retries' });
          }
          continue;
        }
        try {
          const { data } = await api.post(item.endpoint, {
            projectId: item.payload.projectId,
            message: item.payload.message,
            conversationHistory: [],
          });
          item.status = 'synced';
          results.push({ item, ok: true, response: data });
        } catch (err: any) {
          item.retries += 1;
          if (item.retries >= MAX_RETRIES) item.status = 'error';
          results.push({
            item,
            ok: false,
            error: err?.response?.data?.error?.message || err.message || 'sync failed',
          });
        }
      }
      items = items.filter((i) => i.status !== 'synced');
      await persist(items);
      return results;
    } finally {
      syncingRef.current = false;
      setIsSyncing(false);
    }
  }, [persist]);

  return { queue, isOnline, isSyncing, add, remove, markError, syncQueue };
}
