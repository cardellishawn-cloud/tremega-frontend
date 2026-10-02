// src/hooks/useActivity.ts — time logging state for the Activity tab.
// Talks to /api/activity (POST clock_in/clock_out, GET today's entries).
// Slice 6: stale-while-revalidate cache — offline shows cached entries.
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../lib/api';
import { cacheGet, cacheSet, TTL } from '../lib/offline';

export interface ActivityEntry {
  id: string | null;
  job_id: string;
  worker_id: string;
  phase: string;
  startTime: string;
  endTime: string | null;
  duration: number; // ms
}

interface ActivityState {
  phases: string[];
  currentPhase: string;
  isClocked: boolean;
  startTime: string | null;
  elapsedMs: number;
  todayLogs: ActivityEntry[];
  loading: boolean;
  busy: boolean;
  error: string | null;
  fromCache: boolean;
  setPhase: (phase: string) => void;
  clockIn: () => Promise<void>;
  clockOut: () => Promise<void>;
  refresh: () => Promise<void>;
}

export function useActivity(jobId: string | null): ActivityState {
  const [phases, setPhases] = useState<string[]>([]);
  const [currentPhase, setCurrentPhase] = useState('framing');
  const [open, setOpen] = useState<ActivityEntry | null>(null);
  const [todayLogs, setTodayLogs] = useState<ActivityEntry[]>([]);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fromCache, setFromCache] = useState(false);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const cacheKey = `activity_cache_${jobId || 'none'}`;

  const refresh = useCallback(async () => {
    if (!jobId) { setLoading(false); return; }
    try {
      setError(null);
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await api.get('/api/activity', {
        params: { job_id: jobId, date: today },
      });
      setTodayLogs(data.entries || []);
      setPhases(data.phases || []);
      setFromCache(false);
      cacheSet(cacheKey, { entries: data.entries || [], phases: data.phases || [] });
      if (data.open) {
        setOpen(data.open);
        setCurrentPhase(data.open.phase);
      } else {
        setOpen(null);
      }
    } catch (err: any) {
      const cached = await cacheGet<{ entries: ActivityEntry[]; phases: string[] }>(cacheKey, TTL.activity);
      if (cached) {
        setTodayLogs(cached.data.entries);
        if (cached.data.phases?.length) setPhases(cached.data.phases);
        setFromCache(true);
        setError(null);
      } else {
        setError(err?.response?.data?.error?.message || err.message || 'Failed to load');
      }
    } finally {
      setLoading(false);
    }
  }, [jobId, cacheKey]);

  useEffect(() => { refresh(); }, [refresh]);

  // 1s elapsed timer while clocked in.
  useEffect(() => {
    if (timer.current) clearInterval(timer.current);
    if (!open) { setElapsedMs(0); return undefined; }
    const startMs = new Date(open.startTime).getTime();
    const tick = () => setElapsedMs(Math.max(0, Date.now() - startMs));
    tick();
    timer.current = setInterval(tick, 1000);
    return () => { if (timer.current) clearInterval(timer.current); };
  }, [open]);

  const clockIn = useCallback(async () => {
    if (!jobId || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/api/activity', {
        job_id: jobId, phase: currentPhase, action: 'clock_in',
      });
      setOpen({ ...data.open, endTime: null, duration: 0 });
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Clock-in failed (offline?)');
    } finally {
      setBusy(false);
    }
  }, [jobId, currentPhase, busy]);

  const clockOut = useCallback(async () => {
    if (!jobId || !open || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { data } = await api.post('/api/activity', {
        job_id: jobId, phase: open.phase, action: 'clock_out',
      });
      setOpen(null);
      if (data.entry) setTodayLogs((logs) => [data.entry, ...logs]);
    } catch (err: any) {
      setError(err?.response?.data?.error?.message || 'Clock-out failed (offline?)');
    } finally {
      setBusy(false);
    }
  }, [jobId, open, busy]);

  return {
    phases,
    currentPhase,
    isClocked: Boolean(open),
    startTime: open?.startTime ?? null,
    elapsedMs,
    todayLogs,
    loading,
    busy,
    error,
    fromCache,
    setPhase: setCurrentPhase,
    clockIn,
    clockOut,
    refresh,
  };
}
