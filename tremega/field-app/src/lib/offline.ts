// src/lib/offline.ts — AsyncStorage cache helpers + NetInfo online state.
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

export interface Cached<T> {
  data: T;
  lastFetch: string; // ISO
}

export async function cacheSet<T>(key: string, data: T): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify({ data, lastFetch: new Date().toISOString() }));
  } catch { /* cache write is best-effort */ }
}

export async function cacheGet<T>(key: string, ttlMs?: number): Promise<Cached<T> | null> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Cached<T>;
    if (!parsed || parsed.data === undefined) return null;
    if (ttlMs !== undefined) {
      const age = Date.now() - new Date(parsed.lastFetch).getTime();
      if (age > ttlMs) return null; // expired
    }
    return parsed;
  } catch {
    return null;
  }
}

export const TTL = {
  crew: 5 * 60 * 1000,
  orders: 60 * 60 * 1000,
  activity: 60 * 60 * 1000,
};

// Live online flag, refreshed by NetInfo. subscribeOnline fires on change.
let online = true;
NetInfo.fetch().then((s) => { online = s.isConnected !== false; }).catch(() => {});
NetInfo.addEventListener((s) => { online = s.isConnected !== false; });

export const isOnline = () => online;

export function subscribeOnline(cb: (isOnline: boolean) => void): () => void {
  const sub = NetInfo.addEventListener((s) => cb(s.isConnected !== false));
  return () => sub();
}
