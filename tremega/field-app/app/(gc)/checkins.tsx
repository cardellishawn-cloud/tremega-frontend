// app/(gc)/checkins.tsx — map + geofence check-in (Phase 2 frontend spec, W2/W5).
// Shows the selected job's geofence (client-side geocode of job_address,
// 150 m default radius), live distance, and an accuracy-gated check-in that
// posts to /api/checkins with project_id = work order id.
import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MapView, { Circle, Marker } from 'react-native-maps';
import * as Location from 'expo-location';
import { api } from '../../src/lib/api';
import { distanceMeters, formatDistance } from '../../src/lib/geo';
import { colors, spacing, typography } from '../../src/lib/theme';
import { useWorkOrders, type WorkOrder, type Checkin } from '../../src/stores/workOrders';

const GEOFENCE_RADIUS_M = 150;
const MAX_ACCURACY_M = 50;

interface JobSite {
  latitude: number;
  longitude: number;
}

export default function CheckinsMap() {
  const { items, fetchAll } = useWorkOrders();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [permission, setPermission] = useState<'pending' | 'granted' | 'denied'>('pending');
  const [position, setPosition] = useState<Location.LocationObject | null>(null);
  const [site, setSite] = useState<JobSite | null>(null);
  const [geocoding, setGeocoding] = useState(false);
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState<Checkin[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeJobs = useMemo(
    () => items.filter((w) => w.status !== 'completed'),
    [items],
  );
  const job: WorkOrder | undefined =
    activeJobs.find((w) => w.id === selectedId) ?? activeJobs[0];

  useEffect(() => {
    fetchAll().catch(() => setFeedback('Could not load jobs.'));
  }, [fetchAll]);

  useEffect(() => {
    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      setPermission(status === 'granted' ? 'granted' : 'denied');
      if (status !== 'granted') return;
      const loc = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });
      setPosition(loc);
    })().catch(() => setFeedback('GPS unavailable.'));
  }, []);

  // Geocode the selected job's address -> geofence center (best effort).
  useEffect(() => {
    setSite(null);
    if (!job?.job_address) return;
    setGeocoding(true);
    Location.geocodeAsync(job.job_address)
      .then((hits) => {
        if (hits[0]) setSite({ latitude: hits[0].latitude, longitude: hits[0].longitude });
      })
      .catch(() => { /* no circle — distance text still works after checkin */ })
      .finally(() => setGeocoding(false));
  }, [job?.id, job?.job_address]);

  const refreshHistory = useCallback(async (jobId: string) => {
    try {
      const { data } = await api.get('/api/checkins', { params: { project_id: jobId } });
      setHistory(data.checkins || []);
    } catch { setHistory([]); }
  }, []);

  useEffect(() => {
    if (job) refreshHistory(job.id);
  }, [job, refreshHistory]);

  const me = position?.coords;
  const distM = me && site
    ? distanceMeters(
        { latitude: me.latitude, longitude: me.longitude },
        site,
      )
    : null;
  const accuracy = me?.accuracy ?? null;
  const inside = distM !== null ? distM <= GEOFENCE_RADIUS_M : null;
  const gpsTooCoarse = accuracy !== null && accuracy > MAX_ACCURACY_M;
  const canCheckin = Boolean(job && me && !busy && !gpsTooCoarse);

  const doCheckin = async () => {
    if (!job || !me) return;
    setBusy(true);
    setFeedback(null);
    try {
      const { data } = await api.post('/api/checkins', {
        project_id: job.id,
        lat: me.latitude,
        lng: me.longitude,
        accuracy_m: accuracy ?? undefined,
        note: inside === false ? 'outside_geofence_client' : undefined,
      });
      const v = data.verification;
      if (v?.verified === true) setFeedback(`Checked in — ${formatDistance(v.distance_m)} inside the fence.`);
      else if (v?.verified === false) setFeedback(`Checked in OUTSIDE the fence (${formatDistance(v.distance_m)}). Flagged for review.`);
      else if (inside !== null) setFeedback(inside ? 'Checked in (client-verified inside fence).' : 'Checked in outside fence (client-side check).');
      else setFeedback('Checked in. No geofence configured — unverified.');
      await refreshHistory(job.id);
    } catch (err: any) {
      setFeedback('Check-in failed: ' + (err?.response?.data?.error?.message || err.message));
    } finally {
      setBusy(false);
    }
  };

  if (permission === 'denied') {
    return (
      <View style={styles.center}>
        <Text style={typography.title}>Location permission needed</Text>
        <Text style={[typography.dim, styles.centerText]}>
          Tremega verifies check-ins by GPS. Enable location access in system settings, then reopen this tab.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <MapView
        style={styles.map}
        showsUserLocation
        region={
          site
            ? { ...site, latitudeDelta: 0.01, longitudeDelta: 0.01 }
            : me
              ? { latitude: me.latitude, longitude: me.longitude, latitudeDelta: 0.02, longitudeDelta: 0.02 }
              : undefined
        }
      >
        {site && (
          <>
            <Marker coordinate={site} title={job?.title} description={job?.job_address ?? undefined} pinColor={colors.accent} />
            <Circle
              center={site}
              radius={GEOFENCE_RADIUS_M}
              strokeColor="rgba(255,140,66,0.9)"
              fillColor="rgba(255,140,66,0.15)"
            />
          </>
        )}
      </MapView>

      <View style={styles.sheet}>
        {activeJobs.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chips}>
            {activeJobs.map((w) => (
              <Pressable
                key={w.id}
                onPress={() => setSelectedId(w.id)}
                style={[styles.chip, job?.id === w.id && styles.chipActive]}
              >
                <Text style={[styles.chipText, job?.id === w.id && styles.chipTextActive]} numberOfLines={1}>
                  {w.title}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
        )}

        {!job && <Text style={typography.dim}>No active jobs assigned.</Text>}
        {job && (
          <>
            <Text style={typography.heading} numberOfLines={1}>{job.title}</Text>
            <Text style={typography.dim}>{job.job_address || 'No address on file'}</Text>
            <Text style={styles.distance}>
              {geocoding && 'Locating job site…'}
              {!geocoding && distM !== null && (
                inside
                  ? `You are ${formatDistance(distM)} from the job site — inside the fence.`
                  : `You are ${formatDistance(distM)} from the job site — outside the ${GEOFENCE_RADIUS_M} m fence.`
              )}
              {!geocoding && distM === null && !site && 'Job site location unavailable — check-in will be unverified.'}
            </Text>
            {gpsTooCoarse && (
              <Text style={styles.warn}>GPS accuracy ±{Math.round(accuracy!)} m — move to open sky for a fix under {MAX_ACCURACY_M} m.</Text>
            )}

            <Pressable
              style={[styles.checkinBtn, !canCheckin && styles.checkinBtnDisabled]}
              disabled={!canCheckin}
              onPress={doCheckin}
            >
              {busy
                ? <ActivityIndicator color={colors.bg} />
                : <Text style={styles.checkinBtnText}>
                    {inside === false ? 'CHECK IN (OUTSIDE FENCE)' : 'CHECK IN'}
                  </Text>}
            </Pressable>
            {feedback && <Text style={styles.feedback}>{feedback}</Text>}

            {history.length > 0 && (
              <View style={styles.history}>
                <Text style={[typography.dim, { marginBottom: spacing.xs }]}>Recent check-ins</Text>
                {history.slice(0, 5).map((c) => (
                  <Text key={c.id} style={styles.historyRow}>
                    {new Date(c.created_at).toLocaleString()} — {c.verification_status || 'recorded'}
                  </Text>
                ))}
              </View>
            )}
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  map: { flex: 1 },
  center: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', padding: spacing.lg },
  centerText: { marginTop: spacing.sm, textAlign: 'center' },
  sheet: {
    backgroundColor: colors.card,
    borderTopColor: colors.cardBorder,
    borderTopWidth: 1,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  chips: { flexGrow: 0, marginBottom: spacing.xs },
  chip: {
    borderColor: colors.cardBorder, borderWidth: 1, borderRadius: 16,
    paddingVertical: spacing.xs, paddingHorizontal: spacing.md, marginRight: spacing.sm,
    maxWidth: 220,
  },
  chipActive: { borderColor: colors.accent, backgroundColor: colors.bg },
  chipText: { ...typography.dim },
  chipTextActive: { color: colors.accent },
  distance: { ...typography.body, color: colors.text, marginTop: spacing.xs },
  warn: { ...typography.dim, color: colors.accent },
  checkinBtn: {
    backgroundColor: colors.accent,
    borderRadius: 12,
    minHeight: 56,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.sm,
  },
  checkinBtnDisabled: { opacity: 0.4 },
  checkinBtnText: { ...typography.heading, color: colors.bg, fontWeight: '700' },
  feedback: { ...typography.dim, marginTop: spacing.xs },
  history: { marginTop: spacing.sm },
  historyRow: { ...typography.dim, fontSize: 13 },
});
