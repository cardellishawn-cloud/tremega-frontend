// src/hooks/useCrew.ts — crew roster + live distances for the Crew tab.
// GET /api/crews?job_id= — location/status come from each member's latest
// check-in (server-side). No realtime subscription yet: pull-to-refresh.
import { useCallback, useEffect, useState } from 'react';
import * as Location from 'expo-location';
import { api } from '../lib/api';
import { distanceMeters } from '../lib/geo';
import { cacheGet, cacheSet, TTL } from '../lib/offline';

export interface CrewMember {
  id: string;
  job_id: string | null;
  name: string;
  role: string;
  phone: string | null;
  avatar_url: string | null;
  status: 'on-site' | 'break' | 'off-site';
  latitude: number | null;
  longitude: number | null;
  last_location_update: string | null;
  eta: string | null;
  distanceM: number | null; // computed client-side from device GPS
}

interface CrewState {
  crew: CrewMember[];
  loading: boolean;
  refreshing: boolean;
  error: string | null;
  gpsAvailable: boolean;
  fromCache: boolean;
  refresh: () => Promise<void>;
}

export function useCrew(jobId: string | null): CrewState {
  const [crew, setCrew] = useState<CrewMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const [gpsAvailable, setGpsAvailable] = useState(false);
  const [myPos, setMyPos] = useState<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') return;
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        setMyPos({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
        setGpsAvailable(true);
      } catch { /* distances stay null */ }
    })();
  }, []);

  const refresh = useCallback(async () => {
    const cacheKey = `crew_cache_${jobId || 'all'}`;
    try {
      setError(null);
      const { data } = await api.get('/api/crews', { params: jobId ? { job_id: jobId } : {} });
      const withDist: CrewMember[] = (data.crew || []).map((m: CrewMember) => ({
        ...m,
        distanceM:
          myPos && m.latitude != null && m.longitude != null
            ? distanceMeters(myPos, { latitude: m.latitude, longitude: m.longitude })
            : null,
      }));
      setCrew(withDist);
      setFromCache(false);
      cacheSet(cacheKey, data.crew || []);
      if (data.degraded) setError('Crew data is temporarily degraded — pull to retry.');
    } catch (err: any) {
      const cached = await cacheGet<CrewMember[]>(cacheKey, TTL.crew);
      if (cached) {
        setCrew(cached.data.map((m) => ({ ...m, distanceM: null })));
        setFromCache(true);
        setError(null);
      } else {
        setError(err?.response?.data?.error?.message || err.message || 'Failed to load crew');
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [jobId, myPos]);

  useEffect(() => { refresh(); }, [refresh]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refresh();
  }, [refresh]);

  return { crew, loading, refreshing, error, gpsAvailable, fromCache, refresh: onRefresh };
}
